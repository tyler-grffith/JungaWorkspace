import { useMemo, useState } from 'react'
import { ArrowLeft, SlidersHorizontal } from 'lucide-react'
import type { GraphDocument } from '../graph/model'
import { compileGraph } from '../graph/engine'
import { numberLabel } from '../graph/plot'
import GraphPlot from '../graph/GraphPlot'
import SheetEditor from '../sheet/SheetEditor'
import { calculateSheet } from '../sheet/engine'
import { writeCells, type SheetDocument } from '../sheet/model'
import { fitPoints, resolveSheetPlots } from './model'
import LinkedSettings, { sliderState } from './LinkedSettings'
import '../graph/graph.css'
import './linked.css'

export default function LinkedWorkspace({
  title,
  sheet,
  graph,
  readOnly,
  sheetUnsaved,
  graphUnsaved,
  onSheetChange,
  onGraphChange,
  onConfigure,
  onEditingChange,
  onBack,
}: {
  title: string
  sheet: SheetDocument
  graph: GraphDocument
  readOnly: boolean
  sheetUnsaved: boolean
  graphUnsaved: boolean
  onSheetChange: (sheet: SheetDocument) => boolean
  onGraphChange: (graph: GraphDocument) => boolean
  onConfigure: (sheet: SheetDocument, graph: GraphDocument) => boolean
  onEditingChange: (edit: { ref: string; value: string } | null) => void
  onBack: () => void
}) {
  const [settings, setSettings] = useState(false)
  const results = useMemo(() => calculateSheet(sheet), [sheet])
  const series = useMemo(
    () => resolveSheetPlots(graph, sheet, results),
    [graph.sheetPlots, sheet, results],
  )
  const compiled = useMemo(() => compileGraph(graph), [graph.entries])
  const fit = fitPoints(series)
  return (
    <div className="linked-workspace">
      <header className="linked-heading">
        <div>
          <button className="back-link" onClick={onBack}>
            <ArrowLeft size={14} />
            Project overview
          </button>
          <div className="eyebrow">SPREADSHEET + GRAPH</div>
          <h1>{title}</h1>
        </div>
        <button
          className="button secondary"
          disabled={readOnly}
          aria-expanded={settings}
          onClick={() => setSettings(!settings)}
        >
          <SlidersHorizontal size={16} />
          Link settings
        </button>
      </header>
      {readOnly && (
        <div className="state-banner">
          This project is in the trash. Restore it to edit its spreadsheet or graph.
        </div>
      )}
      {settings && (
        <LinkedSettings
          sheet={sheet}
          graph={graph}
          onApply={onConfigure}
          onClose={() => setSettings(false)}
        />
      )}
      <section className="linked-controls" aria-label="Model controls">
        <div className="linked-values">
          {Object.entries(sheet.names ?? {})
            .filter(([, ref]) => !(sheet.sliders ?? []).some((s) => s.cell === ref))
            .map(([name, ref]) => (
              <div key={name}>
                <span>
                  {name} <small>· {ref}</small>
                </span>
                <strong>
                  {results[ref]?.error
                    ? results[ref].code
                    : typeof results[ref]?.value === 'number'
                      ? numberLabel(results[ref].value)
                      : String(results[ref]?.value ?? '—')}
                </strong>
                <small>
                  {sheet.cells[ref]?.input.trimStart().startsWith('=')
                    ? 'Calculated'
                    : 'Constant · edit in sheet'}
                </small>
              </div>
            ))}
        </div>
        {(sheet.sliders ?? []).map((s) => {
          const value = results[s.cell]?.value,
            state = sliderState(sheet, s, value)
          return (
            <div className="linked-slider" key={s.id}>
              <div>
                <label htmlFor={`slider-${s.id}`}>
                  {s.label} <small>· {s.cell}</small>
                </label>
                <output>{typeof value === 'number' ? numberLabel(value) : '—'}</output>
              </div>
              <input
                id={`slider-${s.id}`}
                type="range"
                aria-label={`Slider ${s.label}`}
                min={s.min}
                max={s.max}
                step={s.step}
                value={state.value}
                disabled={readOnly || state.disabled}
                onChange={(e) =>
                  onSheetChange(
                    writeCells(sheet, {
                      [s.cell]: { ...sheet.cells[s.cell], input: String(Number(e.target.value)) },
                    }),
                  )
                }
              />
              <div className="linked-slider-limits">
                <span>{s.min}</span>
                <span>{s.max}</span>
              </div>
              {state.error && <p role="status">{state.error}</p>}
            </div>
          )
        })}
        {!(sheet.sliders?.length || Object.keys(sheet.names ?? {}).length) && (
          <p>Use Link settings to name cells, add sliders, and plot coordinate ranges.</p>
        )}
      </section>
      <div className="linked-panes">
        <section className="linked-sheet" aria-label="Linked spreadsheet">
          <SheetEditor
            embedded
            title={title}
            sheet={sheet}
            readOnly={readOnly}
            unsaved={sheetUnsaved}
            onChange={onSheetChange}
            onEditingChange={onEditingChange}
            onBack={onBack}
          />
        </section>
        <section className="linked-graph" aria-label="Linked graph">
          <div className="linked-graph-heading">
            <h2>Graph</h2>
            <button
              className="button secondary"
              disabled={readOnly || !fit}
              onClick={() => fit && onGraphChange({ ...graph, viewport: fit })}
            >
              Fit points
            </button>
          </div>
          <div className="graph-display-options">
            <label>
              <input
                type="checkbox"
                checked={graph.showGrid}
                disabled={readOnly}
                onChange={(e) => onGraphChange({ ...graph, showGrid: e.target.checked })}
              />
              Grid
            </label>
            <label>
              <input
                type="checkbox"
                checked={graph.showLabels}
                disabled={readOnly}
                onChange={(e) => onGraphChange({ ...graph, showLabels: e.target.checked })}
              />
              Point / curve labels
            </label>
          </div>
          {graphUnsaved && (
            <div className="unsaved-note" role="status">
              <span>Graph changes not saved.</span>
              <button className="button secondary" onClick={() => onGraphChange(graph)}>
                Retry saving graph
              </button>
            </div>
          )}
          <GraphPlot
            graph={graph}
            compiled={compiled}
            series={series}
            readOnly={readOnly}
            onEntryChange={(entry) =>
              onGraphChange({
                ...graph,
                entries: graph.entries.map((e) => (e.id === entry.id ? entry : e)),
              })
            }
            onView={(viewport) => onGraphChange({ ...graph, viewport })}
          />
          <div className="linked-legend">
            {series.map((s) => (
              <div key={s.plot.id}>
                <i style={{ background: s.plot.color }} />
                <strong>{s.plot.label}</strong>
                <span>
                  x: {s.plot.xRange} · y: {s.plot.yRange}
                </span>
              </div>
            ))}
            {!series.length && (
              <p>Connect x and y cell ranges in Link settings to plot your spreadsheet.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
