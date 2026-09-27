// A small, honest geometry layer shared by the modeler, the slicer, and the painter. Solids are
// triangle meshes; sketches are closed 2D profiles (any simple polygon, with holes) that
// extrude, revolve, loft, or sweep into meshes; slicing cuts a mesh with horizontal planes and
// chains the pieces into loops. Booleans live next door in `csg.ts`. Nothing here is a
// boundary-representation kernel, but every number the apps show is computed from real
// geometry, and every mesh they export is a closed solid.

export type Vec3 = { x: number; y: number; z: number }
export type Vec2 = { x: number; y: number }
/** A closed 2D loop, vertices in order. */
export type Polygon = Vec2[]
/** Flat triangle soup: nine numbers (x y z × 3) per triangle. JSON-friendly by design. */
export type Mesh = number[]
export type Bounds = { min: Vec3; max: Vec3 }

// --- Vectors ------------------------------------------------------------------------------------
export const vec = (x: number, y: number, z: number): Vec3 => ({ x, y, z })
export const sub = (a: Vec3, b: Vec3): Vec3 => vec(a.x - b.x, a.y - b.y, a.z - b.z)
export const cross = (a: Vec3, b: Vec3): Vec3 =>
  vec(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x)
export const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z
export const length = (a: Vec3) => Math.hypot(a.x, a.y, a.z)
export function normalize(a: Vec3): Vec3 {
  const l = length(a)
  return l ? vec(a.x / l, a.y / l, a.z / l) : vec(0, 0, 1)
}

// --- Profiles -----------------------------------------------------------------------------------
export type ProfileShape = 'rectangle' | 'circle' | 'slot' | 'polygon'
/** A closed profile centred on the origin, counter-clockwise. Curves are polygonised. */
export function profile(
  shape: ProfileShape,
  width: number,
  height: number,
  segments = 48,
): Polygon {
  const w = width / 2
  const h = height / 2
  switch (shape) {
    case 'rectangle':
      return [
        { x: -w, y: -h },
        { x: w, y: -h },
        { x: w, y: h },
        { x: -w, y: h },
      ]
    case 'circle':
      return arc(0, 0, w, h, 0, Math.PI * 2, segments, false)
    case 'polygon': {
      const n = 6
      return arc(0, 0, w, h, Math.PI / 6, Math.PI / 6 + Math.PI * 2, n, false)
    }
    case 'slot': {
      // A stadium: two semicircles joined by straight sides along the longer dimension.
      const along = width >= height
      const r = Math.min(w, h)
      const run = Math.max(w, h) - r
      const half = Math.max(1, Math.round(segments / 2))
      const a = along
        ? arc(run, 0, r, r, -Math.PI / 2, Math.PI / 2, half, true)
        : arc(0, run, r, r, 0, Math.PI, half, true)
      const b = along
        ? arc(-run, 0, r, r, Math.PI / 2, (Math.PI * 3) / 2, half, true)
        : arc(0, -run, r, r, Math.PI, Math.PI * 2, half, true)
      return [...a, ...b]
    }
  }
}
function arc(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  from: number,
  to: number,
  segments: number,
  inclusive: boolean,
): Polygon {
  const count = inclusive ? segments + 1 : segments
  const out: Polygon = []
  for (let i = 0; i < count; i++) {
    const t = from + ((to - from) * i) / segments
    out.push({ x: cx + rx * Math.cos(t), y: cy + ry * Math.sin(t) })
  }
  return out
}
/** Signed shoelace area: positive for counter-clockwise loops. */
export function polygonArea(p: Polygon): number {
  let a = 0
  for (let i = 0, j = p.length - 1; i < p.length; j = i++)
    a += (p[j].x + p[i].x) * (p[i].y - p[j].y)
  return a / 2
}
export function polygonPerimeter(p: Polygon): number {
  let l = 0
  for (let i = 0, j = p.length - 1; i < p.length; j = i++)
    l += Math.hypot(p[i].x - p[j].x, p[i].y - p[j].y)
  return l
}
export function polygonCentroid(p: Polygon): Vec2 {
  let x = 0
  let y = 0
  for (const v of p) {
    x += v.x
    y += v.y
  }
  return p.length ? { x: x / p.length, y: y / p.length } : { x: 0, y: 0 }
}

// --- Meshes from profiles -----------------------------------------------------------------------
/**
 * Where a sketch lies: its plane's frame, with `normal` = u × v the direction an extrusion
 * grows. Right-handed, so sweeps keep outward windings.
 */
export type Frame = { origin: Vec3; u: Vec3; v: Vec3; normal: Vec3 }
export const frames = {
  /** XY plane at z = 0; extrusions grow up. */
  Top: (offset = 0): Frame => ({
    origin: vec(0, 0, offset),
    u: vec(1, 0, 0),
    v: vec(0, 1, 0),
    normal: vec(0, 0, 1),
  }),
  /** XZ plane at y = 0; extrusions grow toward −Y, toward the viewer of a front view. */
  Front: (offset = 0): Frame => ({
    origin: vec(0, -offset, 0),
    u: vec(1, 0, 0),
    v: vec(0, 0, 1),
    normal: vec(0, -1, 0),
  }),
  /** YZ plane at x = 0; extrusions grow toward +X. */
  Right: (offset = 0): Frame => ({
    origin: vec(offset, 0, 0),
    u: vec(0, 1, 0),
    v: vec(0, 0, 1),
    normal: vec(1, 0, 0),
  }),
}
export type PlaneName = keyof typeof frames
const place = (f: Frame, p: Vec2, along: number): Vec3 =>
  vec(
    f.origin.x + f.u.x * p.x + f.v.x * p.y + f.normal.x * along,
    f.origin.y + f.u.y * p.x + f.v.y * p.y + f.normal.y * along,
    f.origin.z + f.u.z * p.x + f.v.z * p.y + f.normal.z * along,
  )
function pushTriangle(mesh: Mesh, a: Vec3, b: Vec3, c: Vec3) {
  mesh.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z)
}
/** Extra shaping for an extrusion; everything defaults to a plain prism. */
export type ExtrudeOptions = {
  /** Inner loops cut out of the profile (drawn in the same plane space). */
  holes?: Polygon[]
  /** Side walls lean inward by this many degrees toward the `to` end. */
  draft?: number
  /** Round the edges where the walls meet the `to` cap, by this radius. */
  topFillet?: number
  /** Round the edges where the walls meet the `from` cap. */
  bottomFillet?: number
  /** Bevel the `to` edges by this distance instead of rounding them. */
  topChamfer?: number
  bottomChamfer?: number
  /** Round the vertical edges (the profile's corners) by this radius. */
  cornerFillet?: number
  cornerChamfer?: number
  segments?: number
}
/**
 * Sweep a profile (any simple polygon, with holes) along its frame's normal from `from` to
 * `to`, both distances along the normal. Draft, edge fillets, and chamfers are levels of the
 * same sweep: each is a ring inset from the profile at some height, stitched to its neighbours.
 */
export function extrude(
  poly: Polygon,
  frame: Frame,
  from: number,
  to: number,
  options: ExtrudeOptions = {},
): Mesh {
  const segments = options.segments ?? 8
  let outer = polygonArea(poly) >= 0 ? poly : [...poly].reverse()
  let holes = (options.holes ?? []).map((h) => (polygonArea(h) <= 0 ? h : [...h].reverse()))
  if (options.cornerFillet) {
    outer = roundCorners(outer, options.cornerFillet, segments)
    holes = holes.map((h) => roundCorners(h, options.cornerFillet!, segments))
  } else if (options.cornerChamfer) {
    outer = chamferCorners(outer, options.cornerChamfer)
    holes = holes.map((h) => chamferCorners(h, options.cornerChamfer!))
  }
  const depth = Math.abs(to - from)
  const lean = Math.tan(((options.draft ?? 0) * Math.PI) / 180)
  // Each level is an inset from the profile at a distance along the sweep, 0 = from, 1 = to.
  const levels: { at: number; inset: number }[] = []
  const bottom = Math.min(depth / 2, options.bottomFillet ?? options.bottomChamfer ?? 0)
  const top = Math.min(depth / 2, options.topFillet ?? options.topChamfer ?? 0)
  if (bottom > 0 && options.bottomFillet)
    for (let i = 0; i <= segments; i++) {
      const phi = (Math.PI / 2) * (1 - i / segments)
      levels.push({ at: bottom - bottom * Math.sin(phi), inset: bottom - bottom * Math.cos(phi) })
    }
  else if (bottom > 0) levels.push({ at: 0, inset: bottom }, { at: bottom, inset: 0 })
  else levels.push({ at: 0, inset: 0 })
  if (top > 0 && options.topFillet)
    for (let i = 0; i <= segments; i++) {
      const phi = ((Math.PI / 2) * i) / segments
      levels.push({
        at: depth - top + top * Math.sin(phi),
        inset: top - top * Math.cos(phi),
      })
    }
  else if (top > 0) levels.push({ at: depth - top, inset: 0 }, { at: depth, inset: top })
  else levels.push({ at: depth, inset: 0 })
  const rings = levels.map(({ at, inset }) => {
    const d = inset + at * lean
    return {
      along: from + (to >= from ? at : -at),
      outer: d ? offsetPolygon(outer, d) : outer,
      // Holes wind the other way, so the same inset moves their walls outward.
      holes: holes.map((h) => (d ? offsetPolygon(h, -d) : h)),
    }
  })
  const mesh = sweepLevels(rings, frame)
  return to < from ? flip(mesh) : mesh
}
type Level = { along: number; outer: Polygon; holes: Polygon[] }
/**
 * Stitch consecutive levels (an outer ring and hole rings, all with the vertex counts of the
 * first level) into walls, and cap the two ends. A level whose ring collapsed ends the sweep
 * there, capped. Outer rings wind counter-clockwise, holes clockwise, so the same quad code
 * faces outward on the boundary and inward on holes.
 */
function sweepLevels(levels: Level[], frame: Frame): Mesh {
  const mesh: Mesh = []
  const usable: Level[] = []
  for (const l of levels) {
    if (l.outer.length < 3 || l.outer.length !== levels[0].outer.length) break
    if (l.holes.some((h, i) => h.length !== levels[0].holes[i].length)) break
    usable.push(l)
  }
  if (usable.length < 2) return mesh
  const ring = (l: Level, poly: Polygon) => poly.map((p) => place(frame, p, l.along))
  const wall = (a: Vec3[], b: Vec3[]) => {
    const n = a.length
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n
      pushTriangle(mesh, a[i], a[j], b[j])
      pushTriangle(mesh, a[i], b[j], b[i])
    }
  }
  for (let k = 0; k + 1 < usable.length; k++) {
    const lo = usable[k]
    const hi = usable[k + 1]
    wall(ring(lo, lo.outer), ring(hi, hi.outer))
    lo.holes.forEach((h, i) => wall(ring(lo, h), ring(hi, hi.holes[i])))
  }
  const first = usable[0]
  const last = usable[usable.length - 1]
  for (const [a, b, c] of triangulate(first.outer, first.holes)) {
    const [pa, pb, pc] = [a, b, c].map((p) => place(frame, p, first.along))
    pushTriangle(mesh, pa, pc, pb)
  }
  for (const [a, b, c] of triangulate(last.outer, last.holes)) {
    const [pa, pb, pc] = [a, b, c].map((p) => place(frame, p, last.along))
    pushTriangle(mesh, pa, pb, pc)
  }
  return mesh
}
/**
 * Stitch 3D rings with equal vertex counts into a closed solid: lofts, sweeps, and anything
 * else that is a tube with two caps. Rings must wind consistently when seen from the end.
 */
export function loftRings(rings: Vec3[][]): Mesh {
  const mesh: Mesh = []
  if (rings.length < 2 || rings.some((r) => r.length !== rings[0].length || r.length < 3))
    return mesh
  const n = rings[0].length
  for (let k = 0; k + 1 < rings.length; k++)
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n
      pushTriangle(mesh, rings[k][i], rings[k][j], rings[k + 1][j])
      pushTriangle(mesh, rings[k][i], rings[k + 1][j], rings[k + 1][i])
    }
  const first = rings[0]
  const last = rings[rings.length - 1]
  for (let i = 1; i < n - 1; i++) {
    pushTriangle(mesh, first[0], first[i + 1], first[i])
    pushTriangle(mesh, last[0], last[i], last[i + 1])
  }
  return mesh
}
/** A profile at each of two frames, lofted between them; the profiles are resampled to match. */
export function loft(a: Polygon, frameA: Frame, b: Polygon, frameB: Frame, segments = 48): Mesh {
  const n = Math.max(a.length, b.length, segments)
  const ra = resample(polygonArea(a) >= 0 ? a : [...a].reverse(), n)
  const rb = resample(polygonArea(b) >= 0 ? b : [...b].reverse(), n)
  const mesh = loftRings([ra.map((p) => place(frameA, p, 0)), rb.map((p) => place(frameB, p, 0))])
  return volume(mesh) < 0 ? flip(mesh) : mesh
}
/**
 * Sweep a profile along a polyline path. The profile's plane is kept perpendicular to the path,
 * turned at each vertex by the bisector of the two segments (a mitre), starting from `frame`.
 */
export function sweepPath(poly: Polygon, path: Vec3[], frame: Frame): Mesh {
  if (path.length < 2) return []
  const ring = polygonArea(poly) >= 0 ? poly : [...poly].reverse()
  let u = frame.u
  let v = frame.v
  const rings: Vec3[][] = []
  const dirs = path.slice(1).map((p, i) => normalize(sub(p, path[i])))
  for (let i = 0; i < path.length; i++) {
    const before = dirs[Math.max(0, i - 1)]
    const after = dirs[Math.min(dirs.length - 1, i)]
    const d = normalize(vec(before.x + after.x, before.y + after.y, before.z + after.z))
    // Parallel transport: keep u as close as possible to the previous u while staying ⟂ d.
    const du = dot(u, d)
    u = normalize(vec(u.x - d.x * du, u.y - d.y * du, u.z - d.z * du))
    if (length(u) < 1e-6) u = normalize(cross(d, frame.v))
    v = normalize(cross(d, u))
    // At a corner the ring lies in the mitre plane, stretched across the turn so the bore is
    // the same on both legs: the stretch is 1 / cos(half the turn) along the turn's direction.
    const turn = normalize(sub(after, before))
    const stretch = 1 / Math.max(0.2, dot(d, before)) - 1
    const o = path[i]
    rings.push(
      ring.map((p) => {
        const q = vec(u.x * p.x + v.x * p.y, u.y * p.x + v.y * p.y, u.z * p.x + v.z * p.y)
        const along = stretch ? dot(q, turn) * stretch : 0
        return vec(
          o.x + q.x + turn.x * along,
          o.y + q.y + turn.y * along,
          o.z + q.z + turn.z * along,
        )
      }),
    )
  }
  const mesh = loftRings(rings)
  return volume(mesh) < 0 ? flip(mesh) : mesh
}
/** `n` points spread evenly along the loop by arc length, starting at the first vertex. */
export function resample(poly: Polygon, n: number): Polygon {
  const total = polygonPerimeter(poly)
  if (poly.length < 2 || total <= 0) return poly
  const out: Polygon = []
  let i = 0
  let travelled = 0
  let edge = Math.hypot(poly[1 % poly.length].x - poly[0].x, poly[1 % poly.length].y - poly[0].y)
  for (let k = 0; k < n; k++) {
    const target = (total * k) / n
    while (travelled + edge < target - 1e-9 && i < poly.length) {
      travelled += edge
      i++
      const a = poly[i % poly.length]
      const b = poly[(i + 1) % poly.length]
      edge = Math.hypot(b.x - a.x, b.y - a.y)
    }
    const a = poly[i % poly.length]
    const b = poly[(i + 1) % poly.length]
    const t = edge ? (target - travelled) / edge : 0
    out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
  }
  return out
}

// --- Profile corners ------------------------------------------------------------------------------
/** Replace every corner with a tangent arc of the given radius, shrunk where edges are short. */
export function roundCorners(poly: Polygon, radius: number, segments = 8): Polygon {
  const n = poly.length
  if (n < 3 || radius <= 0) return poly
  const out: Polygon = []
  for (let i = 0; i < n; i++) {
    const prev = poly[(i + n - 1) % n]
    const cur = poly[i]
    const next = poly[(i + 1) % n]
    const a = { x: prev.x - cur.x, y: prev.y - cur.y }
    const b = { x: next.x - cur.x, y: next.y - cur.y }
    const la = Math.hypot(a.x, a.y)
    const lb = Math.hypot(b.x, b.y)
    if (la < 1e-9 || lb < 1e-9) continue
    const cosT = Math.max(-1, Math.min(1, (a.x * b.x + a.y * b.y) / (la * lb)))
    const theta = Math.acos(cosT)
    if (theta > Math.PI - 1e-4 || theta < 1e-4) {
      out.push(cur)
      continue
    }
    // Tangent points sit d = r / tan(θ/2) from the corner along each edge; cap d at half an edge.
    const half = theta / 2
    let r = radius
    let d = r / Math.tan(half)
    const limit = Math.min(la, lb) / 2
    if (d > limit) {
      d = limit
      r = d * Math.tan(half)
    }
    const ua = { x: a.x / la, y: a.y / la }
    const ub = { x: b.x / lb, y: b.y / lb }
    const ta = { x: cur.x + ua.x * d, y: cur.y + ua.y * d }
    const tb = { x: cur.x + ub.x * d, y: cur.y + ub.y * d }
    // The arc centre lies along the bisector at r / sin(θ/2) from the corner.
    const bis = { x: ua.x + ub.x, y: ua.y + ub.y }
    const lbis = Math.hypot(bis.x, bis.y) || 1
    const cx = cur.x + (bis.x / lbis) * (r / Math.sin(half))
    const cy = cur.y + (bis.y / lbis) * (r / Math.sin(half))
    const a0 = Math.atan2(ta.y - cy, ta.x - cx)
    let a1 = Math.atan2(tb.y - cy, tb.x - cx)
    const turn = ua.x * ub.y - ua.y * ub.x
    // Sweep the short way round, in the direction the corner turns.
    if (turn > 0 && a1 > a0) a1 -= Math.PI * 2
    if (turn < 0 && a1 < a0) a1 += Math.PI * 2
    for (let k = 0; k <= segments; k++) {
      const t = a0 + ((a1 - a0) * k) / segments
      out.push({ x: cx + r * Math.cos(t), y: cy + r * Math.sin(t) })
    }
  }
  return out
}
/** Cut every corner back by `distance` along both edges. */
export function chamferCorners(poly: Polygon, distance: number): Polygon {
  const n = poly.length
  if (n < 3 || distance <= 0) return poly
  const out: Polygon = []
  for (let i = 0; i < n; i++) {
    const prev = poly[(i + n - 1) % n]
    const cur = poly[i]
    const next = poly[(i + 1) % n]
    const la = Math.hypot(prev.x - cur.x, prev.y - cur.y)
    const lb = Math.hypot(next.x - cur.x, next.y - cur.y)
    const d = Math.min(distance, la / 2, lb / 2)
    if (la < 1e-9 || lb < 1e-9) continue
    out.push({ x: cur.x + ((prev.x - cur.x) / la) * d, y: cur.y + ((prev.y - cur.y) / la) * d })
    out.push({ x: cur.x + ((next.x - cur.x) / lb) * d, y: cur.y + ((next.y - cur.y) / lb) * d })
  }
  return out
}

// --- Triangulation --------------------------------------------------------------------------------
export type Triangle2 = [Vec2, Vec2, Vec2]
/**
 * Ear-clipping triangulation of a simple polygon with holes. Holes are bridged into the outer
 * loop first (each from its rightmost vertex to the visible outer vertex), then ears are clipped.
 * Convex loops without holes take the fast fan.
 */
export function triangulate(outer: Polygon, holes: Polygon[] = []): Triangle2[] {
  let ring = polygonArea(outer) >= 0 ? outer : [...outer].reverse()
  ring = ring.filter((p, i) => {
    const q = ring[(i + 1) % ring.length]
    return Math.hypot(p.x - q.x, p.y - q.y) > 1e-9
  })
  if (ring.length < 3) return []
  const inner = holes
    .filter((h) => h.length >= 3 && Math.abs(polygonArea(h)) > 1e-9)
    .map((h) => (polygonArea(h) <= 0 ? h : [...h].reverse()))
    .sort((a, b) => Math.max(...b.map((p) => p.x)) - Math.max(...a.map((p) => p.x)))
  if (!inner.length && isConvex(ring)) {
    const out: Triangle2[] = []
    for (let i = 1; i < ring.length - 1; i++) out.push([ring[0], ring[i], ring[i + 1]])
    return out
  }
  for (const hole of inner) ring = bridge(ring, hole)
  return clipEars(ring)
}
function isConvex(poly: Polygon): boolean {
  const n = poly.length
  for (let i = 0; i < n; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % n]
    const c = poly[(i + 2) % n]
    if ((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x) < -1e-9) return false
  }
  return true
}
/** Splice a clockwise hole into a counter-clockwise outer loop with a two-way bridge edge. */
function bridge(outer: Polygon, hole: Polygon): Polygon {
  let m = 0
  for (let i = 1; i < hole.length; i++) if (hole[i].x > hole[m].x) m = i
  const M = hole[m]
  // The closest outer edge crossed by a ray to the right of M.
  let best = Infinity
  let hit = -1
  let point: Vec2 = M
  for (let i = 0; i < outer.length; i++) {
    const a = outer[i]
    const b = outer[(i + 1) % outer.length]
    if (a.y > M.y === b.y > M.y) continue
    const x = a.x + ((M.y - a.y) / (b.y - a.y)) * (b.x - a.x)
    if (x >= M.x - 1e-9 && x < best) {
      best = x
      hit = i
      point = { x, y: M.y }
    }
  }
  if (hit < 0) return outer
  const a = outer[hit]
  const b = outer[(hit + 1) % outer.length]
  let p = a.x > b.x ? hit : (hit + 1) % outer.length
  // If a reflex outer vertex sits inside triangle M-I-P, connect to the one closest in angle.
  const P = outer[p]
  let bestAngle = Infinity
  for (let i = 0; i < outer.length; i++) {
    const q = outer[i]
    if (i === p || q.x < M.x) continue
    if (!inTri(q, M, point, P)) continue
    const angle = Math.abs(Math.atan2(q.y - M.y, q.x - M.x))
    if (angle < bestAngle) {
      bestAngle = angle
      p = i
    }
  }
  const rotated = [...hole.slice(m), ...hole.slice(0, m)]
  return [...outer.slice(0, p + 1), ...rotated, hole[m], outer[p], ...outer.slice(p + 1)]
}
function inTri(q: Vec2, a: Vec2, b: Vec2, c: Vec2): boolean {
  const s = (a.y - c.y) * (q.x - c.x) + (c.x - a.x) * (q.y - c.y)
  const t = (c.y - b.y) * (q.x - c.x) + (b.x - c.x) * (q.y - c.y)
  const area = (a.y - c.y) * (b.x - c.x) + (c.x - a.x) * (b.y - c.y)
  if (Math.abs(area) < 1e-12) return false
  const sign = area < 0 ? -1 : 1
  return s * sign > 1e-9 && t * sign > 1e-9 && (s + t) * sign < area * sign - 1e-9
}
function clipEars(poly: Polygon): Triangle2[] {
  const out: Triangle2[] = []
  const idx = poly.map((_, i) => i)
  const cross2 = (a: Vec2, b: Vec2, c: Vec2) =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
  let guard = 0
  while (idx.length > 3 && guard++ < 20000) {
    let clipped = false
    for (let k = 0; k < idx.length; k++) {
      const ia = idx[(k + idx.length - 1) % idx.length]
      const ib = idx[k]
      const ic = idx[(k + 1) % idx.length]
      const a = poly[ia]
      const b = poly[ib]
      const c = poly[ic]
      if (cross2(a, b, c) <= 1e-12) continue
      let ear = true
      for (const io of idx) {
        if (io === ia || io === ib || io === ic) continue
        const q = poly[io]
        const same = (p: Vec2) => Math.abs(p.x - q.x) < 1e-9 && Math.abs(p.y - q.y) < 1e-9
        if (same(a) || same(b) || same(c)) continue
        if (inTri(q, a, b, c)) {
          ear = false
          break
        }
      }
      if (!ear) continue
      out.push([a, b, c])
      idx.splice(k, 1)
      clipped = true
      break
    }
    if (!clipped) {
      // Degenerate input (self-touching or collinear); clip the first convex corner and carry on.
      const k = idx.findIndex(
        (_, i) =>
          cross2(
            poly[idx[(i + idx.length - 1) % idx.length]],
            poly[idx[i]],
            poly[idx[(i + 1) % idx.length]],
          ) > 0,
      )
      if (k < 0) break
      out.push([
        poly[idx[(k + idx.length - 1) % idx.length]],
        poly[idx[k]],
        poly[idx[(k + 1) % idx.length]],
      ])
      idx.splice(k, 1)
    }
  }
  if (idx.length === 3) out.push([poly[idx[0]], poly[idx[1]], poly[idx[2]]])
  return out
}

/**
 * Revolve a profile drawn in its frame (profile x = radius, profile y = height) about the
 * frame's v axis through the origin, by `angle` degrees. Points at radius 0 collapse cleanly.
 */
export function revolve(poly: Polygon, frame: Frame, angle = 360, segments = 48): Mesh {
  const mesh: Mesh = []
  const sweep = (Math.min(360, Math.max(1, angle)) * Math.PI) / 180
  const steps = Math.max(3, Math.round((segments * sweep) / (Math.PI * 2)))
  const ring = polygonArea(poly) >= 0 ? poly : [...poly].reverse()
  const at = (p: Vec2, t: number): Vec3 => {
    const r = Math.max(0, p.x)
    return vec(
      frame.origin.x +
        frame.u.x * r * Math.cos(t) +
        frame.normal.x * r * Math.sin(t) +
        frame.v.x * p.y,
      frame.origin.y +
        frame.u.y * r * Math.cos(t) +
        frame.normal.y * r * Math.sin(t) +
        frame.v.y * p.y,
      frame.origin.z +
        frame.u.z * r * Math.cos(t) +
        frame.normal.z * r * Math.sin(t) +
        frame.v.z * p.y,
    )
  }
  const n = ring.length
  for (let s = 0; s < steps; s++) {
    const t0 = (sweep * s) / steps
    const t1 = (sweep * (s + 1)) / steps
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n
      pushTriangle(mesh, at(ring[i], t0), at(ring[j], t0), at(ring[j], t1))
      pushTriangle(mesh, at(ring[i], t0), at(ring[j], t1), at(ring[i], t1))
    }
  }
  if (sweep < Math.PI * 2 - 1e-9)
    for (let i = 1; i < n - 1; i++) {
      pushTriangle(mesh, at(ring[0], 0), at(ring[i + 1], 0), at(ring[i], 0))
      pushTriangle(mesh, at(ring[0], sweep), at(ring[i], sweep), at(ring[i + 1], sweep))
    }
  return mesh
}

// --- Mesh operations ----------------------------------------------------------------------------
export const triangleCount = (mesh: Mesh) => Math.floor(mesh.length / 9)
export function forEachTriangle(
  mesh: Mesh,
  fn: (a: Vec3, b: Vec3, c: Vec3, index: number) => void,
) {
  for (let i = 0, t = 0; i + 8 < mesh.length; i += 9, t++)
    fn(
      vec(mesh[i], mesh[i + 1], mesh[i + 2]),
      vec(mesh[i + 3], mesh[i + 4], mesh[i + 5]),
      vec(mesh[i + 6], mesh[i + 7], mesh[i + 8]),
      t,
    )
}
/** Reverse every triangle's winding, turning a solid into a hole (and back). */
export function flip(mesh: Mesh): Mesh {
  const out: Mesh = []
  for (let i = 0; i + 8 < mesh.length; i += 9)
    out.push(
      mesh[i],
      mesh[i + 1],
      mesh[i + 2],
      mesh[i + 6],
      mesh[i + 7],
      mesh[i + 8],
      mesh[i + 3],
      mesh[i + 4],
      mesh[i + 5],
    )
  return out
}
export function mapMesh(mesh: Mesh, fn: (p: Vec3) => Vec3): Mesh {
  const out: Mesh = []
  for (let i = 0; i + 2 < mesh.length; i += 3) {
    const p = fn(vec(mesh[i], mesh[i + 1], mesh[i + 2]))
    out.push(p.x, p.y, p.z)
  }
  return out
}
export const translate = (mesh: Mesh, d: Vec3) =>
  mapMesh(mesh, (p) => vec(p.x + d.x, p.y + d.y, p.z + d.z))
export const scaleMesh = (mesh: Mesh, s: number) =>
  mapMesh(mesh, (p) => vec(p.x * s, p.y * s, p.z * s))
/** Rotate about the Z axis by degrees, around the origin. */
export function rotateZ(mesh: Mesh, degrees: number): Mesh {
  if (!degrees) return mesh
  const t = (degrees * Math.PI) / 180
  const c = Math.cos(t)
  const s = Math.sin(t)
  return mapMesh(mesh, (p) => vec(p.x * c - p.y * s, p.x * s + p.y * c, p.z))
}
/** Rotate about an arbitrary axis through `origin` by degrees (Rodrigues' formula). */
export function rotateAxis(mesh: Mesh, axis: Vec3, degrees: number, origin = vec(0, 0, 0)): Mesh {
  if (!degrees) return mesh
  const k = normalize(axis)
  const t = (degrees * Math.PI) / 180
  const c = Math.cos(t)
  const s = Math.sin(t)
  return mapMesh(mesh, (p) => {
    const v = sub(p, origin)
    const kv = cross(k, v)
    const kd = dot(k, v)
    return vec(
      origin.x + v.x * c + kv.x * s + k.x * kd * (1 - c),
      origin.y + v.y * c + kv.y * s + k.y * kd * (1 - c),
      origin.z + v.z * c + kv.z * s + k.z * kd * (1 - c),
    )
  })
}
export const rotateX = (mesh: Mesh, degrees: number) => rotateAxis(mesh, vec(1, 0, 0), degrees)
export const rotateY = (mesh: Mesh, degrees: number) => rotateAxis(mesh, vec(0, 1, 0), degrees)
/** Scale each axis separately about the origin. */
export const scaleAxes = (mesh: Mesh, s: Vec3) =>
  mapMesh(mesh, (p) => vec(p.x * s.x, p.y * s.y, p.z * s.z))
/** Mirror across the plane through the origin whose normal is the given axis. */
export function mirror(mesh: Mesh, axis: 'x' | 'y' | 'z'): Mesh {
  return flip(mapMesh(mesh, (p) => ({ ...p, [axis]: -p[axis] })))
}
export function bounds(mesh: Mesh): Bounds | null {
  if (mesh.length < 3) return null
  const min = vec(Infinity, Infinity, Infinity)
  const max = vec(-Infinity, -Infinity, -Infinity)
  for (let i = 0; i + 2 < mesh.length; i += 3) {
    min.x = Math.min(min.x, mesh[i])
    min.y = Math.min(min.y, mesh[i + 1])
    min.z = Math.min(min.z, mesh[i + 2])
    max.x = Math.max(max.x, mesh[i])
    max.y = Math.max(max.y, mesh[i + 1])
    max.z = Math.max(max.z, mesh[i + 2])
  }
  return { min, max }
}
export const boundsSize = (b: Bounds): Vec3 => sub(b.max, b.min)
export const boundsCenter = (b: Bounds): Vec3 =>
  vec((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2)
/** Signed volume by the divergence theorem: positive for outward windings, negative for holes. */
export function volume(mesh: Mesh): number {
  let v = 0
  forEachTriangle(mesh, (a, b, c) => {
    v += dot(a, cross(b, c))
  })
  return v / 6
}
/** The centre of mass of a closed solid, summing signed tetrahedra from the origin. */
export function centroid(mesh: Mesh): Vec3 {
  let v = 0
  let x = 0
  let y = 0
  let z = 0
  forEachTriangle(mesh, (a, b, c) => {
    const t = dot(a, cross(b, c)) / 6
    v += t
    x += (t * (a.x + b.x + c.x)) / 4
    y += (t * (a.y + b.y + c.y)) / 4
    z += (t * (a.z + b.z + c.z)) / 4
  })
  return v ? vec(x / v, y / v, z / v) : vec(0, 0, 0)
}
/** Surface area of every triangle. */
export function surfaceArea(mesh: Mesh): number {
  let a = 0
  forEachTriangle(mesh, (p, q, r) => {
    a += length(cross(sub(q, p), sub(r, p))) / 2
  })
  return a
}
/** Round coordinates so a mesh stores compactly; 0.01 mm is finer than any printer. */
export const compact = (mesh: Mesh, decimals = 2): Mesh => {
  const k = 10 ** decimals
  return mesh.map((n) => Math.round(n * k) / k)
}
/** Move a mesh so its footprint is centred on the origin and it rests on z = 0. */
export function settle(mesh: Mesh): Mesh {
  const b = bounds(mesh)
  if (!b) return mesh
  const c = boundsCenter(b)
  return translate(mesh, vec(-c.x, -c.y, -b.min.z))
}

/**
 * Reduce a triangle soup to at most `maxTriangles` by clustering vertices on a grid and
 * dropping the triangles that collapse. Coarse, fast, and watertight enough to slice.
 */
export function decimate(mesh: Mesh, maxTriangles: number): Mesh {
  if (triangleCount(mesh) <= maxTriangles) return mesh
  const b = bounds(mesh)
  if (!b) return mesh
  const size = boundsSize(b)
  const longest = Math.max(size.x, size.y, size.z) || 1
  let cells = Math.ceil(Math.cbrt(maxTriangles) * 2)
  for (let attempt = 0; attempt < 12; attempt++) {
    const step = longest / cells
    const snap = (n: number, min: number) => min + Math.round((n - min) / step) * step
    const out: Mesh = []
    forEachTriangle(mesh, (a, c1, c2) => {
      const pts = [a, c1, c2].map((p) =>
        vec(snap(p.x, b.min.x), snap(p.y, b.min.y), snap(p.z, b.min.z)),
      )
      const same = (p: Vec3, q: Vec3) => p.x === q.x && p.y === q.y && p.z === q.z
      if (same(pts[0], pts[1]) || same(pts[1], pts[2]) || same(pts[0], pts[2])) return
      pushTriangle(out, pts[0], pts[1], pts[2])
    })
    if (triangleCount(out) <= maxTriangles) return out
    cells = Math.max(2, Math.floor(cells * 0.75))
  }
  return mesh.slice(0, maxTriangles * 9)
}

// --- STL ------------------------------------------------------------------------------------------
/** Parse binary or ASCII STL into a mesh. Throws a readable message for anything else. */
export function parseStl(data: ArrayBuffer): Mesh {
  const bytes = new Uint8Array(data)
  const head = new TextDecoder().decode(bytes.slice(0, Math.min(bytes.length, 512))).trimStart()
  const binarySize = bytes.length >= 84 ? 84 + new DataView(data).getUint32(80, true) * 50 : -1
  if (binarySize === bytes.length && !(head.startsWith('solid') && /facet\s+normal/i.test(head)))
    return parseBinaryStl(data)
  if (head.startsWith('solid')) return parseAsciiStl(new TextDecoder().decode(bytes))
  if (binarySize > 0 && Math.abs(binarySize - bytes.length) < 50) return parseBinaryStl(data)
  throw new Error('That file is not an STL mesh.')
}
function parseBinaryStl(data: ArrayBuffer): Mesh {
  const view = new DataView(data)
  const count = view.getUint32(80, true)
  const mesh: Mesh = []
  for (let i = 0; i < count; i++) {
    const at = 84 + i * 50 + 12
    if (at + 36 > data.byteLength) break
    for (let k = 0; k < 9; k++) mesh.push(view.getFloat32(at + k * 4, true))
  }
  return mesh
}
function parseAsciiStl(text: string): Mesh {
  const mesh: Mesh = []
  const re = /vertex\s+([-+\d.eE]+)\s+([-+\d.eE]+)\s+([-+\d.eE]+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) mesh.push(Number(m[1]), Number(m[2]), Number(m[3]))
  if (!mesh.length || mesh.length % 9) throw new Error('That STL file has incomplete triangles.')
  return mesh
}
/** Write a mesh as binary STL. */
export function toStl(mesh: Mesh, name = 'junga'): Blob {
  const count = triangleCount(mesh)
  const buffer = new ArrayBuffer(84 + count * 50)
  const view = new DataView(buffer)
  new Uint8Array(buffer).set(new TextEncoder().encode(name.slice(0, 79)))
  view.setUint32(80, count, true)
  forEachTriangle(mesh, (a, b, c, t) => {
    const n = normalize(cross(sub(b, a), sub(c, a)))
    const at = 84 + t * 50
    ;[n.x, n.y, n.z, a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z].forEach((v, k) =>
      view.setFloat32(at + k * 4, v, true),
    )
    view.setUint16(at + 48, 0, true)
  })
  return new Blob([buffer], { type: 'model/stl' })
}

// --- Slicing --------------------------------------------------------------------------------------
export type Segment = [Vec2, Vec2]
/** Cut a mesh with the plane z = height and return the unordered crossing segments. */
export function sliceMesh(mesh: Mesh, z: number): Segment[] {
  const segments: Segment[] = []
  forEachTriangle(mesh, (a, b, c) => {
    const points: Vec2[] = []
    for (const [p, q] of [
      [a, b],
      [b, c],
      [c, a],
    ] as const) {
      if ((p.z < z && q.z >= z) || (q.z < z && p.z >= z)) {
        const t = (z - p.z) / (q.z - p.z)
        points.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t })
      }
    }
    if (points.length === 2) segments.push([points[0], points[1]])
  })
  return segments
}
const key = (p: Vec2) => `${Math.round(p.x * 1000)},${Math.round(p.y * 1000)}`
/**
 * Join crossing segments end to end into closed loops. Exact matches chain first; the open
 * chains that remain (from T-junctions and rounding in imported or boolean meshes) are then
 * joined end to end within a small tolerance, and anything still open is kept as it is.
 */
export function chainLoops(segments: Segment[], tolerance = 0.05): Polygon[] {
  const byStart = new Map<string, Segment[]>()
  for (const s of segments) {
    const k = key(s[0])
    byStart.set(k, [...(byStart.get(k) ?? []), s])
  }
  const used = new Set<Segment>()
  const closed: Polygon[] = []
  const open: Polygon[] = []
  for (const start of segments) {
    if (used.has(start)) continue
    used.add(start)
    const loop: Polygon = [start[0]]
    let current = start
    let isClosed = false
    for (let guard = 0; guard < segments.length; guard++) {
      const candidates = (byStart.get(key(current[1])) ?? []).filter((s) => !used.has(s))
      const next = candidates[0]
      if (!next) break
      used.add(next)
      loop.push(next[0])
      current = next
      if (key(current[1]) === key(start[0])) {
        isClosed = true
        break
      }
    }
    if (isClosed) {
      if (loop.length >= 3) closed.push(loop)
    } else {
      loop.push(current[1])
      open.push(loop)
    }
  }
  // Stitch open chains whose ends nearly meet, either way round.
  const near = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y) <= tolerance
  while (open.length) {
    let chain = open.shift()!
    let grew = true
    while (grew) {
      grew = false
      const tail = chain[chain.length - 1]
      if (near(tail, chain[0]) && chain.length > 2) break
      for (let i = 0; i < open.length; i++) {
        const other = open[i]
        if (near(tail, other[0])) chain = [...chain, ...other.slice(1)]
        else if (near(tail, other[other.length - 1]))
          chain = [...chain, ...other.slice(0, -1).reverse()]
        else continue
        open.splice(i, 1)
        grew = true
        break
      }
    }
    if (chain.length > 2 && near(chain[chain.length - 1], chain[0])) chain.pop()
    if (chain.length >= 3) closed.push(chain)
  }
  return closed
}
/** Offset a loop inward by `distance` (outward for negative). Miter joins; fine for small offsets. */
export function offsetPolygon(poly: Polygon, distance: number): Polygon {
  const n = poly.length
  if (n < 3) return poly
  const inward = polygonArea(poly) >= 0 ? 1 : -1
  const out: Polygon = []
  for (let i = 0; i < n; i++) {
    const cur = poly[i]
    const n1 = edgeNormal(poly[(i + n - 1) % n], cur, inward)
    const n2 = edgeNormal(cur, poly[(i + 1) % n], inward)
    const bx = n1.x + n2.x
    const by = n1.y + n2.y
    const len = Math.hypot(bx, by)
    if (len < 1e-9) {
      out.push({ x: cur.x + n1.x * distance, y: cur.y + n1.y * distance })
      continue
    }
    // Along the bisector, reaching both offset edges takes distance / cos(half angle); the cap
    // keeps very sharp corners from shooting off.
    const miter = distance / Math.max(0.35, len / 2)
    out.push({ x: cur.x + (bx / len) * miter, y: cur.y + (by / len) * miter })
  }
  const area = polygonArea(out)
  return Math.abs(area) < 1e-6 || Math.sign(area) !== Math.sign(polygonArea(poly)) ? [] : out
}
function edgeNormal(a: Vec2, b: Vec2, inward: number): Vec2 {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const l = Math.hypot(dx, dy) || 1
  // For a counter-clockwise loop the interior is to the left of each edge.
  return { x: (-dy / l) * inward, y: (dx / l) * inward }
}
/**
 * Parallel lines at `angle` degrees, `spacing` apart, clipped to the region the loops enclose
 * (even-odd, so holes stay empty). Segments come back serpentine for short travels.
 */
export function hatch(loops: Polygon[], spacing: number, angle: number, phase = 0): Segment[] {
  if (!loops.length || spacing <= 0) return []
  const t = (angle * Math.PI) / 180
  const c = Math.cos(t)
  const s = Math.sin(t)
  const toLocal = (p: Vec2): Vec2 => ({ x: p.x * c + p.y * s, y: -p.x * s + p.y * c })
  const toWorld = (p: Vec2): Vec2 => ({ x: p.x * c - p.y * s, y: p.x * s + p.y * c })
  const local = loops.map((l) => l.map(toLocal))
  const vs = local.flatMap((l) => l.map((p) => p.y))
  const minV = Math.min(...vs)
  const maxV = Math.max(...vs)
  const out: Segment[] = []
  let flipDir = false
  const start = Math.floor(minV / spacing) * spacing + (phase % spacing)
  for (let v = start; v <= maxV; v += spacing) {
    const xs: number[] = []
    for (const l of local)
      for (let i = 0, j = l.length - 1; i < l.length; j = i++) {
        const a = l[j]
        const b = l[i]
        if ((a.y <= v && b.y > v) || (b.y <= v && a.y > v))
          xs.push(a.x + ((v - a.y) / (b.y - a.y)) * (b.x - a.x))
      }
    xs.sort((p, q) => p - q)
    const pairs: Segment[] = []
    for (let i = 0; i + 1 < xs.length; i += 2)
      if (xs[i + 1] - xs[i] > 1e-6)
        pairs.push([toWorld({ x: xs[i], y: v }), toWorld({ x: xs[i + 1], y: v })])
    if (flipDir) pairs.reverse()
    for (const p of pairs) out.push(flipDir ? [p[1], p[0]] : p)
    flipDir = !flipDir
  }
  return out
}
export const segmentLength = (s: Segment) => Math.hypot(s[1].x - s[0].x, s[1].y - s[0].y)
