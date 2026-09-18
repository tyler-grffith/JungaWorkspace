import { address, position, type CellFormat, type SheetDocument } from './model'

export type Value = number | string | boolean | null
export type CellResult = { value: Value; error?: string; code?: string }
class FormulaError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message)
  }
}
const fail = (code: string, message: string): never => {
  throw new FormulaError(code, message)
}
type Node =
  | { kind: 'value'; value: Value }
  | { kind: 'ref'; ref: string }
  | { kind: 'range'; from: string; to: string }
  | { kind: 'error'; code: string }
  | { kind: 'unary'; op: string; child: Node }
  | { kind: 'binary'; op: string; left: Node; right: Node }
  | { kind: 'call'; name: string; args: Node[] }
type Token = { type: 'number' | 'string' | 'name' | 'op' | 'error' | 'end'; text: string }

function parse(source: string): Node {
  if (source.length > 500) return fail('#LIMIT!', 'Keep formulas under 500 characters.')
  const tokens: Token[] = []
  let rest = source,
    i = 0,
    depth = 0
  while (rest) {
    if (/^\s/.test(rest)) {
      rest = rest.slice(1)
      continue
    }
    const number = rest.match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/)
    const string = rest.match(/^"(?:[^"]|"")*"/)
    const error = rest.match(/^#(?:REF!|DIV\/0!|VALUE!|NAME\?|NUM!|CYCLE!|ERROR!|LIMIT!)/i)
    const name = rest.match(/^\$?[a-zA-Z_][a-zA-Z0-9_.$]*/)
    const op = rest.match(/^(?:<=|>=|<>|[+\-*/^%&=<>(),:])/)
    const match = number ?? string ?? error ?? name ?? op
    if (!match) return fail('#ERROR!', `Unexpected “${rest[0]}”. Check the formula syntax.`)
    tokens.push({
      type: number ? 'number' : string ? 'string' : error ? 'error' : name ? 'name' : 'op',
      text: match[0],
    })
    rest = rest.slice(match[0].length)
    if (tokens.length > 220) return fail('#LIMIT!', 'Split this formula into smaller calculations.')
  }
  tokens.push({ type: 'end', text: '' })
  const peek = () => tokens[i] ?? tokens[tokens.length - 1]
  const take = () => tokens[i++] ?? tokens[tokens.length - 1]
  const expect = (text: string) => {
    if (take().text !== text)
      fail('#ERROR!', `Expected “${text}”. Check the brackets and arguments.`)
  }
  function expression(min = 0): Node {
    if (++depth > 40) return fail('#LIMIT!', 'Too many nested expressions.')
    const token = take()
    let left: Node
    if (token.type === 'number') left = { kind: 'value', value: Number(token.text) }
    else if (token.type === 'string')
      left = { kind: 'value', value: token.text.slice(1, -1).replace(/""/g, '"') }
    else if (token.type === 'error') left = { kind: 'error', code: token.text.toUpperCase() }
    else if (token.text === '+' || token.text === '-')
      left = { kind: 'unary', op: token.text, child: expression(25) }
    else if (token.text === '(') {
      left = expression()
      expect(')')
    } else if (token.type === 'name') {
      const name = token.text.toUpperCase()
      if (peek().text === '(') {
        take()
        const args: Node[] = []
        if (peek().text !== ')') {
          args.push(expression())
          while (peek().text === ',') {
            take()
            args.push(expression())
          }
        }
        expect(')')
        left = { kind: 'call', name, args }
      } else if (name === 'TRUE' || name === 'FALSE')
        left = { kind: 'value', value: name === 'TRUE' }
      else if (position(name)) {
        left = { kind: 'ref', ref: name }
        if (peek().text === ':') {
          take()
          const end = take().text.toUpperCase()
          if (!position(end)) return fail('#REF!', 'Use a range such as A1:B5.')
          left = { kind: 'range', from: name, to: end }
        }
      } else return fail('#NAME?', `“${token.text}” is not a cell reference or supported name.`)
    } else return fail('#ERROR!', 'Enter a value, cell reference, or function here.')
    while (true) {
      const op = peek().text
      if (op === '%' && min <= 40) {
        take()
        left = { kind: 'unary', op, child: left }
        continue
      }
      const power = ['=', '<>', '<', '>', '<=', '>='].includes(op)
        ? 5
        : op === '&'
          ? 8
          : ['+', '-'].includes(op)
            ? 10
            : ['*', '/'].includes(op)
              ? 20
              : op === '^'
                ? 30
                : -1
      if (power < min) break
      take()
      left = { kind: 'binary', op, left, right: expression(op === '^' ? power : power + 1) }
    }
    depth--
    return left
  }
  const ast = expression()
  if (peek().type !== 'end')
    return fail('#ERROR!', 'Use operators between values and check your brackets.')
  return ast
}
const numericText = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/
export function literal(input: string): Value {
  if (input.startsWith("'")) return input.slice(1)
  const clean = input.trim()
  if (!clean) return null
  if (/^(TRUE|FALSE)$/i.test(clean)) return clean.toUpperCase() === 'TRUE'
  const percent = clean.endsWith('%'),
    n = percent ? clean.slice(0, -1) : clean
  if (numericText.test(n) && Number.isFinite(Number(n))) return Number(n) / (percent ? 100 : 1)
  return input
}
const scalar = (v: Value | Value[]): Value =>
  Array.isArray(v) ? fail('#VALUE!', 'Use a range inside an aggregate such as SUM or AVERAGE.') : v
const numeric = (v: Value | Value[]): number => {
  const n = scalar(v)
  if (n === null || n === '') return 0
  if (typeof n === 'boolean') return n ? 1 : 0
  if (typeof n === 'number') return n
  if (numericText.test(n.trim())) return Number(n)
  return fail('#VALUE!', 'This calculation needs a number, but a referenced value is text.')
}
const finite = (n: number) =>
  Number.isFinite(n) ? n : fail('#NUM!', 'The result is outside the finite real-number range.')
const truth = (v: Value | Value[]) => {
  const n = scalar(v)
  return typeof n === 'string' ? n !== '' : !!n
}
const textValue = (v: Value) =>
  v === null ? '' : typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : String(v)
const unaryFunctions: Record<string, (x: number) => number> = {
  ABS: Math.abs,
  SQRT: Math.sqrt,
  SIN: Math.sin,
  COS: Math.cos,
  TAN: Math.tan,
  ASIN: Math.asin,
  ACOS: Math.acos,
  ATAN: Math.atan,
  EXP: Math.exp,
  LN: Math.log,
  LOG10: Math.log10,
  INT: Math.floor,
  SIGN: Math.sign,
  RADIANS: (x) => (x * Math.PI) / 180,
  DEGREES: (x) => (x * 180) / Math.PI,
  COT: (x) => 1 / Math.tan(x),
}

export function calculateSheet(sheet: SheetDocument): Record<string, CellResult> {
  const cache: Record<string, CellResult> = {},
    visiting = new Set<string>(),
    asts = new Map<string, Node>()
  let operations = 0
  const tick = () => {
    if (++operations > 300000)
      fail(
        '#LIMIT!',
        'This sheet is too complex to recalculate. Reduce large ranges or repeated calculations.',
      )
  }
  function read(ref: string): Value {
    tick()
    const p = position(ref)!
    if (p.row >= sheet.rows || p.col >= sheet.columns)
      return fail(
        '#REF!',
        'This reference is outside the worksheet. Add rows or columns, or correct the reference.',
      )
    const key = address(p)
    if (visiting.has(key)) return fail('#CYCLE!', `Circular reference involving ${key}.`)
    if (visiting.size > 150)
      return fail('#LIMIT!', 'This chain of dependent cells is too long. Split the calculation.')
    if (!cache[key]) {
      const input = sheet.cells[key]?.input ?? ''
      visiting.add(key)
      try {
        let value: Value
        if (input.trimStart().startsWith('=')) {
          const formula = input.trimStart().slice(1)
          let ast = asts.get(formula)
          if (!ast) {
            ast = parse(formula)
            asts.set(formula, ast)
          }
          value = scalar(evaluate(ast)) ?? 0
          if (typeof value === 'number') finite(value)
        } else value = literal(input)
        cache[key] = { value }
      } catch (error) {
        cache[key] = {
          value: null,
          code: error instanceof FormulaError ? error.code : '#ERROR!',
          error: error instanceof Error ? error.message : 'Check this formula.',
        }
      } finally {
        visiting.delete(key)
      }
    }
    const result = cache[key]
    if (result.error) return fail(result.code!, result.error)
    return result.value
  }
  function evaluate(node: Node): Value | Value[] {
    tick()
    if (node.kind === 'value') return node.value
    if (node.kind === 'ref') return read(node.ref)
    if (node.kind === 'error')
      return fail(node.code, 'This formula contains an invalid reference or error value.')
    if (node.kind === 'range') {
      const from = position(node.from)!,
        to = position(node.to)!
      if (Math.max(from.row, to.row) >= sheet.rows || Math.max(from.col, to.col) >= sheet.columns)
        return fail('#REF!', 'This range extends beyond the worksheet.')
      const result: Value[] = []
      for (let row = Math.min(from.row, to.row); row <= Math.max(from.row, to.row); row++)
        for (let col = Math.min(from.col, to.col); col <= Math.max(from.col, to.col); col++)
          result.push(read(address({ row, col })))
      return result
    }
    if (node.kind === 'unary') {
      const n = numeric(evaluate(node.child))
      return finite(node.op === '-' ? -n : node.op === '%' ? n / 100 : n)
    }
    if (node.kind === 'binary') {
      const left = scalar(evaluate(node.left)),
        right = scalar(evaluate(node.right))
      if (node.op === '&') return textValue(left) + textValue(right)
      if (['=', '<>', '<', '>', '<=', '>='].includes(node.op)) {
        const a = typeof left === 'string' ? left.toLowerCase() : (left ?? 0),
          b = typeof right === 'string' ? right.toLowerCase() : (right ?? 0)
        switch (node.op) {
          case '=':
            return a === b
          case '<>':
            return a !== b
          case '<':
            return a < b
          case '>':
            return a > b
          case '<=':
            return a <= b
          default:
            return a >= b
        }
      }
      const a = numeric(left),
        b = numeric(right)
      switch (node.op) {
        case '+':
          return finite(a + b)
        case '-':
          return finite(a - b)
        case '*':
          return finite(a * b)
        case '/':
          return b === 0 ? fail('#DIV/0!', 'The divisor is zero or blank.') : finite(a / b)
        default:
          return finite(a ** b)
      }
    }
    const { name, args } = node
    const arity = (min: number, max = min) => {
      if (args.length < min || args.length > max)
        fail('#ERROR!', `${name} expects ${min === max ? min : `${min} to ${max}`} argument(s).`)
    }
    if (name === 'IF') {
      arity(2, 3)
      return truth(evaluate(args[0])) ? evaluate(args[1]) : args[2] ? evaluate(args[2]) : false
    }
    if (name === 'IFERROR') {
      arity(2)
      try {
        return evaluate(args[0])
      } catch (error) {
        if (error instanceof FormulaError && !['#CYCLE!', '#LIMIT!'].includes(error.code))
          return evaluate(args[1])
        throw error
      }
    }
    if (name === 'PI') {
      arity(0)
      return Math.PI
    }
    if (Object.hasOwn(unaryFunctions, name)) {
      arity(1)
      return finite(unaryFunctions[name](numeric(evaluate(args[0]))))
    }
    if (name === 'NOT') {
      arity(1)
      return !truth(evaluate(args[0]))
    }
    if (name === 'ROUND') {
      arity(1, 2)
      const n = numeric(evaluate(args[0])),
        digits = args[1] ? numeric(evaluate(args[1])) : 0
      if (!Number.isInteger(digits) || Math.abs(digits) > 15)
        return fail('#NUM!', 'ROUND accepts an integer from -15 to 15 for decimal places.')
      const scale = 10 ** digits
      return finite((Math.sign(n) * Math.round((Math.abs(n) + Number.EPSILON) * scale)) / scale)
    }
    if (name === 'POWER' || name === 'MOD' || name === 'LOG') {
      arity(name === 'LOG' ? 1 : 2, 2)
      const a = numeric(evaluate(args[0])),
        b = args[1] ? numeric(evaluate(args[1])) : 10
      return finite(
        name === 'POWER'
          ? a ** b
          : name === 'LOG'
            ? a > 0 && b > 0 && b !== 1
              ? Math.log(a) / Math.log(b)
              : NaN
            : b === 0
              ? fail('#DIV/0!', 'MOD requires a nonzero divisor.')
              : a - b * Math.floor(a / b),
      )
    }
    if (!['SUM', 'AVERAGE', 'MIN', 'MAX', 'COUNT', 'COUNTA', 'AND', 'OR'].includes(name))
      return fail('#NAME?', `“${name}” is not supported yet.`)
    arity(1, 100)
    const values = args.flatMap((arg) => {
      const value = evaluate(arg)
      return Array.isArray(value) ? value : [value]
    })
    if (name === 'COUNTA') return values.filter((v) => v !== null && v !== '').length
    if (name === 'AND') return values.every(truth)
    if (name === 'OR') return values.some(truth)
    const numbers = values.filter((v): v is number => typeof v === 'number')
    if (name === 'COUNT') return numbers.length
    const sum = numbers.reduce((a, b) => a + b, 0)
    if (name === 'AVERAGE')
      return numbers.length
        ? finite(sum / numbers.length)
        : fail('#DIV/0!', 'AVERAGE needs at least one numeric value.')
    return finite(
      name === 'SUM'
        ? sum
        : !numbers.length
          ? 0
          : name === 'MIN'
            ? Math.min(...numbers)
            : Math.max(...numbers),
    )
  }
  for (const ref of Object.keys(sheet.cells)) {
    try {
      read(ref)
    } catch (error) {
      if (!cache[ref])
        cache[ref] = {
          value: null,
          code: error instanceof FormulaError ? error.code : '#ERROR!',
          error: error instanceof Error ? error.message : 'Check this formula.',
        }
    }
  }
  return cache
}
export function displayValue(result: CellResult | undefined, format?: CellFormat): string {
  if (!result) return ''
  if (result.error) return result.code ?? '#ERROR!'
  const value = result.value
  if (typeof value !== 'number') return textValue(value)
  if (format?.number === 'number')
    return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (format?.number === 'percent')
    return value.toLocaleString('en-US', {
      style: 'percent',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  if (format?.number === 'currency')
    return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
  return String(Number(value.toPrecision(12)))
}
