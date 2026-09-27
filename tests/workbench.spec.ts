import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

type WorkbenchTool = '3D modeler' | 'Slicer'
async function createProject(page: Page, title: string, tools: WorkbenchTool[], open: string) {
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
async function sketchAndExtrude(page: Page, width: string, height: string, depth: string) {
  await page.getByRole('tab', { name: 'Sketch' }).click()
  await page.getByRole('button', { name: 'Corner Rectangle' }).click()
  const props = page.getByRole('form', { name: 'Corner Rectangle properties' })
  await props.getByLabel('Width (mm)').fill(width)
  await props.getByLabel('Height (mm)').fill(height)
  await props.getByRole('button', { name: 'OK', exact: true }).click()
  await page.getByRole('tab', { name: 'Features' }).click()
  await page.getByRole('button', { name: 'Extruded Boss/Base' }).click()
  const extrude = page.getByRole('form', { name: 'Extruded Boss/Base properties' })
  await extrude.getByLabel('Depth (mm)').fill(depth)
  await extrude.getByRole('button', { name: 'OK', exact: true }).click()
}

test('modeler: sketch, extrude, cut, and suppress through the SolidWorks-shaped shell', async ({
  page,
}) => {
  test.setTimeout(90000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await createProject(page, 'Bracket Part', ['3D modeler'], 'Open modeler')
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
  await expect(page.getByRole('img', { name: 'Model with 1 solid' })).toBeVisible()

  // A hole cuts into the stack; suppress hides it from the viewport.
  await page.getByRole('button', { name: 'Hole Wizard' }).click()
  await page
    .getByRole('form', { name: 'Hole Wizard properties' })
    .getByRole('button', { name: 'OK', exact: true })
    .click()
  await expect(page.getByRole('img', { name: 'Model with 2 solids' })).toBeVisible()
  await page.getByRole('menuitem', { name: 'Edit' }).click()
  await page.getByRole('menuitem', { name: 'Suppress / Unsuppress' }).click()
  await expect(page.getByRole('img', { name: 'Model with 1 solid' })).toBeVisible()

  // The viewport orbits by dragging and turns to standard views.
  const viewport = page.getByRole('img', { name: 'Model with 1 solid' })
  const box = (await viewport.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 20, { steps: 5 })
  await page.mouse.up()
  await page.getByRole('button', { name: 'Front', exact: true }).click()

  // Mass properties and view changes work; everything is saved.
  await page.getByRole('tab', { name: 'Evaluate' }).click()
  await page.getByRole('button', { name: 'Mass Properties' }).click()
  await expect(page.getByText('Plain Carbon Steel')).toBeVisible()
  await expect(page.getByText(/^\d[\d,]* mm³$/)).toBeVisible()
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
  expect(model.view.orientation).toBe('front')
  expect(model.sketches[0].offset).toBe(0)
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations.map((v) => v.id)).toEqual([])
  expect(errors).toEqual([])
})

test('slicer: add objects, change process settings, slice, preview, and print through the Bambu-shaped shell', async ({
  page,
}) => {
  test.setTimeout(90000)
  await createProject(page, 'Phone Stand', ['Slicer'], 'Open slicer')
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
  await expect(page.getByText(/layer \d+\/\d+/)).toBeVisible()
  await expect(page.getByRole('list', { name: 'Line types' })).toContainText('Outer wall')
  const download = page.waitForEvent('download')
  await page.getByRole('menuitem', { name: 'File' }).click()
  await page.getByRole('menuitem', { name: 'Export Plate as G-code…' }).click()
  expect((await download).suggestedFilename()).toBe('phone-stand-plate-1.gcode')
  await page.getByRole('button', { name: 'Print plate' }).first().click()
  await expect(page.getByRole('tab', { name: 'Device' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText('printing')).toBeVisible()

  const library = JSON.parse((await saved(page))!)
  const project = library.projects[0].slicer
  expect(project.plates[0].objects).toHaveLength(2)
  expect(project.process.infill).toBe(40)
  expect(project.sliced.layers).toBe(Math.ceil((60 - 0.2) / 0.2) + 1)
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations.map((v) => v.id)).toEqual([])
})

test('a modeled part goes to the slicer, STL files import, and objects move by dragging', async ({
  page,
}) => {
  test.setTimeout(90000)
  await createProject(page, 'Clip', ['3D modeler', 'Slicer'], 'Open modeler')
  await sketchAndExtrude(page, '40', '20', '40')
  await page.getByRole('tab', { name: 'Evaluate' }).click()
  await page.getByRole('button', { name: 'Send to Slicer' }).click()

  // The slicer opens with the part on its plate, sized from the mesh.
  await expect(page.getByRole('heading', { name: 'Clip', level: 1 })).toBeVisible()
  await expect(page.getByRole('img', { name: 'Build plate with 1 objects' })).toBeVisible()
  await page.getByRole('tab', { name: 'Objects' }).click()
  await expect(page.getByRole('tree', { name: 'Objects' })).toContainText('tris')
  const first = JSON.parse((await saved(page))!).projects[0].slicer.plates[0].objects[0]
  expect([first.width, first.depth, first.height]).toEqual([40, 20, 40])
  expect(first.mesh.length).toBe(12 * 9)

  // An STL file imports through the Prepare tab.
  const stl = [
    'solid tri',
    ...[
      [0, 0, 0, 10, 0, 0, 0, 10, 0],
      [0, 0, 5, 0, 10, 5, 10, 0, 5],
    ].map(
      ([ax, ay, az, bx, by, bz, cx, cy, cz]) =>
        `facet normal 0 0 1\nouter loop\nvertex ${ax} ${ay} ${az}\nvertex ${bx} ${by} ${bz}\nvertex ${cx} ${cy} ${cz}\nendloop\nendfacet`,
    ),
    'endsolid tri',
  ].join('\n')
  await page.getByRole('tab', { name: 'Prepare' }).click()
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Import STL' }).click()
  await (
    await chooser
  ).setFiles({ name: 'wedge.stl', mimeType: 'model/stl', buffer: Buffer.from(stl) })
  await expect(page.getByRole('img', { name: 'Build plate with 2 objects' })).toBeVisible()
  await expect(page.getByRole('tree', { name: 'Objects' })).toContainText('wedge')

  // Dragging an object in the viewport moves it on the plate. Fit centres the plate, so an
  // object placed at the origin sits under the middle of the viewport.
  await page.getByRole('tree', { name: 'Objects' }).getByText('Clip', { exact: true }).click()
  await page.getByLabel('X (mm)').fill('0')
  await page.getByLabel('Y (mm)').fill('0')
  const before = JSON.parse((await saved(page))!).projects[0].slicer.plates[0].objects[0]
  expect([before.x, before.y]).toEqual([0, 0])
  const viewport = page.getByRole('img', { name: 'Build plate with 2 objects' })
  const box = (await viewport.boundingBox())!
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x + 60, start.y + 30, { steps: 6 })
  await page.mouse.up()
  const after = JSON.parse((await saved(page))!).projects[0].slicer.plates[0].objects
  const moved = after.find((o: { id: string }) => o.id === before.id)
  const untouched = after.find((o: { id: string }) => o.id !== before.id)
  expect([moved.x, moved.y]).not.toEqual([before.x, before.y])
  expect(untouched.name).toBe('wedge')

  // Back in the modeler the part exports as STL and the slicer link stays.
  await page.getByRole('button', { name: 'Back to project' }).click()
  await page.getByRole('button', { name: 'Open modeler', exact: true }).click()
  const download = page.waitForEvent('download')
  await page.getByRole('menuitem', { name: 'File' }).click()
  await page.getByRole('menuitem', { name: 'Export STL…' }).click()
  expect((await download).suggestedFilename()).toBe('clip.stl')
})

test('modeler: the sketcher draws a profile, fillets edit their target, section and 3MF export work', async ({
  page,
}) => {
  test.setTimeout(90000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await createProject(page, 'Sketched Block', ['3D modeler'], 'Open modeler')

  // A free sketch: two rectangle clicks in the sketcher make one closed loop.
  await page.getByRole('tab', { name: 'Sketch' }).click()
  await page.getByRole('button', { name: 'Sketch', exact: true }).click()
  await page
    .getByRole('form', { name: 'Sketch properties' })
    .getByRole('button', { name: 'OK', exact: true })
    .click()
  const sketcher = page.getByRole('application', { name: /Sketch on the Top plane/ })
  await expect(sketcher).toBeVisible()
  await page
    .getByRole('toolbar', { name: 'Sketch tools' })
    .getByRole('button', { name: 'Rectangle' })
    .click()
  const box = (await sketcher.boundingBox())!
  await page.mouse.click(box.x + box.width * 0.35, box.y + box.height * 0.35)
  await page.mouse.click(box.x + box.width * 0.65, box.y + box.height * 0.65)
  await expect(page.getByRole('status').filter({ hasText: '1 closed loop' })).toBeVisible()
  // Dimensions of the selected entity are editable numbers.
  await page
    .getByRole('toolbar', { name: 'Sketch tools' })
    .getByRole('button', { name: 'Select' })
    .click()
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.35)
  const dims = page.getByLabel('Selected entity dimensions')
  await expect(dims).toBeVisible()
  await dims.getByLabel('Width').fill('40')
  await dims.getByLabel('Height').fill('30')
  await page
    .getByRole('form', { name: 'Sketch properties' })
    .getByRole('button', { name: 'OK', exact: true })
    .click()
  await expect(page.getByRole('tree', { name: 'FeatureManager' })).toContainText('Sketch1')

  // Extrude it, then fillet the extrusion's vertical edges and edit the fillet's radius.
  await page.getByRole('tab', { name: 'Features' }).click()
  await page.getByRole('button', { name: 'Extruded Boss/Base' }).click()
  await page
    .getByRole('form', { name: 'Extruded Boss/Base properties' })
    .getByRole('button', { name: 'OK', exact: true })
    .click()
  await expect(page.getByRole('img', { name: 'Model with 1 solid' })).toBeVisible()
  await page.getByRole('button', { name: 'Fillet', exact: true }).click()
  const fillet = page.getByRole('form', { name: 'Fillet properties' })
  await fillet.getByLabel('Edges').selectOption('Vertical edges')
  await fillet.getByLabel('Radius (mm)').fill('5')
  await fillet.getByRole('button', { name: 'OK', exact: true }).click()
  await expect(page.getByRole('tree', { name: 'FeatureManager' })).toContainText('Fillet1')
  await expect(page.getByRole('status').filter({ hasText: 'Rebuild OK' })).toBeVisible()
  await page.getByRole('tree', { name: 'FeatureManager' }).getByText('Fillet1').dblclick()
  const edit = page.getByRole('form', { name: 'Fillet properties' })
  await expect(edit.getByLabel('Radius (mm)')).toHaveValue('5')
  await edit.getByLabel('Radius (mm)').fill('8')
  await edit.getByRole('button', { name: 'OK', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Fillet1 updated' })).toBeVisible()

  // Section view caps the cut; mass properties report the centre of mass; 3MF downloads.
  await page.getByRole('tab', { name: 'Evaluate' }).click()
  await page.getByRole('button', { name: 'Section View' }).first().click()
  await page
    .getByRole('form', { name: 'Section View properties' })
    .getByRole('button', { name: 'OK', exact: true })
    .click()
  await expect(page.getByRole('button', { name: 'Close section' })).toBeVisible()
  await page.getByRole('button', { name: 'Mass Properties' }).click()
  await expect(page.getByText('Centre of mass')).toBeVisible()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export 3MF' }).click()
  expect((await download).suggestedFilename()).toBe('sketched-block.3mf')
  const library = JSON.parse((await saved(page))!)
  const model = library.projects[0].modeler
  expect(model.sketches[0].entities).toHaveLength(1)
  expect(model.sketches[0].entities[0].kind).toBe('rect')
  expect(model.features.map((f: { type: string }) => f.type)).toEqual(['extrude', 'fillet'])
  expect(model.features[1].params.radius).toBe(8)
  expect(model.features[1].params.targetId).toBe(model.features[0].id)
  expect(errors).toEqual([])
})

test('slicer: presets, supports, colour schemes, transforms, and 3MF export', async ({ page }) => {
  test.setTimeout(90000)
  await createProject(page, 'Overhang', ['Slicer'], 'Open slicer')
  await page.getByRole('button', { name: 'Add Object' }).click()
  const add = page.getByRole('form', { name: 'Add Object properties' })
  await add.getByLabel('Name').fill('Arch')
  await add.getByLabel('Height (Z) (mm)').fill('20')
  await add.getByRole('button', { name: 'OK', exact: true }).click()
  await expect(page.getByRole('img', { name: 'Build plate with 1 objects' })).toBeVisible()

  // A preset changes the layer height; supports and a raft switch on; the printer changes the bed.
  await page.getByRole('tab', { name: 'Settings' }).click()
  await page.getByLabel('Process preset').selectOption('0.28 mm Extra Draft')
  await expect(page.getByLabel('Layer height (mm)')).toHaveValue('0.28')
  await page.getByLabel('Enable supports').check()
  await page.getByLabel('Raft').check()
  await page.getByLabel('Printer').selectOption('Prusa MK4S')
  await expect(page.getByText('250 × 210 × 220 mm', { exact: false }).first()).toBeVisible()
  await page.getByRole('tab', { name: 'Objects' }).click()
  await page.getByRole('tree', { name: 'Objects' }).getByText('Arch').click()
  await page.getByRole('button', { name: 'Rotate X 90°' }).click()
  await expect(page.getByLabel('Height', { exact: true })).toHaveValue('40')
  // The smaller Prusa bed needs a fresh arrangement before the plate can slice.
  await page.getByRole('button', { name: 'Arrange' }).click()
  await page.getByRole('button', { name: 'Slice plate' }).click()
  await expect(page.getByRole('tab', { name: 'Preview' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('list', { name: 'Line types' })).toContainText('Raft')
  await page.getByRole('button', { name: 'Speed' }).first().click()
  await expect(page.getByLabel('Speed scale')).toBeVisible()
  await page.getByRole('button', { name: 'Filament' }).first().click()
  await expect(page.getByRole('list', { name: 'Filaments' })).toContainText('PLA')
  const download = page.waitForEvent('download')
  await page.getByRole('menuitem', { name: 'File' }).click()
  await page.getByRole('menuitem', { name: 'Export Plate as 3MF…' }).click()
  expect((await download).suggestedFilename()).toBe('overhang-plate-1.3mf')
  const project = JSON.parse((await saved(page))!).projects[0].slicer
  expect(project.printer).toBe('Prusa MK4S')
  expect(project.process.layerHeight).toBe(0.28)
  expect(project.process.raft).toBe(true)
  expect(project.sliced.byType.raft).toBeGreaterThan(0)
})
