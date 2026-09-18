import {
  address,
  bounds,
  MAX_COLUMNS,
  MAX_ROWS,
  position,
  shiftFormula,
  validCell,
  writeCells,
  type Cell,
  type Selection,
  type SheetDocument,
} from './model'
export const CELL_MIME = 'application/x-junga-cells'
export type CellClipboard = { version: 1; origin: { row: number; col: number }; cells: Cell[][] }
export function clipboardCells(sheet: SheetDocument, selection: Selection): CellClipboard {
  const b = bounds(selection)
  return {
    version: 1,
    origin: { row: b.top, col: b.left },
    cells: Array.from({ length: b.bottom - b.top + 1 }, (_, r) =>
      Array.from(
        { length: b.right - b.left + 1 },
        (_, c) => sheet.cells[address({ row: r + b.top, col: c + b.left })] ?? { input: '' },
      ),
    ),
  }
}
export function readCellClipboard(raw: string): CellClipboard | null {
  try {
    if (raw.length > MAX_ROWS * MAX_COLUMNS * 2500) return null
    const data = JSON.parse(raw) as CellClipboard
    if (
      data.version !== 1 ||
      !data.origin ||
      !Number.isInteger(data.origin.row) ||
      !Number.isInteger(data.origin.col) ||
      !position(address(data.origin)) ||
      data.origin.row < 0 ||
      data.origin.col < 0 ||
      data.origin.row >= MAX_ROWS ||
      data.origin.col >= MAX_COLUMNS ||
      !Array.isArray(data.cells) ||
      !data.cells.length ||
      data.cells.length > MAX_ROWS
    )
      return null
    const width = data.cells[0]?.length
    if (
      !width ||
      width > MAX_COLUMNS ||
      !data.cells.every((row) => Array.isArray(row) && row.length === width && row.every(validCell))
    )
      return null
    return data
  } catch {
    return null
  }
}
export const encodeTSV = (rows: string[][]) =>
  rows
    .map((row) =>
      row
        .map((value) => (/[\t\n\r"]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value))
        .join('\t'),
    )
    .join('\n')
export function parseTSV(text: string): string[][] {
  if (text.length > MAX_ROWS * MAX_COLUMNS * 2001)
    throw new Error('That selection is too large to paste.')
  const rows: string[][] = [[]]
  let value = '',
    quoted = false,
    atStart = true
  const push = () => {
    rows[rows.length - 1].push(value)
    value = ''
    atStart = true
    if (rows.length > MAX_ROWS || rows[rows.length - 1].length > MAX_COLUMNS)
      throw new Error(`Paste up to ${MAX_ROWS} rows and ${MAX_COLUMNS} columns at a time.`)
  }
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        value += '"'
        i++
      } else if (c === '"') quoted = false
      else value += c
    } else if (c === '"' && atStart) {
      quoted = true
      atStart = false
    } else if (c === '\t') push()
    else if (c === '\n' || c === '\r') {
      push()
      if (c === '\r' && text[i + 1] === '\n') i++
      if (i < text.length - 1) rows.push([])
    } else {
      value += c
      atStart = false
    }
  }
  if (quoted) throw new Error('The pasted text has an unclosed quotation mark.')
  if (!/[\r\n]$/.test(text) || value || !rows[rows.length - 1].length) push()
  return rows
}
export function pasteCells(
  sheet: SheetDocument,
  selection: Selection,
  matrix: Cell[][],
  origin?: { row: number; col: number },
) {
  const b = bounds(selection),
    single = matrix.length === 1 && matrix[0].length === 1
  const height = single ? b.bottom - b.top + 1 : matrix.length,
    width = single ? b.right - b.left + 1 : Math.max(...matrix.map((row) => row.length))
  if (b.top + height > MAX_ROWS || b.left + width > MAX_COLUMNS)
    throw new Error(
      `This paste would go beyond ${MAX_ROWS} rows or ${MAX_COLUMNS} columns. Choose a smaller range.`,
    )
  const updates: Record<string, Cell> = {}
  for (let r = 0; r < height; r++)
    for (let c = 0; c < width; c++) {
      const ref = address({ row: b.top + r, col: b.left + c }),
        cell = matrix[single ? 0 : r][single ? 0 : c] ?? { input: '' }
      updates[ref] = origin
        ? {
            ...cell,
            input: shiftFormula(
              cell.input,
              b.top + (single ? r : 0) - origin.row,
              b.left + (single ? c : 0) - origin.col,
            ),
          }
        : { ...sheet.cells[ref], input: cell.input }
    }
  return {
    sheet: writeCells(sheet, updates),
    selection: {
      anchor: { row: b.top, col: b.left },
      focus: { row: b.top + height - 1, col: b.left + width - 1 },
    },
  }
}
