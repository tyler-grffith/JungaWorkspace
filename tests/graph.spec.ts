import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import type { GraphDocument } from '../src/graph/model'
import type { Library } from '../src/library'

async function sample(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Use this example' }).click()
  await page.getByRole('button', { name: 'Open calculator' }).click()
  await expect(page.getByTestId('curve')).toHaveCount(5)
}
async function blank(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'New project', exact: true }).click()
  await page.getByRole('textbox', { name: 'Project name', exact: true }).fill('New graph')
  await page.getByRole('button', { name: 'Create project', exact: true }).click()
  await page.getByRole('button', { name: 'Open calculator' }).click()
}
async function saved(page: Page): Promise<Library> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('junga.library.v1')!))
}
async function graph(page: Page): Promise<GraphDocument> {
  return (await saved(page)).projects[0].graph!
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

test('LaPlace curves react to sliders and preserve expressions, notes, labels, and view on reload', async ({
  page,
}) => {
  await sample(page)
  const wave = page.getByTestId('curve').nth(2)
  const initialPath = await wave.getAttribute('d')
  await page.getByRole('slider', { name: 'Slider p', exact: true }).press('ArrowRight')
  await expect(page.getByRole('spinbutton', { name: 'Value of p', exact: true })).toHaveValue('3.9')
  await expect(wave).not.toHaveAttribute('d', initialPath!)
  const a = page.getByRole('spinbutton', { name: 'Value of a', exact: true })
  await a.fill('0.4')
  await a.press('Enter')
  await page.getByLabel('Formula 5', { exact: true }).fill('f_p(t) = cos(p t)')
  await page.getByLabel('Graph note 8').fill('A damped response to revisit.')
  const row = page.locator('.expression-row').nth(2)
  await row.getByText('Curve appearance', { exact: true }).click()
  await page.getByLabel('Curve label 3', { exact: true }).fill('Damped sine')
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Grid', exact: true }).uncheck()
  const expected = await graph(page)
  await page.reload()
  await expect(page.getByRole('spinbutton', { name: 'Value of p', exact: true })).toHaveValue('3.9')
  await expect(page.getByRole('spinbutton', { name: 'Value of a', exact: true })).toHaveValue('0.4')
  await expect(page.getByLabel('Formula 5', { exact: true })).toHaveValue('f_p(t) = cos(p t)')
  await expect(page.getByLabel('Graph note 8')).toHaveValue('A damped response to revisit.')
  await expect(page.locator('.curve-label').filter({ hasText: 'Damped sine' })).toBeVisible()
  await expect(page.getByRole('checkbox', { name: 'Grid', exact: true })).not.toBeChecked()
  expect(await graph(page)).toEqual(expected)
  await expect(page.locator('.expression-error')).toHaveCount(0)
})

test('new expressions report errors, resolve forward dependencies, hide, remove, undo, and redo', async ({
  page,
}) => {
  await blank(page)
  await page.getByLabel('Formula 1', { exact: true }).fill('y = f(x) + a')
  await expect(page.getByLabel('Formula 1', { exact: true })).toHaveAttribute(
    'aria-invalid',
    'true',
  )
  await page.getByRole('button', { name: 'Parameter', exact: true }).click()
  await page.getByRole('button', { name: 'Formulas', exact: true }).click()
  await page.getByLabel('Formula 3', { exact: true }).fill('f(t) = sin(t) {t>0}')
  await expect(page.getByTestId('curve')).toHaveCount(2)
  await expect(page.getByLabel('Formula 1', { exact: true })).toHaveAttribute(
    'aria-invalid',
    'false',
  )
  await page.getByRole('button', { name: 'Hide formula 3', exact: true }).click()
  await expect(page.getByTestId('curve')).toHaveCount(1)
  await page.getByRole('button', { name: 'Remove formula 3', exact: true }).click()
  await expect(page.getByTestId('curve')).toHaveCount(0)
  await page.getByRole('button', { name: 'Undo graph change' }).click()
  await expect(page.getByTestId('curve')).toHaveCount(1)
  await page.getByRole('button', { name: 'Redo graph change' }).click()
  await expect(page.getByTestId('curve')).toHaveCount(0)
  await page.getByRole('button', { name: 'Undo graph change' }).click()
  await page.getByLabel('Formula 1', { exact: true }).fill('y = window.alert(1)')
  await expect(page.getByLabel('Formula 1', { exact: true })).toHaveAttribute(
    'aria-invalid',
    'true',
  )
  await page.getByLabel('Formula 1', { exact: true }).fill('k = 1e10')
  await expect(page.locator('.constant-result')).toContainText('1.00e+10')
  await page.getByRole('button', { name: 'Load LaPlace example' }).click()
  await expect(page.getByText('Replace this graph with the LaPlace example?')).toBeVisible()
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.getByLabel('Formula 1', { exact: true })).toHaveValue('k = 1e10')
})

test('parameter constants, range validation, bounds, and keyboard or pointer navigation work', async ({
  page,
}) => {
  await blank(page)
  await page.getByLabel('Formula 1', { exact: true }).fill('y = a*x')
  await page.getByRole('button', { name: 'Parameter', exact: true }).click()
  await page.getByText('Parameter settings', { exact: true }).click()
  await page.getByLabel('Minimum of a').fill('2')
  await page.getByLabel('Maximum of a').fill('1')
  await page.getByRole('button', { name: 'Apply settings' }).click()
  await expect(
    page.getByText('Use finite limits, minimum ≤ maximum, and a positive step.'),
  ).toBeVisible()
  await page.getByLabel('Maximum of a').fill('2')
  await page.getByRole('button', { name: 'Apply settings' }).click()
  await expect(page.getByRole('slider', { name: 'Slider a' })).toHaveCount(0)
  await page.getByLabel('Value of a', { exact: true }).fill('3')
  await page.getByLabel('Value of a', { exact: true }).press('Enter')
  expect((await graph(page)).entries[1]).toMatchObject({ mode: 'constant', value: 3 })
  await page.getByRole('button', { name: 'Set graph bounds' }).click()
  await page.getByLabel('x minimum', { exact: true }).fill('20')
  await page.getByRole('button', { name: 'Apply bounds' }).click()
  await expect(page.getByRole('form', { name: 'Graph bounds' }).getByRole('alert')).toBeVisible()
  await page.getByLabel('x minimum', { exact: true }).fill('-2')
  await page.getByLabel('x maximum', { exact: true }).fill('2')
  await page.getByRole('button', { name: 'Apply bounds' }).click()
  const svg = page.getByRole('group', { name: /^Function graph/ })
  await svg.press('ArrowRight')
  expect((await graph(page)).viewport.xMin).toBeCloseTo(-1.6)
  const rect = await svg.boundingBox()
  await page.mouse.move(rect!.x + 80, rect!.y + 150)
  await page.mouse.down()
  await page.mouse.move(rect!.x + 160, rect!.y + 150, { steps: 4 })
  await page.mouse.up()
  expect((await graph(page)).viewport.xMin).toBeLessThan(-1.6)
  const before = (await graph(page)).viewport
  await page.mouse.wheel(0, -200)
  await expect
    .poll(async () => (await graph(page)).viewport.xMax - (await graph(page)).viewport.xMin)
    .toBeLessThan(before.xMax - before.xMin)
  await page.getByRole('button', { name: 'Reset graph view' }).click()
  expect((await graph(page)).viewport).toEqual({ xMin: -10, xMax: 10, yMin: -6, yMax: 6 })
  await page.reload()
  await expect(page.getByLabel('Value of a', { exact: true })).toHaveValue('3')
})

test('duplication and trash preserve independent graphs', async ({ page }) => {
  await sample(page)
  const original = await graph(page)
  await page.getByRole('button', { name: 'Project overview' }).click()
  await page.getByLabel('Actions for LaPlace Intuition', { exact: true }).click()
  await page.getByRole('button', { name: 'Duplicate', exact: true }).click()
  await page.getByRole('button', { name: 'Back to library' }).click()
  await page.getByRole('link', { name: 'LaPlace Intuition (copy)', exact: true }).click()
  await page.getByRole('button', { name: 'Open calculator' }).click()
  await page.getByLabel('Formula 3', { exact: true }).fill('f(t) = t^2')
  expect((await saved(page)).projects.find((p) => p.title === 'LaPlace Intuition')!.graph).toEqual(
    original,
  )
  await page.getByRole('button', { name: 'Project overview' }).click()
  await page.getByLabel('Actions for LaPlace Intuition (copy)', { exact: true }).click()
  await page.getByRole('button', { name: 'Move to trash', exact: true }).click()
  await page.getByRole('button', { name: 'Open calculator' }).click()
  await expect(page.getByLabel('Formula 3', { exact: true })).toBeDisabled()
  await expect(page.getByLabel('Formula 3', { exact: true })).toHaveValue('f(t) = t^2')
  await page.getByRole('button', { name: 'Project overview' }).click()
  await page.getByRole('button', { name: 'Restore project', exact: true }).click()
  await page.getByRole('button', { name: 'Open calculator' }).click()
  await expect(page.getByLabel('Formula 3', { exact: true })).toBeEnabled()
  await expect(page.getByLabel('Formula 3', { exact: true })).toHaveValue('f(t) = t^2')
})

test('failed saves retain the graph draft and guard navigation until retry succeeds', async ({
  page,
}) => {
  await blank(page)
  await page.evaluate(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key === 'junga.library.v1' && !sessionStorage.getItem('allow-writes'))
        throw new DOMException('Full', 'QuotaExceededError')
      original.call(this, key, value)
    }
  })
  await page.getByLabel('Formula 1', { exact: true }).fill('y = sin(x)')
  await expect(page.getByRole('button', { name: 'Changes not saved' })).toBeVisible()
  await expect(page.getByTestId('curve')).toHaveCount(1)
  page.once('dialog', (dialog) => dialog.dismiss())
  await page.getByRole('button', { name: 'Project overview' }).click()
  await expect(page.getByLabel('Formula 1', { exact: true })).toHaveValue('y = sin(x)')
  await page.evaluate(() => sessionStorage.setItem('allow-writes', 'true'))
  await page.getByRole('button', { name: 'Retry saving graph' }).click()
  await page.reload()
  await expect(page.getByLabel('Formula 1', { exact: true })).toHaveValue('y = sin(x)')
})

test('graph changes appear in another tab', async ({ page, context }) => {
  await sample(page)
  const other = await context.newPage()
  await other.goto(page.url())
  await page.getByLabel('Formula 5', { exact: true }).fill('f_p(t) = cos(p t)')
  await expect(other.getByLabel('Formula 5', { exact: true })).toHaveValue('f_p(t) = cos(p t)')
  await expect(other.getByTestId('curve')).toHaveCount(5)
})

test('calculator and expanded controls are accessible at desktop and narrow widths', async ({
  page,
}) => {
  await sample(page)
  await accessible(page)
  await page.locator('.parameter-settings').first().locator('summary').click()
  await page.getByRole('button', { name: 'Set graph bounds' }).click()
  await page.getByRole('button', { name: 'How to write expressions' }).click()
  await accessible(page)
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.getByRole('button', { name: 'Close expression help' }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('slider', { name: 'Slider p', exact: true }).press('ArrowRight')
  await expect(page.getByLabel('Value of p', { exact: true })).toHaveValue('3.9')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await accessible(page)
})
