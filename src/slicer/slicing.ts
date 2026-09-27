// The slicer. Each object on the plate is cut into layers, its loops classified as outlines or
// holes, walls offset inward, and the interior sorted into exposed top and bottom skins,
// internal solid layers, and sparse infill by comparing layer bitmaps with the layers above
// and below. Overhangs found the same way grow supports down to the bed. Brim, skirt, and raft
// go under the first layer; seams, speeds, retractions, and filament changes are decided here
// too, and the same paths become the time estimate, the preview, and the G-code.
import {
  bounds,
  chainLoops,
  hatch,
  offsetPolygon,
  polygonArea,
  polygonPerimeter,
  segmentLength,
  sliceMesh,
  type Polygon,
  type Segment,
  type Vec2,
} from '../workbench/geometry'
import {
  activePlate,
  allSlots,
  filamentDensity,
  filamentPrice,
  filamentTemps,
  normalizeSlicer,
  objectMesh,
  printerProfile,
  type InfillPattern,
  type PlateObject,
  type Process,
  type SliceResult,
  type SlicerDocument,
} from './model'
import { FILAMENT_PROFILES } from './profiles'
import * as R from './raster'

export type PathKind =
  'outer' | 'inner' | 'infill' | 'solid' | 'top' | 'bottom' | 'brim' | 'skirt' | 'support' | 'raft'
export type Toolpath = {
  kind: PathKind
  points: Vec2[]
  closed: boolean
  /** The object the path belongs to; supports, brim, skirt, and raft carry none. */
  object?: string
  /** Filament slot the path prints with. */
  slot: number
  /** Feed rate in mm/s. */
  speed: number
}
export type Layer = {
  index: number
  z: number
  height: number
  area: number
  paths: Toolpath[]
  /** Head moves between paths, for the preview. */
  travels: Segment[]
  seconds: number
  /** A manual spool change happens before this layer. */
  pause?: boolean
}
export type SlicedPlate = { layers: Layer[]; result: SliceResult }

export const PATH_COLORS: Record<PathKind, string> = {
  outer: '#ff7d38',
  inner: '#d9c85a',
  infill: '#9b5fc0',
  solid: '#7a3a99',
  top: '#e04b4b',
  bottom: '#3c8fd9',
  brim: '#35a7ff',
  skirt: '#5fd0c9',
  support: '#8fbf5a',
  raft: '#5f7f8f',
}
export const PATH_LABELS: Record<PathKind, string> = {
  outer: 'Outer wall',
  inner: 'Inner wall',
  infill: 'Sparse infill',
  solid: 'Internal solid infill',
  top: 'Top surface',
  bottom: 'Bottom surface',
  brim: 'Brim',
  skirt: 'Skirt',
  support: 'Support',
  raft: 'Raft',
}
export const PATH_KINDS = Object.keys(PATH_COLORS) as PathKind[]
const FILAMENT_AREA = Math.PI * 0.875 ** 2
const SPEED_FACTOR: Record<Process['speed'], number> = {
  silent: 0.5,
  standard: 1,
  sport: 1.3,
  ludicrous: 1.6,
}
const RAFT_BASE = 0.3
const RAFT_TOP = 0.2
const RAFT_MARGIN = 3
const SKIRT_DISTANCE = 3
const LAYER_CHANGE_SECONDS = 0.6
const FILAMENT_CHANGE_SECONDS = 90
const RETRACT_MIN_TRAVEL = 2

type Loop = { poly: Polygon; hole: boolean }
type ObjectLayer = {
  loops: Loop[]
  section: R.Mask
  inner: R.Mask
  walls: Toolpath[]
  innermost: Polygon[]
}

/** Slice the active plate. Empty plates give no layers and a zero result. */
export function slicePlate(raw: SlicerDocument): SlicedPlate {
  const doc = normalizeSlicer(raw)
  const plate = activePlate(doc)
  const p = doc.process
  const printer = printerProfile(doc.printer)
  const lineWidth = doc.nozzle
  const objects = plate.objects.map((o) => ({
    object: o,
    mesh: objectMesh(o),
    process: { ...p, ...o.overrides },
  }))
  const top = Math.max(0, ...objects.map(({ mesh }) => bounds(mesh)?.max.z ?? 0))
  if (top <= 0) return { layers: [], result: zero() }
  const raftHeight = p.raft ? RAFT_BASE + RAFT_TOP : 0
  const heights = layerHeights(top, p.firstLayerHeight, p.layerHeight)
  // Each object gets its own bitmap frame, cropped to its footprint, so mask work scales with
  // the object and not the plate; supports stand within an object's footprint anyway.
  const stacks = objects.map(({ object, mesh, process }) => {
    const b = bounds(mesh)!
    const frame = R.frameFor(
      { x: b.min.x, y: b.min.y },
      { x: b.max.x, y: b.max.y },
      2,
      heights.length,
    )
    const layers = heights.map(({ z, height }, i) =>
      objectLayer(mesh, z - height / 2, process, lineWidth, frame, i, object),
    )
    return { object, process, frame, layers, ...coverageRuns(layers, frame) }
  })
  // Supports need the layer above, so walk down once per object that wants them.
  const supports = stacks.map((stack) =>
    stack.process.supports ? supportMasks(stack.layers, heights, stack.process, stack.frame) : null,
  )
  const layers: Layer[] = heights.map(({ z, height }, i) => {
    const paths: Toolpath[] = []
    const slotAt = activeSlot(p, i)
    stacks.forEach((stack, k) => {
      const { object, process, frame } = stack
      const layer = stack.layers[i]
      const slot = slotAt(object.slot ?? 0)
      const speed = speedFor(process, doc, printer, i)
      const walls = layer.walls.map((w) => ({ ...w, slot, speed: speed(w.kind) }))
      paths.push(...(process.wallOrder === 'outer-inner' ? walls : [...walls].reverse()))
      if (layer.innermost.length) {
        // Skins: a cell is top skin when fewer than `topLayers` layers cover it above, bottom
        // skin when fewer than `bottomLayers` cover it below; exposed cells are the surfaces.
        const skins = skinMasks(
          layer.inner,
          stack.above[i],
          stack.below[i],
          process.topLayers,
          process.bottomLayers,
          frame,
        )
        const dense = () => hatch(layer.innermost, lineWidth, i % 2 ? 45 : -45)
        let cached: Segment[] | null = null
        const denseIn = (mask: R.Mask) => {
          if (R.isEmpty(mask)) return []
          cached ??= dense()
          return R.equals(mask, layer.inner) ? cached : R.clip(cached, mask)
        }
        for (const [kind, mask] of [
          ['bottom', skins.bottom],
          ['solid', skins.solid],
          ['top', skins.top],
        ] as const)
          for (const seg of denseIn(mask))
            paths.push({
              kind,
              points: seg,
              closed: false,
              object: object.id,
              slot,
              speed: speed(kind),
            })
        if (process.infill > 0 && !R.isEmpty(skins.sparse)) {
          const raw = infill(
            layer.innermost,
            process.infillPattern,
            process.infill / 100,
            lineWidth,
            i,
            z,
          )
          const free = FREEFORM.has(process.infillPattern) || !R.equals(skins.sparse, layer.inner)
          for (const seg of free ? R.clip(raw, skins.sparse) : raw)
            paths.push({
              kind: 'infill',
              points: seg,
              closed: false,
              object: object.id,
              slot,
              speed: speed('infill'),
            })
        }
      }
      const support = supports[k]?.[i]
      if (support && !R.isEmpty(support)) {
        const spacing = Math.max(
          lineWidth * 2,
          (lineWidth * 100) / Math.max(5, process.supportDensity),
        )
        for (const seg of R.lines(support, spacing, i % 2 ? 0 : 90))
          paths.push({ kind: 'support', points: seg, closed: false, slot, speed: speed('support') })
      }
    })
    // Adhesion under the first layer.
    if (i === 0) {
      const outers = stacks.flatMap((stack) =>
        stack.layers[0].loops.filter((l) => !l.hole).map((l) => l.poly),
      )
      const first = speedFor(p, doc, printer, 0)
      if (p.brim)
        for (const poly of outers)
          for (let k = 1; k <= Math.round(p.brimWidth / lineWidth); k++) {
            const ring = offsetPolygon(poly, -lineWidth * (k + 0.5))
            if (ring.length >= 3)
              paths.push({
                kind: 'brim',
                points: ring,
                closed: true,
                slot: slotAt(0),
                speed: first('brim'),
              })
          }
      if (p.skirtLoops > 0 && outers.length) {
        const hull = convexHull(outers.flat())
        for (let k = 0; k < p.skirtLoops; k++) {
          const ring = offsetPolygon(
            hull,
            -(SKIRT_DISTANCE + (p.brim ? p.brimWidth : 0) + lineWidth * (k + 0.5)),
          )
          if (ring.length >= 3)
            paths.push({
              kind: 'skirt',
              points: ring,
              closed: true,
              slot: slotAt(0),
              speed: first('skirt'),
            })
        }
      }
    }
    const area = stacks.reduce(
      (sum, stack) =>
        sum +
        stack.layers[i].loops.reduce(
          (a, l) => a + (l.hole ? -1 : 1) * Math.abs(polygonArea(l.poly)),
          0,
        ),
      0,
    )
    return finishLayer(
      { index: i, z: z + raftHeight, height, area, paths, travels: [], seconds: 0 },
      p,
      printer,
    )
  })
  // The raft: two layers under everything, and every object layer moved up by their height.
  const raft = p.raft
    ? raftLayers(
        stacks.map((s) => s.layers[0].loops.map((l) => l.poly)),
        lineWidth,
        p,
        doc,
        printer,
      )
    : []
  const numbered = [...raft, ...layers].map((l, index) => ({ ...l, index }))
  for (const change of p.changes)
    if (change.slot < 0 && numbered[change.layer - 1]) numbered[change.layer - 1].pause = true
  return { layers: numbered, result: summarize(numbered, doc) }
}

function layerHeights(top: number, first: number, step: number): { z: number; height: number }[] {
  const out: { z: number; height: number }[] = []
  if (top <= 0) return out
  for (let z = first; z < top + 1e-6 && out.length < 20000; z += step)
    out.push({ z: Math.round(z * 1000) / 1000, height: out.length ? step : first })
  return out
}
/** Slice one object at one height: loops, wall paths, and the masks the skins need. */
function objectLayer(
  mesh: number[],
  z: number,
  process: Process,
  lineWidth: number,
  frame: R.Frame,
  index: number,
  object: PlateObject,
): ObjectLayer {
  const loops = classify(chainLoops(sliceMesh(mesh, z)))
  const walls: Toolpath[] = []
  let innermost: Polygon[] = loops.map((l) => l.poly)
  for (let w = 0; w < process.walls; w++) {
    const pass = loops
      .map((l) => offsetPolygon(l.poly, (l.hole ? -1 : 1) * lineWidth * (w + 0.5)))
      .filter((poly) => poly.length >= 3)
    if (!pass.length) break
    for (const poly of pass)
      walls.push({
        kind: w === 0 ? 'outer' : 'inner',
        points: seamStart(poly, process.seam, index),
        closed: true,
        object: object.id,
        slot: 0,
        speed: 0,
      })
    innermost = pass
  }
  const region = innermost
    .map((poly) => offsetPolygon(poly, lineWidth * 0.5))
    .filter((r) => r.length >= 3)
  return {
    loops,
    section: R.rasterize(
      loops.map((l) => l.poly),
      frame,
    ),
    inner: R.rasterize(region, frame),
    walls,
    innermost: region,
  }
}
const FREEFORM = new Set<InfillPattern>(['honeycomb', 'gyroid'])
/**
 * For every cell of every layer, how many consecutive layers above (and below) are material.
 * One pass each way replaces a window of mask intersections per layer.
 */
function coverageRuns(
  layers: ObjectLayer[],
  frame: R.Frame,
): { above: Uint16Array[]; below: Uint16Array[] } {
  const cells = frame.cols * frame.rows
  const above: Uint16Array[] = new Array(layers.length)
  const below: Uint16Array[] = new Array(layers.length)
  let run = new Uint16Array(cells)
  for (let i = layers.length - 1; i >= 0; i--) {
    // above[i] counts layers strictly above i that cover each cell, stopping at the first gap.
    above[i] = run
    const next = new Uint16Array(cells)
    const bits = layers[i].section.bits
    for (let c = 0; c < cells; c++) next[c] = bits[c] ? run[c] + 1 : 0
    run = next
  }
  run = new Uint16Array(cells)
  for (let i = 0; i < layers.length; i++) {
    below[i] = run
    const next = new Uint16Array(cells)
    const bits = layers[i].section.bits
    for (let c = 0; c < cells; c++) next[c] = bits[c] ? run[c] + 1 : 0
    run = next
  }
  return { above, below }
}
/** Split the interior of a layer into exposed top, exposed bottom, internal solid, and sparse. */
function skinMasks(
  inner: R.Mask,
  above: Uint16Array,
  below: Uint16Array,
  topLayers: number,
  bottomLayers: number,
  frame: R.Frame,
) {
  const top = R.emptyMask(frame)
  const bottom = R.emptyMask(frame)
  const solid = R.emptyMask(frame)
  const sparse = R.emptyMask(frame)
  for (let c = 0; c < inner.bits.length; c++) {
    if (!inner.bits[c]) continue
    if (above[c] === 0) top.bits[c] = 1
    else if (below[c] === 0) bottom.bits[c] = 1
    else if (above[c] < topLayers || below[c] < bottomLayers) solid.bits[c] = 1
    else sparse.bits[c] = 1
  }
  return { top, bottom, solid, sparse }
}
/**
 * Where supports stand under this object: cells of a layer that nothing supports within the
 * overhang angle, grown downward until they meet material or the bed, with a one-cell gap
 * around the part so the support breaks away.
 */
function supportMasks(
  stack: ObjectLayer[],
  heights: { height: number }[],
  process: Process,
  frame: R.Frame,
): R.Mask[] {
  const out: R.Mask[] = new Array(stack.length)
  const tan = Math.tan((process.supportAngle * Math.PI) / 180)
  let carried = R.emptyMask(frame)
  for (let i = stack.length - 1; i >= 0; i--) {
    // An overhang at layer i: material not within the allowed slope of the material some layers below.
    const height = heights[i].height
    const back = Math.max(1, Math.ceil(frame.cell / Math.max(1e-6, height / tan)))
    const reference =
      i - back >= 0
        ? R.dilate(stack[i - back].section, 1)
        : i === 0
          ? R.fullMask(frame)
          : R.emptyMask(frame)
    const overhang =
      i === 0 ? R.emptyMask(frame) : R.erode(R.dilate(R.minus(stack[i].section, reference), 0), 1)
    // Whatever needed support above this layer keeps needing it here, unless the part fills it.
    out[i] = R.minus(carried, R.dilate(stack[i].section, 1))
    carried = R.or(out[i], overhang)
  }
  return out
}
/** Raft layers under the whole plate: a coarse base and a dense interface. */
function raftLayers(
  firstLoops: Polygon[][],
  lineWidth: number,
  p: Process,
  doc: SlicerDocument,
  printer: ReturnType<typeof printerProfile>,
): Layer[] {
  const pts = firstLoops.flat(2)
  if (!pts.length) return []
  const min = { x: Math.min(...pts.map((q) => q.x)), y: Math.min(...pts.map((q) => q.y)) }
  const max = { x: Math.max(...pts.map((q) => q.x)), y: Math.max(...pts.map((q) => q.y)) }
  const frame = R.frameFor(min, max, RAFT_MARGIN + 1, 1)
  const footprint = firstLoops.reduce(
    (m, loops) => R.or(m, R.rasterize(loops, frame)),
    R.emptyMask(frame),
  )
  const area = R.dilate(footprint, Math.round(RAFT_MARGIN / frame.cell))
  const speed = speedFor(p, doc, printer, 0)
  const base: Toolpath[] = R.lines(area, 2, 0).map((s) => ({
    kind: 'raft',
    points: s,
    closed: false,
    slot: 0,
    speed: speed('raft'),
  }))
  const interface_: Toolpath[] = R.lines(area, lineWidth * 1.5, 90).map((s) => ({
    kind: 'raft',
    points: s,
    closed: false,
    slot: 0,
    speed: speed('raft'),
  }))
  const size = R.count(area) * frame.cell ** 2
  return [
    finishLayer(
      {
        index: 0,
        z: RAFT_BASE,
        height: RAFT_BASE,
        area: size,
        paths: base,
        travels: [],
        seconds: 0,
      },
      p,
      printer,
    ),
    finishLayer(
      {
        index: 1,
        z: RAFT_BASE + RAFT_TOP,
        height: RAFT_TOP,
        area: size,
        paths: interface_,
        travels: [],
        seconds: 0,
      },
      p,
      printer,
    ),
  ]
}
/** Which AMS slot prints at a layer: the last change at or before it, else the object's own. */
function activeSlot(p: Process, layer: number) {
  const changes = [...p.changes]
    .sort((a, b) => a.layer - b.layer)
    .filter((c) => c.layer - 1 <= layer && c.slot >= 0)
  const forced = changes.at(-1)
  return (own: number) => (forced ? forced.slot : own)
}
/** Outer loops wind counter-clockwise, holes clockwise: nesting depth decides which is which. */
function classify(loops: Polygon[]): Loop[] {
  return loops
    .filter((poly) => Math.abs(polygonArea(poly)) > 0.01)
    .map((poly) => {
      const probe = poly[0]
      const depth = loops.filter((other) => other !== poly && contains(other, probe)).length
      const hole = depth % 2 === 1
      const ccw = polygonArea(poly) >= 0
      return { poly: ccw === !hole ? poly : [...poly].reverse(), hole }
    })
}
function contains(poly: Polygon, p: Vec2): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]
    const b = poly[j]
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x)
      inside = !inside
  }
  return inside
}
/** Rotate a closed loop so it starts where the seam should be. */
function seamStart(poly: Polygon, seam: Process['seam'], layer: number): Polygon {
  if (poly.length < 3) return poly
  let start = 0
  if (seam === 'random') start = (layer * 7919 + poly.length * 31) % poly.length
  else {
    let best = -Infinity
    poly.forEach((p, i) => {
      const score = seam === 'back' ? p.y : p.x + p.y
      if (score > best) {
        best = score
        start = i
      }
    })
  }
  return [...poly.slice(start), ...poly.slice(0, start)]
}
function convexHull(points: Vec2[]): Polygon {
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y)
  if (pts.length < 3) return pts
  const cross = (o: Vec2, a: Vec2, b: Vec2) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
  const lower: Vec2[] = []
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0)
      lower.pop()
    lower.push(p)
  }
  const upper: Vec2[] = []
  for (const p of [...pts].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0)
      upper.pop()
    upper.push(p)
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)]
}

// --- Infill patterns -------------------------------------------------------------------------------
function infill(
  region: Polygon[],
  pattern: InfillPattern,
  density: number,
  lineWidth: number,
  layer: number,
  z: number,
): Vec2[][] {
  const spacing = lineWidth / Math.max(0.02, density)
  switch (pattern) {
    case 'grid':
      return [...hatch(region, spacing * 2, 45), ...hatch(region, spacing * 2, -45)]
    case 'lines':
      return hatch(region, spacing, layer % 2 ? 45 : -45)
    case 'triangles':
      return [0, 60, 120].flatMap((a) => hatch(region, spacing * 3, a))
    case 'cubic':
      // Three directions whose phase walks with height, so the cells tilt into cubes.
      return [0, 60, 120].flatMap((a, k) =>
        hatch(region, spacing * 3, a, (z * Math.SQRT2 + (k * spacing * 3) / 3) % (spacing * 3)),
      )
    case 'honeycomb':
      return honeycomb(region, spacing * 2.6, lineWidth)
    case 'gyroid':
      return gyroid(region, spacing * 2, z)
    case 'concentric':
      return concentric(region, spacing)
    case 'lightning':
      return hatch(region, spacing * 3, layer % 2 ? 45 : -45)
  }
}
/** Hexagonal cells drawn as three families of zigzag lines, clipped to the region. */
function honeycomb(region: Polygon[], size: number, lineWidth: number): Vec2[][] {
  const pts = region.flat()
  if (!pts.length) return []
  const minX = Math.min(...pts.map((p) => p.x)) - size
  const maxX = Math.max(...pts.map((p) => p.x)) + size
  const minY = Math.min(...pts.map((p) => p.y)) - size
  const maxY = Math.max(...pts.map((p) => p.y)) + size
  const h = (size * Math.sqrt(3)) / 2
  const raw: Segment[] = []
  // Each hexagon row is a zigzag; two zigzags per row height give the honeycomb.
  for (let y = minY, row = 0; y <= maxY; y += h, row++) {
    const zig: Vec2[] = []
    for (let x = minX + (row % 2 ? size * 0.75 : 0); x <= maxX; x += size * 1.5) {
      zig.push(
        { x, y },
        { x: x + size * 0.25, y: y + h / 2 },
        { x: x + size * 0.75, y: y + h / 2 },
        { x: x + size, y },
      )
      zig.push(
        { x: x + size, y },
        { x: x + size * 1.25, y: y - h / 2 },
        { x: x + size * 1.75, y: y - h / 2 },
      )
    }
    for (let i = 1; i < zig.length; i++) raw.push([zig[i - 1], zig[i]])
  }
  void lineWidth
  return raw
}
/** The gyroid surface sin x cos y + sin y cos z + sin z cos x = 0 cut at this height. */
function gyroid(region: Polygon[], period: number, z: number): Vec2[][] {
  const pts = region.flat()
  if (!pts.length) return []
  const minX = Math.min(...pts.map((p) => p.x))
  const maxX = Math.max(...pts.map((p) => p.x))
  const minY = Math.min(...pts.map((p) => p.y))
  const maxY = Math.max(...pts.map((p) => p.y))
  const k = (Math.PI * 2) / period
  const step = period / 8
  const cols = Math.ceil((maxX - minX) / step) + 1
  const rows = Math.ceil((maxY - minY) / step) + 1
  const f = (c: number, r: number) => {
    const x = (minX + c * step) * k
    const y = (minY + r * step) * k
    const zz = z * k
    return Math.sin(x) * Math.cos(y) + Math.sin(y) * Math.cos(zz) + Math.sin(zz) * Math.cos(x)
  }
  const values = new Float32Array(cols * rows)
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) values[r * cols + c] = f(c, r)
  const raw: Segment[] = []
  const at = (c: number, r: number): Vec2 => ({ x: minX + c * step, y: minY + r * step })
  const lerp = (a: Vec2, b: Vec2, va: number, vb: number): Vec2 => {
    const t = va / (va - vb)
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
  }
  // Marching squares: each cell's zero crossings join into a segment.
  for (let r = 0; r + 1 < rows; r++)
    for (let c = 0; c + 1 < cols; c++) {
      const v = [
        values[r * cols + c],
        values[r * cols + c + 1],
        values[(r + 1) * cols + c + 1],
        values[(r + 1) * cols + c],
      ]
      const corner = [at(c, r), at(c + 1, r), at(c + 1, r + 1), at(c, r + 1)]
      const crossings: Vec2[] = []
      for (let e = 0; e < 4; e++) {
        const j = (e + 1) % 4
        if (v[e] < 0 !== v[j] < 0) crossings.push(lerp(corner[e], corner[j], v[e], v[j]))
      }
      if (crossings.length === 2) raw.push([crossings[0], crossings[1]])
      else if (crossings.length === 4)
        raw.push([crossings[0], crossings[1]], [crossings[2], crossings[3]])
    }
  return chainPolylines(raw)
}
/** Rings offset inward until nothing is left. */
function concentric(region: Polygon[], spacing: number): Vec2[][] {
  const out: Vec2[][] = []
  for (const poly of region) {
    let ring = poly
    for (let guard = 0; guard < 500 && ring.length >= 3; guard++) {
      ring = offsetPolygon(ring, spacing)
      if (ring.length < 3) break
      out.push([...ring, ring[0]])
    }
  }
  return out
}
/** Chain marching-squares pieces end to end into polylines so each curve is one path. */
function chainPolylines(segments: Segment[]): Vec2[][] {
  const key = (p: Vec2) => `${Math.round(p.x * 100)},${Math.round(p.y * 100)}`
  const ends = new Map<string, Segment[]>()
  for (const s of segments) {
    ends.set(key(s[0]), [...(ends.get(key(s[0])) ?? []), s])
    ends.set(key(s[1]), [...(ends.get(key(s[1])) ?? []), s])
  }
  const used = new Set<Segment>()
  const out: Vec2[][] = []
  for (const start of segments) {
    if (used.has(start)) continue
    used.add(start)
    const line: Vec2[] = [start[0], start[1]]
    // Grow from both ends.
    for (const forward of [true, false]) {
      for (let guard = 0; guard < 5000; guard++) {
        const tip = forward ? line[line.length - 1] : line[0]
        const next = (ends.get(key(tip)) ?? []).find((s) => !used.has(s))
        if (!next) break
        used.add(next)
        const other = key(next[0]) === key(tip) ? next[1] : next[0]
        if (forward) line.push(other)
        else line.unshift(other)
      }
    }
    out.push(line)
  }
  return out
}

// --- Speeds and time ---------------------------------------------------------------------------------
function speedFor(
  p: Process,
  doc: SlicerDocument,
  printer: ReturnType<typeof printerProfile>,
  layer: number,
) {
  const factor = SPEED_FACTOR[p.speed]
  const cap = Math.min(
    printer.maxSpeed,
    (FILAMENT_PROFILES[doc.filament.type] ?? FILAMENT_PROFILES.PLA).maxSpeed,
  )
  const base: Record<PathKind, number> = {
    outer: p.outerWallSpeed,
    inner: p.innerWallSpeed,
    infill: p.infillSpeed,
    solid: p.infillSpeed,
    top: p.topSpeed,
    bottom: p.topSpeed,
    brim: p.firstLayerSpeed,
    skirt: p.firstLayerSpeed,
    support: p.infillSpeed,
    raft: p.firstLayerSpeed,
  }
  return (kind: PathKind) => (layer === 0 ? p.firstLayerSpeed : Math.min(cap, base[kind] * factor))
}
/**
 * Travels between paths, then the time with a trapezoidal move model and cooling floor. A
 * planner keeps speed through gentle turns, so a path is timed as runs between sharp corners
 * rather than vertex by vertex.
 */
const SHARP_TURN = Math.cos((35 * Math.PI) / 180)
function finishLayer(layer: Layer, p: Process, printer: ReturnType<typeof printerProfile>): Layer {
  const a = printer.acceleration
  const moveTime = (length: number, v: number) => {
    // Reaching v takes v²/(2a); a short move never gets there.
    const ramp = (v * v) / (2 * a)
    return length >= 2 * ramp ? length / v + v / a : 2 * Math.sqrt(length / a)
  }
  let seconds = 0
  let last: Vec2 | null = null
  const travels: Segment[] = []
  for (const path of layer.paths) {
    const pts = path.closed ? [...path.points, path.points[0]] : path.points
    if (last) {
      const d = Math.hypot(pts[0].x - last.x, pts[0].y - last.y)
      if (d > 0.01) {
        travels.push([last, pts[0]])
        seconds += moveTime(d, p.travelSpeed)
        if (d > RETRACT_MIN_TRAVEL && p.retractLength > 0)
          seconds += (2 * p.retractLength) / p.retractSpeed + (p.zHop ? 0.1 : 0)
      }
    }
    let run = 0
    let dx = 0
    let dy = 0
    for (let i = 1; i < pts.length; i++) {
      const ex = pts[i].x - pts[i - 1].x
      const ey = pts[i].y - pts[i - 1].y
      const length = Math.hypot(ex, ey)
      if (length < 1e-9) continue
      const turn = run ? (dx * ex + dy * ey) / (Math.hypot(dx, dy) * length) : 1
      if (turn < SHARP_TURN) {
        seconds += moveTime(run, path.speed)
        run = 0
      }
      run += length
      dx = ex
      dy = ey
    }
    seconds += moveTime(run, path.speed)
    last = pts[pts.length - 1]
  }
  seconds = Math.max(seconds, layer.paths.length ? p.minLayerTime : 0) + LAYER_CHANGE_SECONDS
  return { ...layer, travels, seconds: Math.round(seconds * 100) / 100 }
}
function summarize(layers: Layer[], doc: SlicerDocument): SliceResult {
  const slots = allSlots(doc)
  const byType: Record<string, number> = {}
  const volumeBySlot: number[] = slots.map(() => 0)
  let seconds = 0
  for (const layer of layers) {
    seconds += layer.seconds
    if (layer.pause) seconds += FILAMENT_CHANGE_SECONDS
    const total =
      layer.paths.reduce((s, path) => s + pathLength(path) / Math.max(1, path.speed), 0) || 1
    for (const path of layer.paths) {
      const length = pathLength(path)
      const volume = length * doc.nozzle * layer.height
      const slot = Math.min(slots.length - 1, Math.max(0, path.slot))
      volumeBySlot[slot] += volume
      byType[path.kind] =
        (byType[path.kind] ?? 0) + (layer.seconds * (length / Math.max(1, path.speed))) / total
    }
  }
  const gramsBySlot = volumeBySlot.map((v, i) => (v / 1000) * filamentDensity(slots[i]))
  const grams = gramsBySlot.reduce((a, b) => a + b, 0)
  const volume = volumeBySlot.reduce((a, b) => a + b, 0)
  const cost = gramsBySlot.reduce((sum, g, i) => sum + (g / 1000) * filamentPrice(slots[i]), 0)
  return {
    seconds: Math.round(seconds),
    grams: Math.round(grams * 10) / 10,
    meters: Math.round((volume / FILAMENT_AREA / 1000) * 100) / 100,
    layers: layers.length,
    cost: Math.round(cost * 100) / 100,
    byType: Object.fromEntries(Object.entries(byType).map(([k, v]) => [k, Math.round(v)])),
    bySlot: gramsBySlot.map((g) => Math.round(g * 10) / 10),
  }
}
const zero = (): SliceResult => ({ seconds: 0, grams: 0, meters: 0, layers: 0, cost: 0 })
export function pathLength(path: Toolpath): number {
  if (path.closed) return polygonPerimeter(path.points)
  let l = 0
  for (let i = 1; i < path.points.length; i++)
    l += segmentLength([path.points[i - 1], path.points[i]])
  return l
}

// --- G-code ---------------------------------------------------------------------------------------------
/**
 * Marlin-flavoured G-code for the sliced plate, in the style Bambu Studio and PrusaSlicer write:
 * absolute XY, relative E, retraction with z-hop on long travels, fan after the first layer,
 * progress reports, typed sections, tool changes for AMS slots, and M600 pauses for manual
 * spool changes. Coordinates are shifted for corner-origin printers.
 */
export function toGcode(sliced: SlicedPlate, raw: SlicerDocument, title: string): string {
  const doc = normalizeSlicer(raw)
  const p = doc.process
  const printer = printerProfile(doc.printer)
  const slots = allSlots(doc)
  const temps = filamentTemps(doc.filament)
  const nozzle = p.nozzleTemp || temps.nozzleTemp
  const bed = p.bedTemp || temps.bedTemp
  const shift =
    printer.origin === 'corner' ? { x: printer.bed.x / 2, y: printer.bed.y / 2 } : { x: 0, y: 0 }
  const f = (n: number) => n.toFixed(3)
  const X = (x: number) => f(x + shift.x)
  const Y = (y: number) => f(y + shift.y)
  const r = sliced.result
  const h = Math.floor(r.seconds / 3600)
  const m = Math.floor((r.seconds % 3600) / 60)
  const lines = [
    `; ${title} — sliced by Junga Slicer`,
    ';FLAVOR:Marlin',
    `; printer: ${doc.printer}, nozzle ${doc.nozzle} mm`,
    `; filament: ${slots.map((s, i) => `T${i} ${s.type} ${s.color}`).join(', ')}`,
    `; layer_height = ${p.layerHeight}`,
    `; first_layer_height = ${p.firstLayerHeight}`,
    `; estimated printing time (normal mode) = ${h}h ${m}m ${r.seconds % 60}s`,
    `; filament used [g] = ${r.grams}`,
    `; filament used [m] = ${r.meters}`,
    `; total layers = ${r.layers}`,
    'M73 P0 R' + Math.ceil(r.seconds / 60),
    `M104 S${nozzle}`,
    `M140 S${bed}`,
    'G28',
    `M109 S${nozzle}`,
    `M190 S${bed}`,
    'G90',
    'M83',
    'G92 E0',
    'M107',
    'T0',
  ]
  let slot = 0
  let x = 0
  let y = 0
  let retracted = false
  const retract = () => {
    if (retracted || !p.retractLength) return
    lines.push(`G1 E-${f(p.retractLength)} F${Math.round(p.retractSpeed * 60)}`)
    retracted = true
  }
  const unretract = () => {
    if (!retracted) return
    lines.push(`G1 E${f(p.retractLength)} F${Math.round(p.retractSpeed * 60)}`)
    retracted = false
  }
  const total = sliced.layers.length
  let elapsed = 0
  sliced.layers.forEach((layer) => {
    lines.push(
      ';LAYER_CHANGE',
      `;Z:${f(layer.z)}`,
      `;HEIGHT:${f(layer.height)}`,
      `;LAYER:${layer.index}`,
    )
    if (layer.pause) lines.push('; manual filament change', 'M600')
    if (layer.index === 1 && p.fanSpeed > 0)
      lines.push(`M106 S${Math.round((p.fanSpeed * 255) / 100)}`)
    lines.push(`G1 Z${f(layer.z)} F600`)
    for (const path of layer.paths) {
      if (path.slot !== slot && slots[path.slot]) {
        slot = path.slot
        lines.push(`T${slot}`)
      }
      const pts = path.closed ? [...path.points, path.points[0]] : path.points
      const d = Math.hypot(pts[0].x - x, pts[0].y - y)
      lines.push(`;TYPE:${PATH_LABELS[path.kind]}`)
      if (d > 0.01) {
        const hop = d > RETRACT_MIN_TRAVEL && p.zHop > 0
        if (d > RETRACT_MIN_TRAVEL) retract()
        if (hop) lines.push(`G1 Z${f(layer.z + p.zHop)} F600`)
        lines.push(`G0 X${X(pts[0].x)} Y${Y(pts[0].y)} F${Math.round(p.travelSpeed * 60)}`)
        if (hop) lines.push(`G1 Z${f(layer.z)} F600`)
        unretract()
      }
      const feed = Math.round(path.speed * 60)
      for (let i = 1; i < pts.length; i++) {
        const length = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
        const e = (length * doc.nozzle * layer.height) / FILAMENT_AREA
        lines.push(`G1 X${X(pts[i].x)} Y${Y(pts[i].y)} E${e.toFixed(5)} F${feed}`)
      }
      x = pts[pts.length - 1].x
      y = pts[pts.length - 1].y
    }
    elapsed += layer.seconds
    if (layer.index % 10 === 0 || layer.index === total - 1)
      lines.push(
        `M73 P${Math.min(100, Math.round((100 * (layer.index + 1)) / total))} R${Math.max(0, Math.ceil((r.seconds - elapsed) / 60))}`,
      )
  })
  lines.push(
    'M107',
    'M104 S0',
    'M140 S0',
    'G91',
    'G1 E-2 F1800',
    'G1 Z10 F600',
    'G90',
    'M84',
    '; end',
  )
  return lines.join('\n')
}
