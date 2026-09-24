// The visual canvas editor: a zoomable SVG stage with selection, moving, resizing, rotating,
// connectors, and in-place text editing; a page strip; a toolbar; and the inspector. The
// editor receives a document and returns the next one through `onChange`; it never touches
// storage. Drags work on a transient copy and commit once on release, so undo steps and saves
// match gestures rather than pointer events.
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react'
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Grid3x3,
  Hand,
  Image as ImageIcon,
  Magnet,
  MousePointer2,
  Play,
  Plus,
  Redo2,
  Shapes,
  Spline,
  Trash2,
  Type,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { useDesign } from '../design/context'
import {
  MODE_LABELS,
  SHAPE_KINDS,
  attachedAnchor,
  cloneElements,
  expandGroups,
  freeAnchor,
  newConnector,
  newId,
  newImage,
  newPage,
  newShape,
  newText,
  pageNoun,
  updateElements,
  updatePage,
  type Anchor,
  type ConnectorElement,
  type CanvasDocument,
  type CanvasElement,
  type Page,
  type Point,
  type ShapeKind,
} from './model'
import {
  HANDLES,
  angleTo,
  center,
  connectorPoints,
  elementBounds,
  handlePosition,
  hitTest,
  intersects,
  moveElements,
  poseAt,
  resizeRect,
  rotatePoint,
  scaleElements,
  selectionBounds,
  snap,
  snapRect,
  type Guide,
  type HandleId,
  type Rect,
} from './geometry'
import { PageContent, PageView, shapePath } from './render'
import { downloadBlob, pagePng, pageSvg, printPdf, safeFilename } from './export'
import { importDrawio } from './drawio'
import { readImageFile } from './images'
import Inspector from './Inspector'
import CanvasPresenter from './CanvasPresenter'
import './canvas.css'

export type Tool = 'select' | 'pan' | 'text' | 'connector' | `shape:${ShapeKind}`
type View = { x: number; y: number; zoom: number }
type Drag =
  | { kind: 'move'; start: Point; ids: string[]; base: Page; moved: boolean }
  | { kind: 'marquee'; start: Point; current: Point }
  | { kind: 'pan'; start: Point; view: View }
  | {
      kind: 'resize'
      start: Point
      handle: HandleId
      base: Page
      ids: string[]
      bounds: Rect
      single: CanvasElement | null
    }
  | {
      kind: 'rotate'
      base: Page
      ids: string[]
      centerPoint: Point
      startAngle: number
      startRotations: Map<string, number>
    }
  | { kind: 'draw'; start: Point; current: Point; shape: ShapeKind }
  | { kind: 'connect'; start: Point; current: Point; fromId: string | null }
  | { kind: 'endpoint'; id: string; end: 'start' | 'end'; base: Page }
  | { kind: 'waypoint'; id: string; index: number; base: Page }

const MAX_HISTORY = 50
const SHAPE_LABELS: Record<ShapeKind, string> = {
  rect: 'Rectangle',
  ellipse: 'Ellipse',
  triangle: 'Triangle',
  rightTriangle: 'Right triangle',
  diamond: 'Diamond',
  parallelogram: 'Parallelogram',
  trapezoid: 'Trapezoid',
  pentagon: 'Pentagon',
  hexagon: 'Hexagon',
  octagon: 'Octagon',
  star: 'Star',
  arrow: 'Arrow',
  doubleArrow: 'Double arrow',
  chevron: 'Chevron',
  cylinder: 'Cylinder',
  cloud: 'Cloud',
  callout: 'Callout',
  cross: 'Cross',
  document: 'Document',
  cube: 'Cube',
  heart: 'Heart',
  line: 'Line',
}

export default function CanvasEditor({
  title,
  document: canvas,
  readOnly,
  unsaved,
  onBack,
  onChange,
}: {
  title: string
  document: CanvasDocument
  readOnly: boolean
  unsaved: boolean
  onBack: () => void
  onChange: (next: CanvasDocument) => boolean
}) {
  const design = useDesign()
  const [pageId, setPageId] = useState(canvas.pages[0].id)
  const [selected, setSelected] = useState<string[]>([])
  const [tool, setTool] = useState<Tool>('select')
  const [view, setView] = useState<View>({ x: 0, y: 0, zoom: 1 })
  const [live, setLive] = useState<CanvasDocument | null>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [guides, setGuides] = useState<Guide[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [history, setHistory] = useState<{ past: CanvasDocument[]; future: CanvasDocument[] }>({
    past: [],
    future: [],
  })
  const [clipboard, setClipboard] = useState<CanvasElement[]>([])
  const [shapeMenu, setShapeMenu] = useState(false)
  const [exportMenu, setExportMenu] = useState(false)
  const [presenting, setPresenting] = useState(false)
  const [spaceHeld, setSpaceHeld] = useState(false)
  const [message, setMessage] = useState('')
  const [time, setTime] = useState(0)
  const stage = useRef<HTMLDivElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const drawioInput = useRef<HTMLInputElement>(null)
  const textArea = useRef<HTMLTextAreaElement>(null)

  const doc = live ?? canvas
  const page = doc.pages.find((p) => p.id === pageId) ?? doc.pages[0]
  useEffect(() => {
    if (!canvas.pages.some((p) => p.id === pageId)) setPageId(canvas.pages[0].id)
  }, [canvas.pages, pageId])
  const selection = useMemo(
    () => page.elements.filter((e) => selected.includes(e.id)),
    [page.elements, selected],
  )
  const scope = `edit-${page.id}`
  // In animation mode the stage shows every element posed at the preview time (time 0 shows the
  // first keyframe of elements that have one). Elements being dragged show their working
  // position, because a drag at a preview time edits that pose.
  const animating = doc.mode === 'animation'
  const dragIds = drag && 'ids' in drag ? drag.ids : []
  const posedPage = useMemo(
    () =>
      animating
        ? {
            ...page,
            elements: page.elements.map((e) => (dragIds.includes(e.id) ? e : poseAt(e, time))),
          }
        : page,
    [animating, page, time, dragIds],
  )
  const posedSelection = useMemo(
    () => posedPage.elements.filter((e) => selected.includes(e.id)),
    [posedPage.elements, selected],
  )
  /** The page a gesture starts from: keyframed elements take their pose at the preview time. */
  const gestureBase = (ids: readonly string[]): Page =>
    animating
      ? {
          ...page,
          elements: page.elements.map((e) =>
            ids.includes(e.id) && e.keyframes.length ? poseAt(e, time) : e,
          ),
        }
      : page
  /** After a gesture at a preview time, record the new pose of keyframed elements as a keyframe. */
  const withAutoKeyframes = (next: CanvasDocument, ids: readonly string[]): CanvasDocument =>
    animating
      ? updateElements(next, page.id, (e) => {
          if (!ids.includes(e.id) || !e.keyframes.length || e.type === 'connector') return e
          const frame = {
            t: Math.round(time * 100) / 100,
            x: e.x,
            y: e.y,
            width: e.width,
            height: e.height,
            rotation: e.rotation,
            opacity: e.opacity,
          }
          const others = e.keyframes.filter((k) => Math.abs(k.t - frame.t) > 0.001)
          return { ...e, keyframes: [...others, frame].sort((a, b) => a.t - b.t).slice(0, 60) }
        })
      : next

  // --- Committing changes -----------------------------------------------------------------
  const apply = useCallback(
    (next: CanvasDocument, record = true) => {
      if (readOnly) return false
      if (record)
        setHistory((h) => ({ past: [...h.past.slice(-MAX_HISTORY + 1), canvas], future: [] }))
      setLive(null)
      return onChange(next)
    },
    [canvas, onChange, readOnly],
  )
  const changePage = (change: (p: Page) => Page, record = true) =>
    apply(updatePage(doc, page.id, change), record)
  const changeSelected = (change: (e: CanvasElement) => CanvasElement) =>
    changePage((p) => ({
      ...p,
      elements: p.elements.map((e) => (selected.includes(e.id) ? change(e) : e)),
    }))
  function undo() {
    const previous = history.past.at(-1)
    if (!previous) return
    setHistory({ past: history.past.slice(0, -1), future: [canvas, ...history.future] })
    onChange(previous)
    setSelected([])
  }
  function redo() {
    const next = history.future[0]
    if (!next) return
    setHistory({ past: [...history.past, canvas], future: history.future.slice(1) })
    onChange(next)
    setSelected([])
  }
  useEffect(() => {
    if (!message) return
    const t = setTimeout(() => setMessage(''), 5000)
    return () => clearTimeout(t)
  }, [message])

  // --- Coordinates -------------------------------------------------------------------------
  const toPage = useCallback(
    (event: { clientX: number; clientY: number }): Point => {
      const rect = stage.current!.getBoundingClientRect()
      return {
        x: (event.clientX - rect.left - view.x) / view.zoom,
        y: (event.clientY - rect.top - view.y) / view.zoom,
      }
    },
    [view],
  )
  const fitView = useCallback(() => {
    const el = stage.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const pad = 48
    const zoom = Math.min(
      (rect.width - pad * 2) / doc.page.width,
      (rect.height - pad * 2) / doc.page.height,
      2,
    )
    setView({
      zoom,
      x: (rect.width - doc.page.width * zoom) / 2,
      y: (rect.height - doc.page.height * zoom) / 2,
    })
  }, [doc.page.width, doc.page.height])
  useEffect(() => {
    fitView()
  }, [fitView, pageId])
  function zoomBy(factor: number, about?: Point) {
    const rect = stage.current!.getBoundingClientRect()
    const px = about ? about.x : rect.width / 2
    const py = about ? about.y : rect.height / 2
    setView((v) => {
      const zoom = Math.min(8, Math.max(0.05, v.zoom * factor))
      return { zoom, x: px - ((px - v.x) * zoom) / v.zoom, y: py - ((py - v.y) * zoom) / v.zoom }
    })
  }
  function wheel(event: ReactWheelEvent) {
    const rect = stage.current!.getBoundingClientRect()
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault()
      zoomBy(Math.exp(-event.deltaY * 0.002), {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      })
    } else setView((v) => ({ ...v, x: v.x - event.deltaX, y: v.y - event.deltaY }))
  }
  useEffect(() => {
    const el = stage.current
    if (!el) return
    const block = (e: WheelEvent) => e.preventDefault()
    el.addEventListener('wheel', block, { passive: false })
    return () => el.removeEventListener('wheel', block)
  }, [])

  // --- Hit testing --------------------------------------------------------------------------
  const topmostAt = (p: Point) =>
    [...posedPage.elements]
      .reverse()
      .find((e) => !e.locked && hitTest(e, posedPage, p, 4 / view.zoom)) ?? null
  const selectIds = (ids: string[], additive = false) => {
    const full = expandGroups(page, ids)
    setSelected(additive ? [...new Set([...selected, ...full])] : full)
  }

  // --- Pointer gestures on the stage ---------------------------------------------------------
  function pointerDown(event: ReactPointerEvent) {
    if (editingId) {
      commitText()
      return
    }
    if (event.button === 1 || tool === 'pan' || spaceHeld) {
      setDrag({ kind: 'pan', start: { x: event.clientX, y: event.clientY }, view })
      event.currentTarget.setPointerCapture(event.pointerId)
      return
    }
    if (event.button !== 0) return
    const p = toPage(event)
    event.currentTarget.setPointerCapture(event.pointerId)
    if (readOnly) {
      const hit = topmostAt(p)
      selectIds(hit ? [hit.id] : [])
      return
    }
    if (tool.startsWith('shape:')) {
      setDrag({ kind: 'draw', start: p, current: p, shape: tool.slice(6) as ShapeKind })
      return
    }
    if (tool === 'text') {
      const element = newText(snapPoint(p).x, snapPoint(p).y, '', 220, 40)
      element.textStyle = { ...element.textStyle, fontSize: 18 }
      changePage((pg) => ({ ...pg, elements: [...pg.elements, element] }))
      setSelected([element.id])
      setEditingId(element.id)
      setTool('select')
      return
    }
    if (tool === 'connector') {
      const hit = topmostAt(p)
      setDrag({
        kind: 'connect',
        start: p,
        current: p,
        fromId: hit && hit.type !== 'connector' ? hit.id : null,
      })
      return
    }
    const hit = topmostAt(p)
    if (!hit) {
      if (!event.shiftKey) setSelected([])
      setDrag({ kind: 'marquee', start: p, current: p })
      return
    }
    let ids = selected
    if (event.shiftKey) {
      const group = expandGroups(page, [hit.id])
      ids = selected.includes(hit.id)
        ? selected.filter((id) => !group.includes(id))
        : [...new Set([...selected, ...group])]
      setSelected(ids)
    } else if (!selected.includes(hit.id)) {
      ids = expandGroups(page, [hit.id])
      setSelected(ids)
    }
    const base = gestureBase(ids)
    if (base !== page) setLive(updatePage(canvas, page.id, () => base))
    setDrag({ kind: 'move', start: p, ids, base, moved: false })
  }
  const snapPoint = (p: Point): Point =>
    doc.grid.snap ? { x: snap(p.x, doc.grid.size), y: snap(p.y, doc.grid.size) } : p

  function pointerMove(event: ReactPointerEvent) {
    if (!drag) return
    const p = toPage(event)
    switch (drag.kind) {
      case 'pan':
        setView({
          ...drag.view,
          x: drag.view.x + event.clientX - drag.start.x,
          y: drag.view.y + event.clientY - drag.start.y,
        })
        return
      case 'marquee':
      case 'draw':
        setDrag({ ...drag, current: p })
        return
      case 'connect':
        setDrag({ ...drag, current: p })
        return
      case 'move': {
        const dx = p.x - drag.start.x
        const dy = p.y - drag.start.y
        if (!drag.moved && Math.hypot(dx, dy) * view.zoom < 3) return
        const moving = drag.base.elements.filter((e) => drag.ids.includes(e.id))
        const bounds = selectionBounds(moving, drag.base)
        const target = { ...bounds, x: bounds.x + dx, y: bounds.y + dy }
        const others = drag.base.elements
          .filter((e) => !drag.ids.includes(e.id))
          .map((e) => elementBounds(e, drag.base))
        const pageRect = doc.page.infinite
          ? []
          : [{ x: 0, y: 0, width: doc.page.width, height: doc.page.height }]
        const result = event.altKey
          ? { dx: 0, dy: 0, guides: [] as Guide[] }
          : snapRect(target, [...others, ...pageRect], doc.grid.size, doc.grid.snap, 6 / view.zoom)
        setGuides(result.guides)
        const moved = moveElements(moving, dx + result.dx, dy + result.dy)
        const byId = new Map(moved.map((e) => [e.id, e]))
        setLive(
          updatePage(canvas, page.id, (pg) => ({
            ...pg,
            elements: drag.base.elements.map((e) => byId.get(e.id) ?? e),
          })),
        )
        setDrag({ ...drag, moved: true })
        return
      }
      case 'resize': {
        const { bounds, handle, base, ids, single } = drag
        const keepAspect = event.shiftKey || (single?.type === 'image' && !event.altKey)
        let next: Rect
        if (single && single.rotation) {
          const c = center(single)
          const local = rotatePoint(p, c, -single.rotation)
          const startLocal = rotatePoint(drag.start, c, -single.rotation)
          next = resizeRect(
            bounds,
            handle,
            local.x - startLocal.x,
            local.y - startLocal.y,
            keepAspect,
          )
        } else next = resizeRect(bounds, handle, p.x - drag.start.x, p.y - drag.start.y, keepAspect)
        if (doc.grid.snap && !event.altKey && !single?.rotation) {
          const snapped = { ...next }
          if (handle.includes('e'))
            snapped.width = Math.max(4, snap(next.x + next.width, doc.grid.size) - next.x)
          if (handle.includes('s'))
            snapped.height = Math.max(4, snap(next.y + next.height, doc.grid.size) - next.y)
          if (handle.includes('w')) {
            const right = next.x + next.width
            snapped.x = snap(next.x, doc.grid.size)
            snapped.width = Math.max(4, right - snapped.x)
          }
          if (handle.includes('n')) {
            const bottom = next.y + next.height
            snapped.y = snap(next.y, doc.grid.size)
            snapped.height = Math.max(4, bottom - snapped.y)
          }
          if (!keepAspect) next = snapped
        }
        const elements = base.elements.filter((e) => ids.includes(e.id))
        let resized: CanvasElement[]
        if (single && single.rotation) {
          // Keep the element's center fixed relative to the handle being dragged.
          const oldCenter = center(bounds)
          const newCenterLocal = center(next)
          const rotatedNewCenter = rotatePoint(newCenterLocal, oldCenter, single.rotation)
          resized = [
            {
              ...single,
              x: rotatedNewCenter.x - next.width / 2,
              y: rotatedNewCenter.y - next.height / 2,
              width: next.width,
              height: next.height,
            },
          ]
        } else resized = scaleElements(elements, bounds, next)
        const byId = new Map(resized.map((e) => [e.id, e]))
        setLive(
          updatePage(canvas, page.id, (pg) => ({
            ...pg,
            elements: base.elements.map((e) => byId.get(e.id) ?? e),
          })),
        )
        return
      }
      case 'rotate': {
        const angle = angleTo(drag.centerPoint, p)
        let delta = angle - drag.startAngle
        if (!event.shiftKey) delta = Math.round(delta / 15) * 15 === delta ? delta : delta
        setLive(
          updatePage(canvas, page.id, (pg) => ({
            ...pg,
            elements: drag.base.elements.map((e) => {
              if (!drag.ids.includes(e.id) || e.type === 'connector') return e
              let rotation = (drag.startRotations.get(e.id) ?? 0) + delta
              if (event.shiftKey) rotation = Math.round(rotation / 15) * 15
              rotation = ((rotation % 360) + 360) % 360
              if (rotation > 180) rotation -= 360
              if (drag.ids.length === 1) return { ...e, rotation }
              const c = rotatePoint(center(e), drag.centerPoint, delta)
              return { ...e, rotation, x: c.x - e.width / 2, y: c.y - e.height / 2 }
            }),
          })),
        )
        return
      }
      case 'endpoint': {
        const hit = [...drag.base.elements]
          .reverse()
          .find((e) => e.id !== drag.id && e.type !== 'connector' && hitTest(e, drag.base, p, 0))
        setLive(
          updatePage(canvas, page.id, (pg) => ({
            ...pg,
            elements: drag.base.elements.map((e) =>
              e.id === drag.id && e.type === 'connector'
                ? {
                    ...e,
                    [drag.end]: hit
                      ? attachedAnchor(hit.id)
                      : freeAnchor(snapPoint(p).x, snapPoint(p).y),
                  }
                : e,
            ),
          })),
        )
        return
      }
      case 'waypoint':
        setLive(
          updatePage(canvas, page.id, (pg) => ({
            ...pg,
            elements: drag.base.elements.map((e) =>
              e.id === drag.id && e.type === 'connector'
                ? { ...e, points: e.points.map((pt, i) => (i === drag.index ? snapPoint(p) : pt)) }
                : e,
            ),
          })),
        )
        return
    }
  }
  function pointerUp(event: ReactPointerEvent) {
    if (!drag) return
    const p = toPage(event)
    setGuides([])
    switch (drag.kind) {
      case 'marquee': {
        const rect = rectFrom(drag.start, p)
        if (rect.width > 2 || rect.height > 2) {
          const ids = posedPage.elements
            .filter((e) => !e.locked && intersects(rect, elementBounds(e, posedPage)))
            .map((e) => e.id)
          selectIds(ids, event.shiftKey)
        }
        break
      }
      case 'draw': {
        let rect = rectFrom(snapPoint(drag.start), snapPoint(p))
        if (rect.width < 8 && rect.height < 8) {
          const s = snapPoint(drag.start)
          rect = {
            x: s.x,
            y: s.y,
            width: drag.shape === 'line' ? 160 : 160,
            height: drag.shape === 'line' ? 2 : 100,
          }
        }
        if (drag.shape === 'line') rect.height = Math.max(2, rect.height)
        const element = newShape(drag.shape, rect.x, rect.y, rect.width, rect.height)
        element.fill = drag.shape === 'line' ? 'none' : design.canvas.defaultFill
        element.stroke = { ...element.stroke, color: design.canvas.defaultStroke }
        changePage((pg) => ({ ...pg, elements: [...pg.elements, element] }))
        setSelected([element.id])
        setTool('select')
        break
      }
      case 'connect': {
        const hit = topmostAt(p)
        const toId = hit && hit.type !== 'connector' && hit.id !== drag.fromId ? hit.id : null
        if (!drag.fromId && !toId && Math.hypot(p.x - drag.start.x, p.y - drag.start.y) < 8) break
        const s = snapPoint(drag.start)
        const e = snapPoint(p)
        const element = newConnector(
          drag.fromId ? attachedAnchor(drag.fromId) : freeAnchor(s.x, s.y),
          toId ? attachedAnchor(toId) : freeAnchor(e.x, e.y),
        )
        element.stroke = { ...element.stroke, color: design.canvas.defaultStroke }
        changePage((pg) => ({ ...pg, elements: [...pg.elements, element] }))
        setSelected([element.id])
        break
      }
      case 'move':
        if (live && drag.moved) apply(withAutoKeyframes(live, drag.ids))
        else setLive(null)
        break
      case 'resize':
      case 'rotate':
        if (live) apply(withAutoKeyframes(live, drag.ids))
        break
      case 'endpoint':
      case 'waypoint':
        if (live) apply(live)
        break
    }
    setDrag(null)
  }
  const rectFrom = (a: Point, b: Point): Rect => ({
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  })

  function startHandle(event: ReactPointerEvent, handle: HandleId) {
    event.stopPropagation()
    if (readOnly || !selection.length) return
    const p = toPage(event)
    const base = gestureBase(selected)
    const chosen = base.elements.filter((e) => selected.includes(e.id))
    const single = chosen.length === 1 && chosen[0].type !== 'connector' ? chosen[0] : null
    const bounds = single
      ? { x: single.x, y: single.y, width: single.width, height: single.height }
      : selectionBounds(chosen, base)
    if (base !== page) setLive(updatePage(canvas, page.id, () => base))
    stage.current!.setPointerCapture(event.pointerId)
    setDrag({ kind: 'resize', start: p, handle, base, ids: selected, bounds, single })
  }
  function startRotate(event: ReactPointerEvent) {
    event.stopPropagation()
    if (readOnly || !selection.length) return
    const p = toPage(event)
    const base = gestureBase(selected)
    const chosen = base.elements.filter((e) => selected.includes(e.id))
    const c = center(selectionBounds(chosen, base))
    if (base !== page) setLive(updatePage(canvas, page.id, () => base))
    stage.current!.setPointerCapture(event.pointerId)
    setDrag({
      kind: 'rotate',
      base,
      ids: selected,
      centerPoint: c,
      startAngle: angleTo(c, p),
      startRotations: new Map(chosen.map((e) => [e.id, e.rotation])),
    })
  }
  function startEndpoint(event: ReactPointerEvent, id: string, end: 'start' | 'end') {
    event.stopPropagation()
    if (readOnly) return
    stage.current!.setPointerCapture(event.pointerId)
    setDrag({ kind: 'endpoint', id, end, base: page })
  }
  function startWaypoint(event: ReactPointerEvent, id: string, index: number) {
    event.stopPropagation()
    if (readOnly) return
    stage.current!.setPointerCapture(event.pointerId)
    setDrag({ kind: 'waypoint', id, index, base: page })
  }
  function addWaypoint(event: ReactPointerEvent, connector: CanvasElement) {
    if (connector.type !== 'connector' || readOnly) return
    event.stopPropagation()
    const p = snapPoint(toPage(event))
    const pts = connectorPoints(connector, page)
    let best = 0
    let bestDistance = Infinity
    for (let i = 1; i < pts.length; i++) {
      const d = Math.hypot(p.x - (pts[i - 1].x + pts[i].x) / 2, p.y - (pts[i - 1].y + pts[i].y) / 2)
      if (d < bestDistance) {
        bestDistance = d
        best = i - 1
      }
    }
    changePage((pg) => ({
      ...pg,
      elements: pg.elements.map((e) =>
        e.id === connector.id && e.type === 'connector'
          ? { ...e, points: [...e.points.slice(0, best), p, ...e.points.slice(best)] }
          : e,
      ),
    }))
  }

  // --- Text editing ---------------------------------------------------------------------------
  const editing = editingId ? page.elements.find((e) => e.id === editingId) : null
  const [draftText, setDraftText] = useState('')
  useEffect(() => {
    if (!editing) return
    setDraftText(
      editing.type === 'connector' ? editing.label : 'text' in editing ? editing.text : '',
    )
    setTimeout(() => {
      textArea.current?.focus()
      textArea.current?.select()
    }, 0)
  }, [editingId]) // eslint-disable-line react-hooks/exhaustive-deps
  function commitText() {
    if (!editing) return
    const value = draftText
    setEditingId(null)
    if (editing.type === 'text' && !value.trim()) {
      changePage((pg) => ({ ...pg, elements: pg.elements.filter((e) => e.id !== editing.id) }))
      setSelected([])
      return
    }
    const current =
      editing.type === 'connector' ? editing.label : 'text' in editing ? editing.text : ''
    if (value === current) return
    changePage((pg) => ({
      ...pg,
      elements: pg.elements.map((e) =>
        e.id !== editing.id
          ? e
          : e.type === 'connector'
            ? { ...e, label: value }
            : e.type === 'text' || e.type === 'shape'
              ? { ...e, text: value }
              : e,
      ),
    }))
  }
  function doubleClick(event: ReactPointerEvent | React.MouseEvent) {
    if (readOnly) return
    const p = toPage(event)
    const hit = topmostAt(p)
    if (hit && hit.type !== 'image') {
      setSelected([hit.id])
      setEditingId(hit.id)
    } else if (!hit) {
      const element = newText(snapPoint(p).x, snapPoint(p).y, '', 220, 40)
      changePage((pg) => ({ ...pg, elements: [...pg.elements, element] }))
      setSelected([element.id])
      setEditingId(element.id)
    }
  }

  // --- Editing operations -----------------------------------------------------------------------
  function remove() {
    if (!selected.length) return
    changePage((pg) => ({
      ...pg,
      elements: pg.elements
        .filter((e) => !selected.includes(e.id))
        .map((e) =>
          e.type === 'connector'
            ? {
                ...e,
                start: selected.includes(e.start.elementId ?? '')
                  ? detach(e.start, e, 'start')
                  : e.start,
                end: selected.includes(e.end.elementId ?? '') ? detach(e.end, e, 'end') : e.end,
              }
            : e,
        ),
    }))
    setSelected([])
  }
  const detach = (_anchor: Anchor, connector: ConnectorElement, end: 'start' | 'end') => {
    const pts = connectorPoints(connector, page)
    const p = end === 'start' ? pts[0] : pts[pts.length - 1]
    return freeAnchor(p.x, p.y)
  }
  function duplicate(offset = 20) {
    if (!selection.length) return
    const copies = cloneElements(selection, offset, offset)
    changePage((pg) => ({ ...pg, elements: [...pg.elements, ...copies] }))
    setSelected(copies.map((e) => e.id))
  }
  function copy() {
    if (selection.length) setClipboard(structuredClone(selection))
  }
  function paste() {
    if (!clipboard.length) return
    const copies = cloneElements(clipboard, 20, 20)
    changePage((pg) => ({ ...pg, elements: [...pg.elements, ...copies] }))
    setSelected(copies.map((e) => e.id))
  }
  function group() {
    if (selection.length < 2) return
    const id = newId()
    changeSelected((e) => ({ ...e, groupId: id }))
  }
  function ungroup() {
    changeSelected((e) => ({ ...e, groupId: null }))
  }
  function reorder(direction: 'front' | 'back' | 'forward' | 'backward') {
    if (!selected.length) return
    changePage((pg) => {
      const chosen = pg.elements.filter((e) => selected.includes(e.id))
      const rest = pg.elements.filter((e) => !selected.includes(e.id))
      if (direction === 'front') return { ...pg, elements: [...rest, ...chosen] }
      if (direction === 'back') return { ...pg, elements: [...chosen, ...rest] }
      const elements = [...pg.elements]
      const indexes = elements
        .map((e, i) => (selected.includes(e.id) ? i : -1))
        .filter((i) => i >= 0)
      if (direction === 'forward') {
        for (const i of indexes.reverse())
          if (i < elements.length - 1 && !selected.includes(elements[i + 1].id))
            [elements[i], elements[i + 1]] = [elements[i + 1], elements[i]]
      } else {
        for (const i of indexes)
          if (i > 0 && !selected.includes(elements[i - 1].id))
            [elements[i], elements[i - 1]] = [elements[i - 1], elements[i]]
      }
      return { ...pg, elements }
    })
  }
  function nudge(dx: number, dy: number) {
    if (!selection.length || readOnly) return
    const moved = moveElements(selection, dx, dy)
    const byId = new Map(moved.map((e) => [e.id, e]))
    changePage((pg) => ({ ...pg, elements: pg.elements.map((e) => byId.get(e.id) ?? e) }))
  }
  function align(kind: 'left' | 'centerX' | 'right' | 'top' | 'centerY' | 'bottom') {
    if (!selection.length) return
    const target =
      selection.length === 1
        ? { x: 0, y: 0, width: doc.page.width, height: doc.page.height }
        : selectionBounds(selection, page)
    changePage((pg) => ({
      ...pg,
      elements: pg.elements.map((e) => {
        if (!selected.includes(e.id) || e.type === 'connector') return e
        const b = elementBounds(e, pg)
        let dx = 0
        let dy = 0
        if (kind === 'left') dx = target.x - b.x
        if (kind === 'right') dx = target.x + target.width - (b.x + b.width)
        if (kind === 'centerX') dx = target.x + target.width / 2 - (b.x + b.width / 2)
        if (kind === 'top') dy = target.y - b.y
        if (kind === 'bottom') dy = target.y + target.height - (b.y + b.height)
        if (kind === 'centerY') dy = target.y + target.height / 2 - (b.y + b.height / 2)
        return moveElements([e], dx, dy)[0]
      }),
    }))
  }

  // --- Pages ----------------------------------------------------------------------------------
  function addPage(after = doc.pages.length - 1, copy = false) {
    const source = doc.pages[after]
    const fresh = copy
      ? {
          ...structuredClone(source),
          id: newId(),
          name: `${source.name} copy`,
          elements: cloneElements(source.elements),
        }
      : {
          ...newPage(`${pageNoun(doc.mode)} ${doc.pages.length + 1}`),
          background: source?.background ?? '#ffffff',
        }
    const pages = [...doc.pages]
    pages.splice(after + 1, 0, fresh)
    if (apply({ ...doc, pages })) {
      setPageId(fresh.id)
      setSelected([])
    }
  }
  function removePage(id: string) {
    if (doc.pages.length < 2) return
    const index = doc.pages.findIndex((p) => p.id === id)
    const pages = doc.pages.filter((p) => p.id !== id)
    if (apply({ ...doc, pages })) setPageId(pages[Math.max(0, index - 1)].id)
  }
  function movePage(id: string, delta: number) {
    const index = doc.pages.findIndex((p) => p.id === id)
    const target = index + delta
    if (target < 0 || target >= doc.pages.length) return
    const pages = [...doc.pages]
    ;[pages[index], pages[target]] = [pages[target], pages[index]]
    apply({ ...doc, pages })
  }

  // --- Images and imports ---------------------------------------------------------------------
  async function addImages(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])]
    event.target.value = ''
    await insertImageFiles(files)
  }
  /** Place image files on the current page, centred and slightly cascaded. */
  async function insertImageFiles(files: File[]) {
    let offset = 0
    let next = doc
    for (const file of files) {
      try {
        const { src, width, height } = await readImageFile(file)
        const scale = Math.min(1, (doc.page.width * 0.6) / width, (doc.page.height * 0.6) / height)
        const w = Math.round(width * scale)
        const h = Math.round(height * scale)
        const element = newImage(
          src,
          Math.round((doc.page.width - w) / 2) + offset,
          Math.round((doc.page.height - h) / 2) + offset,
          w,
          h,
        )
        element.alt = file.name.replace(/\.[^.]+$/, '')
        next = updatePage(next, page.id, (pg) => ({ ...pg, elements: [...pg.elements, element] }))
        offset += 24
        setSelected([element.id])
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'That image could not be added.')
      }
    }
    if (next !== doc && !apply(next))
      setMessage('The images could not be saved. They may pass the canvas storage limit.')
  }
  async function importDrawioFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const text = await file.text()
      const result = await importDrawio(text, doc)
      if (apply(result.document)) {
        setPageId(result.document.pages[result.firstNewPage].id)
        setSelected([])
        setMessage(
          `Imported ${result.pages} ${result.pages === 1 ? 'page' : 'pages'} with ${result.elements} elements${result.skipped ? `; ${result.skipped} unsupported cells became plain shapes` : ''}.`,
        )
      } else setMessage('The import could not be saved. It may pass the canvas storage limit.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'That file is not a draw.io diagram.')
    }
  }
  async function copyAsImage() {
    setExportMenu(false)
    try {
      const blob = await pagePng(doc, page, 2)
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      setMessage(`Copied ${page.name} as an image.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The image could not be copied.')
    }
  }
  async function exportAs(kind: 'svg' | 'png' | 'png3' | 'pdf') {
    setExportMenu(false)
    const name = `${safeFilename(title)}-${safeFilename(page.name)}`
    try {
      if (kind === 'svg')
        downloadBlob(new Blob([pageSvg(doc, page)], { type: 'image/svg+xml' }), `${name}.svg`)
      else if (kind === 'pdf') printPdf(doc, title)
      else downloadBlob(await pagePng(doc, page, kind === 'png3' ? 3 : 2), `${name}.png`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The export failed.')
    }
  }

  // --- Clipboard images -----------------------------------------------------------------------
  useEffect(() => {
    if (readOnly || presenting) return
    const pasted = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.isContentEditable || target instanceof HTMLInputElement) return
      const files = [...(event.clipboardData?.files ?? [])].filter((f) =>
        f.type.startsWith('image/'),
      )
      if (!files.length) return
      event.preventDefault()
      void insertImageFiles(files)
    }
    window.addEventListener('paste', pasted)
    return () => window.removeEventListener('paste', pasted)
  })

  // --- Keyboard -------------------------------------------------------------------------------
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target.isContentEditable
      if (presenting) return
      if (event.key === ' ' && !typing) {
        setSpaceHeld(true)
        event.preventDefault()
        return
      }
      if (typing) return
      const mod = event.ctrlKey || event.metaKey
      const key = event.key.toLowerCase()
      if (mod && key === 'z') {
        event.preventDefault()
        event.shiftKey ? redo() : undo()
      } else if (mod && key === 'y') {
        event.preventDefault()
        redo()
      } else if (mod && key === 'd') {
        event.preventDefault()
        duplicate()
      } else if (mod && key === 'c') copy()
      else if (mod && key === 'v') paste()
      else if (mod && key === 'x') {
        copy()
        remove()
      } else if (mod && key === 'a') {
        event.preventDefault()
        setSelected(page.elements.filter((e) => !e.locked).map((e) => e.id))
      } else if (mod && key === 'g') {
        event.preventDefault()
        event.shiftKey ? ungroup() : group()
      } else if (mod && (key === '=' || key === '+')) {
        event.preventDefault()
        zoomBy(1.25)
      } else if (mod && key === '-') {
        event.preventDefault()
        zoomBy(0.8)
      } else if (mod && key === '0') {
        event.preventDefault()
        fitView()
      } else if (key === 'delete' || key === 'backspace') remove()
      else if (key === 'escape') {
        setSelected([])
        setTool('select')
        setShapeMenu(false)
        setExportMenu(false)
      } else if (key === 'arrowleft') nudge(event.shiftKey ? -10 : -1, 0)
      else if (key === 'arrowright') nudge(event.shiftKey ? 10 : 1, 0)
      else if (key === 'arrowup') nudge(0, event.shiftKey ? -10 : -1)
      else if (key === 'arrowdown') nudge(0, event.shiftKey ? 10 : 1)
      else if (key === ']') reorder(mod ? 'front' : 'forward')
      else if (key === '[') reorder(mod ? 'back' : 'backward')
      else if (key === 'enter' && selection.length === 1 && selection[0].type !== 'image') {
        event.preventDefault()
        setEditingId(selection[0].id)
      } else if (!mod) {
        if (key === 'v') setTool('select')
        else if (key === 'h') setTool('pan')
        else if (key === 't') setTool('text')
        else if (key === 'l') setTool('connector')
        else if (key === 'r') setTool('shape:rect')
        else if (key === 'o') setTool('shape:ellipse')
      }
    }
    const up = (event: KeyboardEvent) => {
      if (event.key === ' ') setSpaceHeld(false)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  })

  // --- Rendering helpers --------------------------------------------------------------------
  const bounds = posedSelection.length ? selectionBounds(posedSelection, posedPage) : null
  const single = posedSelection.length === 1 ? posedSelection[0] : null
  const handleBox: Rect | null =
    single && single.type !== 'connector'
      ? { x: single.x, y: single.y, width: single.width, height: single.height }
      : bounds
  const handleRotation = single && single.type !== 'connector' ? single.rotation : 0
  const hs = 8 / view.zoom
  const cursor =
    drag?.kind === 'pan' || tool === 'pan' || spaceHeld
      ? 'grab'
      : tool === 'text'
        ? 'text'
        : tool === 'select'
          ? 'default'
          : 'crosshair'
  const visibleRect: Rect = stage.current
    ? {
        x: -view.x / view.zoom,
        y: -view.y / view.zoom,
        width: stage.current.clientWidth / view.zoom,
        height: stage.current.clientHeight / view.zoom,
      }
    : { x: 0, y: 0, width: 0, height: 0 }
  const gridLines = useMemo(() => {
    if (!doc.grid.show) return null
    const size = doc.grid.size
    if (size * view.zoom < 5) return null
    const area = doc.page.infinite
      ? visibleRect
      : { x: 0, y: 0, width: doc.page.width, height: doc.page.height }
    const lines: string[] = []
    const startX = Math.floor(area.x / size) * size
    const startY = Math.floor(area.y / size) * size
    for (let x = startX; x <= area.x + area.width; x += size)
      lines.push(`M${x} ${area.y}V${area.y + area.height}`)
    for (let y = startY; y <= area.y + area.height; y += size)
      lines.push(`M${area.x} ${y}H${area.x + area.width}`)
    return lines.join('')
  }, [doc.grid, doc.page, view, visibleRect.width, visibleRect.height]) // eslint-disable-line react-hooks/exhaustive-deps
  const editingBox = editing ? screenRect(elementBounds(editing, posedPage), view) : null
  const textStyle = editing
    ? editing.type === 'connector'
      ? editing.textStyle
      : 'textStyle' in editing
        ? editing.textStyle
        : null
    : null
  return (
    <div className={`canvas-editor mode-${doc.mode}`}>
      {presenting && (
        <div className="canvas-present-overlay">
          <CanvasPresenter
            document={canvas}
            title={`${title} · ${MODE_LABELS[canvas.mode]}`}
            startPage={page.id}
            onExit={() => setPresenting(false)}
          />
        </div>
      )}
      <div className="canvas-heading">
        <div>
          <button className="back-link" onClick={onBack}>
            <ArrowLeft size={15} />
            Back to project
          </button>
          <div className="eyebrow">VISUAL CANVAS · {MODE_LABELS[doc.mode].toUpperCase()}</div>
          <h1>{title}</h1>
        </div>
        <div className="canvas-heading-actions">
          {unsaved && <span className="unsaved-note">Changes not saved</span>}
          {readOnly && <span className="unsaved-note">Read only</span>}
          <div className="canvas-menu-anchor">
            <button
              className="button"
              onClick={() => setExportMenu(!exportMenu)}
              aria-expanded={exportMenu}
            >
              <Download size={15} />
              Export
            </button>
            {exportMenu && (
              <div className="canvas-menu" role="menu">
                <button role="menuitem" onClick={() => exportAs('svg')}>
                  This canvas as SVG
                </button>
                <button role="menuitem" onClick={() => exportAs('png')}>
                  This canvas as PNG (2×)
                </button>
                <button role="menuitem" onClick={() => exportAs('png3')}>
                  This canvas as PNG (3×)
                </button>
                <button role="menuitem" onClick={copyAsImage}>
                  Copy as image
                </button>
                <button role="menuitem" onClick={() => exportAs('pdf')}>
                  All canvases as PDF (print)
                </button>
                <button
                  role="menuitem"
                  onClick={() => {
                    setExportMenu(false)
                    drawioInput.current?.click()
                  }}
                >
                  Import draw.io file…
                </button>
              </div>
            )}
          </div>
          <button className="button primary" onClick={() => setPresenting(true)}>
            <Play size={15} />
            {doc.mode === 'deck'
              ? 'Present'
              : doc.mode === 'mockup'
                ? 'Preview'
                : doc.mode === 'animation'
                  ? 'Play'
                  : 'View'}
          </button>
        </div>
      </div>
      <div className="canvas-toolbar" role="toolbar" aria-label="Canvas tools">
        <ToolButton active={tool === 'select'} label="Select (V)" onClick={() => setTool('select')}>
          <MousePointer2 size={17} />
        </ToolButton>
        <ToolButton active={tool === 'pan'} label="Pan (H)" onClick={() => setTool('pan')}>
          <Hand size={17} />
        </ToolButton>
        <span className="canvas-toolbar-gap" />
        <div className="canvas-menu-anchor">
          <ToolButton
            active={tool.startsWith('shape:')}
            label="Shapes (R, O)"
            onClick={() => setShapeMenu(!shapeMenu)}
            disabled={readOnly}
          >
            <Shapes size={17} />
            <ChevronDown size={12} />
          </ToolButton>
          {shapeMenu && (
            <div className="canvas-menu shapes" role="menu">
              {SHAPE_KINDS.map((kind) => (
                <button
                  key={kind}
                  role="menuitem"
                  title={SHAPE_LABELS[kind]}
                  aria-label={SHAPE_LABELS[kind]}
                  onClick={() => {
                    setTool(`shape:${kind}`)
                    setShapeMenu(false)
                  }}
                >
                  <svg viewBox="-2 -2 44 34" width="40" height="30" aria-hidden="true">
                    <path
                      d={shapePath(kind, 40, 30, 4)}
                      fill="var(--soft)"
                      stroke="var(--ink)"
                      strokeWidth="1.5"
                    />
                  </svg>
                </button>
              ))}
            </div>
          )}
        </div>
        <ToolButton
          active={tool === 'text'}
          label="Text (T)"
          onClick={() => setTool('text')}
          disabled={readOnly}
        >
          <Type size={17} />
        </ToolButton>
        <ToolButton
          active={tool === 'connector'}
          label="Connector (L)"
          onClick={() => setTool('connector')}
          disabled={readOnly}
        >
          <Spline size={17} />
        </ToolButton>
        <ToolButton
          label="Add image"
          onClick={() => fileInput.current?.click()}
          disabled={readOnly}
        >
          <ImageIcon size={17} />
        </ToolButton>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={addImages}
          aria-label="Image files"
        />
        <input
          ref={drawioInput}
          type="file"
          accept=".drawio,.xml,text/xml,application/xml"
          hidden
          onChange={importDrawioFile}
          aria-label="draw.io file"
        />
        <span className="canvas-toolbar-gap" />
        <ToolButton
          label="Undo (Ctrl+Z)"
          onClick={undo}
          disabled={readOnly || !history.past.length}
        >
          <Undo2 size={17} />
        </ToolButton>
        <ToolButton
          label="Redo (Ctrl+Y)"
          onClick={redo}
          disabled={readOnly || !history.future.length}
        >
          <Redo2 size={17} />
        </ToolButton>
        <span className="canvas-toolbar-gap" />
        <ToolButton
          label="Duplicate (Ctrl+D)"
          onClick={() => duplicate()}
          disabled={readOnly || !selection.length}
        >
          <Copy size={17} />
        </ToolButton>
        <ToolButton label="Delete" onClick={remove} disabled={readOnly || !selection.length}>
          <Trash2 size={17} />
        </ToolButton>
        <span className="canvas-toolbar-gap" />
        <ToolButton
          active={doc.grid.show}
          label="Show grid"
          onClick={() => apply({ ...doc, grid: { ...doc.grid, show: !doc.grid.show } }, false)}
          disabled={readOnly}
        >
          <Grid3x3 size={17} />
        </ToolButton>
        <ToolButton
          active={doc.grid.snap}
          label="Snap to grid"
          onClick={() => apply({ ...doc, grid: { ...doc.grid, snap: !doc.grid.snap } }, false)}
          disabled={readOnly}
        >
          <Magnet size={17} />
        </ToolButton>
        <span className="canvas-toolbar-gap" />
        <ToolButton label="Zoom out (Ctrl+-)" onClick={() => zoomBy(0.8)}>
          <ZoomOut size={17} />
        </ToolButton>
        <button className="canvas-zoom-value" onClick={fitView} title="Fit canvas (Ctrl+0)">
          {Math.round(view.zoom * 100)}%
        </button>
        <ToolButton label="Zoom in (Ctrl+=)" onClick={() => zoomBy(1.25)}>
          <ZoomIn size={17} />
        </ToolButton>
        {message && (
          <span className="canvas-message" role="status">
            {message}
          </span>
        )}
      </div>
      <div className="canvas-body">
        <aside className="canvas-strip" aria-label={`${pageNoun(doc.mode)}s`}>
          <ol>
            {doc.pages.map((p, index) => (
              <li key={p.id} className={p.id === page.id ? 'current' : ''}>
                <button
                  type="button"
                  className="canvas-thumb"
                  aria-current={p.id === page.id ? 'page' : undefined}
                  aria-label={`${p.name}, ${pageNoun(doc.mode).toLowerCase()} ${index + 1} of ${doc.pages.length}`}
                  onClick={() => {
                    setPageId(p.id)
                    setSelected([])
                    setEditingId(null)
                  }}
                  style={{ aspectRatio: `${doc.page.width} / ${doc.page.height}` }}
                >
                  <PageView
                    page={p}
                    size={doc.page}
                    scope={`thumb-${p.id}`}
                    className="canvas-thumb-svg"
                  />
                </button>
                <div className="canvas-thumb-meta">
                  <span>{index + 1}</span>
                  <span className="canvas-thumb-name">{p.name}</span>
                  {!readOnly && (
                    <span className="canvas-thumb-actions">
                      <button
                        type="button"
                        aria-label={`Move ${p.name} up`}
                        onClick={() => movePage(p.id, -1)}
                        disabled={index === 0}
                      >
                        <ChevronUp size={12} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Move ${p.name} down`}
                        onClick={() => movePage(p.id, 1)}
                        disabled={index === doc.pages.length - 1}
                      >
                        <ChevronDown size={12} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Duplicate ${p.name}`}
                        onClick={() => addPage(index, true)}
                      >
                        <Copy size={12} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${p.name}`}
                        onClick={() => removePage(p.id)}
                        disabled={doc.pages.length < 2}
                      >
                        <Trash2 size={12} />
                      </button>
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ol>
          {!readOnly && (
            <button type="button" className="button canvas-add-page" onClick={() => addPage()}>
              <Plus size={14} />
              Add {pageNoun(doc.mode).toLowerCase()}
            </button>
          )}
        </aside>
        <div
          className="canvas-stage"
          ref={stage}
          style={{ cursor }}
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerUp}
          onPointerCancel={() => {
            setDrag(null)
            setLive(null)
            setGuides([])
          }}
          onDoubleClick={doubleClick}
          onWheel={wheel}
        >
          <svg
            className="canvas-stage-svg"
            width="100%"
            height="100%"
            aria-label={`${page.name} canvas`}
          >
            <g transform={`translate(${view.x} ${view.y}) scale(${view.zoom})`}>
              {!doc.page.infinite && (
                <rect
                  className="canvas-page-shadow"
                  x={0}
                  y={0}
                  width={doc.page.width}
                  height={doc.page.height}
                />
              )}
              <PageContent page={posedPage} size={doc.page} scope={scope} editingId={editingId} />
              {gridLines && (
                <path className="canvas-grid" d={gridLines} strokeWidth={1 / view.zoom} />
              )}
              {/* Selection outlines and handles */}
              {posedSelection.map((e) => {
                if (e.type === 'connector') {
                  const pts = connectorPoints(e, posedPage)
                  return (
                    <g key={e.id} className="canvas-connector-handles">
                      <path
                        d={pts.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join('')}
                        className="canvas-selection-hitline"
                        strokeWidth={12 / view.zoom}
                        onPointerDown={(ev) => addWaypoint(ev, e)}
                      />
                      {e.points.map((p, i) => (
                        <circle
                          key={i}
                          cx={p.x}
                          cy={p.y}
                          r={hs / 1.6}
                          className="canvas-handle waypoint"
                          onPointerDown={(ev) => startWaypoint(ev, e.id, i)}
                          onDoubleClick={(ev) => {
                            ev.stopPropagation()
                            changePage((pg) => ({
                              ...pg,
                              elements: pg.elements.map((c) =>
                                c.id === e.id && c.type === 'connector'
                                  ? { ...c, points: c.points.filter((_, j) => j !== i) }
                                  : c,
                              ),
                            }))
                          }}
                        />
                      ))}
                      <circle
                        cx={pts[0].x}
                        cy={pts[0].y}
                        r={hs / 1.3}
                        className={`canvas-handle endpoint ${e.start.elementId ? 'attached' : ''}`}
                        onPointerDown={(ev) => startEndpoint(ev, e.id, 'start')}
                      />
                      <circle
                        cx={pts[pts.length - 1].x}
                        cy={pts[pts.length - 1].y}
                        r={hs / 1.3}
                        className={`canvas-handle endpoint ${e.end.elementId ? 'attached' : ''}`}
                        onPointerDown={(ev) => startEndpoint(ev, e.id, 'end')}
                      />
                    </g>
                  )
                }
                if (selection.length > 1)
                  return (
                    <rect
                      key={e.id}
                      className="canvas-selection-outline"
                      x={e.x}
                      y={e.y}
                      width={e.width}
                      height={e.height}
                      transform={
                        e.rotation
                          ? `rotate(${e.rotation} ${e.x + e.width / 2} ${e.y + e.height / 2})`
                          : undefined
                      }
                      strokeWidth={1 / view.zoom}
                    />
                  )
                return null
              })}
              {handleBox && !editingId && (
                <g
                  className="canvas-handles"
                  transform={
                    handleRotation
                      ? `rotate(${handleRotation} ${handleBox.x + handleBox.width / 2} ${handleBox.y + handleBox.height / 2})`
                      : undefined
                  }
                >
                  <rect
                    className="canvas-selection-box"
                    x={handleBox.x}
                    y={handleBox.y}
                    width={handleBox.width}
                    height={handleBox.height}
                    strokeWidth={1 / view.zoom}
                  />
                  {!readOnly && (single === null || single.type !== 'connector') && (
                    <>
                      {HANDLES.map((handle) => {
                        const p = handlePosition(handleBox, handle)
                        return (
                          <rect
                            key={handle}
                            className="canvas-handle"
                            x={p.x - hs / 2}
                            y={p.y - hs / 2}
                            width={hs}
                            height={hs}
                            strokeWidth={1 / view.zoom}
                            style={{ cursor: `${handle}-resize` }}
                            onPointerDown={(ev) => startHandle(ev, handle)}
                          />
                        )
                      })}
                      <line
                        className="canvas-rotate-stem"
                        x1={handleBox.x + handleBox.width / 2}
                        y1={handleBox.y}
                        x2={handleBox.x + handleBox.width / 2}
                        y2={handleBox.y - 24 / view.zoom}
                        strokeWidth={1 / view.zoom}
                      />
                      <circle
                        className="canvas-handle rotate"
                        cx={handleBox.x + handleBox.width / 2}
                        cy={handleBox.y - 24 / view.zoom}
                        r={hs / 1.5}
                        strokeWidth={1 / view.zoom}
                        onPointerDown={startRotate}
                      />
                    </>
                  )}
                </g>
              )}
              {guides.map((g, i) =>
                g.axis === 'x' ? (
                  <line
                    key={i}
                    className="canvas-guide"
                    x1={g.at}
                    x2={g.at}
                    y1={visibleRect.y}
                    y2={visibleRect.y + visibleRect.height}
                    strokeWidth={1 / view.zoom}
                  />
                ) : (
                  <line
                    key={i}
                    className="canvas-guide"
                    y1={g.at}
                    y2={g.at}
                    x1={visibleRect.x}
                    x2={visibleRect.x + visibleRect.width}
                    strokeWidth={1 / view.zoom}
                  />
                ),
              )}
              {drag?.kind === 'marquee' && (
                <rect
                  className="canvas-marquee"
                  {...rectFrom(drag.start, drag.current)}
                  strokeWidth={1 / view.zoom}
                />
              )}
              {drag?.kind === 'draw' && (
                <path
                  className="canvas-draw-preview"
                  d={shapePath(
                    drag.shape,
                    Math.max(1, Math.abs(drag.current.x - drag.start.x)),
                    Math.max(1, Math.abs(drag.current.y - drag.start.y)),
                  )}
                  transform={`translate(${Math.min(drag.start.x, drag.current.x)} ${Math.min(drag.start.y, drag.current.y)})`}
                  strokeWidth={1.5 / view.zoom}
                />
              )}
              {drag?.kind === 'connect' && (
                <line
                  className="canvas-draw-preview"
                  x1={drag.start.x}
                  y1={drag.start.y}
                  x2={drag.current.x}
                  y2={drag.current.y}
                  strokeWidth={1.5 / view.zoom}
                />
              )}
            </g>
          </svg>
          {design.canvas.showRulers && (
            <Rulers
              view={view}
              width={stage.current?.clientWidth ?? 0}
              height={stage.current?.clientHeight ?? 0}
            />
          )}
          {editing && editingBox && textStyle && (
            <textarea
              ref={textArea}
              className="canvas-text-editor"
              aria-label="Edit text"
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              onBlur={commitText}
              onKeyDown={(e) => {
                if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
                  e.preventDefault()
                  commitText()
                }
                e.stopPropagation()
              }}
              onPointerDown={(e) => e.stopPropagation()}
              style={{
                left: editingBox.x,
                top: editingBox.y,
                width: Math.max(80, editingBox.width),
                height: Math.max(32, editingBox.height),
                fontFamily: textStyle.fontFamily,
                fontSize: textStyle.fontSize * view.zoom,
                fontWeight: textStyle.bold ? 700 : 400,
                fontStyle: textStyle.italic ? 'italic' : 'normal',
                color: textStyle.color,
                textAlign: textStyle.align,
                lineHeight: textStyle.lineHeight,
                transform:
                  editing.type !== 'connector' && editing.rotation
                    ? `rotate(${editing.rotation}deg)`
                    : undefined,
              }}
            />
          )}
          {doc.mode === 'animation' && (
            <div className="canvas-timeline" onPointerDown={(e) => e.stopPropagation()}>
              <span>Preview time</span>
              <input
                type="range"
                aria-label="Preview time"
                min={0}
                max={page.duration}
                step={0.05}
                value={time}
                onChange={(e) => setTime(Number(e.target.value))}
              />
              <span>
                {time.toFixed(2)}s / {page.duration}s
              </span>
              <button
                type="button"
                className="button"
                onClick={() => setTime(0)}
                disabled={time === 0}
              >
                Back to start
              </button>
            </div>
          )}
        </div>
        <Inspector
          document={doc}
          page={page}
          selection={selection}
          readOnly={readOnly}
          time={time}
          onDocument={(next, record = true) => apply(next, record)}
          onPage={(change) => changePage(change)}
          onSelected={changeSelected}
          onSelect={setSelected}
          onReorder={reorder}
          onGroup={group}
          onUngroup={ungroup}
          onAlign={align}
          onEditText={() => single && setEditingId(single.id)}
          onFit={fitView}
        />
      </div>
    </div>
  )
}

function screenRect(r: Rect, view: View): Rect {
  return {
    x: r.x * view.zoom + view.x,
    y: r.y * view.zoom + view.y,
    width: r.width * view.zoom,
    height: r.height * view.zoom,
  }
}

function ToolButton({
  children,
  label,
  onClick,
  active = false,
  disabled = false,
}: {
  children: React.ReactNode
  label: string
  onClick: () => void
  active?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      className={`canvas-tool ${active ? 'active' : ''}`}
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

/** Pixel rulers along the stage edges, following the view. */
function Rulers({ view, width, height }: { view: View; width: number; height: number }) {
  const step =
    view.zoom >= 2
      ? 25
      : view.zoom >= 1
        ? 50
        : view.zoom >= 0.5
          ? 100
          : view.zoom >= 0.25
            ? 200
            : 500
  const ticks = (length: number, offset: number) => {
    const out: { at: number; value: number }[] = []
    const first = Math.floor(-offset / view.zoom / step) * step
    for (let v = first; v * view.zoom + offset < length; v += step)
      out.push({ at: v * view.zoom + offset, value: v })
    return out
  }
  return (
    <>
      <svg className="canvas-ruler horizontal" width={width} height={18} aria-hidden="true">
        {ticks(width, view.x).map((t) => (
          <g key={t.value}>
            <line x1={t.at} x2={t.at} y1={12} y2={18} />
            <text x={t.at + 3} y={10}>
              {t.value}
            </text>
          </g>
        ))}
      </svg>
      <svg className="canvas-ruler vertical" width={18} height={height} aria-hidden="true">
        {ticks(height, view.y).map((t) => (
          <g key={t.value}>
            <line y1={t.at} y2={t.at} x1={12} x2={18} />
            <text x={2} y={t.at - 3} transform={`rotate(-90 2 ${t.at - 3})`}>
              {t.value}
            </text>
          </g>
        ))}
      </svg>
    </>
  )
}
