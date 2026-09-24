import { describe, expect, it } from 'vitest'
import {
  emptyModeler,
  massProperties,
  newFeature,
  newSketch,
  solids,
  validModeler,
} from '../modeler/model'
import {
  arrange,
  emptySlicer,
  estimateSlice,
  formatDuration,
  newObject,
  validSlicer,
} from '../slicer/model'
import { fitViewBox, project, shade } from './Isometric'
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
  it('stacks extrusions, carves cuts, and reports mass from the material', () => {
    const doc = emptyModeler()
    const sketch = newSketch('Top', 'rectangle', 60, 40, 1)
    doc.sketches.push(sketch)
    doc.features.push(newFeature('extrude', 1, { depth: 20 }, sketch.id))
    doc.features.push(newFeature('extrude', 2, { depth: 10 }, sketch.id))
    doc.features.push(newFeature('hole', 1, { diameter: 8, depth: 10 }))
    expect(validModeler(doc)).toBe(true)
    const boxes = solids(doc)
    expect(boxes.map((b) => [b.z, b.h, b.cut])).toEqual([
      [0, 20, false],
      [20, 10, false],
      [20, 10, true],
    ])
    const steel = massProperties(doc)
    expect(steel.volume).toBeCloseTo(60 * 40 * 30 - 8 * 8 * 10)
    expect(steel.mass).toBeGreaterThan(0)
    const suppressed = { ...doc, features: doc.features.map((f) => ({ ...f, suppressed: true })) }
    expect(solids(suppressed)).toHaveLength(0)
    expect(validModeler({ ...doc, features: [{ ...doc.features[0], type: 'loft' }] })).toBe(false)
    expect(validModeler({ ...doc, features: [{ ...doc.features[0], sketchId: 'missing' }] })).toBe(
      false,
    )
  })
})

describe('slicer model', () => {
  it('arranges objects inside the bed and estimates a slice from settings', () => {
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
    const standard = estimateSlice(next)
    expect(standard.layers).toBe(Math.ceil((40 - 0.2) / 0.2) + 1)
    expect(standard.grams).toBeGreaterThan(0)
    const dense = estimateSlice({ ...next, process: { ...next.process, infill: 100 } })
    expect(dense.grams).toBeGreaterThan(standard.grams)
    const fast = estimateSlice({ ...next, process: { ...next.process, speed: 'ludicrous' } })
    expect(fast.seconds).toBeLessThan(standard.seconds)
    expect(estimateSlice(emptySlicer()).seconds).toBe(0)
    expect(formatDuration(3720)).toBe('1h 2m')
    expect(validSlicer({ ...doc, nozzle: 0.5 })).toBe(false)
  })
})

describe('isometric helpers', () => {
  it('projects, fits, and shades', () => {
    expect(project({ x: 10, y: 0, z: 0 }, 'top')).toEqual({ x: 10, y: 0 })
    expect(project({ x: 0, y: 0, z: 10 }, 'front')).toEqual({ x: 0, y: -10 })
    const iso = project({ x: 10, y: 10, z: 0 }, 'iso')
    expect(iso.x).toBeCloseTo(0)
    expect(iso.y).toBeCloseTo(10)
    expect(
      fitViewBox(
        [
          { x: 0, y: 0, z: 0 },
          { x: 10, y: 0, z: 0 },
        ],
        'top',
        5,
      ),
    ).toBe('-5 -5 20 11')
    expect(shade('#808080', -0.5)).toBe('#404040')
    expect(shade('#000000', 1)).toBe('#ffffff')
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
