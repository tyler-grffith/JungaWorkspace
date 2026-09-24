import { describe, expect, it } from 'vitest'
import {
  bounds,
  chainLoops,
  decimate,
  extrude,
  flip,
  frames,
  hatch,
  mirror,
  offsetPolygon,
  parseStl,
  polygonArea,
  profile,
  revolve,
  settle,
  sliceMesh,
  toStl,
  triangleCount,
  volume,
} from './geometry'
import { fitCamera, VIEWS } from './Viewport3D'

describe('profiles and sweeps', () => {
  it('extrudes profiles into closed solids with the right volume', () => {
    const box = extrude(profile('rectangle', 20, 10), frames.Top(), 0, 5)
    expect(triangleCount(box)).toBe(12)
    expect(volume(box)).toBeCloseTo(1000)
    expect(bounds(box)).toEqual({ min: { x: -10, y: -5, z: 0 }, max: { x: 10, y: 5, z: 5 } })
    const disc = extrude(profile('circle', 20, 20, 96), frames.Top(), 0, 1)
    expect(volume(disc)).toBeCloseTo(Math.PI * 100, 0)
    const slot = profile('slot', 30, 10)
    expect(polygonArea(slot)).toBeCloseTo(20 * 10 + Math.PI * 25, 0)
    // Growing toward the viewer of the front plane means along −Y.
    const front = extrude(profile('rectangle', 4, 4), frames.Front(), 0, 7)
    expect(bounds(front)?.min.y).toBeCloseTo(-7)
    expect(volume(front)).toBeCloseTo(112)
    // Reversed sweeps keep outward normals; flipping makes a hole.
    expect(volume(extrude(profile('rectangle', 4, 4), frames.Top(), 5, 0))).toBeCloseTo(80)
    expect(volume(flip(box))).toBeCloseTo(-1000)
    expect(volume(mirror(box, 'x'))).toBeCloseTo(1000)
  })
  it('revolves a profile about the frame axis', () => {
    const cylinder = revolve(profile('rectangle', 10, 8), frames.Top(), 360, 96)
    expect(volume(cylinder)).toBeCloseTo(Math.PI * 25 * 8, 0)
    const half = revolve(profile('rectangle', 10, 8), frames.Top(), 180, 96)
    expect(volume(half)).toBeCloseTo((Math.PI * 25 * 8) / 2, 0)
  })
})

describe('slicing', () => {
  it('cuts a box into one loop per layer and hatches its interior', () => {
    const box = extrude(profile('rectangle', 20, 10), frames.Top(), 0, 5)
    const loops = chainLoops(sliceMesh(box, 2.5))
    expect(loops).toHaveLength(1)
    expect(Math.abs(polygonArea(loops[0]))).toBeCloseTo(200)
    expect(sliceMesh(box, 7)).toHaveLength(0)
    const inner = offsetPolygon(loops[0], 1)
    expect(Math.abs(polygonArea(inner))).toBeCloseTo(18 * 8)
    expect(offsetPolygon(loops[0], 6)).toEqual([])
    const lines = hatch([loops[0]], 2, 0)
    expect(lines.length).toBeGreaterThanOrEqual(4)
    for (const [a, b] of lines) expect(Math.abs(b.x - a.x)).toBeCloseTo(20)
    // A hole inside the box leaves the hatch lines split around it.
    const hole = flip(extrude(profile('rectangle', 4, 4), frames.Top(), 0, 5))
    const withHole = chainLoops(sliceMesh([...box, ...hole], 2.5))
    expect(withHole).toHaveLength(2)
    const split = hatch(withHole, 2, 0)
    expect(split.some(([a, b]) => Math.abs(b.x - a.x) < 9)).toBe(true)
  })
})

describe('meshes on disk', () => {
  it('round-trips binary STL, reads ASCII STL, and decimates to a budget', async () => {
    const box = extrude(profile('rectangle', 20, 10), frames.Top(), 0, 5)
    const back = parseStl(await toStl(box, 'box').arrayBuffer())
    expect(triangleCount(back)).toBe(12)
    expect(volume(back)).toBeCloseTo(1000)
    const ascii = `solid a\n facet normal 0 0 1\n  outer loop\n   vertex 0 0 0\n   vertex 1 0 0\n   vertex 0 1 0\n  endloop\n endfacet\nendsolid a\n`
    expect(triangleCount(parseStl(new TextEncoder().encode(ascii).buffer as ArrayBuffer))).toBe(1)
    expect(() => parseStl(new TextEncoder().encode('hello').buffer as ArrayBuffer)).toThrow()
    const fine = revolve(profile('circle', 20, 20, 64), frames.Top(), 360, 128)
    const coarse = decimate(fine, 500)
    expect(triangleCount(coarse)).toBeLessThanOrEqual(500)
    expect(triangleCount(coarse)).toBeGreaterThan(50)
    const grounded = settle(extrude(profile('rectangle', 4, 4), frames.Top(), 10, 14))
    expect(bounds(grounded)).toEqual({ min: { x: -2, y: -2, z: 0 }, max: { x: 2, y: 2, z: 4 } })
  })
})

describe('camera', () => {
  it('fits a mesh into the viewport for any standard view', () => {
    const box = extrude(profile('rectangle', 100, 50), frames.Top(), 0, 20)
    for (const view of Object.values(VIEWS)) {
      const cam = fitCamera(box, { ...view, scale: 1, pan: { x: 0, y: 0 } }, 800, 600)
      expect(cam.scale).toBeGreaterThan(0)
      expect(cam.scale).toBeLessThanOrEqual(800 / 50)
    }
  })
})
