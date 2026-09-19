import { useRef, useState } from 'react'
import { DEFAULT_LABEL, type PlotEntry, type Viewport } from './model'
import { toPixel, type Point } from './plot'

export function projectLabel(
  points: (Point | null)[],
  target: Point,
  view: Viewport,
  width: number,
  height: number,
) {
  let best: { point: Point; angle: number } | null = null,
    distance = Infinity
  for (let i = 0; i < points.length; i++) {
    const a = points[i]
    if (!a) continue
    const b = points[i + 1] ?? a
    const p = toPixel(a, view, width, height),
      q = toPixel(b, view, width, height)
    const dx = q.x - p.x,
      dy = q.y - p.y
    const t =
      dx || dy
        ? Math.max(
            0,
            Math.min(1, ((target.x - p.x) * dx + (target.y - p.y) * dy) / (dx * dx + dy * dy)),
          )
        : 0
    const pixel = { x: p.x + t * dx, y: p.y + t * dy }
    if (pixel.x < 0 || pixel.x > width || pixel.y < 0 || pixel.y > height) continue
    const d = (pixel.x - target.x) ** 2 + (pixel.y - target.y) ** 2
    if (d < distance) {
      distance = d
      let angle = (Math.atan2(dy, dx) * 180) / Math.PI
      if (angle > 90) angle -= 180
      if (angle < -90) angle += 180
      best = { point: { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) }, angle }
    }
  }
  return best
}

export default function CurveLabel({
  entry,
  label,
  points,
  fallback,
  view,
  width,
  height,
  readOnly,
  onChange,
  onEdit,
}: {
  entry: PlotEntry
  label: string
  points: (Point | null)[]
  fallback: Point | null
  view: Viewport
  width: number
  height: number
  readOnly: boolean
  onChange?: (entry: PlotEntry) => void
  onEdit: (id: string) => void
}) {
  const style = entry.labelStyle ?? DEFAULT_LABEL
  const [preview, setPreview] = useState<Point | null>(null)
  const drag = useRef<{ id: number; origin: Point; anchor: Point | null } | null>(null)
  const anchor = preview ?? style.anchor ?? fallback
  if (!anchor) return null
  const projection = projectLabel(points, toPixel(anchor, view, width, height), view, width, height)
  if (!projection) return null
  const pixel = toPixel(projection.point, view, width, height)
  const x = Math.max(12, Math.min(width - 25, pixel.x + 9))
  const y = Math.max(style.size + 4, Math.min(height - 12, pixel.y - 10))
  const angle = style.orientation === 'parallel' ? projection.angle : style.angle
  const editable = !readOnly && !!onChange
  return (
    <text
      className={`curve-label ${editable ? 'interactive-label' : ''}`}
      data-testid="curve-label"
      data-entry-id={entry.id}
      role={editable ? 'button' : undefined}
      tabIndex={editable ? 0 : undefined}
      aria-label={editable ? `Edit label ${label}` : undefined}
      style={{ fontSize: style.size }}
      fill={entry.color}
      x={x}
      y={y}
      transform={`rotate(${angle} ${x} ${y})`}
      onDoubleClick={(e) => {
        if (editable) {
          e.stopPropagation()
          onEdit(entry.id)
        }
      }}
      onPointerDown={(e) => {
        e.stopPropagation()
        if (!editable || e.button !== 0) return
        e.currentTarget.focus()
        e.currentTarget.setPointerCapture(e.pointerId)
        drag.current = { id: e.pointerId, origin: { x: e.clientX, y: e.clientY }, anchor: null }
      }}
      onPointerMove={(e) => {
        e.stopPropagation()
        if (drag.current?.id !== e.pointerId) return
        if (
          Math.hypot(e.clientX - drag.current.origin.x, e.clientY - drag.current.origin.y) < 4 &&
          !drag.current.anchor
        )
          return
        const rect = e.currentTarget.ownerSVGElement!.getBoundingClientRect()
        const next = projectLabel(
          points,
          {
            x: ((e.clientX - rect.left) * width) / rect.width,
            y: ((e.clientY - rect.top) * height) / rect.height,
          },
          view,
          width,
          height,
        )
        if (next) {
          drag.current.anchor = next.point
          setPreview(next.point)
        }
      }}
      onPointerUp={(e) => {
        e.stopPropagation()
        if (drag.current?.id !== e.pointerId) return
        const next = drag.current.anchor
        drag.current = null
        setPreview(null)
        e.currentTarget.releasePointerCapture(e.pointerId)
        if (next && editable) onChange!({ ...entry, labelStyle: { ...style, anchor: next } })
      }}
      onPointerCancel={() => {
        drag.current = null
        setPreview(null)
      }}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (!editable) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onEdit(entry.id)
        }
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
          e.preventDefault()
          const target = {
            x: pixel.x + (e.key === 'ArrowLeft' ? -15 : e.key === 'ArrowRight' ? 15 : 0),
            y: pixel.y + (e.key === 'ArrowUp' ? -15 : e.key === 'ArrowDown' ? 15 : 0),
          }
          const next = projectLabel(points, target, view, width, height)
          if (next) onChange!({ ...entry, labelStyle: { ...style, anchor: next.point } })
        }
      }}
    >
      <title>{label} · Drag along the curve. Double-click or press Enter to edit.</title>
      {label}
    </text>
  )
}
