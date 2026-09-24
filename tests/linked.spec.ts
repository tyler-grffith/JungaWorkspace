import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import type { Library } from '../src/library'

const cell = (page: Page, ref: string) => page.getByRole('gridcell', { name: ref, exact: true })
async function example(page: Page) {
  await page.goto('/')
  await page
    .getByRole('navigation', { name: 'Shortcuts', exact: true })
    .getByRole('link', { name: 'Octahedron Sections', exact: true })
    .click()
  await expect(page.getByTestId('linked-point')).toHaveCount(6)
}
async function enter(page: Page, ref: string, value: string) {
  await cell(page, ref).dblclick()
  const input = page.getByRole('textbox', { name: `Edit cell ${ref}`, exact: true })
  await input.fill(value)
  await input.press('Enter')
}
async function saved(page: Page): Promise<Library> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('junga.library.v1')!))
}
async function accessible(page: Page) {
  const result = await new AxeBuilder({ page }).analyze()
  expect(
    result.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({ target: n.target, issue: n.failureSummary })),
    })),
  ).toEqual([])
}

test('octahedron opens side by side and recalculates the six points from s, h and t', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await example(page)
  const left = await page
    .getByRole('region', { name: 'Linked spreadsheet', exact: true })
    .boundingBox()
  const right = await page.getByRole('region', { name: 'Linked graph', exact: true }).boundingBox()
  expect(right!.x).toBeGreaterThanOrEqual(left!.x + left!.width)
  expect(Number(await cell(page, 'B3').textContent())).toBeCloseTo(Math.sqrt(3) * 2.5, 10)
  await expect(page.getByTestId('linked-point').first()).toHaveAttribute('data-x', '0.8075')
  const slider = page.getByRole('slider', { name: 'Slider t', exact: true })
  await slider.press('Home')
  await expect(cell(page, 'B4')).toHaveText('0')
  await expect(page.getByTestId('linked-point').first()).toHaveAttribute('data-x', '0')
  await slider.press('End')
  await expect(cell(page, 'B4')).toHaveText('1')
  await expect(page.getByTestId('linked-point').first()).toHaveAttribute('data-x', '2.5')
  await enter(page, 'B2', '8')
  await expect(page.getByTestId('linked-point').first()).toHaveAttribute('data-x', '4')
  expect(Number(await cell(page, 'B3').textContent())).toBeCloseTo(Math.sqrt(3) * 4, 7)
  await page.reload()
  await expect(slider).toHaveValue('1')
  await expect(cell(page, 'B2')).toHaveText('8')
  await expect(page.getByTestId('linked-outline')).toHaveAttribute('d', / Z$/)
})

test('cell and formula edits update the graph, isolate bad points, and protect derived slider cells', async ({
  page,
}) => {
  await example(page)
  await enter(page, 'B4', '0.5')
  await expect(page.getByRole('slider', { name: 'Slider t', exact: true })).toHaveValue('0.5')
  await expect(page.getByTestId('linked-point').first()).toHaveAttribute('data-x', '1.25')
  await enter(page, 'B7', '=s*t')
  await expect(page.getByTestId('linked-point').first()).toHaveAttribute('data-x', '2.5')
  await enter(page, 'B8', '=1/0')
  await expect(page.getByTestId('linked-point')).toHaveCount(5)
  await expect(page.getByRole('region', { name: 'Linked graph', exact: true })).toContainText(
    'B8, C8',
  )
  await expect(page.getByTestId('linked-outline')).not.toHaveAttribute('d', / Z$/)
  await page.getByRole('button', { name: 'Undo spreadsheet change' }).click()
  await expect(page.getByTestId('linked-point')).toHaveCount(6)
  await enter(page, 'B4', '=1/2')
  await expect(page.getByRole('slider', { name: 'Slider t', exact: true })).toBeDisabled()
  await expect(page.getByRole('region', { name: 'Model controls' })).toContainText(
    'contains a formula',
  )
  await page.getByRole('link', { name: 'Graph only', exact: true }).click()
  await expect(page.getByTestId('linked-point')).toHaveCount(6)
  await page.getByRole('link', { name: 'Side by side', exact: true }).click()
  await expect(cell(page, 'B7')).toHaveText('2.5')
})

test('any two-tool project can configure ranges, cell names and a slider without the example', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'New project', exact: true }).click()
  await page.getByLabel('Project name', { exact: true }).fill('Linked experiment')
  await page.getByRole('button', { name: 'Create project', exact: true }).click()
  await page.getByRole('button', { name: 'Open side by side', exact: true }).click()
  for (const [ref, value] of [
    ['A1', '2'],
    ['B1', '4'],
    ['A2', '3'],
    ['B2', '5'],
  ])
    await enter(page, ref, value)
  await page.getByRole('button', { name: 'Link settings', exact: true }).click()
  await page.getByLabel('Names and cell addresses').fill('a = A1')
  await page.getByRole('button', { name: 'Add cell slider' }).click()
  await page.getByLabel('Slider 1 label', { exact: true }).fill('a')
  await page.getByLabel('Slider 1 cell', { exact: true }).fill('A1')
  await page.getByLabel('Slider 1 max', { exact: true }).fill('10')
  await page.getByLabel('Slider 1 step', { exact: true }).fill('1')
  await page.getByRole('button', { name: 'Add point series' }).click()
  await page.getByLabel('Series 1 x cells').fill('A1:A2')
  await page.getByLabel('Series 1 y cells').fill('B1:B2')
  await page.getByRole('button', { name: 'Apply links' }).click()
  await expect(page.getByTestId('linked-point')).toHaveCount(2)
  await page.getByRole('slider', { name: 'Slider a', exact: true }).press('ArrowRight')
  await expect(cell(page, 'A1')).toHaveText('3')
  await enter(page, 'B2', '=a*2')
  await expect(cell(page, 'B2')).toHaveText('6')
  await page.getByRole('button', { name: 'Link settings', exact: true }).click()
  await page.getByLabel('Series 1 y cells').fill('B1:B3')
  await page.getByRole('button', { name: 'Apply links' }).click()
  await expect(page.getByRole('alert')).toContainText('equally sized')
  expect((await saved(page)).projects[0].graph!.sheetPlots![0].yRange).toBe('B1:B2')
  await page.getByRole('button', { name: 'Close link settings' }).click()
  await page.reload()
  await expect(page.getByTestId('linked-point')).toHaveCount(2)
  await expect(page.getByRole('slider', { name: 'Slider a', exact: true })).toHaveValue('3')
})

test('linked contents survive independent duplication, trash restoration and backup recovery', async ({
  page,
}) => {
  await example(page)
  // The built-in example is not stored until edited; its copy is an ordinary project.
  expect(await page.evaluate(() => localStorage.getItem('junga.library.v1'))).toBeNull()
  await page.getByRole('button', { name: 'Project overview', exact: true }).click()
  await page.getByLabel('Actions for Octahedron Sections', { exact: true }).click()
  await page.getByRole('button', { name: 'Duplicate', exact: true }).click()
  const copy = (await saved(page)).projects[0]
  expect(copy.title).toBe('Octahedron Sections (copy)')
  await page.goto(`/#/project/${copy.id}/workspace`)
  await enter(page, 'B2', '10')
  expect((await saved(page)).projects.map((p) => p.id)).toEqual([copy.id])
  await page.goto('/#/project/example-octahedron/workspace')
  await expect(cell(page, 'B2')).toHaveText('5')
  await page.goto(`/#/project/${copy.id}/workspace`)
  await page.getByRole('button', { name: 'Project overview', exact: true }).click()
  await page.getByLabel(`Actions for ${copy.title}`, { exact: true }).click()
  await page.getByRole('button', { name: 'Move to trash', exact: true }).click()
  await page.getByRole('button', { name: 'Open side by side', exact: true }).click()
  await expect(page.getByRole('slider', { name: 'Slider t', exact: true })).toBeDisabled()
  await expect(page.getByTestId('linked-point')).toHaveCount(6)
  await page.getByRole('button', { name: 'Project overview', exact: true }).click()
  await page.getByRole('button', { name: 'Restore project', exact: true }).click()
  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download library backup' }).click()
  const stream = await (await downloading).createReadStream(),
    chunks: Buffer[] = []
  for await (const chunk of stream!) chunks.push(chunk)
  await page.getByRole('button', { name: 'Restore library backup', exact: true }).click()
  await page.getByLabel('Backup file', { exact: true }).setInputFiles({
    name: 'linked.json',
    mimeType: 'application/json',
    buffer: Buffer.concat(chunks),
  })
  await page.getByRole('button', { name: 'Restore copies', exact: true }).click()
  const restored = (await saved(page)).projects.find(
    (p) => p.title === 'Octahedron Sections (copy) (restored)',
  )!
  await page.goto(`/#/project/${restored.id}/workspace`)
  await expect(page.getByTestId('linked-point')).toHaveCount(6)
  await expect(cell(page, 'B2')).toHaveText('10')
  await expect(page.getByRole('slider', { name: 'Slider t', exact: true })).toHaveValue('0.323')
})

test('failed linked edits retain and back up both drafts, guard navigation and retry', async ({
  page,
}) => {
  await example(page)
  await page.evaluate(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key === 'junga.library.v1' && !sessionStorage.getItem('allow-writes'))
        throw new DOMException('Full', 'QuotaExceededError')
      original.call(this, key, value)
    }
  })
  await page.getByRole('slider', { name: 'Slider t', exact: true }).press('ArrowRight')
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download unsaved work', exact: true }).click()
  const stream = await (await downloading).createReadStream(),
    chunks: Buffer[] = []
  for await (const chunk of stream!) chunks.push(chunk)
  const backup = JSON.parse(Buffer.concat(chunks).toString()) as Library
  // The unsaved edits to the built-in ride along, over a library that stored nothing yet.
  expect(backup.projects.map((p) => p.id)).toEqual(['example-octahedron'])
  expect(backup.projects[0].sheet!.cells.B4.input).toBe('0.324')
  expect(backup.projects[0].graph!.viewport).not.toEqual({
    xMin: -3.5,
    xMax: 3.5,
    yMin: -4,
    yMax: 3,
  })
  page.once('dialog', (d) => d.dismiss())
  await page.getByRole('link', { name: 'Spreadsheet only', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Linked graph', exact: true })).toBeVisible()
  await page.evaluate(() => sessionStorage.setItem('allow-writes', 'true'))
  await page.getByRole('button', { name: 'Retry saving spreadsheet' }).click()
  await page.getByRole('button', { name: 'Retry saving graph' }).click()
  await page.reload()
  await expect(cell(page, 'B4')).toHaveText('0.324')
  await expect(page.getByTestId('linked-point')).toHaveCount(6)
})

test('sequential changes from another tab recalculate both views', async ({ page, context }) => {
  await example(page)
  const other = await context.newPage()
  await other.goto(page.url())
  await page.getByRole('slider', { name: 'Slider t', exact: true }).press('End')
  await expect(cell(other, 'B4')).toHaveText('1')
  await enter(other, 'B2', '6')
  await expect(page.getByTestId('linked-point').first()).toHaveAttribute('data-x', '3')
  await expect(cell(page, 'B2')).toHaveText('6')
})

test('combined workspace and link settings are accessible on desktop and mobile', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await example(page)
  await accessible(page)
  await page.getByRole('button', { name: 'Formatting', exact: true }).click()
  await expect(page.getByRole('toolbar', { name: 'Cell formatting and tools' })).toBeVisible()
  await accessible(page)
  await page.getByRole('button', { name: 'Formatting', exact: true }).click()
  await page.screenshot({ path: testInfo.outputPath('linked-desktop.png') })
  await page.getByRole('button', { name: 'Link settings', exact: true }).click()
  await accessible(page)
  await page.getByRole('button', { name: 'Close link settings' }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await accessible(page)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  await page.screenshot({ path: testInfo.outputPath('linked-mobile.png'), fullPage: true })
})
