import { useContext, useEffect, useRef, useState } from 'react'
import { Check, Copy, Palette, X } from 'lucide-react'
import { DesignerContext, useDesign } from './context'
import { refinementBrief, validDesign } from './model'
import LabelManager from '../graph/LabelManager'
import CurveLabel from '../graph/CurveLabel'
import { newExpression, type PlotEntry } from '../graph/model'

export function DesignerSwitch() {
  const controls = useContext(DesignerContext)
  if (!import.meta.env.DEV || !controls) return null
  return (
    <button
      className={`designer-switch ${controls.enabled ? 'active' : ''}`}
      aria-pressed={controls.enabled}
      aria-label={controls.enabled ? 'Switch to user mode' : 'Enter designer mode'}
      onClick={controls.toggle}
    >
      <Palette size={15} />
      <span>{controls.enabled ? 'Designer mode' : 'User mode'}</span>
      {controls.dirty && <span className="designer-preview-badge">Preview</span>}
    </button>
  )
}

function NumberSetting({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
}) {
  const [text, setText] = useState(String(value))
  useEffect(() => {
    setText(String(value))
  }, [value])
  return (
    <label className="designer-field">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step="any"
        required
        value={text}
        onChange={(event) => {
          setText(event.target.value)
          const n = event.target.valueAsNumber
          if (Number.isFinite(n) && n >= min && n <= max) onChange(n)
        }}
      />
    </label>
  )
}

export default function DesignerPanel() {
  const settings = useDesign()
  const controls = useContext(DesignerContext)!
  const [area, setArea] = useState('Label manager')
  const [request, setRequest] = useState('')
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)
  const requestOutput = useRef<HTMLTextAreaElement>(null)
  const [sample, setSample] = useState<PlotEntry | null>(null)
  const [editingSample, setEditingSample] = useState(true)
  const labels = (patch: Partial<typeof settings.labels>) =>
    controls.update({ ...settings, labels: { ...settings.labels, ...patch } })
  const graph = (patch: Partial<typeof settings.graph>) =>
    controls.update({ ...settings, graph: { ...settings.graph, ...patch } })
  const theme = (patch: Partial<typeof settings.theme>) =>
    controls.update({ ...settings, theme: { ...settings.theme, ...patch } })
  const brief = refinementBrief(area, request)
  async function copyRequest() {
    try {
      await navigator.clipboard.writeText(brief)
      setCopied(true)
      setCopyError(false)
    } catch {
      setCopyError(true)
      setTimeout(() => requestOutput.current?.select(), 0)
    }
  }
  function downloadPreview() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(settings, null, 2) + '\n'], { type: 'application/json' }),
    )
    const link = document.createElement('a')
    link.href = url
    link.download = 'junga-design-preview.json'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return (
    <>
      <aside className="designer-panel" aria-label="Designer controls">
        <header className="designer-heading">
          <div>
            <span className="designer-eyebrow">DESIGN STUDIO</span>
            <h2>Refine the workspace</h2>
          </div>
          <button
            className="icon-button"
            aria-label="Close designer controls"
            onClick={controls.toggle}
          >
            <X size={18} />
          </button>
        </header>
        <p className="designer-intro">
          Try a change, view it in user mode, then save the design when it feels right.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void controls.save()
          }}
        >
          <fieldset disabled={controls.busy || !controls.ready}>
            <label className="designer-field">
              <span>Refinement area</span>
              <select
                value={area}
                onChange={(e) => {
                  setArea(e.target.value)
                  setCopied(false)
                }}
              >
                <option>Label manager</option>
                <option>Graph layout</option>
                <option>Shared appearance</option>
              </select>
            </label>
            {area === 'Label manager' && (
              <div className="designer-section">
                <label className="designer-field">
                  <span>Popup title</span>
                  <input
                    value={settings.labels.title}
                    maxLength={40}
                    required
                    onChange={(e) => labels({ title: e.target.value })}
                  />
                </label>
                <label className="designer-field">
                  <span>Angle control</span>
                  <select
                    value={settings.labels.angleControl}
                    onChange={(e) =>
                      labels({ angleControl: e.target.value as 'number' | 'dropdown' })
                    }
                  >
                    <option value="number">Typed number</option>
                    <option value="dropdown">Dropdown</option>
                  </select>
                </label>
                <label className="designer-field">
                  <span>Rotation step</span>
                  <select
                    value={settings.labels.angleStep}
                    onChange={(e) => labels({ angleStep: Number(e.target.value) })}
                  >
                    {[1, 5, 10, 15, 30, 45, 90].map((n) => (
                      <option key={n} value={n}>
                        {n}°
                      </option>
                    ))}
                  </select>
                </label>
                <p className="designer-hint">
                  Used by the rotation buttons and dropdown. Typed angles can include decimals.
                </p>
                <label className="designer-field">
                  <span>Size control</span>
                  <select
                    value={settings.labels.sizeControl}
                    onChange={(e) => labels({ sizeControl: e.target.value as 'slider' | 'number' })}
                  >
                    <option value="slider">Slider</option>
                    <option value="number">Typed number</option>
                  </select>
                </label>
                <NumberSetting
                  label="Default label size (px)"
                  value={settings.labels.defaultSize}
                  min={8}
                  max={36}
                  onChange={(defaultSize) => labels({ defaultSize })}
                />
                <NumberSetting
                  label="Popup width (px)"
                  value={settings.labels.width}
                  min={240}
                  max={420}
                  onChange={(width) => labels({ width })}
                />
                <NumberSetting
                  label="Popup padding (px)"
                  value={settings.labels.padding}
                  min={8}
                  max={28}
                  onChange={(padding) => labels({ padding })}
                />
                <NumberSetting
                  label="Label offset right (px)"
                  value={settings.labels.offsetX}
                  min={-30}
                  max={40}
                  onChange={(offsetX) => labels({ offsetX })}
                />
                <NumberSetting
                  label="Label offset above (px)"
                  value={settings.labels.offsetY}
                  min={-30}
                  max={40}
                  onChange={(offsetY) => labels({ offsetY })}
                />
                <p className="designer-hint">
                  Default size applies to labels without a saved style. Existing custom label styles
                  stay as you set them.
                </p>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => {
                    setSample({ ...newExpression('y=x'), label: 'Sample curve' })
                    setEditingSample(true)
                  }}
                >
                  Preview label manager
                </button>
              </div>
            )}
            {area === 'Graph layout' && (
              <div className="designer-section">
                <NumberSetting
                  label="Expression panel width (px)"
                  value={settings.graph.panelWidth}
                  min={250}
                  max={440}
                  onChange={(panelWidth) => graph({ panelWidth })}
                />
                <NumberSetting
                  label="Formula text size (px)"
                  value={settings.graph.formulaSize}
                  min={12}
                  max={24}
                  onChange={(formulaSize) => graph({ formulaSize })}
                />
                <p className="designer-hint">
                  Open a graph to preview these changes. Narrow screens keep the stacked layout.
                </p>
              </div>
            )}
            {area === 'Shared appearance' && (
              <div className="designer-section">
                <label className="designer-field">
                  <span>Accent color</span>
                  <input
                    type="color"
                    value={settings.theme.accent}
                    onChange={(e) => theme({ accent: e.target.value })}
                  />
                </label>
                <label className="designer-field">
                  <span>Sidebar color</span>
                  <input
                    type="color"
                    value={settings.theme.sidebar}
                    onChange={(e) => theme({ sidebar: e.target.value })}
                  />
                </label>
                <NumberSetting
                  label="Button corner radius (px)"
                  value={settings.theme.buttonRadius}
                  min={0}
                  max={24}
                  onChange={(buttonRadius) => theme({ buttonRadius })}
                />
                <p className="designer-hint">Check text readability when changing colors.</p>
              </div>
            )}
            <div className="designer-actions">
              <button
                className="button primary"
                disabled={!controls.dirty || !validDesign(settings)}
              >
                {controls.busy ? 'Saving…' : 'Save design'}
              </button>
              <button
                type="button"
                className="button secondary"
                disabled={!controls.dirty}
                onClick={controls.revert}
              >
                Revert preview
              </button>
            </div>
          </fieldset>
        </form>
        <p className="designer-save-state">
          {controls.dirty
            ? 'Unsaved design preview · visible in both modes'
            : 'Using saved design settings'}
        </p>
        <p className="designer-message" role="status">
          {controls.message}
        </p>
        <div className="designer-file-actions">
          <button type="button" disabled={controls.busy} onClick={() => void controls.reload()}>
            Discard preview & load saved
          </button>
          <button type="button" onClick={downloadPreview}>
            Download preview
          </button>
        </div>
        <section className="designer-request" aria-label="Request a small change">
          <h3>Need a small code change?</h3>
          <p>Describe it here, then copy the focused request into your agent task.</p>
          <label className="designer-field">
            <span>Refinement note</span>
            <textarea
              rows={3}
              maxLength={1200}
              placeholder="For example: put the rotation buttons below the angle field."
              value={request}
              onChange={(e) => {
                setRequest(e.target.value)
                setCopied(false)
              }}
            />
          </label>
          <button
            className="button secondary"
            disabled={!request.trim()}
            onClick={() => void copyRequest()}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Request copied' : 'Copy request for agent'}
          </button>
          {copyError && (
            <label className="designer-field">
              <span>Copy this request manually</span>
              <textarea ref={requestOutput} readOnly value={brief} rows={5} />
            </label>
          )}
          <p className="designer-hint">Copying prepares the request. It does not start an agent.</p>
        </section>
        <footer className="designer-footer">
          Local development only · Saved in <code>Design/settings.json</code>
        </footer>
      </aside>
      {sample && (
        <section className="designer-sample" aria-label="Label design preview">
          <header>
            <div>
              <strong>Label preview</strong>
              <p>Try the real controls on a sample.</p>
            </div>
            <button
              className="icon-button"
              aria-label="Close label preview"
              onClick={() => setSample(null)}
            >
              <X size={18} />
            </button>
          </header>
          <svg viewBox="0 0 400 220" aria-label="Sample curve" role="group">
            <path d="M0 210 L400 10" stroke={sample.color} strokeWidth="2" fill="none" />
            <CurveLabel
              entry={sample}
              label={sample.label}
              points={[
                { x: -4, y: -4 },
                { x: 4, y: 4 },
              ]}
              fallback={{ x: 0, y: 0 }}
              view={{ xMin: -4, xMax: 4, yMin: -4.4, yMax: 4.4 }}
              width={400}
              height={220}
              readOnly={false}
              onChange={setSample}
              onEdit={() => setEditingSample(true)}
            />
          </svg>
          <div className="designer-sample-manager">
            {editingSample ? (
              <LabelManager
                entry={sample}
                onSave={setSample}
                onClose={() => setEditingSample(false)}
              />
            ) : (
              <button className="button secondary" onClick={() => setEditingSample(true)}>
                Edit sample label
              </button>
            )}
          </div>
        </section>
      )}
    </>
  )
}
