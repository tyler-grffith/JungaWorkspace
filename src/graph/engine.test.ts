import { describe, it, expect } from 'vitest'
import { compileGraph } from './engine'
import { emptyGraph, laplaceGraph, newExpression, validGraph, type ParameterEntry } from './model'
import { sampleCurve, zoomView, panView, ticks } from './plot'

function calculate(formulas: string[]) {
  return compileGraph({
    ...emptyGraph(),
    entries: formulas.map((formula) => newExpression(formula)),
  })
}
describe('numeric graph evaluation', () => {
  it('recreates every curve in the LaPlace reference, including composed domains', () => {
    const compiled = compileGraph(laplaceGraph())
    expect(compiled.errors).toEqual({})
    expect(compiled.curves).toHaveLength(5)
    const t = 0.8,
      f = Math.exp(-t) * Math.sin(t),
      f2 = Math.exp(1.16 * t),
      fp = Math.sin(3.8 * t)
    const expected = [f, f2, fp, f * f2 * fp, f * f2]
    compiled.curves.forEach((curve, i) => expect(curve.evaluate(t)).toBeCloseTo(expected[i], 11))
    expect(compiled.curves[0].evaluate(0)).toBeNaN()
    expect(compiled.curves[3].evaluate(-1)).toBeNaN()
    expect(compiled.curves[2].evaluate(-1)).toBeCloseTo(Math.sin(-3.8))
  })
  it('respects precedence, exponent association, and implicit multiplication', () => {
    const result = calculate(['y=-x^2 + 2x + 3(x+1)', 'y=2^3^2', 'y=2^-2', 'y=sin(pi/2) + ln(e)'])
    expect(result.errors).toEqual({})
    expect(result.curves.map((c) => c.evaluate(2))).toEqual([9, 512, 0.25, 2])
  })
  it('supports forward references, constant expressions, and Unicode subscripts', () => {
    const result = calculate(['g(t)=f₂(t) + k', 'k=2pi', 'f₂(t)=t^2'])
    expect(result.errors).toEqual({})
    expect(result.curves[0].evaluate(3)).toBeCloseTo(9 + 2 * Math.PI)
    expect(Object.values(result.values)[0]).toBeCloseTo(2 * Math.PI)
  })
  it('updates dependent curves when a slider changes', () => {
    const graph = laplaceGraph()
    const p = graph.entries[0] as ParameterEntry
    p.value = 0
    expect(compileGraph(graph).curves[3].evaluate(1)).toBeCloseTo(0)
  })
  it('applies chained restrictions and disallows values outside a real domain', () => {
    const result = calculate(['y=sqrt(x) {-1 < x <= 4}', 'f(t)=t {t>0}{t<2}'])
    expect(result.errors).toEqual({})
    expect(result.curves[0].evaluate(4)).toBe(2)
    expect(result.curves[0].evaluate(-0.5)).toBeNaN()
    expect(result.curves[0].evaluate(5)).toBeNaN()
    expect(result.curves[1].evaluate(2)).toBeNaN()
  })
  it('isolates bad rows and reports unknown names, cycles, invalid calls, and duplicates', () => {
    for (const formulas of [
      ['f(x)=g(x)', 'g(x)=f(x)'],
      ['y=missing*x'],
      ['y=sin(1,2)'],
      ['a=1', 'a=2'],
      ['y=window.alert(1)'],
      ['y=constructor(1)'],
      ['y=x;2'],
      ['y=1=2'],
      ['sin=3'],
      ['y=(1+2'],
    ]) {
      const result = calculate([...formulas, 'y=x+1'])
      expect(Object.keys(result.errors).length, formulas.join(';')).toBeGreaterThan(0)
      expect(result.curves.at(-1)?.evaluate(2)).toBe(3)
    }
  })
  it('bounds evaluation of exponentially expanding dependencies', () => {
    const formulas = [
      'f0(x)=x',
      ...Array.from({ length: 15 }, (_, i) => `f${i + 1}(x)=f${i}(x)+f${i}(x)`),
    ]
    const result = calculate(formulas)
    expect(
      Object.values(result.errors).some((e) => e.includes('complex') || e.includes('Fix')),
    ).toBe(true)
  })
})
describe('plot sampling and viewport', () => {
  it('splits reciprocal curves at poles rather than bridging the discontinuity', () => {
    const curve = calculate(['y=1/(x-0.013)']).curves[0]
    const result = sampleCurve(curve, { xMin: -2, xMax: 2, yMin: -10, yMax: 10 }, 800, 500)
    expect(result.error).toBe('')
    expect(result.path.match(/M/g)!.length).toBeGreaterThan(1)
    for (let i = 1; i < result.points.length; i++) {
      const previous = result.points[i - 1],
        current = result.points[i]
      if (previous && current) expect(previous.x < 0.013 && current.x > 0.013).toBe(false)
    }
  })
  it('plots finite sample points only within a restricted domain', () => {
    const result = sampleCurve(
      calculate(['y=x {0<x<2}']).curves[0],
      { xMin: -2, xMax: 4, yMin: -1, yMax: 3 },
      700,
      400,
    )
    expect(result.points.filter((p) => p !== null).every((p) => p.x > 0 && p.x < 2)).toBe(true)
    expect(result.path).not.toContain('NaN')
  })
  it('centers zoom at the pointer and limits unusable viewports', () => {
    const view = { xMin: -10, xMax: 10, yMin: -5, yMax: 5 }
    expect(zoomView(view, 0.5, { x: 2, y: 1 })).toEqual({ xMin: -4, xMax: 6, yMin: -2, yMax: 3 })
    expect(panView(view, 2, -3)).toEqual({ xMin: -8, xMax: 12, yMin: -8, yMax: 2 })
    expect(zoomView(view, 1e20)).toBe(view)
    expect(ticks(-5, 5, 5)).toEqual([-4, -2, 0, 2, 4])
  })
  it('validates saved graph payloads, including slider constraints', () => {
    const graph = laplaceGraph()
    expect(validGraph(graph)).toBe(true)
    expect(validGraph({ ...graph, viewport: { ...graph.viewport, xMin: Infinity } })).toBe(false)
    expect(validGraph({ ...graph, entries: [{ ...graph.entries[0], step: 0 }] })).toBe(false)
    expect(validGraph({ ...graph, entries: [graph.entries[0], graph.entries[0]] })).toBe(false)
  })
})
