import type { ImplicitCurve } from './engine'
import type { Viewport } from './model'
import { pointPath, type Point } from './plot'

// Bounded contour sampling. Splitting each cell into triangles resolves saddle ambiguity.
// Edges are refined and must approach zero, so a sign change across a pole is not a curve.
export function sampleImplicit(
  curve: ImplicitCurve,
  view: Viewport,
  width: number,
  height: number,
) {
  const points: (Point | null)[] = []
  let evaluations = 0
  const budget = { remaining: 2_000_000 }
  function evaluate(p: Point) {
    if (++evaluations > 60000)
      throw new Error(
        'This implicit curve needs too much detail. Zoom in or simplify the equation.',
      )
    return curve.evaluate(p.x, p.y, budget)
  }
  type Vertex = Point & { value: number; id: number }
  const edges = new Map<string, Point | null>()
  function root(a: Vertex, b: Vertex): Point | null {
    const key = a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`
    if (edges.has(key)) return edges.get(key)!
    let result: Point | null = null
    if (a.value === 0) result = a
    else if (b.value === 0) result = b
    else if (a.value < 0 !== b.value < 0) {
      let low: Point = a,
        high: Point = b,
        fLow = a.value,
        fHigh = b.value
      const threshold = Math.min(Math.abs(fLow), Math.abs(fHigh)) * 0.001
      for (let i = 0; i < 14; i++) {
        // Alternate interpolation and bisection to handle curved and steep roots.
        const fraction =
          i % 2 === 0
            ? Math.max(0.05, Math.min(0.95, Math.abs(fLow) / (Math.abs(fLow) + Math.abs(fHigh))))
            : 0.5
        const p = { x: low.x + fraction * (high.x - low.x), y: low.y + fraction * (high.y - low.y) }
        const f = evaluate(p)
        if (!Number.isFinite(f)) break
        if (Math.abs(f) <= threshold) {
          result = p
          break
        }
        if (f < 0 === fLow < 0) {
          low = p
          fLow = f
        } else {
          high = p
          fHigh = f
        }
      }
    }
    edges.set(key, result)
    return result
  }
  try {
    const nx = Math.max(40, Math.min(120, Math.ceil(width / 8)))
    const ny = Math.max(30, Math.min(100, Math.ceil(height / 8)))
    const vertices: Vertex[][] = []
    for (let j = 0; j <= ny; j++) {
      const row: Vertex[] = []
      for (let i = 0; i <= nx; i++) {
        const p = {
          x: view.xMin + ((view.xMax - view.xMin) * i) / nx,
          y: view.yMin + ((view.yMax - view.yMin) * j) / ny,
        }
        row.push({ ...p, value: evaluate(p), id: j * (nx + 1) + i })
      }
      vertices.push(row)
    }
    function triangle(v: Vertex[]) {
      if (!v.every((p) => Number.isFinite(p.value)) || v.every((p) => p.value === 0)) return
      const crossings: Point[] = []
      for (let k = 0; k < 3; k++) {
        const p = root(v[k], v[(k + 1) % 3])
        if (p && !crossings.some((q) => q.x === p.x && q.y === p.y)) crossings.push(p)
      }
      if (crossings.length === 2) points.push(crossings[0], crossings[1], null)
    }
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const a = vertices[j][i],
          b = vertices[j][i + 1],
          c = vertices[j + 1][i + 1],
          d = vertices[j + 1][i]
        triangle([a, b, c])
        triangle([a, c, d])
      }
    const label =
      points.find((p) => p && p.x > view.xMin + (view.xMax - view.xMin) * 0.6) ??
      points.find(Boolean) ??
      null
    return { path: pointPath(points, view, width, height, false), points, label, error: '' }
  } catch (error) {
    return {
      path: '',
      points: [],
      label: null,
      error: error instanceof Error ? error.message : 'Unable to plot this equation.',
    }
  }
}
