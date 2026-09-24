import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

async function createProject(page: Page, title: string, tools: string[], open: string) {
  await page.goto('/')
  await page.getByRole('button', { name: 'New project', exact: true }).click()
  await page.getByRole('textbox', { name: 'Project name' }).fill(title)
  await page.getByRole('checkbox', { name: 'Graphing', exact: true }).uncheck()
  await page.getByRole('checkbox', { name: 'Spreadsheet', exact: true }).uncheck()
  for (const tool of tools) await page.getByRole('checkbox', { name: tool, exact: true }).check()
  await page.getByRole('button', { name: 'Create project', exact: true }).click()
  await page.getByRole('heading', { name: title, exact: true }).click()
  await page.getByRole('button', { name: open, exact: true }).click()
}
/** The library as saved; module edits are written shortly after they are made. */
const saved = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<string | null>((r) =>
        setTimeout(() => r(localStorage.getItem('junga.library.v1')), 600),
      ),
  )
/** A 64 × 32 PNG: black on the left, white on the right, a red band across the middle. */
async function testImage(page: Page): Promise<Buffer> {
  const dataUrl = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 32
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, 32, 32)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(32, 0, 32, 32)
    ctx.fillStyle = '#c8102e'
    ctx.fillRect(0, 12, 64, 8)
    return canvas.toDataURL('image/png')
  })
  return Buffer.from(dataUrl.split(',')[1], 'base64')
}

test('paints an image into layers, edits the filament stack, exports, and sends the relief to the slicer', async ({
  page,
}) => {
  test.setTimeout(90000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await createProject(page, 'Sunset', ['PLA Painter', 'Slicer'], 'Open painter')
  await expect(page.getByText('Add a picture to paint it.')).toBeVisible()

  // Import an image; the printed preview, grid, and swap plan follow.
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Choose image…' }).click()
  await (
    await chooser
  ).setFiles({
    name: 'bands.png',
    mimeType: 'image/png',
    buffer: await testImage(page),
  })
  await expect(page.getByRole('img', { name: 'Printed preview' })).toBeVisible()
  await expect(page.getByText('200 × 100 pixels', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Filament 1 name')).toHaveValue('Black')
  const sheet = page.getByRole('complementary', { name: 'Print sheet' })
  await expect(sheet).toContainText('Start with Black')
  await expect(sheet).toContainText('change to White')
  await expect(sheet).toContainText(/about [\d.]+ g/)

  // Changing the recipe re-paints; the heightmap and 3D relief views render.
  await page.getByLabel('Total layers').fill('40')
  await page.getByRole('button', { name: 'Space evenly' }).click()
  await expect(sheet).toContainText('Layer 17 at 1.28 mm')
  await page.getByRole('tab', { name: 'Heightmap' }).click()
  await expect(page.getByRole('img', { name: 'Heightmap' })).toBeVisible()
  await page.getByRole('tab', { name: '3D relief' }).click()
  await expect(page.getByRole('img', { name: /Painted relief, [\d,]+ triangles/ })).toBeVisible()
  await page.getByRole('tab', { name: 'Printed' }).click()

  // The stack edits: add a filament, remove one, rename.
  await page.getByLabel('Add a filament').selectOption({ label: 'Blue · TD 2.4 mm' })
  await expect(sheet).toContainText('change to Blue')
  await page.getByRole('button', { name: 'Remove Yellow' }).click()
  await expect(sheet).not.toContainText('Yellow')
  await page.getByLabel('Filament 1 name').fill('Matte black')
  await expect(sheet).toContainText('Start with Matte black')

  // Exports produce files; everything is saved with the image inside the document.
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export print sheet' }).click()
  expect((await download).suggestedFilename()).toBe('sunset-print-sheet.txt')
  const stl = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export STL' }).click()
  expect((await stl).suggestedFilename()).toBe('sunset.stl')
  const library = JSON.parse((await saved(page))!)
  const painting = library.projects[0].painter
  expect(painting.image.width).toBe(64)
  expect(painting.maxLayers).toBe(40)
  expect(painting.stack.map((f: { name: string }) => f.name)).toEqual([
    'Matte black',
    'Red',
    'White',
    'Blue',
  ])
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations.map((v) => v.id)).toEqual([])

  // Send to Slicer lands the relief on the plate with the swap plan in the notes.
  await page.getByRole('button', { name: 'Send to Slicer' }).click()
  await expect(page.getByRole('img', { name: 'Build plate with 1 objects' })).toBeVisible()
  const slicer = JSON.parse((await saved(page))!).projects[0].slicer
  expect(slicer.plates[0].objects[0].name).toBe('Sunset')
  expect(slicer.plates[0].objects[0].mesh.length % 9).toBe(0)
  expect(slicer.notes).toContain('Start with Matte black')
  expect(errors).toEqual([])
})

test('the print sheet output shows the painting read-only', async ({ page }) => {
  test.setTimeout(60000)
  await createProject(page, 'Poster', ['PLA Painter'], 'Open painter')
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Choose image…' }).click()
  await (
    await chooser
  ).setFiles({
    name: 'bands.png',
    mimeType: 'image/png',
    buffer: await testImage(page),
  })
  await expect(page.getByRole('img', { name: 'Printed preview' })).toBeVisible()
  await page.getByRole('button', { name: 'Back to project' }).click()
  await page.getByRole('button', { name: 'Add print sheet output' }).click()
  await page.getByRole('link', { name: 'Open output' }).click()
  await expect(page.getByRole('heading', { name: 'Poster print sheet', level: 1 })).toBeVisible()
  await expect(page.getByRole('img', { name: 'Printed preview' })).toBeVisible()
  await expect(page.getByRole('complementary', { name: 'Print sheet' })).toContainText(
    'Start with Black',
  )
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations.map((v) => v.id)).toEqual([])
})
