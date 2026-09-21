import { describe, expect, it } from 'vitest'
import { calculateSheet, displayValue } from './engine'
import {
  address,
  changeFormat,
  clearCells,
  emptySheet,
  fillSelection,
  motionExample,
  position,
  shiftFormula,
  validSheet,
  writeCells,
  type Selection,
} from './model'
import { clipboardCells, encodeTSV, parseTSV, pasteCells, readCellClipboard } from './clipboard'

function calculate(cells: Record<string, string>) {
  return calculateSheet(
    writeCells(
      emptySheet(),
      Object.fromEntries(Object.entries(cells).map(([ref, input]) => [ref, { input }])),
    ),
  )
}
const range = (a: string, b = a): Selection => ({ anchor: position(a)!, focus: position(b)! })
describe('spreadsheet calculations', () => {
  it('calculates arithmetic, references, forward dependencies, percentages, and case-insensitive names', () => {
    const results = calculate({
      A1: '=b1*2',
      B1: '=C1+1',
      C1: '4',
      D1: '=2^3^2',
      E1: '25%',
      F1: '=E1*100',
      G1: '=-2^2',
      H1: '=2^-2',
      I1: '=A50',
    })
    expect(Object.values(results).some((v) => v.error)).toBe(false)
    expect(
      ['A1', 'B1', 'D1', 'E1', 'F1', 'G1', 'H1', 'I1'].map((ref) => results[ref].value),
    ).toEqual([10, 5, 512, 0.25, 25, -4, 0.25, 0])
  })
  it('recalculates the example from independent physics calculations when inputs change', () => {
    let sheet = motionExample(),
      results = calculateSheet(sheet)
    expect(results.B15.value).toBe(12 + 2 * 9)
    expect(results.C15.value).toBe(12 * 9 + 0.5 * 2 * 9 ** 2)
    sheet = writeCells(sheet, { B3: { input: '4' } })
    results = calculateSheet(sheet)
    expect(results.B17.value).toBe(48)
    expect(results.C15.value).toBe(270)
  })
  it('evaluates ranges and aggregates while ignoring nonnumeric range values', () => {
    const results = calculate({
      A1: '2',
      A2: '4',
      A3: 'Text',
      A4: 'TRUE',
      B1: '=SUM(A1:A5,3)',
      B2: '=AVERAGE(A1:A5)',
      B3: '=MIN(A1:A5)',
      B4: '=MAX(A1:A5)',
      B5: '=COUNT(A1:A5)',
      B6: '=COUNTA(A1:A5)',
      B7: '=SUM(A2:A1)',
    })
    expect(['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7'].map((ref) => results[ref].value)).toEqual([
      9, 3, 2, 4, 2, 4, 6,
    ])
  })
  it('supports engineering functions and finite real results', () => {
    const results = calculate({
      A1: '=SQRT(16)',
      A2: '=DEGREES(ATAN(1))',
      A3: '=SIN(RADIANS(90))',
      A4: '=LN(EXP(2))',
      A5: '=LOG(100)',
      A6: '=LOG(8,2)',
      A7: '=ROUND(-2.675,2)',
      A8: '=MOD(-3,2)',
      A9: '=PI()',
    })
    expect(
      ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9'].map((ref) => results[ref].value),
    ).toEqual([4, 45, 1, 2, 2, 3, -2.68, 1, Math.PI])
  })
  it('handles conditional branches lazily, explicit error fallback, strings, and booleans', () => {
    const results = calculate({
      A1: '=IF(FALSE,1/0,7)',
      A2: '=IF(2>1,"yes","no")',
      A3: '=IFERROR(1/0,"Check inputs")',
      A4: '=AND(TRUE,NOT(FALSE),2>=1)',
      A5: '=OR(FALSE,3<1)',
      A6: '= "A1" & " says " & "hello"',
      A7: "'=2+3",
      A8: '=IFERROR(A8,0)',
    })
    expect(['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7'].map((ref) => results[ref].value)).toEqual([
      7,
      'yes',
      'Check inputs',
      true,
      false,
      'A1 says hello',
      '=2+3',
    ])
    expect(results.A8.code).toBe('#CYCLE!')
  })
  it('reports circular, invalid, unsupported, text, zero divisor, and domain errors without breaking good cells', () => {
    const results = calculate({
      A1: '=B1',
      B1: '=A1',
      A2: '=1/0',
      A3: '=Z201',
      A4: '=sqrt(-1)',
      A5: '=mystery(1)',
      A6: '=1+"text"',
      A7: '=window.alert(1)',
      A8: '=1;2',
      A9: '=SUM(A1:B2)',
      A10: '=2+3',
      A11: '=constructor(2)',
      A12: '=C1:C2',
      A13: '=AVERAGE(C1:C4)',
    })
    expect(
      ['A1', 'B1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A11', 'A12', 'A13'].map(
        (ref) => results[ref].code,
      ),
    ).toEqual([
      '#CYCLE!',
      '#CYCLE!',
      '#DIV/0!',
      '#REF!',
      '#NUM!',
      '#NAME?',
      '#VALUE!',
      '#NAME?',
      '#ERROR!',
      '#CYCLE!',
      '#NAME?',
      '#VALUE!',
      '#DIV/0!',
    ])
    expect(results.A10.value).toBe(5)
  })
  it('bounds nesting and long formulas', () => {
    expect(calculate({ A1: '=' + '('.repeat(60) + '1' + ')'.repeat(60) }).A1.code).toBe('#LIMIT!')
    expect(calculate({ A1: '=1' + '+1'.repeat(300) }).A1.code).toBe('#LIMIT!')
  })
  it('formats display independently of stored numeric values', () => {
    const value = calculate({ A1: '0.125', A2: '=1/0' })
    expect(displayValue(value.A1, { number: 'percent' })).toBe('12.50%')
    expect(displayValue(value.A1, { number: 'currency' })).toBe('$0.13')
    expect(value.A1.value).toBe(0.125)
    expect(displayValue(value.A2)).toBe('#DIV/0!')
  })
})
describe('sheet editing and clipboard', () => {
  it('adjusts relative references without changing fixed references, function names, or strings', () => {
    expect(shiftFormula('=SUM(A1:$B$4)+$C5+D$6+LOG10(E1)&"A1"', 2, 1)).toBe(
      '=SUM(B3:$B$4)+$C7+E$6+LOG10(F3)&"A1"',
    )
    expect(shiftFormula('=A1+B2', -1, -1)).toBe('=#REF!+A1')
    expect(shiftFormula('A1 is text', 1, 1)).toBe('A1 is text')
  })
  it('fills formulas down and right while preserving styles and fixed inputs', () => {
    let sheet = writeCells(emptySheet(), {
      A1: { input: '=B1+$D$1', format: { bold: true } },
      B1: { input: '3' },
      B2: { input: '4' },
      D1: { input: '10' },
    })
    sheet = fillSelection(sheet, range('A1', 'A3'), 'down')
    expect(sheet.cells.A2).toEqual({ input: '=B2+$D$1', format: { bold: true } })
    expect(calculateSheet(sheet).A2.value).toBe(14)
    sheet = fillSelection(sheet, range('A3', 'C3'), 'right')
    expect(sheet.cells.C3.input).toBe('=D3+$D$1')
  })
  it('round-trips quoted tabular text and pastes as one rectangular transaction', () => {
    const matrix = [
      ['A\tB', 'Line 1\nLine 2', '"quoted"'],
      ['2', '=A2*3', ''],
    ]
    expect(parseTSV(encodeTSV(matrix))).toEqual(matrix)
    expect(parseTSV('a\tb\r\n1\t2\r\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
    const result = pasteCells(
      emptySheet(),
      range('B2'),
      [
        ['2', '3'],
        ['4', '=B2*C2'],
      ].map((row) => row.map((input) => ({ input }))),
    )
    expect(calculateSheet(result.sheet).C3.value).toBe(6)
    expect(result.selection).toEqual(range('B2', 'C3'))
  })
  it('copies internal formulas with relative references and independently copied formats', () => {
    const source = writeCells(emptySheet(), {
      A1: { input: '=B1+$C$1', format: { number: 'number' } },
    })
    const payload = clipboardCells(source, range('A1'))
    expect(readCellClipboard(JSON.stringify(payload))).toEqual(payload)
    const next = pasteCells(source, range('A2', 'A3'), payload.cells, payload.origin).sheet
    expect(next.cells.A2.input).toBe('=B2+$C$1')
    expect(next.cells.A3.input).toBe('=B3+$C$1')
    expect(next.cells.A3.format).toEqual({ number: 'number' })
  })
  it('rejects out-of-bounds paste and malformed data instead of partially writing', () => {
    const sheet = emptySheet()
    expect(() => pasteCells(sheet, range('Z200'), [[{ input: '1' }, { input: '2' }]])).toThrow(
      'beyond',
    )
    expect(sheet.cells).toEqual({})
    expect(readCellClipboard('{bad')).toBeNull()
    expect(
      readCellClipboard(
        JSON.stringify({
          version: 1,
          origin: { row: 0, col: 0 },
          cells: [[{ input: 'ok', format: { fill: 'url(unsafe)' } }]],
        }),
      ),
    ).toBeNull()
    expect(validSheet({ ...sheet, cells: { A1: { input: 'x'.repeat(2001) } } })).toBe(false)
    expect(validSheet({ ...sheet, cells: { a1: { input: '2' } } })).toBe(false)
    expect(validSheet(motionExample())).toBe(true)
  })
  it('clears content without losing formatting and grows within the supported grid', () => {
    const sheet = writeCells(emptySheet(), { Z200: { input: '12' } })
    expect([sheet.rows, sheet.columns]).toEqual([200, 26])
    const styled = changeFormat(sheet, range('Z200'), { bold: true })
    expect(clearCells(styled, range('Z200')).cells.Z200).toEqual({
      input: '',
      format: { bold: true },
    })
    expect(address(position('Z200')!)).toBe('Z200')
  })
})
