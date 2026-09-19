import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import type { GraphDocument } from '../src/graph/model'

async function blank(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'New project', exact: true }).click()
  await page.getByRole('textbox', { name: 'Project name', exact: true }).fill('Interaction checks')
  await page.getByRole('button', { name: 'Create project', exact: true }).click()
  await page.getByRole('button', { name: 'Open calculator' }).click()
}
async function graph(page: Page): Promise<GraphDocument> {
  return page.evaluate(
    () => JSON.parse(localStorage.getItem('junga.library.v1')!).projects[0].graph,
  )
}
test('points and implicit equations update with parameters and survive reload', async ({
  page,
}) => {
  await blank(page)
  await page.getByLabel('Formula 1', { exact: true }).fill('f(x)=2x')
  await page.getByRole('button', { name: 'Points', exact: true }).click()
  await page.getByLabel('Point 2', { exact: true }).fill('(a, f(a))')
  await expect(page.getByLabel('Point 2', { exact: true })).toHaveAttribute('aria-invalid', 'true')
  await page.getByRole('button', { name: 'Parameter', exact: true }).click()
  await expect(page.getByTestId('graph-point')).toHaveAttribute('data-x', '1')
  await expect(page.getByTestId('graph-point')).toHaveAttribute('data-y', '2')
  await page.getByRole('button', { name: 'Implicit equation', exact: true }).click()
  await page.getByLabel('Implicit equation 4', { exact: true }).fill('x^2+y^2=a^2')
  const implicit = page.locator('[data-testid="curve"][data-kind="implicit"]')
  await expect(implicit).toHaveAttribute('d', /M/)
  const before = await implicit.getAttribute('d')
  await page.getByRole('slider', { name: 'Slider a', exact: true }).press('ArrowRight')
  await expect(page.getByTestId('graph-point')).toHaveAttribute('data-y', '2.2')
  await expect(implicit).not.toHaveAttribute('d', before!)
  await page.reload()
  await expect(page.getByTestId('graph-point')).toHaveAttribute('data-x', '1.1')
  await expect(implicit).toHaveAttribute('d', /M/)
  await page.getByRole('button', { name: 'Hide point 2', exact: true }).click()
  await expect(page.getByTestId('graph-point')).toHaveCount(0)
  await page.getByRole('button', { name: 'Undo graph change' }).click()
  await expect(page.getByTestId('graph-point')).toHaveCount(1)
})

test('all row types reorder with drag or keyboard and preserve dependencies through undo', async ({
  page,
}) => {
  await blank(page)
  await page.getByLabel('Formula 1', { exact: true }).fill('y=a*x')
  await page.getByRole('button', { name: 'Parameter', exact: true }).click()
  await page.getByRole('button', { name: 'Note', exact: true }).click()
  await page.getByLabel('Graph note 3').fill('Drag me')
  const original = (await graph(page)).entries.map((e) => e.id)
  await page
    .getByRole('button', { name: 'Reorder note 3' })
    .dragTo(page.locator('.expression-row').first())
  await expect(page.getByLabel('Graph note 1')).toHaveValue('Drag me')
  expect((await graph(page)).entries.map((e) => e.id)).toEqual([
    original[2],
    original[0],
    original[1],
  ])
  await page.getByRole('button', { name: 'Reorder parameter 3' }).press('Alt+ArrowUp')
  expect((await graph(page)).entries.map((e) => e.id)).toEqual([
    original[2],
    original[1],
    original[0],
  ])
  await expect(page.getByTestId('curve')).toHaveCount(1)
  await page.getByRole('button', { name: 'Undo graph change' }).click()
  expect((await graph(page)).entries.map((e) => e.id)).toEqual([
    original[2],
    original[0],
    original[1],
  ])
  await page.reload()
  await expect(page.getByLabel('Graph note 1')).toHaveValue('Drag me')
})

test('playback traverses in five seconds, stops or reverses, and saves settings and final value', async ({
  page,
}) => {
  await blank(page)
  await page.getByRole('button', { name: 'Parameter', exact: true }).click()
  const slider = page.getByRole('slider', { name: 'Slider a', exact: true })
  await slider.press('Home')
  await page.getByRole('button', { name: 'Animation settings for a', exact: true }).click()
  await page.getByLabel('Animation mode for a', { exact: true }).selectOption('once')
  await page.clock.install()
  await page.getByRole('button', { name: 'Play a', exact: true }).click()
  await page.clock.runFor(2500)
  expect(Number(await slider.inputValue())).toBeCloseTo(0, 0)
  await page.clock.runFor(2700)
  await expect(slider).toHaveValue('5')
  await expect(page.getByRole('button', { name: 'Play a', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Undo graph change' }).click()
  await expect(slider).toHaveValue('-5')
  await page.getByRole('button', { name: 'Speed up a', exact: true }).click()
  await page.getByLabel('Animation mode for a', { exact: true }).selectOption('reverse')
  await page.getByRole('button', { name: 'Play a', exact: true }).click()
  await page.clock.runFor(3750)
  expect(Number(await slider.inputValue())).toBeCloseTo(0, 0)
  await page.getByRole('button', { name: 'Pause a', exact: true }).click()
  const stopped = await slider.inputValue()
  await page.clock.runFor(1000)
  await expect(slider).toHaveValue(stopped)
  await page.getByRole('button', { name: 'Play a', exact: true }).click()
  await page.clock.runFor(500)
  expect(Number(await slider.inputValue())).toBeLessThan(Number(stopped))
  await page.getByRole('button', { name: 'Pause a', exact: true }).click()
  const resumed = await slider.inputValue()
  await page.reload()
  await expect(slider).toHaveValue(resumed)
  expect((await graph(page)).entries[1]).toMatchObject({ animation: { speed: 2, mode: 'reverse' } })
  await expect(page.getByRole('button', { name: 'Play a', exact: true })).toBeVisible()
})

test('touch dragging reorders entries with the same grip', async ({ page, context }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await blank(page)
  await page.getByRole('button', { name: 'Note', exact: true }).click()
  await page.getByLabel('Graph note 2').fill('Touch reorder')
  const from = (await page.getByRole('button', { name: 'Reorder note 2' }).boundingBox())!
  const to = (await page.locator('.expression-row').first().boundingBox())!
  const session = await context.newCDPSession(page)
  const x = from.x + from.width / 2,
    y = from.y + from.height / 2
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x, y: y - 20 }],
  })
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x, y: to.y + 30 }],
  })
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await expect(page.getByLabel('Graph note 1')).toHaveValue('Touch reorder')
})

test('animation pauses on a failed save and retains the unsaved value for recovery', async ({
  page,
}) => {
  await blank(page)
  await page.getByRole('button', { name: 'Parameter', exact: true }).click()
  await page.evaluate(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key === 'junga.library.v1') throw new DOMException('Full', 'QuotaExceededError')
      original.call(this, key, value)
    }
  })
  await page.getByRole('button', { name: 'Play a', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Retry saving graph' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Pause a', exact: true })).toHaveCount(0)
  const retained = await page.getByLabel('Value of a', { exact: true }).inputValue()
  await page.clock.install()
  await page.clock.runFor(1000)
  await expect(page.getByLabel('Value of a', { exact: true })).toHaveValue(retained)
})

test('color choices show swatches and persist the selected curve color', async ({ page }) => {
  await blank(page)
  await page.getByLabel('Formula 1', { exact: true }).fill('y=sin(x)')
  await page.getByText('Curve appearance', { exact: true }).click()
  const picker = page.getByRole('group', { name: 'Curve color 1', exact: true })
  await expect(picker.locator('.color-swatch')).toHaveCount(6)
  await picker.getByRole('radio', { name: 'Plum', exact: true }).check()
  await expect(page.getByTestId('curve')).toHaveAttribute('stroke', '#8653a1')
  await page.reload()
  await expect(page.getByTestId('curve')).toHaveAttribute('stroke', '#8653a1')
})

test('curve labels drag independently of the viewport and expose text, size, and rotation controls', async ({
  page,
}) => {
  await blank(page)
  await page.getByLabel('Formula 1', { exact: true }).fill('y=x/2')
  const label = page.getByTestId('curve-label')
  const before = await graph(page)
  const box = (await label.boundingBox())!
  const plot = (await page.locator('.plot-svg').boundingBox())!
  await page.mouse.move(box.x + 6, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(plot.x + plot.width * 0.55, plot.y + plot.height * 0.45, { steps: 8 })
  await page.mouse.up()
  const dragged = await graph(page)
  expect(dragged.viewport).toEqual(before.viewport)
  expect(dragged.entries[0]).toHaveProperty('labelStyle.anchor')
  await label.dblclick()
  const manager = page.getByRole('dialog', { name: 'Label manager', exact: true })
  await expect(manager).toBeVisible()
  await manager.getByLabel('Label text', { exact: true }).fill('Slope model')
  await manager.getByLabel('Label size', { exact: true }).press('ArrowRight')
  await manager.getByRole('button', { name: 'Rotate label clockwise', exact: true }).click()
  await manager.getByRole('button', { name: 'Apply label', exact: true }).click()
  await expect(label).toContainText('Slope model')
  await expect(label).toHaveAttribute('transform', /^rotate\(15 /)
  await expect(label).toHaveCSS('font-size', '14px')
  await label.press('Enter')
  await manager.getByLabel('Label orientation', { exact: true }).selectOption('parallel')
  await manager.getByRole('button', { name: 'Apply label', exact: true }).click()
  await expect(label).not.toHaveAttribute('transform', /^rotate\(15 /)
  const expected = await graph(page)
  await page.reload()
  expect(await graph(page)).toEqual(expected)
  await expect(label).toContainText('Slope model')
})

test('expanded new controls and the label manager are accessible on desktop and mobile', async ({
  page,
}) => {
  await blank(page)
  await page.getByLabel('Formula 1', { exact: true }).fill('y=sin(x)')
  await page.getByText('Curve appearance', { exact: true }).click()
  await page.getByRole('button', { name: 'Parameter', exact: true }).click()
  await page.getByRole('button', { name: 'Animation settings for a', exact: true }).click()
  await page.getByTestId('curve-label').press('Enter')
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const result = await new AxeBuilder({ page }).analyze()
    expect(
      result.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
    ).toEqual([])
  }
})
