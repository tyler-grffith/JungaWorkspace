// The 2D sketcher: looks straight at a sketch plane and draws entities on it with the tools a
// SolidWorks sketch has (line, rectangle, circle, arc, polygon, slot), grid and point snapping,
// numeric dimensions on the selected entity, mirror and offset, pan and zoom. The body's
// section on the plane is drawn faintly underneath so a sketch on a face has the face to see.
// It owns no document: it edits an entity list and hands it back on every change.
import { useEffect, useMemo, useRef, useState, type PointerEvent, type WheelEvent } from 'react'
import {
  Circle,
  Copy,
  FlipHorizontal2,
  FlipVertical2,
  Focus,
  Hexagon,
  Minus,
  MousePointer2,
  RectangleHorizontal,
  Spline,
  Trash2,
} from 'lucide-react'
import type { Polygon, Segment } from '../workbench/geometry'
import { offsetPolygon } from '../workbench/geometry'
import {
  arcPoints,
  entityDimensions,
  entityDistance,
  entityLoop,
  entityPoints,
  mirrorEntity,
  moveEntity,
  newEntityId,
  setEntityDimension,
  sketchLoops,
  type Point,
  type SketchEntity,
} from './sketch'

export type SketchTool = 'select' | 'line' | 'rect' | 'circle' | 'arc' | 'polygon' | 'slot'
export type SketchEditorProps = {
  entities: SketchEntity[]
  onChange: (entities: SketchEntity[]) => void
  /** Segments of the body's section on this plane, in sketch coordinates. */
  reference?: Segment[]
  planeLabel: string
  /** Grid step in mm; 0 disables grid snapping. */
  grid: number
  readOnly?: boolean
}
const TOOLS: { id: SketchTool; label: string; icon: typeof Minus; key: string }[] = [
  { id: 'select', label: 'Select', icon: MousePointer2, key: 'S' },
  { id: 'line', label: 'Line', icon: Minus, key: 'L' },
  { id: 'rect', label: 'Rectangle', icon: RectangleHorizontal, key: 'R' },
  { id: 'circle', label: 'Circle', icon: Circle, key: 'C' },
  { id: 'arc', label: 'Arc', icon: Spline, key: 'A' },
  { id: 'polygon', label: 'Polygon', icon: Hexagon, key: 'P' },
  { id: 'slot', label: 'Slot', icon: Minus, key: 'O' },
]
const HINTS: Record<SketchTool, string> = {
  select: 'Click an entity to select it, drag to move it, Delete to remove it.',
  line: 'Click to start, click to add points; click the first point to close, Enter or Escape to stop.',
  rect: 'Click one corner, then the opposite corner.',
  circle: 'Click the centre, then a point on the circle.',
  arc: 'Click the centre, then the start point, then the end point (counter-clockwise).',
  polygon: 'Click the centre, then a vertex. Sides are set in the toolbar.',
  slot: 'Click the two centres. Width is set in the toolbar.',
}

type View = { zoom: number; cx: number; cy: number }

export default function SketchEditor({
  entities,
  onChange,
  reference = [],
  planeLabel,
  grid,
  readOnly,
}: SketchEditorProps) {
  const host = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [view, setView] = useState<View>({ zoom: 4, cx: 0, cy: 0 })
  const [tool, setTool] = useState<SketchTool>(readOnly ? 'select' : 'line')
  const [selected, setSelected] = useState<string | null>(null)
  const [points, setPoints] = useState<Point[]>([])
  const [cursor, setCursor] = useState<Point | null>(null)
  const [snapNote, setSnapNote] = useState('')
  const [sides, setSides] = useState(6)
  const [slotWidth, setSlotWidth] = useState(10)
  const [offsetBy, setOffsetBy] = useState(2)
  const gesture = useRef<{ mode: 'pan' | 'move'; x: number; y: number; id?: string } | null>(null)
  const fitted = useRef(false)

  useEffect(() => {
    const el = host.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize({ width: Math.round(width), height: Math.round(height) })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  const extent = useMemo(() => {
    const pts = [...entities.flatMap(entityPoints), ...reference.flat()]
    if (!pts.length) return { min: { x: -40, y: -30 }, max: { x: 40, y: 30 } }
    const xs = pts.map((p) => p.x)
    const ys = pts.map((p) => p.y)
    return {
      min: { x: Math.min(...xs), y: Math.min(...ys) },
      max: { x: Math.max(...xs), y: Math.max(...ys) },
    }
  }, [entities, reference])
  const fit = () => {
    if (!size.width) return
    const w = Math.max(10, extent.max.x - extent.min.x)
    const h = Math.max(10, extent.max.y - extent.min.y)
    setView({
      zoom: Math.min(size.width / w, size.height / h) * 0.7,
      cx: (extent.min.x + extent.max.x) / 2,
      cy: (extent.min.y + extent.max.y) / 2,
    })
  }
  useEffect(() => {
    if (fitted.current || !size.width) return
    fitted.current = true
    fit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size])

  // --- Coordinates ---
  const toScreen = (p: Point) => ({
    x: size.width / 2 + (p.x - view.cx) * view.zoom,
    y: size.height / 2 - (p.y - view.cy) * view.zoom,
  })
  const toSketch = (sx: number, sy: number): Point => ({
    x: view.cx + (sx - size.width / 2) / view.zoom,
    y: view.cy - (sy - size.height / 2) / view.zoom,
  })
  const local = (event: PointerEvent) => {
    const rect = host.current!.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }
  /** Snap a sketch point: to a nearby entity point, then to the last point's axes, then the grid. */
  const snap = (p: Point, noGrid: boolean): { point: Point; note: string } => {
    const tolerance = 8 / view.zoom
    let best: Point | null = null
    let bestD = tolerance
    for (const e of entities)
      for (const q of entityPoints(e)) {
        const d = Math.hypot(q.x - p.x, q.y - p.y)
        if (d < bestD) {
          bestD = d
          best = q
        }
      }
    if (best) return { point: best, note: 'snapped to point' }
    const last = points[points.length - 1]
    let out = { ...p }
    let note = ''
    if (last) {
      if (Math.abs(p.x - last.x) < tolerance * 0.7) {
        out.x = last.x
        note = 'vertical'
      } else if (Math.abs(p.y - last.y) < tolerance * 0.7) {
        out.y = last.y
        note = 'horizontal'
      }
    }
    if (grid > 0 && !noGrid) {
      out = { x: Math.round(out.x / grid) * grid, y: Math.round(out.y / grid) * grid }
      if (last && note === 'vertical') out.x = last.x
      if (last && note === 'horizontal') out.y = last.y
    }
    return { point: out, note }
  }
  const pick = (p: Point): string | null => {
    const tolerance = 6 / view.zoom
    let best: string | null = null
    let bestD = tolerance
    for (const e of entities) {
      const d = entityDistance(e, p)
      if (d < bestD) {
        bestD = d
        best = e.id
      }
    }
    return best
  }

  // --- Editing ---
  const add = (e: SketchEntity) => onChange([...entities, e])
  const replace = (id: string, e: SketchEntity) =>
    onChange(entities.map((x) => (x.id === id ? e : x)))
  const remove = (id: string) => {
    onChange(entities.filter((e) => e.id !== id))
    setSelected(null)
  }
  const selectedEntity = entities.find((e) => e.id === selected) ?? null
  const finishPolyline = () => setPoints([])
  const place = (p: Point) => {
    const next = [...points, p]
    switch (tool) {
      case 'line': {
        if (points.length) {
          const first = points[0]
          const closing = points.length >= 2 && Math.hypot(p.x - first.x, p.y - first.y) < 1e-6
          add({ id: newEntityId(), kind: 'line', a: points[points.length - 1], b: p })
          if (closing) return finishPolyline()
        }
        setPoints(next)
        return
      }
      case 'rect':
        if (next.length === 2) {
          add({ id: newEntityId(), kind: 'rect', a: next[0], b: next[1] })
          setPoints([])
        } else setPoints(next)
        return
      case 'circle':
        if (next.length === 2) {
          const r = Math.hypot(next[1].x - next[0].x, next[1].y - next[0].y)
          if (r > 0.01) add({ id: newEntityId(), kind: 'circle', c: next[0], r })
          setPoints([])
        } else setPoints(next)
        return
      case 'arc':
        if (next.length === 3) {
          const [c, s, e] = next
          const r = Math.hypot(s.x - c.x, s.y - c.y)
          const start = (Math.atan2(s.y - c.y, s.x - c.x) * 180) / Math.PI
          const end = (Math.atan2(e.y - c.y, e.x - c.x) * 180) / Math.PI
          if (r > 0.01) add({ id: newEntityId(), kind: 'arc', c, r, start, end })
          setPoints([])
        } else setPoints(next)
        return
      case 'polygon':
        if (next.length === 2) {
          const r = Math.hypot(next[1].x - next[0].x, next[1].y - next[0].y)
          const rotation =
            (Math.atan2(next[1].y - next[0].y, next[1].x - next[0].x) * 180) / Math.PI
          if (r > 0.01) add({ id: newEntityId(), kind: 'polygon', c: next[0], r, sides, rotation })
          setPoints([])
        } else setPoints(next)
        return
      case 'slot':
        if (next.length === 2) {
          add({ id: newEntityId(), kind: 'slot', a: next[0], b: next[1], width: slotWidth })
          setPoints([])
        } else setPoints(next)
        return
      default:
        return
    }
  }

  // --- Pointer ---
  const down = (event: PointerEvent) => {
    host.current?.focus({ preventScroll: true })
    const { x, y } = local(event)
    const pan = event.button === 1 || event.button === 2 || event.shiftKey
    if (pan) {
      gesture.current = { mode: 'pan', x, y }
      host.current?.setPointerCapture(event.pointerId)
      return
    }
    if (event.button !== 0) return
    const raw = toSketch(x, y)
    if (tool === 'select' || readOnly) {
      const id = pick(raw)
      setSelected(id)
      if (id && !readOnly) {
        gesture.current = { mode: 'move', x, y, id }
        host.current?.setPointerCapture(event.pointerId)
      }
      return
    }
    place(snap(raw, event.altKey).point)
  }
  const move = (event: PointerEvent) => {
    const { x, y } = local(event)
    const g = gesture.current
    if (g?.mode === 'pan') {
      setView((v) => ({ ...v, cx: v.cx - (x - g.x) / v.zoom, cy: v.cy + (y - g.y) / v.zoom }))
      g.x = x
      g.y = y
      return
    }
    if (g?.mode === 'move' && g.id) {
      const step = grid > 0 && !event.altKey ? grid : 0.01
      const dx = Math.round((x - g.x) / view.zoom / step) * step
      const dy = Math.round(-(y - g.y) / view.zoom / step) * step
      if (dx || dy) {
        const e = entities.find((en) => en.id === g.id)
        if (e) replace(g.id, moveEntity(e, dx, dy))
        g.x += dx * view.zoom
        g.y -= dy * view.zoom
      }
      return
    }
    const { point, note } = snap(toSketch(x, y), event.altKey)
    setCursor(point)
    setSnapNote(note)
  }
  const up = (event: PointerEvent) => {
    gesture.current = null
    host.current?.releasePointerCapture(event.pointerId)
  }
  const wheel = (event: WheelEvent) => {
    const { x, y } = local(event as unknown as PointerEvent)
    const factor = event.deltaY < 0 ? 1.15 : 1 / 1.15
    const before = toSketch(x, y)
    setView((v) => {
      const zoom = Math.max(0.2, Math.min(200, v.zoom * factor))
      // Keep the sketch point under the cursor fixed.
      return {
        zoom,
        cx: before.x - (x - size.width / 2) / zoom,
        cy: before.y + (y - size.height / 2) / zoom,
      }
    })
  }
  const keys = (event: React.KeyboardEvent) => {
    if ((event.target as HTMLElement).tagName === 'INPUT') return
    const t = TOOLS.find((tl) => tl.key === event.key.toUpperCase())
    if (t && !readOnly && !event.ctrlKey) {
      setTool(t.id)
      setPoints([])
    } else if (event.key === 'Escape' || event.key === 'Enter') finishPolyline()
    else if ((event.key === 'Delete' || event.key === 'Backspace') && selected && !readOnly)
      remove(selected)
    else if (event.key.toLowerCase() === 'f') fit()
    else return
    event.preventDefault()
  }
  const mirrorSelected = (axis: 'x' | 'y') => {
    if (selectedEntity) add(mirrorEntity(selectedEntity, axis))
  }
  const offsetSelected = () => {
    if (!selectedEntity) return
    const loop = entityLoop(selectedEntity)
    if (!loop) return
    const moved = offsetPolygon(loop, offsetBy)
    if (moved.length >= 3) add({ id: newEntityId(), kind: 'polyline', points: moved, closed: true })
  }

  // --- Drawing ---
  const path = (pts: Point[], close = false) =>
    pts
      .map((p, i) => {
        const s = toScreen(p)
        return `${i ? 'L' : 'M'}${s.x.toFixed(1)} ${s.y.toFixed(1)}`
      })
      .join(' ') + (close ? ' Z' : '')
  const entityPath = (e: SketchEntity): string => {
    switch (e.kind) {
      case 'line':
        return path([e.a, e.b])
      case 'arc':
        return path(arcPoints(e.c, e.r, e.start, e.end, 64))
      case 'circle':
        return path(arcPoints(e.c, e.r, 0, 360, 96).slice(0, -1), true)
      case 'polyline':
        return path(e.points, e.closed)
      default:
        return path(entityLoop(e) ?? [], true)
    }
  }
  /** The in-progress shape under the cursor. */
  const preview = (): string => {
    if (!cursor || !points.length) return ''
    const p = cursor
    switch (tool) {
      case 'line':
        return path([points[points.length - 1], p])
      case 'rect':
        return entityPath({ id: '', kind: 'rect', a: points[0], b: p })
      case 'circle':
        return entityPath({
          id: '',
          kind: 'circle',
          c: points[0],
          r: Math.hypot(p.x - points[0].x, p.y - points[0].y) || 0.01,
        })
      case 'arc': {
        const [c, s] = points
        if (!s) return path([c, p])
        const r = Math.hypot(s.x - c.x, s.y - c.y) || 0.01
        const start = (Math.atan2(s.y - c.y, s.x - c.x) * 180) / Math.PI
        const end = (Math.atan2(p.y - c.y, p.x - c.x) * 180) / Math.PI
        return entityPath({ id: '', kind: 'arc', c, r, start, end })
      }
      case 'polygon': {
        const r = Math.hypot(p.x - points[0].x, p.y - points[0].y) || 0.01
        const rotation = (Math.atan2(p.y - points[0].y, p.x - points[0].x) * 180) / Math.PI
        return entityPath({ id: '', kind: 'polygon', c: points[0], r, sides, rotation })
      }
      case 'slot':
        return entityPath({ id: '', kind: 'slot', a: points[0], b: p, width: slotWidth })
      default:
        return ''
    }
  }
  const gridLines = useMemo(() => {
    if (!size.width) return []
    let step = grid > 0 ? grid : 5
    while (step * view.zoom < 12) step *= 2
    const tl = toSketch(0, 0)
    const br = toSketch(size.width, size.height)
    const lines: { d: string; major: boolean }[] = []
    for (let x = Math.floor(tl.x / step) * step; x <= br.x; x += step) {
      const s = toScreen({ x, y: 0 }).x
      lines.push({ d: `M${s} 0V${size.height}`, major: Math.abs(x % (step * 5)) < 1e-9 })
    }
    for (let y = Math.floor(br.y / step) * step; y <= tl.y; y += step) {
      const s = toScreen({ x: 0, y }).y
      lines.push({ d: `M0 ${s}H${size.width}`, major: Math.abs(y % (step * 5)) < 1e-9 })
    }
    return lines
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, view, grid])
  const loops = useMemo(() => sketchLoops(entities), [entities])
  const origin = toScreen({ x: 0, y: 0 })
  const dims = selectedEntity ? entityDimensions(selectedEntity) : []
  const label = (p: Point, text: string, key: string) => {
    const s = toScreen(p)
    return (
      <text key={key} x={s.x + 6} y={s.y - 6} className="sk-label">
        {text}
      </text>
    )
  }
  const dimensionLabels = selectedEntity
    ? dims.map((d, i) =>
        label(
          entityPoints(selectedEntity)[Math.min(i, entityPoints(selectedEntity).length - 1)],
          `${d.value.toFixed(2)}`,
          `${selectedEntity.id}-${i}`,
        ),
      )
    : []

  return (
    <div
      ref={host}
      className={`sk-editor tool-${tool}`}
      tabIndex={0}
      role="application"
      aria-label={`Sketch on the ${planeLabel} plane`}
      onKeyDown={keys}
      onContextMenu={(e) => e.preventDefault()}
    >
      <svg
        className="sk-canvas"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onWheel={wheel}
        onDoubleClick={finishPolyline}
      >
        <g className="sk-grid">
          {gridLines.map((l, i) => (
            <path
              key={i}
              d={l.d}
              stroke={l.major ? 'rgba(80,100,130,0.22)' : 'rgba(80,100,130,0.1)'}
            />
          ))}
          <path d={`M${origin.x} 0V${size.height}`} stroke="rgba(47,158,68,0.6)" />
          <path d={`M0 ${origin.y}H${size.width}`} stroke="rgba(214,69,69,0.6)" />
        </g>
        <g fill="none" stroke="rgba(90,110,140,0.55)" strokeDasharray="4 3">
          {reference.map((s, i) => (
            <path key={i} d={path([s[0], s[1]])} />
          ))}
        </g>
        <g fill="rgba(47,111,237,0.08)" stroke="none">
          {loops.map((loop: Polygon, i) => (
            <path key={i} d={path(loop, true)} />
          ))}
        </g>
        <g fill="none" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
          {entities.map((e) => (
            <path
              key={e.id}
              d={entityPath(e)}
              stroke={e.id === selected ? '#2f6fed' : '#1d232b'}
              strokeWidth={e.id === selected ? 2.4 : 1.6}
              className="sk-entity"
            />
          ))}
          {points.length > 0 && <path d={preview()} stroke="#2f6fed" strokeDasharray="5 3" />}
        </g>
        <g fill="#1d232b">
          {entities.flatMap((e) =>
            entityPoints(e)
              .slice(0, e.kind === 'polyline' ? 0 : 2)
              .map((p, i) => {
                const s = toScreen(p)
                return <rect key={`${e.id}${i}`} x={s.x - 2} y={s.y - 2} width={4} height={4} />
              }),
          )}
        </g>
        {cursor && (
          <g>
            <circle
              cx={toScreen(cursor).x}
              cy={toScreen(cursor).y}
              r={4}
              fill="none"
              stroke="#2f6fed"
            />
          </g>
        )}
        <g className="sk-labels" fontSize={11} fill="#2f6fed" fontFamily="system-ui, sans-serif">
          {dimensionLabels}
        </g>
      </svg>
      {!readOnly && (
        <div className="sk-toolbar" role="toolbar" aria-label="Sketch tools">
          {TOOLS.map((t) => {
            const Icon = t.icon
            return (
              <button
                key={t.id}
                type="button"
                className={tool === t.id ? 'active' : ''}
                aria-pressed={tool === t.id}
                title={`${t.label} (${t.key})`}
                aria-label={t.label}
                onClick={() => {
                  setTool(t.id)
                  setPoints([])
                }}
              >
                <Icon size={14} />
                <span>{t.label}</span>
              </button>
            )
          })}
          <span className="sep" />
          {tool === 'polygon' && (
            <label>
              Sides
              <input
                type="number"
                min={3}
                max={64}
                value={sides}
                aria-label="Polygon sides"
                onChange={(e) => setSides(Math.max(3, Math.min(64, Number(e.target.value) || 6)))}
              />
            </label>
          )}
          {tool === 'slot' && (
            <label>
              Width
              <input
                type="number"
                min={0.1}
                step={0.5}
                value={slotWidth}
                aria-label="Slot width"
                onChange={(e) => setSlotWidth(Math.max(0.1, Number(e.target.value) || 10))}
              />
            </label>
          )}
          <button
            type="button"
            title="Mirror the selected entity about the vertical axis"
            aria-label="Mirror vertical"
            disabled={!selectedEntity}
            onClick={() => mirrorSelected('x')}
          >
            <FlipHorizontal2 size={14} />
          </button>
          <button
            type="button"
            title="Mirror the selected entity about the horizontal axis"
            aria-label="Mirror horizontal"
            disabled={!selectedEntity}
            onClick={() => mirrorSelected('y')}
          >
            <FlipVertical2 size={14} />
          </button>
          <label>
            <button
              type="button"
              title="Offset the selected closed entity by the distance"
              aria-label="Offset entity"
              disabled={!selectedEntity || !entityLoop(selectedEntity)}
              onClick={offsetSelected}
            >
              <Copy size={14} />
            </button>
            <input
              type="number"
              step={0.5}
              value={offsetBy}
              aria-label="Offset distance"
              onChange={(e) => setOffsetBy(Number(e.target.value) || 0)}
            />
          </label>
          <button
            type="button"
            title="Delete the selected entity (Del)"
            aria-label="Delete entity"
            disabled={!selectedEntity}
            onClick={() => selected && remove(selected)}
          >
            <Trash2 size={14} />
          </button>
          <button type="button" title="Zoom to fit (F)" aria-label="Zoom to fit" onClick={fit}>
            <Focus size={14} />
          </button>
        </div>
      )}
      {selectedEntity && dims.length > 0 && (
        <div className="sk-dims" aria-label="Selected entity dimensions">
          <span className="sk-dims-title">{selectedEntity.kind}</span>
          {dims.map((d, i) => (
            <label key={d.label}>
              {d.label}
              <input
                type="number"
                step={0.5}
                min={0.01}
                value={Math.round(d.value * 100) / 100}
                disabled={readOnly}
                aria-label={d.label}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  if (v > 0) replace(selectedEntity.id, setEntityDimension(selectedEntity, i, v))
                }}
              />
            </label>
          ))}
        </div>
      )}
      <div className="sk-status" role="status">
        {planeLabel} plane · {cursor ? `${cursor.x.toFixed(2)}, ${cursor.y.toFixed(2)} mm` : ''}
        {snapNote ? ` · ${snapNote}` : ''} · {loops.length} closed{' '}
        {loops.length === 1 ? 'loop' : 'loops'}
        {!readOnly ? ` · ${HINTS[tool]}` : ''}
      </div>
    </div>
  )
}
