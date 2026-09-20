import { useEffect, useRef, useState } from 'react'
import { X, RotateCcw, RotateCw } from 'lucide-react'
import { DEFAULT_LABEL, type PlotEntry } from './model'
import { useDesign } from '../design/context'
export default function LabelManager({
  entry,
  onSave,
  onClose,
}: {
  entry: PlotEntry
  onSave: (entry: PlotEntry) => void
  onClose: () => void
}) {
  const design = useDesign().labels
  const [text, setText] = useState(entry.label)
  const [style, setStyle] = useState(
    entry.labelStyle ?? { ...DEFAULT_LABEL, size: design.defaultSize },
  )
  const [angleText, setAngleText] = useState(String(style.angle))
  const [sizeText, setSizeText] = useState(String(style.size))
  useEffect(() => {
    if (!entry.labelStyle) {
      setStyle((previous) => ({ ...previous, size: design.defaultSize }))
      setSizeText(String(design.defaultSize))
    }
  }, [design.defaultSize, entry.labelStyle])
  const form = useRef<HTMLFormElement>(null)
  useEffect(() => {
    form.current?.querySelector('input')?.focus()
  }, [])
  function rotate(step: number) {
    const angle = style.angle + step
    const next = angle > 180 ? angle - 360 : angle < -180 ? angle + 360 : angle
    setAngleText(String(next))
    setStyle({
      ...style,
      orientation: 'fixed',
      angle: next,
    })
  }
  return (
    <div className="label-manager" role="dialog" aria-label="Label manager">
      <form
        ref={form}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Escape') {
            e.preventDefault()
            onClose()
          }
        }}
        onSubmit={(e) => {
          e.preventDefault()
          onSave({ ...entry, label: text, labelStyle: style })
          onClose()
        }}
      >
        <header>
          <h3>{design.title}</h3>
          <button
            type="button"
            className="icon-button"
            aria-label="Close label manager"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </header>
        <label>
          Text
          <input
            aria-label="Label text"
            value={text}
            maxLength={60}
            placeholder="Use formula or function name"
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <label>
          Size <span>{style.size} px</span>
          <input
            aria-label="Label size"
            type={design.sizeControl === 'slider' ? 'range' : 'number'}
            min={8}
            max={36}
            step={design.sizeControl === 'slider' ? 1 : 'any'}
            required
            value={design.sizeControl === 'slider' ? style.size : sizeText}
            onChange={(e) => {
              setSizeText(e.target.value)
              const size = e.target.valueAsNumber
              if (Number.isFinite(size) && size >= 8 && size <= 36) setStyle({ ...style, size })
            }}
          />
        </label>
        <label>
          Orientation
          <select
            aria-label="Label orientation"
            value={style.orientation}
            onChange={(e) =>
              setStyle({ ...style, orientation: e.target.value as typeof style.orientation })
            }
          >
            <option value="fixed">Fixed angle</option>
            <option value="parallel">Parallel to curve</option>
          </select>
        </label>
        {style.orientation === 'fixed' && (
          <div className="label-rotation">
            <button
              type="button"
              className="icon-button"
              aria-label="Rotate label counterclockwise"
              onClick={() => rotate(-design.angleStep)}
            >
              <RotateCcw size={16} />
            </button>
            <label>
              Angle
              {design.angleControl === 'number' ? (
                <input
                  aria-label="Label angle"
                  type="number"
                  min={-180}
                  max={180}
                  step="any"
                  required
                  value={angleText}
                  onChange={(e) => {
                    setAngleText(e.target.value)
                    const angle = e.target.valueAsNumber
                    if (Number.isFinite(angle) && angle >= -180 && angle <= 180)
                      setStyle({ ...style, angle })
                  }}
                />
              ) : (
                <select
                  aria-label="Label angle"
                  value={style.angle}
                  onChange={(e) => {
                    setStyle({ ...style, angle: Number(e.target.value) })
                    setAngleText(e.target.value)
                  }}
                >
                  {[
                    ...new Set([
                      ...Array.from(
                        { length: 360 / design.angleStep + 1 },
                        (_, i) => i * design.angleStep - 180,
                      ),
                      style.angle,
                    ]),
                  ]
                    .sort((a, b) => a - b)
                    .map((angle) => (
                      <option key={angle} value={angle}>
                        {angle}°
                      </option>
                    ))}
                </select>
              )}
            </label>
            <button
              type="button"
              className="icon-button"
              aria-label="Rotate label clockwise"
              onClick={() => rotate(design.angleStep)}
            >
              <RotateCw size={16} />
            </button>
          </div>
        )}
        <p>
          Drag the label along the curve, or use its arrow keys. Parallel labels follow the local
          slope.
        </p>
        <footer>
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary">Apply label</button>
        </footer>
      </form>
    </div>
  )
}
