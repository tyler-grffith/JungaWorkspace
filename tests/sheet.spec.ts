import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import type { Library } from '../src/library'

async function create(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'New project', exact: true }).click()
  await page.getByLabel('Project name', { exact: true }).fill('Sheet model')
  await page.getByRole('button', { name: 'Create project', exact: true }).click()
  await page.getByRole('button', { name: 'Open spreadsheet', exact: true }).click()
  await expect(page.getByRole('grid', { name: 'Spreadsheet cells' })).toBeVisible()
}
const cell = (page: Page, ref: string) => page.getByRole('gridcell', { name: ref, exact: true })
async function enter(page: Page, ref: string, value: string) {
  await cell(page, ref).dblclick()
  await page.getByRole('textbox', { name: `Edit cell ${ref}`, exact: true }).fill(value)
  await page.getByRole('textbox', { name: `Edit cell ${ref}`, exact: true }).press('Enter')
}
async function select(page: Page, ref: string) {
  const input = page.getByRole('textbox', { name: 'Selected cell or range' })
  await input.fill(ref)
  await input.press('Enter')
}
async function saved(page: Page): Promise<Library> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('junga.library.v1')!))
}
async function paste(page: Page, data: Record<string, string>) {
  await page.getByRole('grid', { name: 'Spreadsheet cells' }).evaluate((element, values) => {
    const clipboardData = new DataTransfer()
    for (const [type, value] of Object.entries(values)) clipboardData.setData(type, value)
    element.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }),
    )
  }, data)
}
async function accessible(page: Page) {
  const result = await new AxeBuilder({ page }).analyze()
  expect(
    result.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.slice(0, 8).map((n) => ({ target: n.target, issue: n.failureSummary })),
    })),
  ).toEqual([])
}

test('edits cells with keyboard and formula bar, recalculates, cancels, and saves on reload', async ({
  page,
}) => {
  await create(page)
  await cell(page, 'A1').click()
  await page.keyboard.type('12')
  await page.getByRole('textbox', { name: 'Edit cell A1' }).press('Tab')
  await expect(cell(page, 'B1')).toBeFocused()
  await page.keyboard.type('=A1*2')
  await page.getByRole('textbox', { name: 'Edit cell B1' }).press('Enter')
  await expect(cell(page, 'B1')).toHaveText('24')
  await expect(cell(page, 'B2')).toBeFocused()
  await cell(page, 'A1').click()
  const bar = page.getByRole('textbox', { name: 'Cell value or formula' })
  await bar.fill('15')
  await bar.press('Enter')
  await expect(cell(page, 'B1')).toHaveText('30')
  await cell(page, 'B1').press('F2')
  await page.getByRole('textbox', { name: 'Edit cell B1' }).fill('=A1*99')
  await page.getByRole('textbox', { name: 'Edit cell B1' }).press('Escape')
  await expect(cell(page, 'B1')).toHaveText('30')
  await page.reload()
  await expect(cell(page, 'A1')).toHaveText('15')
  await expect(cell(page, 'B1')).toHaveText('30')
  expect((await saved(page)).projects[0].sheet!.cells.B1.input).toBe('=A1*2')
})

test('pastes rectangles, copies relative formulas, fills, formats, clears, and undoes', async ({
  page,
}) => {
  await create(page)
  await select(page, 'A1')
  await paste(page, { 'text/plain': '2\t3\n4\t=A1*B1' })
  await expect(cell(page, 'B2')).toHaveText('6')
  await select(page, 'B2')
  const copied = await page.getByRole('grid', { name: 'Spreadsheet cells' }).evaluate((element) => {
    const clipboardData = new DataTransfer()
    element.dispatchEvent(
      new ClipboardEvent('copy', { clipboardData, bubbles: true, cancelable: true }),
    )
    return {
      'text/plain': clipboardData.getData('text/plain'),
      'application/x-junga-cells': clipboardData.getData('application/x-junga-cells'),
    }
  })
  expect(copied['text/plain']).toBe('6')
  await select(page, 'B3')
  await paste(page, copied)
  await expect(cell(page, 'B3')).toHaveText('24')
  expect((await saved(page)).projects[0].sheet!.cells.B3.input).toBe('=A2*B2')
  await select(page, 'B2:B4')
  await page.getByRole('button', { name: 'Fill down', exact: true }).click()
  expect((await saved(page)).projects[0].sheet!.cells.B4.input).toBe('=A3*B3')
  await page.getByRole('button', { name: 'Bold cells' }).click()
  await page.getByLabel('Number format', { exact: true }).selectOption('number')
  await page.getByLabel('Cell fill', { exact: true }).selectOption('#e7f0e5')
  await expect(cell(page, 'B3')).toHaveText('24.00')
  await expect(cell(page, 'B3')).toHaveCSS('font-weight', '700')
  await page.getByRole('button', { name: 'Clear selected cells' }).click()
  await expect(cell(page, 'B2')).toHaveText('')
  await page.getByRole('button', { name: 'Undo spreadsheet change' }).click()
  await expect(cell(page, 'B2')).toHaveText('6.00')
  await page.getByRole('button', { name: 'Redo spreadsheet change' }).click()
  await expect(cell(page, 'B2')).toHaveText('')
  await page.getByRole('button', { name: 'Undo spreadsheet change' }).click()
  await page.reload()
  await expect(cell(page, 'B3')).toHaveText('24.00')
  await expect(cell(page, 'B3')).toHaveCSS('font-weight', '700')
})

test('shows clear formula errors and repairs dependent results after edits', async ({ page }) => {
  await create(page)
  await paste(page, { 'text/plain': '=B1\t=A1\n=1/0\t=SQRT(-1)\n=SUM(A1:A2)\t=SUM(2,3)' })
  await expect(cell(page, 'A1')).toHaveText('#CYCLE!')
  await expect(cell(page, 'B2')).toHaveText('#NUM!')
  await expect(cell(page, 'A2')).toHaveText('#DIV/0!')
  await expect(cell(page, 'B3')).toHaveText('5')
  await cell(page, 'A1').click()
  await expect(page.locator('.sheet-cell-error')).toContainText('Circular reference')
  await enter(page, 'B1', '7')
  await expect(cell(page, 'A1')).toHaveText('7')
  await enter(page, 'A2', '3')
  await expect(cell(page, 'A3')).toHaveText('10')
  await expect(cell(page, 'A1')).toHaveAttribute('aria-invalid', 'false')
})

test('motion example, column resizing, growth, and formula visibility work', async ({ page }) => {
  await create(page)
  await page.getByRole('button', { name: 'Load motion example' }).click()
  await expect(cell(page, 'B17')).toHaveText('30.00')
  await enter(page, 'B3', '4')
  await expect(cell(page, 'C15')).toHaveText('270.00')
  await page.getByRole('checkbox', { name: 'Formulas', exact: true }).check()
  await expect(cell(page, 'C6')).toHaveText('=$B$2*A6+0.5*$B$3*A6^2')
  await page.getByRole('checkbox', { name: 'Formulas', exact: true }).uncheck()
  await page.getByRole('button', { name: 'Resize column B', exact: true }).press('ArrowRight')
  expect((await saved(page)).projects[0].sheet!.widths.B).toBe(160)
  await page.getByRole('button', { name: '25 rows', exact: true }).click()
  await page.getByRole('button', { name: 'Column', exact: true }).click()
  const sheet = (await saved(page)).projects[0].sheet!
  expect([sheet.rows, sheet.columns]).toEqual([75, 13])
  await page.getByRole('button', { name: 'Load motion example' }).click()
  await expect(page.getByRole('region', { name: 'Replace spreadsheet confirmation' })).toBeVisible()
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.reload()
  await expect(cell(page, 'C15')).toHaveText('270.00')
  expect((await saved(page)).projects[0].sheet!.widths.B).toBe(160)
})

test('spreadsheet and graph coexist, duplicate independently, and survive trash and backup', async ({
  page,
}) => {
  await create(page)
  await enter(page, 'A1', 'Original')
  await page.getByRole('button', { name: 'Project overview' }).click()
  await page.getByRole('button', { name: 'Open calculator' }).click()
  await page.getByLabel('Formula 1', { exact: true }).fill('y=x^2')
  await page.getByRole('button', { name: 'Project overview' }).click()
  await page.getByLabel('Actions for Sheet model', { exact: true }).click()
  await page.getByRole('button', { name: 'Duplicate', exact: true }).click()
  await page.getByRole('button', { name: 'Back to library' }).click()
  await page.getByRole('link', { name: 'Sheet model (copy)', exact: true }).click()
  await page.getByRole('button', { name: 'Open spreadsheet' }).click()
  await enter(page, 'A1', 'Only the copy')
  expect(
    (await saved(page)).projects.find((p) => p.title === 'Sheet model')!.sheet!.cells.A1.input,
  ).toBe('Original')
  await page.getByRole('button', { name: 'Project overview' }).click()
  await page.getByLabel('Actions for Sheet model (copy)', { exact: true }).click()
  await page.getByRole('button', { name: 'Move to trash', exact: true }).click()
  await page.getByRole('button', { name: 'Open spreadsheet' }).click()
  await expect(page.getByRole('textbox', { name: 'Cell value or formula' })).toBeDisabled()
  await expect(cell(page, 'A1')).toHaveText('Only the copy')
  await cell(page, 'A1').press('Delete')
  await expect(cell(page, 'A1')).toHaveText('Only the copy')
  await page.getByRole('button', { name: 'Project overview' }).click()
  await page.getByRole('button', { name: 'Restore project', exact: true }).click()
  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download library backup' }).click()
  const stream = await (await downloading).createReadStream(),
    chunks: Buffer[] = []
  for await (const chunk of stream!) chunks.push(chunk)
  const backup = JSON.parse(Buffer.concat(chunks).toString()) as Library
  const copy = backup.projects.find((p) => p.title === 'Sheet model (copy)')!
  expect(copy.sheet!.cells.A1.input).toBe('Only the copy')
  expect(copy.graph!.entries[0]).toMatchObject({ formula: 'y=x^2' })
})

test('failed cell saves retain drafts and guard navigation until retry succeeds', async ({
  page,
}) => {
  await create(page)
  await page.evaluate(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key === 'junga.library.v1' && !sessionStorage.getItem('allow-writes'))
        throw new DOMException('Full', 'QuotaExceededError')
      original.call(this, key, value)
    }
  })
  await enter(page, 'A1', '=2+3')
  await expect(cell(page, 'A1')).toHaveText('5')
  await expect(page.getByRole('button', { name: 'Changes not saved' })).toBeVisible()
  page.once('dialog', (dialog) => dialog.dismiss())
  await page.getByRole('button', { name: 'Project overview' }).click()
  await expect(cell(page, 'A1')).toHaveText('5')
  await page.evaluate(() => sessionStorage.setItem('allow-writes', 'true'))
  await page.getByRole('button', { name: 'Retry saving spreadsheet' }).click()
  await page.reload()
  await expect(cell(page, 'A1')).toHaveText('5')
})

test('sequential changes sync across tabs without dropping another tool', async ({
  page,
  context,
}) => {
  await create(page)
  const other = await context.newPage()
  await other.goto(page.url())
  await enter(page, 'A1', '3')
  await expect(cell(other, 'A1')).toHaveText('3')
  await enter(other, 'B1', '=A1*4')
  await expect(cell(page, 'B1')).toHaveText('12')
})

test('an unfinished cell edit is protected during browser navigation and can be canceled', async ({
  page,
}) => {
  await create(page)
  await enter(page, 'A1', 'Saved value')
  await cell(page, 'A1').dblclick()
  await page.getByRole('textbox', { name: 'Edit cell A1' }).fill('Still typing')
  await expect(page.getByRole('button', { name: 'Editing cell', exact: true })).toBeVisible()
  page.once('dialog', (dialog) => dialog.dismiss())
  await page.goBack()
  await expect(page.getByRole('textbox', { name: 'Edit cell A1' })).toHaveValue('Still typing')
  await page.getByRole('textbox', { name: 'Edit cell A1' }).press('Escape')
  await expect(cell(page, 'A1')).toHaveText('Saved value')
  await page.reload()
  await expect(cell(page, 'A1')).toHaveText('Saved value')
})

test('range keyboard selection and desktop/mobile accessibility', async ({ page }) => {
  await create(page)
  await page.getByRole('button', { name: 'Load motion example' }).click()
  await select(page, 'B6')
  await cell(page, 'B6').press('Shift+ArrowDown')
  await expect(cell(page, 'B7')).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('.selection-stats')).toContainText('26')
  await accessible(page)
  await page.getByRole('button', { name: 'Using the spreadsheet' }).click()
  await accessible(page)
  await page.getByRole('button', { name: 'Close spreadsheet help' }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await enter(page, 'B3', '3')
  await expect(cell(page, 'B15')).toHaveText('39.00')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await accessible(page)
})
