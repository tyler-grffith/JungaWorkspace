export const COLORS = ['#27664c', '#a84832', '#3e68ae', '#8653a1', '#9a701e', '#2c7b82'] as const
export type Viewport = { xMin: number; xMax: number; yMin: number; yMax: number }
export type ExpressionEntry = {
  id: string
  kind: 'expression'
  formula: string
  label: string
  color: string
  visible: boolean
}
export type ParameterEntry = {
  id: string
  kind: 'parameter'
  name: string
  value: number
  min: number
  max: number
  step: number
  mode: 'slider' | 'constant'
}
export type NoteEntry = { id: string; kind: 'note'; text: string }
export type GraphEntry = ExpressionEntry | ParameterEntry | NoteEntry
export type GraphDocument = {
  version: 1
  entries: GraphEntry[]
  viewport: Viewport
  showGrid: boolean
  showLabels: boolean
}
export const DEFAULT_VIEW: Viewport = { xMin: -10, xMax: 10, yMin: -6, yMax: 6 }
export const LAPLACE_URL = 'https://www.desmos.com/calculator/2awcmk9fzy'
export const MAX_ENTRIES = 40
export const newExpression = (formula = '', color: string = COLORS[0]): ExpressionEntry => ({
  id: crypto.randomUUID(),
  kind: 'expression',
  formula,
  label: '',
  color,
  visible: true,
})
export const emptyGraph = (): GraphDocument => ({
  version: 1,
  entries: [newExpression()],
  viewport: { ...DEFAULT_VIEW },
  showGrid: true,
  showLabels: true,
})
export function laplaceGraph(): GraphDocument {
  return {
    ...emptyGraph(),
    viewport: { xMin: -1.33, xMax: 7.23, yMin: -3.73, yMax: 2.95 },
    entries: [
      {
        id: crypto.randomUUID(),
        kind: 'parameter',
        name: 'p',
        value: 3.8,
        min: 0,
        max: 10,
        step: 0.1,
        mode: 'slider',
      },
      {
        id: crypto.randomUUID(),
        kind: 'parameter',
        name: 'a',
        value: 1.16,
        min: -0.5,
        max: 2,
        step: 0.01,
        mode: 'slider',
      },
      ...[
        'f(t) = e^(-t) sin(t) {t > 0}',
        'f_2(t) = e^(a t) {t > 0}',
        'f_p(t) = sin(p t)',
        'z_t(t) = f(t) f_2(t) f_p(t)',
        'z_p(t) = f(t) f_2(t)',
      ].map((formula, i) => newExpression(formula, COLORS[i])),
      {
        id: crypto.randomUUID(),
        kind: 'note',
        text: 'This is a comment.\nAdjust p and a to explore how the functions combine.',
      },
    ],
  }
}
const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
export function validViewport(v: unknown): v is Viewport {
  if (!record(v) || ![v.xMin, v.xMax, v.yMin, v.yMax].every(finite)) return false
  const w = (v.xMax as number) - (v.xMin as number),
    h = (v.yMax as number) - (v.yMin as number)
  return (
    w >= 1e-6 &&
    h >= 1e-6 &&
    w <= 2e8 &&
    h <= 2e8 &&
    Object.values(v).every((n) => typeof n === 'number' && Math.abs(n) <= 1e9)
  )
}
export function validGraph(value: unknown): value is GraphDocument {
  if (
    !record(value) ||
    value.version !== 1 ||
    !validViewport(value.viewport) ||
    typeof value.showGrid !== 'boolean' ||
    typeof value.showLabels !== 'boolean' ||
    !Array.isArray(value.entries) ||
    value.entries.length > MAX_ENTRIES
  )
    return false
  const ids = new Set<string>()
  return value.entries.every((entry) => {
    if (!record(entry) || typeof entry.id !== 'string' || !entry.id || ids.has(entry.id))
      return false
    ids.add(entry.id)
    if (entry.kind === 'note') return typeof entry.text === 'string' && entry.text.length <= 4000
    if (entry.kind === 'expression')
      return (
        typeof entry.formula === 'string' &&
        entry.formula.length <= 500 &&
        typeof entry.label === 'string' &&
        entry.label.length <= 60 &&
        typeof entry.color === 'string' &&
        /^#[0-9a-f]{6}$/i.test(entry.color) &&
        typeof entry.visible === 'boolean'
      )
    if (entry.kind === 'parameter')
      return (
        typeof entry.name === 'string' &&
        entry.name.length <= 40 &&
        finite(entry.value) &&
        finite(entry.min) &&
        finite(entry.max) &&
        finite(entry.step) &&
        entry.min <= entry.max &&
        entry.step > 0 &&
        ['slider', 'constant'].includes(entry.mode as string) &&
        (entry.mode === 'constant' || (entry.value >= entry.min && entry.value <= entry.max))
      )
    return false
  })
}
