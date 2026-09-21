import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useDesign } from '../design/context'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Bold,
  Check,
  ChevronDown,
  CircleHelp,
  Eraser,
  Grid2X2,
  Plus,
  Redo2,
  Undo2,
  X,
} from 'lucide-react'
import {
  address,
  bounds,
  changeFormat,
  clearCells,
  columnName,
  fillSelection,
  FILLS,
  MAX_COLUMNS,
  MAX_INPUT,
  MAX_ROWS,
  motionExample,
  position,
  selectedAddresses,
  selectionName,
  writeCells,
  type CellFormat,
  type Position,
  type Selection,
  type SheetDocument,
} from './model'
import { calculateSheet, displayValue } from './engine'
import {
  CELL_MIME,
  clipboardCells,
  encodeTSV,
  parseTSV,
  pasteCells,
  readCellClipboard,
} from './clipboard'
import './sheet.css'

type Props = {
  title: string
  sheet: SheetDocument
  onChange: (sheet: SheetDocument) => boolean
  onEditingChange: (edit: { ref: string; value: string } | null) => void
  onBack: () => void
  readOnly: boolean
  unsaved: boolean
  embedded?: boolean
}
type Edit = { ref: string; value: string; original: string; origin: 'cell' | 'bar' }
type History = { past: SheetDocument[]; future: SheetDocument[] }
const first: Selection = { anchor: { row: 0, col: 0 }, focus: { row: 0, col: 0 } }
export default function SheetEditor({
  title,
  sheet,
  onChange,
  onEditingChange,
  onBack,
  readOnly,
  unsaved,
  embedded = false,
}: Props) {
  const [selection, setSelection] = useState<Selection>(first),
    [edit, setEditState] = useState<Edit | null>(null)
  const [history, setHistory] = useState<History>({ past: [], future: [] }),
    [help, setHelp] = useState(false),
    [showFormulas, setShowFormulas] = useState(false)
  const [formattingOpen, setFormattingOpen] = useState(!embedded)
  const [notice, setNotice] = useState(''),
    [confirmExample, setConfirmExample] = useState(false),
    [rangeInput, setRangeInput] = useState('A1')
  const defaultWidth = useDesign().sheet.columnWidth
  const [resizing, setResizing] = useState<{ col: number; width: number } | null>(null)
  const latest = useRef(sheet),
    historyRef = useRef(history),
    editRef = useRef(edit),
    grid = useRef<HTMLTableElement>(null),
    cellInput = useRef<HTMLInputElement>(null)
  const drag = useRef(false),
    focusRequested = useRef(false),
    resize = useRef<{ col: number; x: number; start: number; width: number } | null>(null)
  const compiled = useMemo(
    () => calculateSheet(sheet),
    [sheet.cells, sheet.rows, sheet.columns, sheet.names],
  )
  const active = address(selection.anchor),
    activeCell = sheet.cells[active],
    b = bounds(selection)
  const selected = useMemo(() => selectedAddresses(selection), [selection])
  const stats = selected.map((ref) => compiled[ref]).filter(Boolean),
    numbers = stats.flatMap((r) => (!r.error && typeof r.value === 'number' ? [r.value] : []))
  const error = compiled[active]?.error
  const setEdit = (next: Edit | null) => {
    editRef.current = next
    setEditState(next)
  }
  const storeHistory = (next: History) => {
    historyRef.current = next
    setHistory(next)
  }
  useEffect(() => {
    if (latest.current !== sheet) {
      latest.current = sheet
      storeHistory({ past: [], future: [] })
    }
  }, [sheet])
  useEffect(() => {
    onEditingChange(
      edit && edit.value !== edit.original ? { ref: edit.ref, value: edit.value } : null,
    )
  }, [edit, onEditingChange])
  useEffect(() => {
    setRangeInput(selectionName(selection))
  }, [selection])
  useEffect(() => {
    if (edit?.origin === 'cell') {
      cellInput.current?.focus()
      cellInput.current?.setSelectionRange(edit.value.length, edit.value.length)
    }
  }, [edit?.ref, edit?.origin])
  useEffect(() => {
    if (!focusRequested.current || edit) return
    focusRequested.current = false
    const element = grid.current?.querySelector<HTMLElement>(`[data-cell="${active}"]`)
    element?.focus({ preventScroll: true })
    grid.current
      ?.querySelector<HTMLElement>(`[data-cell="${address(selection.focus)}"]`)
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [selection, edit, active])
  useEffect(() => {
    const stop = () => {
      drag.current = false
    }
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
    return () => {
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
    }
  }, [])
  function change(next: SheetDocument) {
    if (readOnly || JSON.stringify(next) === JSON.stringify(latest.current)) return
    storeHistory({ past: [...historyRef.current.past, latest.current].slice(-50), future: [] })
    latest.current = next
    onChange(next)
    setNotice('')
  }
  function safely(action: () => void) {
    try {
      action()
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'This change could not be made.')
    }
  }
  function finishEdit() {
    const current = editRef.current
    if (!current) return
    setEdit(null)
    onEditingChange(null)
    if (current.value !== current.original)
      safely(() =>
        change(
          writeCells(latest.current, {
            [current.ref]: { ...latest.current.cells[current.ref], input: current.value },
          }),
        ),
      )
  }
  function select(p: Position, extend = false, focus = true) {
    finishEdit()
    const next = {
      row: Math.max(0, Math.min(latest.current.rows - 1, p.row)),
      col: Math.max(0, Math.min(latest.current.columns - 1, p.col)),
    }
    focusRequested.current = focus
    setSelection((s) => ({ anchor: extend ? s.anchor : next, focus: next }))
  }
  function beginEdit(origin: Edit['origin'], replace?: string) {
    if (readOnly) return
    const original = latest.current.cells[active]?.input ?? ''
    setEdit({ ref: active, original, value: replace ?? original, origin })
  }
  function undo(redo = false) {
    finishEdit()
    const h = historyRef.current,
      next = redo ? h.future[0] : h.past.at(-1)
    if (!next || readOnly) return
    storeHistory(
      redo
        ? { past: [...h.past, latest.current].slice(-50), future: h.future.slice(1) }
        : { past: h.past.slice(0, -1), future: [latest.current, ...h.future] },
    )
    latest.current = next
    onChange(next)
    setNotice('')
    setSelection((s) => ({
      anchor: {
        row: Math.min(s.anchor.row, next.rows - 1),
        col: Math.min(s.anchor.col, next.columns - 1),
      },
      focus: {
        row: Math.min(s.focus.row, next.rows - 1),
        col: Math.min(s.focus.col, next.columns - 1),
      },
    }))
  }
  function format(value: CellFormat) {
    finishEdit()
    safely(() => change(changeFormat(latest.current, selection, value)))
  }
  function fill(direction: 'down' | 'right') {
    finishEdit()
    safely(() => change(fillSelection(latest.current, selection, direction)))
  }
  function clear() {
    finishEdit()
    safely(() => change(clearCells(latest.current, selection)))
  }
  function editKeys(e: KeyboardEvent<HTMLInputElement>) {
    if (e.nativeEvent.isComposing) return
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      setEdit(null)
      onEditingChange(null)
      focusRequested.current = true
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      e.stopPropagation()
      finishEdit()
      select({
        row: selection.anchor.row + (e.key === 'Enter' ? (e.shiftKey ? -1 : 1) : 0),
        col: selection.anchor.col + (e.key === 'Tab' ? (e.shiftKey ? -1 : 1) : 0),
      })
    }
  }
  function gridKeys(e: KeyboardEvent<HTMLTableElement>) {
    if (
      editRef.current ||
      e.nativeEvent.isComposing ||
      (e.target as HTMLElement).tagName === 'BUTTON'
    )
      return
    const ctrl = e.ctrlKey || e.metaKey,
      key = e.key.toLowerCase()
    if (ctrl && key === 'a') {
      e.preventDefault()
      setSelection({ anchor: first.anchor, focus: { row: sheet.rows - 1, col: sheet.columns - 1 } })
      return
    }
    if (ctrl && ['z', 'y', 'd', 'r'].includes(key)) {
      e.preventDefault()
      if (readOnly) return
      if (key === 'z' || key === 'y') undo(key === 'y' || e.shiftKey)
      else fill(key === 'd' ? 'down' : 'right')
      return
    }
    const from = e.shiftKey ? selection.focus : selection.anchor
    const moves: Record<string, Position> = {
      ArrowUp: { row: from.row - 1, col: from.col },
      ArrowDown: { row: from.row + 1, col: from.col },
      ArrowLeft: { row: from.row, col: from.col - 1 },
      ArrowRight: { row: from.row, col: from.col + 1 },
      Home: { row: ctrl ? 0 : from.row, col: 0 },
      End: { row: ctrl ? sheet.rows - 1 : from.row, col: sheet.columns - 1 },
    }
    if (moves[e.key]) {
      e.preventDefault()
      select(moves[e.key], e.shiftKey)
      return
    }
    if (readOnly) return
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      clear()
    } else if (e.key === 'Enter' || e.key === 'F2') {
      e.preventDefault()
      beginEdit('cell')
    } else if (e.key.length === 1 && !ctrl && !e.altKey) {
      e.preventDefault()
      beginEdit('cell', e.key)
    }
  }
  function loadExample() {
    finishEdit()
    change(motionExample())
    setSelection(first)
    setConfirmExample(false)
  }
  const activeFormat = activeCell?.format
  return (
    <div className="sheet-editor">
      <div className="sheet-heading">
        <div>
          {!embedded && (
            <button
              className="back-link"
              onClick={() => {
                finishEdit()
                onBack()
              }}
            >
              <ArrowLeft size={14} />
              Project overview
            </button>
          )}
          {embedded ? (
            <h2>Spreadsheet</h2>
          ) : (
            <>
              <div className="eyebrow">SPREADSHEET</div>
              <h1>{title}</h1>
            </>
          )}
        </div>
        <div className="sheet-heading-actions">
          {embedded && (
            <button
              className="button secondary"
              aria-expanded={formattingOpen}
              onClick={() => setFormattingOpen(!formattingOpen)}
            >
              Formatting
            </button>
          )}
          <button
            className="icon-button"
            aria-label="Undo spreadsheet change"
            title="Undo"
            disabled={readOnly || (!history.past.length && !edit)}
            onClick={() => undo()}
          >
            <Undo2 size={18} />
          </button>
          <button
            className="icon-button"
            aria-label="Redo spreadsheet change"
            title="Redo"
            disabled={readOnly || !history.future.length}
            onClick={() => undo(true)}
          >
            <Redo2 size={18} />
          </button>
          <button className="button secondary" aria-expanded={help} onClick={() => setHelp(!help)}>
            <CircleHelp size={16} />
            Using the spreadsheet
          </button>
        </div>
      </div>
      {readOnly && (
        <div className="state-banner">
          This project is in the trash. Its spreadsheet is preserved; restore it to edit.
        </div>
      )}
      {unsaved && (
        <div className="unsaved-note" role="status">
          <span>Your spreadsheet changes are kept on this page. Save them before leaving.</span>
          <button
            className="button secondary"
            onClick={() => {
              finishEdit()
              onChange(latest.current)
            }}
          >
            Retry saving spreadsheet
          </button>
        </div>
      )}
      {help && (
        <section className="sheet-help" aria-label="Spreadsheet help">
          <div>
            <h2>From values to a working model</h2>
            <button
              className="icon-button"
              aria-label="Close spreadsheet help"
              onClick={() => setHelp(false)}
            >
              <X size={16} />
            </button>
          </div>
          <p>
            Select a cell and type to replace it. Double-click, press Enter or F2, or use the
            formula bar to edit. Enter saves and moves down; Tab saves and moves right; Escape
            cancels. Arrow keys move between cells. Shift-click, drag, or Shift+arrows selects a
            range. When you are not editing, Tab leaves the grid.
          </p>
          <p>
            Start a formula with <code>=</code>: <code>=B2*C2</code>, <code>=SUM(B2:B10)</code>,{' '}
            <code>=IF(A1&gt;0,SQRT(A1),0)</code>. Use <code>$B$2</code> for a fixed reference.
            Copy/paste or fill adjusts relative references. Ctrl/Cmd+C and V copy and paste cells;
            Ctrl/Cmd+D fills down and Ctrl/Cmd+R fills right. Ctrl/Cmd+Z undoes, Shift+Ctrl/Cmd+Z
            redoes. Plain text starting with = can be entered with a leading apostrophe.
          </p>
          <p>
            Functions: SUM, AVERAGE, MIN, MAX, COUNT, COUNTA, IF, IFERROR, AND, OR, NOT, ROUND, ABS,
            SQRT, POWER, MOD, INT, SIGN, SIN, COS, TAN, ASIN, ACOS, ATAN, COT, RADIANS, DEGREES,
            EXP, LN, LOG, LOG10, PI. Trigonometry uses radians. LN is natural log; LOG defaults to
            base 10. SUM, AVERAGE, MIN, MAX, and COUNT use numeric values and ignore text, blanks,
            and logical values. COUNTA counts nonempty cells.
          </p>
          <p>
            One worksheet per project, up to {MAX_ROWS} rows and {MAX_COLUMNS} columns. Resize
            columns by dragging their header edges; double-click an edge to fit its content. Dates,
            cross-sheet references, custom functions, imports, and spreadsheet-to-graph links come
            later.
          </p>
        </section>
      )}
      <div className="sheet-workbench">
        {formattingOpen && (
          <div className="sheet-toolbar" role="toolbar" aria-label="Cell formatting and tools">
            <div className="sheet-tool-group">
              <button
                aria-label="Bold cells"
                title="Bold"
                aria-pressed={!!activeFormat?.bold}
                disabled={readOnly}
                onClick={() => format({ bold: !activeFormat?.bold })}
              >
                <Bold size={16} />
              </button>
              {(
                [
                  ['left', AlignLeft],
                  ['center', AlignCenter],
                  ['right', AlignRight],
                ] as const
              ).map(([align, Icon]) => (
                <button
                  key={align}
                  aria-label={`Align cells ${align}`}
                  title={`Align ${align}`}
                  aria-pressed={activeFormat?.align === align}
                  disabled={readOnly}
                  onClick={() => format({ align })}
                >
                  <Icon size={16} />
                </button>
              ))}
            </div>
            <div className="sheet-tool-group">
              <label className="sheet-select-label">
                <span className="sr-only">Number format</span>
                <select
                  aria-label="Number format"
                  value={activeFormat?.number ?? 'general'}
                  disabled={readOnly}
                  onChange={(e) => format({ number: e.target.value as CellFormat['number'] })}
                >
                  <option value="general">Automatic</option>
                  <option value="number">Number · 2 decimals</option>
                  <option value="percent">Percent</option>
                  <option value="currency">Currency · USD</option>
                </select>
              </label>
              <select
                aria-label="Cell fill"
                value={activeFormat?.fill ?? 'none'}
                disabled={readOnly}
                onChange={(e) => format({ fill: e.target.value })}
              >
                {FILLS.map((color, i) => (
                  <option key={color} value={color}>
                    {['No fill', 'Sage fill', 'Sand fill', 'Blue fill', 'Rose fill'][i]}
                  </option>
                ))}
              </select>
            </div>
            <div className="sheet-tool-group">
              <button
                aria-label="Fill down"
                title="Fill down · Ctrl/Cmd+D"
                disabled={readOnly || b.top === b.bottom}
                onClick={() => fill('down')}
              >
                <ArrowDown size={15} />
                <span>Fill down</span>
              </button>
              <button
                aria-label="Fill right"
                title="Fill right · Ctrl/Cmd+R"
                disabled={readOnly || b.left === b.right}
                onClick={() => fill('right')}
              >
                <ArrowRight size={15} />
                <span>Fill right</span>
              </button>
              <button
                aria-label="Clear selected cells"
                title="Clear contents; keep formatting"
                disabled={readOnly}
                onClick={clear}
              >
                <Eraser size={15} />
                <span>Clear</span>
              </button>
            </div>
            <label className="sheet-show-formulas">
              <input
                type="checkbox"
                checked={showFormulas}
                onChange={(e) => setShowFormulas(e.target.checked)}
              />
              Formulas
            </label>
          </div>
        )}
        <div className="formula-bar">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const refs = rangeInput.trim().split(':').map(position)
              if (
                !refs.length ||
                refs.length > 2 ||
                refs.some((p) => !p || p.row >= sheet.rows || p.col >= sheet.columns)
              ) {
                setNotice(
                  `Choose a cell or range within A1:${columnName(sheet.columns - 1)}${sheet.rows}.`,
                )
                return
              }
              finishEdit()
              setNotice('')
              focusRequested.current = true
              setSelection({ anchor: refs[0]!, focus: refs[1] ?? refs[0]! })
            }}
          >
            <input
              aria-label="Selected cell or range"
              title="Jump to a cell or range, such as A1:C5"
              value={rangeInput}
              onChange={(e) => setRangeInput(e.target.value)}
              spellCheck={false}
            />
            <ChevronDown size={12} />
          </form>
          <span className="formula-symbol" aria-hidden="true">
            ƒx
          </span>
          <input
            className="formula-entry"
            aria-label="Cell value or formula"
            spellCheck={false}
            maxLength={MAX_INPUT}
            disabled={readOnly}
            value={edit?.ref === active ? edit.value : (activeCell?.input ?? '')}
            placeholder="Enter a value or a formula, starting with ="
            onFocus={() => {
              if (!editRef.current) beginEdit('bar')
            }}
            onChange={(e) => {
              const current = editRef.current ?? {
                ref: active,
                original: activeCell?.input ?? '',
                value: '',
                origin: 'bar' as const,
              }
              setEdit({ ...current, value: e.target.value })
            }}
            onBlur={finishEdit}
            onKeyDown={editKeys}
          />
          {edit && (
            <button
              className="icon-button"
              aria-label="Apply cell edit"
              title="Apply"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                finishEdit()
                focusRequested.current = true
                setSelection((s) => ({ ...s }))
              }}
            >
              <Check size={16} />
            </button>
          )}
        </div>
        {notice && (
          <div className="sheet-notice" role="status">
            {notice}
            <button aria-label="Dismiss spreadsheet message" onClick={() => setNotice('')}>
              <X size={14} />
            </button>
          </div>
        )}
        <div className="sheet-grid-scroll">
          <table
            ref={grid}
            className="sheet-grid"
            style={{
              width:
                44 +
                Array.from({ length: sheet.columns }, (_, col) =>
                  resizing?.col === col
                    ? resizing.width
                    : (sheet.widths[columnName(col)] ?? defaultWidth),
                ).reduce((a, n) => a + n, 0),
            }}
            role="grid"
            aria-label="Spreadsheet cells"
            aria-rowcount={sheet.rows + 1}
            aria-colcount={sheet.columns + 1}
            aria-multiselectable="true"
            aria-readonly={readOnly}
            onKeyDown={gridKeys}
            onCopy={(e) => {
              if (editRef.current) return
              const payload = clipboardCells(sheet, selection)
              e.clipboardData.setData(CELL_MIME, JSON.stringify(payload))
              const box = bounds(selection)
              e.clipboardData.setData(
                'text/plain',
                encodeTSV(
                  payload.cells.map((row, r) =>
                    row.map((cell, c) =>
                      showFormulas
                        ? cell.input
                        : displayValue(
                            compiled[address({ row: box.top + r, col: box.left + c })],
                            cell.format,
                          ),
                    ),
                  ),
                ),
              )
              e.preventDefault()
              setNotice(`${selectionName(selection)} copied. Paste into a cell or another app.`)
            }}
            onPaste={(e) => {
              if (editRef.current || readOnly) return
              e.preventDefault()
              safely(() => {
                const internal = readCellClipboard(e.clipboardData.getData(CELL_MIME)),
                  matrix =
                    internal?.cells ??
                    parseTSV(e.clipboardData.getData('text/plain')).map((row) =>
                      row.map((input) => ({ input })),
                    )
                const result = pasteCells(latest.current, selection, matrix, internal?.origin)
                change(result.sheet)
                focusRequested.current = true
                setSelection(result.selection)
              })
            }}
          >
            <colgroup>
              <col style={{ width: 44 }} />
              {Array.from({ length: sheet.columns }, (_, col) => (
                <col
                  key={col}
                  style={{
                    width:
                      resizing?.col === col
                        ? resizing.width
                        : (sheet.widths[columnName(col)] ?? defaultWidth),
                  }}
                />
              ))}
            </colgroup>
            <thead>
              <tr role="row">
                <th className="sheet-corner" role="columnheader">
                  <button
                    aria-label="Select all cells"
                    onClick={() => {
                      finishEdit()
                      focusRequested.current = true
                      setSelection({
                        anchor: first.anchor,
                        focus: { row: sheet.rows - 1, col: sheet.columns - 1 },
                      })
                    }}
                  >
                    <Grid2X2 size={13} />
                  </button>
                </th>
                {Array.from({ length: sheet.columns }, (_, col) => (
                  <th
                    key={col}
                    role="columnheader"
                    scope="col"
                    className={col >= b.left && col <= b.right ? 'selected-header' : ''}
                  >
                    <button
                      className="column-select"
                      aria-label={`Select column ${columnName(col)}`}
                      onClick={() => {
                        finishEdit()
                        focusRequested.current = true
                        setSelection({
                          anchor: { row: 0, col },
                          focus: { row: sheet.rows - 1, col },
                        })
                      }}
                    >
                      {columnName(col)}
                    </button>
                    <button
                      className="column-resize"
                      aria-label={`Resize column ${columnName(col)}`}
                      title="Drag to resize; double-click to fit; arrow keys adjust"
                      disabled={readOnly}
                      onPointerDown={(e) => {
                        finishEdit()
                        e.preventDefault()
                        e.currentTarget.setPointerCapture(e.pointerId)
                        const width = sheet.widths[columnName(col)] ?? defaultWidth
                        resize.current = { col, x: e.clientX, start: width, width }
                      }}
                      onPointerMove={(e) => {
                        if (!resize.current || resize.current.col !== col) return
                        const width = Math.max(
                          70,
                          Math.min(420, resize.current.start + e.clientX - resize.current.x),
                        )
                        resize.current.width = width
                        setResizing({ col, width })
                      }}
                      onPointerUp={(e) => {
                        if (!resize.current) return
                        const width = resize.current.width
                        resize.current = null
                        setResizing(null)
                        e.currentTarget.releasePointerCapture(e.pointerId)
                        change({
                          ...latest.current,
                          widths: { ...latest.current.widths, [columnName(col)]: width },
                        })
                      }}
                      onPointerCancel={() => {
                        resize.current = null
                        setResizing(null)
                      }}
                      onDoubleClick={() => {
                        const length = Math.max(
                          4,
                          ...Array.from(
                            { length: sheet.rows },
                            (_, row) =>
                              displayValue(
                                compiled[address({ row, col })],
                                sheet.cells[address({ row, col })]?.format,
                              ).length,
                          ),
                        )
                        change({
                          ...latest.current,
                          widths: {
                            ...latest.current.widths,
                            [columnName(col)]: Math.max(70, Math.min(420, length * 8 + 24)),
                          },
                        })
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                          e.preventDefault()
                          change({
                            ...latest.current,
                            widths: {
                              ...latest.current.widths,
                              [columnName(col)]: Math.max(
                                70,
                                Math.min(
                                  420,
                                  (sheet.widths[columnName(col)] ?? defaultWidth) +
                                    (e.key === 'ArrowLeft' ? -10 : 10),
                                ),
                              ),
                            },
                          })
                        }
                      }}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: sheet.rows }, (_, row) => (
                <tr role="row" key={row}>
                  <th
                    role="rowheader"
                    scope="row"
                    className={row >= b.top && row <= b.bottom ? 'selected-header' : ''}
                  >
                    <button
                      aria-label={`Select row ${row + 1}`}
                      onClick={() => {
                        finishEdit()
                        focusRequested.current = true
                        setSelection({
                          anchor: { row, col: 0 },
                          focus: { row, col: sheet.columns - 1 },
                        })
                      }}
                    >
                      {row + 1}
                    </button>
                  </th>
                  {Array.from({ length: sheet.columns }, (_, col) => {
                    const ref = address({ row, col }),
                      cell = sheet.cells[ref],
                      result = compiled[ref],
                      inRange = row >= b.top && row <= b.bottom && col >= b.left && col <= b.right,
                      isActive = ref === active,
                      isEditing = edit?.ref === ref && edit.origin === 'cell',
                      formula = cell?.input.trimStart().startsWith('=')
                    return (
                      <td
                        key={col}
                        role="gridcell"
                        aria-label={ref}
                        aria-selected={inRange}
                        aria-invalid={!!result?.error}
                        title={
                          result?.error
                            ? `${ref}: ${result.code} — ${result.error}`
                            : cell?.input || ref
                        }
                        tabIndex={isActive ? 0 : -1}
                        data-cell={ref}
                        onFocus={(e) => {
                          if (e.target === e.currentTarget && !isActive && !editRef.current)
                            setSelection({ anchor: { row, col }, focus: { row, col } })
                        }}
                        className={`${inRange ? 'selected-cell' : ''} ${isActive ? 'active-cell' : ''} ${formula ? 'formula-cell' : ''} ${result?.error ? 'cell-error' : ''}`}
                        style={{
                          textAlign:
                            cell?.format?.align ??
                            (typeof result?.value === 'number' ? 'right' : 'left'),
                          fontWeight: cell?.format?.bold ? 700 : 400,
                          backgroundColor:
                            cell?.format?.fill && cell.format.fill !== 'none'
                              ? cell.format.fill
                              : undefined,
                        }}
                        onPointerDown={(e) => {
                          if ((e.target as HTMLElement).tagName === 'INPUT' || e.button !== 0)
                            return
                          if (e.pointerType === 'mouse') {
                            e.preventDefault()
                            drag.current = true
                          }
                          select({ row, col }, e.shiftKey)
                        }}
                        onPointerEnter={(e) => {
                          if (drag.current && e.buttons === 1) {
                            focusRequested.current = false
                            setSelection((s) => ({ ...s, focus: { row, col } }))
                          }
                        }}
                        onDoubleClick={() => beginEdit('cell')}
                      >
                        {isEditing ? (
                          <input
                            ref={cellInput}
                            className="cell-editor"
                            aria-label={`Edit cell ${ref}`}
                            maxLength={MAX_INPUT}
                            spellCheck={false}
                            value={edit.value}
                            onChange={(e) => setEdit({ ...edit, value: e.target.value })}
                            onKeyDown={editKeys}
                            onBlur={finishEdit}
                          />
                        ) : (
                          <span>
                            {showFormulas && formula
                              ? cell?.input
                              : displayValue(result, cell?.format)}
                          </span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="sheet-bottom-bar">
          <span className="worksheet-label">
            <Grid2X2 size={15} />
            Sheet 1
          </span>
          <div className="sheet-grow">
            <button
              disabled={readOnly || sheet.rows >= MAX_ROWS}
              onClick={() => {
                finishEdit()
                change({ ...latest.current, rows: Math.min(MAX_ROWS, latest.current.rows + 25) })
              }}
            >
              <Plus size={13} />
              25 rows
            </button>
            <button
              disabled={readOnly || sheet.columns >= MAX_COLUMNS}
              onClick={() => {
                finishEdit()
                change({
                  ...latest.current,
                  columns: Math.min(MAX_COLUMNS, latest.current.columns + 1),
                })
              }}
            >
              <Plus size={13} />
              Column
            </button>
          </div>
          <span>
            {sheet.rows} rows × {sheet.columns} columns
          </span>
        </div>
      </div>
      <div className="sheet-status">
        <div>
          {error ? (
            <span className="sheet-cell-error" role="status">
              <strong>
                {active} · {compiled[active]?.code}
              </strong>{' '}
              {error}
            </span>
          ) : (
            <span>
              <strong>{selectionName(selection)}</strong>{' '}
              {selected.length > 1
                ? `· ${selected.length} cells selected`
                : edit
                  ? '· Editing — Enter to save, Escape to cancel'
                  : '· Type to enter a value, or double-click to edit'}
            </span>
          )}
        </div>
        {numbers.length > 0 && (
          <div className="selection-stats">
            <span>
              Count <strong>{numbers.length}</strong>
            </span>
            <span>
              Sum <strong>{displayValue({ value: numbers.reduce((a, n) => a + n, 0) })}</strong>
            </span>
            <span>
              Average{' '}
              <strong>
                {displayValue({ value: numbers.reduce((a, n) => a + n, 0) / numbers.length })}
              </strong>
            </span>
          </div>
        )}
      </div>
      <div className="sheet-example">
        <span>A small model to start from: time, velocity, and distance.</span>
        <button
          className="text-button"
          disabled={readOnly}
          onClick={() => {
            finishEdit()
            Object.values(latest.current.cells).some((c) => c.input)
              ? setConfirmExample(true)
              : loadExample()
          }}
        >
          Load motion example
          <ArrowRight size={14} />
        </button>
      </div>
      {confirmExample && (
        <div
          className="sheet-example-confirm"
          role="region"
          aria-label="Replace spreadsheet confirmation"
        >
          <div>
            <strong>Replace this spreadsheet with the motion example?</strong>
            <p>You can undo this change. Project notes and graph data stay intact.</p>
          </div>
          <button className="button secondary" onClick={() => setConfirmExample(false)}>
            Cancel
          </button>
          <button className="button primary" onClick={loadExample}>
            Load example
          </button>
        </div>
      )}
    </div>
  )
}
