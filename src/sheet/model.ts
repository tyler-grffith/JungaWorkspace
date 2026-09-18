export const MAX_ROWS = 200
export const MAX_COLUMNS = 26
export const MAX_INPUT = 2000
export const FILLS = ['none', '#e7f0e5', '#fcf0ce', '#e6eefb', '#f7e5e1'] as const
export type CellFormat = {
  bold?: boolean
  align?: 'left' | 'center' | 'right'
  number?: 'general' | 'number' | 'percent' | 'currency'
  fill?: string
}
export type Cell = { input: string; format?: CellFormat }
export type SheetDocument = {
  version: 1
  rows: number
  columns: number
  cells: Record<string, Cell>
  widths: Record<string, number>
}
export type Position = { row: number; col: number }
export type Selection = { anchor: Position; focus: Position }
export const emptySheet = (): SheetDocument => ({
  version: 1,
  rows: 50,
  columns: 12,
  cells: {},
  widths: {},
})
export function columnName(index: number): string {
  let name = ''
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26))
    name = String.fromCharCode(65 + ((n - 1) % 26)) + name
  return name
}
export const address = ({ row, col }: Position) => `${columnName(col)}${row + 1}`
export function position(ref: string): Position | null {
  const m = ref.toUpperCase().match(/^\$?([A-Z]{1,3})\$?([1-9]\d{0,6})$/)
  if (!m) return null
  return {
    row: Number(m[2]) - 1,
    col: [...m[1]].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1,
  }
}
export function bounds(selection: Selection) {
  return {
    top: Math.min(selection.anchor.row, selection.focus.row),
    bottom: Math.max(selection.anchor.row, selection.focus.row),
    left: Math.min(selection.anchor.col, selection.focus.col),
    right: Math.max(selection.anchor.col, selection.focus.col),
  }
}
export function selectedAddresses(selection: Selection): string[] {
  const b = bounds(selection),
    cells: string[] = []
  for (let row = b.top; row <= b.bottom; row++)
    for (let col = b.left; col <= b.right; col++) cells.push(address({ row, col }))
  return cells
}
export function selectionName(selection: Selection) {
  const b = bounds(selection),
    first = address({ row: b.top, col: b.left }),
    last = address({ row: b.bottom, col: b.right })
  return first === last ? first : `${first}:${last}`
}
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v)
export function validCell(v: unknown): v is Cell {
  if (!record(v) || typeof v.input !== 'string' || v.input.length > MAX_INPUT) return false
  if (v.format === undefined) return true
  const f = v.format
  return (
    record(f) &&
    (f.bold === undefined || typeof f.bold === 'boolean') &&
    (f.align === undefined || ['left', 'center', 'right'].includes(f.align as string)) &&
    (f.number === undefined ||
      ['general', 'number', 'percent', 'currency'].includes(f.number as string)) &&
    (f.fill === undefined || FILLS.some((c) => c === f.fill))
  )
}
export function validSheet(v: unknown): v is SheetDocument {
  if (
    !record(v) ||
    v.version !== 1 ||
    !Number.isInteger(v.rows) ||
    !Number.isInteger(v.columns) ||
    !record(v.cells) ||
    !record(v.widths)
  )
    return false
  const rows = v.rows as number,
    cols = v.columns as number
  return (
    rows > 0 &&
    rows <= MAX_ROWS &&
    cols > 0 &&
    cols <= MAX_COLUMNS &&
    Object.entries(v.cells).every(([key, cell]) => {
      const p = position(key)
      return p && address(p) === key && p.row < rows && p.col < cols && validCell(cell)
    }) &&
    Object.entries(v.widths).every(([key, width]) => {
      const p = position(`${key}1`)
      return (
        p &&
        columnName(p.col) === key &&
        p.col < cols &&
        typeof width === 'number' &&
        Number.isFinite(width) &&
        width >= 70 &&
        width <= 420
      )
    })
  )
}
export function writeCells(sheet: SheetDocument, updates: Record<string, Cell>): SheetDocument {
  let rows = sheet.rows,
    columns = sheet.columns
  const cells = { ...sheet.cells }
  for (const [ref, cell] of Object.entries(updates)) {
    const p = position(ref)
    if (!p || p.row >= MAX_ROWS || p.col >= MAX_COLUMNS || !validCell(cell))
      throw new Error(
        `Use cells A1:${columnName(MAX_COLUMNS - 1)}${MAX_ROWS}, with up to ${MAX_INPUT} characters per cell.`,
      )
    rows = Math.max(rows, p.row + 1)
    columns = Math.max(columns, p.col + 1)
    if (!cell.input && !Object.keys(cell.format ?? {}).length) delete cells[ref]
    else cells[ref] = cell
  }
  return { ...sheet, rows, columns, cells }
}
export function changeFormat(sheet: SheetDocument, selection: Selection, format: CellFormat) {
  return writeCells(
    sheet,
    Object.fromEntries(
      selectedAddresses(selection).map((ref) => [
        ref,
        {
          input: sheet.cells[ref]?.input ?? '',
          format: { ...sheet.cells[ref]?.format, ...format },
        },
      ]),
    ),
  )
}
export function clearCells(sheet: SheetDocument, selection: Selection) {
  return writeCells(
    sheet,
    Object.fromEntries(
      selectedAddresses(selection).map((ref) => [ref, { ...sheet.cells[ref], input: '' }]),
    ),
  )
}
export function shiftFormula(input: string, dr: number, dc: number): string {
  if (!input.trimStart().startsWith('=')) return input
  return input.replace(
    /"(?:[^"]|"")*"|(\$?)([A-Z]{1,3})(\$?)([1-9]\d*)\b/gi,
    (
      whole,
      fixedCol: string | undefined,
      col: string,
      fixedRow: string,
      row: string,
      offset: number,
    ) => {
      if (
        fixedCol === undefined ||
        /[A-Za-z0-9_.]/.test(input[offset - 1] ?? '') ||
        /^\s*\(/.test(input.slice(offset + whole.length))
      )
        return whole
      const p = position(`${col}${row}`)!
      const next = { row: p.row + (fixedRow ? 0 : dr), col: p.col + (fixedCol ? 0 : dc) }
      if (next.row < 0 || next.col < 0 || next.row >= MAX_ROWS || next.col >= MAX_COLUMNS)
        return '#REF!'
      return `${fixedCol}${columnName(next.col)}${fixedRow}${next.row + 1}`
    },
  )
}
export function fillSelection(
  sheet: SheetDocument,
  selection: Selection,
  direction: 'down' | 'right',
) {
  const b = bounds(selection),
    updates: Record<string, Cell> = {}
  for (let row = b.top; row <= b.bottom; row++)
    for (let col = b.left; col <= b.right; col++) {
      if (direction === 'down' ? row === b.top : col === b.left) continue
      const source = {
        row: direction === 'down' ? b.top : row,
        col: direction === 'right' ? b.left : col,
      }
      const cell = sheet.cells[address(source)] ?? { input: '' }
      updates[address({ row, col })] = {
        ...cell,
        input: shiftFormula(cell.input, row - source.row, col - source.col),
      }
    }
  return writeCells(sheet, updates)
}
export function motionExample(): SheetDocument {
  const cells: Record<string, Cell> = {}
  const put = (ref: string, input: string, format?: CellFormat) => {
    cells[ref] = { input, ...(format ? { format } : {}) }
  }
  put('A1', 'Motion model', { bold: true })
  put('A2', 'Initial velocity')
  put('B2', '12', { fill: FILLS[2], number: 'number' })
  put('C2', 'm/s')
  put('A3', 'Acceleration')
  put('B3', '2', { fill: FILLS[2], number: 'number' })
  put('C3', 'm/s²')
  for (const [ref, text] of [
    ['A5', 'Time (s)'],
    ['B5', 'Velocity (m/s)'],
    ['C5', 'Distance (m)'],
  ])
    put(ref, text, { bold: true, fill: FILLS[1] })
  for (let i = 0; i < 10; i++) {
    const r = i + 6
    put(`A${r}`, String(i))
    put(`B${r}`, `=$B$2+$B$3*A${r}`, { number: 'number' })
    put(`C${r}`, `=$B$2*A${r}+0.5*$B$3*A${r}^2`, { number: 'number' })
  }
  put('A17', 'Maximum velocity', { bold: true })
  put('B17', '=MAX(B6:B15)', { number: 'number', bold: true })
  put('C17', 'm/s')
  put('E2', 'Change the yellow inputs in B2 and B3.')
  put('E3', 'The velocity and distance columns recalculate.')
  put('E5', 'Formulas use $B$2 and $B$3 to keep inputs fixed.')
  return { ...emptySheet(), cells, widths: { A: 175, B: 150, C: 150, D: 80, E: 350 } }
}
