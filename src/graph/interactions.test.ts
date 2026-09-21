import { describe, it, expect } from 'vitest'
import { compileGraph } from './engine'
import {
  emptyGraph,
  newExpression,
  validGraph,
  DEFAULT_LABEL,
  type ParameterEntry,
  type GraphDocument,
} from './model'
import { sampleImplicit } from './implicit'
import { advanceParameter } from './animation'
import { projectLabel } from './CurveLabel'
import { addProject, emptyLibrary, starterInput } from '../library'
import { parseBackup, restoreCopies, serializeBackup } from '../backup'

const parameter: ParameterEntry = {
  id: 'a',
  kind: 'parameter',
  name: 'a',
  value: 0,
  min: 0,
  max: 10,
  step: 0.01,
  mode: 'slider',
}
function spatial(formula: string, kind: 'point' | 'implicit') {
  return { ...newExpression(formula), kind }
}
const view = { xMin: -5, xMax: 5, yMin: -5, yMax: 5 }
function contour(formula: string) {
  const compiled = compileGraph({ entries: [spatial(formula, 'implicit')] })
  expect(compiled.errors).toEqual({})
  return sampleImplicit(compiled.implicitCurves[0], view, 600, 400)
}
describe('points and implicit equations', () => {
  it('resolves forward functions and parameters for both coordinates and implicit x/y variables', () => {
    const graph = {
      entries: [
        spatial('(min(a, 3), f(a))', 'point'),
        spatial('x^2 + y^2 = f(a)', 'implicit'),
        newExpression('f(t)=t^2'),
        { ...parameter, value: 2 },
      ],
    }
    const result = compileGraph(graph)
    expect(result.errors).toEqual({})
    expect(result.points[0]).toMatchObject({ x: 2, y: 4 })
    expect(result.implicitCurves[0].evaluate(2, 0)).toBe(0)
    expect(result.implicitCurves[0].evaluate(0, 2)).toBe(0)
    expect(result.implicitCurves[0].evaluate(0, 0)).toBe(-4)
    graph.entries[3] = { ...parameter, value: 3 }
    expect(compileGraph(graph).points[0]).toMatchObject({ x: 3, y: 9 })
  })
  it('isolates invalid pairs/equations and does not leak spatial variables into constants', () => {
    for (const [formula, kind] of [
      ['(1,2,3)', 'point'],
      ['(x,2)', 'point'],
      ['(1/0,2)', 'point'],
      ['x < y', 'implicit'],
      ['x=y=2', 'implicit'],
      ['x+y=k', 'implicit'],
    ] as const) {
      const result = compileGraph({
        entries: [spatial(formula, kind), newExpression('k=y'), newExpression('y=sin(x)')],
      })
      expect(Object.keys(result.errors).length).toBeGreaterThan(0)
      expect(result.curves).toHaveLength(1)
      expect(result.points).toHaveLength(0)
      expect(result.implicitCurves).toHaveLength(0)
    }
  })
  it('honors visibility and restrictions involving either coordinate', () => {
    const hidden = { ...spatial('(1,2)', 'point'), visible: false }
    const result = compileGraph({ entries: [hidden, spatial('x^2+y^2=4 {x>0}{y>0}', 'implicit')] })
    expect(result.points).toHaveLength(0)
    expect(result.implicitCurves[0].evaluate(-1, 1)).toBeNaN()
    expect(result.implicitCurves[0].evaluate(1, -1)).toBeNaN()
    expect(result.implicitCurves[0].evaluate(1, 1)).toBe(-2)
  })
  it('samples circles, vertical lines, and disconnected hyperbola branches', () => {
    const circle = contour('x^2+y^2=9')
    expect(circle.error).toBe('')
    expect(circle.points.filter(Boolean).length).toBeGreaterThan(100)
    for (const p of circle.points)
      if (p) expect(Math.abs(p.x ** 2 + p.y ** 2 - 9)).toBeLessThan(0.002)
    const line = contour('x=1.23')
    expect(line.points.filter(Boolean).length).toBeGreaterThan(40)
    for (const p of line.points) if (p) expect(p.x).toBeCloseTo(1.23, 3)
    const hyperbola = contour('x*y=1')
    expect(hyperbola.error).toBe('')
    for (const p of hyperbola.points) if (p) expect(p.x * p.y).toBeCloseTo(1, 3)
    expect(hyperbola.points.some((p) => p && p.x < 0)).toBe(true)
    expect(hyperbola.points.some((p) => p && p.x > 0)).toBe(true)
  })
  it('does not turn a pole or a jump into a false zero contour', () => {
    expect(contour('1/(x-0.013)=0').path).toBe('')
    expect(contour('sign(x-0.013)=0').path).toBe('')
  })
  it('bounds total implicit evaluation work, including expensive function dependencies', () => {
    const entries = [
      newExpression('f0(t)=t'),
      ...Array.from({ length: 8 }, (_, i) => newExpression(`f${i + 1}(t)=f${i}(t)+f${i}(t)`)),
      spatial('f8(x)+y=0', 'implicit'),
    ]
    const compiled = compileGraph({ entries })
    expect(compiled.implicitCurves).toHaveLength(1)
    const result = sampleImplicit(compiled.implicitCurves[0], view, 600, 400)
    expect(result.path).toBe('')
    expect(result.error).toContain('too complex')
  })
})
describe('parameter playback and labels', () => {
  it('takes five seconds per traversal and applies speed, step, and stop mode', () => {
    const entry = { ...parameter, animation: { speed: 1, mode: 'once' as const } }
    expect(advanceParameter(entry, 0, 2500)).toMatchObject({ value: 5, done: false })
    expect(advanceParameter(entry, 0, 5000)).toMatchObject({ value: 10, done: true })
    expect(
      advanceParameter({ ...entry, animation: { speed: 2, mode: 'once' } }, 0, 2500).done,
    ).toBe(true)
    expect(advanceParameter({ ...entry, step: 3 }, 0, 5000).value).toBe(10)
    expect(advanceParameter({ ...entry, step: 3 }, 0, 1300).value).toBe(3)
  })
  it('loops and reverses correctly across endpoints and large elapsed times', () => {
    expect(advanceParameter(parameter, 0, 6000).value).toBe(2)
    const reverse = { ...parameter, animation: { speed: 1, mode: 'reverse' as const } }
    expect(advanceParameter(reverse, 0, 5000)).toMatchObject({ value: 10, direction: -1 })
    expect(advanceParameter(reverse, 0, 7500)).toMatchObject({ value: 5, direction: -1 })
    expect(advanceParameter(reverse, 0, 12500)).toMatchObject({ value: 5, direction: 1 })
    expect(advanceParameter({ ...reverse, min: 10 }, 10, 1000).done).toBe(true)
  })
  it('projects labels onto the curve in screen coordinates without crossing path gaps', () => {
    const result = projectLabel(
      [
        { x: -5, y: -5 },
        { x: 5, y: 5 },
      ],
      { x: 400, y: 200 },
      view,
      600,
      400,
    )!
    expect(result.point.x).toBeCloseTo(result.point.y)
    expect(result.angle).toBeCloseTo(-33.69, 2)
    const gap = projectLabel(
      [{ x: -2, y: 0 }, null, { x: 2, y: 0 }],
      { x: 300, y: 200 },
      view,
      600,
      400,
    )!
    expect(Math.abs(gap.point.x)).toBe(2)
  })
  it('round trips new rows, ordering, label styling, and animation settings through backups', () => {
    const graph: GraphDocument = {
      ...emptyGraph(),
      entries: [
        spatial('(a, a^2)', 'point'),
        { ...parameter, animation: { mode: 'reverse', speed: 2 } },
        {
          ...spatial('x^2+y^2=4', 'implicit'),
          labelStyle: {
            ...DEFAULT_LABEL,
            anchor: { x: 2, y: 0 },
            size: 18,
            orientation: 'parallel',
            angle: 22.5,
          },
        },
      ],
    }
    const added = addProject(emptyLibrary(), starterInput, '', graph)
    const restored = restoreCopies(
      emptyLibrary(),
      parseBackup(serializeBackup(added.library)).library,
    )
    expect(restored.projects[0].graph).toEqual(graph)
    expect(validGraph(emptyGraph())).toBe(true)
    for (const invalid of [
      { ...parameter, animation: { mode: 'other', speed: 1 } },
      { ...parameter, animation: { mode: 'loop', speed: Infinity } },
      { ...newExpression('y=x'), labelStyle: { ...DEFAULT_LABEL, angle: 181 } },
      { ...newExpression('y=x'), labelStyle: { ...DEFAULT_LABEL, anchor: { x: NaN, y: 0 } } },
    ])
      expect(validGraph({ ...graph, entries: [invalid] })).toBe(false)
  })
})
