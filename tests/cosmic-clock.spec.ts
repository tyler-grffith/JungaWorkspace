import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

async function create(page: Page) {
  await page.goto('/')
  // Narrow viewports keep the sidebar, and its shortcuts, behind the navigation button.
  const navigation = page.getByRole('button', { name: 'Open navigation' })
  if (await navigation.isVisible()) await navigation.click()
  await page
    .getByRole('navigation', { name: 'Shortcuts', exact: true })
    .getByRole('link', { name: 'Cosmic Clock', exact: true })
    .click()
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
  // Two full WebGL scene loads plus two accessibility scans can exceed the default
  // test timeout on slower/software-rendered CI runners.
  test.setTimeout(90000)
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

test('working material opens the bundled files it lists, read-only', async ({ page }) => {
  await create(page)
  const section = (name: string) =>
    page.locator('.code-inventory summary').filter({ hasText: name })
  await section('Modules').click()
  await page.getByRole('button', { name: 'src/interactive-scenes/cosmic-clock/math.js' }).click()
  const viewer = page.getByRole('dialog', { name: /math\.js/ })
  await expect(viewer).toBeVisible()
  await expect(
    viewer.getByText('Shared globe coordinates, rotation, and ray picking.'),
  ).toBeVisible()
  // The real file, not a placeholder, and not editable from here.
  await expect(viewer.locator('.cm-content')).toContainText('export')
  await expect(viewer.locator('.cm-content')).toHaveAttribute('contenteditable', 'false')
  await viewer.getByRole('button', { name: 'Close file' }).click()
  await expect(viewer).toBeHidden()

  // A served asset is fetched instead, and large files say what they are not showing.
  await section('Assets & licenses').click()
  await page.getByRole('button', { name: 'public/assets/cosmic-clock/timezones.geojson' }).click()
  const data = page.getByRole('dialog', { name: /timezones\.geojson/ })
  await expect(data.getByRole('status')).toContainText('more is not shown')
  await expect(data.getByRole('link', { name: 'Open in a new tab' })).toHaveAttribute(
    'href',
    /assets\/cosmic-clock\/timezones\.geojson$/,
  )
  await expect(page.locator('.save-indicator')).toContainText('Saved on this device')
})

test('a bundled file can be copied into a code project and edited there', async ({ page }) => {
  await create(page)
  await page.locator('.code-inventory summary').filter({ hasText: 'Modules' }).click()
  await page.getByRole('button', { name: 'src/interactive-scenes/cosmic-clock/math.js' }).click()
  const viewer = page.getByRole('dialog', { name: /math\.js/ })
  // With no code project yet, the only destination is a new one.
  await viewer.getByRole('button', { name: 'Copy as math.js' }).click()
  await expect(viewer.getByRole('status')).toContainText('Copied to Cosmic Clock files')
  await viewer.getByRole('link', { name: 'Open its files' }).click()

  // The copy is a real, editable file in the new project, not a second read-only view.
  await expect(page.getByRole('heading', { name: 'Cosmic Clock files' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'math.js' })).toBeVisible()
  const editor = page.locator('.code-mirror-host .cm-content')
  await expect(editor).toContainText('wrapLongitude')
  await expect(editor).toHaveAttribute('contenteditable', 'true')
  await editor.click()
  await page.keyboard.type('// copied\n')
  await expect(page.getByText('Changes not saved')).toHaveCount(0)
  await page.reload()
  await expect(page.locator('.code-mirror-host .cm-content')).toContainText('// copied')
})
