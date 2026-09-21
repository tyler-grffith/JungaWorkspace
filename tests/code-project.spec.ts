import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

async function createCodeProject(page: Page, title = 'Sandbox Sketch') {
  await page.goto('/')
  await page.getByRole('button', { name: 'New project', exact: true }).click()
  await page.getByRole('textbox', { name: 'Project name' }).fill(title)
  await page.getByRole('checkbox', { name: 'Graphing', exact: true }).uncheck()
  await page.getByRole('checkbox', { name: 'Spreadsheet', exact: true }).uncheck()
  await page.getByRole('checkbox', { name: 'Code', exact: true }).check()
  await page.getByRole('button', { name: 'Create project', exact: true }).click()
  await page.getByRole('heading', { name: title, exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Code project' })).toBeVisible()
}
const saved = (page: Page) => page.evaluate(() => localStorage.getItem('junga.library.v1'))

test('writes files, runs them in a sandbox, and keeps them through a reload', async ({ page }) => {
  test.setTimeout(60000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await createCodeProject(page)
  await page.getByRole('button', { name: 'Open files', exact: true }).click()

  // The starter document is runnable, with folders derived from file paths.
  await expect(page.getByRole('button', { name: 'index.html' })).toBeVisible()
  await expect(page.getByText('lib', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'format.js' })).toBeVisible()

  await page.getByRole('button', { name: 'Run', exact: true }).click()
  const frame = page.frameLocator('iframe.code-run-frame')
  await expect(frame.getByRole('heading', { name: 'Hello from your code project' })).toBeVisible()
  // Proves the import map resolved main.js and its own ./lib/format.js dependency.
  await frame.getByRole('button', { name: 'Click me' }).click()
  await expect(frame.getByText('Clicked 1 time', { exact: true })).toBeVisible()

  // A new file is stored and opens in the editor.
  await page.getByRole('button', { name: 'New file', exact: true }).click()
  await page.getByRole('textbox', { name: 'New file path' }).fill('lib/extra.js')
  await page.getByRole('button', { name: 'Create file', exact: true }).click()
  await expect(page.getByRole('button', { name: 'extra.js' })).toBeVisible()
  await expect(page.getByText('Changes not saved')).toHaveCount(0)

  await page.reload()
  await expect(page.getByRole('button', { name: 'extra.js' })).toBeVisible()
  expect(await saved(page)).toContain('lib/extra.js')
  expect(errors).toEqual([])
})

test('refuses paths and file kinds it cannot store', async ({ page }) => {
  await createCodeProject(page, 'Path Rules')
  await page.getByRole('button', { name: 'Open files', exact: true }).click()
  await page.getByRole('button', { name: 'New file', exact: true }).click()
  const path = page.getByRole('textbox', { name: 'New file path' })
  await path.fill('../escape.js')
  await page.getByRole('button', { name: 'Create file', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Use a name like main.js')
  await path.fill('photo.png')
  await page.getByRole('button', { name: 'Create file', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('text files')
  await path.fill('index.html')
  await page.getByRole('button', { name: 'Create file', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('already exists')
})

test('opens an output on its own route without exposing authoring controls', async ({ page }) => {
  test.setTimeout(60000)
  await createCodeProject(page, 'Output Owner')
  await page.getByRole('button', { name: 'Add output', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Output Owner output' })).toBeVisible()
  await expect(page.getByText('Runs index.html')).toBeVisible()

  await page.getByRole('link', { name: 'Open output', exact: true }).click()
  expect(page.url()).toMatch(/#\/project\/[^/]+\/output\/[^/]+$/)
  await expect(page.getByText('Made by Output Owner', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Edit details', exact: true })).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: 'Project notes' })).toHaveCount(0)
  const frame = page.frameLocator('iframe.code-run-frame')
  await expect(frame.getByRole('heading', { name: 'Hello from your code project' })).toBeVisible()

  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations.map((v) => v.id)).toEqual([])

  await page.getByRole('link', { name: 'Back to Output Owner', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Output Owner', exact: true })).toBeVisible()
})

test('runs the project in an opaque origin that cannot reach the saved library', async ({
  page,
}) => {
  test.setTimeout(60000)
  await createCodeProject(page, 'Sandbox Check')
  await page.getByRole('button', { name: 'Open files', exact: true }).click()
  await page.getByRole('button', { name: 'Run', exact: true }).click()
  const iframe = page.locator('iframe.code-run-frame')
  await expect(iframe).toBeVisible()
  const sandbox = await iframe.getAttribute('sandbox')
  expect(sandbox).toContain('allow-scripts')
  expect(sandbox).not.toContain('allow-same-origin')
  // An opaque origin has no access to this app's storage, so reading it throws.
  const reachable = await page
    .frameLocator('iframe.code-run-frame')
    .locator('body')
    .evaluate(() => {
      try {
        return localStorage.getItem('junga.library.v1') !== null
      } catch {
        return false
      }
    })
  expect(reachable).toBe(false)
})
