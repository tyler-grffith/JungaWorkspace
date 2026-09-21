import { test, expect, type Page, type Download } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import {
  addProject,
  emptyLibrary,
  saveCollection,
  starterInput,
  type Library,
} from '../src/library'
import { laplaceGraph } from '../src/graph/model'
import { motionExample } from '../src/sheet/model'

function fixture() {
  let library = saveCollection(saveCollection(emptyLibrary(), 'Engineering'), 'Empty collection')
  for (const status of ['active', 'archived', 'trashed'] as const) {
    const added = addProject(
      library,
      {
        ...starterInput,
        title: `${status} model`,
        tools: ['graph', 'sheet'],
        collectionId: library.collections[0].id,
      },
      `${status} notes`,
      laplaceGraph(),
      motionExample(),
    )
    added.project.status = status
    added.project.trashedFrom = status === 'trashed' ? 'archived' : null
    library = added.library
  }
  return library
}
async function seed(page: Page, library: Library | string) {
  await page.goto('/')
  await page.evaluate(
    (raw) => localStorage.setItem('junga.library.v1', raw),
    typeof library === 'string' ? library : JSON.stringify(library),
  )
  await page.reload()
}
async function raw(page: Page) {
  return page.evaluate(() => localStorage.getItem('junga.library.v1'))
}
async function saved(page: Page): Promise<Library> {
  return JSON.parse((await raw(page))!)
}
async function choose(page: Page, library: Library | string) {
  await page.getByLabel('Backup file', { exact: true }).setInputFiles({
    name: 'junga-example.json',
    mimeType: 'application/json',
    buffer: Buffer.from(typeof library === 'string' ? library : JSON.stringify(library)),
  })
}
async function open(page: Page, library: Library | string) {
  await page.getByRole('button', { name: 'Restore library backup', exact: true }).click()
  await choose(page, library)
}
async function downloadText(download: Download) {
  const stream = await download.createReadStream(),
    chunks: Buffer[] = []
  for await (const chunk of stream!) chunks.push(chunk)
  return Buffer.concat(chunks).toString()
}
async function blockWrites(page: Page) {
  await page.evaluate(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key === 'junga.library.v1' && !sessionStorage.getItem('allow-writes'))
        throw new DOMException('Full', 'QuotaExceededError')
      original.call(this, key, value)
    }
  })
}
async function accessible(page: Page) {
  const result = await new AxeBuilder({ page }).analyze()
  expect(
    result.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({ target: n.target, issue: n.failureSummary })),
    })),
  ).toEqual([])
}

test('downloads and restores a whole library in a fresh browser, including both tools and lifecycle', async ({
  page,
  browser,
}) => {
  const original = fixture()
  await seed(page, original)
  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download library backup' }).click()
  const backup = await downloadText(await downloading)
  expect(JSON.parse(backup).exportedAt).toBeTruthy()
  const fresh = await browser.newContext(),
    recovered = await fresh.newPage()
  await recovered.goto('http://127.0.0.1:4173')
  await open(recovered, backup)
  await expect(recovered.getByRole('region', { name: 'Backup preview' })).toContainText(
    '3 projects · 2 collections',
  )
  await expect(recovered.getByRole('radio', { name: 'Add as separate copies' })).toBeChecked()
  await recovered.getByRole('button', { name: 'Restore copies', exact: true }).click()
  const restored = await saved(recovered)
  for (const source of original.projects) {
    const copy = restored.projects.find((p) => p.title === source.title)!
    expect(copy).toMatchObject({
      status: source.status,
      trashedFrom: source.trashedFrom,
      graph: source.graph,
      sheet: source.sheet,
      notes: source.notes,
    })
    expect(copy.id).not.toBe(source.id)
    expect(restored.collections.find((c) => c.id === copy.collectionId)?.name).toBe('Engineering')
  }
  expect(restored.collections).toHaveLength(2)
  const active = restored.projects.find((p) => p.status === 'active')!
  await recovered.goto(`http://127.0.0.1:4173/#/project/${active.id}/sheet`)
  await expect(recovered.getByRole('gridcell', { name: 'B17', exact: true })).toHaveText('30.00')
  await recovered.goto(`http://127.0.0.1:4173/#/project/${active.id}/graph`)
  await expect(recovered.getByTestId('curve')).toHaveCount(5)
  await recovered.reload()
  expect(await saved(recovered)).toEqual(restored)
  await fresh.close()
})

test('default restoration preserves current projects and gives repeated copies unique names', async ({
  page,
}) => {
  const original = fixture()
  await seed(page, original)
  for (const suffix of [' (restored)', ' (restored 2)']) {
    await open(page, original)
    await page.getByRole('button', { name: 'Restore copies', exact: true }).click()
    const lib = await saved(page)
    expect(lib.projects.find((p) => p.title === `active model${suffix}`)).toBeTruthy()
    for (const p of original.projects)
      expect(lib.projects.find((copy) => copy.id === p.id)).toEqual(p)
  }
  expect((await saved(page)).projects).toHaveLength(9)
  expect((await saved(page)).collections).toHaveLength(6)
})

test('replacement requires acknowledgment, offers a current snapshot, and replaces exactly', async ({
  page,
}) => {
  const current = fixture(),
    before = JSON.stringify(current)
  await seed(page, current)
  await open(page, emptyLibrary())
  await expect(page.getByRole('region', { name: 'Backup preview' })).toContainText('no projects')
  await page.getByRole('radio', { name: 'Replace current library' }).check()
  await expect(page.getByRole('button', { name: 'Replace library', exact: true })).toBeDisabled()
  expect(await raw(page)).toBe(before)
  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download current data' }).click()
  expect(await downloadText(await downloading)).toBe(before)
  await page.getByRole('checkbox', { name: /I understand that this replaces/ }).check()
  await page.getByRole('button', { name: 'Replace library', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.reload()
  expect(await saved(page)).toEqual(emptyLibrary())
})

test('invalid files and cancellation never change the library', async ({ page }) => {
  const current = fixture()
  await seed(page, current)
  const before = await raw(page)
  await open(page, 'not JSON')
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('JSON')
  await expect(page.getByRole('button', { name: 'Restore copies', exact: true })).toBeDisabled()
  await choose(page, '{"version":99}')
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('unsupported version')
  const broken = fixture()
  broken.projects[0].sheet!.rows = 0
  await choose(page, broken)
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('damaged')
  await choose(page, ' '.repeat(10 * 1024 * 1024 + 1))
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('too large')
  await choose(page, current)
  await expect(page.getByRole('button', { name: 'Restore copies', exact: true })).toBeEnabled()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Restore library backup', exact: true }),
  ).toBeFocused()
  expect(await raw(page)).toBe(before)
})

test('unreadable storage can be downloaded unchanged and recovered with a known-good backup', async ({
  page,
}) => {
  const original = fixture()
  await seed(page, '{broken data')
  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download stored data' }).click()
  expect(await downloadText(await downloading)).toBe('{broken data')
  await open(page, original)
  await expect(page.getByRole('radio', { name: 'Add as separate copies' })).toBeDisabled()
  expect(await raw(page)).toBe('{broken data')
  await page.getByRole('radio', { name: 'Replace current library' }).check()
  await page.getByRole('checkbox', { name: /I understand that this replaces/ }).check()
  await page.getByRole('button', { name: 'Replace library', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your library', exact: true })).toBeVisible()
  expect(await saved(page)).toEqual(original)
  await page.reload()
  expect(await saved(page)).toEqual(original)
})

test('a failed restore retains the original and preview, and succeeds on retry', async ({
  page,
}) => {
  const current = fixture()
  await seed(page, current)
  await blockWrites(page)
  await open(page, emptyLibrary())
  await page.getByRole('radio', { name: 'Replace current library' }).check()
  await page.getByRole('checkbox', { name: /I understand that this replaces/ }).check()
  await page.getByRole('button', { name: 'Replace library', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('could not be saved')
  expect(await saved(page)).toEqual(current)
  await page.evaluate(() => sessionStorage.setItem('allow-writes', 'true'))
  await page.getByRole('button', { name: 'Replace library', exact: true }).click()
  expect(await saved(page)).toEqual(emptyLibrary())
})

test('another tab invalidates a preview before replacement and refreshing clears confirmation', async ({
  page,
  context,
}) => {
  await seed(page, fixture())
  const other = await context.newPage()
  await other.goto('/')
  await open(page, emptyLibrary())
  await page.getByRole('radio', { name: 'Replace current library' }).check()
  await page.getByRole('checkbox', { name: /I understand that this replaces/ }).check()
  const newer = fixture()
  newer.projects[0].notes = 'New work in another tab'
  await other.evaluate(
    (value) => localStorage.setItem('junga.library.v1', value),
    JSON.stringify(newer),
  )
  await page.getByRole('button', { name: 'Replace library', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
    'changed while this preview',
  )
  expect(await saved(page)).toEqual(newer)
  await page.getByRole('button', { name: 'Refresh preview' }).click()
  await expect(
    page.getByRole('checkbox', { name: /I understand that this replaces/ }),
  ).not.toBeChecked()
  await expect(page.getByRole('button', { name: 'Replace library', exact: true })).toBeDisabled()
  await page.getByRole('radio', { name: 'Add as separate copies' }).check()
  await page.getByRole('button', { name: 'Restore copies', exact: true }).click()
  expect(await saved(page)).toEqual(newer)
})

test('unsaved notes can be downloaded and restoration requires explicit draft disposal', async ({
  page,
}) => {
  const lib = fixture(),
    p = lib.projects.find((p) => p.status === 'active')!
  await seed(page, lib)
  await page.goto(`/#/project/${p.id}`)
  await blockWrites(page)
  await page.getByRole('textbox', { name: 'Project notes' }).fill('My unsaved research')
  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download unsaved work', exact: true }).click()
  const rescued = JSON.parse(await downloadText(await downloading)) as Library
  expect(rescued.projects.find((q) => q.id === p.id)?.notes).toBe('My unsaved research')
  expect((await saved(page)).projects.find((q) => q.id === p.id)?.notes).toBe('active notes')
  await open(page, rescued)
  await expect(page.getByRole('button', { name: 'Restore copies', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Project notes' })).toHaveValue(
    'My unsaved research',
  )
  await open(page, rescued)
  await page.getByRole('checkbox', { name: /I have downloaded or no longer need/ }).check()
  await page.evaluate(() => sessionStorage.setItem('allow-writes', 'true'))
  await page.getByRole('button', { name: 'Restore copies', exact: true }).click()
  const restored = await saved(page)
  expect(restored.projects.find((q) => q.title === 'active model (restored)')?.notes).toBe(
    'My unsaved research',
  )
  await expect(
    page.getByRole('button', { name: 'Saved on this device', exact: true }),
  ).toBeVisible()
})

test('failed graph and spreadsheet saves are included in downloads and remain unsaved on the page', async ({
  page,
}) => {
  const lib = fixture(),
    p = lib.projects.find((p) => p.status === 'active')!
  await seed(page, lib)
  await page.goto(`/#/project/${p.id}/graph`)
  await blockWrites(page)
  await page.getByRole('slider', { name: 'Slider p', exact: true }).press('ArrowRight')
  let downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download unsaved work', exact: true }).click()
  const rescuedGraph = JSON.parse(await downloadText(await downloading)) as Library
  expect(
    rescuedGraph.projects
      .find((q) => q.id === p.id)
      ?.graph?.entries.find((e) => e.kind === 'parameter' && e.name === 'p'),
  ).toMatchObject({ value: 3.9 })
  await expect(page.getByRole('button', { name: 'Changes not saved', exact: true })).toBeVisible()
  page.once('dialog', (d) => d.accept())
  await page.goto(`/#/project/${p.id}/sheet`)
  const cell = page.getByRole('gridcell', { name: 'B2', exact: true })
  await cell.dblclick()
  await page.getByRole('textbox', { name: 'Edit cell B2', exact: true }).fill('99')
  downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download library backup', exact: true }).click()
  const rescuedSheet = JSON.parse(await downloadText(await downloading)) as Library
  expect(rescuedSheet.projects.find((q) => q.id === p.id)?.sheet?.cells.B2.input).toBe('99')
  expect((await saved(page)).projects.find((q) => q.id === p.id)?.sheet?.cells.B2.input).toBe('12')
  await expect(page.getByRole('button', { name: 'Changes not saved', exact: true })).toBeVisible()
  await expect(cell).toHaveText('99.00')
})

test('unavailable browser storage gives recovery actions without claiming success', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new DOMException('Unavailable', 'SecurityError')
    }
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Let’s keep your work safe.' })).toBeVisible()
  await open(page, fixture())
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('cannot be accessed')
  await expect(page.getByRole('button', { name: 'Restore copies', exact: true })).toBeDisabled()
})

test('an unfinished cell edit can be rescued even if another tab makes storage unreadable', async ({
  page,
  context,
}) => {
  const lib = fixture(),
    p = lib.projects.find((p) => p.status === 'active')!
  await seed(page, lib)
  await page.goto(`/#/project/${p.id}/sheet`)
  const other = await context.newPage()
  await other.goto('/')
  await page.getByRole('gridcell', { name: 'B2', exact: true }).dblclick()
  await page.getByRole('textbox', { name: 'Edit cell B2', exact: true }).fill('73')
  await other.evaluate(() => localStorage.setItem('junga.library.v1', '{broken by other tab'))
  await expect(page.getByRole('heading', { name: 'Let’s keep your work safe.' })).toBeVisible()
  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download unsaved work', exact: true }).click()
  const rescued = JSON.parse(await downloadText(await downloading)) as Library
  expect(rescued.projects.find((q) => q.id === p.id)?.sheet?.cells.B2.input).toBe('73')
  expect(await raw(page)).toBe('{broken by other tab')
  await other.evaluate(
    (value) => localStorage.setItem('junga.library.v1', value),
    JSON.stringify(lib),
  )
  await expect(page.getByRole('gridcell', { name: 'B2', exact: true })).toHaveText('73.00')
  await expect(page.getByRole('button', { name: 'Changes not saved', exact: true })).toBeVisible()
})

test('backup dialogs are accessible and fit desktop and narrow screens', async ({
  page,
}, testInfo) => {
  await seed(page, fixture())
  await open(page, fixture())
  await expect(page.getByRole('region', { name: 'Backup preview' })).toBeVisible()
  await accessible(page)
  await page.screenshot({ path: testInfo.outputPath('backup-desktop.png') })
  await page.getByRole('radio', { name: 'Replace current library' }).check()
  await accessible(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await accessible(page)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  expect(await page.getByRole('dialog').evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('backup-mobile.png') })
})
