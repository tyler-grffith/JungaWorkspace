import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

async function create(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Create Cosmic Clock project', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Cosmic Clock', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Working material' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Outputs', exact: true })).toBeVisible()
}
async function open(page: Page) {
  await page.getByRole('link', { name: 'Open scene', exact: true }).click()
  await expect(
    page.getByRole('img', { name: 'Interactive three-dimensional Earth' }),
  ).toHaveAttribute('data-ready', 'true', { timeout: 30000 })
}
const saved = (page: Page) => page.evaluate(() => localStorage.getItem('junga.library.v1'))
async function accessible(page: Page) {
  const results = await new AxeBuilder({ page }).analyze()
  expect(
    results.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.failureSummary) })),
  ).toEqual([])
}

test('template, viewer, temporary interactions, reload, and source ownership', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await create(page)
  await accessible(page)
  const before = await saved(page)
  await open(page)
  expect(page.url()).toMatch(/#\/project\/[^/]+\/output\/[^/]+$/)
  await expect(page.getByText('Made by Cosmic Clock', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Edit details', exact: true })).toHaveCount(0)
  await expect(page.locator('.save-indicator')).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: 'Project notes' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Pause time' }).click()
  await page.getByLabel('Simulation date (UTC)').fill('2026-01-15T12:00')
  await page.getByRole('button', { name: 'Set time', exact: true }).click()
  await page.getByLabel('Find a time zone').fill('Asia/Kathmandu')
  await expect(page.getByLabel('Selected local time')).toHaveText('17:45:00')
  await page.getByRole('button', { name: 'Time-zone boundaries' }).click()
  await expect(page.getByRole('button', { name: 'Time-zone boundaries' })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  const globe = page.getByRole('img', { name: 'Interactive three-dimensional Earth' })
  await globe.focus()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('+')
  await page.getByLabel('Playback speed').selectOption('3600')
  await page.getByRole('button', { name: 'Reset view' }).click()
  await page.getByRole('button', { name: 'Live', exact: true }).click()
  await accessible(page)
  expect(await saved(page)).toBe(before)
  await page.reload()
  await expect(globe).toHaveAttribute('data-ready', 'true', { timeout: 30000 })
  await expect(page.getByRole('button', { name: 'Time-zone boundaries' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.getByRole('button', { name: 'Unpin time zone' })).toHaveCount(0)
  expect(await saved(page)).toBe(before)
  await page.getByRole('link', { name: 'Back to Cosmic Clock', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Working material' })).toBeVisible()
  await expect(page.locator('.cc-globe canvas')).toHaveCount(0)
  expect(await saved(page)).toBe(before)
  expect(errors).toEqual([])
})

test('authored defaults and metadata apply explicitly and stay independent of viewing', async ({
  page,
}) => {
  await create(page)
  await page.getByRole('button', { name: 'Edit output settings' }).click()
  const original = await saved(page)
  await page.getByLabel('Output title', { exact: true }).fill('Solstice Earth')
  await page.getByRole('combobox', { name: 'Time mode', exact: true }).selectOption('simulation')
  await page.getByLabel('Starting date (UTC)').fill('2026-06-21T12:00')
  await page.getByLabel('Start paused', { exact: true }).check()
  await page.getByLabel('Show time-zone boundaries by default').uncheck()
  await page.getByLabel('Latitude (degrees)', { exact: true }).fill('-20')
  expect(await saved(page)).toBe(original)
  await accessible(page)
  await page.getByRole('button', { name: 'Apply output settings' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const authored = await saved(page)
  expect(authored).not.toBe(original)
  await open(page)
  await expect(page.getByRole('heading', { name: 'Solstice Earth', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Resume time' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Time-zone boundaries' })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  await page.getByLabel('Find a time zone').fill('Asia/Kolkata')
  await expect(page.getByLabel('Selected local time')).toHaveText('17:30:00')
  await page.getByRole('button', { name: 'Live', exact: true }).click()
  expect(await saved(page)).toBe(authored)
})

test('narrow viewer remains usable and accessible', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await create(page)
  await open(page)
  await page.getByLabel('Find a time zone').fill('Europe/London')
  await expect(page.getByRole('heading', { name: 'London', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Pause time' }).click()
  await accessible(page)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.getByRole('link', { name: 'Back to Cosmic Clock', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Working material' })).toBeVisible()
})

test('scene navigation releases contexts even when assets are still loading', async ({ page }) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext
    const contexts: WebGLRenderingContext[] = []
    Object.defineProperty(window, '__sceneContexts', { value: contexts })
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      ...args: unknown[]
    ) {
      const context = Reflect.apply(getContext, this, args)
      if ((args[0] === 'webgl' || args[0] === 'webgl2') && context && !contexts.includes(context))
        contexts.push(context)
      return context
    } as typeof getContext
  })
  await create(page)
  for (let visit = 0; visit < 3; visit++) {
    await open(page)
    await expect(page.locator('.cc-globe canvas')).toHaveCount(1)
    await page.getByRole('link', { name: 'Back to Cosmic Clock', exact: true }).click()
    await expect(page.locator('.cc-globe canvas')).toHaveCount(0)
    await expect
      .poll(() =>
        page.evaluate(() =>
          (window as unknown as { __sceneContexts: WebGLRenderingContext[] }).__sceneContexts.every(
            (gl) => gl.isContextLost(),
          ),
        ),
      )
      .toBe(true)
  }
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  let requested!: () => void
  const request = new Promise<void>((resolve) => {
    requested = resolve
  })
  await page.route('**/timezones.geojson', async (route) => {
    requested()
    await gate
    await route.abort().catch(() => {})
  })
  await page.getByRole('link', { name: 'Open scene', exact: true }).click()
  await request
  await page.getByRole('link', { name: 'Back to Cosmic Clock', exact: true }).click()
  release()
  await expect(page.locator('canvas')).toHaveCount(0)
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as unknown as { __sceneContexts: WebGLRenderingContext[] }).__sceneContexts.every(
          (gl) => gl.isContextLost(),
        ),
      ),
    )
    .toBe(true)
})

test('create and edit flow supports code type and unavailable output routes', async ({ page }) => {
  await page.goto('/')
  await page
    .locator('.page-heading')
    .getByRole('button', { name: 'New project', exact: true })
    .click()
  await page.getByLabel('Project name', { exact: true }).fill('My code project')
  await page.getByRole('combobox', { name: 'Project type', exact: true }).selectOption('code')
  await page.getByRole('button', { name: 'Create project', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Working material' })).toBeVisible()
  await page.getByRole('button', { name: 'Add Earth Clock output' }).click()
  await expect(page.getByRole('article', { name: 'Earth Clock' })).toBeVisible()
  const source = page.url()
  await page.goto(`${source}/output/missing`)
  await expect(page.getByRole('heading', { name: 'Output unavailable' })).toBeVisible()
  await expect(page.locator('.save-indicator')).toHaveCount(0)
})
