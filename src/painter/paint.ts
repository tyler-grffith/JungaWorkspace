// The painting engine. A filament stack and a layer height give a colour ramp: the colour you
// see when the print is k layers tall, with each filament tinting what lies beneath it in
// linear light until it reaches its transmission distance. Every image pixel (after blur,
// sharpening, gamma, and the adjustments) picks the ramp step nearest its colour by ΔE2000 or
// weighted RGB, with optional error diffusion; that step is the pixel's height. From those
// heights come the printed preview, the heightmap, the view at any layer, the swap plan, a
// stepped relief mesh with a frame, and the print estimate. The optimisers here place the swaps
// and pick filaments by minimising the same error. Pure functions, tested without a browser.
import type { Mesh } from '../workbench/geometry'
import { deltaE2000, hexToRgb, mixLinear, rgbToHex, rgbToLab, type RGB } from './color'
import {
  frameOf,
  gridFor,
  normalizeStack,
  printedHeight,
  renderOf,
  totalHeight,
  type Filament,
  type PainterDocument,
  type Render,
} from './model'

export type { RGB } from './color'
export { hexToRgb, rgbToHex } from './color'
export type RampStep = { layer: number; height: number; color: RGB; filament: Filament }
export type Painting = {
  cols: number
  rows: number
  /** Layer count per pixel, row-major from the top-left. */
  layers: Uint8Array
  /** What the print will look like, RGBA row-major. */
  preview: Uint8ClampedArray
  /** The picture as matched (after processing), RGBA row-major. */
  source?: Uint8ClampedArray
  /** Mean ΔE2000 between the picture and the print. */
  error?: number
}
export type Swap = { layer: number; height: number; filament: Filament }

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
        : mixLinear(below, hexToRgb(current.color), Math.min(1, thickness / current.td))
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

// --- Picture processing ------------------------------------------------------------------------
/** Brightness, contrast, gamma, saturation, blur, and sharpening, in that order. */
export function processPixels(
  pixels: Uint8ClampedArray,
  cols: number,
  rows: number,
  doc: PainterDocument,
): Uint8ClampedArray {
  const r = renderOf(doc)
  const { brightness, contrast } = doc.adjust
  const lut = new Uint8ClampedArray(256)
  for (let v = 0; v < 256; v++) {
    const adjusted = (v - 128) * contrast + 128 + brightness
    lut[v] = 255 * Math.pow(Math.max(0, Math.min(255, adjusted)) / 255, 1 / r.gamma)
  }
  let out: Uint8ClampedArray = new Uint8ClampedArray(pixels.length)
  for (let i = 0; i < pixels.length; i += 4) {
    let red = lut[pixels[i]]
    let green = lut[pixels[i + 1]]
    let blue = lut[pixels[i + 2]]
    if (r.saturation !== 1) {
      const grey = 0.299 * red + 0.587 * green + 0.114 * blue
      red = grey + (red - grey) * r.saturation
      green = grey + (green - grey) * r.saturation
      blue = grey + (blue - grey) * r.saturation
    }
    out[i] = red
    out[i + 1] = green
    out[i + 2] = blue
    out[i + 3] = pixels[i + 3]
  }
  if (r.blur > 0) out = boxBlur(out, cols, rows, Math.round(r.blur))
  if (r.sharpen > 0) {
    const soft = boxBlur(out, cols, rows, 1)
    const sharp = new Uint8ClampedArray(out.length)
    for (let i = 0; i < out.length; i++)
      sharp[i] = i % 4 === 3 ? out[i] : out[i] + (out[i] - soft[i]) * r.sharpen
    out = sharp
  }
  return out
}
function boxBlur(
  px: Uint8ClampedArray,
  cols: number,
  rows: number,
  radius: number,
): Uint8ClampedArray {
  const pass = (src: Uint8ClampedArray, horizontal: boolean) => {
    const out = new Uint8ClampedArray(src.length)
    const outer = horizontal ? rows : cols
    const inner = horizontal ? cols : rows
    const at = (o: number, i: number) => (horizontal ? (o * cols + i) * 4 : (i * cols + o) * 4)
    for (let o = 0; o < outer; o++) {
      const sum = [0, 0, 0, 0]
      for (let i = -radius; i <= radius; i++) {
        const k = at(o, Math.max(0, Math.min(inner - 1, i)))
        for (let c = 0; c < 4; c++) sum[c] += src[k + c]
      }
      const n = radius * 2 + 1
      for (let i = 0; i < inner; i++) {
        const k = at(o, i)
        for (let c = 0; c < 4; c++) out[k + c] = sum[c] / n
        const leaving = at(o, Math.max(0, i - radius))
        const entering = at(o, Math.min(inner - 1, i + radius + 1))
        for (let c = 0; c < 4; c++) sum[c] += src[entering + c] - src[leaving + c]
      }
    }
    return out
  }
  return pass(pass(px, true), false)
}
/** Average the picture down to at most `maxCells` pixels, for the optimisers. */
export function shrinkPixels(
  pixels: Uint8ClampedArray,
  cols: number,
  rows: number,
  maxCells: number,
): { pixels: Uint8ClampedArray; cols: number; rows: number } {
  const factor = Math.ceil(Math.sqrt((cols * rows) / maxCells))
  if (factor <= 1) return { pixels, cols, rows }
  const c = Math.ceil(cols / factor)
  const r = Math.ceil(rows / factor)
  const out = new Uint8ClampedArray(c * r * 4)
  for (let y = 0; y < r; y++)
    for (let x = 0; x < c; x++) {
      const sum = [0, 0, 0, 0]
      let n = 0
      for (let yy = y * factor; yy < Math.min(rows, (y + 1) * factor); yy++)
        for (let xx = x * factor; xx < Math.min(cols, (x + 1) * factor); xx++) {
          const k = (yy * cols + xx) * 4
          for (let ch = 0; ch < 4; ch++) sum[ch] += pixels[k + ch]
          n++
        }
      out.set(
        sum.map((v) => v / n),
        (y * c + x) * 4,
      )
    }
  return { pixels: out, cols: c, rows: r }
}

// --- Matching --------------------------------------------------------------------------------------
type Matcher = (r: number, g: number, b: number) => number
/** The nearest ramp step for a colour, cached by a 15-bit quantised key. */
function matcher(steps: RampStep[], match: Render['match']): Matcher {
  const labs = steps.map((s) => rgbToLab(s.color))
  const cache = new Map<number, number>()
  return (r, g, b) => {
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)
    const hit = cache.get(key)
    if (hit !== undefined) return hit
    let best = 0
    let bestDistance = Infinity
    if (match === 'lab') {
      const lab = rgbToLab([r, g, b])
      for (let s = 0; s < steps.length; s++) {
        const d = deltaE2000(lab, labs[s])
        if (d < bestDistance) {
          bestDistance = d
          best = s
        }
      }
    } else
      for (let s = 0; s < steps.length; s++) {
        const c = steps[s].color
        const d = 2 * (c[0] - r) ** 2 + 4 * (c[1] - g) ** 2 + 3 * (c[2] - b) ** 2
        if (d < bestDistance) {
          bestDistance = d
          best = s
        }
      }
    cache.set(key, best)
    return best
  }
}
/**
 * Turn RGBA pixels (already scaled to the working grid) into layer counts and a preview.
 * Processing applies first; transparent pixels fall to the base; dithering spreads the error.
 */
export function paint(
  pixels: Uint8ClampedArray,
  cols: number,
  rows: number,
  doc: PainterDocument,
  options: { processed?: boolean } = {},
): Painting {
  const render = renderOf(doc)
  const source = options.processed ? pixels : processPixels(pixels, cols, rows, doc)
  const steps = ramp(doc).slice(doc.baseLayers - 1)
  const nearest = matcher(steps, render.match)
  const layers = new Uint8Array(cols * rows)
  const chosen = new Uint16Array(cols * rows)
  const dither = render.dither === 'floyd'
  // Error diffusion carries the colour residue to the right and the next row.
  const error = dither ? new Float32Array(cols * rows * 3) : null
  for (let i = 0; i < cols * rows; i++) {
    const at = i * 4
    let best = 0
    if (source[at + 3] >= 8) {
      let r = source[at]
      let g = source[at + 1]
      let b = source[at + 2]
      if (error) {
        r = Math.max(0, Math.min(255, r + error[i * 3]))
        g = Math.max(0, Math.min(255, g + error[i * 3 + 1]))
        b = Math.max(0, Math.min(255, b + error[i * 3 + 2]))
      }
      best = nearest(Math.round(r), Math.round(g), Math.round(b))
      if (error) {
        const c = steps[best].color
        const e = [r - c[0], g - c[1], b - c[2]]
        const x = i % cols
        const spread = (j: number, w: number) => {
          if (j < 0 || j >= cols * rows) return
          error[j * 3] += e[0] * w
          error[j * 3 + 1] += e[1] * w
          error[j * 3 + 2] += e[2] * w
        }
        if (x + 1 < cols) spread(i + 1, 7 / 16)
        if (x > 0) spread(i + cols - 1, 3 / 16)
        spread(i + cols, 5 / 16)
        if (x + 1 < cols) spread(i + cols + 1, 1 / 16)
      }
    }
    chosen[i] = best
  }
  // Small features that cannot print get smoothed away by a median over the chosen steps.
  const radius = Math.round((render.minFeature * cols) / Math.max(1, doc.width) / 2)
  const final = radius > 0 ? median(chosen, cols, rows, radius) : chosen
  const preview = new Uint8ClampedArray(cols * rows * 4)
  let totalError = 0
  let counted = 0
  for (let i = 0; i < cols * rows; i++) {
    const step = steps[final[i]]
    layers[i] = step.layer
    const [r, g, b] = step.color
    preview[i * 4] = r
    preview[i * 4 + 1] = g
    preview[i * 4 + 2] = b
    preview[i * 4 + 3] = 255
    if (source[i * 4 + 3] >= 8 && (i % 7 === 0 || cols * rows < 5000)) {
      totalError += deltaE2000(
        rgbToLab([source[i * 4], source[i * 4 + 1], source[i * 4 + 2]]),
        rgbToLab(step.color),
      )
      counted++
    }
  }
  return { cols, rows, layers, preview, source, error: counted ? totalError / counted : 0 }
}
function median(values: Uint16Array, cols: number, rows: number, radius: number): Uint16Array {
  const out = new Uint16Array(values.length)
  const window: number[] = []
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) {
      window.length = 0
      for (let dy = -radius; dy <= radius; dy++)
        for (let dx = -radius; dx <= radius; dx++) {
          const xx = x + dx
          const yy = y + dy
          if (xx >= 0 && yy >= 0 && xx < cols && yy < rows) window.push(values[yy * cols + xx])
        }
      window.sort((a, b) => a - b)
      out[y * cols + x] = window[window.length >> 1]
    }
  return out
}

// --- Optimisers -------------------------------------------------------------------------------------
/** Mean ΔE2000 of the print against the (processed) picture, on a small copy. */
export function paintingError(
  pixels: Uint8ClampedArray,
  cols: number,
  rows: number,
  doc: PainterDocument,
): number {
  return (
    paint(
      pixels,
      cols,
      rows,
      { ...doc, render: { ...renderOf(doc), minFeature: 0, dither: 'none' } },
      { processed: true },
    ).error ?? 0
  )
}
/**
 * Choose the layer each filament starts on so the print matches the picture best: coordinate
 * descent over the stack, coarse steps then fine, on a picture shrunk to a few thousand pixels.
 */
export function placeSwaps(
  pixels: Uint8ClampedArray,
  cols: number,
  rows: number,
  doc: PainterDocument,
): PainterDocument {
  const small = shrinkPixels(processPixels(pixels, cols, rows, doc), cols, rows, 3000)
  let best = normalizeStack(doc)
  if (best.stack.length < 2) return best
  let bestError = paintingError(small.pixels, small.cols, small.rows, best)
  const evaluate = (candidate: PainterDocument) => {
    const normalized = normalizeStack(candidate)
    const e = paintingError(small.pixels, small.cols, small.rows, normalized)
    if (e < bestError - 1e-6) {
      bestError = e
      best = normalized
      return true
    }
    return false
  }
  for (const step of [4, 1]) {
    let improved = true
    for (let round = 0; round < 6 && improved; round++) {
      improved = false
      for (let i = 1; i < best.stack.length; i++) {
        const lo = i === 1 ? best.stack[0].startLayer + 1 : best.stack[i - 1].startLayer + 1
        const hi = i + 1 < best.stack.length ? best.stack[i + 1].startLayer - 1 : best.maxLayers
        for (let layer = Math.max(doc.baseLayers + 1, lo); layer <= hi; layer += step) {
          if (layer === best.stack[i].startLayer) continue
          const stack = best.stack.map((f, k) => (k === i ? { ...f, startLayer: layer } : f))
          if (evaluate({ ...best, stack })) improved = true
        }
      }
    }
  }
  return best
}
/**
 * Pick a stack from a library: the darkest library colour as the base, then greedily the
 * filament that, placed at its best layer, lowers the error most, until `count` are chosen.
 */
export function suggestStack(
  pixels: Uint8ClampedArray,
  cols: number,
  rows: number,
  doc: PainterDocument,
  library: readonly Omit<Filament, 'id' | 'startLayer'>[],
  count: number,
  makeId: () => string,
): PainterDocument {
  const small = shrinkPixels(processPixels(pixels, cols, rows, doc), cols, rows, 1200)
  const lum = (f: { color: string }) => {
    const [r, g, b] = hexToRgb(f.color)
    return 0.299 * r + 0.587 * g + 0.114 * b
  }
  const sorted = [...library].sort((a, b) => lum(a) - lum(b))
  const base: Filament = { id: makeId(), ...sorted[0], startLayer: 1 }
  let current: PainterDocument = normalizeStack({ ...doc, stack: [base] })
  let currentError = paintingError(small.pixels, small.cols, small.rows, current)
  const span = doc.maxLayers - doc.baseLayers
  const positions = [0.15, 0.3, 0.45, 0.6, 0.75, 0.9].map(
    (t) => doc.baseLayers + 1 + Math.round(t * span),
  )
  for (let n = 1; n < Math.min(count, library.length); n++) {
    let pick: PainterDocument | null = null
    let pickError = currentError
    for (const candidate of sorted.slice(1)) {
      if (current.stack.some((f) => f.color === candidate.color)) continue
      for (const layer of positions) {
        const stack = [...current.stack, { id: 'try', ...candidate, startLayer: layer }]
        const trial = normalizeStack({ ...current, stack })
        const e = paintingError(small.pixels, small.cols, small.rows, trial)
        if (e < pickError - 1e-6) {
          pickError = e
          pick = trial
        }
      }
    }
    if (!pick) break
    current = {
      ...pick,
      stack: pick.stack.map((f) => (f.id === 'try' ? { ...f, id: makeId() } : f)),
    }
    currentError = pickError
  }
  return placeSwaps(pixels, cols, rows, current)
}

// --- Views ---------------------------------------------------------------------------------------------
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
/** What the print looks like after `layer` layers: each pixel shows the ramp at min(height, layer). */
export function scrubPixels(
  painting: Painting,
  doc: PainterDocument,
  layer: number,
): Uint8ClampedArray {
  const steps = ramp(doc)
  const out = new Uint8ClampedArray(painting.layers.length * 4)
  for (let i = 0; i < painting.layers.length; i++) {
    const k = Math.max(1, Math.min(painting.layers[i], layer))
    const [r, g, b] = steps[k - 1].color
    out.set([r, g, b, 255], i * 4)
  }
  return out
}

/**
 * The relief as a closed, stepped mesh: one flat top per pixel, walls where neighbours differ,
 * outer walls down to the bed, and a bottom. A frame adds a rim at full height around the
 * picture, with a hanging hole through it when asked. Centred on the origin, resting on z = 0.
 * Each triangle also gets the colour of the cell it belongs to, for a painted 3D preview.
 */
export function relief(painting: Painting, doc: PainterDocument): { mesh: Mesh; colors: string[] } {
  const frame = frameOf(doc)
  const cell = doc.width / painting.cols
  const rim = Math.round(frame.width / cell)
  const cols = painting.cols + rim * 2
  const rows = painting.rows + rim * 2
  const topLayer = doc.maxLayers
  const stack = normalizeStack(doc).stack
  const rimColor = stack[stack.length - 1].color
  const holeR = frame.holeDiameter / 2 / cell
  const holeC = cols / 2
  const holeRow = rim / 2
  // Heights and colours over the framed grid; the hole is a gap in the rim.
  const layers = new Uint8Array(cols * rows)
  const colors: string[] = new Array(cols * rows)
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c
      const inPicture = r >= rim && r < rim + painting.rows && c >= rim && c < rim + painting.cols
      if (inPicture) {
        const k = (r - rim) * painting.cols + (c - rim)
        layers[i] = painting.layers[k]
        colors[i] = rgbToHex([
          painting.preview[k * 4],
          painting.preview[k * 4 + 1],
          painting.preview[k * 4 + 2],
        ])
      } else {
        const inHole = holeR > 0 && Math.hypot(c + 0.5 - holeC, r + 0.5 - holeRow) <= holeR
        layers[i] = inHole ? 0 : topLayer
        colors[i] = rimColor
      }
    }
  const width = cols * cell
  const depth = rows * cell
  const x = (c: number) => -width / 2 + c * cell
  const y = (r: number) => depth / 2 - r * cell
  const z = (i: number) => layers[i] * doc.layerHeight
  const mesh: Mesh = []
  const out: string[] = []
  let color = ''
  const tri = (...p: number[]) => {
    mesh.push(...p)
    out.push(color)
  }
  const wall = (px: number, py: number, qx: number, qy: number, lo: number, hi: number) => {
    tri(px, py, lo, qx, qy, lo, qx, qy, hi)
    tri(px, py, lo, qx, qy, hi, px, py, hi)
  }
  const heightAt = (c: number, r: number) =>
    c < 0 || r < 0 || c >= cols || r >= rows ? 0 : z(r * cols + c)
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c
      const h = z(i)
      if (h <= 0) continue
      color = colors[i]
      const [x0, x1, y0, y1] = [x(c), x(c + 1), y(r + 1), y(r)]
      tri(x0, y0, h, x1, y0, h, x1, y1, h)
      tri(x0, y0, h, x1, y1, h, x0, y1, h)
      const south = heightAt(c, r + 1)
      if (south < h) wall(x0, y0, x1, y0, south, h)
      const north = heightAt(c, r - 1)
      if (north < h) wall(x1, y1, x0, y1, north, h)
      const east = heightAt(c + 1, r)
      if (east < h) wall(x1, y0, x1, y1, east, h)
      const west = heightAt(c - 1, r)
      if (west < h) wall(x0, y1, x0, y0, west, h)
      // The bottom, per cell, so a hole leaves a gap; faces down.
      color = stack[0].color
      tri(x0, y0, 0, x1, y1, 0, x1, y0, 0)
      tri(x0, y0, 0, x0, y1, 0, x1, y1, 0)
    }
  return { mesh, colors: out }
}
export const reliefMesh = (painting: Painting, doc: PainterDocument): Mesh =>
  relief(painting, doc).mesh

/** A rough print time: every layer's area at one wall and full infill, plus the spool changes. */
export function estimateSeconds(painting: Painting, doc: PainterDocument): number {
  const cell = doc.width / painting.cols
  const frame = frameOf(doc)
  const rimArea =
    frame.width > 0
      ? (doc.width + 2 * frame.width) * (printedHeight(doc) + 2 * frame.width) -
        doc.width * printedHeight(doc)
      : 0
  let seconds = 0
  const counts = new Uint32Array(doc.maxLayers + 1)
  for (let i = 0; i < painting.layers.length; i++)
    for (let k = 1; k <= painting.layers[i]; k++) counts[k]++
  for (let k = 1; k <= doc.maxLayers; k++) {
    const area = counts[k] * cell * cell + rimArea
    // Line width 0.4 mm at about 120 mm/s effective, plus a layer change.
    seconds += area / (0.4 * 120) + 2
  }
  return Math.round(seconds + swapPlan(doc).length * 90)
}
/** Numbers for the print sheet. */
export function printStats(doc: PainterDocument, painting: Painting | null) {
  const { cols, rows } = gridFor(doc)
  const frame = frameOf(doc)
  const area = (doc.width + 2 * frame.width) * (printedHeight(doc) + 2 * frame.width)
  const cell = painting ? doc.width / painting.cols : 0
  const cubicMm = painting
    ? Array.from(painting.layers).reduce((s, l) => s + l, 0) * doc.layerHeight * cell ** 2 +
      (area - doc.width * printedHeight(doc)) * totalHeight(doc)
    : 0
  return {
    cols,
    rows,
    height: Math.round(totalHeight(doc) * 1000) / 1000,
    area: Math.round(area),
    grams: Math.round((cubicMm / 1000) * 1.24 * 10) / 10,
    seconds: painting ? estimateSeconds(painting, doc) : 0,
    error: painting?.error ?? 0,
    swaps: swapPlan(doc),
  }
}
/** The swap plan as text to keep next to the printer. */
export function printSheet(title: string, doc: PainterDocument, painting: Painting | null): string {
  const stats = printStats(doc, painting)
  const base = normalizeStack(doc).stack[0]
  const frame = frameOf(doc)
  const h = Math.floor(stats.seconds / 3600)
  const m = Math.round((stats.seconds % 3600) / 60)
  const lines = [
    `${title} — PLA Painter print sheet`,
    `Size: ${doc.width} × ${Math.round(printedHeight(doc))} mm${frame.width ? ` plus a ${frame.width} mm frame` : ''}, ${stats.height} mm tall`,
    `Layers: ${doc.maxLayers} × ${doc.layerHeight} mm (${doc.baseLayers} base layers)`,
    `Estimated filament: ${stats.grams} g · about ${h ? `${h}h ${m}m` : `${m}m`}`,
    '',
    `Start with ${base.name} (${base.color})`,
    ...stats.swaps.map(
      (s) =>
        `Layer ${s.layer} at ${s.height} mm: change to ${s.filament.name} (${s.filament.color})`,
    ),
    '',
    `Print at 100% infill with one wall, ${doc.layerHeight} mm layers; pause at each listed layer and swap spools.`,
  ]
  return lines.join('\n')
}
