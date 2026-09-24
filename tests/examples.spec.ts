import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import type { Library } from '../src/library'

const stored = (page: Page): Promise<Library> =>
  page.evaluate(() => JSON.parse(localStorage.getItem('junga.library.v1') ?? '{"projects":[]}'))
async function accessible(page: Page) {
  const result = await new AxeBuilder({ page }).analyze()
  expect(
    result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.failureSummary) })),
  ).toEqual([])
}

test('examples are always present, never stored until edited, and reset to the original', async ({
  page,
}) => {
  await page.goto('/')
  const examples = page.getByRole('navigation', { name: 'Library navigation' }).getByRole('link', {
    name: /^Examples/,
  })
  await expect(examples).toContainText('12')
  await expect(page.getByRole('article')).toHaveCount(0)
  await examples.click()
  await expect(page.getByRole('heading', { name: 'Examples', exact: true })).toBeVisible()
  await expect(page.getByRole('article')).toHaveCount(12)
  await accessible(page)
  expect((await stored(page)).projects).toEqual([])
  // Cards of built-ins offer Reset rather than Archive or Move to trash.
  await page.locator('summary[aria-label="Actions for LaPlace Intuition"]').click()
  await expect(page.getByRole('button', { name: 'Move to trash' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Reset to original' })).toBeVisible()
  await page.keyboard.press('Escape')
  // Editing one stores only that one; a reload shows the edit; reset discards it.
  await page.getByRole('link', { name: 'LaPlace Intuition' }).click()
  const notes = page.getByRole('textbox', { name: 'Project notes' })
  await notes.fill('My own note')
  await expect.poll(async () => (await stored(page)).projects.length).toBe(1)
  const after = await stored(page)
  expect(after.projects.map((p) => p.id)).toEqual(['example-laplace'])
  expect(after.projects[0].notes).toBe('My own note')
  await page.reload()
  await expect(page.getByRole('textbox', { name: 'Project notes' })).toHaveValue('My own note')
  await page.goto('/#/examples')
  page.once('dialog', (dialog) => dialog.accept())
  await page.locator('summary[aria-label="Actions for LaPlace Intuition"]').click()
  await page.getByRole('button', { name: 'Reset to original' }).click()
  await expect(page.getByText('LaPlace Intuition reset to the original.')).toBeVisible()
  expect((await stored(page)).projects).toEqual([])
  // A duplicate is an ordinary project of the user's own.
  await page.locator('summary[aria-label="Actions for LaPlace Intuition"]').click()
  await page.getByRole('button', { name: 'Duplicate' }).click()
  await page.goto('/#/all')
  await expect(page.getByRole('article', { name: 'LaPlace Intuition (copy)' })).toBeVisible()
  expect((await stored(page)).projects.map((p) => p.title)).toEqual(['LaPlace Intuition (copy)'])
})

test('shortcuts link straight to their projects from the sidebar', async ({ page }) => {
  await page.goto('/')
  const shortcuts = page.getByRole('navigation', { name: 'Shortcuts', exact: true })
  await expect(shortcuts.getByRole('link')).toHaveText(['Cosmic Clock', 'Octahedron Sections'])
  await shortcuts.getByRole('link', { name: 'Octahedron Sections' }).click()
  await expect(page.getByTestId('linked-point')).toHaveCount(6)
  await expect(shortcuts.getByRole('link', { name: 'Octahedron Sections' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await shortcuts.getByRole('link', { name: 'Cosmic Clock' }).click()
  await expect(page.getByRole('heading', { name: 'Cosmic Clock', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Working material' })).toBeVisible()
  expect((await stored(page)).projects).toEqual([])
})

test('every example opens its editor with its content, loading bundled material once', async ({
  page,
}) => {
  test.setTimeout(120000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const checks: [string, string][] = [
    ['LaPlace Intuition', 'Open calculator'],
    ['XJ-1 Flight Envelope', 'Open calculator'],
    ['Octahedron Sections (Graph)', 'Open calculator'],
    ['Compressible Flow Calculator', 'Open spreadsheet'],
    ['Orbit Sketch', 'Open files'],
    ['PDR Visuals', 'Open visual canvas'],
    ['Pre-Development Plan', 'Open document'],
    ['Workspace Ideas', 'Open collection'],
    ['Mounting Bracket', 'Open modeler'],
    ['Sunset Relief', 'Open painter'],
  ]
  for (const [title, opens] of checks) {
    await page.goto('/#/examples')
    await page.getByRole('link', { name: title, exact: true }).click()
    await expect(page.getByRole('heading', { name: title, exact: true }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: opens }).first()).toBeVisible({ timeout: 20000 })
  }
  // The draw.io board fetched its material on first open and is editable now.
  await page.getByRole('link', { name: 'Examples' }).first().click()
  await page.getByRole('link', { name: 'PDR Visuals', exact: true }).click()
  await page.getByRole('button', { name: 'Open visual canvas' }).click()
  // The editor's own eyebrow ("VISUAL CANVAS · <mode>"), not the project page's heading or
  // button, which are still on screen while the lazy editor chunk loads on a slow runner.
  await expect(page.getByText(/^VISUAL CANVAS · /)).toBeVisible({ timeout: 20000 })
  await expect(page.getByText('EARTH').first()).toBeVisible({ timeout: 20000 })
  expect((await stored(page)).projects).toEqual([])
  expect(errors).toEqual([])
})
