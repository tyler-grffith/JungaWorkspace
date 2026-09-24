// The painting engine. A filament stack and a layer height give a colour ramp: the colour you
// see when the print is k layers tall, with each filament tinting what lies beneath it until it
// reaches its transmission distance. Every image pixel picks the ramp step nearest its colour;
// that step is the pixel's height. From those heights come the printed preview, the heightmap,
// the swap plan, and a stepped relief mesh. Pure functions, tested without a browser.
import type { Mesh } from '../workbench/geometry'
import {
  gridFor,
  normalizeStack,
  printedHeight,
  totalHeight,
  type Filament,
  type PainterDocument,
} from './model'

export type RGB = [number, number, number]
export type RampStep = { layer: number; height: number; color: RGB; filament: Filament }
export type Painting = {
  cols: number
  rows: number
  /** Layer count per pixel, row-major from the top-left. */
  layers: Uint8Array
  /** What the print will look like, RGBA row-major. */
  preview: Uint8ClampedArray
}
export type Swap = { layer: number; height: number; filament: Filament }

export function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
export const rgbToHex = ([r, g, b]: RGB) =>
  `#${((Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b)).toString(16).padStart(6, '0')}`
const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
]

/** The colour at every layer count from 1 to the top. */
export function ramp(doc: PainterDocument): RampStep[] {
  const { stack, layerHeight, maxLayers } = normalizeStack(doc)
  const steps: RampStep[] = []
  let below: RGB = hexToRgb(stack[0].color)
  let current = stack[0]
  let previous: RGB = below
  for (let layer = 1; layer <= maxLayers; layer++) {
    const next = stack.filter((f) => f.startLayer <= layer).at(-1) ?? stack[0]
    if (next !== current) {
      current = next
      below = previous
    }
    const thickness = (layer - current.startLayer + 1) * layerHeight
    const color =
      current === stack[0]
        ? hexToRgb(current.color)
        : mix(below, hexToRgb(current.color), Math.min(1, thickness / current.td))
    steps.push({ layer, height: layer * layerHeight, color, filament: current })
    previous = color
  }
  return steps
}

/** Where the printer pauses for a new spool: every stack entry above the base. */
export function swapPlan(doc: PainterDocument): Swap[] {
  const { stack, layerHeight } = normalizeStack(doc)
  return stack.slice(1).map((filament) => ({
    layer: filament.startLayer,
    height: Math.round((filament.startLayer - 1) * layerHeight * 1000) / 1000,
    filament,
  }))
}

/** Weighted RGB distance; cheap and close enough to perception for picking a ramp step. */
const distance = (a: RGB, r: number, g: number, b: number) =>
  2 * (a[0] - r) ** 2 + 4 * (a[1] - g) ** 2 + 3 * (a[2] - b) ** 2

/**
 * Turn RGBA pixels (already scaled to the working grid) into layer counts and a preview.
 * Brightness and contrast apply first; transparent pixels fall to the base.
 */
export function paint(
  pixels: Uint8ClampedArray,
  cols: number,
  rows: number,
  doc: PainterDocument,
): Painting {
  const steps = ramp(doc).slice(doc.baseLayers - 1)
  const { brightness, contrast } = doc.adjust
  const adjust = (v: number) => Math.max(0, Math.min(255, (v - 128) * contrast + 128 + brightness))
  const layers = new Uint8Array(cols * rows)
  const preview = new Uint8ClampedArray(cols * rows * 4)
  const cache = new Map<number, number>()
  for (let i = 0; i < cols * rows; i++) {
    const at = i * 4
    let best = 0
    if (pixels[at + 3] >= 8) {
      const r = adjust(pixels[at])
      const g = adjust(pixels[at + 1])
      const b = adjust(pixels[at + 2])
      // Quantise to 5 bits per channel: photos repeat colours, so most lookups are hits.
      const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)
      const hit = cache.get(key)
      if (hit !== undefined) best = hit
      else {
        let bestDistance = Infinity
        for (let s = 0; s < steps.length; s++) {
          const d = distance(steps[s].color, r, g, b)
          if (d < bestDistance) {
            bestDistance = d
            best = s
          }
        }
        cache.set(key, best)
      }
    }
    layers[i] = steps[best].layer
    const [r, g, b] = steps[best].color
    preview[at] = r
    preview[at + 1] = g
    preview[at + 2] = b
    preview[at + 3] = 255
  }
  return { cols, rows, layers, preview }
}

/** A coarser painting by averaging layer counts over blocks, for a light 3D preview or the slicer. */
export function downsample(painting: Painting, maxCells: number): Painting {
  const cells = painting.cols * painting.rows
  if (cells <= maxCells) return painting
  const factor = Math.ceil(Math.sqrt(cells / maxCells))
  const cols = Math.ceil(painting.cols / factor)
  const rows = Math.ceil(painting.rows / factor)
  const layers = new Uint8Array(cols * rows)
  const preview = new Uint8ClampedArray(cols * rows * 4)
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      let sum = 0
      let count = 0
      const rgb = [0, 0, 0]
      for (let y = r * factor; y < Math.min(painting.rows, (r + 1) * factor); y++)
        for (let x = c * factor; x < Math.min(painting.cols, (c + 1) * factor); x++) {
          const i = y * painting.cols + x
          sum += painting.layers[i]
          rgb[0] += painting.preview[i * 4]
          rgb[1] += painting.preview[i * 4 + 1]
          rgb[2] += painting.preview[i * 4 + 2]
          count++
        }
      const i = r * cols + c
      layers[i] = Math.round(sum / count)
      preview.set([rgb[0] / count, rgb[1] / count, rgb[2] / count, 255], i * 4)
    }
  return { cols, rows, layers, preview }
}

/**
 * The relief as a closed, stepped mesh: one flat top per pixel, walls where neighbours differ,
 * outer walls down to the bed, and a bottom. Centred on the origin, resting on z = 0. Each
 * triangle also gets the colour of the cell it belongs to, for a painted 3D preview.
 */
export function relief(painting: Painting, doc: PainterDocument): { mesh: Mesh; colors: string[] } {
  const { cols, rows, layers, preview } = painting
  const cell = doc.width / cols
  const width = cols * cell
  const depth = rows * cell
  const x = (c: number) => -width / 2 + c * cell
  const y = (r: number) => depth / 2 - r * cell
  const z = (i: number) => layers[i] * doc.layerHeight
  const mesh: Mesh = []
  const colors: string[] = []
  let color = ''
  const tri = (...p: number[]) => {
    mesh.push(...p)
    colors.push(color)
  }
  const wall = (px: number, py: number, qx: number, qy: number, lo: number, hi: number) => {
    // A vertical quad from p to q between two heights, facing right of p→q.
    tri(px, py, lo, qx, qy, lo, qx, qy, hi)
    tri(px, py, lo, qx, qy, hi, px, py, hi)
  }
  const heightAt = (c: number, r: number) =>
    c < 0 || r < 0 || c >= cols || r >= rows ? 0 : z(r * cols + c)
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c
      const h = z(i)
      color = rgbToHex([preview[i * 4], preview[i * 4 + 1], preview[i * 4 + 2]])
      const [x0, x1, y0, y1] = [x(c), x(c + 1), y(r + 1), y(r)]
      // Top, counter-clockwise seen from above.
      tri(x0, y0, h, x1, y0, h, x1, y1, h)
      tri(x0, y0, h, x1, y1, h, x0, y1, h)
      // Walls face the lower neighbour; each shared edge is emitted once, by the taller cell.
      const south = heightAt(c, r + 1)
      if (south < h) wall(x0, y0, x1, y0, south, h)
      const north = heightAt(c, r - 1)
      if (north < h) wall(x1, y1, x0, y1, north, h)
      const east = heightAt(c + 1, r)
      if (east < h) wall(x1, y0, x1, y1, east, h)
      const west = heightAt(c - 1, r)
      if (west < h) wall(x0, y1, x0, y0, west, h)
    }
  // Bottom, clockwise seen from above so it faces down.
  color = normalizeStack(doc).stack[0].color
  tri(-width / 2, -depth / 2, 0, -width / 2, depth / 2, 0, width / 2, depth / 2, 0)
  tri(-width / 2, -depth / 2, 0, width / 2, depth / 2, 0, width / 2, -depth / 2, 0)
  return { mesh, colors }
}
export const reliefMesh = (painting: Painting, doc: PainterDocument): Mesh =>
  relief(painting, doc).mesh

/** Numbers for the print sheet. */
export function printStats(doc: PainterDocument, painting: Painting | null) {
  const { cols, rows } = gridFor(doc)
  const area = doc.width * printedHeight(doc)
  const cubicMm = painting
    ? Array.from(painting.layers).reduce((s, l) => s + l, 0) *
      doc.layerHeight *
      (doc.width / painting.cols) ** 2
    : 0
  return {
    cols,
    rows,
    height: Math.round(totalHeight(doc) * 1000) / 1000,
    area: Math.round(area),
    grams: Math.round((cubicMm / 1000) * 1.24 * 10) / 10,
    swaps: swapPlan(doc),
  }
}
/** The swap plan as text to keep next to the printer. */
export function printSheet(title: string, doc: PainterDocument, painting: Painting | null): string {
  const stats = printStats(doc, painting)
  const base = normalizeStack(doc).stack[0]
  const lines = [
    `${title} — PLA Painter print sheet`,
    `Size: ${doc.width} × ${Math.round(printedHeight(doc))} mm, ${stats.height} mm tall`,
    `Layers: ${doc.maxLayers} × ${doc.layerHeight} mm (${doc.baseLayers} base layers)`,
    `Estimated filament: ${stats.grams} g`,
    '',
    `Start with ${base.name} (${base.color})`,
    ...stats.swaps.map(
      (s) =>
        `Layer ${s.layer} at ${s.height} mm: change to ${s.filament.name} (${s.filament.color})`,
    ),
    '',
    'Print at 100% infill with one wall; pause at each listed layer and swap spools.',
  ]
  return lines.join('\n')
}
