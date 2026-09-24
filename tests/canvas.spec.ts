import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { fileURLToPath } from 'node:url'

async function createCanvasProject(page: Page, title = 'Mission Diagram') {
  await page.goto('/')
  await page.getByRole('button', { name: 'New project', exact: true }).click()
  await page.getByRole('textbox', { name: 'Project name' }).fill(title)
  await page.getByRole('checkbox', { name: 'Graphing', exact: true }).uncheck()
  await page.getByRole('checkbox', { name: 'Spreadsheet', exact: true }).uncheck()
  await page.getByRole('checkbox', { name: 'Visual canvas', exact: true }).check()
  await page.getByRole('button', { name: 'Create project', exact: true }).click()
  await page.getByRole('heading', { name: title, exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Visual canvas' })).toBeVisible()
}
/** The library as saved; module edits are written shortly after they are made. */
const saved = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<string | null>((r) =>
        setTimeout(() => r(localStorage.getItem('junga.library.v1')), 600),
      ),
  )
/** Page coordinates of a point on the canvas, given the stage's transform. */
async function stagePoint(page: Page, x: number, y: number) {
  const stage = page.locator('.canvas-stage')
  const box = (await stage.boundingBox())!
  const transform = await page.locator('.canvas-stage-svg > g').getAttribute('transform')
  const match = /translate\(([-\d.]+) ([-\d.]+)\) scale\(([-\d.]+)\)/.exec(transform ?? '')!
  const [tx, ty, zoom] = [Number(match[1]), Number(match[2]), Number(match[3])]
  return { x: box.x + tx + x * zoom, y: box.y + ty + y * zoom }
}
async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 })
  await page.mouse.move(to.x, to.y, { steps: 4 })
  await page.mouse.up()
}

test('draws shapes and text, connects them, edits properties, and keeps them through a reload', async ({
  page,
}) => {
  test.setTimeout(90000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await createCanvasProject(page)
  await page.getByRole('button', { name: 'Open visual canvas', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Mission Diagram' })).toBeVisible()
  await expect(page.getByText('Presentation deck', { exact: false }).first()).toBeVisible()

  // Draw a rectangle from the shapes menu.
  await page.getByRole('button', { name: 'Shapes (R, O)' }).click()
  await page.getByRole('menuitem', { name: 'Rectangle' }).click()
  await drag(page, await stagePoint(page, 100, 100), await stagePoint(page, 300, 200))
  await expect(page.getByRole('heading', { name: 'Shape' })).toBeVisible()
  await expect(page.getByLabel('Width', { exact: true })).toHaveValue('200')
  await expect(page.getByLabel('Height', { exact: true })).toHaveValue('100')

  // Type its label and give it a name through the inspector.
  await page.keyboard.press('Enter')
  const editor = page.getByRole('textbox', { name: 'Edit text' })
  await expect(editor).toBeVisible()
  await editor.fill('Pump')
  await page.keyboard.press('Control+Enter')
  await expect(page.locator('.canvas-stage-svg text', { hasText: 'Pump' })).toBeVisible()
  await page.getByLabel('Name', { exact: true }).fill('Pump box')
  await page.getByLabel('Name', { exact: true }).press('Enter')

  // Draw an ellipse with the keyboard shortcut and connect the two with the connector tool.
  await page.keyboard.press('Escape')
  await page.keyboard.press('o')
  await drag(page, await stagePoint(page, 500, 100), await stagePoint(page, 700, 220))
  await expect(page.getByRole('heading', { name: 'Shape' })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Connector (L)' }).click()
  await drag(page, await stagePoint(page, 200, 150), await stagePoint(page, 600, 160))
  await expect(page.getByRole('heading', { name: 'Route and arrows' })).toBeVisible()
  await page.getByLabel('Routing').selectOption('orthogonal')
  await page.getByLabel('Label', { exact: true }).fill('flow')
  await page.getByLabel('Label', { exact: true }).press('Enter')
  await expect(page.locator('.canvas-stage-svg text', { hasText: 'flow' })).toBeVisible()

  // A text element by double-clicking empty canvas.
  const empty = await stagePoint(page, 120, 400)
  await page.mouse.dblclick(empty.x, empty.y)
  await page.getByRole('textbox', { name: 'Edit text' }).fill('T_{0} = 300 K')
  await page.keyboard.press('Control+Enter')
  await expect(page.locator('.canvas-stage-svg text', { hasText: '300 K' })).toBeVisible()

  // Everything saved and survives a reload; connectors stay attached.
  await expect(page.getByText('Changes not saved')).toHaveCount(0)
  const stored = (await saved(page))!
  expect(stored).toContain('"Pump box"')
  expect(stored).toContain('"routing":"orthogonal"')
  // Reloading keeps the editor route open.
  await page.reload()
  await expect(page.locator('.canvas-stage-svg text', { hasText: 'Pump' })).toBeVisible()
  await expect(page.locator('.canvas-stage-svg text', { hasText: 'flow' })).toBeVisible()
  const library = JSON.parse(stored)
  const elements = library.projects[0].canvas.pages[0].elements
  const connector = elements.find((e: { type: string }) => e.type === 'connector')
  expect(connector.start.elementId).toBeTruthy()
  expect(connector.end.elementId).toBeTruthy()

  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations.map((v) => v.id)).toEqual([])
  expect(errors).toEqual([])
})

test('adds slides, presents them on an output route, and keeps the output read-only', async ({
  page,
}) => {
  test.setTimeout(60000)
  await createCanvasProject(page, 'Deck Owner')
  await page.getByRole('button', { name: 'Open visual canvas', exact: true }).click()
  await page.getByRole('button', { name: 'Add slide', exact: true }).click()
  await expect(page.getByRole('button', { name: /Slide 2, slide 2 of 2/ })).toBeVisible()
  await page.getByLabel('Name', { exact: true }).fill('Closing')
  await page.getByLabel('Name', { exact: true }).press('Enter')
  await expect(page.getByRole('button', { name: /Closing, slide 2 of 2/ })).toBeVisible()

  // Present from the editor: arrow keys move between slides, Escape returns.
  await page.getByRole('button', { name: 'Present', exact: true }).click()
  await expect(page.getByText('2 / 2')).toBeVisible()
  await page.keyboard.press('ArrowLeft')
  await expect(page.getByText('1 / 2')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByText('1 / 2')).toHaveCount(0)

  // The overview owns a canvas output that opens on the output route.
  await page.getByRole('button', { name: 'Back to project', exact: true }).click()
  await page.getByRole('button', { name: 'Add canvas output', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Deck Owner presentation' })).toBeVisible()
  await page.getByRole('link', { name: 'Open output', exact: true }).click()
  expect(page.url()).toMatch(/#\/project\/[^/]+\/output\/[^/]+$/)
  await expect(page.getByText('Made by Deck Owner', { exact: false })).toBeVisible()
  await expect(page.getByText('1 / 2')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Edit details', exact: true })).toHaveCount(0)
  await expect(page.getByRole('toolbar', { name: 'Canvas tools' })).toHaveCount(0)
  await page.keyboard.press('ArrowRight')
  await expect(page.getByText('2 / 2')).toBeVisible()
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations.map((v) => v.id)).toEqual([])
  await page.getByRole('link', { name: 'Back to Deck Owner', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Deck Owner', exact: true })).toBeVisible()
})

test('imports a draw.io file into canvases, keeping labels, connectors, and unsupported shapes', async ({
  page,
}) => {
  test.setTimeout(60000)
  await createCanvasProject(page, 'Imported Board')
  await page.getByRole('button', { name: 'Open visual canvas', exact: true }).click()
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('menuitem', { name: 'Import draw.io file…' }).click()
  await (
    await chooser
  ).setFiles(fileURLToPath(new URL('./fixtures/simple.drawio', import.meta.url)))
  await expect(page.locator('.canvas-message')).toContainText(
    'Imported 1 page with 5 elements; 1 unsupported',
  )
  await expect(page.locator('.canvas-stage-svg text', { hasText: 'Pump' })).toBeVisible()
  await expect(page.locator('.canvas-stage-svg text', { hasText: 'Cryogenic LH2' })).toBeVisible()
  await expect(page.locator('.canvas-stage-svg text', { hasText: 'Custom' })).toBeVisible()
  const library = JSON.parse((await saved(page))!)
  const canvas = library.projects[0].canvas
  expect(canvas.pages).toHaveLength(1)
  expect(canvas.pages[0].name).toBe('Flow')
  const elements = canvas.pages[0].elements
  const reactor = elements.find((e: { text?: string }) => e.text?.startsWith('Reactor'))
  expect(reactor.shape).toBe('ellipse')
  expect(reactor.text).toContain('T_{5}')
  expect(reactor.fill).toMatch(/^gradient\(/)
  const flow = elements.find((e: { type: string }) => e.type === 'connector')
  expect(flow.routing).toBe('orthogonal')
  expect(flow.endArrow).toBe('triangle')
  expect(flow.stroke.dash).toBe('dashed')
  expect(flow.points).toHaveLength(1)
  expect(flow.start.elementId).toBeTruthy()
})

test('exports the current canvas as SVG', async ({ page }) => {
  await createCanvasProject(page, 'Export Me')
  await page.getByRole('button', { name: 'Open visual canvas', exact: true }).click()
  await page.getByRole('button', { name: 'Shapes (R, O)' }).click()
  await page.getByRole('menuitem', { name: 'Star' }).click()
  await drag(page, await stagePoint(page, 100, 100), await stagePoint(page, 260, 260))
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  const download = page.waitForEvent('download')
  await page.getByRole('menuitem', { name: 'This canvas as SVG' }).click()
  const file = await download
  expect(file.suggestedFilename()).toBe('export-me-slide-1.svg')
  const text = await (
    await file.createReadStream()
  )
    .toArray()
    .then((chunks) => Buffer.concat(chunks).toString())
  expect(text).toContain('<svg')
  expect(text).toContain('width="960"')
  expect(text).toContain('<path')
})
