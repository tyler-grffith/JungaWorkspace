import { describe, expect, it } from 'vitest'
import { bounds, triangleCount, volume } from '../workbench/geometry'
import {
  DEFAULT_RENDER,
  FILAMENT_PRESETS,
  emptyPainter,
  type PainterDocument,
  gridFor,
  newFilament,
  normalizeStack,
  spaceSwapsEvenly,
  validPainter,
} from './model'
import {
  downsample,
  estimateSeconds,
  paint,
  placeSwaps,
  printSheet,
  processPixels,
  ramp,
  relief,
  reliefMesh,
  rgbToHex,
  scrubPixels,
  suggestStack,
  swapPlan,
} from './paint'
import { deltaE2000, mixLinear, rgbToLab } from './color'

const tiny = (cols: number, rows: number, fill: (x: number, y: number) => number[]) => {
  const px = new Uint8ClampedArray(cols * rows * 4)
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) px.set([...fill(x, y), 255], (y * cols + x) * 4)
  return px
}

describe('painter document', () => {
  it('validates, normalizes the stack, and spaces swaps evenly', () => {
    const doc = emptyPainter()
    expect(validPainter(doc)).toBe(true)
    expect(doc.stack.map((f) => f.startLayer)).toEqual([1, 5, 17, 29])
    const shuffled = normalizeStack({
      ...doc,
      stack: [
        { ...doc.stack[1], startLayer: 2 },
        { ...doc.stack[0], startLayer: 30 },
      ],
    })
    // The lowest start becomes the base on layer 1; the rest cannot start inside the base.
    expect(shuffled.stack.map((f) => [f.name, f.startLayer])).toEqual([
      ['Red', 1],
      ['Black', 30],
    ])
    const even = spaceSwapsEvenly({ ...doc, baseLayers: 2, maxLayers: 32 })
    expect(even.stack.map((f) => f.startLayer)).toEqual([1, 3, 13, 23])
    expect(validPainter({ ...doc, maxLayers: 4, baseLayers: 4 })).toBe(false)
    expect(validPainter({ ...doc, stack: [] })).toBe(false)
    expect(
      validPainter({ ...doc, image: { src: 'javascript:1', width: 1, height: 1, name: '' } }),
    ).toBe(false)
    expect(
      gridFor({ ...doc, width: 400, detail: 8 }).cols *
        gridFor({ ...doc, width: 400, detail: 8 }).rows,
    ).toBeLessThanOrEqual(240_000 * 1.02)
  })
})

describe('painting engine', () => {
  it('builds a colour ramp that tints toward each filament until its transmission distance', () => {
    const doc = { ...emptyPainter(), layerHeight: 0.1, baseLayers: 2, maxLayers: 10 }
    doc.stack = [
      newFilament(FILAMENT_PRESETS[0], 1), // black base
      newFilament({ name: 'Thin white', color: '#ffffff', td: 0.3 }, 5),
    ]
    const steps = ramp(doc)
    expect(steps).toHaveLength(10)
    expect(rgbToHex(steps[3].color)).toBe('#1f1f1f')
    // One layer of white over black is a third of the way (0.1 of 0.3 mm) in linear light; three layers hide it.
    expect(steps[4].color[0]).toBeCloseTo(mixLinear([31, 31, 31], [255, 255, 255], 1 / 3)[0], 3)
    expect(rgbToHex(steps[6].color)).toBe('#ffffff')
    expect(rgbToHex(steps[9].color)).toBe('#ffffff')
    expect(swapPlan(doc)).toEqual([{ layer: 5, height: 0.4, filament: doc.stack[1] }])
  })
  it('paints pixels to the nearest ramp step and builds a closed relief mesh', () => {
    const doc = { ...emptyPainter(), width: 20, layerHeight: 0.1, baseLayers: 2, maxLayers: 10 }
    doc.stack = [
      newFilament(FILAMENT_PRESETS[0], 1),
      newFilament({ name: 'White', color: '#ffffff', td: 0.3 }, 5),
    ]
    const pixels = tiny(4, 2, (x) => (x < 2 ? [0, 0, 0] : [255, 255, 255]))
    const painting = paint(pixels, 4, 2, doc)
    expect(Array.from(painting.layers)).toEqual([2, 2, 7, 7, 2, 2, 7, 7])
    expect(painting.preview[0]).toBe(31)
    expect(painting.preview[(1 * 4 + 0) * 4]).toBe(31)
    expect(painting.preview[2 * 4]).toBe(255)
    const mesh = reliefMesh(painting, doc)
    // Closed and outward: the volume is the sum of the cells' columns (cell = 5 mm).
    expect(volume(mesh)).toBeCloseTo(25 * 0.1 * (2 + 2 + 7 + 7) * 2)
    const box = bounds(mesh)!
    expect([box.min.x, box.min.y, box.min.z, box.max.x, box.max.y]).toEqual([-10, -5, 0, 10, 5])
    expect(box.max.z).toBeCloseTo(0.7)
    const coarse = downsample(painting, 2)
    expect([coarse.cols, coarse.rows]).toEqual([2, 1])
    expect(Array.from(coarse.layers)).toEqual([2, 7])
    expect(triangleCount(reliefMesh(coarse, doc))).toBeGreaterThan(4)
    const sheet = printSheet('Test', doc, painting)
    expect(sheet).toContain('Layer 5 at 0.4 mm: change to White')
    expect(sheet).toContain('Start with Black')
  })
})

describe('colour science and refinements', () => {
  it('computes ΔE2000 against the published test pairs and mixes in linear light', () => {
    expect(deltaE2000([50, 2.6772, -79.7751], [50, 0, -82.7485])).toBeCloseTo(2.0425, 3)
    expect(deltaE2000([50, 2.5, 0], [73, 25, -18])).toBeCloseTo(27.1492, 3)
    expect(deltaE2000([50, 0, 0], [50, 0, 0])).toBe(0)
    expect(rgbToLab([255, 255, 255])[0]).toBeCloseTo(100, 0)
    expect(rgbToLab([0, 0, 0])[0]).toBeCloseTo(0, 0)
    expect(mixLinear([0, 0, 0], [255, 255, 255], 0.5)[0]).toBeGreaterThan(180)
  })
  it('processes the picture, dithers, keeps a frame with a hole, and scrubs by layer', () => {
    const doc: PainterDocument = {
      ...emptyPainter(),
      render: DEFAULT_RENDER,
      width: 40,
      layerHeight: 0.1,
      baseLayers: 2,
      maxLayers: 12,
    }
    doc.stack = [
      newFilament(FILAMENT_PRESETS[0], 1),
      newFilament({ name: 'White', color: '#ffffff', td: 0.6 }, 4),
    ]
    const px = tiny(8, 8, (x) => {
      const v = Math.round((x / 7) * 255)
      return [v, v, v]
    })
    const brighter = processPixels(px, 8, 8, { ...doc, render: { ...DEFAULT_RENDER, gamma: 2 } })
    expect(brighter[4 * 4]).toBeGreaterThan(px[4 * 4])
    const blurred = processPixels(px, 8, 8, { ...doc, render: { ...DEFAULT_RENDER, blur: 2 } })
    expect(blurred[0]).toBeGreaterThan(px[0])
    const plain = paint(px, 8, 8, doc)
    const dithered = paint(px, 8, 8, { ...doc, render: { ...DEFAULT_RENDER, dither: 'floyd' } })
    const distinctRows = (p: { layers: Uint8Array }) =>
      new Set(
        Array.from(p.layers)
          .map((_, i) => p.layers[i])
          .slice(8, 16),
      ).size
    expect(distinctRows(dithered)).toBeGreaterThanOrEqual(distinctRows(plain) - 1)
    expect(Array.from(dithered.layers).some((v, i) => v !== plain.layers[i])).toBe(true)
    expect(plain.error).toBeGreaterThanOrEqual(0)
    const rgb = paint(px, 8, 8, { ...doc, render: { ...DEFAULT_RENDER, match: 'rgb' } })
    expect(rgb.layers.length).toBe(64)
    const smoothed = paint(px, 8, 8, { ...doc, render: { ...DEFAULT_RENDER, minFeature: 12 } })
    expect(new Set(Array.from(smoothed.layers)).size).toBeLessThanOrEqual(
      new Set(Array.from(plain.layers)).size,
    )
    const framed = relief(plain, { ...doc, frame: { width: 10, holeDiameter: 12 } })
    const open = relief(plain, { ...doc, frame: { width: 10, holeDiameter: 0 } })
    const bare = relief(plain, doc)
    expect(volume(framed.mesh)).toBeLessThan(volume(open.mesh))
    expect(volume(open.mesh)).toBeGreaterThan(volume(bare.mesh))
    expect(bounds(open.mesh)!.max.x - bounds(open.mesh)!.min.x).toBeCloseTo(60)
    expect(framed.colors).toHaveLength(triangleCount(framed.mesh))
    const early = scrubPixels(plain, doc, 2)
    const late = scrubPixels(plain, doc, 12)
    expect(early[7 * 4]).toBeLessThan(late[7 * 4])
    expect(estimateSeconds(plain, doc)).toBeGreaterThan(0)
    expect(validPainter({ ...doc, render: { ...DEFAULT_RENDER, match: 'hsl' } })).toBe(false)
    expect(validPainter({ ...doc, frame: { width: 5, holeDiameter: 4 } })).toBe(true)
  })
  it('places swaps and suggests a stack that lower the matching error', () => {
    const doc = { ...emptyPainter(), width: 60, layerHeight: 0.1, baseLayers: 2, maxLayers: 20 }
    doc.stack = [
      newFilament(FILAMENT_PRESETS[0], 1),
      newFilament({ name: 'Red', color: '#c8102e', td: 1 }, 19),
      newFilament({ name: 'White', color: '#ffffff', td: 1 }, 20),
    ]
    const px = tiny(24, 8, (x) => (x < 8 ? [0, 0, 0] : x < 16 ? [200, 16, 46] : [255, 255, 255]))
    const before = paint(px, 24, 8, doc).error!
    const placed = placeSwaps(px, 24, 8, doc)
    const after = paint(px, 24, 8, placed).error!
    expect(after).toBeLessThan(before)
    expect(placed.stack[1].startLayer).toBeLessThan(19)
    let n = 0
    const suggested = suggestStack(
      px,
      24,
      8,
      { ...doc, stack: [doc.stack[0]] },
      FILAMENT_PRESETS.slice(0, 6),
      3,
      () => `id${n++}`,
    )
    expect(suggested.stack.length).toBeGreaterThanOrEqual(2)
    expect(suggested.stack.length).toBeLessThanOrEqual(3)
    expect(suggested.stack[0].startLayer).toBe(1)
    expect(paint(px, 24, 8, suggested).error!).toBeLessThan(
      paint(px, 24, 8, { ...doc, stack: [doc.stack[0]] }).error!,
    )
  })
})
