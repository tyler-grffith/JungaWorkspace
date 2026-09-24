import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

async function createDocumentProject(page: Page, title = 'Field Notes') {
  await page.goto('/')
  await page.getByRole('button', { name: 'New project', exact: true }).click()
  await page.getByRole('textbox', { name: 'Project name' }).fill(title)
  await page.getByRole('checkbox', { name: 'Graphing', exact: true }).uncheck()
  await page.getByRole('checkbox', { name: 'Spreadsheet', exact: true }).uncheck()
  await page.getByRole('checkbox', { name: 'Document', exact: true }).check()
  await page.getByRole('button', { name: 'Create project', exact: true }).click()
  await page.getByRole('heading', { name: title, exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Document', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Open document', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Document text' })).toBeVisible()
}
const saved = (page: Page) => page.evaluate(() => localStorage.getItem('junga.library.v1'))

test('writes, formats, and structures text that survives a reload', async ({ page }) => {
  test.setTimeout(90000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await createDocumentProject(page)
  const editor = page.getByRole('textbox', { name: 'Document text' })
  await editor.click()

  // A Markdown-style shortcut makes a title; Enter after a heading returns to normal text.
  await page.keyboard.type('# Field Notes')
  await expect(editor.locator('h1')).toHaveText('Field Notes')
  await page.keyboard.press('Enter')
  await page.keyboard.type('Water rises ')
  await page.getByRole('button', { name: 'Bold (Ctrl+B)' }).click()
  await page.keyboard.type('quickly')
  await page.getByRole('button', { name: 'Bold (Ctrl+B)' }).click()
  await page.keyboard.type(' at dawn.')
  await expect(editor.locator('p strong, p b')).toHaveText('quickly')

  // A bulleted list from the shortcut, with Tab nesting the second item.
  await page.keyboard.press('Enter')
  await page.keyboard.type('- first')
  await page.keyboard.press('Enter')
  await page.keyboard.type('second')
  await page.keyboard.press('Tab')
  await expect(editor.locator('ul ul li, ul li ul li')).toHaveText('second')

  // The heading appears in the outline and the counts follow the text.
  await expect(page.getByRole('navigation', { name: 'Document outline' })).toContainText(
    'Field Notes',
  )
  await expect(page.getByText(/\d+ words/)).toBeVisible()

  // Saved as blocks: title, paragraph with a bold run, two list items with indent.
  const library = JSON.parse((await saved(page))!)
  const blocks = library.projects[0].document.blocks
  expect(blocks[0].type).toBe('title')
  expect(blocks[1].type).toBe('paragraph')
  expect(
    blocks[1].runs.some(
      (r: { marks: string[]; text: string }) => r.marks.includes('bold') && r.text === 'quickly',
    ),
  ).toBe(true)
  expect(blocks.filter((b: { type: string }) => b.type === 'bullet')).toHaveLength(2)
  expect(blocks.find((b: { indent: number }) => b.indent === 1)).toBeTruthy()

  await page.reload()
  await expect(editor.locator('h1')).toHaveText('Field Notes')
  await expect(editor.locator('p strong')).toHaveText('quickly')
  await expect(page.getByText('Changes not saved')).toHaveCount(0)

  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations.map((v) => v.id)).toEqual([])
  expect(errors).toEqual([])
})

test('links, pasted Markdown import, exports, and the reading output', async ({ page }) => {
  test.setTimeout(90000)
  await createDocumentProject(page, 'Reading Owner')
  const editor = page.getByRole('textbox', { name: 'Document text' })
  await editor.click()
  await page.keyboard.type('Visit the site now')
  // Select the word "site" and turn it into a link.
  await page.keyboard.press('Home')
  await page.keyboard.press('ArrowRight', { delay: 5 })
  for (let i = 0; i < 9; i++) await page.keyboard.press('ArrowRight')
  await page.keyboard.down('Shift')
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight')
  await page.keyboard.up('Shift')
  await page.getByRole('button', { name: 'Insert link (Ctrl+K)' }).click()
  await page.getByLabel('Link address').fill('https://example.com/junga')
  await page.getByRole('button', { name: 'Apply link', exact: true }).click()
  await expect(editor.locator('a')).toHaveAttribute('href', 'https://example.com/junga')
  const stored = JSON.parse((await saved(page))!)
  expect(JSON.stringify(stored.projects[0].document.blocks)).toContain('https://example.com/junga')

  // Markdown export carries the link.
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  const download = page.waitForEvent('download')
  await page.getByRole('menuitem', { name: 'Markdown (.md)' }).click()
  const file = await download
  expect(file.suggestedFilename()).toBe('reading-owner.md')
  const text = await (
    await file.createReadStream()
  )
    .toArray()
    .then((chunks) => Buffer.concat(chunks).toString())
  expect(text).toContain('[site](https://example.com/junga)')

  // A reading output on the output route shows the text and no editing controls.
  await page.getByRole('button', { name: 'Back to project', exact: true }).click()
  await page.getByRole('button', { name: 'Add reading output', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Reading Owner', exact: true }).nth(1),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Open output', exact: true }).click()
  expect(page.url()).toMatch(/#\/project\/[^/]+\/output\/[^/]+$/)
  await expect(page.getByText('Visit the site now')).toBeVisible()
  await expect(page.getByRole('toolbar', { name: 'Formatting' })).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: 'Document text' })).toHaveCount(0)
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations.map((v) => v.id)).toEqual([])
  await page.getByRole('link', { name: 'Back to Reading Owner', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Reading Owner' })).toBeVisible()
})
