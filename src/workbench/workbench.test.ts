import { describe, expect, it } from 'vitest'
import {
  derive,
  emptyModeler,
  massProperties,
  newFeature,
  newSketch,
  printableMesh,
  validModeler,
} from '../modeler/model'
import {
  arrange,
  emptySlicer,
  formatDuration,
  meshObject,
  newObject,
  objectMesh,
  validSlicer,
} from '../slicer/model'
import { slicePlate, toGcode } from '../slicer/slicing'
import { bounds, triangleCount, volume } from './geometry'
import {
  addModuleOutput,
  addProject,
  duplicateProject,
  emptyLibrary,
  initializeTools,
  parseLibrary,
  saveModuleDocument,
  starterInput,
} from '../library'
import { parseBackup, serializeBackup } from '../backup'

describe('modeler model', () => {
  it('rebuilds real solids from the feature history and reports mass from the material', () => {
    const doc = emptyModeler()
    const base = newSketch('Top', 'rectangle', 60, 40, 1)
    const upper = newSketch('Top', 'rectangle', 60, 40, 2, { offset: 20 })
    doc.sketches.push(base, upper)
    doc.features.push(newFeature('extrude', 1, { depth: 20 }, base.id))
    doc.features.push(newFeature('extrude', 2, { depth: 10 }, upper.id))
    doc.features.push(newFeature('hole', 1, { diameter: 8, depth: 10 }))
    expect(validModeler(doc)).toBe(true)
    const part = derive(doc)
    expect(part.solids.map((s) => s.cut)).toEqual([false, false, true])
    expect(bounds(part.solids[1].mesh)?.max.z).toBeCloseTo(30)
    expect(volume(part.solids[0].mesh)).toBeCloseTo(60 * 40 * 20)
    // The hole is a reversed cylinder drilled down from the top face.
    expect(volume(part.solids[2].mesh)).toBeLessThan(0)
    expect(bounds(part.solids[2].mesh)?.max.z).toBeCloseTo(30)
    const steel = massProperties(doc)
    expect(steel.volume).toBeCloseTo(60 * 40 * 30 - Math.PI * 16 * 10, -1)
    expect(steel.mass).toBeGreaterThan(0)
    expect(steel.size).toEqual({ x: 60, y: 40, z: 30 })
    const suppressed = { ...doc, features: doc.features.map((f) => ({ ...f, suppressed: true })) }
    expect(derive(suppressed).solids).toHaveLength(0)
    expect(validModeler({ ...doc, features: [{ ...doc.features[0], type: 'loft' }] })).toBe(false)
    expect(validModeler({ ...doc, features: [{ ...doc.features[0], sketchId: 'missing' }] })).toBe(
      false,
    )
  })
  it('revolves, mirrors, and patterns into more solids and exports one printable mesh', () => {
    const doc = emptyModeler()
    const disc = newSketch('Top', 'rectangle', 20, 10, 1)
    doc.sketches.push(disc)
    doc.features.push(newFeature('revolve', 1, { angle: 360 }, disc.id))
    const cylinder = derive(doc).solids[0].mesh
    // A centred 20 × 10 rectangle revolved is a cylinder of radius 10 and height 10.
    expect(volume(cylinder)).toBeCloseTo(Math.PI * 100 * 10, -2)
    doc.features.push(newFeature('pattern', 1, { direction: 'X', spacing: 30, count: 3 }))
    doc.features.push(newFeature('mirror', 1, { plane: 'Front' }))
    const part = derive(doc)
    expect(part.solids).toHaveLength(6)
    const printable = printableMesh(doc)
    expect(bounds(printable)?.min.z).toBeCloseTo(0)
    expect(triangleCount(printable)).toBeLessThanOrEqual(4000)
  })
})

describe('slicer model', () => {
  it('arranges objects inside the bed and slices them into layers with real toolpaths', () => {
    const doc = emptySlicer()
    const plate = doc.plates[0]
    plate.objects.push(
      newObject('A', 100, 100, 20, 0),
      newObject('B', 100, 100, 40, 1),
      newObject('C', 100, 100, 10, 2),
    )
    const arranged = arrange(plate, 256)
    for (const o of arranged.objects) {
      expect(o.x - o.width / 2).toBeGreaterThanOrEqual(-128)
      expect(o.x + o.width / 2).toBeLessThanOrEqual(128)
    }
    expect(arranged.objects[2].y).toBeGreaterThan(arranged.objects[0].y)
    const next = { ...doc, plates: [arranged] }
    expect(validSlicer(next)).toBe(true)
    const standard = slicePlate(next)
    expect(standard.result.layers).toBe(Math.ceil((40 - 0.2) / 0.2) + 1)
    expect(standard.result.grams).toBeGreaterThan(0)
    const first = standard.layers[0]
    expect(first.paths.filter((p) => p.kind === 'outer')).toHaveLength(3)
    expect(first.paths.some((p) => p.kind === 'solid')).toBe(true)
    expect(standard.layers[50].paths.some((p) => p.kind === 'infill')).toBe(true)
    const dense = slicePlate({ ...next, process: { ...next.process, infill: 100 } })
    expect(dense.result.grams).toBeGreaterThan(standard.result.grams)
    const fast = slicePlate({ ...next, process: { ...next.process, speed: 'ludicrous' } })
    expect(fast.result.seconds).toBeLessThan(standard.result.seconds)
    expect(slicePlate(emptySlicer()).result.seconds).toBe(0)
    const gcode = toGcode(standard, next, 'Test')
    expect(gcode).toContain(';LAYER:0')
    expect(gcode.split('\n').filter((l) => l.startsWith('G1 X')).length).toBeGreaterThan(100)
    expect(formatDuration(3720)).toBe('1h 2m')
    expect(validSlicer({ ...doc, nozzle: 0.5 })).toBe(false)
  })
  it('places meshes as objects and turns them with their rotation', () => {
    const doc = emptySlicer()
    const part = emptyModeler()
    const sketch = newSketch('Top', 'rectangle', 30, 10, 1)
    part.sketches.push(sketch)
    part.features.push(newFeature('extrude', 1, { depth: 5 }, sketch.id))
    const object = meshObject('Part', printableMesh(part))
    expect([object.width, object.depth, object.height]).toEqual([30, 10, 5])
    const turned = bounds(objectMesh({ ...object, rotation: 90, x: 50, y: 0 }))!
    expect(turned.max.x - turned.min.x).toBeCloseTo(10)
    expect(turned.max.y - turned.min.y).toBeCloseTo(30)
    expect((turned.min.x + turned.max.x) / 2).toBeCloseTo(50)
    const plate = { ...doc.plates[0], objects: [object] }
    expect(validSlicer({ ...doc, plates: [plate] })).toBe(true)
    expect(
      validSlicer({ ...doc, plates: [{ ...plate, objects: [{ ...object, mesh: [1, 2] }] }] }),
    ).toBe(false)
  })
})

describe('modeler and slicer in the library', () => {
  it('initialize, save, duplicate, back up, and own outputs through the registry', () => {
    const { library, project } = addProject(emptyLibrary(), {
      ...starterInput,
      title: 'Shop',
      tools: ['modeler', 'slicer'],
    })
    const ready = initializeTools(library, project.id, ['modeler', 'slicer'])
    expect(ready.projects[0].modeler?.features).toEqual([])
    expect(ready.projects[0].slicer?.plates).toHaveLength(1)
    const model = { ...ready.projects[0].modeler!, material: 'Brass' }
    const saved = saveModuleDocument(ready, project.id, 'modeler', model)
    expect(saved.projects[0].modeler?.material).toBe('Brass')
    expect(() =>
      saveModuleDocument(ready, project.id, 'slicer', {
        ...ready.projects[0].slicer!,
        printer: 'Other' as never,
      }),
    ).toThrow()
    const withOutputs = addModuleOutput(
      addModuleOutput(saved, project.id, 'modeler'),
      project.id,
      'slicer',
    )
    expect(withOutputs.projects[0].outputs.map((o) => o.type)).toEqual([
      'modeler-view',
      'slicer-view',
    ])
    const copy = duplicateProject(withOutputs, project.id)
    expect(copy.project.modeler?.material).toBe('Brass')
    expect(copy.project.outputs).toHaveLength(2)
    expect(parseLibrary(JSON.stringify(withOutputs)).projects[0].slicer?.printer).toBe(
      'Bambu Lab X1 Carbon',
    )
    expect(parseBackup(serializeBackup(withOutputs)).library.projects[0].modeler?.material).toBe(
      'Brass',
    )
  })
})
