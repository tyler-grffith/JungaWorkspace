import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

async function accessible(page: Page) {
  const result = await new AxeBuilder({ page }).analyze()
  expect(
    result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.failureSummary) })),
  ).toEqual([])
}
async function createProject(page: Page, title: string) {
  await page.goto('/#/all')
  await page
    .locator('.page-heading')
    .getByRole('button', { name: 'New project', exact: true })
    .click()
  await page.getByRole('textbox', { name: 'Project name', exact: true }).fill(title)
  await page.getByRole('button', { name: 'Create project', exact: true }).click()
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
}

test('imports files as projects, exports one, and imports it back as a copy', async ({ page }) => {
  test.setTimeout(90000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await page.getByRole('button', { name: 'Import', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog
    .getByLabel('Files to import')
    .setInputFiles([
      'tests/fixtures/loads.csv',
      'tests/fixtures/notes.md',
      'tests/fixtures/simple.drawio',
    ])
  await expect(dialog.getByText(/filled cells/)).toBeVisible()
  await expect(dialog.getByText(/words · /)).toBeVisible()
  await expect(dialog.getByText(/elements on/)).toBeVisible()
  await accessible(page)
  await dialog.getByRole('button', { name: /^Import 3 projects$/ }).click()
  await expect(page.getByText('Imported 3 projects into your library.')).toBeVisible()
  for (const title of ['loads', 'notes', 'simple'])
    await expect(page.getByRole('article', { name: title, exact: true })).toBeVisible()

  // The spreadsheet holds the CSV, quoted commas included.
  await page.getByRole('link', { name: 'loads', exact: true }).click()
  await page.getByRole('button', { name: 'Open spreadsheet', exact: true }).click()
  await expect(page.getByText('Snow, drift')).toBeVisible()

  // A project exports as one file and comes back as an independent copy.
  await page.goto('/#/all')
  await page.getByLabel('Actions for notes', { exact: true }).click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export project…', exact: true }).click()
  const file = await download
  expect(file.suggestedFilename()).toBe('notes.junga-project.json')
  await page.getByRole('button', { name: 'Import', exact: true }).click()
  const exported = Buffer.concat(await (await file.createReadStream()).toArray())
  await page.getByRole('dialog').getByLabel('Files to import').setInputFiles({
    name: file.suggestedFilename(),
    mimeType: 'application/json',
    buffer: exported,
  })
  await expect(page.getByRole('dialog').getByText(/Junga project · /)).toBeVisible()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^Import 1 project$/ })
    .click()
  // One imported project opens at once; the library then lists the copy beside the original.
  await expect(page.getByRole('heading', { name: 'notes (restored)', exact: true })).toBeVisible()
  await page.goto('/#/all')
  await expect(page.getByRole('article', { name: 'notes (restored)', exact: true })).toBeVisible()
  await expect(page.getByRole('article', { name: 'notes', exact: true })).toBeVisible()
  expect(errors).toEqual([])
})

test('relates two projects and shows the link from both sides', async ({ page }) => {
  await createProject(page, 'Alpha study')
  await createProject(page, 'Beta build')
  await page.getByRole('button', { name: 'Link a project', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('searchbox', { name: 'Search projects to link' }).fill('alpha')
  await dialog.getByRole('button', { name: 'Link Alpha study', exact: true }).click()
  await expect(dialog.getByRole('button', { name: 'Alpha study is linked' })).toBeDisabled()
  await dialog.getByRole('button', { name: 'Done', exact: true }).click()
  await expect(
    page.getByRole('list', { name: 'Related projects' }).getByRole('link', { name: 'Alpha study' }),
  ).toBeVisible()
  await accessible(page)
  await page
    .getByRole('list', { name: 'Related projects' })
    .getByRole('link', { name: 'Alpha study' })
    .click()
  await expect(page.getByRole('heading', { name: 'Alpha study', exact: true })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Linked from' })).toContainText('Beta build')
  await page.getByLabel('Actions for Alpha study', { exact: true }).click()
  await page.getByRole('button', { name: 'Copy link', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: /copied|Copy this link/ })).toBeVisible()
})

test('opens a tool from its card chip, sorts by recently opened, and deletes from the trash', async ({
  page,
}) => {
  await createProject(page, 'Chip study')
  await page.goto('/#/all')
  await page.getByRole('button', { name: 'Open spreadsheet · Chip study', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Chip study', exact: true })).toBeVisible()
  await expect(page.getByText('SPREADSHEET', { exact: true })).toBeVisible()
  await page.goto('/#/all')
  await page.getByRole('combobox', { name: 'Sort projects' }).selectOption('opened')
  await expect(page.getByRole('article').first()).toContainText('Chip study')
  // Search finds a project by the name of a tool it holds.
  await page.getByRole('searchbox', { name: 'Search projects' }).fill('spreadsheet')
  await expect(page.getByRole('article', { name: 'Chip study', exact: true })).toBeVisible()
  await page.getByRole('searchbox', { name: 'Search projects' }).fill('')
  // Trash, then empty the trash; the project is gone for good.
  await page.getByLabel('Actions for Chip study', { exact: true }).click()
  await page.getByRole('button', { name: 'Move to trash', exact: true }).click()
  await page.goto('/#/trash')
  await expect(page.getByRole('article', { name: 'Chip study', exact: true })).toBeVisible()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Empty trash', exact: true }).click()
  await expect(page.getByText('The trash is empty.', { exact: true })).toBeVisible()
  await expect(page.getByRole('article')).toHaveCount(0)
  await page.goto('/#/all')
  await expect(page.getByRole('article')).toHaveCount(0)
  await accessible(page)
})
