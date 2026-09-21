import { describe, expect, it } from 'vitest'
import { octahedronExample, resolveSheetPlots, fitPoints } from './model'
import { calculateSheet } from '../sheet/engine'
import { validSheet, writeCells, cellRange } from '../sheet/model'
import { validGraph } from '../graph/model'
import { equalScaleView, pointPath } from '../graph/plot'
import {
  addProject,
  duplicateProject,
  emptyLibrary,
  parseLibrary,
  saveWorkspace,
  starterInput,
} from '../library'
import { parseBackup, restoreCopies, serializeBackup } from '../backup'

describe('linked spreadsheet and graph', () => {
  it('matches the six Desmos vertex equations at the initial slider value and both endpoints', () => {
    const { sheet, graph } = octahedronExample()
    expect(validSheet(sheet)).toBe(true)
    expect(validGraph(graph)).toBe(true)
    for (const s of [5, 8])
      for (const t of [0, 0.323, 0.5, 1]) {
        const changed = writeCells(sheet, { B2: { input: String(s) }, B4: { input: String(t) } })
        const h = (Math.sqrt(3) * s) / 2,
          results = calculateSheet(changed)
        expect(results.B3.value).toBeCloseTo(h, 12)
        const expected = [
          [(s / 2) * t, (-h / 3) * t + h / 2],
          [(-s / 2) * t, (-h / 3) * t + h / 2],
          [-s / 2, ((2 * h) / 3) * t - h / 2],
          [(s / 2) * t - s / 2, (-h / 3) * t - h / 2],
          [(-s / 2) * t + s / 2, (-h / 3) * t - h / 2],
          [s / 2, ((2 * h) / 3) * t - h / 2],
        ]
        const series = resolveSheetPlots(graph, changed)
        expect(series[0].errors).toEqual([])
        series[0].points.forEach((p, i) => {
          expect(p!.x).toBeCloseTo(expected[i][0], 12)
          expect(p!.y).toBeCloseTo(expected[i][1], 12)
        })
      }
  })
  it('resolves case-insensitive named cells, reports cycles, and recalculates after rebinding', () => {
    const { sheet } = octahedronExample()
    sheet.cells.D1 = { input: '=S+H+T' }
    expect(calculateSheet(sheet).D1.value).toBeCloseTo(5 + Math.sqrt(3) * 2.5 + 0.323)
    sheet.names!.s = 'B3'
    expect(calculateSheet(sheet).B3.code).toBe('#CYCLE!')
    sheet.names!.s = 'B2'
    sheet.cells.B2.input = '8'
    expect(calculateSheet(sheet).B3.value).toBeCloseTo(Math.sqrt(3) * 4)
    expect(calculateSheet({ ...sheet, names: {} }).B3.code).toBe('#NAME?')
  })
  it('isolates invalid coordinates and breaks outlines instead of bridging bad rows', () => {
    const { sheet, graph } = octahedronExample()
    sheet.cells.B8.input = '=1/0'
    const series = resolveSheetPlots(graph, sheet)
    expect(series[0].points[1]).toBeNull()
    expect(series[0].points.filter(Boolean)).toHaveLength(5)
    expect(series[0].errors[0]).toContain('B8')
    const path = pointPath(series[0].points, graph.viewport, 600, 400, true)
    expect(path.match(/M/g)).toHaveLength(2)
    expect(path).not.toContain('Z')
    sheet.cells.B8.input = '1e200'
    expect(resolveSheetPlots(graph, sheet)[0].errors[0]).toContain('supported graph range')
    expect(resolveSheetPlots(graph)[0].points.filter(Boolean)).toHaveLength(0)
  })
  it('supports equal-length row/column series and rejects invalid links and names', () => {
    const { sheet, graph } = octahedronExample()
    expect(cellRange('b7:b12')).toEqual(['B7', 'B8', 'B9', 'B10', 'B11', 'B12'])
    expect(cellRange('A1:C1')).toEqual(['A1', 'B1', 'C1'])
    expect(() => cellRange('A1:B2')).toThrow()
    expect(() => cellRange('A2:A1')).toThrow()
    graph.sheetPlots![0].yRange = 'C7:C11'
    expect(validGraph(graph)).toBe(false)
    for (const names of [{ s: 'B2', S: 'B3' }, { A1: 'B2' }, { TRUE: 'B2' }, { s: 'Z200' }])
      expect(validSheet({ ...sheet, names })).toBe(false)
    expect(validSheet({ ...sheet, sliders: [...sheet.sliders!, ...sheet.sliders!] })).toBe(false)
    expect(validSheet({ ...sheet, sliders: [{ ...sheet.sliders![0], max: 0 }] })).toBe(false)
  })
  it('keeps geometric scale equal and fits points without a degenerate viewport', () => {
    const { sheet, graph } = octahedronExample()
    const series = resolveSheetPlots(graph, sheet),
      fitted = fitPoints(series)!
    const view = equalScaleView(fitted, 600, 400)
    expect((view.xMax - view.xMin) / 600).toBeCloseTo((view.yMax - view.yMin) / 400, 12)
    expect(pointPath(series[0].points, view, 600, 400, true)).toMatch(/ Z$/)
    expect(pointPath(series[0].points, view, 600, 400, false)).not.toMatch(/ Z$/)
    expect(fitPoints([])).toBeNull()
  })
  it('persists linked settings through save, duplicate and backup restore without cross-project sharing', () => {
    const { sheet, graph } = octahedronExample()
    const added = addProject(
      emptyLibrary(),
      { ...starterInput, tools: ['sheet', 'graph'] },
      '',
      graph,
      sheet,
    )
    const saved = saveWorkspace(added.library, added.project.id, sheet, graph)
    const duplicate = duplicateProject(saved, added.project.id)
    duplicate.project.sheet!.cells.B2.input = '12'
    expect(saved.projects[0].sheet!.cells.B2.input).toBe('5')
    const restored = restoreCopies(emptyLibrary(), parseBackup(serializeBackup(saved)).library)
    expect(
      resolveSheetPlots(restored.projects[0].graph!, restored.projects[0].sheet)[0].points,
    ).toEqual(resolveSheetPlots(graph, sheet)[0].points)
    expect(parseLibrary(JSON.stringify(restored)).projects[0].sheet!.names).toEqual(sheet.names)
    expect(() =>
      saveWorkspace(saved, added.project.id, { ...sheet, names: { s: 'Z999' } }, graph),
    ).toThrow()
  })
})
