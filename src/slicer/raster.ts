// Bitmaps of a layer's material, at a cell size near the line width. Polygon booleans are
// what a slicer needs to find exposed skins and overhangs, and a bitmap gives them for the
// price of a scanline fill: AND, OR, minus, dilate, erode, and clipping hatch lines to a
// region all become loops over bytes. Walls still come from exact polygon offsets; the masks
// decide what kind of infill goes where and where supports must stand.
import type { Polygon, Segment, Vec2 } from '../workbench/geometry'

export type Frame = { x0: number; y0: number; cols: number; rows: number; cell: number }
export type Mask = Frame & { bits: Uint8Array }

export const emptyMask = (frame: Frame): Mask => ({
  ...frame,
  bits: new Uint8Array(frame.cols * frame.rows),
})
export const fullMask = (frame: Frame): Mask => ({
  ...frame,
  bits: new Uint8Array(frame.cols * frame.rows).fill(1),
})
/** A frame covering the given bounds with a margin, at a cell size that bounds the total work. */
export function frameFor(
  min: Vec2,
  max: Vec2,
  margin: number,
  layers: number,
  budget = 12_000_000,
): Frame {
  const width = max.x - min.x + margin * 2
  const height = max.y - min.y + margin * 2
  const area = Math.max(1, width * height)
  const cell = Math.min(2, Math.max(0.4, Math.sqrt((area * Math.max(1, layers)) / budget)))
  return {
    x0: min.x - margin,
    y0: min.y - margin,
    cols: Math.max(1, Math.ceil(width / cell)),
    rows: Math.max(1, Math.ceil(height / cell)),
    cell,
  }
}
/** Even-odd scanline fill of closed loops: holes need no special treatment. */
export function rasterize(loops: Polygon[], frame: Frame): Mask {
  const mask = emptyMask(frame)
  const { x0, y0, cols, rows, cell, bits } = mask
  const edges: { x1: number; y1: number; x2: number; y2: number }[] = []
  for (const loop of loops)
    for (let i = 0, j = loop.length - 1; i < loop.length; j = i++)
      if (loop[i].y !== loop[j].y)
        edges.push({ x1: loop[j].x, y1: loop[j].y, x2: loop[i].x, y2: loop[i].y })
  const xs: number[] = []
  for (let r = 0; r < rows; r++) {
    const y = y0 + (r + 0.5) * cell
    xs.length = 0
    for (const e of edges)
      if (e.y1 > y !== e.y2 > y) xs.push(e.x1 + ((y - e.y1) / (e.y2 - e.y1)) * (e.x2 - e.x1))
    xs.sort((a, b) => a - b)
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const from = Math.max(0, Math.ceil((xs[k] - x0) / cell - 0.5))
      const to = Math.min(cols - 1, Math.floor((xs[k + 1] - x0) / cell - 0.5))
      for (let c = from; c <= to; c++) bits[r * cols + c] = 1
    }
  }
  return mask
}
const same = (a: Mask, b: Mask) => a.cols === b.cols && a.rows === b.rows
export function or(a: Mask, b: Mask): Mask {
  if (!same(a, b)) return a
  const out = emptyMask(a)
  for (let i = 0; i < out.bits.length; i++) out.bits[i] = a.bits[i] | b.bits[i]
  return out
}
export function and(a: Mask, b: Mask): Mask {
  if (!same(a, b)) return a
  const out = emptyMask(a)
  for (let i = 0; i < out.bits.length; i++) out.bits[i] = a.bits[i] & b.bits[i]
  return out
}
export function minus(a: Mask, b: Mask): Mask {
  if (!same(a, b)) return a
  const out = emptyMask(a)
  for (let i = 0; i < out.bits.length; i++) out.bits[i] = a.bits[i] & (b.bits[i] ^ 1)
  return out
}
export const isEmpty = (m: Mask) => !m.bits.some((b) => b)
export function equals(a: Mask, b: Mask): boolean {
  if (!same(a, b)) return false
  for (let i = 0; i < a.bits.length; i++) if (a.bits[i] !== b.bits[i]) return false
  return true
}
export function count(m: Mask): number {
  let n = 0
  for (let i = 0; i < m.bits.length; i++) n += m.bits[i]
  return n
}
/** Grow the set by `r` cells (a square neighbourhood, done as two passes). */
export function dilate(m: Mask, r: number): Mask {
  if (r <= 0) return m
  const { cols, rows } = m
  const pass = new Uint8Array(cols * rows)
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) {
      let v = 0
      for (let k = -r; k <= r && !v; k++) {
        const xx = x + k
        if (xx >= 0 && xx < cols && m.bits[y * cols + xx]) v = 1
      }
      pass[y * cols + x] = v
    }
  const out = emptyMask(m)
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) {
      let v = 0
      for (let k = -r; k <= r && !v; k++) {
        const yy = y + k
        if (yy >= 0 && yy < rows && pass[yy * cols + x]) v = 1
      }
      out.bits[y * cols + x] = v
    }
  return out
}
/** Shrink the set by `r` cells. */
export function erode(m: Mask, r: number): Mask {
  if (r <= 0) return m
  const inverted = emptyMask(m)
  for (let i = 0; i < m.bits.length; i++) inverted.bits[i] = m.bits[i] ^ 1
  const grown = dilate(inverted, r)
  for (let i = 0; i < grown.bits.length; i++) grown.bits[i] ^= 1
  return grown
}
export function inside(m: Mask, x: number, y: number): boolean {
  const c = Math.floor((x - m.x0) / m.cell)
  const r = Math.floor((y - m.y0) / m.cell)
  return c >= 0 && r >= 0 && c < m.cols && r < m.rows && m.bits[r * m.cols + c] === 1
}
/**
 * Keep the parts of each polyline that run through the mask, sampled at half a cell along
 * every segment. A run keeps the polyline's own vertices, so a curve stays one path.
 */
export function clip(polylines: Vec2[][], m: Mask): Vec2[][] {
  const out: Vec2[][] = []
  const step = m.cell / 2
  for (const line of polylines) {
    let run: Vec2[] = []
    const flush = () => {
      if (run.length >= 2 && polylineLength(run) > m.cell * 0.75) out.push(run)
      run = []
    }
    for (let k = 1; k < line.length; k++) {
      const a = line[k - 1]
      const b = line[k]
      const length = Math.hypot(b.x - a.x, b.y - a.y)
      if (length < 1e-9) continue
      const n = Math.max(1, Math.ceil(length / step))
      let lastInside: Vec2 | null = run.length ? run[run.length - 1] : null
      for (let i = 0; i <= n; i++) {
        const t = i / n
        const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
        if (inside(m, p.x, p.y)) {
          if (!run.length) run.push(p)
          lastInside = p
        } else if (run.length) {
          if (lastInside && lastInside !== run[run.length - 1]) run.push(lastInside)
          flush()
          lastInside = null
        }
      }
      // The segment's end vertex closes the sampled stretch when it is inside.
      if (run.length && lastInside) {
        const end = run[run.length - 1]
        if (Math.hypot(end.x - lastInside.x, end.y - lastInside.y) > 1e-9) run.push(lastInside)
      }
    }
    flush()
  }
  return out
}
const polylineLength = (pts: Vec2[]) => {
  let l = 0
  for (let i = 1; i < pts.length; i++)
    l += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
  return l
}
/** Straight lines through the mask every `spacing` mm along X (angle 0) or Y (angle 90). */
export function lines(m: Mask, spacing: number, angle: 0 | 90, phase = 0): Segment[] {
  const out: Segment[] = []
  const stride = Math.max(1, Math.round(spacing / m.cell))
  const offset = Math.round(phase / m.cell) % stride
  if (angle === 0)
    for (let r = offset; r < m.rows; r += stride) {
      const y = m.y0 + (r + 0.5) * m.cell
      let start = -1
      for (let c = 0; c <= m.cols; c++) {
        const on = c < m.cols && m.bits[r * m.cols + c] === 1
        if (on && start < 0) start = c
        if (!on && start >= 0) {
          out.push([
            { x: m.x0 + start * m.cell, y },
            { x: m.x0 + c * m.cell, y },
          ])
          start = -1
        }
      }
    }
  else
    for (let c = offset; c < m.cols; c += stride) {
      const x = m.x0 + (c + 0.5) * m.cell
      let start = -1
      for (let r = 0; r <= m.rows; r++) {
        const on = r < m.rows && m.bits[r * m.cols + c] === 1
        if (on && start < 0) start = r
        if (!on && start >= 0) {
          out.push([
            { x, y: m.y0 + start * m.cell },
            { x, y: m.y0 + r * m.cell },
          ])
          start = -1
        }
      }
    }
  // Serpentine so the head travels little between lines.
  return out.map((s, i) => (i % 2 ? [s[1], s[0]] : s))
}
/** The mask's outline as loops, traced along cell edges; coarse, for support walls. */
export function outline(m: Mask): Polygon[] {
  // Collect boundary edges between set and unset cells, then chain them.
  const edges: Segment[] = []
  const at = (c: number, r: number) =>
    c >= 0 && r >= 0 && c < m.cols && r < m.rows && m.bits[r * m.cols + c] === 1
  const px = (c: number) => m.x0 + c * m.cell
  const py = (r: number) => m.y0 + r * m.cell
  for (let r = 0; r < m.rows; r++)
    for (let c = 0; c < m.cols; c++) {
      if (!at(c, r)) continue
      if (!at(c, r - 1))
        edges.push([
          { x: px(c), y: py(r) },
          { x: px(c + 1), y: py(r) },
        ])
      if (!at(c + 1, r))
        edges.push([
          { x: px(c + 1), y: py(r) },
          { x: px(c + 1), y: py(r + 1) },
        ])
      if (!at(c, r + 1))
        edges.push([
          { x: px(c + 1), y: py(r + 1) },
          { x: px(c), y: py(r + 1) },
        ])
      if (!at(c - 1, r))
        edges.push([
          { x: px(c), y: py(r + 1) },
          { x: px(c), y: py(r) },
        ])
    }
  const key = (p: Vec2) => `${Math.round(p.x * 100)},${Math.round(p.y * 100)}`
  const byStart = new Map<string, Segment[]>()
  for (const e of edges) byStart.set(key(e[0]), [...(byStart.get(key(e[0])) ?? []), e])
  const used = new Set<Segment>()
  const loops: Polygon[] = []
  for (const start of edges) {
    if (used.has(start)) continue
    used.add(start)
    const loop: Polygon = [start[0]]
    let current = start
    for (let guard = 0; guard < edges.length; guard++) {
      const next = (byStart.get(key(current[1])) ?? []).find((e) => !used.has(e))
      if (!next) break
      used.add(next)
      // Drop collinear points as we go.
      const last = loop[loop.length - 1]
      if (
        loop.length > 1 &&
        ((last.x === next[0].x && loop[loop.length - 2].x === next[0].x) ||
          (last.y === next[0].y && loop[loop.length - 2].y === next[0].y))
      )
        loop[loop.length - 1] = next[0]
      else loop.push(next[0])
      current = next
      if (key(current[1]) === key(start[0])) break
    }
    if (loop.length >= 4) loops.push(loop)
  }
  return loops
}
