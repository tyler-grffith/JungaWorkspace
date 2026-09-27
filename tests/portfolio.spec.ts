import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import type { Library } from '../src/library'

/** The library as saved; portfolio edits are written shortly after they are made. */
const saved = (page: Page): Promise<Library> =>
  page.evaluate(
    () =>
      new Promise((resolve) =>
        setTimeout(
          () => resolve(JSON.parse(localStorage.getItem('junga.library.v1') ?? '{"projects":[]}')),
          600,
        ),
      ),
  )
async function accessible(page: Page) {
  const result = await new AxeBuilder({ page }).analyze()
  expect(
    result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.failureSummary) })),
  ).toEqual([])
}
const downloaded = async (page: Page, click: () => Promise<void>) => {
  const download = page.waitForEvent('download')
  await click()
  const file = await download
  const chunks = await (await file.createReadStream()).toArray()
  return { name: file.suggestedFilename(), text: Buffer.concat(chunks).toString() }
}

test('assembles a portfolio from the library, previews it, and exports a web page', async ({
  page,
}) => {
  test.setTimeout(120000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  // A project of our own beside the built-in examples.
  await page.getByRole('button', { name: 'New project', exact: true }).click()
  await page.getByRole('textbox', { name: 'Project name' }).fill('Bridge loads')
  await page.getByRole('textbox', { name: 'Description' }).fill('Load cases for the footbridge.')
  await page.getByRole('checkbox', { name: 'Graphing', exact: true }).uncheck()
  await page.getByRole('button', { name: 'Create project', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Bridge loads', exact: true })).toBeVisible()

  // A portfolio starts from the sidebar.
  await page.getByRole('button', { name: 'New portfolio', exact: true }).click()
  await page.getByRole('textbox', { name: 'Portfolio name' }).fill('Engineering portfolio')
  await page.getByRole('textbox', { name: /^Your name/ }).fill('Tyler')
  await page.getByRole('button', { name: 'Create portfolio', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Engineering portfolio', exact: true }),
  ).toBeVisible()

  // Projects come from the picker: our own and a built-in example, then the picker rests.
  const picker = page.getByRole('complementary', { name: 'Add from the library' })
  await picker.getByRole('button', { name: 'Add Bridge loads', exact: true }).click()
  await picker.getByRole('searchbox', { name: 'Search the library' }).fill('laplace')
  await picker.getByRole('button', { name: 'Add LaPlace Intuition', exact: true }).click()
  await expect(
    picker.getByRole('button', { name: 'LaPlace Intuition is already in the portfolio' }),
  ).toBeDisabled()
  const section = page.getByRole('region', { name: 'Selected work' })
  await expect(section.getByRole('listitem')).toHaveCount(2)
  await expect(section).toContainText('5 curves · 2 sliders')

  // Captions, a role, a reorder, and a tagline; the write follows a pause and survives a reload.
  await section.getByLabel('Caption').first().fill('A footbridge sized for the spring melt.')
  await section.getByLabel('Role or year').first().fill('2026')
  await section.getByRole('button', { name: 'Move LaPlace Intuition up', exact: true }).click()
  await expect(section.getByRole('listitem').first()).toContainText('LaPlace Intuition')
  await page.getByLabel('Tagline').fill('Bridges, graphs, and other things I made.')
  await expect
    .poll(async () => (await saved(page)).portfolios?.[0]?.tagline)
    .toBe('Bridges, graphs, and other things I made.')
  await page.reload()
  await expect(page.getByLabel('Tagline')).toHaveValue('Bridges, graphs, and other things I made.')
  await expect(section.getByRole('listitem').first()).toContainText('LaPlace Intuition')
  await expect(page.getByText('Changes not saved')).toHaveCount(0)
  await accessible(page)

  // The reader's page: hero, both entries, a live graph figure, and the caption.
  await page.getByRole('link', { name: 'Preview', exact: true }).click()
  await expect(
    page.getByRole('heading', { level: 1, name: 'Engineering portfolio', exact: true }),
  ).toBeVisible()
  await expect(page.getByText('Bridges, graphs, and other things I made.')).toBeVisible()
  await expect(page.getByRole('img', { name: 'Graph: LaPlace Intuition' })).toBeVisible()
  await expect(page.getByText('A footbridge sized for the spring melt.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Open project' })).toHaveCount(2)
  await accessible(page)

  // The export is one self-contained file: previews inside, no Junga routes.
  const file = await downloaded(page, () =>
    page.getByRole('button', { name: 'Web page', exact: true }).click(),
  )
  expect(file.name).toBe('engineering-portfolio.html')
  expect(file.text).toContain('<title>Engineering portfolio · Tyler</title>')
  expect(file.text).toContain('A footbridge sized for the spring melt.')
  expect(file.text).toContain('aria-label="Graph: LaPlace Intuition"')
  expect(file.text).not.toContain('#/project/')

  await page.getByRole('link', { name: 'Back to assembling', exact: true }).click()
  await expect(
    page
      .getByRole('navigation', { name: 'Portfolios', exact: true })
      .getByRole('link', { name: 'Engineering portfolio' }),
  ).toHaveAttribute('aria-current', 'page')
  expect(errors).toEqual([])
})

test('adds projects to a portfolio from their menus and deletes the portfolio', async ({
  page,
}) => {
  test.setTimeout(90000)
  await page.goto('/#/examples')
  await page.locator('summary[aria-label="Actions for Compressible Flow Calculator"]').click()
  await page.getByRole('button', { name: 'Add to portfolio…', exact: true }).click()
  // With no portfolio yet, the form makes one.
  await page.getByRole('textbox', { name: 'Portfolio name' }).fill('Coursework')
  await page.getByRole('button', { name: 'Add to portfolio', exact: true }).click()
  await expect(page.getByText('Added Compressible Flow Calculator to Coursework.')).toBeVisible()
  const portfolios = page.getByRole('navigation', { name: 'Portfolios', exact: true })
  await portfolios.getByRole('link', { name: 'Coursework' }).click()
  const section = page.getByRole('region', { name: 'Selected work' })
  await expect(section.getByRole('listitem')).toHaveCount(1)
  await expect(section.getByRole('table', { name: /^Spreadsheet: / })).toBeVisible()

  // From a project overview, featuring one of its outputs.
  await page.goto('/#/examples')
  await page.getByRole('link', { name: 'Orbit Sketch', exact: true }).click()
  await page.getByLabel('Actions for Orbit Sketch', { exact: true }).click()
  await page.getByRole('button', { name: 'Add to portfolio…', exact: true }).click()
  await page.getByRole('combobox', { name: 'Feature' }).selectOption({ label: 'Orbit Sketch' })
  await page.getByRole('button', { name: 'Add to portfolio', exact: true }).click()
  await expect(page.getByText('Added Orbit Sketch to Coursework.')).toBeVisible()
  await portfolios.getByRole('link', { name: 'Coursework' }).click()
  await expect(section.getByRole('listitem')).toHaveCount(2)
  await expect(section).toContainText('featuring Orbit Sketch')
  expect((await saved(page)).portfolios?.[0].sections[0].entries).toHaveLength(2)
  expect((await saved(page)).projects).toEqual([])

  // Deleting the portfolio keeps the projects.
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Delete portfolio', exact: true }).click()
  await expect(
    page.getByText('Portfolio deleted. Its projects are still in your library.'),
  ).toBeVisible()
  await expect(portfolios.getByRole('link')).toHaveCount(0)
  expect((await saved(page)).portfolios ?? []).toEqual([])
  await page.goto('/#/examples')
  await expect(page.getByRole('article', { name: 'Orbit Sketch', exact: true })).toBeVisible()
})
