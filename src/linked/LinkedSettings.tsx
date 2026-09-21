import { useState } from 'react'
import { COLORS, validGraph, type GraphDocument, type SheetPlot } from '../graph/model'
import { validSheet, type SheetDocument, type CellSlider } from '../sheet/model'

export default function LinkedSettings({
  sheet,
  graph,
  onApply,
  onClose,
}: {
  sheet: SheetDocument
  graph: GraphDocument
  onApply: (sheet: SheetDocument, graph: GraphDocument) => boolean
  onClose: () => void
}) {
  const [names, setNames] = useState(
    Object.entries(sheet.names ?? {})
      .map(([n, ref]) => `${n} = ${ref}`)
      .join('\n'),
  )
  const [sliders, setSliders] = useState(
    (sheet.sliders ?? []).map((s) => ({
      ...s,
      min: String(s.min),
      max: String(s.max),
      step: String(s.step),
    })),
  )
  const [plots, setPlots] = useState(graph.sheetPlots ?? [])
  const [error, setError] = useState('')
  const updatePlot = (id: string, fields: Partial<SheetPlot>) =>
    setPlots(plots.map((p) => (p.id === id ? { ...p, ...fields } : p)))
  return (
    <form
      className="linked-settings"
      aria-label="Spreadsheet graph links"
      onSubmit={(e) => {
        e.preventDefault()
        try {
          const entries = names
            .split('\n')
            .filter((line) => line.trim())
            .map((line) => {
              const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([A-Za-z]+[1-9]\d*)\s*$/)
              if (!match) throw new Error('Use one name = cell per line, such as s = B2.')
              return [match[1], match[2].toUpperCase()]
            })
          if (new Set(entries.map(([n]) => n.toUpperCase())).size !== entries.length)
            throw new Error('Each cell name must be unique.')
          const nextSheet = {
            ...sheet,
            names: Object.fromEntries(entries),
            sliders: sliders.map((s) => ({
              ...s,
              cell: s.cell.trim().toUpperCase(),
              min: Number(s.min),
              max: Number(s.max),
              step: Number(s.step),
            })),
          }
          const nextGraph = {
            ...graph,
            sheetPlots: plots.map((p) => ({
              ...p,
              xRange: p.xRange.trim().toUpperCase(),
              yRange: p.yRange.trim().toUpperCase(),
            })),
          }
          if (!validSheet(nextSheet))
            throw new Error(
              'Use unique names and slider cells inside this sheet. Sliders need finite limits with minimum < maximum and a positive step. Names cannot be cell addresses, TRUE, or FALSE.',
            )
          if (!validGraph(nextGraph))
            throw new Error(
              'Each plot needs equally sized x and y ranges in one row or column, within A1:Z200.',
            )
          if (onApply(nextSheet, nextGraph)) onClose()
          else
            setError(
              'These changes are kept on this page but could not be saved. Retry when storage is available, or download your unsaved work.',
            )
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Check the link settings.')
        }
      }}
    >
      <div className="linked-settings-heading">
        <h2>Connect cells to the graph</h2>
        <button type="button" className="text-button" onClick={onClose}>
          Close link settings
        </button>
      </div>
      <div className="linked-settings-columns">
        <section>
          <h3>Named cells</h3>
          <label>
            Names and cell addresses
            <textarea
              rows={5}
              value={names}
              onChange={(e) => setNames(e.target.value)}
              placeholder={'s = B2\nh = B3\nt = B4'}
            />
          </label>
          <p>
            Use these names in spreadsheet formulas, for example <code>=SQRT(3)*s/2</code>. Names
            refer to cells in this project.
          </p>
        </section>
        <section>
          <h3>Cell sliders</h3>
          <p>A slider changes a numeric input cell. Formula cells remain derived.</p>
          {sliders.map((s, i) => (
            <fieldset key={s.id}>
              <legend>Slider {i + 1}</legend>
              <div className="link-fields">
                {(['label', 'cell', 'min', 'max', 'step'] as const).map((field) => (
                  <label key={field}>
                    {
                      {
                        label: 'Label',
                        cell: 'Cell',
                        min: 'Minimum',
                        max: 'Maximum',
                        step: 'Step',
                      }[field]
                    }
                    <input
                      required
                      maxLength={field === 'label' ? 40 : undefined}
                      type={['min', 'max', 'step'].includes(field) ? 'number' : 'text'}
                      step="any"
                      aria-label={`Slider ${i + 1} ${field}`}
                      value={s[field]}
                      onChange={(e) =>
                        setSliders(
                          sliders.map((v) =>
                            v.id === s.id ? { ...v, [field]: e.target.value } : v,
                          ),
                        )
                      }
                    />
                  </label>
                ))}
              </div>
              <button
                type="button"
                className="text-button"
                onClick={() => setSliders(sliders.filter((v) => v.id !== s.id))}
              >
                Remove slider {i + 1}
              </button>
            </fieldset>
          ))}
          <button
            type="button"
            className="button secondary"
            disabled={sliders.length >= 12}
            onClick={() =>
              setSliders([
                ...sliders,
                {
                  id: crypto.randomUUID(),
                  label: 't',
                  cell: 'B4',
                  min: '0',
                  max: '1',
                  step: '0.001',
                },
              ])
            }
          >
            Add cell slider
          </button>
        </section>
        <section>
          <h3>Point series</h3>
          <p>Pair each x cell with the corresponding y cell. Lines follow the row order.</p>
          {plots.map((p, i) => (
            <fieldset key={p.id}>
              <legend>Series {i + 1}</legend>
              <div className="link-fields">
                <label>
                  Label
                  <input
                    required
                    maxLength={60}
                    aria-label={`Series ${i + 1} label`}
                    value={p.label}
                    onChange={(e) => updatePlot(p.id, { label: e.target.value })}
                  />
                </label>
                <label>
                  x cells
                  <input
                    required
                    aria-label={`Series ${i + 1} x cells`}
                    value={p.xRange}
                    onChange={(e) => updatePlot(p.id, { xRange: e.target.value })}
                  />
                </label>
                <label>
                  y cells
                  <input
                    required
                    aria-label={`Series ${i + 1} y cells`}
                    value={p.yRange}
                    onChange={(e) => updatePlot(p.id, { yRange: e.target.value })}
                  />
                </label>
                <label>
                  Color
                  <select
                    aria-label={`Series ${i + 1} color`}
                    value={p.color}
                    onChange={(e) => updatePlot(p.id, { color: e.target.value })}
                  >
                    {COLORS.map((color, j) => (
                      <option key={color} value={color}>
                        {['Green', 'Red', 'Blue', 'Purple', 'Gold', 'Teal'][j]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="link-checks">
                {(['visible', 'connect', 'closed'] as const).map((field) => (
                  <label key={field}>
                    <input
                      type="checkbox"
                      aria-label={`Series ${i + 1} ${field}`}
                      checked={p[field]}
                      onChange={(e) => updatePlot(p.id, { [field]: e.target.checked })}
                    />
                    {
                      { visible: 'Visible', connect: 'Connect points', closed: 'Close outline' }[
                        field
                      ]
                    }
                  </label>
                ))}
              </div>
              <button
                type="button"
                className="text-button"
                onClick={() => setPlots(plots.filter((v) => v.id !== p.id))}
              >
                Remove series {i + 1}
              </button>
            </fieldset>
          ))}
          <button
            type="button"
            className="button secondary"
            disabled={plots.length >= 8}
            onClick={() =>
              setPlots([
                ...plots,
                {
                  id: crypto.randomUUID(),
                  label: `Series ${plots.length + 1}`,
                  xRange: 'A1:A6',
                  yRange: 'B1:B6',
                  color: COLORS[plots.length % COLORS.length],
                  visible: true,
                  connect: false,
                  closed: false,
                },
              ])
            }
          >
            Add point series
          </button>
        </section>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="button primary">Apply links</button>
    </form>
  )
}

export function sliderState(sheet: SheetDocument, slider: CellSlider, value: unknown) {
  const formula = sheet.cells[slider.cell]?.input.trimStart().startsWith('=')
  const valid = typeof value === 'number' && Number.isFinite(value)
  return {
    disabled: formula || !valid,
    value: valid ? Math.min(slider.max, Math.max(slider.min, value)) : slider.min,
    error: formula
      ? `${slider.cell} contains a formula. Choose a numeric input cell for this slider.`
      : !valid
        ? `Enter a number in ${slider.cell} to use this slider.`
        : value < slider.min || value > slider.max
          ? `${slider.cell} is outside the slider limits. Move the slider to return it to range.`
          : '',
  }
}
