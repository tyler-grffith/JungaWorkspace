import {
  normalize,
  parseDefinition,
  parsePoint,
  parseImplicit,
  type Definition,
  type Node,
} from './parser'
import type { ExpressionEntry, GraphDocument, ImplicitEntry, PointEntry } from './model'

const builtins = new Map<string, { count: number; fn: (...args: number[]) => number }>([
  ...[
    'sin',
    'cos',
    'tan',
    'asin',
    'acos',
    'atan',
    'sinh',
    'cosh',
    'tanh',
    'exp',
    'sqrt',
    'abs',
    'floor',
    'ceil',
    'round',
    'sign',
    'log10',
  ].map(
    (name) =>
      [
        name,
        { count: 1, fn: (Math as unknown as Record<string, (x: number) => number>)[name] },
      ] as const,
  ),
  ['ln', { count: 1, fn: Math.log }],
  ['log', { count: 1, fn: Math.log }],
  ['min', { count: 2, fn: Math.min }],
  ['max', { count: 2, fn: Math.max }],
  ['pow', { count: 2, fn: Math.pow }],
  ['atan2', { count: 2, fn: Math.atan2 }],
])
const constants = new Map([
  ['e', Math.E],
  ['pi', Math.PI],
  ['tau', 2 * Math.PI],
])
const reserved = (name: string) =>
  builtins.has(name) || constants.has(name) || name === 'x' || name === 'y'
export type Curve = { entry: ExpressionEntry; label: string; evaluate: (x: number) => number }
export type ImplicitCurve = {
  entry: ImplicitEntry
  label: string
  evaluate: (x: number, y: number, budget?: { remaining: number }) => number
}
export type GraphPoint = { entry: PointEntry; label: string; x: number; y: number }
export type CompiledGraph = {
  curves: Curve[]
  implicitCurves: ImplicitCurve[]
  points: GraphPoint[]
  errors: Record<string, string>
  values: Record<string, number>
}
type Named = { id: string; definition: Definition }
const message = (error: unknown) =>
  error instanceof Error ? error.message : 'Check this expression.'

export function compileGraph(graph: Pick<GraphDocument, 'entries'>): CompiledGraph {
  const errors: Record<string, string> = {},
    values: Record<string, number> = {}
  const definitions = new Map<string, Named>(),
    rows = new Map<string, Definition>()
  const pairs = new Map<string, [Definition, Definition]>()
  const variables = new Set(
    graph.entries.flatMap((entry) =>
      entry.kind === 'parameter'
        ? [normalize(entry.name.trim())]
        : entry.kind === 'expression'
          ? [normalize(entry.formula).match(/^\s*([a-zA-Z][a-zA-Z0-9_]*)\s*=(?!=)/)?.[1] ?? '']
          : [],
    ),
  )
  function register(name: string, definition: Definition, id: string) {
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name))
      throw new Error('Use a name such as a, p, or frequency (letters, numbers, underscores).')
    if (reserved(name)) throw new Error(`“${name}” is reserved. Choose another name.`)
    const existing = definitions.get(name)
    if (existing) {
      errors[existing.id] = `“${name}” is defined more than once.`
      throw new Error(errors[existing.id])
    }
    definitions.set(name, { definition, id })
  }
  for (const entry of graph.entries) {
    try {
      if (entry.kind === 'parameter') {
        const name = normalize(entry.name.trim())
        register(
          name,
          {
            name,
            body: { kind: 'number', value: entry.value },
            domains: [],
            comparisons: [],
            plotted: false,
          },
          entry.id,
        )
      } else if (entry.kind === 'expression' && entry.formula.trim()) {
        const definition = parseDefinition(entry.formula, variables)
        if (definition.name) register(definition.name, definition, entry.id)
        rows.set(entry.id, definition)
      } else if (entry.kind === 'implicit' && entry.formula.trim()) {
        rows.set(entry.id, parseImplicit(entry.formula, variables))
      } else if (entry.kind === 'point' && entry.formula.trim()) {
        pairs.set(entry.id, parsePoint(entry.formula, variables))
      }
    } catch (error) {
      errors[entry.id] = message(error)
    }
  }

  const validated = new Set<Definition>()
  function checkDefinition(definition: Definition, visiting: Set<string>) {
    if (validated.has(definition)) return
    const local = definition.parameter ?? (definition.plotted ? 'x' : undefined)
    function dependency(name: string, call: boolean, count = 0) {
      if (!call && (name === local || (definition.spatial && name === 'y') || constants.has(name)))
        return
      if (call && builtins.has(name)) {
        if (builtins.get(name)!.count !== count)
          throw new Error(`${name} expects ${builtins.get(name)!.count} argument(s).`)
        return
      }
      const found = definitions.get(name)
      if (!found) throw new Error(`“${name}” is not defined. Add a parameter or function first.`)
      if (errors[found.id]) throw new Error(`Fix “${name}” first: ${errors[found.id]}`)
      if (call && !found.definition.parameter)
        throw new Error(`“${name}” is a number. Use * to multiply it.`)
      if (!call && found.definition.parameter)
        throw new Error(`“${name}” is a function. Use ${name}(${local ?? 'x'}).`)
      if (call && count !== 1) throw new Error(`${name} expects one argument.`)
      if (visiting.has(name)) throw new Error(`Circular definition involving “${name}”.`)
      if (visiting.size > 25)
        throw new Error('Too many dependent functions. Simplify this expression.')
      const next = new Set(visiting)
      next.add(name)
      checkDefinition(found.definition, next)
    }
    let checks = 0
    function visit(node: Node) {
      if (++checks > 200)
        throw new Error('Too many operations. Split this expression into functions.')
      if (node.kind === 'symbol') dependency(node.name, false)
      else if (node.kind === 'call') {
        node.args.forEach(visit)
        dependency(node.name, true, node.args.length)
      } else if (node.kind === 'unary') visit(node.value)
      else if (node.kind === 'binary') {
        visit(node.left)
        visit(node.right)
      }
    }
    definition.domains.flat().forEach(visit)
    visit(definition.body)
    validated.add(definition)
  }

  function evaluator(definition: Definition) {
    return (x: number, y = 0, budget?: { remaining: number }) => {
      let operations = 0
      function evaluate(
        node: Node,
        localName?: string,
        localValue?: number,
        spatial = false,
      ): number {
        if (++operations > 4000)
          throw new Error(
            'This calculation is too complex to plot interactively. Simplify its dependencies.',
          )
        if (budget && --budget.remaining < 0)
          throw new Error(
            'This implicit calculation is too complex to plot interactively. Simplify its dependencies.',
          )
        if (node.kind === 'number') return node.value
        if (node.kind === 'symbol') {
          if (node.name === localName) return localValue!
          if (spatial && node.name === 'y') return y
          if (constants.has(node.name)) return constants.get(node.name)!
          return run(definitions.get(node.name)!.definition)
        }
        if (node.kind === 'unary')
          return (node.sign === '-' ? -1 : 1) * evaluate(node.value, localName, localValue, spatial)
        if (node.kind === 'call') {
          const args = node.args.map((arg) => evaluate(arg, localName, localValue, spatial))
          if (builtins.has(node.name)) return builtins.get(node.name)!.fn(...args)
          return run(definitions.get(node.name)!.definition, args[0])
        }
        const left = evaluate(node.left, localName, localValue, spatial),
          right = evaluate(node.right, localName, localValue, spatial)
        switch (node.op) {
          case '+':
            return left + right
          case '-':
            return left - right
          case '*':
            return left * right
          case '/':
            return left / right
          default:
            return left ** right
        }
      }
      function run(def: Definition, value?: number): number {
        const local = def.parameter ?? (def.plotted ? 'x' : undefined)
        for (let i = 0; i < def.domains.length; i++) {
          const numbers = def.domains[i].map((node) => evaluate(node, local, value, def.spatial))
          for (let j = 0; j < def.comparisons[i].length; j++) {
            const a = numbers[j],
              b = numbers[j + 1]
            if (!Number.isFinite(a) || !Number.isFinite(b)) return NaN
            const matches = (() => {
              switch (def.comparisons[i][j]) {
                case '<':
                  return a < b
                case '>':
                  return a > b
                case '<=':
                  return a <= b
                case '>=':
                  return a >= b
                case '==':
                  return a === b
                default:
                  return a !== b
              }
            })()
            if (!matches) return NaN
          }
        }
        return evaluate(def.body, local, value, def.spatial)
      }
      return run(definition, x)
    }
  }
  const curves: Curve[] = []
  const implicitCurves: ImplicitCurve[] = []
  const points: GraphPoint[] = []
  for (const entry of graph.entries) {
    if (errors[entry.id]) continue
    if (entry.kind === 'point' && pairs.has(entry.id)) {
      try {
        const pair = pairs.get(entry.id)!
        pair.forEach((d) => checkDefinition(d, new Set()))
        const [x, y] = pair.map((d) => evaluator(d)(0))
        if (![x, y].every((v) => Number.isFinite(v) && Math.abs(v) <= 1e9))
          throw new Error(
            'Both coordinates must be finite numbers between −1 billion and 1 billion.',
          )
        if (entry.visible) points.push({ entry, x, y, label: entry.label.trim() || entry.formula })
      } catch (error) {
        errors[entry.id] = message(error)
      }
      continue
    }
    if ((entry.kind !== 'expression' && entry.kind !== 'implicit') || !rows.has(entry.id)) continue
    const definition = rows.get(entry.id)!
    try {
      checkDefinition(definition, new Set(definition.name ? [definition.name] : []))
      const evaluate = evaluator(definition)
      const probe = evaluate(0.731)
      if (entry.kind === 'implicit') {
        if (entry.visible)
          implicitCurves.push({ entry, label: entry.label.trim() || entry.formula, evaluate })
      } else if (definition.plotted) {
        if (entry.visible)
          curves.push({
            entry,
            label:
              entry.label.trim() ||
              (definition.name
                ? `${definition.name}(${definition.parameter})`
                : entry.formula.split('{')[0].trim()),
            evaluate,
          })
      } else {
        if (!Number.isFinite(probe)) throw new Error('This constant is not a finite real number.')
        values[entry.id] = probe
      }
    } catch (error) {
      errors[entry.id] = message(error)
    }
  }
  return { curves, implicitCurves, points, errors, values }
}
