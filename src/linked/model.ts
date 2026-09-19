import { emptyGraph, validViewport, type GraphDocument, type SheetPlot } from '../graph/model'
import { calculateSheet, type CellResult } from '../sheet/engine'
import { cellRange, emptySheet, position, type SheetDocument } from '../sheet/model'
import type { Point } from '../graph/plot'

export const OCTAHEDRON_URL = 'https://www.desmos.com/calculator/hnfguwahya'
export type LinkedPoint = Point & { label: string; source: string }
export type PointSeries = { plot: SheetPlot; points: (LinkedPoint | null)[]; errors: string[] }
export function resolveSheetPlots(
  graph: GraphDocument,
  sheet?: SheetDocument,
  results?: Record<string, CellResult>,
): PointSeries[] {
  const calculated = results ?? (sheet ? calculateSheet(sheet) : {})
  return (graph.sheetPlots ?? [])
    .filter((p) => p.visible)
    .map((plot) => {
      const xs = cellRange(plot.xRange),
        ys = cellRange(plot.yRange),
        errors: string[] = []
      const points = xs.map((xRef, i) => {
        const yRef = ys[i],
          x = calculated[xRef],
          y = calculated[yRef]
        const within = (ref: string) => {
          const p = position(ref)!
          return !!sheet && p.row < sheet.rows && p.col < sheet.columns
        }
        if (
          !within(xRef) ||
          !within(yRef) ||
          x?.error ||
          y?.error ||
          typeof x?.value !== 'number' ||
          typeof y?.value !== 'number' ||
          !Number.isFinite(x.value) ||
          !Number.isFinite(y.value)
        ) {
          errors.push(
            `P${i + 1} (${xRef}, ${yRef}): ${x?.error ?? y?.error ?? 'Both coordinates must contain numbers in this spreadsheet.'}`,
          )
          return null
        }
        if (Math.abs(x.value) > 1e9 || Math.abs(y.value) > 1e9) {
          errors.push(`P${i + 1}: coordinates exceed the supported graph range of ±1,000,000,000.`)
          return null
        }
        return { x: x.value, y: y.value, label: `P${i + 1}`, source: `${xRef}, ${yRef}` }
      })
      return { plot, points, errors }
    })
}
export function fitPoints(series: PointSeries[]) {
  const points = series.flatMap((s) => s.points).filter((p): p is LinkedPoint => !!p)
  if (!points.length) return null
  const xs = points.map((p) => p.x),
    ys = points.map((p) => p.y)
  const xMin = Math.min(...xs),
    xMax = Math.max(...xs),
    yMin = Math.min(...ys),
    yMax = Math.max(...ys)
  const pad = Math.max(xMax - xMin, yMax - yMin, 1) * 0.18
  const view = { xMin: xMin - pad, xMax: xMax + pad, yMin: yMin - pad, yMax: yMax + pad }
  return validViewport(view) ? view : null
}
export function octahedronExample(): { graph: GraphDocument; sheet: SheetDocument } {
  const sheet: SheetDocument = {
    ...emptySheet(),
    rows: 25,
    columns: 6,
    widths: { A: 120, B: 145, C: 145, D: 240 },
    names: { s: 'B2', h: 'B3', t: 'B4' },
    sliders: [{ id: crypto.randomUUID(), label: 't', cell: 'B4', min: 0, max: 1, step: 0.001 }],
  }
  const put = (ref: string, input: string, bold = false, fill = 'none') => {
    sheet.cells[ref] = { input, format: { bold, fill } }
  }
  put('A1', 'Parameter', true)
  put('B1', 'Value', true)
  put('C1', 'Role', true)
  put('A2', 's')
  put('B2', '5', false, '#fcf0ce')
  put('C2', 'Constant')
  put('A3', 'h')
  put('B3', '=SQRT(3)*s/2')
  put('C3', 'Derived from s')
  put('A4', 't')
  put('B4', '0.323', false, '#e7f0e5')
  put('C4', 'Slider: 0 to 1')
  put('A6', 'Point', true)
  put('B6', 'x', true)
  put('C6', 'y', true)
  const formulas = [
    ['(a, b)', '=s/2*t', '=-h/3*t+h/2'],
    ['(c, d)', '=-s/2*t', '=-h/3*t+h/2'],
    ['(f, g)', '=-s/2', '=2*h/3*t-h/2'],
    ['(i, j)', '=s/2*t-s/2', '=-h/3*t-h/2'],
    ['(k, l)', '=-s/2*t+s/2', '=-h/3*t-h/2'],
    ['(m, n)', '=s/2', '=2*h/3*t-h/2'],
  ]
  formulas.forEach(([label, x, y], i) => {
    put(`A${7 + i}`, `P${i + 1} ${label}`)
    put(`B${7 + i}`, x)
    put(`C${7 + i}`, y)
  })
  put('A15', 'Edit s or move t.')
  put('A16', 'h recalculates from s.')
  put('A17', 'Select a cell to inspect its formula.')
  return {
    sheet,
    graph: {
      ...emptyGraph(),
      entries: [],
      viewport: { xMin: -3.5, xMax: 3.5, yMin: -4, yMax: 3 },
      sheetPlots: [
        {
          id: crypto.randomUUID(),
          label: 'Octahedron section',
          xRange: 'B7:B12',
          yRange: 'C7:C12',
          color: '#3e68ae',
          visible: true,
          connect: true,
          closed: true,
        },
      ],
    },
  }
}
