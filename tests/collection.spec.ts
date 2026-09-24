import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

async function createCollectionProject(page: Page, title = 'Curations') {
  await page.goto('/')
  await page.getByRole('button', { name: 'New project', exact: true }).click()
  await page.getByRole('textbox', { name: 'Project name' }).fill(title)
  await page.getByRole('checkbox', { name: 'Graphing', exact: true }).uncheck()
  await page.getByRole('checkbox', { name: 'Spreadsheet', exact: true }).uncheck()
  await page.getByRole('checkbox', { name: 'Collection', exact: true }).check()
  await page.getByRole('button', { name: 'Create project', exact: true }).click()
  await page.getByRole('heading', { name: title, exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Collection', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Open collection', exact: true }).click()
  await expect(page.getByRole('navigation', { name: 'Collection tree' })).toBeVisible()
}
/** The library as saved; module edits are written shortly after they are made. */
const saved = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<string | null>((r) =>
        setTimeout(() => r(localStorage.getItem('junga.library.v1')), 600),
      ),
  )

test('curates nested collections with shared items that survive a reload', async ({ page }) => {
  test.setTimeout(90000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await createCollectionProject(page)

  // A Music collection from the preset, under the root.
  await page.getByRole('button', { name: 'New collection here', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Music' }).click()
  await expect(page.getByRole('textbox', { name: 'Collection name' })).toHaveValue('Music')
  const tree = page.getByRole('navigation', { name: 'Collection tree' })
  await expect(tree).toContainText('Music')

  // Quick-add from a YouTube Music link derives a cover and opens the detail panel.
  const add = page.getByRole('textbox', { name: 'Add a song or album' })
  await add.fill('https://music.youtube.com/watch?v=dQw4w9WgXcQ')
  await add.press('Enter')
  await expect(page.getByRole('complementary', { name: /details/ })).toBeVisible()
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill('Never Gonna Give You Up')
  await page.getByRole('textbox', { name: 'Artist' }).fill('Rick Astley')
  await page.getByRole('radio', { name: '4 stars' }).click()
  await expect(page.getByRole('link', { name: 'Open on YouTube Music' })).toBeVisible()
  await expect(page.locator('.col-card img')).toHaveAttribute(
    'src',
    'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
  )
  await expect(page.locator('.col-card')).toContainText('Rick Astley')

  // A second title-only item, then an Albums sub-collection that also holds the first song.
  await add.fill('Whenever You Need Somebody')
  await add.press('Enter')
  await page.getByRole('button', { name: 'Close details' }).click()
  await page.getByRole('button', { name: 'New collection here', exact: true }).click()
  await page.getByRole('menuitem', { name: 'New collection' }).click()
  await page.getByRole('textbox', { name: 'Collection name' }).fill('Albums')
  await expect(tree).toContainText('Albums')
  await tree.getByRole('button', { name: /^Music/ }).click()
  await page.locator('.col-card').first().click()
  await page
    .getByRole('combobox', { name: 'Also file this item in' })
    .selectOption({ label: '📁 Albums' })
  await expect(page.getByRole('complementary', { name: /details/ })).toContainText('Albums')
  await tree.getByRole('button', { name: /^Albums/ }).click()
  await expect(page.locator('.col-card')).toHaveCount(1)
  await expect(page.locator('.col-card')).toContainText('Never Gonna Give You Up')

  // Saved as a shared pool: one item filed in two collections, music holding two.
  const library = JSON.parse((await saved(page))!)
  const doc = library.projects[0].collection
  expect(doc.items).toHaveLength(2)
  const music = doc.collections.find((c: { name: string }) => c.name === 'Music')
  const albums = doc.collections.find((c: { name: string }) => c.name === 'Albums')
  expect(music.itemIds).toHaveLength(2)
  expect(albums.itemIds).toHaveLength(1)
  expect(music.childIds).toContain(albums.id)
  expect(music.itemIds).toContain(albums.itemIds[0])

  await page.reload()
  await expect(page.getByRole('navigation', { name: 'Collection tree' })).toContainText('Albums')
  await expect(page.getByText('Changes not saved')).toHaveCount(0)
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations.map((v) => v.id)).toEqual([])
  expect(errors).toEqual([])
})

test('browses the collections on a read-only output and exports Markdown', async ({ page }) => {
  test.setTimeout(60000)
  await createCollectionProject(page, 'Browse Owner')
  await page.getByRole('button', { name: 'New collection here', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Poems' }).click()
  const add = page.getByRole('textbox', { name: 'Add a poem' })
  await add.fill('The Road Not Taken')
  await add.press('Enter')
  await page.getByRole('textbox', { name: 'Poet' }).fill('Robert Frost')

  await page.getByRole('button', { name: 'Export', exact: true }).click()
  const download = page.waitForEvent('download')
  await page.getByRole('menuitem', { name: 'All collections as Markdown' }).click()
  const file = await download
  const text = await (
    await file.createReadStream()
  )
    .toArray()
    .then((chunks) => Buffer.concat(chunks).toString())
  expect(text).toContain('**The Road Not Taken** · Poet: Robert Frost')

  await page.getByRole('button', { name: 'Back to project', exact: true }).click()
  await page.getByRole('button', { name: 'Add browse output', exact: true }).click()
  await page.getByRole('link', { name: 'Open output', exact: true }).click()
  expect(page.url()).toMatch(/#\/project\/[^/]+\/output\/[^/]+$/)
  await page
    .getByRole('navigation', { name: 'Collection tree' })
    .getByRole('button', { name: /^Poems/ })
    .click()
  await expect(page.locator('.col-card')).toContainText('The Road Not Taken')
  await page.locator('.col-card button').first().click()
  await expect(page.getByRole('complementary', { name: /details/ })).toContainText('Robert Frost')
  await expect(page.getByRole('textbox', { name: 'Add a poem' })).toHaveCount(0)
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations.map((v) => v.id)).toEqual([])
})
