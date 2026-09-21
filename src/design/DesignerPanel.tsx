import { useContext, useEffect, useRef, useState } from 'react'
import { Check, Copy, Palette, X } from 'lucide-react'
import { DesignerContext, useDesign } from './context'
import {
  designGroups,
  groupIds,
  refinementBrief,
  validDesign,
  type DesignSettings,
  type Field,
  type GroupId,
} from './model'
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

/** One control per registry field kind. Labels come from the registry. */
function FieldControl({
  field,
  value,
  onChange,
}: {
  field: Field
  value: unknown
  onChange: (value: unknown) => void
}) {
  const help = field.help && <p className="designer-hint">{field.help}</p>
  if (field.kind === 'number')
    return (
      <>
        <NumberSetting
          label={field.label}
          value={value as number}
          min={field.min}
          max={field.max}
          onChange={onChange}
        />
        {help}
      </>
    )
  if (field.kind === 'toggle')
    return (
      <>
        <label className="designer-field designer-toggle">
          <input
            type="checkbox"
            checked={value as boolean}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span>{field.label}</span>
        </label>
        {help}
      </>
    )
  return (
    <>
      <label className="designer-field">
        <span>{field.label}</span>
        {field.kind === 'select' ? (
          <select
            value={String(value)}
            onChange={(e) =>
              onChange(
                field.options.find((option) => String(option.value) === e.target.value)!.value,
              )
            }
          >
            {field.options.map((option) => (
              <option key={String(option.value)} value={String(option.value)}>
                {option.label}
              </option>
            ))}
          </select>
        ) : field.kind === 'color' ? (
          <input type="color" value={value as string} onChange={(e) => onChange(e.target.value)} />
        ) : (
          <input
            value={value as string}
            maxLength={field.maxLength}
            required
            onChange={(e) => onChange(e.target.value)}
          />
        )}
      </label>
      {help}
    </>
  )
}

export default function DesignerPanel() {
  const settings = useDesign()
  const controls = useContext(DesignerContext)!
  const [area, setArea] = useState<GroupId>('labels')
  const [request, setRequest] = useState('')
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)
  const requestOutput = useRef<HTMLTextAreaElement>(null)
  const [sample, setSample] = useState<PlotEntry | null>(null)
  const [editingSample, setEditingSample] = useState(true)
  const group = designGroups[area]
  const values = settings[area] as Record<string, unknown>
  const setField = (key: string, value: unknown) =>
    controls.update({ ...settings, [area]: { ...values, [key]: value } } as DesignSettings)
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
                  setArea(e.target.value as GroupId)
                  setCopied(false)
                }}
              >
                {groupIds.map((id) => (
                  <option key={id} value={id}>
                    {designGroups[id].title}
                  </option>
                ))}
              </select>
            </label>
            <div className="designer-section" key={area}>
              <p className="designer-hint">{group.description}</p>
              {Object.entries(group.fields as Record<string, Field>).map(([key, field]) => (
                <FieldControl
                  key={key}
                  field={field}
                  value={values[key]}
                  onChange={(value) => setField(key, value)}
                />
              ))}
              {area === 'labels' && (
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
              )}
            </div>
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
          Local development only · Saved in <code>Design/settings.json</code> · Fields in{' '}
          <code>src/design/registry.ts</code>
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
