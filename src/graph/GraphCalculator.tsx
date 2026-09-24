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
  GripVertical,
  Play,
  Pause,
  Settings2,
  Minus,
} from 'lucide-react'
import { compileGraph } from './engine'
import { numberLabel } from './plot'
import {
  COLORS,
  laplaceGraph,
  MAX_ENTRIES,
  newExpression,
  isPlotEntry,
  entryName,
  DEFAULT_ANIMATION,
  type GraphDocument,
  type GraphEntry,
  type ParameterEntry,
  equalAxesFor,
} from './model'
import GraphPlot from './GraphPlot'
import './graph.css'
import type { SheetDocument } from '../sheet/model'
import { resolveSheetPlots } from '../linked/model'
import ColorPicker from './ColorPicker'
import { useParameterAnimation } from './useParameterAnimation'

function ParameterControl({
  entry,
  update,
  readOnly,
  playing,
  onPlay,
}: {
  entry: ParameterEntry
  update: (entry: ParameterEntry) => void
  readOnly: boolean
  playing: boolean
  onPlay: () => void
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
  const [animationOpen, setAnimationOpen] = useState(false)
  const animation = entry.animation ?? DEFAULT_ANIMATION
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
          <div className="slider-playback">
            <button
              className="icon-button"
              aria-label={`${playing ? 'Pause' : 'Play'} ${entry.name}`}
              title={playing ? 'Pause animation' : 'Play animation'}
              disabled={readOnly}
              onClick={onPlay}
            >
              {playing ? <Pause size={16} /> : <Play size={16} />}
            </button>
            <button
              className="icon-button"
              aria-label={`Animation settings for ${entry.name}`}
              title="Animation settings"
              aria-expanded={animationOpen}
              onClick={() => setAnimationOpen(!animationOpen)}
            >
              <Settings2 size={15} />
            </button>
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
          </div>
          <div className="parameter-extents playback-extents">
            <span>{entry.min}</span>
            <span>{entry.max}</span>
          </div>
          {animationOpen && (
            <div
              className="animation-settings"
              role="group"
              aria-label={`Animation for ${entry.name}`}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setAnimationOpen(false)
              }}
            >
              <div className="animation-speed">
                <span>Speed</span>
                <button
                  className="icon-button"
                  aria-label={`Slow down ${entry.name}`}
                  disabled={readOnly || animation.speed <= 0.125}
                  onClick={() =>
                    update({
                      ...entry,
                      animation: { ...animation, speed: Math.max(0.125, animation.speed / 2) },
                    })
                  }
                >
                  <Minus size={14} />
                </button>
                <output aria-label={`Animation speed for ${entry.name}`}>{animation.speed}×</output>
                <button
                  className="icon-button"
                  aria-label={`Speed up ${entry.name}`}
                  disabled={readOnly || animation.speed >= 16}
                  onClick={() =>
                    update({
                      ...entry,
                      animation: { ...animation, speed: Math.min(16, animation.speed * 2) },
                    })
                  }
                >
                  <Plus size={14} />
                </button>
              </div>
              <p>Low → high in {5 / animation.speed} seconds.</p>
              <label>
                At the end{' '}
                <select
                  aria-label={`Animation mode for ${entry.name}`}
                  disabled={readOnly}
                  value={animation.mode}
                  onChange={(e) =>
                    update({
                      ...entry,
                      animation: { ...animation, mode: e.target.value as typeof animation.mode },
                    })
                  }
                >
                  <option value="loop">Loop from the start</option>
                  <option value="reverse">Reverse direction</option>
                  <option value="once">Stop at the end</option>
                </select>
              </label>
            </div>
          )}
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
  const [dragId, setDragId] = useState('')
  const [dropId, setDropId] = useState('')
  const [reorderNotice, setReorderNotice] = useState('')
  const touchDrag = useRef<{
    id: string
    pointer: number
    y: number
    target: string
    active: boolean
  } | null>(null)
  const animation = useParameterAnimation(graph, readOnly || unsaved, (next) =>
    change(next, 'animation', true),
  )
  useEffect(() => {
    if (latest.current !== graph) {
      setHistory({ past: [], future: [] })
      latest.current = graph
      animation.stop()
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
  function change(next: GraphDocument, key = '', animating = false) {
    if (readOnly) return
    if (!animating) animation.stop()
    const coalesce = key && key === group.current.key && Date.now() - group.current.time < 600
    setHistory((h) => ({ past: coalesce ? h.past : [...h.past, graph].slice(-50), future: [] }))
    group.current = { key, time: Date.now() }
    latest.current = next
    onChange(next)
  }
  function reorder(id: string, targetId: string) {
    const from = graph.entries.findIndex((e) => e.id === id)
    const to = graph.entries.findIndex((e) => e.id === targetId)
    if (from < 0 || to < 0 || from === to || readOnly) return
    const entries = [...graph.entries]
    const [moved] = entries.splice(from, 1)
    entries.splice(to, 0, moved)
    change({ ...graph, entries })
    setReorderNotice(`${entryName(moved)} moved to position ${to + 1}.`)
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
      kind === 'expression' || kind === 'point' || kind === 'implicit'
        ? {
            ...newExpression('', COLORS[graph.entries.filter(isPlotEntry).length % COLORS.length]),
            kind,
          }
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
    animation.stop()
    const previous = history.past.at(-1)
    if (!previous) return
    setHistory({ past: history.past.slice(0, -1), future: [graph, ...history.future] })
    group.current.key = ''
    latest.current = previous
    onChange(previous)
  }
  function redo() {
    animation.stop()
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
    isPlotEntry(e) ? e.formula.trim() : e.kind === 'note' ? e.text.trim() : true,
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
            for a slider or fixed constant. Points accept ordered pairs such as{' '}
            <code>(a, sin(a))</code>. Implicit equations accept <code>x^2 + y^2 = 9</code> or{' '}
            <code>x = 2</code>. Implicit curves are numerical approximations; very small features
            and repeated roots may need a closer zoom or a simpler equation. Shaded inequalities and
            calculus operators come later.
          </p>
          <p>
            Drag a row by its grip to reorder it, or focus the grip and press Alt + ↑ / ↓. Drag a
            curve label along its line; double-click it (or focus it and press Enter) to edit its
            text, size, and angle. Playback pauses when you edit the graph or leave this tab.
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
              Formulas
            </button>
            <button
              disabled={readOnly || graph.entries.length >= MAX_ENTRIES}
              onClick={() => add('point')}
            >
              <Plus size={14} />
              Points
            </button>
            <button
              disabled={readOnly || graph.entries.length >= MAX_ENTRIES}
              onClick={() => add('implicit')}
            >
              <Plus size={14} />
              Implicit equation
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
          <span className="sr-only" role="status">
            {reorderNotice}
          </span>
          <div className="expression-list" ref={list}>
            {graph.entries.map((entry, i) => (
              <div
                className={`expression-row ${entry.kind} ${compiled.errors[entry.id] ? 'has-error' : ''} ${dropId === entry.id ? 'drop-target' : ''} ${dragId === entry.id ? 'is-dragging' : ''}`}
                key={entry.id}
                data-entry-id={entry.id}
                onDragOver={(event) => {
                  if (!readOnly && dragId) {
                    event.preventDefault()
                    event.dataTransfer.dropEffect = 'move'
                    setDropId(entry.id)
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault()
                  reorder(dragId, entry.id)
                  setDragId('')
                  setDropId('')
                }}
              >
                <div className="expression-row-top">
                  <button
                    className="icon-button entry-drag-handle"
                    draggable={!readOnly}
                    disabled={readOnly}
                    aria-label={`Reorder ${entryName(entry).toLowerCase()} ${i + 1}`}
                    title="Drag to reorder · Alt + ↑ / ↓"
                    onPointerDown={(event) => {
                      if (readOnly || event.pointerType === 'mouse') return
                      event.currentTarget.setPointerCapture(event.pointerId)
                      touchDrag.current = {
                        id: entry.id,
                        pointer: event.pointerId,
                        y: event.clientY,
                        target: entry.id,
                        active: false,
                      }
                    }}
                    onPointerMove={(event) => {
                      const touch = touchDrag.current
                      if (!touch || touch.pointer !== event.pointerId) return
                      if (!touch.active && Math.abs(event.clientY - touch.y) < 5) return
                      touch.active = true
                      setDragId(touch.id)
                      const row = document
                        .elementFromPoint(event.clientX, event.clientY)
                        ?.closest<HTMLElement>('.expression-row')
                      if (row?.dataset.entryId) {
                        touch.target = row.dataset.entryId
                        setDropId(touch.target)
                      }
                      const rect = list.current?.getBoundingClientRect()
                      if (rect && list.current) {
                        if (event.clientY > rect.bottom - 35) list.current.scrollTop += 14
                        else if (event.clientY < rect.top + 35) list.current.scrollTop -= 14
                      }
                    }}
                    onPointerUp={(event) => {
                      const touch = touchDrag.current
                      if (!touch || touch.pointer !== event.pointerId) return
                      if (touch.active) reorder(touch.id, touch.target)
                      touchDrag.current = null
                      setDragId('')
                      setDropId('')
                      event.currentTarget.releasePointerCapture(event.pointerId)
                    }}
                    onPointerCancel={() => {
                      touchDrag.current = null
                      setDragId('')
                      setDropId('')
                    }}
                    onDragStart={(event) => {
                      event.dataTransfer.setData('text/plain', entry.id)
                      event.dataTransfer.effectAllowed = 'move'
                      setDragId(entry.id)
                    }}
                    onDragEnd={() => {
                      setDragId('')
                      setDropId('')
                    }}
                    onKeyDown={(event) => {
                      if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
                        event.preventDefault()
                        const target = graph.entries[i + (event.key === 'ArrowUp' ? -1 : 1)]
                        if (target) reorder(entry.id, target.id)
                      }
                    }}
                  >
                    <GripVertical size={15} />
                  </button>
                  <span className="expression-number">{String(i + 1).padStart(2, '0')}</span>
                  <span className="entry-kind">{entryName(entry).toUpperCase()}</span>
                  {isPlotEntry(entry) && (
                    <button
                      className="icon-button curve-visibility"
                      style={{ color: entry.color }}
                      disabled={readOnly}
                      aria-label={`${entry.visible ? 'Hide' : 'Show'} ${entryName(entry).toLowerCase()} ${i + 1}`}
                      aria-pressed={entry.visible}
                      onClick={() => update({ ...entry, visible: !entry.visible })}
                    >
                      {entry.visible ? <Eye size={15} /> : <EyeOff size={15} />}
                    </button>
                  )}
                  <button
                    className="icon-button delete-entry"
                    disabled={readOnly}
                    aria-label={`Remove ${entryName(entry).toLowerCase()} ${i + 1}`}
                    onClick={() =>
                      change({ ...graph, entries: graph.entries.filter((e) => e.id !== entry.id) })
                    }
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                {isPlotEntry(entry) ? (
                  <>
                    <input
                      className="formula-input"
                      type="text"
                      spellCheck={false}
                      aria-label={`${entryName(entry)} ${i + 1}`}
                      aria-invalid={!!compiled.errors[entry.id]}
                      aria-describedby={compiled.errors[entry.id] ? `error-${entry.id}` : undefined}
                      maxLength={500}
                      value={entry.formula}
                      disabled={readOnly}
                      placeholder={
                        entry.kind === 'point'
                          ? '(2, sin(a))'
                          : entry.kind === 'implicit'
                            ? 'x^2 + y^2 = 9'
                            : 'y = sin(x)'
                      }
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
                      <ColorPicker
                        label={`Curve color ${i + 1}`}
                        value={entry.color}
                        disabled={readOnly}
                        onChange={(color) => update({ ...entry, color })}
                      />
                    </details>
                    {compiled.values[entry.id] !== undefined && (
                      <p className="constant-result">
                        = {numberLabel(compiled.values[entry.id])} · constant
                      </p>
                    )}
                  </>
                ) : entry.kind === 'parameter' ? (
                  <ParameterControl
                    entry={entry}
                    update={update}
                    readOnly={readOnly}
                    playing={animation.playing.includes(entry.id)}
                    onPlay={() => {
                      group.current.key = ''
                      animation.toggle(entry)
                    }}
                  />
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
              Add a formula, point, implicit equation, parameter, or note to get started.
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
            <label>
              <input
                type="checkbox"
                checked={equalAxesFor(
                  graph,
                  !!(
                    graph.sheetPlots?.some((p) => p.visible) ||
                    graph.entries.some(
                      (e) => (e.kind === 'point' || e.kind === 'implicit') && e.visible,
                    )
                  ),
                )}
                disabled={readOnly}
                onChange={(e) => change({ ...graph, equalAxes: e.target.checked })}
              />
              Equal axes
            </label>
            <span>Formulas · Points · Equations</span>
          </div>
          <GraphPlot
            graph={graph}
            compiled={compiled}
            series={series}
            readOnly={readOnly}
            onEntryChange={update}
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
