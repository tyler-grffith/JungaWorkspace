// Constructive solid geometry on triangle meshes, after Evan Wallace's csg.js: each solid
// becomes a binary space partition of its polygons, and union, subtract, and intersect are a
// handful of clip-and-merge steps between two trees. Every polygon carries a tag (the feature
// that made it), and the tag survives splitting, so a body built from many features still knows
// which face belongs to which feature. Trees are built and walked iteratively, so a smooth
// imported mesh cannot overflow the stack.
import { cross, dot, sub, vec, type Mesh, type Vec3 } from './geometry'

/** A mesh whose triangles each remember the feature that made them. */
export type TaggedMesh = { mesh: Mesh; tags: string[] }

const EPSILON = 1e-5
const COPLANAR = 0
const FRONT = 1
const BACK = 2
const SPANNING = 3

type Plane = { normal: Vec3; w: number }
type Polygon = { vertices: Vec3[]; plane: Plane; tag: string }
type Node = { plane: Plane | null; front: Node | null; back: Node | null; polygons: Polygon[] }

const planeOf = (a: Vec3, b: Vec3, c: Vec3): Plane | null => {
  const n = cross(sub(b, a), sub(c, a))
  const l = Math.hypot(n.x, n.y, n.z)
  if (l < 1e-12) return null
  const normal = vec(n.x / l, n.y / l, n.z / l)
  return { normal, w: dot(normal, a) }
}
const flipPlane = (p: Plane): Plane => ({
  normal: vec(-p.normal.x, -p.normal.y, -p.normal.z),
  w: -p.w,
})
const flipPolygon = (p: Polygon): Polygon => ({
  vertices: [...p.vertices].reverse(),
  plane: flipPlane(p.plane),
  tag: p.tag,
})
const lerp = (a: Vec3, b: Vec3, t: number): Vec3 =>
  vec(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t)

/** Sort a polygon into the lists on each side of a plane, splitting it when it spans both. */
function splitPolygon(
  plane: Plane,
  polygon: Polygon,
  coplanarFront: Polygon[],
  coplanarBack: Polygon[],
  front: Polygon[],
  back: Polygon[],
) {
  let type = 0
  const types: number[] = []
  for (const v of polygon.vertices) {
    const t = dot(plane.normal, v) - plane.w
    const kind = t < -EPSILON ? BACK : t > EPSILON ? FRONT : COPLANAR
    type |= kind
    types.push(kind)
  }
  switch (type) {
    case COPLANAR:
      ;(dot(plane.normal, polygon.plane.normal) > 0 ? coplanarFront : coplanarBack).push(polygon)
      break
    case FRONT:
      front.push(polygon)
      break
    case BACK:
      back.push(polygon)
      break
    case SPANNING: {
      const f: Vec3[] = []
      const b: Vec3[] = []
      const n = polygon.vertices.length
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n
        const ti = types[i]
        const tj = types[j]
        const vi = polygon.vertices[i]
        const vj = polygon.vertices[j]
        if (ti !== BACK) f.push(vi)
        if (ti !== FRONT) b.push(vi)
        if ((ti | tj) === SPANNING) {
          const t = (plane.w - dot(plane.normal, vi)) / dot(plane.normal, sub(vj, vi))
          const v = lerp(vi, vj, t)
          f.push(v)
          b.push(v)
        }
      }
      if (f.length >= 3) front.push({ vertices: f, plane: polygon.plane, tag: polygon.tag })
      if (b.length >= 3) back.push({ vertices: b, plane: polygon.plane, tag: polygon.tag })
      break
    }
  }
}

const node = (): Node => ({ plane: null, front: null, back: null, polygons: [] })

/** Add polygons to a tree, choosing a splitter from the middle of each batch to keep it balanced. */
function build(root: Node, polygons: Polygon[]) {
  const stack: [Node, Polygon[]][] = [[root, polygons]]
  while (stack.length) {
    const [n, polys] = stack.pop()!
    if (!polys.length) continue
    if (!n.plane) n.plane = polys[Math.floor(polys.length / 2)].plane
    const front: Polygon[] = []
    const back: Polygon[] = []
    for (const p of polys) splitPolygon(n.plane, p, n.polygons, n.polygons, front, back)
    if (front.length) {
      if (!n.front) n.front = node()
      stack.push([n.front, front])
    }
    if (back.length) {
      if (!n.back) n.back = node()
      stack.push([n.back, back])
    }
  }
}
/** Swap solid and empty space. */
function invert(root: Node) {
  const stack = [root]
  while (stack.length) {
    const n = stack.pop()!
    n.polygons = n.polygons.map(flipPolygon)
    if (n.plane) n.plane = flipPlane(n.plane)
    const front = n.front
    n.front = n.back
    n.back = front
    if (n.front) stack.push(n.front)
    if (n.back) stack.push(n.back)
  }
}
/** The parts of the polygons that lie outside the tree's solid. */
function clipPolygons(root: Node, polygons: Polygon[]): Polygon[] {
  const out: Polygon[] = []
  const stack: [Node, Polygon[]][] = [[root, polygons]]
  while (stack.length) {
    const [n, polys] = stack.pop()!
    if (!n.plane) {
      out.push(...polys)
      continue
    }
    const front: Polygon[] = []
    const back: Polygon[] = []
    for (const p of polys) splitPolygon(n.plane, p, front, back, front, back)
    if (n.front) stack.push([n.front, front])
    else out.push(...front)
    if (n.back) stack.push([n.back, back])
    // Polygons behind a leaf plane are inside the solid and are dropped.
  }
  return out
}
/** Remove every polygon of this tree that lies inside the other tree's solid. */
function clipTo(root: Node, other: Node) {
  const stack = [root]
  while (stack.length) {
    const n = stack.pop()!
    n.polygons = clipPolygons(other, n.polygons)
    if (n.front) stack.push(n.front)
    if (n.back) stack.push(n.back)
  }
}
function allPolygons(root: Node): Polygon[] {
  const out: Polygon[] = []
  const stack = [root]
  while (stack.length) {
    const n = stack.pop()!
    out.push(...n.polygons)
    if (n.front) stack.push(n.front)
    if (n.back) stack.push(n.back)
  }
  return out
}

// --- Between meshes and trees ---------------------------------------------------------------------
function toPolygons({ mesh, tags }: TaggedMesh): Polygon[] {
  const out: Polygon[] = []
  for (let i = 0, t = 0; i + 8 < mesh.length; i += 9, t++) {
    const a = vec(mesh[i], mesh[i + 1], mesh[i + 2])
    const b = vec(mesh[i + 3], mesh[i + 4], mesh[i + 5])
    const c = vec(mesh[i + 6], mesh[i + 7], mesh[i + 8])
    const plane = planeOf(a, b, c)
    if (plane) out.push({ vertices: [a, b, c], plane, tag: tags[t] ?? '' })
  }
  return out
}
function toMesh(polygons: Polygon[]): TaggedMesh {
  const mesh: Mesh = []
  const tags: string[] = []
  for (const p of polygons) {
    const [a, ...rest] = p.vertices
    for (let i = 0; i + 1 < rest.length; i++) {
      const b = rest[i]
      const c = rest[i + 1]
      // Splitting leaves slivers; skip triangles with no area so downstream code sees clean faces.
      const n = cross(sub(b, a), sub(c, a))
      if (Math.hypot(n.x, n.y, n.z) < 1e-9) continue
      mesh.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z)
      tags.push(p.tag)
    }
  }
  return { mesh, tags }
}
const tree = (m: TaggedMesh) => {
  const n = node()
  build(n, toPolygons(m))
  return n
}

// --- Operations ------------------------------------------------------------------------------------
/** Everything inside either solid. */
export function union(a: TaggedMesh, b: TaggedMesh): TaggedMesh {
  if (!a.mesh.length) return b
  if (!b.mesh.length) return a
  const ta = tree(a)
  const tb = tree(b)
  clipTo(ta, tb)
  clipTo(tb, ta)
  invert(tb)
  clipTo(tb, ta)
  invert(tb)
  build(ta, allPolygons(tb))
  return toMesh(allPolygons(ta))
}
/** Everything inside `a` that is not inside `b`. */
export function subtract(a: TaggedMesh, b: TaggedMesh): TaggedMesh {
  if (!a.mesh.length || !b.mesh.length) return a
  const ta = tree(a)
  const tb = tree(b)
  invert(ta)
  clipTo(ta, tb)
  clipTo(tb, ta)
  invert(tb)
  clipTo(tb, ta)
  invert(tb)
  build(ta, allPolygons(tb))
  invert(ta)
  return toMesh(allPolygons(ta))
}
/** Everything inside both solids. */
export function intersect(a: TaggedMesh, b: TaggedMesh): TaggedMesh {
  if (!a.mesh.length || !b.mesh.length) return { mesh: [], tags: [] }
  const ta = tree(a)
  const tb = tree(b)
  invert(ta)
  clipTo(tb, ta)
  invert(tb)
  clipTo(ta, tb)
  clipTo(tb, ta)
  build(ta, allPolygons(tb))
  invert(ta)
  return toMesh(allPolygons(ta))
}
/** A plain mesh with one tag for every triangle. */
export const tagged = (mesh: Mesh, tag: string): TaggedMesh => ({
  mesh,
  tags: new Array(Math.floor(mesh.length / 9)).fill(tag),
})
/** Several meshes side by side; the result is only a valid solid when they do not overlap. */
export const concat = (parts: TaggedMesh[]): TaggedMesh => ({
  mesh: parts.flatMap((p) => p.mesh),
  tags: parts.flatMap((p) => p.tags),
})
