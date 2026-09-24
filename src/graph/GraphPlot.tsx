import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Crosshair, Minus, Plus, Move, Settings2 } from 'lucide-react'
import {
  DEFAULT_VIEW,
  validViewport,
  isPlotEntry,
  type PlotEntry,
  type GraphDocument,
  type Viewport,
  equalAxesFor,
} from './model'
import type { CompiledGraph } from './engine'
import type { PointSeries } from '../linked/model'
import { sampleImplicit } from './implicit'
import CurveLabel from './CurveLabel'
import LabelManager from './LabelManager'
import {
  numberLabel,
  panView,
  sampleCurve,
  ticks,
  toPixel,
  toWorld,
  zoomView,
  type Point,
  equalScaleView,
  pointPath,
} from './plot'

type Props = {
  graph: GraphDocument
  compiled: CompiledGraph
  onView: (view: Viewport) => void
  readOnly: boolean
  series?: PointSeries[]
  onEntryChange?: (entry: PlotEntry) => void
}
export default function GraphPlot({
  graph,
  compiled,
  onView,
  readOnly,
  series = [],
  onEntryChange,
}: Props) {
  const stage = useRef<HTMLDivElement>(null),
    svg = useRef<SVGSVGElement>(null)
  const [size, setSize] = useState({ width: 700, height: 530 })
  const [dragView, setDragView] = useState<Viewport | null>(null)
  const [hover, setHover] = useState<Point | null>(null)
  const [settings, setSettings] = useState(false)
  const [bounds, setBounds] = useState<string[]>([])
  const [boundsError, setBoundsError] = useState('')
  const [editingLabel, setEditingLabel] = useState('')
  const labelEntry = graph.entries.find(
    (entry) => entry.id === editingLabel && isPlotEntry(entry),
  ) as PlotEntry | undefined
  function closeLabel() {
    setEditingLabel('')
    Array.from(svg.current?.querySelectorAll<SVGTextElement>('[data-entry-id]') ?? [])
      .find((node) => node.dataset.entryId === editingLabel)
      ?.focus()
  }
  const drag = useRef<{ pointer: number; start: Point; view: Viewport; next: Viewport } | null>(
    null,
  )
  const clipId = useId().replace(/:/g, '')
  const equalAxes = equalAxesFor(
    graph,
    !!(series.length || compiled.points.length || compiled.implicitCurves.length),
  )
  const view = useMemo(
    () =>
      equalAxes
        ? equalScaleView(dragView ?? graph.viewport, size.width, size.height)
        : (dragView ?? graph.viewport),
    [dragView, graph.viewport, size.width, size.height, equalAxes],
  )
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect
      if (rect.width && rect.height) setSize({ width: rect.width, height: rect.height })
    })
    observer.observe(stage.current!)
    return () => observer.disconnect()
  }, [])
  function position(clientX: number, clientY: number) {
    const rect = svg.current!.getBoundingClientRect()
    return {
      x: ((clientX - rect.left) * size.width) / rect.width,
      y: ((clientY - rect.top) * size.height) / rect.height,
    }
  }
  useEffect(() => {
    const element = svg.current!
    const wheel = (event: WheelEvent) => {
      if (readOnly || drag.current) return
      event.preventDefault()
      const rect = element.getBoundingClientRect()
      const point = toWorld(
        {
          x: ((event.clientX - rect.left) * size.width) / rect.width,
          y: ((event.clientY - rect.top) * size.height) / rect.height,
        },
        view,
        size.width,
        size.height,
      )
      const delta =
        event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? size.height : 1)
      onView(zoomView(view, Math.exp(Math.max(-0.4, Math.min(0.4, delta * 0.002))), point))
    }
    element.addEventListener('wheel', wheel, { passive: false })
    return () => element.removeEventListener('wheel', wheel)
  }, [view, onView, readOnly, size])
  const curves = useMemo(
    () => [
      ...compiled.curves.map((curve) => ({
        curve,
        ...sampleCurve(curve, view, size.width, size.height),
      })),
      ...compiled.implicitCurves.map((curve) => ({
        curve,
        ...sampleImplicit(curve, view, size.width, size.height),
      })),
    ],
    [compiled, view, size],
  )
  const origin = toPixel({ x: 0, y: 0 }, view, size.width, size.height)
  const xTicks = ticks(view.xMin, view.xMax, Math.max(3, size.width / 90)),
    yTicks = ticks(view.yMin, view.yMax, Math.max(3, size.height / 65))
  const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))
  const rendered = curves.filter((c) => !!c.path).length
  const probe = hover ? toWorld(hover, view, size.width, size.height) : null
  return (
    <section className="graph-plot" aria-label="Interactive graph">
      <div className="plot-heading">
        <span>
          <span className="status-dot" />
          CARTESIAN PLANE
        </span>
        <span>{equalAxes ? 'Equal x / y scale' : 'Independent x / y scale'}</span>
      </div>
      <div className={`plot-stage ${dragView ? 'is-panning' : ''}`} ref={stage}>
        <svg
          ref={svg}
          className="plot-svg"
          role="group"
          aria-label="Function graph. Drag to pan, scroll to zoom. Arrow keys pan; plus and minus zoom; zero resets."
          tabIndex={0}
          viewBox={`0 0 ${size.width} ${size.height}`}
          onPointerDown={(event) => {
            if (readOnly || event.button !== 0 || drag.current) return
            event.currentTarget.focus()
            event.currentTarget.setPointerCapture(event.pointerId)
            drag.current = {
              pointer: event.pointerId,
              start: position(event.clientX, event.clientY),
              view,
              next: view,
            }
            setHover(null)
          }}
          onPointerMove={(event) => {
            const point = position(event.clientX, event.clientY)
            if (drag.current?.pointer === event.pointerId) {
              const { start, view: initial } = drag.current
              const next = panView(
                initial,
                ((start.x - point.x) / size.width) * (initial.xMax - initial.xMin),
                ((point.y - start.y) / size.height) * (initial.yMax - initial.yMin),
              )
              drag.current.next = next
              setDragView(next)
            } else if (!drag.current) setHover(point)
          }}
          onPointerUp={(event) => {
            if (drag.current?.pointer !== event.pointerId) return
            const next = drag.current.next
            drag.current = null
            setDragView(null)
            event.currentTarget.releasePointerCapture(event.pointerId)
            if (next !== graph.viewport) onView(next)
          }}
          onPointerCancel={() => {
            drag.current = null
            setDragView(null)
          }}
          onPointerLeave={() => {
            if (!drag.current) setHover(null)
          }}
          onKeyDown={(event) => {
            if (readOnly) return
            const dx = (view.xMax - view.xMin) * 0.1,
              dy = (view.yMax - view.yMin) * 0.1
            let next: Viewport | undefined
            switch (event.key) {
              case 'ArrowLeft':
                next = panView(view, -dx, 0)
                break
              case 'ArrowRight':
                next = panView(view, dx, 0)
                break
              case 'ArrowUp':
                next = panView(view, 0, dy)
                break
              case 'ArrowDown':
                next = panView(view, 0, -dy)
                break
              case '+':
              case '=':
                next = zoomView(view, 0.8)
                break
              case '-':
                next = zoomView(view, 1.25)
                break
              case '0':
                next = { ...DEFAULT_VIEW }
                break
            }
            if (next) {
              event.preventDefault()
              onView(next)
            }
          }}
        >
          <title>Graph of the visible expressions and linked points</title>
          <desc>
            {[
              ...compiled.curves.map((c) => c.entry.formula),
              ...compiled.implicitCurves.map((c) => c.entry.formula),
              ...compiled.points.map(
                (p) => `${p.label}: (${numberLabel(p.x)}, ${numberLabel(p.y)})`,
              ),
              ...series.flatMap((s) =>
                s.points
                  .filter((p) => !!p)
                  .map(
                    (p) =>
                      `${s.plot.label} ${p!.label}: (${numberLabel(p!.x)}, ${numberLabel(p!.y)})`,
                  ),
              ),
            ].join('; ') || 'Add an expression or linked points to begin.'}
          </desc>
          <defs>
            <clipPath id={clipId}>
              <rect width={size.width} height={size.height} />
            </clipPath>
          </defs>
          {graph.showGrid && (
            <g className="plot-grid">
              {xTicks.map((x) => (
                <line
                  key={`x${x}`}
                  x1={toPixel({ x, y: 0 }, view, size.width, size.height).x}
                  x2={toPixel({ x, y: 0 }, view, size.width, size.height).x}
                  y1={0}
                  y2={size.height}
                />
              ))}
              {yTicks.map((y) => (
                <line
                  key={`y${y}`}
                  x1={0}
                  x2={size.width}
                  y1={toPixel({ x: 0, y }, view, size.width, size.height).y}
                  y2={toPixel({ x: 0, y }, view, size.width, size.height).y}
                />
              ))}
            </g>
          )}
          <g className="plot-axes">
            {origin.y >= 0 && origin.y <= size.height && (
              <line x1={0} x2={size.width} y1={origin.y} y2={origin.y} />
            )}
            {origin.x >= 0 && origin.x <= size.width && (
              <line x1={origin.x} x2={origin.x} y1={0} y2={size.height} />
            )}
          </g>
          <g className="plot-ticks">
            {xTicks.map((x) => (
              <text
                key={x}
                x={clamp(
                  toPixel({ x, y: 0 }, view, size.width, size.height).x,
                  18,
                  size.width - 23,
                )}
                y={clamp(origin.y + 18, 20, size.height - 10)}
                textAnchor="middle"
              >
                {numberLabel(x)}
              </text>
            ))}
            {yTicks
              .filter((y) => y !== 0)
              .map((y) => (
                <text
                  key={y}
                  x={clamp(origin.x - 10, 36, size.width - 12)}
                  y={clamp(
                    toPixel({ x: 0, y }, view, size.width, size.height).y - 5,
                    14,
                    size.height - 15,
                  )}
                  textAnchor="end"
                >
                  {numberLabel(y)}
                </text>
              ))}
          </g>
          <g clipPath={`url(#${clipId})`}>
            {series.map(({ plot, points }) => (
              <g key={plot.id}>
                {plot.connect && (
                  <path
                    data-testid="linked-outline"
                    d={pointPath(points, view, size.width, size.height, plot.closed)}
                    stroke={plot.color}
                    strokeWidth={2.2}
                    fill="none"
                    strokeLinejoin="round"
                  />
                )}
                {points.map(
                  (point, i) =>
                    point && (
                      <g key={i}>
                        <circle
                          data-testid="linked-point"
                          data-x={point.x}
                          data-y={point.y}
                          cx={toPixel(point, view, size.width, size.height).x}
                          cy={toPixel(point, view, size.width, size.height).y}
                          r={4.5}
                          fill={plot.color}
                          stroke="white"
                          strokeWidth={1.2}
                        >
                          <title>
                            {plot.label} · {point.label} ({numberLabel(point.x)},{' '}
                            {numberLabel(point.y)}) · {point.source}
                          </title>
                        </circle>
                        {graph.showLabels && (
                          <text
                            className="curve-label"
                            x={toPixel(point, view, size.width, size.height).x + 9}
                            y={toPixel(point, view, size.width, size.height).y - 9}
                            fill={plot.color}
                          >
                            {point.label}
                          </text>
                        )}
                      </g>
                    ),
                )}
              </g>
            ))}
            {compiled.points.map((point) => (
              <g key={point.entry.id}>
                <circle
                  data-testid="graph-point"
                  data-x={point.x}
                  data-y={point.y}
                  cx={toPixel(point, view, size.width, size.height).x}
                  cy={toPixel(point, view, size.width, size.height).y}
                  r={5}
                  fill={point.entry.color}
                  stroke="white"
                  strokeWidth={1.2}
                >
                  <title>
                    {point.label}: ({numberLabel(point.x)}, {numberLabel(point.y)})
                  </title>
                </circle>
                {graph.showLabels && (
                  <CurveLabel
                    entry={point.entry}
                    label={point.label}
                    points={[point]}
                    fallback={point}
                    view={view}
                    width={size.width}
                    height={size.height}
                    readOnly={readOnly}
                    onChange={onEntryChange}
                    onEdit={setEditingLabel}
                  />
                )}
              </g>
            ))}
            {curves.map(({ curve, path, label, points }) => (
              <g key={curve.entry.id}>
                <path
                  data-testid="curve"
                  data-formula={curve.entry.formula}
                  data-kind={curve.entry.kind}
                  d={path}
                  stroke={curve.entry.color}
                  strokeWidth={2.2}
                  fill="none"
                  strokeLinejoin="round"
                />
                {graph.showLabels && (
                  <CurveLabel
                    entry={curve.entry}
                    label={curve.label}
                    points={points}
                    fallback={label}
                    view={view}
                    width={size.width}
                    height={size.height}
                    readOnly={readOnly}
                    onChange={onEntryChange}
                    onEdit={setEditingLabel}
                  />
                )}
              </g>
            ))}
          </g>
          {probe && (
            <line className="trace-line" x1={hover!.x} x2={hover!.x} y1={0} y2={size.height} />
          )}
        </svg>
        {!curves.length && !compiled.points.length && !series.length && (
          <div className="plot-empty">
            <span>ƒ</span>
            <strong>
              {Object.keys(compiled.errors).length
                ? 'Let’s check those expressions'
                : 'Give your idea a shape'}
            </strong>
            <p>
              {Object.keys(compiled.errors).length
                ? 'Details beside each row will help you fix it.'
                : 'Try y = sin(x), or load your LaPlace example.'}
            </p>
          </div>
        )}
        {labelEntry && !readOnly && onEntryChange && (
          <LabelManager
            key={labelEntry.id}
            entry={labelEntry}
            onSave={onEntryChange}
            onClose={closeLabel}
          />
        )}
        <div className="plot-controls" role="group" aria-label="Graph view controls">
          <button
            aria-label="Zoom in"
            title="Zoom in"
            disabled={readOnly}
            onClick={() => onView(zoomView(view, 0.8))}
          >
            <Plus size={18} />
          </button>
          <button
            aria-label="Zoom out"
            title="Zoom out"
            disabled={readOnly}
            onClick={() => onView(zoomView(view, 1.25))}
          >
            <Minus size={18} />
          </button>
          <button
            aria-label="Reset graph view"
            title="Reset view"
            disabled={readOnly}
            onClick={() => onView({ ...DEFAULT_VIEW })}
          >
            <Crosshair size={17} />
          </button>
          <button
            aria-label="Set graph bounds"
            title="Set bounds"
            disabled={readOnly}
            aria-expanded={settings}
            onClick={() => {
              setSettings(!settings)
              setBounds([view.xMin, view.xMax, view.yMin, view.yMax].map(String))
              setBoundsError('')
            }}
          >
            <Settings2 size={17} />
          </button>
        </div>
        {settings && (
          <form
            className="bounds-panel"
            aria-label="Graph bounds"
            onSubmit={(event) => {
              event.preventDefault()
              const [xMin, xMax, yMin, yMax] = bounds.map(Number)
              const next = { xMin, xMax, yMin, yMax }
              if (bounds.some((v) => !v.trim()) || !validViewport(next)) {
                setBoundsError('Use finite bounds with each minimum smaller than its maximum.')
                return
              }
              onView(next)
              setSettings(false)
            }}
          >
            <h3>Visible range</h3>
            <div>
              {['x minimum', 'x maximum', 'y minimum', 'y maximum'].map((label, i) => (
                <label key={label}>
                  {label}
                  <input
                    type="number"
                    step="any"
                    required
                    aria-label={label}
                    value={bounds[i]}
                    onChange={(e) =>
                      setBounds(bounds.map((v, j) => (i === j ? e.target.value : v)))
                    }
                  />
                </label>
              ))}
            </div>
            {boundsError && <p role="alert">{boundsError}</p>}
            <button type="button" className="text-button" onClick={() => setSettings(false)}>
              Cancel
            </button>
            <button className="button primary">Apply bounds</button>
          </form>
        )}
      </div>
      <div className="plot-footer">
        <span>
          <Move size={13} />
          {readOnly ? 'Restore this project to edit the graph' : 'Drag to pan · Scroll to zoom'}
        </span>
        <span data-testid="curve-count">
          {rendered} {rendered === 1 ? 'curve' : 'curves'} in view
          {compiled.points.length > 0 && ` · ${compiled.points.length} points`}
          {series.length > 0 &&
            ` · ${series.flatMap((s) => s.points).filter(Boolean).length} linked points`}
        </span>
      </div>
      <div className="trace-readout" aria-label="Graph trace values">
        {probe ? (
          <>
            <strong>x = {numberLabel(probe.x)}</strong>
            {compiled.curves.slice(0, 6).map((curve) => {
              let value = NaN
              try {
                value = curve.evaluate(probe.x)
              } catch {
                /* Complexity is reported beside the plot. */
              }
              return (
                <span key={curve.entry.id}>
                  <i style={{ background: curve.entry.color }} />
                  {curve.label.split('=')[0].trim()}:{' '}
                  {Number.isFinite(value) ? numberLabel(value) : 'outside its domain'}
                </span>
              )
            })}
          </>
        ) : (
          <span>Move over the graph to inspect values.</span>
        )}
      </div>
      {curves.some((c) => c.error) && (
        <div className="plot-warnings" role="status">
          {curves
            .filter((c) => c.error)
            .map((c) => (
              <p key={c.curve.entry.id}>
                {c.curve.label}: {c.error}
              </p>
            ))}
        </div>
      )}
      {series.some((s) => s.errors.length) && (
        <div className="plot-warnings" role="status">
          {series
            .filter((s) => s.errors.length)
            .map((s) => (
              <div key={s.plot.id}>
                <strong>{s.plot.label}: check the spreadsheet coordinates.</strong>
                {s.errors.slice(0, 6).map((e, i) => (
                  <p key={i}>{e}</p>
                ))}
                {s.errors.length > 6 && (
                  <p>{s.errors.length - 6} more rows need valid coordinates.</p>
                )}
              </div>
            ))}
        </div>
      )}
    </section>
  )
}
