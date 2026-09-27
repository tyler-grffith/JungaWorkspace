// Free sketches: the entities a sketch is drawn from (lines, arcs, circles, rectangles,
// polygons, slots, and polylines) and how they become geometry. Closed primitives are loops
// on their own; lines and arcs chain end to end into loops; the loops nest into regions (an
// outer boundary with holes), which is what extrude, revolve, and loft consume. An open chain is
// a path, which is what sweep consumes. Everything here is pure and unit-tested.
import {
  chainLoops,
  polygonArea,
  profile,
  type Polygon,
  type Segment,
  type Vec2,
} from '../workbench/geometry'

export type Point = { x: number; y: number }
export type SketchEntity =
  | { id: string; kind: 'line'; a: Point; b: Point }
  | { id: string; kind: 'circle'; c: Point; r: number }
  /** Counter-clockwise from `start` to `end` degrees. */
  | { id: string; kind: 'arc'; c: Point; r: number; start: number; end: number }
  | { id: string; kind: 'rect'; a: Point; b: Point }
  | { id: string; kind: 'polygon'; c: Point; r: number; sides: number; rotation: number }
  /** A stadium between two centres with the given width. */
  | { id: string; kind: 'slot'; a: Point; b: Point; width: number }
  | { id: string; kind: 'polyline'; points: Point[]; closed: boolean }
export type EntityKind = SketchEntity['kind']
export type Region = { outer: Polygon; holes: Polygon[] }

export const MAX_ENTITIES = 400
export const SEGMENTS = 48
export const newEntityId = () => crypto.randomUUID().slice(0, 8)

// --- Validation ------------------------------------------------------------------------------------
const num = (v: unknown, min = -1e5, max = 1e5) =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max
const point = (v: unknown): v is Point =>
  typeof v === 'object' &&
  v !== null &&
  Object.keys(v).length === 2 &&
  num((v as Point).x) &&
  num((v as Point).y)
const ID = /^[A-Za-z0-9_-]{1,40}$/
export function validEntity(v: unknown): v is SketchEntity {
  if (typeof v !== 'object' || v === null) return false
  const e = v as Record<string, unknown>
  if (typeof e.id !== 'string' || !ID.test(e.id)) return false
  const only = (...names: string[]) =>
    Object.keys(e).length === names.length + 2 && names.every((n) => n in e)
  switch (e.kind) {
    case 'line':
    case 'rect':
      return only('a', 'b') && point(e.a) && point(e.b)
    case 'circle':
      return only('c', 'r') && point(e.c) && num(e.r, 0.001, 1e5)
    case 'arc':
      return (
        only('c', 'r', 'start', 'end') &&
        point(e.c) &&
        num(e.r, 0.001, 1e5) &&
        num(e.start, -720, 720) &&
        num(e.end, -720, 720)
      )
    case 'polygon':
      return (
        only('c', 'r', 'sides', 'rotation') &&
        point(e.c) &&
        num(e.r, 0.001, 1e5) &&
        num(e.sides, 3, 64) &&
        Number.isInteger(e.sides) &&
        num(e.rotation, -360, 360)
      )
    case 'slot':
      return only('a', 'b', 'width') && point(e.a) && point(e.b) && num(e.width, 0.001, 1e5)
    case 'polyline':
      return (
        only('points', 'closed') &&
        Array.isArray(e.points) &&
        e.points.length >= 2 &&
        e.points.length <= 500 &&
        e.points.every(point) &&
        typeof e.closed === 'boolean'
      )
    default:
      return false
  }
}
export const validEntities = (v: unknown): v is SketchEntity[] =>
  Array.isArray(v) && v.length <= MAX_ENTITIES && v.every(validEntity)

// --- Entities as curves ----------------------------------------------------------------------------
const deg = (d: number) => (d * Math.PI) / 180
export const arcPoints = (
  c: Point,
  r: number,
  start: number,
  end: number,
  segments = SEGMENTS,
): Point[] => {
  let sweep = end - start
  while (sweep <= 0) sweep += 360
  const n = Math.max(2, Math.round((segments * sweep) / 360))
  const out: Point[] = []
  for (let i = 0; i <= n; i++) {
    const t = deg(start + (sweep * i) / n)
    out.push({ x: c.x + r * Math.cos(t), y: c.y + r * Math.sin(t) })
  }
  return out
}
/** A closed primitive as a counter-clockwise loop; null for lines, arcs, and open polylines. */
export function entityLoop(e: SketchEntity): Polygon | null {
  switch (e.kind) {
    case 'circle':
      return arcPoints(e.c, e.r, 0, 360, SEGMENTS).slice(0, -1)
    case 'rect': {
      const [x0, x1] = [Math.min(e.a.x, e.b.x), Math.max(e.a.x, e.b.x)]
      const [y0, y1] = [Math.min(e.a.y, e.b.y), Math.max(e.a.y, e.b.y)]
      if (x1 - x0 < 1e-6 || y1 - y0 < 1e-6) return null
      return [
        { x: x0, y: y0 },
        { x: x1, y: y0 },
        { x: x1, y: y1 },
        { x: x0, y: y1 },
      ]
    }
    case 'polygon': {
      const out: Polygon = []
      for (let i = 0; i < e.sides; i++) {
        const t = deg(e.rotation + (360 * i) / e.sides)
        out.push({ x: e.c.x + e.r * Math.cos(t), y: e.c.y + e.r * Math.sin(t) })
      }
      return out
    }
    case 'slot': {
      const dx = e.b.x - e.a.x
      const dy = e.b.y - e.a.y
      const len = Math.hypot(dx, dy)
      const r = e.width / 2
      if (len < 1e-6) return arcPoints(e.a, r, 0, 360).slice(0, -1)
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI
      const half = Math.max(2, SEGMENTS / 2)
      return [
        ...arcPoints(e.b, r, angle - 90, angle + 90, half * 2).slice(0, -1),
        ...arcPoints(e.a, r, angle + 90, angle + 270, half * 2).slice(0, -1),
      ]
    }
    case 'polyline':
      return e.closed && e.points.length >= 3 ? e.points : null
    default:
      return null
  }
}
/** Open curves as segment lists, for chaining lines and arcs into loops or paths. */
export function entitySegments(e: SketchEntity): Segment[] {
  const chain = (points: Point[]): Segment[] =>
    points.slice(1).map((p, i) => [points[i], p] as Segment)
  switch (e.kind) {
    case 'line':
      return [[e.a, e.b]]
    case 'arc':
      return chain(arcPoints(e.c, e.r, e.start, e.end))
    case 'polyline':
      return e.closed ? [] : chain(e.points)
    default:
      return []
  }
}
/** Every closed loop the sketch describes, primitives and chained curves alike. */
export function sketchLoops(entities: SketchEntity[]): Polygon[] {
  const loops = entities.map(entityLoop).filter((l): l is Polygon => !!l && l.length >= 3)
  const segments = entities.flatMap(entitySegments)
  const chained = chainLoops(segments, 0.05).filter((l) => Math.abs(polygonArea(l)) > 1e-6)
  return [...loops, ...chained].map((l) => (polygonArea(l) >= 0 ? l : [...l].reverse()))
}
/** The open chain of lines and arcs, for a sweep path; the longest one if there are several. */
export function sketchPath(entities: SketchEntity[]): Point[] {
  const segments = entities.flatMap(entitySegments)
  if (!segments.length) return []
  const near = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y) <= 0.05
  const used = new Set<Segment>()
  let best: Point[] = []
  for (const start of segments) {
    if (used.has(start)) continue
    used.add(start)
    let chain = [start[0], start[1]]
    let grew = true
    while (grew) {
      grew = false
      for (const s of segments) {
        if (used.has(s)) continue
        const head = chain[0]
        const tail = chain[chain.length - 1]
        if (near(tail, s[0])) chain = [...chain, s[1]]
        else if (near(tail, s[1])) chain = [...chain, s[0]]
        else if (near(head, s[1])) chain = [s[0], ...chain]
        else if (near(head, s[0])) chain = [s[1], ...chain]
        else continue
        used.add(s)
        grew = true
      }
    }
    if (chain.length > best.length) best = chain
  }
  return best
}
const contains = (poly: Polygon, p: Vec2): boolean => {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]
    const b = poly[j]
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x)
      inside = !inside
  }
  return inside
}
/** Nest loops into regions: even depth is an outer boundary, odd depth a hole in the one around it. */
export function regionsFromLoops(loops: Polygon[]): Region[] {
  const depth = loops.map(
    (loop) => loops.filter((other) => other !== loop && contains(other, loop[0])).length,
  )
  const regions: { outer: Polygon; holes: Polygon[]; index: number }[] = []
  loops.forEach((loop, i) => {
    if (depth[i] % 2 === 0) regions.push({ outer: loop, holes: [], index: i })
  })
  loops.forEach((loop, i) => {
    if (depth[i] % 2 === 0) return
    // The hole belongs to the deepest even loop that contains it.
    const owner = regions
      .filter((r) => contains(r.outer, loop[0]))
      .sort((p, q) => depth[q.index] - depth[p.index])[0]
    if (owner) owner.holes.push([...loop].reverse())
  })
  return regions.map(({ outer, holes }) => ({ outer, holes }))
}
export const sketchRegions = (entities: SketchEntity[]) => regionsFromLoops(sketchLoops(entities))

// --- Quick shapes as entities ---------------------------------------------------------------------
/** The parametric sketch shapes as editable entities, centred at (x, y). */
export function shapeEntities(
  shape: 'rectangle' | 'circle' | 'slot' | 'polygon',
  width: number,
  height: number,
  x = 0,
  y = 0,
): SketchEntity[] {
  const id = newEntityId()
  switch (shape) {
    case 'rectangle':
      return [
        {
          id,
          kind: 'rect',
          a: { x: x - width / 2, y: y - height / 2 },
          b: { x: x + width / 2, y: y + height / 2 },
        },
      ]
    case 'circle':
      return width === height
        ? [{ id, kind: 'circle', c: { x, y }, r: width / 2 }]
        : [
            {
              id,
              kind: 'polyline',
              points: profile('circle', width, height, SEGMENTS).map((p) => ({
                x: p.x + x,
                y: p.y + y,
              })),
              closed: true,
            },
          ]
    case 'polygon':
      return [{ id, kind: 'polygon', c: { x, y }, r: width / 2, sides: 6, rotation: 30 }]
    case 'slot': {
      const along = width >= height
      const r = Math.min(width, height) / 2
      const run = Math.max(width, height) / 2 - r
      return [
        {
          id,
          kind: 'slot',
          a: along ? { x: x - run, y } : { x, y: y - run },
          b: along ? { x: x + run, y } : { x, y: y + run },
          width: r * 2,
        },
      ]
    }
  }
}

// --- Editing helpers -------------------------------------------------------------------------------
export function entityBounds(e: SketchEntity): { min: Point; max: Point } {
  const pts = entityPoints(e)
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  return {
    min: { x: Math.min(...xs), y: Math.min(...ys) },
    max: { x: Math.max(...xs), y: Math.max(...ys) },
  }
}
/** Points worth snapping to: endpoints, centres, corners, quadrants. */
export function entityPoints(e: SketchEntity): Point[] {
  switch (e.kind) {
    case 'line':
      return [e.a, e.b, mid(e.a, e.b)]
    case 'rect':
      return [e.a, e.b, { x: e.a.x, y: e.b.y }, { x: e.b.x, y: e.a.y }, mid(e.a, e.b)]
    case 'circle':
      return [
        e.c,
        { x: e.c.x + e.r, y: e.c.y },
        { x: e.c.x - e.r, y: e.c.y },
        { x: e.c.x, y: e.c.y + e.r },
        { x: e.c.x, y: e.c.y - e.r },
      ]
    case 'arc': {
      const pts = arcPoints(e.c, e.r, e.start, e.end, 4)
      return [e.c, pts[0], pts[pts.length - 1]]
    }
    case 'polygon':
      return [e.c, ...entityLoop(e)!]
    case 'slot':
      return [e.a, e.b, mid(e.a, e.b)]
    case 'polyline':
      return e.points
  }
}
const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
export function moveEntity(e: SketchEntity, dx: number, dy: number): SketchEntity {
  const m = (p: Point): Point => ({ x: p.x + dx, y: p.y + dy })
  switch (e.kind) {
    case 'line':
    case 'rect':
    case 'slot':
      return { ...e, a: m(e.a), b: m(e.b) }
    case 'circle':
    case 'arc':
    case 'polygon':
      return { ...e, c: m(e.c) }
    case 'polyline':
      return { ...e, points: e.points.map(m) }
  }
}
/** Mirror about the sketch's vertical (x = 0) or horizontal (y = 0) axis. */
export function mirrorEntity(e: SketchEntity, axis: 'x' | 'y'): SketchEntity {
  const m = (p: Point): Point => (axis === 'x' ? { x: -p.x, y: p.y } : { x: p.x, y: -p.y })
  const flipAngle = (a: number) => (axis === 'x' ? 180 - a : -a)
  const id = newEntityId()
  switch (e.kind) {
    case 'line':
    case 'rect':
    case 'slot':
      return { ...e, id, a: m(e.a), b: m(e.b) }
    case 'circle':
      return { ...e, id, c: m(e.c) }
    case 'arc':
      return { ...e, id, c: m(e.c), start: flipAngle(e.end), end: flipAngle(e.start) }
    case 'polygon':
      return { ...e, id, c: m(e.c), rotation: flipAngle(e.rotation) }
    case 'polyline':
      return { ...e, id, points: e.points.map(m) }
  }
}
/** The size numbers a dimension tool edits: one or two named values. */
export function entityDimensions(e: SketchEntity): { label: string; value: number }[] {
  switch (e.kind) {
    case 'line':
      return [{ label: 'Length', value: Math.hypot(e.b.x - e.a.x, e.b.y - e.a.y) }]
    case 'rect':
      return [
        { label: 'Width', value: Math.abs(e.b.x - e.a.x) },
        { label: 'Height', value: Math.abs(e.b.y - e.a.y) },
      ]
    case 'circle':
      return [{ label: 'Diameter', value: e.r * 2 }]
    case 'arc':
      return [{ label: 'Radius', value: e.r }]
    case 'polygon':
      return [{ label: 'Circumscribed diameter', value: e.r * 2 }]
    case 'slot':
      return [
        { label: 'Centre distance', value: Math.hypot(e.b.x - e.a.x, e.b.y - e.a.y) },
        { label: 'Width', value: e.width },
      ]
    case 'polyline':
      return []
  }
}
/** Apply a dimension edit, keeping the entity's first point (or centre) where it is. */
export function setEntityDimension(e: SketchEntity, index: number, value: number): SketchEntity {
  const v = Math.max(0.01, value)
  switch (e.kind) {
    case 'line': {
      const l = Math.hypot(e.b.x - e.a.x, e.b.y - e.a.y) || 1
      return {
        ...e,
        b: { x: e.a.x + ((e.b.x - e.a.x) / l) * v, y: e.a.y + ((e.b.y - e.a.y) / l) * v },
      }
    }
    case 'rect': {
      const sx = Math.sign(e.b.x - e.a.x) || 1
      const sy = Math.sign(e.b.y - e.a.y) || 1
      return index === 0
        ? { ...e, b: { x: e.a.x + sx * v, y: e.b.y } }
        : { ...e, b: { x: e.b.x, y: e.a.y + sy * v } }
    }
    case 'circle':
    case 'polygon':
      return { ...e, r: v / 2 }
    case 'arc':
      return { ...e, r: v }
    case 'slot': {
      if (index === 1) return { ...e, width: v }
      const l = Math.hypot(e.b.x - e.a.x, e.b.y - e.a.y) || 1
      return {
        ...e,
        b: { x: e.a.x + ((e.b.x - e.a.x) / l) * v, y: e.a.y + ((e.b.y - e.a.y) / l) * v },
      }
    }
    case 'polyline':
      return e
  }
}
/** Distance from a point to the entity's curve, for picking. */
export function entityDistance(e: SketchEntity, p: Point): number {
  const seg = (a: Point, b: Point) => {
    const dx = b.x - a.x
    const dy = b.y - a.y
    const l2 = dx * dx + dy * dy
    const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0
    return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t))
  }
  switch (e.kind) {
    case 'line':
      return seg(e.a, e.b)
    case 'circle':
      return Math.abs(Math.hypot(p.x - e.c.x, p.y - e.c.y) - e.r)
    default: {
      const loop = entityLoop(e)
      const pts = loop
        ? [...loop, loop[0]]
        : e.kind === 'arc'
          ? arcPoints(e.c, e.r, e.start, e.end)
          : e.kind === 'polyline'
            ? e.points
            : []
      let best = Infinity
      for (let i = 1; i < pts.length; i++) best = Math.min(best, seg(pts[i - 1], pts[i]))
      return best
    }
  }
}
