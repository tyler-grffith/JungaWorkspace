// The shared 3D viewport: an orthographic camera you can orbit, pan, zoom, and fit, drawing a
// scene of meshes and polylines to a canvas with a painter's sort. It knows nothing about parts
// or plates; the modeler and slicer describe what to show and get back picks and drags.
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  bounds,
  cross,
  forEachTriangle,
  normalize,
  sub,
  vec,
  type Mesh,
  type Vec2,
  type Vec3,
} from './geometry'

export type Camera = { azimuth: number; elevation: number; scale: number; pan: Vec2 }
export type ViewName = 'iso' | 'front' | 'back' | 'top' | 'bottom' | 'right' | 'left'
/** Azimuth and elevation in degrees for the named views; SolidWorks' isometric is the default. */
export const VIEWS: Record<ViewName, Pick<Camera, 'azimuth' | 'elevation'>> = {
  iso: { azimuth: -45, elevation: 35.264 },
  front: { azimuth: 0, elevation: 0 },
  back: { azimuth: 180, elevation: 0 },
  top: { azimuth: 0, elevation: 90 },
  bottom: { azimuth: 0, elevation: -90 },
  right: { azimuth: -90, elevation: 0 },
  left: { azimuth: 90, elevation: 0 },
}

export type SceneMesh = {
  kind: 'mesh'
  id?: string
  mesh: Mesh
  fill: string
  /** One colour per triangle, overriding `fill` where given. */
  colors?: string[]
  /** Edge colour; null draws no edges. */
  stroke?: string | null
  dashed?: boolean
  opacity?: number
  /** Edges only, no faces. */
  wire?: boolean
}
export type SceneLines = {
  kind: 'lines'
  id?: string
  polylines: Vec3[][]
  stroke: string
  width?: number
  dashed?: boolean
  /** Drawn beneath the meshes (a grid) or on top of them (toolpaths). */
  layer?: 'under' | 'over'
}
export type SceneItem = SceneMesh | SceneLines

export type ViewportHandle = {
  fit: () => void
  look: (view: ViewName) => void
}
export type Viewport3DProps = {
  items: SceneItem[]
  /** Extent used by Fit; defaults to everything in the scene. */
  fitTo?: Mesh
  initialView?: ViewName
  label: string
  /** A click that was not a drag; `id` is the picked item, `ground` the point on z = 0. */
  onPick?: (id: string | null, ground: Vec3 | null) => void
  /** Dragging a picked item moves it along the ground plane by this much. */
  onDrag?: (id: string, delta: Vec2) => void
  /** The pointer was released after dragging an item. */
  onDrop?: (id: string) => void
  background?: string
  children?: ReactNode
}

// --- Projection -----------------------------------------------------------------------------------
type Basis = { c1: number; s1: number; c2: number; s2: number }
const basis = (camera: Camera): Basis => {
  const a = (camera.azimuth * Math.PI) / 180
  const e = (camera.elevation * Math.PI) / 180
  return { c1: Math.cos(a), s1: Math.sin(a), c2: Math.cos(e), s2: Math.sin(e) }
}
/** World → view space: x right, z up, y away from the viewer (larger is farther). */
const toView = (p: Vec3, b: Basis): Vec3 => {
  const x = p.x * b.c1 - p.y * b.s1
  const y = p.x * b.s1 + p.y * b.c1
  return vec(x, y * b.c2 - p.z * b.s2, y * b.s2 + p.z * b.c2)
}
const fromView = (v: Vec3, b: Basis): Vec3 => {
  const y = v.y * b.c2 + v.z * b.s2
  const z = -v.y * b.s2 + v.z * b.c2
  return vec(v.x * b.c1 + y * b.s1, -v.x * b.s1 + y * b.c1, z)
}
const LIGHT = normalize(vec(-0.4, -0.7, 0.6))

export function fitCamera(mesh: Mesh, camera: Camera, width: number, height: number): Camera {
  const b = bounds(mesh)
  if (!b || !width || !height) return camera
  const bs = basis(camera)
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const x of [b.min.x, b.max.x])
    for (const y of [b.min.y, b.max.y])
      for (const z of [b.min.z, b.max.z]) {
        const v = toView(vec(x, y, z), bs)
        minX = Math.min(minX, v.x)
        maxX = Math.max(maxX, v.x)
        minZ = Math.min(minZ, v.z)
        maxZ = Math.max(maxZ, v.z)
      }
  const scale = Math.min(width / Math.max(1, maxX - minX), height / Math.max(1, maxZ - minZ)) * 0.8
  return {
    ...camera,
    scale,
    pan: { x: (-(minX + maxX) / 2) * scale, y: ((minZ + maxZ) / 2) * scale },
  }
}

// --- Component -------------------------------------------------------------------------------------
const Viewport3D = forwardRef<ViewportHandle, Viewport3DProps>(function Viewport3D(
  { items, fitTo, initialView = 'iso', label, onPick, onDrag, onDrop, background, children },
  ref,
) {
  const host = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [camera, setCamera] = useState<Camera>({
    ...VIEWS[initialView],
    scale: 3,
    pan: { x: 0, y: 0 },
  })
  const fitted = useRef(false)
  const sceneMesh =
    fitTo ??
    items.flatMap((i) =>
      i.kind === 'mesh' ? i.mesh : i.polylines.flat().flatMap((p) => [p.x, p.y, p.z]),
    )

  useLayoutEffect(() => {
    const el = host.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize({ width: Math.round(width), height: Math.round(height) })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  // The first time the viewport has a size, fit the scene; afterwards the camera is the user's.
  useEffect(() => {
    if (fitted.current || !size.width) return
    fitted.current = true
    setCamera((c) => fitCamera(sceneMesh, c, size.width, size.height))
  }, [size, sceneMesh])
  useImperativeHandle(
    ref,
    () => ({
      fit: () => setCamera((c) => fitCamera(sceneMesh, c, size.width, size.height)),
      look: (view) =>
        setCamera((c) => fitCamera(sceneMesh, { ...c, ...VIEWS[view] }, size.width, size.height)),
    }),
    [sceneMesh, size],
  )

  const screen = (p: Vec3, b: Basis): Vec3 => {
    const v = toView(p, b)
    return vec(
      size.width / 2 + v.x * camera.scale + camera.pan.x,
      size.height / 2 - v.z * camera.scale + camera.pan.y,
      v.y,
    )
  }
  /** The ground-plane (z = 0) point under a screen position, or null when the view is edge-on. */
  const ground = (sx: number, sy: number): Vec3 | null => {
    const b = basis(camera)
    const vx = (sx - size.width / 2 - camera.pan.x) / camera.scale
    const vz = -(sy - size.height / 2 - camera.pan.y) / camera.scale
    const p0 = fromView(vec(vx, 0, vz), b)
    const p1 = fromView(vec(vx, 1, vz), b)
    const dz = p1.z - p0.z
    if (Math.abs(dz) < 1e-6) return null
    const t = -p0.z / dz
    return vec(p0.x + (p1.x - p0.x) * t, p0.y + (p1.y - p0.y) * t, 0)
  }

  // --- Drawing ---
  const drawn = useRef<{ id: string | undefined; pts: Vec3[] }[]>([])
  useEffect(() => {
    const el = canvas.current
    if (!el || !size.width) return
    const dpr = window.devicePixelRatio || 1
    el.width = size.width * dpr
    el.height = size.height * dpr
    const ctx = el.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, size.width, size.height)
    if (background) {
      ctx.fillStyle = background
      ctx.fillRect(0, 0, size.width, size.height)
    }
    const b = basis(camera)
    const lines = (layer: 'under' | 'over') => {
      for (const item of items) {
        if (item.kind !== 'lines' || (item.layer ?? 'over') !== layer) continue
        ctx.strokeStyle = item.stroke
        ctx.lineWidth = item.width ?? 1
        ctx.setLineDash(item.dashed ? [4, 3] : [])
        ctx.beginPath()
        for (const poly of item.polylines) {
          poly.forEach((p, i) => {
            const s = screen(p, b)
            i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y)
          })
        }
        ctx.stroke()
      }
      ctx.setLineDash([])
    }
    lines('under')

    type Face = {
      pts: Vec3[]
      depth: number
      item: SceneMesh
      fill: string
      shade: number
      edges: number
    }
    const faces: Face[] = []
    for (const item of items) {
      if (item.kind !== 'mesh') continue
      const hard = hardEdges(item.mesh)
      forEachTriangle(item.mesh, (p, q, r, t) => {
        const pts = [screen(p, b), screen(q, b), screen(r, b)]
        const n = normalize(cross(sub(q, p), sub(r, p)))
        const view = toView(n, b)
        // Faces turned away from the viewer are hidden on a closed solid; wire and cut views show all.
        if (!item.wire && view.y > 0) return
        const shade =
          0.55 + 0.45 * Math.max(0, (n.x * LIGHT.x + n.y * LIGHT.y + n.z * LIGHT.z + 1) / 2)
        faces.push({
          pts,
          depth: (pts[0].z + pts[1].z + pts[2].z) / 3,
          item,
          fill: item.colors?.[t] ?? item.fill,
          shade,
          edges: hard[t],
        })
      })
    }
    faces.sort((f, g) => g.depth - f.depth)
    drawn.current = []
    for (const f of faces) {
      ctx.globalAlpha = f.item.opacity ?? 1
      ctx.beginPath()
      ctx.moveTo(f.pts[0].x, f.pts[0].y)
      ctx.lineTo(f.pts[1].x, f.pts[1].y)
      ctx.lineTo(f.pts[2].x, f.pts[2].y)
      ctx.closePath()
      if (!f.item.wire) {
        ctx.fillStyle = shadeColor(f.fill, f.shade)
        ctx.fill()
      }
      // Only edges where the surface actually bends are drawn, so faces look like faces.
      if (f.item.stroke !== null && f.edges) {
        ctx.strokeStyle = f.item.stroke ?? 'rgba(20,30,40,0.5)'
        ctx.lineWidth = 0.8
        ctx.setLineDash(f.item.dashed ? [4, 3] : [])
        ctx.beginPath()
        for (let e = 0; e < 3; e++)
          if (f.edges & (1 << e)) {
            const a = f.pts[e]
            const b = f.pts[(e + 1) % 3]
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
          }
        ctx.stroke()
      }
      if (!f.item.wire) drawn.current.push({ id: f.item.id, pts: f.pts })
    }
    ctx.globalAlpha = 1
    ctx.setLineDash([])
    lines('over')
    drawTriad(ctx, b, size.height)
  })

  // --- Interaction ---
  const gesture = useRef<{
    x: number
    y: number
    moved: boolean
    mode: 'orbit' | 'pan' | 'drag'
    id?: string
    ground?: Vec3 | null
  } | null>(null)
  const pick = (sx: number, sy: number): string | null => {
    for (let i = drawn.current.length - 1; i >= 0; i--) {
      const { id, pts } = drawn.current[i]
      if (id && inTriangle(sx, sy, pts)) return id
    }
    return null
  }
  const local = (event: React.PointerEvent) => {
    const rect = host.current!.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }
  const down = (event: React.PointerEvent) => {
    const { x, y } = local(event)
    const id = pick(x, y)
    const pan = event.button === 1 || event.button === 2 || event.shiftKey
    const mode = pan ? 'pan' : id && onDrag ? 'drag' : 'orbit'
    gesture.current = { x, y, moved: false, mode, id: id ?? undefined, ground: ground(x, y) }
    host.current?.setPointerCapture(event.pointerId)
  }
  const move = (event: React.PointerEvent) => {
    const g = gesture.current
    if (!g) return
    const { x, y } = local(event)
    const dx = x - g.x
    const dy = y - g.y
    if (Math.abs(dx) + Math.abs(dy) > 2) g.moved = true
    if (g.mode === 'orbit')
      setCamera((c) => ({
        ...c,
        azimuth: c.azimuth - dx * 0.5,
        elevation: Math.max(-89.9, Math.min(89.9, c.elevation + dy * 0.5)),
      }))
    else if (g.mode === 'pan')
      setCamera((c) => ({ ...c, pan: { x: c.pan.x + dx, y: c.pan.y + dy } }))
    else if (g.id && g.ground) {
      const now = ground(x, y)
      if (now) {
        onDrag?.(g.id, { x: now.x - g.ground.x, y: now.y - g.ground.y })
        g.ground = now
      }
    }
    g.x = x
    g.y = y
  }
  const up = (event: React.PointerEvent) => {
    const g = gesture.current
    gesture.current = null
    host.current?.releasePointerCapture(event.pointerId)
    if (!g) return
    if (g.moved) {
      if (g.mode === 'drag' && g.id) onDrop?.(g.id)
      return
    }
    const { x, y } = local(event)
    onPick?.(pick(x, y), ground(x, y))
  }
  const wheel = (event: React.WheelEvent) => {
    const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12
    const { x, y } = local(event as unknown as React.PointerEvent)
    setCamera((c) => {
      // Zoom about the cursor: keep the point under it fixed.
      const cx = x - size.width / 2
      const cy = y - size.height / 2
      return {
        ...c,
        scale: Math.max(0.05, Math.min(400, c.scale * factor)),
        pan: { x: cx - (cx - c.pan.x) * factor, y: cy - (cy - c.pan.y) * factor },
      }
    })
  }
  const keys = (event: React.KeyboardEvent) => {
    const step = event.shiftKey ? 15 : 5
    const orbit = (da: number, de: number) =>
      setCamera((c) => ({
        ...c,
        azimuth: c.azimuth + da,
        elevation: Math.max(-89.9, Math.min(89.9, c.elevation + de)),
      }))
    if (event.key === 'ArrowLeft') orbit(step, 0)
    else if (event.key === 'ArrowRight') orbit(-step, 0)
    else if (event.key === 'ArrowUp') orbit(0, step)
    else if (event.key === 'ArrowDown') orbit(0, -step)
    else if (event.key === '+' || event.key === '=')
      setCamera((c) => ({ ...c, scale: c.scale * 1.2 }))
    else if (event.key === '-') setCamera((c) => ({ ...c, scale: c.scale / 1.2 }))
    else if (event.key.toLowerCase() === 'f')
      setCamera((c) => fitCamera(sceneMesh, c, size.width, size.height))
    else return
    event.preventDefault()
  }

  return (
    <div
      ref={host}
      className="wb-scene"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={() => (gesture.current = null)}
      onWheel={wheel}
      onDoubleClick={() => setCamera((c) => fitCamera(sceneMesh, c, size.width, size.height))}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={keys}
      tabIndex={0}
      role="img"
      aria-label={label}
      title="Drag to orbit · Shift-drag or right-drag to pan · Wheel to zoom · Double-click or F to fit"
    >
      <canvas ref={canvas} style={{ width: size.width, height: size.height }} />
      {children}
    </div>
  )
})
export default Viewport3D

// --- Helpers ----------------------------------------------------------------------------------------
const SMOOTH = Math.cos((20 * Math.PI) / 180)
const edgeCache = new WeakMap<Mesh, Uint8Array>()
/**
 * Per triangle, a bitmask of the edges worth drawing: boundary edges and edges whose two faces
 * meet at more than 20°. A cylinder shows its rims, not forty slivers; a box shows twelve edges.
 */
function hardEdges(mesh: Mesh): Uint8Array {
  const cached = edgeCache.get(mesh)
  if (cached) return cached
  const count = Math.floor(mesh.length / 9)
  const normals: Vec3[] = []
  const owners = new Map<string, number[]>()
  const keyOf = (i: number) =>
    `${Math.round(mesh[i] * 1000)},${Math.round(mesh[i + 1] * 1000)},${Math.round(mesh[i + 2] * 1000)}`
  forEachTriangle(mesh, (a, b, c, t) => {
    normals.push(normalize(cross(sub(b, a), sub(c, a))))
    const base = t * 9
    const keys = [keyOf(base), keyOf(base + 3), keyOf(base + 6)]
    for (let e = 0; e < 3; e++) {
      const k = [keys[e], keys[(e + 1) % 3]].sort().join('|')
      owners.set(k, [...(owners.get(k) ?? []), t])
    }
  })
  const out = new Uint8Array(count)
  forEachTriangle(mesh, (_a, _b, _c, t) => {
    const base = t * 9
    const keys = [keyOf(base), keyOf(base + 3), keyOf(base + 6)]
    for (let e = 0; e < 3; e++) {
      const k = [keys[e], keys[(e + 1) % 3]].sort().join('|')
      const smooth = (owners.get(k) ?? []).some(
        (other) =>
          other !== t &&
          normals[other].x * normals[t].x +
            normals[other].y * normals[t].y +
            normals[other].z * normals[t].z >
            SMOOTH,
      )
      if (!smooth) out[t] |= 1 << e
    }
  })
  edgeCache.set(mesh, out)
  return out
}
function inTriangle(x: number, y: number, [a, b, c]: Vec3[]): boolean {
  const s = (a.y - c.y) * (x - c.x) + (c.x - a.x) * (y - c.y)
  const t = (c.y - b.y) * (x - c.x) + (b.x - c.x) * (y - c.y)
  const area = (a.y - c.y) * (b.x - c.x) + (c.x - a.x) * (b.y - c.y)
  if (Math.abs(area) < 1e-9) return false
  const sign = area < 0 ? -1 : 1
  return s * sign >= 0 && t * sign >= 0 && (s + t) * sign <= area * sign
}
const colorCache = new Map<string, string>()
/** Multiply a hex colour's brightness; other colour strings pass through untouched. */
export function shadeColor(color: string, factor: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(color)
  if (!m) return color
  const key = `${color}|${factor.toFixed(2)}`
  const hit = colorCache.get(key)
  if (hit) return hit
  const n = parseInt(m[1], 16)
  const ch = (c: number) => Math.max(0, Math.min(255, Math.round(c * factor)))
  const out = `rgb(${ch((n >> 16) & 255)},${ch((n >> 8) & 255)},${ch(n & 255)})`
  if (colorCache.size > 20000) colorCache.clear()
  colorCache.set(key, out)
  return out
}
function drawTriad(ctx: CanvasRenderingContext2D, b: Basis, height: number) {
  const ox = 36
  const oy = height - 36
  const axes: [Vec3, string, string][] = [
    [vec(1, 0, 0), 'X', '#d64545'],
    [vec(0, 1, 0), 'Y', '#2f9e44'],
    [vec(0, 0, 1), 'Z', '#3b6fd9'],
  ]
  ctx.font = '700 10px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const [axis, name, color] of axes) {
    const v = toView(axis, b)
    if (Math.hypot(v.x, v.z) < 0.05) continue
    ctx.strokeStyle = color
    ctx.fillStyle = color
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(ox, oy)
    ctx.lineTo(ox + v.x * 24, oy - v.z * 24)
    ctx.stroke()
    ctx.fillText(name, ox + v.x * 32, oy - v.z * 32)
  }
}
/** Polylines for a square ground grid centred on the origin. */
export function gridLines(size: number, step: number, z = 0): Vec3[][] {
  const out: Vec3[][] = []
  for (let i = -size / 2; i <= size / 2 + 1e-9; i += step) {
    out.push([vec(i, -size / 2, z), vec(i, size / 2, z)])
    out.push([vec(-size / 2, i, z), vec(size / 2, i, z)])
  }
  return out
}
