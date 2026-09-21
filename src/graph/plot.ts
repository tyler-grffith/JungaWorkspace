import { validViewport, type Viewport } from './model'
import type { Curve } from './engine'
export type Point = { x: number; y: number }
export function equalScaleView(view: Viewport, width: number, height: number): Viewport {
  const scale = Math.max((view.xMax - view.xMin) / width, (view.yMax - view.yMin) / height)
  const x = (view.xMin + view.xMax) / 2,
    y = (view.yMin + view.yMax) / 2
  const next = {
    xMin: x - (scale * width) / 2,
    xMax: x + (scale * width) / 2,
    yMin: y - (scale * height) / 2,
    yMax: y + (scale * height) / 2,
  }
  return validViewport(next) ? next : view
}
export function pointPath(
  points: (Point | null)[],
  view: Viewport,
  width: number,
  height: number,
  closed: boolean,
): string {
  let move = true
  const path = points
    .map((point) => {
      if (!point) {
        move = true
        return ''
      }
      const p = toPixel(point, view, width, height)
      const part = `${move ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`
      move = false
      return part
    })
    .join(' ')
  return path + (closed && points.length > 2 && points.every(Boolean) ? ' Z' : '')
}
export const toPixel = (point: Point, view: Viewport, width: number, height: number): Point => ({
  x: ((point.x - view.xMin) / (view.xMax - view.xMin)) * width,
  y: ((view.yMax - point.y) / (view.yMax - view.yMin)) * height,
})
export const toWorld = (point: Point, view: Viewport, width: number, height: number): Point => ({
  x: view.xMin + (point.x / width) * (view.xMax - view.xMin),
  y: view.yMax - (point.y / height) * (view.yMax - view.yMin),
})
export function zoomView(
  view: Viewport,
  factor: number,
  center: Point = { x: (view.xMin + view.xMax) / 2, y: (view.yMin + view.yMax) / 2 },
): Viewport {
  const next = {
    xMin: center.x + (view.xMin - center.x) * factor,
    xMax: center.x + (view.xMax - center.x) * factor,
    yMin: center.y + (view.yMin - center.y) * factor,
    yMax: center.y + (view.yMax - center.y) * factor,
  }
  return validViewport(next) ? next : view
}
export function panView(view: Viewport, dx: number, dy: number): Viewport {
  const next = {
    xMin: view.xMin + dx,
    xMax: view.xMax + dx,
    yMin: view.yMin + dy,
    yMax: view.yMax + dy,
  }
  return validViewport(next) ? next : view
}
export function ticks(min: number, max: number, count: number): number[] {
  const rough = (max - min) / count,
    power = 10 ** Math.floor(Math.log10(rough)),
    fraction = rough / power
  const step = (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * power
  const values: number[] = []
  for (let n = Math.ceil(min / step); n * step <= max && values.length < 50; n++)
    values.push(Number((n * step).toPrecision(12)))
  return values
}
export function numberLabel(value: number): string {
  if (!Number.isFinite(value)) return 'undefined'
  if (value === 0) return '0'
  return Math.abs(value) >= 1e5 || Math.abs(value) < 0.0001
    ? value.toExponential(2)
    : String(Number(value.toPrecision(5)))
}

// Midpoint refinement breaks paths at poles and excluded domains rather than drawing false bridges.
export function sampleCurve(curve: Curve, view: Viewport, width: number, height: number) {
  const points: (Point | null)[] = []
  const intervals = Math.max(100, Math.min(500, Math.ceil(width / 3)))
  const scaleY = height / (view.yMax - view.yMin)
  let evaluations = 0
  const evaluate = (x: number): Point => {
    if (++evaluations > 9000)
      throw new Error('This curve needs too much detail at this zoom. Zoom in or simplify it.')
    return { x, y: curve.evaluate(x) }
  }
  function segment(a: Point, b: Point, depth: number) {
    const middle = evaluate((a.x + b.x) / 2)
    const finite = [a.y, b.y, middle.y].every(Number.isFinite)
    // Avoid spending the refinement budget on finite geometry outside the window.
    if (
      finite &&
      ([a.y, b.y, middle.y].every((y) => y > view.yMax) ||
        [a.y, b.y, middle.y].every((y) => y < view.yMin))
    ) {
      points.push(null)
      return
    }
    const error = Math.abs(middle.y - (a.y + b.y) / 2) * scaleY
    if (!finite || error > 0.7) {
      if (depth > 0 && [a.y, b.y, middle.y].some(Number.isFinite)) {
        segment(a, middle, depth - 1)
        segment(middle, b, depth - 1)
      } else points.push(null)
      return
    }
    const previous = points.at(-1)
    if (!previous || previous.x !== a.x) points.push(a)
    points.push(b)
  }
  try {
    let previous = evaluate(view.xMin)
    for (let i = 1; i <= intervals; i++) {
      const next = evaluate(view.xMin + ((view.xMax - view.xMin) * i) / intervals)
      segment(previous, next, 5)
      previous = next
    }
    let move = true
    const path = points
      .map((point) => {
        if (!point) {
          move = true
          return ''
        }
        const p = toPixel(point, view, width, height)
        const text = `${move ? 'M' : 'L'}${p.x.toFixed(2)},${Math.max(-height * 2, Math.min(height * 3, p.y)).toFixed(2)}`
        move = false
        return text
      })
      .join(' ')
    const label = [...points]
      .reverse()
      .find(
        (point) =>
          point &&
          point.x < view.xMin + (view.xMax - view.xMin) * 0.88 &&
          point.y > view.yMin &&
          point.y < view.yMax,
      )
    return { path, points, label: label ?? null, error: '' }
  } catch (error) {
    return {
      path: '',
      points: [],
      label: null,
      error: error instanceof Error ? error.message : 'This curve could not be plotted.',
    }
  }
}
