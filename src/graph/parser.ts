// A bounded numeric grammar. Expressions never execute JavaScript or access objects.
export type Node =
  | { kind: 'number'; value: number }
  | { kind: 'symbol'; name: string }
  | { kind: 'unary'; sign: string; value: Node }
  | { kind: 'binary'; op: string; left: Node; right: Node }
  | { kind: 'call'; name: string; args: Node[] }
export type Definition = {
  name?: string
  parameter?: string
  body: Node
  domains: Node[][]
  comparisons: string[][]
  plotted: boolean
  spatial?: boolean
}

export function parsePoint(source: string, variables: Set<string>): [Definition, Definition] {
  const text = normalize(source).trim()
  if (!text.startsWith('(') || !text.endsWith(')'))
    throw new Error('Enter an ordered pair, such as (2, 3) or (a, sin(a)).')
  const body = text.slice(1, -1)
  let depth = 0
  const commas: number[] = []
  for (let i = 0; i < body.length; i++) {
    if (body[i] === '(') depth++
    if (body[i] === ')') depth--
    if (body[i] === ',' && depth === 0) commas.push(i)
  }
  if (commas.length !== 1) throw new Error('An ordered pair needs exactly two coordinates: (x, y).')
  const coordinate = (source: string): Definition => ({
    body: parseMath(source, new Set([...variables, 'e', 'pi', 'tau'])),
    domains: [],
    comparisons: [],
    plotted: false,
  })
  return [coordinate(body.slice(0, commas[0])), coordinate(body.slice(commas[0] + 1))]
}

export function parseImplicit(source: string, variables: Set<string>): Definition {
  const text = normalize(source).trim()
  const restrictionStart = text.indexOf('{')
  const equation = restrictionStart < 0 ? text : text.slice(0, restrictionStart)
  const restrictions = restrictionStart < 0 ? '' : text.slice(restrictionStart)
  const sides = equation.split('=')
  if (sides.length !== 2 || sides.some((s) => !s.trim()) || /[<>!]/.test(equation))
    throw new Error('Enter an equation in x and y, such as x^2 + y^2 = 9.')
  return {
    ...parseDefinition(
      `(${sides[0]}) - (${sides[1]}) ${restrictions}`,
      new Set([...variables, 'y']),
    ),
    spatial: true,
  }
}
const SUBS: Record<string, string> = {
  '₀': '0',
  '₁': '1',
  '₂': '2',
  '₃': '3',
  '₄': '4',
  '₅': '5',
  '₆': '6',
  '₇': '7',
  '₈': '8',
  '₉': '9',
  ₐ: 'a',
  ₑ: 'e',
  ₕ: 'h',
  ᵢ: 'i',
  ⱼ: 'j',
  ₖ: 'k',
  ₗ: 'l',
  ₘ: 'm',
  ₙ: 'n',
  ₒ: 'o',
  ₚ: 'p',
  ᵣ: 'r',
  ₛ: 's',
  ₜ: 't',
  ᵤ: 'u',
  ᵥ: 'v',
  ₓ: 'x',
}
export function normalize(source: string) {
  return source
    .replace(/[−–]/g, '-')
    .replace(/[×·]/g, '*')
    .replace(/÷/g, '/')
    .replace(/π/g, 'pi')
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/[₀₁₂₃₄₅₆₇₈₉ₐₑₕᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓ]+/g, (s) => '_' + [...s].map((c) => SUBS[c]).join(''))
}
type Token = { text: string; type: 'number' | 'name' | 'operator' | 'end' }
function tokenize(source: string): Token[] {
  if (source.length > 500) throw new Error('Keep an expression under 500 characters.')
  const tokens: Token[] = []
  let i = 0
  while (i < source.length) {
    const rest = source.slice(i)
    if (/^\s/.test(rest)) {
      i++
      continue
    }
    const number = rest.match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/)
    const name = rest.match(/^[a-zA-Z][a-zA-Z0-9_]*/)
    if (number) {
      tokens.push({ text: number[0], type: 'number' })
      i += number[0].length
    } else if (name) {
      tokens.push({ text: name[0], type: 'name' })
      i += name[0].length
    } else if ('+-*/^(),'.includes(source[i])) {
      tokens.push({ text: source[i], type: 'operator' })
      i++
    } else
      throw new Error(`Unexpected “${source[i]}”. Use numbers, names, and mathematical operators.`)
    if (tokens.length > 180)
      throw new Error('This expression is too complex. Split it into smaller functions.')
  }
  return [...tokens, { text: '', type: 'end' }]
}
export function parseMath(source: string, knownVariables = new Set<string>()): Node {
  const tokens = tokenize(source)
  let i = 0,
    depth = 0
  const peek = () => tokens[i]
  const take = () => tokens[i++]
  function expression(minBinding = 0): Node {
    if (++depth > 40)
      throw new Error('Too many nested brackets. Split this into smaller functions.')
    const token = take()
    let left: Node
    if (token.type === 'number') {
      const value = Number(token.text)
      if (!Number.isFinite(value)) throw new Error('Use a finite number.')
      left = { kind: 'number', value }
    } else if (token.type === 'name') {
      if (peek().text === '(' && !knownVariables.has(token.text)) {
        take()
        const args: Node[] = []
        if (peek().text !== ')') {
          args.push(expression())
          while (peek().text === ',') {
            take()
            args.push(expression())
          }
        }
        if (take().text !== ')')
          throw new Error('Close the function call with a right parenthesis.')
        left = { kind: 'call', name: token.text, args }
      } else left = { kind: 'symbol', name: token.text }
    } else if (token.text === '+' || token.text === '-')
      left = { kind: 'unary', sign: token.text, value: expression(25) }
    else if (token.text === '(') {
      left = expression()
      if (take().text !== ')') throw new Error('Close the expression with a right parenthesis.')
    } else throw new Error('Enter a number, variable, or function here.')
    while (peek() && peek().type !== 'end' && ![')', ','].includes(peek().text)) {
      const next = peek()
      const implicit = next.type === 'number' || next.type === 'name' || next.text === '('
      const op = implicit ? '*' : next.text
      const binding =
        op === '+' || op === '-' ? 10 : op === '*' || op === '/' ? 20 : op === '^' ? 30 : -1
      if (binding < minBinding || binding < 0) break
      if (!implicit) take()
      const right = expression(op === '^' ? binding : binding + 1)
      left = { kind: 'binary', op, left, right }
    }
    depth--
    return left
  }
  const result = expression()
  if (peek().type !== 'end')
    throw new Error(`Unexpected “${peek().text}”. Check your brackets and operators.`)
  return result
}

export function parseDefinition(source: string, variables = new Set<string>()): Definition {
  const normalized = normalize(source).trim()
  const restrictions: string[] = []
  const body = normalized
    .replace(/\{([^{}]*)\}/g, (_, restriction: string) => {
      restrictions.push(restriction)
      return ''
    })
    .trim()
  if (/[{}]/.test(body)) throw new Error('Close each domain restriction, for example {x > 0}.')
  if (restrictions.length && !/^(?:[^{}]*)(?:\s*\{[^{}]*\}\s*)+$/.test(normalized))
    throw new Error('Put domain restrictions at the end of the expression.')
  const definition = body.match(
    /^([a-zA-Z][a-zA-Z0-9_]*)(?:\(\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\))?\s*=(?!=)\s*(.*)$/,
  )
  const name = definition?.[1],
    parameter = definition?.[2]
  if (name === 'y' && parameter)
    throw new Error('Use y = expression, or choose another function name.')
  const plotted = !definition || !!parameter || name === 'y'
  const locals = new Set([...variables, 'x', 'e', 'pi', 'tau', ...(parameter ? [parameter] : [])])
  const domains: Node[][] = [],
    comparisons: string[][] = []
  for (const restriction of restrictions) {
    for (const clause of restriction.split(',')) {
      const pieces = clause.trim().split(/(<=|>=|==|!=|<|>)/)
      if (pieces.length < 3 || pieces.some((s) => !s.trim()))
        throw new Error('Use a comparison such as {t > 0} or {-2 < x < 2}.')
      domains.push(pieces.filter((_, i) => i % 2 === 0).map((s) => parseMath(s, locals)))
      comparisons.push(pieces.filter((_, i) => i % 2 === 1))
    }
  }
  return {
    name: name === 'y' ? undefined : name,
    parameter,
    body: parseMath(definition?.[3] ?? body, locals),
    domains,
    comparisons,
    plotted,
  }
}
