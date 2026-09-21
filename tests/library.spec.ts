import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

async function createProject(page: Page, title: string) {
  await page
    .locator('.page-heading')
    .getByRole('button', { name: 'New project', exact: true })
    .click()
  await page.getByRole('textbox', { name: 'Project name', exact: true }).fill(title)
  await page
    .getByRole('textbox', { name: 'Description' })
    .fill('A practical project for exploring ideas.')
  await page.getByRole('button', { name: 'Create project', exact: true }).click()
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
}
async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).analyze()
  expect(
    results.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({ target: n.target, issue: n.failureSummary })),
    })),
  ).toEqual([])
}
async function library(page: Page) {
  await page
    .getByRole('navigation', { name: 'Library navigation' })
    .getByRole('link', { name: /All projects/ })
    .click()
}
async function menu(page: Page, title: string, action: string) {
  await page.getByLabel(`Actions for ${title}`, { exact: true }).click()
  await page.getByRole('button', { name: action, exact: true }).click()
}

test('create, organize, edit, reload, and reopen a project', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'New collection', exact: true }).click()
  await page.getByRole('textbox', { name: 'Collection name' }).fill('Engineering')
  await page.getByRole('button', { name: 'Create collection', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Engineering', exact: true })).toBeVisible()
  await createProject(page, 'Prototype model')
  await page
    .getByRole('textbox', { name: 'Project notes' })
    .fill('Mass = 12 kg. Revisit assumptions next session.')
  await page.getByRole('button', { name: 'Edit details', exact: true }).click()
  await page.getByRole('textbox', { name: 'Project name', exact: true }).fill('Updated model')
  await page
    .getByRole('textbox', { name: 'Reference link' })
    .fill('https://www.desmos.com/calculator/2awcmk9fzy')
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Updated model', exact: true })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Project notes' })).toHaveValue(
    'Mass = 12 kg. Revisit assumptions next session.',
  )
  await expect(page.getByRole('link', { name: /desmos.com/ })).toHaveAttribute(
    'href',
    'https://www.desmos.com/calculator/2awcmk9fzy',
  )
  await library(page)
  await expect(page.getByRole('article', { name: 'Updated model' })).toContainText('Engineering')
  await page.getByRole('link', { name: 'Updated model', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Project notes' })).toHaveValue(
    'Mass = 12 kg. Revisit assumptions next session.',
  )
})

test('favorite, duplicate, archive, trash, and restore without losing notes', async ({ page }) => {
  await page.goto('/')
  await createProject(page, 'Lifecycle project')
  await page.getByRole('textbox', { name: 'Project notes' }).fill('Keep these notes.')
  await page.getByRole('button', { name: 'Favorite Lifecycle project', exact: true }).click()
  await library(page)
  await page
    .getByRole('navigation', { name: 'Library navigation' })
    .getByRole('link', { name: /Favorites/ })
    .click()
  await expect(page.getByRole('article', { name: 'Lifecycle project', exact: true })).toBeVisible()
  await menu(page, 'Lifecycle project', 'Duplicate')
  await library(page)
  await expect(
    page.getByRole('article', { name: 'Lifecycle project (copy)', exact: true }),
  ).toBeVisible()
  await menu(page, 'Lifecycle project', 'Archive')
  await expect(page.getByRole('article', { name: 'Lifecycle project', exact: true })).toHaveCount(0)
  await page
    .getByRole('navigation', { name: 'Library navigation' })
    .getByRole('link', { name: /Archive/ })
    .click()
  await menu(page, 'Lifecycle project', 'Move to trash')
  await page
    .getByRole('navigation', { name: 'Library navigation' })
    .getByRole('link', { name: /Trash/ })
    .click()
  await menu(page, 'Lifecycle project', 'Restore project')
  await expect(page.getByRole('article', { name: 'Lifecycle project', exact: true })).toHaveCount(0)
  await page
    .getByRole('navigation', { name: 'Library navigation' })
    .getByRole('link', { name: /Archive/ })
    .click()
  await page.getByRole('link', { name: 'Lifecycle project', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Project notes' })).toHaveValue(
    'Keep these notes.',
  )
  await page.getByRole('button', { name: 'Move to library', exact: true }).click()
  await expect(page.getByText('This project is archived.', { exact: false })).toHaveCount(0)
})

test('search, tool filters, list view, and collection removal preserve projects', async ({
  page,
}) => {
  await page.goto('/')
  await createProject(page, 'Spreadsheet only')
  await page.getByRole('button', { name: 'Edit details', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Graphing', exact: true }).uncheck()
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await library(page)
  await page.getByLabel('Filter by tool').selectOption('graph')
  await expect(page.getByRole('heading', { name: 'No matching projects' })).toBeVisible()
  await page.getByRole('button', { name: 'Clear filters' }).click()
  await page.getByRole('button', { name: 'List view' }).click()
  await page.getByRole('searchbox', { name: 'Search projects' }).fill('spreadsheet')
  await expect(page.getByRole('article', { name: 'Spreadsheet only' })).toBeVisible()
  await page.getByRole('button', { name: 'New collection', exact: true }).click()
  await page.getByRole('textbox', { name: 'Collection name' }).fill('Temporary')
  await page.getByRole('button', { name: 'Create collection', exact: true }).click()
  await createProject(page, 'Survivor')
  await page
    .getByRole('navigation', { name: 'Collections', exact: true })
    .getByRole('link', { name: 'Temporary' })
    .click()
  await page.getByRole('button', { name: 'Remove collection Temporary' }).click()
  await page.getByRole('button', { name: 'Remove collection', exact: true }).click()
  await expect(page.getByRole('article', { name: 'Survivor' })).toContainText('Unfiled')
  await expect(page.getByRole('article')).toHaveCount(2)
})

test('starter stores a working example and exports a complete backup', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Use this example' }).click()
  await expect(page.getByRole('heading', { name: 'LaPlace Intuition' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Project notes' })).toHaveValue(
    /f\(t\) = e\^\(-t\)/,
  )
  await expect(page.getByRole('button', { name: 'Open calculator' })).toBeVisible()
  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download library backup' }).click()
  const download = await downloading
  expect(download.suggestedFilename()).toMatch(/^junga-library-.*\.json$/)
  const stream = await download.createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream!) chunks.push(chunk)
  const project = JSON.parse(Buffer.concat(chunks).toString()).projects[0]
  expect(project.title).toBe('LaPlace Intuition')
  expect(project.graph.entries).toHaveLength(8)
})

test('another tab receives saved changes', async ({ page, context }) => {
  await page.goto('/')
  const other = await context.newPage()
  await other.goto('/')
  await createProject(other, 'Created in another tab')
  await expect(page.getByRole('article', { name: 'Created in another tab' })).toBeVisible()
  await page.getByRole('button', { name: 'Favorite Created in another tab', exact: true }).click()
  await expect(
    other.getByRole('button', { name: 'Unfavorite Created in another tab', exact: true }),
  ).toBeVisible()
})

test('invalid saved data is never silently replaced', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('junga.library.v1', '{broken data'))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Let’s keep your work safe.' })).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('untouched')
  expect(await page.evaluate(() => localStorage.getItem('junga.library.v1'))).toBe('{broken data')
})

test('storage failure preserves form input and does not claim a saved project', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('Full', 'QuotaExceededError')
    }
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'New project', exact: true }).click()
  await page.getByRole('textbox', { name: 'Project name', exact: true }).fill('Unsaved idea')
  await page.getByRole('button', { name: 'Create project', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('could not be saved')
  await expect(page.getByRole('textbox', { name: 'Project name', exact: true })).toHaveValue(
    'Unsaved idea',
  )
  expect(await page.evaluate(() => localStorage.getItem('junga.library.v1'))).toBeNull()
})

test('keyboard dialog behavior and accessibility on library, dialog, and project', async ({
  page,
}) => {
  await page.goto('/')
  await expectAccessible(page)
  await page.getByRole('button', { name: 'New project', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Project name', exact: true })).toBeFocused()
  await expectAccessible(page)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'New project', exact: true })).toBeFocused()
  await createProject(page, 'Accessible project')
  await expectAccessible(page)
})

test('failed note saves retain a draft and protect it when navigating away', async ({ page }) => {
  await page.goto('/')
  await createProject(page, 'Draft protection')
  await page.evaluate(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key === 'junga.library.v1' && !sessionStorage.getItem('allow-writes'))
        throw new DOMException('Full', 'QuotaExceededError')
      original.call(this, key, value)
    }
  })
  await page.getByRole('textbox', { name: 'Project notes' }).fill('Do not lose this unsaved draft.')
  await expect(page.getByRole('textbox', { name: 'Project notes' })).toHaveValue(
    'Do not lose this unsaved draft.',
  )
  await expect(page.getByRole('button', { name: 'Changes not saved' })).toBeVisible()
  page.once('dialog', (dialog) => dialog.dismiss())
  await library(page)
  await expect(page.getByRole('heading', { name: 'Draft protection', exact: true })).toBeVisible()
  await page.evaluate(() => sessionStorage.setItem('allow-writes', 'true'))
  await page.getByRole('button', { name: 'Retry saving notes' }).click()
  await page.reload()
  await expect(page.getByRole('textbox', { name: 'Project notes' })).toHaveValue(
    'Do not lose this unsaved draft.',
  )
})

test('small screen navigation and project lifecycle fit the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await createProject(page, 'Mobile project')
  await page.getByRole('textbox', { name: 'Project notes' }).fill('Saved on a narrow screen.')
  await page.getByRole('button', { name: 'Open navigation' }).click()
  await library(page)
  await expect(page.getByRole('article', { name: 'Mobile project' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  await expectAccessible(page)
})
