import { describe, expect, it } from 'vitest'
import { intersect, subtract, tagged, union } from './csg'
import {
  bounds,
  chainLoops,
  extrude,
  frames,
  loft,
  profile,
  roundCorners,
  chamferCorners,
  sliceMesh,
  sweepPath,
  triangulate,
  triangleCount,
  centroid,
  rotateAxis,
  vec,
  volume,
  polygonArea,
} from './geometry'

const box = (w: number, d: number, h: number, z = 0) =>
  extrude(profile('rectangle', w, d), frames.Top(z), 0, h)
const cylinder = (diameter: number, h: number, z = 0) =>
  extrude(profile('circle', diameter, diameter, 48), frames.Top(z), 0, h)

describe('csg', () => {
  it('unions, subtracts, and intersects closed solids with the right volumes', () => {
    const a = tagged(box(20, 20, 10), 'a')
    const b = tagged(box(20, 20, 10, 5), 'b')
    const u = union(a, b)
    expect(volume(u.mesh)).toBeCloseTo(20 * 20 * 15, 3)
    expect(bounds(u.mesh)).toEqual({ min: { x: -10, y: -10, z: 0 }, max: { x: 10, y: 10, z: 15 } })
    const s = subtract(a, b)
    expect(volume(s.mesh)).toBeCloseTo(20 * 20 * 5, 3)
    const i = intersect(a, b)
    expect(volume(i.mesh)).toBeCloseTo(20 * 20 * 5, 3)
    expect(u.tags).toHaveLength(triangleCount(u.mesh))
    expect(new Set(u.tags)).toEqual(new Set(['a', 'b']))
  })
  it('drills a real hole: the cylinder wall keeps the hole tag and slicing sees two loops', () => {
    const plate = tagged(box(40, 30, 6), 'plate')
    const hole = tagged(cylinder(8, 20, -5), 'hole')
    const drilled = subtract(plate, hole)
    expect(volume(drilled.mesh)).toBeCloseTo(40 * 30 * 6 - Math.PI * 16 * 6, -1)
    expect(drilled.tags).toContain('hole')
    expect(drilled.tags).toContain('plate')
    const loops = chainLoops(sliceMesh(drilled.mesh, 3))
    expect(loops).toHaveLength(2)
    const areas = loops.map((l) => Math.abs(polygonArea(l))).sort((p, q) => p - q)
    expect(areas[0]).toBeCloseTo(Math.PI * 16, 0)
    expect(areas[1]).toBeCloseTo(1200, 0)
    // Disjoint solids do not disturb each other.
    const far = subtract(plate, tagged(cylinder(8, 20, 50), 'far'))
    expect(volume(far.mesh)).toBeCloseTo(40 * 30 * 6, 3)
  })
  it('stays fast enough for a part with a few dozen features', () => {
    let body = tagged(box(120, 80, 8), 'base')
    const started = performance.now()
    for (let i = 0; i < 24; i++) {
      const x = -50 + (i % 6) * 20
      const y = -30 + Math.floor(i / 6) * 20
      const cutter = cylinder(5, 20, -5).map((n, k) =>
        k % 3 === 0 ? n + x : k % 3 === 1 ? n + y : n,
      )
      body = subtract(body, tagged(cutter, `hole${i}`))
    }
    // Generous on purpose: this guards against a pathological blow-up, not a slow runner.
    // Measured ~6 s locally and ~7 s on the GitHub runner in September 2026.
    expect(performance.now() - started).toBeLessThan(20000)
    expect(volume(body.mesh)).toBeCloseTo(120 * 80 * 8 - 24 * Math.PI * 6.25 * 8, -2)
  }, 30000)
})

describe('general extrusion', () => {
  it('triangulates concave profiles and profiles with holes', () => {
    const L: { x: number; y: number }[] = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 5 },
      { x: 5, y: 5 },
      { x: 5, y: 20 },
      { x: 0, y: 20 },
    ]
    const tris = triangulate(L)
    expect(tris.length).toBe(L.length - 2)
    const area = tris.reduce((a, t) => a + Math.abs(polygonArea(t)), 0)
    expect(area).toBeCloseTo(100 + 75)
    const solid = extrude(L, frames.Top(), 0, 3)
    expect(volume(solid)).toBeCloseTo(175 * 3)
    const ring = extrude(profile('rectangle', 20, 20), frames.Top(), 0, 4, {
      holes: [profile('circle', 10, 10, 32)],
    })
    expect(volume(ring)).toBeCloseTo((400 - Math.PI * 25) * 4, -1)
    const loops = chainLoops(sliceMesh(ring, 2))
    expect(loops).toHaveLength(2)
  })
  it('drafts, fillets, and chamfers change the volume the way they should', () => {
    const plain = volume(box(20, 20, 10))
    const drafted = extrude(profile('rectangle', 20, 20), frames.Top(), 0, 10, { draft: 10 })
    expect(volume(drafted)).toBeLessThan(plain)
    expect(volume(drafted)).toBeGreaterThan(plain * 0.6)
    const b = bounds(drafted)!
    expect(b.max.z).toBeCloseTo(10)
    const rounded = extrude(profile('rectangle', 20, 20), frames.Top(), 0, 10, { topFillet: 3 })
    // A fillet removes (1 − π/4) r² per unit length of edge.
    expect(volume(rounded)).toBeCloseTo(plain - (1 - Math.PI / 4) * 9 * 80, -2)
    const bevelled = extrude(profile('rectangle', 20, 20), frames.Top(), 0, 10, { topChamfer: 2 })
    // The bevelled top is a frustum from 20 × 20 at z = 8 to 16 × 16 at z = 10.
    expect(volume(bevelled)).toBeCloseTo(plain - (800 - (2 / 3) * (400 + 256 + 320)), 1)
    const corners = extrude(profile('rectangle', 20, 20), frames.Top(), 0, 10, {
      cornerFillet: 4,
      segments: 16,
    })
    expect(volume(corners)).toBeCloseTo(plain - (1 - Math.PI / 4) * 16 * 4 * 10, -1)
    expect(roundCorners(profile('rectangle', 10, 10), 2, 4)).toHaveLength(20)
    expect(chamferCorners(profile('rectangle', 10, 10), 1)).toHaveLength(8)
    expect(polygonArea(chamferCorners(profile('rectangle', 10, 10), 1))).toBeCloseTo(100 - 2)
  })
  it('lofts, sweeps, and rotates about any axis', () => {
    const cone = loft(
      profile('circle', 20, 20, 48),
      frames.Top(),
      profile('circle', 20, 20, 48),
      frames.Top(10),
      48,
    )
    expect(volume(cone)).toBeCloseTo(Math.PI * 100 * 10, -2)
    const square2circle = loft(
      profile('rectangle', 20, 20),
      frames.Top(),
      profile('circle', 10, 10, 48),
      frames.Top(10),
      48,
    )
    expect(volume(square2circle)).toBeGreaterThan(Math.PI * 25 * 10)
    expect(volume(square2circle)).toBeLessThan(400 * 10)
    const pipe = sweepPath(
      profile('circle', 4, 4, 24),
      [vec(0, 0, 0), vec(30, 0, 0), vec(30, 30, 0)],
      {
        origin: vec(0, 0, 0),
        u: vec(0, 1, 0),
        v: vec(0, 0, 1),
        normal: vec(1, 0, 0),
      },
    )
    expect(volume(pipe)).toBeCloseTo(Math.PI * 4 * 60, -2)
    const turned = rotateAxis(box(10, 10, 10), vec(0, 0, 1), 90)
    expect(volume(turned)).toBeCloseTo(1000)
    const tipped = rotateAxis(box(10, 4, 2), vec(1, 0, 0), 90)
    const tb = bounds(tipped)!
    expect(tb.max.y - tb.min.y).toBeCloseTo(2)
    expect(tb.max.z - tb.min.z).toBeCloseTo(4)
    expect(centroid(box(10, 10, 10)).z).toBeCloseTo(5)
  })
})
