// A small real slicer. It cuts the plate's mesh into layers, classifies loops as outlines or
// holes, offsets walls inward, hatches infill (dense on exposed top and bottom layers), and
// sums the paths into time, filament, and cost. The numbers are only as good as this model of
// a printer, but every one of them comes from the toolpaths you can see in Preview, and the
// same paths become G-code.
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
  plateMesh,
  type Process,
  type SliceResult,
  type SlicerDocument,
} from './model'

export type PathKind = 'outer' | 'inner' | 'infill' | 'solid' | 'brim'
export type Toolpath = { kind: PathKind; points: Vec2[]; closed: boolean }
export type Layer = { index: number; z: number; height: number; area: number; paths: Toolpath[] }
export type SlicedPlate = { layers: Layer[]; result: SliceResult }

export const PATH_COLORS: Record<PathKind, string> = {
  outer: '#ff7d38',
  inner: '#d9c85a',
  infill: '#9b5fc0',
  solid: '#7a3a99',
  brim: '#35a7ff',
}
export const PATH_LABELS: Record<PathKind, string> = {
  outer: 'Outer wall',
  inner: 'Inner wall',
  infill: 'Sparse infill',
  solid: 'Solid infill',
  brim: 'Brim',
}
const SOLID_LAYERS = 3
const BRIM_LOOPS = 5
const FILAMENT_AREA = Math.PI * 0.875 ** 2
const DENSITY: Record<SlicerDocument['filament']['type'], number> = {
  PLA: 1.24,
  PETG: 1.27,
  ABS: 1.04,
  TPU: 1.21,
  'PLA-CF': 1.3,
}
const PRICE_PER_GRAM = 0.025
/** mm/s for the standard profile; the others scale it. */
const SPEEDS: Record<PathKind, number> = {
  outer: 200,
  inner: 300,
  infill: 270,
  solid: 250,
  brim: 50,
}
const SPEED_FACTOR: Record<Process['speed'], number> = {
  silent: 0.5,
  standard: 1,
  sport: 1.3,
  ludicrous: 1.6,
}
const TRAVEL_SPEED = 400
/** Short moves never reach full speed; this stands in for acceleration. */
const ACCELERATION_FUDGE = 0.5
const FIRST_LAYER_SPEED = 50

/** Slice the active plate. Empty plates give no layers and a zero result. */
export function slicePlate(doc: SlicerDocument): SlicedPlate {
  const mesh = plateMesh(activePlate(doc))
  const p = doc.process
  const lineWidth = doc.nozzle
  const top = bounds(mesh)?.max.z ?? 0
  const heights = layerHeights(top, p.firstLayerHeight, p.layerHeight)
  const sections = heights.map(({ z, height }) =>
    classify(chainLoops(sliceMesh(mesh, z - height / 2))),
  )
  const layers: Layer[] = heights.map(({ z, height }, i) => {
    const loops = sections[i]
    const paths: Toolpath[] = []
    // Walls: the outermost pass is the outer wall, the rest inner. Holes offset the other way.
    let innermost: Polygon[] = loops.map((l) => l.poly)
    for (let w = 0; w < p.walls; w++) {
      const pass = loops
        .map((l) => offsetPolygon(l.poly, (l.hole ? -1 : 1) * lineWidth * (w + 0.5)))
        .filter((poly) => poly.length >= 3)
      if (!pass.length) break
      for (const poly of pass)
        paths.push({ kind: w === 0 ? 'outer' : 'inner', points: poly, closed: true })
      innermost = pass
    }
    const region = innermost
      .map((poly) => offsetPolygon(poly, lineWidth * 0.5))
      .filter((r) => r.length >= 3)
    const solid = isSolidLayer(i, sections)
    const density = solid ? 1 : p.infill / 100
    if (region.length && density > 0) {
      const kind: PathKind = solid ? 'solid' : 'infill'
      for (const segment of infill(region, p.infillPattern, density, lineWidth, i, solid))
        paths.push({ kind, points: segment, closed: false })
    }
    if (i === 0 && p.brim)
      for (const l of loops)
        if (!l.hole)
          for (let b = 1; b <= BRIM_LOOPS; b++) {
            const ring = offsetPolygon(l.poly, -lineWidth * (b + 0.5))
            if (ring.length >= 3) paths.push({ kind: 'brim', points: ring, closed: true })
          }
    return {
      index: i,
      z,
      height,
      area: loops.reduce((a, l) => a + (l.hole ? -1 : 1) * Math.abs(polygonArea(l.poly)), 0),
      paths,
    }
  })
  return { layers, result: summarize(layers, doc) }
}

function layerHeights(top: number, first: number, step: number): { z: number; height: number }[] {
  const out: { z: number; height: number }[] = []
  if (top <= 0) return out
  for (let z = first; z < top + 1e-6 && out.length < 20000; z += step)
    out.push({ z: Math.round(z * 1000) / 1000, height: out.length ? step : first })
  return out
}
type Loop = { poly: Polygon; hole: boolean }
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
/** Bottom layers, top layers, and any layer whose neighbours shrink (an exposed surface) are solid. */
function isSolidLayer(i: number, sections: Loop[][]): boolean {
  const area = (k: number) =>
    k < 0 || k >= sections.length
      ? 0
      : sections[k].reduce((a, l) => a + (l.hole ? -1 : 1) * Math.abs(polygonArea(l.poly)), 0)
  const here = area(i)
  if (i < SOLID_LAYERS || i >= sections.length - SOLID_LAYERS) return true
  for (let k = 1; k <= SOLID_LAYERS; k++)
    if (area(i + k) < here * 0.92 || area(i - k) < here * 0.92) return true
  return false
}
function infill(
  region: Polygon[],
  pattern: Process['infillPattern'],
  density: number,
  lineWidth: number,
  layer: number,
  solid: boolean,
): Segment[] {
  if (solid) return hatch(region, lineWidth, layer % 2 ? 45 : -45)
  switch (pattern) {
    case 'grid':
      return [
        ...hatch(region, (2 * lineWidth) / density, 45),
        ...hatch(region, (2 * lineWidth) / density, -45),
      ]
    case 'triangles':
    case 'honeycomb':
      return hatch(
        region,
        (3 * lineWidth) / density,
        [0, 60, 120][layer % 3],
        pattern === 'honeycomb' ? layer : 0,
      )
    case 'gyroid':
      return hatch(region, lineWidth / density, layer % 2 ? 0 : 90)
    case 'lightning':
      return hatch(region, (3 * lineWidth) / density, layer % 2 ? 45 : -45)
  }
}
function summarize(layers: Layer[], doc: SlicerDocument): SliceResult {
  const factor = SPEED_FACTOR[doc.process.speed]
  let volume = 0
  let seconds = 0
  for (const layer of layers) {
    let last: Vec2 | null = null
    for (const path of layer.paths) {
      const length = pathLength(path)
      volume += length * doc.nozzle * layer.height
      const speed = layer.index === 0 ? FIRST_LAYER_SPEED : SPEEDS[path.kind] * factor
      seconds += length / (speed * ACCELERATION_FUDGE)
      if (last)
        seconds += Math.hypot(path.points[0].x - last.x, path.points[0].y - last.y) / TRAVEL_SPEED
      last = path.points.at(-1) ?? null
    }
    seconds += 1
  }
  const grams = (volume / 1000) * DENSITY[doc.filament.type]
  return {
    seconds: Math.round(seconds),
    grams: Math.round(grams * 10) / 10,
    meters: Math.round((volume / FILAMENT_AREA / 1000) * 100) / 100,
    layers: layers.length,
    cost: Math.round(grams * PRICE_PER_GRAM * 100) / 100,
  }
}
export function pathLength(path: Toolpath): number {
  if (path.closed) return polygonPerimeter(path.points)
  let l = 0
  for (let i = 1; i < path.points.length; i++)
    l += segmentLength([path.points[i - 1], path.points[i]])
  return l
}

/** Plain Marlin-style G-code for the sliced plate: absolute XY, absolute E, one line per move. */
export function toGcode(sliced: SlicedPlate, doc: SlicerDocument, title: string): string {
  const p = doc.process
  const factor = SPEED_FACTOR[p.speed]
  const lines = [
    `; ${title} — sliced by Junga Slicer`,
    `; printer: ${doc.printer}, nozzle ${doc.nozzle} mm, ${doc.filament.type}`,
    `; ${sliced.result.layers} layers, ${sliced.result.grams} g, ${sliced.result.seconds} s`,
    `M104 S${p.nozzleTemp}`,
    `M140 S${p.bedTemp}`,
    'G28',
    `M109 S${p.nozzleTemp}`,
    `M190 S${p.bedTemp}`,
    'G90',
    'M82',
    'G92 E0',
  ]
  let e = 0
  const f = (n: number) => n.toFixed(3)
  for (const layer of sliced.layers) {
    lines.push(`;LAYER:${layer.index}`, `G1 Z${f(layer.z)} F600`)
    for (const path of layer.paths) {
      const points = path.closed ? [...path.points, path.points[0]] : path.points
      const speed = layer.index === 0 ? FIRST_LAYER_SPEED : SPEEDS[path.kind] * factor
      lines.push(
        `;TYPE:${PATH_LABELS[path.kind]}`,
        `G0 X${f(points[0].x)} Y${f(points[0].y)} F${TRAVEL_SPEED * 60}`,
      )
      for (let i = 1; i < points.length; i++) {
        const length = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
        e += (length * doc.nozzle * layer.height) / FILAMENT_AREA
        lines.push(
          `G1 X${f(points[i].x)} Y${f(points[i].y)} E${e.toFixed(5)} F${Math.round(speed * 60)}`,
        )
      }
    }
  }
  lines.push('M104 S0', 'M140 S0', 'G91', 'G1 Z10 F600', 'G90', 'M84', '; end')
  return lines.join('\n')
}
