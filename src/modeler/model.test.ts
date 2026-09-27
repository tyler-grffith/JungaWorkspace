import { describe, expect, it } from 'vitest'
import { bounds, triangleCount, volume } from '../workbench/geometry'
import {
  checkMesh,
  derive,
  emptyModeler,
  massProperties,
  newFeature,
  newSketch,
  printableMesh,
  sectionOf,
  sketchRegionsOf,
  validModeler,
  type ModelerDocument,
} from './model'
import {
  entityDimensions,
  mirrorEntity,
  setEntityDimension,
  shapeEntities,
  sketchLoops,
  sketchPath,
  sketchRegions,
  type SketchEntity,
} from './sketch'

const plate = (w = 60, d = 40, h = 10) => {
  const doc = emptyModeler()
  const base = newSketch('Top', 'rectangle', w, d, 1)
  doc.sketches.push(base)
  doc.features.push(newFeature('extrude', 1, { depth: h }, base.id))
  return doc
}

describe('rebuilding a part with booleans', () => {
  it('drills real holes and cuts real pockets, leaving one closed body', () => {
    const doc = plate()
    doc.features.push(newFeature('hole', 1, { diameter: 8, end: 'Through All' }))
    const pocket = newSketch('Top', 'rectangle', 20, 10, 2, { offset: 10, x: 15 })
    doc.sketches.push(pocket)
    doc.features.push(newFeature('cut', 1, { depth: 4 }, pocket.id))
    const part = derive(doc)
    expect(Object.keys(part.errors)).toEqual([])
    expect(volume(part.body.mesh)).toBeCloseTo(60 * 40 * 10 - Math.PI * 16 * 10 - 20 * 10 * 4, -1)
    // Faces remember their feature: the hole's wall carries the hole's id.
    expect(new Set(part.body.tags)).toEqual(new Set(doc.features.map((f) => f.id)))
    expect(part.solids.map((s) => s.cut)).toEqual([false, true, true])
    const m = massProperties(doc, part)
    expect(m.mass).toBeGreaterThan(0)
    expect(m.centroid.z).toBeLessThan(5)
    expect(m.size).toEqual({ x: 60, y: 40, z: 10 })
  })
  it('applies fillets, chamfers, and shells to the feature they target', () => {
    const doc = plate(40, 40, 20)
    const target = doc.features[0].id
    const plain = volume(derive(doc).body.mesh)
    doc.features.push(
      newFeature('fillet', 1, { radius: 4, edges: 'Vertical edges', targetId: target }),
    )
    const filleted = volume(derive(doc).body.mesh)
    expect(filleted).toBeLessThan(plain)
    expect(filleted).toBeGreaterThan(plain * 0.95)
    doc.features[1] = newFeature('chamfer', 1, {
      distance: 3,
      edges: 'Top edges',
      targetId: target,
    })
    expect(volume(derive(doc).body.mesh)).toBeLessThan(plain)
    doc.features[1] = newFeature('shell', 1, { thickness: 2, open: 'Top', targetId: target })
    const shelled = derive(doc)
    expect(Object.keys(shelled.errors)).toEqual([])
    expect(volume(shelled.body.mesh)).toBeCloseTo(40 * 40 * 20 - 36 * 36 * 18, -1)
    doc.features[1] = newFeature('shell', 1, { thickness: 2, targetId: 'missing' })
    expect(derive(doc).errors[doc.features[1].id]).toContain('target')
  })
  it('revolves, lofts, sweeps, and patterns around an axis', () => {
    const doc = emptyModeler()
    const disc = newSketch('Top', 'rectangle', 20, 10, 1)
    doc.sketches.push(disc)
    doc.features.push(newFeature('revolve', 1, { angle: 360 }, disc.id))
    expect(volume(derive(doc).body.mesh)).toBeCloseTo(Math.PI * 100 * 10, -2)
    const groove = newSketch('Top', 'rectangle', 4, 4, 2, { x: 10, y: 5 })
    doc.sketches.push(groove)
    doc.features.push(newFeature('revolve', 2, { angle: 360, cut: true }, groove.id))
    expect(volume(derive(doc).body.mesh)).toBeLessThan(Math.PI * 100 * 10)

    const loftDoc = emptyModeler()
    const a = newSketch('Top', 'rectangle', 20, 20, 1)
    const b = newSketch('Top', 'circle', 10, 10, 2, { offset: 15 })
    loftDoc.sketches.push(a, b)
    loftDoc.features.push(newFeature('loft', 1, { sketch2: b.id }, a.id))
    const lofted = derive(loftDoc)
    expect(Object.keys(lofted.errors)).toEqual([])
    expect(bounds(lofted.body.mesh)?.max.z).toBeCloseTo(15)
    expect(volume(lofted.body.mesh)).toBeGreaterThan(Math.PI * 25 * 15)

    const sweepDoc = emptyModeler()
    const section = newSketch('Right', 'circle', 4, 4, 1)
    const path = newSketch('Top', 'rectangle', 1, 1, 2, {
      entities: [
        { id: 'p1', kind: 'line', a: { x: 0, y: 0 }, b: { x: 30, y: 0 } },
        { id: 'p2', kind: 'line', a: { x: 30, y: 0 }, b: { x: 30, y: 20 } },
      ],
    })
    sweepDoc.sketches.push(section, path)
    sweepDoc.features.push(newFeature('sweep', 1, { pathSketch: path.id }, section.id))
    const swept = derive(sweepDoc)
    expect(Object.keys(swept.errors)).toEqual([])
    expect(volume(swept.body.mesh)).toBeCloseTo(Math.PI * 4 * 50, -2)

    const ring = plate(80, 80, 6)
    ring.features.push(newFeature('hole', 1, { diameter: 6, x: 30, y: 0, end: 'Through All' }))
    ring.features.push(newFeature('circular', 1, { count: 6, angle: 360, axis: 'Z' }))
    const bolted = derive(ring)
    expect(Object.keys(bolted.errors)).toEqual([])
    expect(volume(bolted.body.mesh)).toBeCloseTo(80 * 80 * 6 - 6 * Math.PI * 9 * 6, -1)
    expect(bolted.solids).toHaveLength(7)
  })
  it('extrudes free sketches with holes and rolls the history back', () => {
    const doc = emptyModeler()
    const entities: SketchEntity[] = [
      { id: 'r', kind: 'rect', a: { x: -20, y: -10 }, b: { x: 20, y: 10 } },
      { id: 'c', kind: 'circle', c: { x: 0, y: 0 }, r: 4 },
    ]
    const sketch = newSketch('Top', 'rectangle', 40, 20, 1, { entities })
    doc.sketches.push(sketch)
    doc.features.push(newFeature('extrude', 1, { depth: 5 }, sketch.id))
    doc.features.push(newFeature('hole', 1, { diameter: 3, x: 15 }))
    expect(validModeler(doc)).toBe(true)
    expect(sketchRegionsOf(sketch)[0].holes).toHaveLength(1)
    const part = derive(doc)
    expect(volume(part.body.mesh)).toBeCloseTo((800 - Math.PI * 16) * 5 - Math.PI * 2.25 * 5, -1)
    expect(derive(doc, { upTo: 1 }).solids).toHaveLength(1)
    const open = {
      ...doc,
      sketches: [
        {
          ...sketch,
          entities: [
            { id: 'l', kind: 'line', a: { x: 0, y: 0 }, b: { x: 5, y: 5 } } as SketchEntity,
          ],
        },
      ],
    }
    expect(derive(open).errors[doc.features[0].id]).toContain('closed')
    expect(triangleCount(printableMesh(doc))).toBeLessThanOrEqual(4000)
    expect(bounds(printableMesh(doc))?.min.z).toBeCloseTo(0)
  })
  it('sections the body with a capped cut and accepts imported mesh bodies', () => {
    const doc = plate(20, 20, 20)
    const part = derive(doc)
    const half = sectionOf(part.body, 'y', 0, true)
    expect(volume(half.mesh)).toBeCloseTo(4000, -1)
    // A plain prism is topologically closed; boolean results keep T-junctions, which the check reports.
    expect(checkMesh(part.solids[0].mesh)).toEqual({ edges: 18, open: 0, triangles: 12 })
    const withMesh: ModelerDocument = {
      ...emptyModeler(),
      meshes: [{ id: 'm1', name: 'blob', mesh: part.body.mesh }],
      features: [newFeature('mesh', 1, { meshId: 'm1', x: 30, scale: 0.5 })],
    }
    expect(validModeler(withMesh)).toBe(true)
    expect(volume(derive(withMesh).body.mesh)).toBeCloseTo(1000, 0)
    expect(validModeler({ ...withMesh, meshes: [{ id: 'm1', name: 'x', mesh: [1, 2] }] })).toBe(
      false,
    )
  })
})

describe('sketch entities', () => {
  it('chains lines and arcs into loops, nests holes, and finds open paths', () => {
    const square: SketchEntity[] = [
      { id: '1', kind: 'line', a: { x: 0, y: 0 }, b: { x: 10, y: 0 } },
      { id: '2', kind: 'line', a: { x: 10, y: 0 }, b: { x: 10, y: 10 } },
      { id: '3', kind: 'line', a: { x: 10, y: 10 }, b: { x: 0, y: 10 } },
      { id: '4', kind: 'line', a: { x: 0, y: 10 }, b: { x: 0, y: 0 } },
      { id: '5', kind: 'circle', c: { x: 5, y: 5 }, r: 2 },
    ]
    const loops = sketchLoops(square)
    expect(loops).toHaveLength(2)
    const regions = sketchRegions(square)
    expect(regions).toHaveLength(1)
    expect(regions[0].holes).toHaveLength(1)
    const rounded: SketchEntity[] = [
      { id: 'a', kind: 'line', a: { x: 0, y: 0 }, b: { x: 10, y: 0 } },
      { id: 'b', kind: 'arc', c: { x: 10, y: 5 }, r: 5, start: -90, end: 90 },
      { id: 'c', kind: 'line', a: { x: 10, y: 10 }, b: { x: 0, y: 10 } },
      { id: 'd', kind: 'line', a: { x: 0, y: 10 }, b: { x: 0, y: 0 } },
    ]
    expect(sketchLoops(rounded)).toHaveLength(1)
    expect(sketchPath(rounded.slice(0, 3)).length).toBeGreaterThan(3)
    expect(sketchPath([square[0], square[1]])).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ])
  })
  it('makes quick shapes editable and dimensions them', () => {
    const [rect] = shapeEntities('rectangle', 30, 20, 5, 0)
    expect(entityDimensions(rect).map((d) => d.value)).toEqual([30, 20])
    const wider = setEntityDimension(rect, 0, 50)
    expect(entityDimensions(wider)[0].value).toBe(50)
    const [slot] = shapeEntities('slot', 30, 10)
    expect(slot.kind).toBe('slot')
    expect(Math.abs(sketchLoops([slot]).length)).toBe(1)
    const mirrored = mirrorEntity(
      { id: 'l', kind: 'line', a: { x: 1, y: 2 }, b: { x: 4, y: 2 } },
      'x',
    )
    expect(mirrored.kind === 'line' && mirrored.a.x).toBe(-1)
  })
})
