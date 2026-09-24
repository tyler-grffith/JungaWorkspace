// Pure geometry for the canvas: rotation, bounds, anchors, hit tests, snapping, and connector
// paths. No React and no DOM, so it is unit-testable and shared by the editor, presenter, and
// SVG export.
import type { Anchor, CanvasElement, ConnectorElement, Page, Point, Routing } from './model'

export type Rect = { x: number; y: number; width: number; height: number }
const rad = (deg: number) => (deg * Math.PI) / 180

export const center = (r: Rect): Point => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 })
export function rotatePoint(p: Point, about: Point, degrees: number): Point {
  if (!degrees) return { x: p.x, y: p.y }
  const a = rad(degrees)
  const dx = p.x - about.x
  const dy = p.y - about.y
  return {
    x: about.x + dx * Math.cos(a) - dy * Math.sin(a),
    y: about.y + dx * Math.sin(a) + dy * Math.cos(a),
  }
}
/** The four corners of an element after rotation, clockwise from top-left. */
export function corners(r: Rect, rotation = 0): Point[] {
  const c = center(r)
  return [
    { x: r.x, y: r.y },
    { x: r.x + r.width, y: r.y },
    { x: r.x + r.width, y: r.y + r.height },
    { x: r.x, y: r.y + r.height },
  ].map((p) => rotatePoint(p, c, rotation))
}
export function boundsOfPoints(points: readonly Point[]): Rect {
  if (!points.length) return { x: 0, y: 0, width: 0, height: 0 }
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity
  for (const p of points) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}
export const union = (rects: readonly Rect[]): Rect =>
  boundsOfPoints(
    rects.flatMap((r) => [
      { x: r.x, y: r.y },
      { x: r.x + r.width, y: r.y + r.height },
    ]),
  )
export const intersects = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
export const contains = (outer: Rect, inner: Rect) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height

/** Where a connector end sits, given the page's elements. */
export function anchorPoint(anchor: Anchor, page: Page, towards?: Point): Point {
  const target = anchor.elementId ? page.elements.find((e) => e.id === anchor.elementId) : null
  if (!target || target.type === 'connector') return { x: anchor.x, y: anchor.y }
  if (anchor.px >= 0 && anchor.py >= 0) {
    const local = {
      x: target.x + anchor.px * target.width,
      y: target.y + anchor.py * target.height,
    }
    return rotatePoint(local, center(target), target.rotation)
  }
  const c = center(target)
  if (!towards) return c
  // Auto anchor: intersect the line from the center towards `towards` with the element's edge.
  const local = rotatePoint(towards, c, -target.rotation)
  const dx = local.x - c.x
  const dy = local.y - c.y
  if (!dx && !dy) return c
  const hw = target.width / 2
  const hh = target.height / 2
  let hit: Point
  if (target.type === 'shape' && target.shape === 'ellipse') {
    const t = 1 / Math.sqrt((dx * dx) / (hw * hw) + (dy * dy) / (hh * hh))
    hit = { x: c.x + dx * t, y: c.y + dy * t }
  } else {
    const scale = Math.min(hw / Math.abs(dx || 1e-9), hh / Math.abs(dy || 1e-9))
    hit = { x: c.x + dx * scale, y: c.y + dy * scale }
  }
  return rotatePoint(hit, c, target.rotation)
}

/** Resolved start, waypoints, and end of a connector. */
export function connectorPoints(connector: ConnectorElement, page: Page): Point[] {
  const firstTowards = connector.points[0] ?? anchorPoint(connector.end, page)
  const lastTowards = connector.points.at(-1) ?? anchorPoint(connector.start, page)
  const start = anchorPoint(connector.start, page, firstTowards)
  const end = anchorPoint(connector.end, page, lastTowards)
  return [start, ...connector.points, end]
}

/** Orthogonal routing: insert a horizontal-vertical elbow between consecutive points. */
function orthogonal(points: Point[]): Point[] {
  const out: Point[] = [points[0]]
  for (let i = 1; i < points.length; i++) {
    const a = out[out.length - 1]
    const b = points[i]
    if (a.x !== b.x && a.y !== b.y) {
      const dx = Math.abs(b.x - a.x)
      const dy = Math.abs(b.y - a.y)
      if (dx >= dy) out.push({ x: (a.x + b.x) / 2, y: a.y }, { x: (a.x + b.x) / 2, y: b.y })
      else out.push({ x: a.x, y: (a.y + b.y) / 2 }, { x: b.x, y: (a.y + b.y) / 2 })
    }
    out.push(b)
  }
  return out
}
/** SVG path data for a connector's points under its routing. */
export function connectorPath(points: Point[], routing: Routing): string {
  if (points.length < 2) return ''
  if (routing === 'orthogonal') points = orthogonal(points)
  if (routing === 'curved' && points.length >= 2) {
    if (points.length === 2) {
      const [a, b] = points
      const dx = b.x - a.x
      return `M${a.x} ${a.y} C${a.x + dx / 2} ${a.y} ${b.x - dx / 2} ${b.y} ${b.x} ${b.y}`
    }
    let d = `M${points[0].x} ${points[0].y}`
    for (let i = 1; i < points.length - 1; i++) {
      const p = points[i]
      const next = points[i + 1]
      const mid = { x: (p.x + next.x) / 2, y: (p.y + next.y) / 2 }
      d += ` Q${p.x} ${p.y} ${mid.x} ${mid.y}`
    }
    const last = points[points.length - 1]
    d += ` T${last.x} ${last.y}`
    return d
  }
  return points.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ')
}
/** Direction of the path at its end (unit vector) for arrowhead orientation. */
export function endDirection(points: Point[], routing: Routing, atStart: boolean): Point {
  const pts = routing === 'orthogonal' ? orthogonal(points) : points
  const a = atStart ? pts[1] : pts[pts.length - 2]
  const b = atStart ? pts[0] : pts[pts.length - 1]
  if (!a || !b) return { x: 1, y: 0 }
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  return { x: dx / len, y: dy / len }
}

/** Axis-aligned bounds of any element, including rotation and connector routes. */
export function elementBounds(element: CanvasElement, page: Page): Rect {
  if (element.type === 'connector') return boundsOfPoints(connectorPoints(element, page))
  return boundsOfPoints(corners(element, element.rotation))
}
export const selectionBounds = (elements: readonly CanvasElement[], page: Page): Rect =>
  union(elements.map((e) => elementBounds(e, page)))

export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  const t = len2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}
/** Whether a page point lies on an element, with `slop` pixels of tolerance for thin things. */
export function hitTest(element: CanvasElement, page: Page, p: Point, slop = 6): boolean {
  if (element.type === 'connector') {
    let pts = connectorPoints(element, page)
    if (element.routing === 'orthogonal') pts = orthogonal(pts)
    for (let i = 1; i < pts.length; i++)
      if (distanceToSegment(p, pts[i - 1], pts[i]) <= slop + element.stroke.width / 2) return true
    return false
  }
  const local = rotatePoint(p, center(element), -element.rotation)
  if (element.type === 'shape' && element.shape === 'line') {
    return (
      distanceToSegment(
        local,
        { x: element.x, y: element.y + element.height / 2 },
        { x: element.x + element.width, y: element.y + element.height / 2 },
      ) <=
      slop + element.stroke.width / 2
    )
  }
  return (
    local.x >= element.x - slop &&
    local.x <= element.x + element.width + slop &&
    local.y >= element.y - slop &&
    local.y <= element.y + element.height + slop
  )
}

export const snap = (value: number, size: number) => Math.round(value / size) * size

export type Guide = { axis: 'x' | 'y'; at: number }
/**
 * Snap a moving rectangle to the grid and to other elements' edges and centers.
 * Returns the corrected offset and the guides to draw.
 */
export function snapRect(
  moving: Rect,
  others: readonly Rect[],
  gridSize: number,
  useGrid: boolean,
  threshold = 6,
): { dx: number; dy: number; guides: Guide[] } {
  const edgesX = (r: Rect) => [r.x, r.x + r.width / 2, r.x + r.width]
  const edgesY = (r: Rect) => [r.y, r.y + r.height / 2, r.y + r.height]
  let bestX: { delta: number; at: number } | null = null
  let bestY: { delta: number; at: number } | null = null
  for (const other of others) {
    for (const mx of edgesX(moving))
      for (const ox of edgesX(other)) {
        const delta = ox - mx
        if (Math.abs(delta) <= threshold && (!bestX || Math.abs(delta) < Math.abs(bestX.delta)))
          bestX = { delta, at: ox }
      }
    for (const my of edgesY(moving))
      for (const oy of edgesY(other)) {
        const delta = oy - my
        if (Math.abs(delta) <= threshold && (!bestY || Math.abs(delta) < Math.abs(bestY.delta)))
          bestY = { delta, at: oy }
      }
  }
  const guides: Guide[] = []
  let dx = 0
  let dy = 0
  if (bestX) {
    dx = bestX.delta
    guides.push({ axis: 'x', at: bestX.at })
  } else if (useGrid) dx = snap(moving.x, gridSize) - moving.x
  if (bestY) {
    dy = bestY.delta
    guides.push({ axis: 'y', at: bestY.at })
  } else if (useGrid) dy = snap(moving.y, gridSize) - moving.y
  return { dx, dy, guides }
}

export type HandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'
export const HANDLES: readonly HandleId[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
export function handlePosition(r: Rect, handle: HandleId): Point {
  const x = handle.includes('w') ? r.x : handle.includes('e') ? r.x + r.width : r.x + r.width / 2
  const y = handle.includes('n') ? r.y : handle.includes('s') ? r.y + r.height : r.y + r.height / 2
  return { x, y }
}
/**
 * Resize a rectangle by dragging one handle, in the rectangle's own (unrotated) frame.
 * `keepAspect` constrains corner handles. Sizes never drop below `min`.
 */
export function resizeRect(
  start: Rect,
  handle: HandleId,
  dx: number,
  dy: number,
  keepAspect = false,
  min = 4,
): Rect {
  let { x, y, width, height } = start
  if (handle.includes('e')) width = Math.max(min, start.width + dx)
  if (handle.includes('s')) height = Math.max(min, start.height + dy)
  if (handle.includes('w')) {
    width = Math.max(min, start.width - dx)
    x = start.x + start.width - width
  }
  if (handle.includes('n')) {
    height = Math.max(min, start.height - dy)
    y = start.y + start.height - height
  }
  if (keepAspect && handle.length === 2 && start.width && start.height) {
    const ratio = start.width / start.height
    if (width / height > ratio) width = height * ratio
    else height = width / ratio
    if (handle.includes('w')) x = start.x + start.width - width
    if (handle.includes('n')) y = start.y + start.height - height
  }
  return { x, y, width, height }
}
/** Angle in degrees from `about` to `p`, measured like CSS rotation (0 = up, clockwise). */
export const angleTo = (about: Point, p: Point) =>
  (Math.atan2(p.y - about.y, p.x - about.x) * 180) / Math.PI + 90

/** Scale a set of elements about the top-left of their union, used for group resizing. */
export function scaleElements(
  elements: readonly CanvasElement[],
  from: Rect,
  to: Rect,
): CanvasElement[] {
  const sx = from.width ? to.width / from.width : 1
  const sy = from.height ? to.height / from.height : 1
  const map = (p: Point): Point => ({
    x: to.x + (p.x - from.x) * sx,
    y: to.y + (p.y - from.y) * sy,
  })
  return elements.map((element) => {
    const copy = structuredClone(element)
    const origin = map({ x: element.x, y: element.y })
    copy.x = origin.x
    copy.y = origin.y
    copy.width = Math.max(1, element.width * sx)
    copy.height = Math.max(1, element.height * sy)
    if (copy.type === 'connector') {
      copy.points = copy.points.map(map)
      for (const anchor of [copy.start, copy.end]) {
        const moved = map(anchor)
        anchor.x = moved.x
        anchor.y = moved.y
      }
    }
    return copy
  })
}
export function moveElements(
  elements: readonly CanvasElement[],
  dx: number,
  dy: number,
): CanvasElement[] {
  return elements.map((element) => {
    // Keyframes are absolute poses and stay put: moving an element at the preview time is how a
    // new pose is placed before it is captured as a keyframe. Duplication shifts them instead.
    const copy = structuredClone(element)
    copy.x += dx
    copy.y += dy
    if (copy.type === 'connector') {
      copy.points = copy.points.map((p) => ({ x: p.x + dx, y: p.y + dy }))
      for (const anchor of [copy.start, copy.end]) {
        anchor.x += dx
        anchor.y += dy
      }
    }
    return copy
  })
}

/** An element's pose at time `t` of its page's animation, interpolating between keyframes. */
export function poseAt(element: CanvasElement, t: number): CanvasElement {
  const frames = element.keyframes
  if (!frames.length) return element
  const sorted = [...frames].sort((a, b) => a.t - b.t)
  const apply = (k: (typeof sorted)[number]): CanvasElement => ({
    ...element,
    x: k.x,
    y: k.y,
    width: k.width,
    height: k.height,
    rotation: k.rotation,
    opacity: k.opacity,
  })
  if (t <= sorted[0].t) return apply(sorted[0])
  const last = sorted[sorted.length - 1]
  if (t >= last.t) return apply(last)
  const next = sorted.findIndex((k) => k.t > t)
  const a = sorted[next - 1]
  const b = sorted[next]
  const span = b.t - a.t || 1
  const u = (t - a.t) / span
  const ease = u * u * (3 - 2 * u)
  const mix = (p: number, q: number) => p + (q - p) * ease
  return apply({
    t,
    x: mix(a.x, b.x),
    y: mix(a.y, b.y),
    width: mix(a.width, b.width),
    height: mix(a.height, b.height),
    rotation: mix(a.rotation, b.rotation),
    opacity: mix(a.opacity, b.opacity),
  })
}
/** The page with every element posed at time `t`. */
export function pageAt(page: Page, t: number): Page {
  if (!page.elements.some((e) => e.keyframes.length)) return page
  return { ...page, elements: page.elements.map((e) => poseAt(e, t)) }
}
