import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

async function createProject(
  page: Page,
  title: string,
  tool: '3D modeler' | 'Slicer',
  open: string,
) {
  await page.goto('/')
  await page.getByRole('button', { name: 'New project', exact: true }).click()
  await page.getByRole('textbox', { name: 'Project name' }).fill(title)
  await page.getByRole('checkbox', { name: 'Graphing', exact: true }).uncheck()
  await page.getByRole('checkbox', { name: 'Spreadsheet', exact: true }).uncheck()
  await page.getByRole('checkbox', { name: tool, exact: true }).check()
  await page.getByRole('button', { name: 'Create project', exact: true }).click()
  await page.getByRole('heading', { name: title, exact: true }).click()
  await page.getByRole('button', { name: open, exact: true }).click()
}
const saved = (page: Page) => page.evaluate(() => localStorage.getItem('junga.library.v1'))

test('modeler: sketch, extrude, cut, and suppress through the SolidWorks-shaped shell', async ({
  page,
}) => {
  test.setTimeout(90000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await createProject(page, 'Bracket Part', '3D modeler', 'Open modeler')
  await expect(page.getByRole('tree', { name: 'FeatureManager' })).toContainText('Front Plane')

  // Extrude without a sketch is refused with guidance; the Sketch tab draws one.
  await page.getByRole('button', { name: 'Extruded Boss/Base' }).click()
  await expect(
    page.getByRole('status').filter({ hasText: 'Select or create a sketch' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Corner Rectangle' }).click()
  const props = page.getByRole('form', { name: 'Corner Rectangle properties' })
  await props.getByLabel('Width (mm)').fill('80')
  await props.getByLabel('Height (mm)').fill('50')
  await props.getByRole('button', { name: 'OK', exact: true }).click()
  await expect(page.getByRole('tree', { name: 'FeatureManager' })).toContainText('Sketch1')

  await page.getByRole('tab', { name: 'Features' }).click()
  await page.getByRole('button', { name: 'Extruded Boss/Base' }).click()
  const extrude = page.getByRole('form', { name: 'Extruded Boss/Base properties' })
  await extrude.getByLabel('Depth (mm)').fill('25')
  await extrude.getByRole('button', { name: 'OK', exact: true }).click()
  await expect(page.getByRole('tree', { name: 'FeatureManager' })).toContainText('Boss-Extrude1')
  await expect(page.getByRole('img', { name: /1 placeholder solid/ })).toBeVisible()

  // A hole cuts into the stack; suppress hides it from the viewport.
  await page.getByRole('button', { name: 'Hole Wizard' }).click()
  await page
    .getByRole('form', { name: 'Hole Wizard properties' })
    .getByRole('button', { name: 'OK', exact: true })
    .click()
  await expect(page.getByRole('img', { name: /2 placeholder solids/ })).toBeVisible()
  await page.getByRole('menuitem', { name: 'Edit' }).click()
  await page.getByRole('menuitem', { name: 'Suppress / Unsuppress' }).click()
  await expect(page.getByRole('img', { name: /1 placeholder solid/ })).toBeVisible()

  // Mass properties and view changes work; everything is saved.
  await page.getByRole('tab', { name: 'Evaluate' }).click()
  await page.getByRole('button', { name: 'Mass Properties' }).click()
  await expect(page.getByText('Plain Carbon Steel')).toBeVisible()
  await page.getByRole('button', { name: 'Wireframe' }).click()
  const library = JSON.parse((await saved(page))!)
  const model = library.projects[0].modeler
  expect(model.sketches).toHaveLength(1)
  expect(
    model.features.map((f: { type: string; suppressed: boolean }) => [f.type, f.suppressed]),
  ).toEqual([
    ['extrude', false],
    ['hole', true],
  ])
  expect(model.view.style).toBe('wireframe')
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations.map((v) => v.id)).toEqual([])
  expect(errors).toEqual([])
})

test('slicer: add objects, change process settings, slice, preview, and print through the Bambu-shaped shell', async ({
  page,
}) => {
  test.setTimeout(90000)
  await createProject(page, 'Phone Stand', 'Slicer', 'Open slicer')
  await expect(page.getByRole('tab', { name: 'Prepare' })).toHaveAttribute('aria-selected', 'true')

  await page.getByRole('button', { name: 'Add Object' }).click()
  const add = page.getByRole('form', { name: 'Add Object properties' })
  await add.getByLabel('Name').fill('Stand')
  await add.getByLabel('Height (Z) (mm)').fill('60')
  await add.getByRole('button', { name: 'OK', exact: true }).click()
  await expect(page.getByRole('img', { name: 'Build plate with 1 objects' })).toBeVisible()
  await page.getByRole('button', { name: 'Clone' }).click()
  await expect(page.getByRole('img', { name: 'Build plate with 2 objects' })).toBeVisible()

  // Process settings live in the sidebar; slicing produces an estimate and switches to Preview.
  await page.getByRole('tab', { name: 'Settings' }).click()
  await page.getByLabel('Infill (%)').fill('40')
  await page.getByRole('button', { name: 'Slice plate' }).click()
  await expect(page.getByRole('tab', { name: 'Preview' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('.wb-stat', { hasText: 'Layers' })).toBeVisible()
  await expect(page.getByRole('img', { name: /Build plate with 2 objects/ })).toBeVisible()
  await page.getByRole('button', { name: 'Layer Down' }).click()
  await page.getByRole('button', { name: 'Print plate' }).first().click()
  await expect(page.getByRole('tab', { name: 'Device' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText('printing')).toBeVisible()

  const library = JSON.parse((await saved(page))!)
  const project = library.projects[0].slicer
  expect(project.plates[0].objects).toHaveLength(2)
  expect(project.process.infill).toBe(40)
  expect(project.sliced.layers).toBeGreaterThan(0)
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations.map((v) => v.id)).toEqual([])
})
