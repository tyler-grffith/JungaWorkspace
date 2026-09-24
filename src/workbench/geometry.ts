// A small, honest geometry layer shared by the modeler and the slicer. Solids are triangle
// meshes; sketches are closed 2D profiles that extrude or revolve into meshes; slicing cuts a
// mesh with horizontal planes and chains the pieces into loops. Nothing here is a CAD kernel
// (there are no booleans: cuts are meshes with reversed winding, which slicing and volume
// treat as holes), but every number the apps show is computed from real geometry.

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
/**
 * Sweep a convex profile along its frame's normal from `from` to `to` (both distances along
 * the normal). Caps are fan-triangulated, so profiles must be convex; ours all are.
 */
export function extrude(poly: Polygon, frame: Frame, from: number, to: number): Mesh {
  const mesh: Mesh = []
  const ccw = polygonArea(poly) >= 0
  const ring = ccw ? poly : [...poly].reverse()
  const bottom = ring.map((p) => place(frame, p, from))
  const top = ring.map((p) => place(frame, p, to))
  const n = ring.length
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    pushTriangle(mesh, bottom[i], bottom[j], top[j])
    pushTriangle(mesh, bottom[i], top[j], top[i])
  }
  for (let i = 1; i < n - 1; i++) {
    pushTriangle(mesh, top[0], top[i], top[i + 1])
    pushTriangle(mesh, bottom[0], bottom[i + 1], bottom[i])
  }
  return to < from ? flip(mesh) : mesh
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
/** Join crossing segments end to end into closed loops; open chains are kept as they are. */
export function chainLoops(segments: Segment[]): Polygon[] {
  const byStart = new Map<string, Segment[]>()
  for (const s of segments) {
    const k = key(s[0])
    byStart.set(k, [...(byStart.get(k) ?? []), s])
  }
  const used = new Set<Segment>()
  const loops: Polygon[] = []
  for (const start of segments) {
    if (used.has(start)) continue
    used.add(start)
    const loop: Polygon = [start[0]]
    let current = start
    for (let guard = 0; guard < segments.length; guard++) {
      const candidates = (byStart.get(key(current[1])) ?? []).filter((s) => !used.has(s))
      const next = candidates[0]
      if (!next) break
      used.add(next)
      loop.push(next[0])
      current = next
      if (key(current[1]) === key(start[0])) break
    }
    if (loop.length >= 3) loops.push(loop)
  }
  return loops
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
