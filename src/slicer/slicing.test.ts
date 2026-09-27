import { describe, expect, it } from 'vitest'
import { extrude, frames, profile, translate, vec } from '../workbench/geometry'
import {
  applyPreset,
  arrange,
  bedFor,
  emptySlicer,
  meshObject,
  newObject,
  normalizeSlicer,
  outsideBed,
  validSlicer,
  type SlicerDocument,
} from './model'
import { PATH_KINDS, slicePlate, toGcode } from './slicing'
import * as R from './raster'

const withObjects = (...objects: ReturnType<typeof newObject>[]): SlicerDocument => {
  const doc = emptySlicer()
  doc.plates[0].objects = objects
  return doc
}
const kinds = (paths: { kind: string }[]) => new Set(paths.map((p) => p.kind))

describe('raster masks', () => {
  it('fills polygons even-odd, combines, grows, shrinks, and clips lines', () => {
    const frame = R.frameFor({ x: 0, y: 0 }, { x: 20, y: 20 }, 0, 1)
    const square = profile('rectangle', 20, 20).map((p) => ({ x: p.x + 10, y: p.y + 10 }))
    const hole = profile('rectangle', 10, 10).map((p) => ({ x: p.x + 10, y: p.y + 10 }))
    const ring = R.rasterize([square, hole], frame)
    const full = R.rasterize([square], frame)
    expect(R.count(full)).toBeCloseTo(400 / frame.cell ** 2, -1)
    expect(R.count(ring)).toBeCloseTo(300 / frame.cell ** 2, -2)
    expect(R.inside(ring, 10, 10)).toBe(false)
    expect(R.inside(ring, 2, 2)).toBe(true)
    expect(R.count(R.minus(full, ring))).toBeCloseTo(100 / frame.cell ** 2, -2)
    expect(R.count(R.dilate(ring, 2))).toBeGreaterThan(R.count(ring))
    expect(R.count(R.erode(ring, 2))).toBeLessThan(R.count(ring))
    const clipped = R.clip(
      [
        [
          { x: -5, y: 10 },
          { x: 25, y: 10 },
        ],
      ],
      ring,
    )
    expect(clipped).toHaveLength(2)
    expect(R.lines(full, 5, 0).length).toBeGreaterThan(2)
    expect(R.outline(full)[0].length).toBeGreaterThanOrEqual(4)
  })
})

describe('slicing', () => {
  it('sorts the interior into bottom, solid, sparse, and top with the right layer counts', () => {
    const doc = withObjects(newObject('Cube', 20, 20, 10, 0))
    doc.process.topLayers = 3
    doc.process.bottomLayers = 2
    const { layers, result } = slicePlate(doc)
    expect(result.layers).toBe(50)
    expect(kinds(layers[0].paths)).toEqual(new Set(['outer', 'inner', 'bottom', 'skirt']))
    expect(kinds(layers[1].paths)).toEqual(new Set(['outer', 'inner', 'solid']))
    expect(kinds(layers[25].paths)).toEqual(new Set(['outer', 'inner', 'infill']))
    expect(kinds(layers[47].paths)).toEqual(new Set(['outer', 'inner', 'solid']))
    expect(kinds(layers[49].paths)).toEqual(new Set(['outer', 'inner', 'top']))
    expect(layers[10].travels.length).toBeGreaterThan(0)
    expect(layers[10].seconds).toBeGreaterThan(0)
    expect(result.byType?.outer).toBeGreaterThan(0)
    expect(result.bySlot).toEqual([result.grams])
  })
  it('lays a skin on a step and grows supports under an overhang', () => {
    // A T shape: a 10 mm wide stem under a 30 mm wide bar leaves two overhangs.
    const stem = extrude(profile('rectangle', 10, 10), frames.Top(), 0, 10)
    const bar = translate(extrude(profile('rectangle', 30, 10), frames.Top(), 0, 4), vec(0, 0, 10))
    const doc = withObjects(meshObject('T', [...stem, ...bar]))
    doc.process.supports = true
    doc.process.skirtLoops = 0
    const { layers } = slicePlate(doc)
    const stepLayer = layers.find((l) => l.z > 10 && l.z <= 10.4)!
    expect(kinds(stepLayer.paths).has('bottom')).toBe(true)
    // Supports stand in the layers under the bar and not above it.
    const under = layers.filter((l) => l.z < 9.5)
    expect(under.every((l) => kinds(l.paths).has('support'))).toBe(true)
    expect(layers.filter((l) => l.z > 10.5).some((l) => kinds(l.paths).has('support'))).toBe(false)
    const supportX = under[10].paths
      .filter((p) => p.kind === 'support')
      .flatMap((p) => p.points.map((q) => Math.abs(q.x)))
    expect(Math.min(...supportX)).toBeGreaterThan(5)
    const plain = slicePlate({ ...doc, process: { ...doc.process, supports: false } })
    expect(plain.layers.some((l) => kinds(l.paths).has('support'))).toBe(false)
  })
  it('draws every infill pattern, adhesion, and filament changes into paths and G-code', () => {
    const base = withObjects(newObject('Block', 30, 30, 6, 0))
    for (const pattern of [
      'grid',
      'lines',
      'triangles',
      'cubic',
      'gyroid',
      'honeycomb',
      'concentric',
      'lightning',
    ] as const) {
      const doc = { ...base, process: { ...base.process, infillPattern: pattern, infill: 20 } }
      const mid = slicePlate(doc).layers[15]
      expect(mid.paths.filter((p) => p.kind === 'infill').length, pattern).toBeGreaterThan(3)
    }
    const doc = {
      ...base,
      process: {
        ...base.process,
        brim: true,
        brimWidth: 3,
        skirtLoops: 2,
        raft: true,
        changes: [
          { layer: 10, slot: -1 },
          { layer: 20, slot: 1 },
        ],
      },
    }
    doc.slots = [{ type: 'PETG', brand: 'Other', color: '#3b8beb' }]
    expect(validSlicer(doc)).toBe(true)
    const sliced = slicePlate(doc)
    expect(kinds(sliced.layers[0].paths)).toEqual(new Set(['raft']))
    expect(kinds(sliced.layers[2].paths).has('brim')).toBe(true)
    expect(kinds(sliced.layers[2].paths).has('skirt')).toBe(true)
    expect(sliced.layers[2].z).toBeCloseTo(0.7)
    expect(sliced.layers[9].pause).toBe(true)
    expect(sliced.layers[25].paths.every((p) => p.slot === 1)).toBe(true)
    expect(sliced.result.bySlot).toHaveLength(2)
    expect(sliced.result.bySlot![1]).toBeGreaterThan(0)
    const gcode = toGcode(sliced, doc, 'Block')
    expect(gcode).toContain('M600')
    expect(gcode).toContain('\nT1')
    expect(gcode).toContain(';TYPE:Raft')
    expect(gcode).toContain('M73 P')
    expect(gcode).toMatch(/G1 E-0\.800 F1800/)
    expect(PATH_KINDS).toContain('support')
  })
  it('applies per-object overrides, presets, bed checks, and corner-origin G-code shifts', () => {
    const dense = { ...newObject('Dense', 20, 20, 10, 0), overrides: { infill: 100, walls: 3 } }
    const doc = withObjects(dense, newObject('Sparse', 20, 20, 10, 1))
    const arranged = arrange(doc.plates[0], bedFor(doc.printer))
    doc.plates[0] = arranged
    expect(validSlicer(doc)).toBe(true)
    const { layers } = slicePlate(doc)
    const mid = layers[25]
    const denseInfill = mid.paths.filter((p) => p.object === dense.id && p.kind === 'infill')
    const sparseInfill = mid.paths.filter((p) => p.object !== dense.id && p.kind === 'infill')
    expect(denseInfill.length).toBeGreaterThan(sparseInfill.length * 2)
    expect(mid.paths.filter((p) => p.object === dense.id && p.kind === 'inner')).toHaveLength(2)
    const fine = applyPreset(doc.process, '0.12 mm Fine')
    expect(fine.layerHeight).toBe(0.12)
    expect(fine.topLayers).toBe(6)
    expect(
      outsideBed({ ...doc.plates[0], objects: [{ ...dense, x: 200 }] }, bedFor(doc.printer)),
    ).toHaveLength(1)
    const prusa = { ...doc, printer: 'Prusa MK4S' }
    expect(validSlicer(prusa)).toBe(true)
    const gcode = toGcode(slicePlate(prusa), prusa, 'Two')
    expect(gcode).not.toMatch(/G[01] X-/)
    expect(gcode).toMatch(/G1 X\d/)
    const legacy = {
      ...emptySlicer(),
      process: {
        layerHeight: 0.2,
        firstLayerHeight: 0.2,
        walls: 2,
        infill: 15,
        infillPattern: 'grid',
        supports: false,
        supportType: 'tree',
        brim: false,
        seam: 'aligned',
        speed: 'standard',
        nozzleTemp: 220,
        bedTemp: 55,
      },
    } as unknown as SlicerDocument
    expect(validSlicer(legacy)).toBe(true)
    expect(normalizeSlicer(legacy).process.topLayers).toBe(4)
  })
})
