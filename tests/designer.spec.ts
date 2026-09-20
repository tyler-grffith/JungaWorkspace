import { test, expect, type APIRequestContext } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { savedDesign } from '../src/design/defaults'
import type { DesignSnapshot } from '../src/design/model'

test.describe.configure({ mode: 'serial' })
const endpoint = '/__designer/settings'
const headers = { Origin: 'http://127.0.0.1:4174', 'X-Junga-Designer': '1' }
async function snapshot(request: APIRequestContext): Promise<DesignSnapshot> {
  return (await request.get(endpoint)).json()
}
test.beforeEach(async ({ request }) => {
  const current = await snapshot(request)
  expect(
    (
      await request.post(endpoint, {
        headers,
        data: { settings: savedDesign, revision: current.revision },
      })
    ).ok(),
  ).toBe(true)
})

test('live variants, decimal angles, mode switching, preview recovery and revert', async ({
  page,
}) => {
  await page.goto('/')
  const before = await page.evaluate(() => localStorage.getItem('junga.library.v1'))
  await page.getByRole('button', { name: 'Enter designer mode' }).click()
  await page.getByRole('button', { name: 'Preview label manager', exact: true }).click()
  const manager = page.getByRole('dialog', { name: 'Label manager', exact: true })
  await manager.getByLabel('Label angle', { exact: true }).fill('22.5')
  await manager.getByRole('button', { name: 'Apply label', exact: true }).click()
  await expect(page.getByTestId('curve-label')).toHaveAttribute('transform', /^rotate\(22.5 /)
  await page.getByRole('combobox', { name: 'Angle control', exact: true }).selectOption('dropdown')
  await page.getByRole('button', { name: 'Edit sample label' }).click()
  await expect(manager.getByLabel('Label angle', { exact: true })).toHaveValue('22.5')
  await page.getByRole('combobox', { name: 'Rotation step', exact: true }).selectOption('5')
  await manager.getByRole('button', { name: 'Rotate label clockwise' }).click()
  await expect(manager.getByLabel('Label angle', { exact: true })).toHaveValue('27.5')
  await page.getByRole('combobox', { name: 'Size control', exact: true }).selectOption('number')
  await expect(manager.getByLabel('Label size', { exact: true })).toHaveAttribute('type', 'number')
  await page.getByRole('button', { name: 'Close label preview' }).click()
  await page.getByRole('button', { name: 'Switch to user mode' }).click()
  await expect(page.getByRole('complementary', { name: 'Designer controls' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Enter designer mode' })).toContainText('Preview')
  await page.reload()
  await page.getByRole('button', { name: 'Enter designer mode' }).click()
  await expect(page.getByRole('combobox', { name: 'Angle control', exact: true })).toHaveValue(
    'dropdown',
  )
  await page.getByRole('button', { name: 'Revert preview', exact: true }).click()
  await expect(page.getByRole('combobox', { name: 'Angle control', exact: true })).toHaveValue(
    'number',
  )
  expect(await page.evaluate(() => localStorage.getItem('junga.library.v1'))).toEqual(before)
})

test('save survives a new browser session and stale saves preserve the preview', async ({
  page,
  request,
  browser,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Enter designer mode' }).click()
  await page.getByLabel('Popup title').fill('Label studio')
  await page.getByRole('button', { name: 'Save design', exact: true }).click()
  await expect(
    page.getByRole('status').filter({ hasText: 'Saved to Design/settings.json' }),
  ).toBeVisible()
  expect((await snapshot(request)).settings.labels.title).toBe('Label studio')
  const fresh = await browser.newPage({ baseURL: 'http://127.0.0.1:4174' })
  await fresh.goto('/')
  await fresh.getByRole('button', { name: 'Enter designer mode' }).click()
  await expect(fresh.getByLabel('Popup title')).toHaveValue('Label studio')
  await fresh.close()
  await page.getByLabel('Popup title').fill('My unsaved preview')
  const current = await snapshot(request)
  const different = {
    ...current.settings,
    labels: { ...current.settings.labels, title: 'Changed elsewhere' },
  }
  await request.post(endpoint, {
    headers,
    data: { revision: current.revision, settings: different },
  })
  await page.getByRole('button', { name: 'Save design', exact: true }).click()
  await expect(
    page.getByRole('status').filter({ hasText: 'The saved design changed.' }),
  ).toBeVisible()
  await expect(page.getByLabel('Popup title')).toHaveValue('My unsaved preview')
  expect((await snapshot(request)).settings.labels.title).toBe('Changed elsewhere')
  await page.getByRole('button', { name: 'Discard preview & load saved' }).click()
  await expect(page.getByLabel('Popup title')).toHaveValue('Changed elsewhere')
})

test('save rejects untrusted requests and invalid settings without changing the file', async ({
  request,
}) => {
  const current = await snapshot(request)
  const data = {
    ...current,
    settings: { ...current.settings, theme: { ...current.settings.theme, buttonRadius: 12 } },
  }
  expect((await request.post(endpoint, { data })).status()).toBe(403)
  expect(
    (
      await request.post(endpoint, { headers: { ...headers, Origin: 'https://example.com' }, data })
    ).status(),
  ).toBe(403)
  expect(
    (
      await request.post(endpoint, {
        headers,
        data: { ...data, settings: { ...data.settings, version: 9 } },
      })
    ).status(),
  ).toBe(400)
  expect(
    (await request.post(endpoint, { headers, data: { ...data, revision: 'stale' } })).status(),
  ).toBe(409)
  expect(await snapshot(request)).toEqual(current)
})

test('small-change requests copy feature context and controls fit desktop and mobile', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/')
  await page.getByRole('button', { name: 'Enter designer mode' }).click()
  await page.getByLabel('Refinement note').fill('Put the rotation buttons below the angle field.')
  await page.getByRole('button', { name: 'Copy request for agent' }).click()
  await expect(page.getByRole('button', { name: 'Request copied' })).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    'features/curve label controls.md',
  )
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const result = await new AxeBuilder({ page }).analyze()
    expect(
      result.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
    ).toEqual([])
  }
  await page.getByRole('button', { name: 'Preview label manager', exact: true }).click()
  const result = await new AxeBuilder({ page }).analyze()
  expect(
    result.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
  ).toEqual([])
  const box = await page.getByRole('dialog', { name: 'Label manager', exact: true }).boundingBox()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(390)
})
