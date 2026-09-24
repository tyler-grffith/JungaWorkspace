import { describe, expect, it } from 'vitest'
import { bounds, triangleCount, volume } from '../workbench/geometry'
import {
  FILAMENT_PRESETS,
  emptyPainter,
  gridFor,
  newFilament,
  normalizeStack,
  spaceSwapsEvenly,
  validPainter,
} from './model'
import { downsample, paint, printSheet, ramp, reliefMesh, rgbToHex, swapPlan } from './paint'

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
    // One layer of white over black is a third of the way (0.1 of 0.3 mm), three layers hide it.
    expect(Math.round(steps[4].color[0])).toBe(Math.round(31 + (255 - 31) / 3))
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
