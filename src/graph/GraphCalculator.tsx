import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  CheckCheck,
  ChevronDown,
  Eye,
  EyeOff,
  HelpCircle,
  Plus,
  Redo2,
  SlidersHorizontal,
  StickyNote,
  Trash2,
  Undo2,
  X,
} from 'lucide-react'
import { compileGraph } from './engine'
import { numberLabel } from './plot'
import {
  COLORS,
  laplaceGraph,
  MAX_ENTRIES,
  newExpression,
  type GraphDocument,
  type GraphEntry,
  type ParameterEntry,
} from './model'
import GraphPlot from './GraphPlot'
import './graph.css'
import type { SheetDocument } from '../sheet/model'
import { resolveSheetPlots } from '../linked/model'

function ParameterControl({
  entry,
  update,
  readOnly,
}: {
  entry: ParameterEntry
  update: (entry: ParameterEntry) => void
  readOnly: boolean
}) {
  const [value, setValue] = useState(String(entry.value)),
    [error, setError] = useState('')
  const [limits, setLimits] = useState([entry.min, entry.max, entry.step].map(String))
  const settings = useRef<HTMLDetailsElement>(null)
  useEffect(() => setValue(String(entry.value)), [entry.value])
  useEffect(
    () => setLimits([entry.min, entry.max, entry.step].map(String)),
    [entry.min, entry.max, entry.step],
  )
  const constant = entry.mode === 'constant' || entry.min === entry.max
  function submitValue() {
    const next = Number(value)
    if (
      !value.trim() ||
      !Number.isFinite(next) ||
      (!constant && (next < entry.min || next > entry.max))
    ) {
      setError(
        constant ? 'Enter a finite number.' : `Choose a value from ${entry.min} to ${entry.max}.`,
      )
      return
    }
    setError('')
    if (next !== entry.value)
      update({ ...entry, value: next, mode: constant ? 'constant' : entry.mode })
  }
  return (
    <div className="parameter-control">
      <div className="parameter-definition">
        <input
          aria-label={`Parameter name ${entry.name}`}
          className="parameter-name"
          maxLength={40}
          value={entry.name}
          disabled={readOnly}
          onChange={(e) => update({ ...entry, name: e.target.value })}
        />
        <span>=</span>
        <input
          type="number"
          step="any"
          aria-label={`Value of ${entry.name}`}
          value={value}
          disabled={readOnly}
          onChange={(e) => setValue(e.target.value)}
          onBlur={submitValue}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.currentTarget.blur()
            }
          }}
        />
        <span className="parameter-kind">{constant ? 'constant' : 'slider'}</span>
      </div>
      {!constant && (
        <>
          <input
            className="parameter-range"
            type="range"
            aria-label={`Slider ${entry.name}`}
            min={entry.min}
            max={entry.max}
            step={entry.step}
            value={entry.value}
            disabled={readOnly}
            onChange={(e) => {
              setError('')
              update({ ...entry, value: Number(e.target.value) })
            }}
          />
          <div className="parameter-extents">
            <span>{entry.min}</span>
            <span>{entry.max}</span>
          </div>
        </>
      )}
      <details className="parameter-settings" ref={settings}>
        <summary>
          <SlidersHorizontal size={12} />
          Parameter settings
          <ChevronDown size={12} />
        </summary>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const [min, max, step] = limits.map(Number)
            if (
              limits.some((n) => !n.trim()) ||
              ![min, max, step].every(Number.isFinite) ||
              min > max ||
              step <= 0
            ) {
              setError('Use finite limits, minimum ≤ maximum, and a positive step.')
              return
            }
            setError('')
            update({
              ...entry,
              min,
              max,
              step,
              mode: min === max ? 'constant' : entry.mode,
              value:
                min === max
                  ? min
                  : entry.mode === 'constant'
                    ? entry.value
                    : Math.max(min, Math.min(max, entry.value)),
            })
            settings.current?.removeAttribute('open')
          }}
        >
          <div className="parameter-limits">
            {['Minimum', 'Maximum', 'Step'].map((label, i) => (
              <label key={label}>
                {label}
                <input
                  type="number"
                  step="any"
                  required
                  disabled={readOnly}
                  aria-label={`${label} of ${entry.name}`}
                  value={limits[i]}
                  onChange={(e) => setLimits(limits.map((v, j) => (i === j ? e.target.value : v)))}
                />
              </label>
            ))}
          </div>
          <label className="constant-option">
            <input
              type="checkbox"
              checked={entry.mode === 'constant'}
              disabled={readOnly}
              onChange={(e) =>
                update({
                  ...entry,
                  mode: e.target.checked ? 'constant' : 'slider',
                  value: e.target.checked
                    ? entry.value
                    : Math.max(entry.min, Math.min(entry.max, entry.value)),
                })
              }
            />
            Use as a constant
          </label>
          <button className="button secondary" disabled={readOnly}>
            Apply settings
          </button>
        </form>
      </details>
      {error && (
        <p role="status" className="expression-error">
          {error}
        </p>
      )}
    </div>
  )
}

type Props = {
  title: string
  graph: GraphDocument
  onChange: (graph: GraphDocument) => boolean
  onBack: () => void
  readOnly: boolean
  unsaved: boolean
  sheet?: SheetDocument
}
export default function GraphCalculator({
  title,
  graph,
  onChange,
  onBack,
  readOnly,
  unsaved,
  sheet,
}: Props) {
  const compiled = useMemo(() => compileGraph({ entries: graph.entries }), [graph.entries])
  const series = useMemo(() => resolveSheetPlots(graph, sheet), [graph.sheetPlots, sheet])
  const [help, setHelp] = useState(false),
    [confirmExample, setConfirmExample] = useState(false)
  const [history, setHistory] = useState<{ past: GraphDocument[]; future: GraphDocument[] }>({
    past: [],
    future: [],
  })
  const latest = useRef(graph),
    group = useRef({ key: '', time: 0 }),
    list = useRef<HTMLDivElement>(null)
  const [focusId, setFocusId] = useState('')
  useEffect(() => {
    if (latest.current !== graph) {
      setHistory({ past: [], future: [] })
      latest.current = graph
    }
  }, [graph])
  useEffect(() => {
    if (focusId)
      list.current
        ?.querySelector<HTMLInputElement>(
          `[data-entry-id="${focusId}"] input, [data-entry-id="${focusId}"] textarea`,
        )
        ?.focus()
  }, [focusId])
  function change(next: GraphDocument, key = '') {
    if (readOnly) return
    const coalesce = key && key === group.current.key && Date.now() - group.current.time < 600
    setHistory((h) => ({ past: coalesce ? h.past : [...h.past, graph].slice(-50), future: [] }))
    group.current = { key, time: Date.now() }
    latest.current = next
    onChange(next)
  }
  function update(entry: GraphEntry) {
    change(
      { ...graph, entries: graph.entries.map((e) => (e.id === entry.id ? entry : e)) },
      entry.id,
    )
  }
  function add(kind: GraphEntry['kind']) {
    if (graph.entries.length >= MAX_ENTRIES) return
    const names = new Set(
      graph.entries.flatMap((e) =>
        e.kind === 'parameter'
          ? [e.name]
          : e.kind === 'expression'
            ? [e.formula.match(/^\s*(\w+)\s*=/)?.[1]]
            : [],
      ),
    )
    let name = 'a'
    for (const candidate of ['a', 'b', 'c', 'p', 'q', 'k'])
      if (!names.has(candidate)) {
        name = candidate
        break
      }
    if (names.has(name)) {
      let n = 1
      while (names.has(`a_${n}`)) n++
      name = `a_${n}`
    }
    const entry: GraphEntry =
      kind === 'expression'
        ? newExpression(
            '',
            COLORS[graph.entries.filter((e) => e.kind === 'expression').length % COLORS.length],
          )
        : kind === 'note'
          ? { id: crypto.randomUUID(), kind, text: '' }
          : {
              id: crypto.randomUUID(),
              kind,
              name,
              value: 1,
              min: -5,
              max: 5,
              step: 0.1,
              mode: 'slider',
            }
    change({ ...graph, entries: [...graph.entries, entry] })
    setFocusId(entry.id)
  }
  function undo() {
    const previous = history.past.at(-1)
    if (!previous) return
    setHistory({ past: history.past.slice(0, -1), future: [graph, ...history.future] })
    group.current.key = ''
    latest.current = previous
    onChange(previous)
  }
  function redo() {
    const next = history.future[0]
    if (!next) return
    setHistory({ past: [...history.past, graph], future: history.future.slice(1) })
    group.current.key = ''
    latest.current = next
    onChange(next)
  }
  function loadExample() {
    change(laplaceGraph())
    setConfirmExample(false)
  }
  const hasContent = graph.entries.some((e) =>
    e.kind === 'expression' ? e.formula.trim() : e.kind === 'note' ? e.text.trim() : true,
  )
  return (
    <div className="calculator">
      <div className="calculator-heading">
        <div>
          <button className="back-link" onClick={onBack}>
            <ArrowLeft size={14} />
            Project overview
          </button>
          <div className="eyebrow">GRAPHING CALCULATOR</div>
          <h1>{title}</h1>
        </div>
        <div className="calculator-actions">
          <div className="history-buttons">
            <button
              className="icon-button"
              aria-label="Undo graph change"
              title="Undo"
              disabled={readOnly || !history.past.length}
              onClick={undo}
            >
              <Undo2 size={18} />
            </button>
            <button
              className="icon-button"
              aria-label="Redo graph change"
              title="Redo"
              disabled={readOnly || !history.future.length}
              onClick={redo}
            >
              <Redo2 size={18} />
            </button>
          </div>
          <button className="button secondary" aria-expanded={help} onClick={() => setHelp(!help)}>
            <HelpCircle size={16} />
            How to write expressions
          </button>
        </div>
      </div>
      {readOnly && (
        <div className="state-banner">
          This project is in the trash. Its graph is preserved; restore the project to edit it.
        </div>
      )}
      {unsaved && (
        <div className="unsaved-note" role="status">
          <span>Your graph changes are kept on this page. Save them before leaving.</span>
          <button className="button secondary" onClick={() => onChange(graph)}>
            Retry saving graph
          </button>
        </div>
      )}
      {help && (
        <section className="graph-help" aria-label="Expression help">
          <div>
            <h2>A little notation goes a long way</h2>
            <button
              className="icon-button"
              aria-label="Close expression help"
              onClick={() => setHelp(false)}
            >
              <X size={16} />
            </button>
          </div>
          <p>
            Use plain-text math. Angles are in radians. Multiplication can be explicit or implied:{' '}
            <code>2*x</code>, <code>2x</code>, or <code>e^(-t) sin(t)</code>.
          </p>
          <div className="help-examples">
            <p>
              <code>y = sin(x)</code>
              <span>Plot an expression</span>
            </p>
            <p>
              <code>f(t) = t^2</code>
              <span>Define a function</span>
            </p>
            <p>
              <code>g(t) = f(t) + a</code>
              <span>Reuse a function or parameter</span>
            </p>
            <p>
              <code>y = x^2 {'{-2 < x < 2}'}</code>
              <span>Restrict a domain</span>
            </p>
          </div>
          <p>
            Supported: sin, cos, tan, asin, acos, atan, sinh, cosh, tanh, exp, sqrt, abs, ln/log
            (natural logarithm), log10, floor, ceil, round, sign, min, max, pow, atan2; constants e,
            pi, tau. Use underscores for subscripts, such as <code>f_2(t)</code>. Add a parameter
            for a slider or fixed constant. Implicit equations, inequalities as shaded regions, and
            calculus operators come later.
          </p>
        </section>
      )}
      <div className="graph-workbench">
        <section className="expression-panel" aria-label="Expressions and parameters">
          <div className="expression-panel-heading">
            <h2>Expressions</h2>
            <span>{graph.entries.length} items</span>
          </div>
          <div className="graph-add-bar">
            <button
              disabled={readOnly || graph.entries.length >= MAX_ENTRIES}
              onClick={() => add('expression')}
            >
              <Plus size={14} />
              Expression
            </button>
            <button
              disabled={readOnly || graph.entries.length >= MAX_ENTRIES}
              onClick={() => add('parameter')}
            >
              <SlidersHorizontal size={13} />
              Parameter
            </button>
            <button
              disabled={readOnly || graph.entries.length >= MAX_ENTRIES}
              onClick={() => add('note')}
            >
              <StickyNote size={13} />
              Note
            </button>
          </div>
          <div className="expression-list" ref={list}>
            {graph.entries.map((entry, i) => (
              <div
                className={`expression-row ${entry.kind} ${compiled.errors[entry.id] ? 'has-error' : ''}`}
                key={entry.id}
                data-entry-id={entry.id}
              >
                <div className="expression-row-top">
                  <span className="expression-number">{String(i + 1).padStart(2, '0')}</span>
                  <span className="entry-kind">
                    {entry.kind === 'parameter'
                      ? 'PARAMETER'
                      : entry.kind === 'note'
                        ? 'NOTE'
                        : 'EXPRESSION'}
                  </span>
                  {entry.kind === 'expression' && (
                    <button
                      className="icon-button curve-visibility"
                      style={{ color: entry.color }}
                      disabled={readOnly}
                      aria-label={`${entry.visible ? 'Hide' : 'Show'} expression ${i + 1}`}
                      aria-pressed={entry.visible}
                      onClick={() => update({ ...entry, visible: !entry.visible })}
                    >
                      {entry.visible ? <Eye size={15} /> : <EyeOff size={15} />}
                    </button>
                  )}
                  <button
                    className="icon-button delete-entry"
                    disabled={readOnly}
                    aria-label={`Remove ${entry.kind} ${i + 1}`}
                    onClick={() =>
                      change({ ...graph, entries: graph.entries.filter((e) => e.id !== entry.id) })
                    }
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                {entry.kind === 'expression' ? (
                  <>
                    <input
                      className="formula-input"
                      type="text"
                      spellCheck={false}
                      aria-label={`Expression ${i + 1}`}
                      aria-invalid={!!compiled.errors[entry.id]}
                      aria-describedby={compiled.errors[entry.id] ? `error-${entry.id}` : undefined}
                      maxLength={500}
                      value={entry.formula}
                      disabled={readOnly}
                      placeholder="y = sin(x)"
                      onChange={(e) => update({ ...entry, formula: e.target.value })}
                    />
                    <details className="expression-options">
                      <summary>
                        Curve appearance
                        <ChevronDown size={11} />
                      </summary>
                      <label>
                        Label
                        <input
                          aria-label={`Curve label ${i + 1}`}
                          maxLength={60}
                          value={entry.label}
                          disabled={readOnly}
                          placeholder="Use function name"
                          onChange={(e) => update({ ...entry, label: e.target.value })}
                        />
                      </label>
                      <label>
                        Color
                        <select
                          aria-label={`Curve color ${i + 1}`}
                          value={entry.color}
                          disabled={readOnly}
                          onChange={(e) => update({ ...entry, color: e.target.value })}
                        >
                          {COLORS.map((color, j) => (
                            <option key={color} value={color}>
                              {['Forest', 'Clay', 'Blue', 'Plum', 'Ochre', 'Teal'][j]}
                            </option>
                          ))}
                          {!COLORS.some((c) => c === entry.color) && (
                            <option value={entry.color}>Custom</option>
                          )}
                        </select>
                      </label>
                    </details>
                    {compiled.values[entry.id] !== undefined && (
                      <p className="constant-result">
                        = {numberLabel(compiled.values[entry.id])} · constant
                      </p>
                    )}
                  </>
                ) : entry.kind === 'parameter' ? (
                  <ParameterControl entry={entry} update={update} readOnly={readOnly} />
                ) : (
                  <textarea
                    aria-label={`Graph note ${i + 1}`}
                    rows={3}
                    maxLength={4000}
                    disabled={readOnly}
                    value={entry.text}
                    placeholder="Leave a note about this model…"
                    onChange={(e) => update({ ...entry, text: e.target.value })}
                  />
                )}
                {compiled.errors[entry.id] && (
                  <p className="expression-error" id={`error-${entry.id}`} role="status">
                    {compiled.errors[entry.id]}
                  </p>
                )}
              </div>
            ))}
          </div>
          {!graph.entries.length && (
            <p className="expressions-empty">
              Add an expression, a parameter, or a note to get started.
            </p>
          )}
          <div className="expression-panel-footer">
            <button
              disabled={readOnly}
              className="text-button"
              onClick={() => (hasContent ? setConfirmExample(true) : loadExample())}
            >
              Load LaPlace example
              <Plus size={13} />
            </button>
            <span>
              <CheckCheck size={12} />
              {unsaved ? 'Changes not saved' : 'Saved as you edit'}
            </span>
            {graph.entries.length >= MAX_ENTRIES && <p>Limit of {MAX_ENTRIES} items per graph.</p>}
          </div>
        </section>
        <div className="graph-canvas-column">
          <div className="graph-display-options">
            <label>
              <input
                type="checkbox"
                checked={graph.showGrid}
                disabled={readOnly}
                onChange={(e) => change({ ...graph, showGrid: e.target.checked })}
              />
              Grid
            </label>
            <label>
              <input
                type="checkbox"
                checked={graph.showLabels}
                disabled={readOnly}
                onChange={(e) => change({ ...graph, showLabels: e.target.checked })}
              />
              Curve labels
            </label>
            <span>Functions of one variable</span>
          </div>
          <GraphPlot
            graph={graph}
            compiled={compiled}
            series={series}
            readOnly={readOnly}
            onView={(viewport) => change({ ...graph, viewport }, 'viewport')}
          />
        </div>
      </div>
      {confirmExample && (
        <div className="example-confirm" role="region" aria-label="Load example confirmation">
          <div>
            <strong>Replace this graph with the LaPlace example?</strong>
            <p>Your project notes stay as they are. You can undo this change.</p>
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
