// The inspector: properties of the selection, or of the canvas and page when nothing is
// selected. Every control edits the document through the callbacks the editor passes in.
import { useEffect, useState, type ReactNode } from 'react'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  AlignVerticalJustifyCenter,
  ArrowDownToLine,
  ArrowUpToLine,
  Bold,
  BringToFront,
  Group,
  Italic,
  Lock,
  SendToBack,
  Trash2,
  Underline,
  Ungroup,
  Unlock,
} from 'lucide-react'
import {
  FONTS,
  MODE_HELP,
  MODE_LABELS,
  PAGE_PRESETS,
  isColor,
  isPaint,
  type ArrowHead,
  type CanvasDocument,
  type CanvasElement,
  type CanvasMode,
  type Keyframe,
  type Page,
  type Paint,
  type Stroke,
  type TextStyle,
} from './model'
import { parseGradient } from './render'

type Props = {
  document: CanvasDocument
  page: Page
  selection: CanvasElement[]
  readOnly: boolean
  time: number
  onDocument: (next: CanvasDocument, record?: boolean) => boolean
  onPage: (change: (page: Page) => Page) => boolean
  onSelected: (change: (element: CanvasElement) => CanvasElement) => boolean
  onSelect: (ids: string[]) => void
  onReorder: (direction: 'front' | 'back' | 'forward' | 'backward') => void
  onGroup: () => void
  onUngroup: () => void
  onAlign: (kind: 'left' | 'centerX' | 'right' | 'top' | 'centerY' | 'bottom') => void
  onEditText: () => void
  onFit: () => void
}

/** A number input that commits on blur or Enter, so typing does not create undo steps. */
export function NumberField({
  label,
  value,
  onCommit,
  min,
  max,
  step = 1,
  disabled = false,
}: {
  label: string
  value: number
  onCommit: (value: number) => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
}) {
  const shown = Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '')
  const [text, setText] = useState(shown)
  useEffect(() => setText(shown), [shown])
  const commit = () => {
    const n = Number(text)
    if (!Number.isFinite(n) || text.trim() === '') {
      setText(shown)
      return
    }
    const clamped = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n))
    if (clamped !== value) onCommit(clamped)
    else setText(shown)
  }
  return (
    <label>
      {label}
      <input
        type="number"
        inputMode="decimal"
        value={text}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          e.stopPropagation()
        }}
      />
    </label>
  )
}
function TextField({
  label,
  value,
  onCommit,
  disabled = false,
  multiline = false,
  maxLength = 100,
}: {
  label: string
  value: string
  onCommit: (value: string) => void
  disabled?: boolean
  multiline?: boolean
  maxLength?: number
}) {
  const [text, setText] = useState(value)
  useEffect(() => setText(value), [value])
  const commit = () => {
    if (text !== value) onCommit(text)
  }
  return (
    <label>
      {label}
      {multiline ? (
        <textarea
          rows={3}
          value={text}
          maxLength={maxLength}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.stopPropagation()}
        />
      ) : (
        <input
          type="text"
          value={text}
          maxLength={maxLength}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            e.stopPropagation()
          }}
        />
      )}
    </label>
  )
}
/** Color, none, or a two-stop gradient, all stored as one paint string. */
export function PaintField({
  label,
  value,
  onCommit,
  allowNone = true,
  allowGradient = true,
  disabled = false,
}: {
  label: string
  value: Paint
  onCommit: (value: Paint) => void
  allowNone?: boolean
  allowGradient?: boolean
  disabled?: boolean
}) {
  const gradient = parseGradient(value)
  const solid = gradient ? gradient.from : isColor(value) ? value.slice(0, 7) : '#ffffff'
  const [text, setText] = useState(value)
  useEffect(() => setText(value), [value])
  return (
    <label>
      {label}
      <span className="paint-field">
        {allowNone && (
          <button
            type="button"
            className={`paint-none ${value === 'none' ? 'active' : ''}`}
            aria-label={`${label}: none`}
            title="None"
            disabled={disabled}
            onClick={() => onCommit('none')}
          />
        )}
        <input
          type="color"
          aria-label={`${label} color`}
          value={solid}
          disabled={disabled}
          onChange={(e) =>
            onCommit(
              gradient
                ? `gradient(${gradient.angle},${e.target.value},${gradient.to})`
                : e.target.value,
            )
          }
        />
        <input
          type="text"
          aria-label={`${label} value`}
          value={text}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => (isPaint(text) ? onCommit(text) : setText(value))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            e.stopPropagation()
          }}
        />
      </span>
      {allowGradient && (
        <span className="paint-field">
          <label className="inline">
            <input
              type="checkbox"
              checked={!!gradient}
              disabled={disabled}
              onChange={(e) =>
                onCommit(e.target.checked ? `gradient(180,${solid},#ffffff)` : solid)
              }
            />
            Gradient
          </label>
          {gradient && (
            <>
              <input
                type="color"
                aria-label={`${label} gradient end color`}
                value={gradient.to}
                disabled={disabled}
                onChange={(e) =>
                  onCommit(`gradient(${gradient.angle},${gradient.from},${e.target.value})`)
                }
              />
              <input
                type="number"
                aria-label={`${label} gradient angle`}
                min={0}
                max={360}
                value={gradient.angle}
                disabled={disabled}
                onChange={(e) =>
                  onCommit(
                    `gradient(${Math.max(0, Math.min(360, Number(e.target.value) || 0))},${gradient.from},${gradient.to})`,
                  )
                }
                onKeyDown={(e) => e.stopPropagation()}
              />
            </>
          )}
        </span>
      )}
    </label>
  )
}
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <h2>{title}</h2>
      {children}
    </>
  )
}

export default function Inspector(props: Props) {
  const { document: doc, page, selection, readOnly, time } = props
  const single = selection.length === 1 ? selection[0] : null
  const textStyle: TextStyle | null = single && 'textStyle' in single ? single.textStyle : null
  const setText = (change: Partial<TextStyle>) =>
    props.onSelected((e) =>
      'textStyle' in e ? { ...e, textStyle: { ...e.textStyle, ...change } } : e,
    )
  const setStroke = (change: Partial<Stroke>) =>
    props.onSelected((e) => ('stroke' in e ? { ...e, stroke: { ...e.stroke, ...change } } : e))
  const strokeOf = selection.find((e) => 'stroke' in e)
  const fillOf = selection.find((e) => 'fill' in e)
  const preset = PAGE_PRESETS.find(
    (p) =>
      p.size.width === doc.page.width &&
      p.size.height === doc.page.height &&
      p.size.infinite === doc.page.infinite,
  )

  if (!selection.length) {
    return (
      <aside className="canvas-inspector" aria-label="Canvas settings">
        <Section title="Canvas">
          <div className="inspector-row single">
            <label>
              Mode
              <select
                value={doc.mode}
                disabled={readOnly}
                onChange={(e) => props.onDocument({ ...doc, mode: e.target.value as CanvasMode })}
              >
                {(Object.keys(MODE_LABELS) as CanvasMode[]).map((mode) => (
                  <option key={mode} value={mode}>
                    {MODE_LABELS[mode]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="inspector-hint">{MODE_HELP[doc.mode]}</p>
          <div className="inspector-row single">
            <label>
              Canvas size
              <select
                value={preset?.id ?? 'custom'}
                disabled={readOnly}
                onChange={(e) => {
                  const chosen = PAGE_PRESETS.find((p) => p.id === e.target.value)
                  if (chosen && props.onDocument({ ...doc, page: { ...chosen.size } }))
                    props.onFit()
                }}
              >
                {PAGE_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
                <option value="custom">Custom size</option>
              </select>
            </label>
          </div>
          <div className="inspector-row">
            <NumberField
              label="Width"
              value={doc.page.width}
              min={16}
              max={20000}
              disabled={readOnly}
              onCommit={(width) =>
                props.onDocument({ ...doc, page: { ...doc.page, width } }) && props.onFit()
              }
            />
            <NumberField
              label="Height"
              value={doc.page.height}
              min={16}
              max={20000}
              disabled={readOnly}
              onCommit={(height) =>
                props.onDocument({ ...doc, page: { ...doc.page, height } }) && props.onFit()
              }
            />
          </div>
          <label className="inline">
            <input
              type="checkbox"
              checked={doc.page.infinite}
              disabled={readOnly}
              onChange={(e) =>
                props.onDocument({ ...doc, page: { ...doc.page, infinite: e.target.checked } })
              }
            />
            Unbounded canvas (no page edge)
          </label>
          <div className="inspector-row" style={{ marginTop: 8 }}>
            <NumberField
              label="Grid size"
              value={doc.grid.size}
              min={1}
              max={500}
              disabled={readOnly}
              onCommit={(size) => props.onDocument({ ...doc, grid: { ...doc.grid, size } }, false)}
            />
          </div>
        </Section>
        <Section
          title={`This ${doc.mode === 'deck' ? 'slide' : doc.mode === 'mockup' ? 'screen' : doc.mode === 'board' ? 'board' : 'scene'}`}
        >
          <div className="inspector-row single">
            <TextField
              label="Name"
              value={page.name}
              disabled={readOnly}
              onCommit={(name) => props.onPage((p) => ({ ...p, name }))}
            />
          </div>
          <div className="inspector-row single">
            <PaintField
              label="Background"
              value={page.background}
              allowNone={false}
              disabled={readOnly}
              onCommit={(background) => props.onPage((p) => ({ ...p, background }))}
            />
          </div>
          {doc.mode === 'deck' && (
            <div className="inspector-row single">
              <label>
                Transition
                <select
                  value={page.transition}
                  disabled={readOnly}
                  onChange={(e) =>
                    props.onPage((p) => ({
                      ...p,
                      transition: e.target.value as Page['transition'],
                    }))
                  }
                >
                  <option value="none">None</option>
                  <option value="fade">Fade</option>
                  <option value="slide">Slide</option>
                </select>
              </label>
            </div>
          )}
          {doc.mode === 'animation' && (
            <div className="inspector-row">
              <NumberField
                label="Duration (s)"
                value={page.duration}
                min={0.1}
                max={600}
                step={0.5}
                disabled={readOnly}
                onCommit={(duration) => props.onPage((p) => ({ ...p, duration }))}
              />
            </div>
          )}
          <div className="inspector-row single">
            <TextField
              label="Notes"
              value={page.notes}
              multiline
              maxLength={20000}
              disabled={readOnly}
              onCommit={(notes) => props.onPage((p) => ({ ...p, notes }))}
            />
          </div>
          <p className="inspector-hint">
            {page.elements.length} {page.elements.length === 1 ? 'element' : 'elements'} on this
            canvas. Click one to edit it; drag on empty space to select several.
          </p>
        </Section>
      </aside>
    )
  }

  const locked = selection.every((e) => e.locked)
  return (
    <aside className="canvas-inspector" aria-label="Selection settings">
      <Section
        title={
          single
            ? single.type === 'shape'
              ? 'Shape'
              : single.type[0].toUpperCase() + single.type.slice(1)
            : `${selection.length} elements`
        }
      >
        {single && (
          <div className="inspector-row single">
            <TextField
              label="Name"
              value={single.name}
              disabled={readOnly}
              onCommit={(name) => props.onSelected((e) => ({ ...e, name }))}
            />
          </div>
        )}
        {single && single.type !== 'connector' && (
          <>
            <div className="inspector-row">
              <NumberField
                label="X"
                value={single.x}
                disabled={readOnly || locked}
                onCommit={(x) => props.onSelected((e) => ({ ...e, x }))}
              />
              <NumberField
                label="Y"
                value={single.y}
                disabled={readOnly || locked}
                onCommit={(y) => props.onSelected((e) => ({ ...e, y }))}
              />
            </div>
            <div className="inspector-row">
              <NumberField
                label="Width"
                value={single.width}
                min={1}
                disabled={readOnly || locked}
                onCommit={(width) => props.onSelected((e) => ({ ...e, width }))}
              />
              <NumberField
                label="Height"
                value={single.height}
                min={1}
                disabled={readOnly || locked}
                onCommit={(height) => props.onSelected((e) => ({ ...e, height }))}
              />
            </div>
          </>
        )}
        <div className="inspector-row">
          {(!single || single.type !== 'connector') && (
            <NumberField
              label="Rotation"
              value={single?.rotation ?? 0}
              min={-360}
              max={360}
              disabled={readOnly || locked}
              onCommit={(rotation) =>
                props.onSelected((e) => (e.type === 'connector' ? e : { ...e, rotation }))
              }
            />
          )}
          <NumberField
            label="Opacity"
            value={Math.round((single?.opacity ?? selection[0].opacity) * 100)}
            min={0}
            max={100}
            disabled={readOnly}
            onCommit={(pct) => props.onSelected((e) => ({ ...e, opacity: pct / 100 }))}
          />
        </div>
      </Section>
      {(fillOf || strokeOf) && (
        <Section title="Appearance">
          {fillOf && !(single?.type === 'shape' && single.shape === 'line') && (
            <div className="inspector-row single">
              <PaintField
                label="Fill"
                value={'fill' in fillOf ? fillOf.fill : 'none'}
                disabled={readOnly}
                onCommit={(fill) => props.onSelected((e) => ('fill' in e ? { ...e, fill } : e))}
              />
            </div>
          )}
          {strokeOf && 'stroke' in strokeOf && (
            <>
              <div className="inspector-row single">
                <PaintField
                  label="Stroke"
                  value={strokeOf.stroke.color}
                  disabled={readOnly}
                  onCommit={(color) => setStroke({ color })}
                />
              </div>
              <div className="inspector-row">
                <NumberField
                  label="Stroke width"
                  value={strokeOf.stroke.width}
                  min={0}
                  max={200}
                  step={0.5}
                  disabled={readOnly}
                  onCommit={(width) => setStroke({ width })}
                />
                <label>
                  Dash
                  <select
                    value={strokeOf.stroke.dash}
                    disabled={readOnly}
                    onChange={(e) =>
                      setStroke({ dash: e.target.value as 'solid' | 'dashed' | 'dotted' })
                    }
                  >
                    <option value="solid">Solid</option>
                    <option value="dashed">Dashed</option>
                    <option value="dotted">Dotted</option>
                  </select>
                </label>
              </div>
            </>
          )}
          {single && (single.type === 'shape' || single.type === 'image') && (
            <div className="inspector-row">
              <NumberField
                label="Corner radius"
                value={single.radius}
                min={0}
                max={1000}
                disabled={readOnly}
                onCommit={(radius) =>
                  props.onSelected((e) =>
                    e.type === 'shape' || e.type === 'image' ? { ...e, radius } : e,
                  )
                }
              />
              {single.type === 'shape' ? (
                <label className="inline" style={{ alignSelf: 'end' }}>
                  <input
                    type="checkbox"
                    checked={single.shadow}
                    disabled={readOnly}
                    onChange={(e) =>
                      props.onSelected((el) =>
                        el.type === 'shape' ? { ...el, shadow: e.target.checked } : el,
                      )
                    }
                  />
                  Shadow
                </label>
              ) : (
                <label>
                  Fit
                  <select
                    value={single.fit}
                    disabled={readOnly}
                    onChange={(e) =>
                      props.onSelected((el) =>
                        el.type === 'image'
                          ? { ...el, fit: e.target.value as 'contain' | 'cover' | 'stretch' }
                          : el,
                      )
                    }
                  >
                    <option value="contain">Contain</option>
                    <option value="cover">Cover</option>
                    <option value="stretch">Stretch</option>
                  </select>
                </label>
              )}
            </div>
          )}
          {single?.type === 'image' && (
            <div className="inspector-row single">
              <TextField
                label="Alt text"
                value={single.alt}
                maxLength={300}
                disabled={readOnly}
                onCommit={(alt) =>
                  props.onSelected((e) => (e.type === 'image' ? { ...e, alt } : e))
                }
              />
            </div>
          )}
        </Section>
      )}
      {single?.type === 'connector' && (
        <Section title="Route and arrows">
          <div className="inspector-row single">
            <label>
              Routing
              <select
                value={single.routing}
                disabled={readOnly}
                onChange={(e) =>
                  props.onSelected((el) =>
                    el.type === 'connector'
                      ? { ...el, routing: e.target.value as 'straight' | 'orthogonal' | 'curved' }
                      : el,
                  )
                }
              >
                <option value="straight">Straight</option>
                <option value="orthogonal">Orthogonal</option>
                <option value="curved">Curved</option>
              </select>
            </label>
          </div>
          <div className="inspector-row">
            {(['startArrow', 'endArrow'] as const).map((key) => (
              <label key={key}>
                {key === 'startArrow' ? 'Start' : 'End'}
                <select
                  value={single[key]}
                  disabled={readOnly}
                  onChange={(e) =>
                    props.onSelected((el) =>
                      el.type === 'connector' ? { ...el, [key]: e.target.value as ArrowHead } : el,
                    )
                  }
                >
                  {(['none', 'arrow', 'triangle', 'circle', 'diamond', 'bar'] as ArrowHead[]).map(
                    (a) => (
                      <option key={a} value={a}>
                        {a[0].toUpperCase() + a.slice(1)}
                      </option>
                    ),
                  )}
                </select>
              </label>
            ))}
          </div>
          <div className="inspector-row single">
            <TextField
              label="Label"
              value={single.label}
              maxLength={1000}
              disabled={readOnly}
              onCommit={(label) =>
                props.onSelected((e) => (e.type === 'connector' ? { ...e, label } : e))
              }
            />
          </div>
          <p className="inspector-hint">
            Drag an endpoint onto a shape to attach it. Drag the line to add a waypoint;
            double-click a waypoint to remove it.
          </p>
        </Section>
      )}
      {textStyle && (
        <Section title="Text">
          {single && single.type !== 'image' && (
            <div className="inspector-row single">
              <button
                type="button"
                className="button"
                disabled={readOnly}
                onClick={props.onEditText}
              >
                Edit text (Enter)
              </button>
            </div>
          )}
          <div className="inspector-row single">
            <label>
              Font
              <select
                value={
                  FONTS.some((f) => f.value === textStyle.fontFamily)
                    ? textStyle.fontFamily
                    : 'other'
                }
                disabled={readOnly}
                onChange={(e) =>
                  e.target.value !== 'other' && setText({ fontFamily: e.target.value })
                }
              >
                {FONTS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
                {!FONTS.some((f) => f.value === textStyle.fontFamily) && (
                  <option value="other">{textStyle.fontFamily}</option>
                )}
              </select>
            </label>
          </div>
          <div className="inspector-row">
            <NumberField
              label="Size"
              value={textStyle.fontSize}
              min={1}
              max={400}
              disabled={readOnly}
              onCommit={(fontSize) => setText({ fontSize })}
            />
            <NumberField
              label="Line height"
              value={textStyle.lineHeight}
              min={0.5}
              max={4}
              step={0.05}
              disabled={readOnly}
              onCommit={(lineHeight) => setText({ lineHeight })}
            />
          </div>
          <div className="inspector-row single">
            <PaintField
              label="Text color"
              value={textStyle.color}
              allowNone={false}
              allowGradient={false}
              disabled={readOnly}
              onCommit={(color) => isColor(color) && setText({ color })}
            />
          </div>
          <div className="inspector-row">
            <span className="button-group" role="group" aria-label="Text style">
              <button
                type="button"
                className={textStyle.bold ? 'active' : ''}
                aria-pressed={textStyle.bold}
                aria-label="Bold"
                disabled={readOnly}
                onClick={() => setText({ bold: !textStyle.bold })}
              >
                <Bold size={14} />
              </button>
              <button
                type="button"
                className={textStyle.italic ? 'active' : ''}
                aria-pressed={textStyle.italic}
                aria-label="Italic"
                disabled={readOnly}
                onClick={() => setText({ italic: !textStyle.italic })}
              >
                <Italic size={14} />
              </button>
              <button
                type="button"
                className={textStyle.underline ? 'active' : ''}
                aria-pressed={textStyle.underline}
                aria-label="Underline"
                disabled={readOnly}
                onClick={() => setText({ underline: !textStyle.underline })}
              >
                <Underline size={14} />
              </button>
            </span>
            <span className="button-group" role="group" aria-label="Horizontal alignment">
              {(['left', 'center', 'right'] as const).map((align) => (
                <button
                  key={align}
                  type="button"
                  className={textStyle.align === align ? 'active' : ''}
                  aria-pressed={textStyle.align === align}
                  aria-label={`Align ${align}`}
                  disabled={readOnly}
                  onClick={() => setText({ align })}
                >
                  {align === 'left' ? (
                    <AlignLeft size={14} />
                  ) : align === 'center' ? (
                    <AlignCenter size={14} />
                  ) : (
                    <AlignRight size={14} />
                  )}
                </button>
              ))}
            </span>
          </div>
          <div className="inspector-row single">
            <span className="button-group" role="group" aria-label="Vertical alignment">
              {(['top', 'middle', 'bottom'] as const).map((valign) => (
                <button
                  key={valign}
                  type="button"
                  className={textStyle.valign === valign ? 'active' : ''}
                  aria-pressed={textStyle.valign === valign}
                  disabled={readOnly}
                  onClick={() => setText({ valign })}
                >
                  {valign[0].toUpperCase() + valign.slice(1)}
                </button>
              ))}
            </span>
          </div>
          <p className="inspector-hint">
            Write x_{'{'}1{'}'} for a subscript and x^{'{'}2{'}'} for a superscript. Shift+Enter is
            a new line while editing; Ctrl+Enter finishes.
          </p>
        </Section>
      )}
      <Section title="Arrange">
        <div className="inspector-row single">
          <span className="button-group" role="group" aria-label="Order">
            <button
              type="button"
              aria-label="Send to back"
              title="Send to back (Ctrl+[)"
              disabled={readOnly}
              onClick={() => props.onReorder('back')}
            >
              <SendToBack size={14} />
            </button>
            <button
              type="button"
              aria-label="Send backward"
              title="Send backward ([)"
              disabled={readOnly}
              onClick={() => props.onReorder('backward')}
            >
              <ArrowDownToLine size={14} />
            </button>
            <button
              type="button"
              aria-label="Bring forward"
              title="Bring forward (])"
              disabled={readOnly}
              onClick={() => props.onReorder('forward')}
            >
              <ArrowUpToLine size={14} />
            </button>
            <button
              type="button"
              aria-label="Bring to front"
              title="Bring to front (Ctrl+])"
              disabled={readOnly}
              onClick={() => props.onReorder('front')}
            >
              <BringToFront size={14} />
            </button>
          </span>
        </div>
        <div className="inspector-row single">
          <span className="button-group" role="group" aria-label="Align">
            <button
              type="button"
              aria-label="Align left"
              disabled={readOnly}
              onClick={() => props.onAlign('left')}
            >
              <AlignLeft size={14} />
            </button>
            <button
              type="button"
              aria-label="Align horizontal center"
              disabled={readOnly}
              onClick={() => props.onAlign('centerX')}
            >
              <AlignCenter size={14} />
            </button>
            <button
              type="button"
              aria-label="Align right"
              disabled={readOnly}
              onClick={() => props.onAlign('right')}
            >
              <AlignRight size={14} />
            </button>
            <button
              type="button"
              aria-label="Align top"
              disabled={readOnly}
              onClick={() => props.onAlign('top')}
            >
              <ArrowUpToLine size={14} />
            </button>
            <button
              type="button"
              aria-label="Align vertical center"
              disabled={readOnly}
              onClick={() => props.onAlign('centerY')}
            >
              <AlignVerticalJustifyCenter size={14} />
            </button>
            <button
              type="button"
              aria-label="Align bottom"
              disabled={readOnly}
              onClick={() => props.onAlign('bottom')}
            >
              <ArrowDownToLine size={14} />
            </button>
          </span>
        </div>
        <div className="inspector-row single">
          <span className="button-group" role="group" aria-label="Grouping">
            <button
              type="button"
              disabled={readOnly || selection.length < 2}
              title="Group (Ctrl+G)"
              onClick={props.onGroup}
            >
              <Group size={14} />
              &nbsp;Group
            </button>
            <button
              type="button"
              disabled={readOnly || !selection.some((e) => e.groupId)}
              title="Ungroup (Ctrl+Shift+G)"
              onClick={props.onUngroup}
            >
              <Ungroup size={14} />
              &nbsp;Ungroup
            </button>
            <button
              type="button"
              disabled={readOnly}
              aria-pressed={locked}
              className={locked ? 'active' : ''}
              onClick={() => props.onSelected((e) => ({ ...e, locked: !locked }))}
            >
              {locked ? <Lock size={14} /> : <Unlock size={14} />}
              &nbsp;{locked ? 'Locked' : 'Lock'}
            </button>
          </span>
        </div>
        <p className="inspector-hint">
          Aligning one element uses the canvas; aligning several uses their shared bounds. Locked
          elements cannot be selected on the canvas.
        </p>
      </Section>
      {doc.mode === 'deck' && (
        <Section title="Build">
          <div className="inspector-row">
            <NumberField
              label="Appear on step"
              value={single?.appear ?? selection[0].appear}
              min={0}
              max={100}
              disabled={readOnly}
              onCommit={(appear) => props.onSelected((e) => ({ ...e, appear: Math.round(appear) }))}
            />
          </div>
          <p className="inspector-hint">
            0 shows with the slide. 1, 2, 3… appear on successive clicks while presenting.
          </p>
        </Section>
      )}
      {doc.mode === 'mockup' && single && (
        <Section title="Interaction">
          <div className="inspector-row single">
            <label>
              On click, open
              <select
                value={single.link ?? ''}
                disabled={readOnly}
                onChange={(e) =>
                  props.onSelected((el) => ({ ...el, link: e.target.value || null }))
                }
              >
                <option value="">Nothing</option>
                {doc.pages
                  .filter((p) => p.id !== page.id)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </label>
          </div>
        </Section>
      )}
      {doc.mode === 'animation' && single && single.type !== 'connector' && (
        <Section title="Motion">
          <div className="inspector-row single">
            <button
              type="button"
              className="button"
              disabled={readOnly}
              onClick={() =>
                props.onSelected((e) => {
                  if (e.type === 'connector') return e
                  const frame: Keyframe = {
                    t: Math.round(time * 100) / 100,
                    x: e.x,
                    y: e.y,
                    width: e.width,
                    height: e.height,
                    rotation: e.rotation,
                    opacity: e.opacity,
                  }
                  const others = e.keyframes.filter((k) => Math.abs(k.t - frame.t) > 0.001)
                  return {
                    ...e,
                    keyframes: [...others, frame].sort((a, b) => a.t - b.t).slice(0, 60),
                  }
                })
              }
            >
              Add keyframe at {time.toFixed(2)}s
            </button>
          </div>
          {single.keyframes.length > 0 && (
            <ul className="keyframe-list">
              {single.keyframes.map((k, i) => (
                <li key={i}>
                  <span>
                    {k.t.toFixed(2)}s · ({Math.round(k.x)}, {Math.round(k.y)}) ·{' '}
                    {Math.round(k.rotation)}° · {Math.round(k.opacity * 100)}%
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove keyframe at ${k.t}s`}
                    disabled={readOnly}
                    onClick={() =>
                      props.onSelected((e) => ({
                        ...e,
                        keyframes: e.keyframes.filter((_, j) => j !== i),
                      }))
                    }
                  >
                    <Trash2 size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="inspector-hint">
            Add a first keyframe, then move the preview time and drag, resize, or rotate the
            element: each change at a preview time records a keyframe. The element eases between
            keyframes when the scene plays.
          </p>
        </Section>
      )}
    </aside>
  )
}
