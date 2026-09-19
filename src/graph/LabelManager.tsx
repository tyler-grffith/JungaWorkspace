import { useEffect, useRef, useState } from 'react'
import { X, RotateCcw, RotateCw } from 'lucide-react'
import { DEFAULT_LABEL, type PlotEntry } from './model'
export default function LabelManager({
  entry,
  onSave,
  onClose,
}: {
  entry: PlotEntry
  onSave: (entry: PlotEntry) => void
  onClose: () => void
}) {
  const [text, setText] = useState(entry.label)
  const [style, setStyle] = useState(entry.labelStyle ?? DEFAULT_LABEL)
  const form = useRef<HTMLFormElement>(null)
  useEffect(() => {
    form.current?.querySelector('input')?.focus()
  }, [])
  function rotate(step: number) {
    const angle = style.angle + step
    setStyle({
      ...style,
      orientation: 'fixed',
      angle: angle > 180 ? -165 : angle < -180 ? 165 : angle,
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
          <h3>Label manager</h3>
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
            type="range"
            min={8}
            max={36}
            step={1}
            value={style.size}
            onChange={(e) => setStyle({ ...style, size: Number(e.target.value) })}
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
              onClick={() => rotate(-15)}
            >
              <RotateCcw size={16} />
            </button>
            <label>
              Angle
              <select
                aria-label="Label angle"
                value={style.angle}
                onChange={(e) => setStyle({ ...style, angle: Number(e.target.value) })}
              >
                {Array.from({ length: 25 }, (_, i) => i * 15 - 180).map((angle) => (
                  <option key={angle} value={angle}>
                    {angle}°
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="icon-button"
              aria-label="Rotate label clockwise"
              onClick={() => rotate(15)}
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
