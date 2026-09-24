// A small isometric projection and SVG helpers for the workbench viewports. Enough to show
// stacked boxes, a build plate, and an axis triad as a stand-in for a real 3D renderer.
import type { ReactNode } from 'react'

export type Vec3 = { x: number; y: number; z: number }
export type Orientation = 'iso' | 'front' | 'top' | 'right'

/** Project a point in model space (mm) to a 2D point for the given orientation. */
export function project(p: Vec3, orientation: Orientation): { x: number; y: number } {
  switch (orientation) {
    case 'front':
      return { x: p.x, y: -p.z }
    case 'top':
      return { x: p.x, y: p.y }
    case 'right':
      return { x: p.y, y: -p.z }
    default: {
      const a = Math.PI / 6
      return { x: (p.x - p.y) * Math.cos(a), y: (p.x + p.y) * Math.sin(a) - p.z }
    }
  }
}
const pt = (p: { x: number; y: number }) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`

/** Faces of an axis-aligned box drawn back to front so nearer faces cover farther ones. */
export function Box({
  x,
  y,
  z,
  w,
  d,
  h,
  orientation,
  fill,
  stroke = 'rgba(20,30,40,0.55)',
  dashed = false,
  opacity = 1,
}: {
  x: number
  y: number
  z: number
  w: number
  d: number
  h: number
  orientation: Orientation
  fill: string
  stroke?: string
  dashed?: boolean
  opacity?: number
}) {
  const P = (px: number, py: number, pz: number) => project({ x: px, y: py, z: pz }, orientation)
  const top = [P(x, y, z + h), P(x + w, y, z + h), P(x + w, y + d, z + h), P(x, y + d, z + h)]
  const front = [P(x, y + d, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x, y + d, z + h)]
  const side = [P(x + w, y, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x + w, y, z + h)]
  const common = {
    stroke,
    strokeWidth: 1,
    strokeLinejoin: 'round' as const,
    strokeDasharray: dashed ? '4 3' : undefined,
    opacity,
  }
  if (orientation === 'top')
    return <polygon points={top.map(pt).join(' ')} fill={fill} {...common} />
  if (orientation === 'front')
    return <polygon points={front.map(pt).join(' ')} fill={fill} {...common} />
  if (orientation === 'right')
    return <polygon points={side.map(pt).join(' ')} fill={fill} {...common} />
  return (
    <g>
      <polygon points={side.map(pt).join(' ')} fill={shade(fill, -0.22)} {...common} />
      <polygon points={front.map(pt).join(' ')} fill={shade(fill, -0.1)} {...common} />
      <polygon points={top.map(pt).join(' ')} fill={fill} {...common} />
    </g>
  )
}
/** Lighten (positive) or darken (negative) a hex color. */
export function shade(hex: string, amount: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!m) return hex
  const n = parseInt(m[1], 16)
  const channel = (c: number) =>
    Math.max(0, Math.min(255, Math.round(amount > 0 ? c + (255 - c) * amount : c * (1 + amount))))
  const r = channel((n >> 16) & 255)
  const g = channel((n >> 8) & 255)
  const b = channel(n & 255)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

/** A ground grid in model space, projected. */
export function Grid({
  size,
  step,
  orientation,
  color,
}: {
  size: number
  step: number
  orientation: Orientation
  color: string
}) {
  if (orientation === 'front' || orientation === 'right') return null
  const lines: ReactNode[] = []
  for (let i = -size / 2; i <= size / 2; i += step) {
    const a = project({ x: i, y: -size / 2, z: 0 }, orientation)
    const b = project({ x: i, y: size / 2, z: 0 }, orientation)
    const c = project({ x: -size / 2, y: i, z: 0 }, orientation)
    const e = project({ x: size / 2, y: i, z: 0 }, orientation)
    lines.push(
      <line
        key={`x${i}`}
        x1={a.x}
        y1={a.y}
        x2={b.x}
        y2={b.y}
        stroke={color}
        strokeWidth={i === 0 ? 1.2 : 0.6}
      />,
    )
    lines.push(
      <line
        key={`y${i}`}
        x1={c.x}
        y1={c.y}
        x2={e.x}
        y2={e.y}
        stroke={color}
        strokeWidth={i === 0 ? 1.2 : 0.6}
      />,
    )
  }
  return <g>{lines}</g>
}

/** The X/Y/Z triad shown in the corner of every 3D viewport. */
export function Triad({ orientation }: { orientation: Orientation }) {
  const o = project({ x: 0, y: 0, z: 0 }, orientation)
  const axes: { axis: Vec3; label: string; color: string }[] = [
    { axis: { x: 26, y: 0, z: 0 }, label: 'X', color: '#d64545' },
    { axis: { x: 0, y: 26, z: 0 }, label: 'Y', color: '#2f9e44' },
    { axis: { x: 0, y: 0, z: 26 }, label: 'Z', color: '#3b6fd9' },
  ]
  return (
    <svg className="wb-triad" width="72" height="72" viewBox="-36 -36 72 72" aria-hidden="true">
      {axes.map(({ axis, label, color }) => {
        const p = project(axis, orientation)
        if (Math.abs(p.x - o.x) < 0.01 && Math.abs(p.y - o.y) < 0.01) return null
        return (
          <g key={label}>
            <line x1={o.x} y1={o.y} x2={p.x} y2={p.y} stroke={color} strokeWidth={2} />
            <text
              x={p.x * 1.25}
              y={p.y * 1.25}
              fill={color}
              fontSize="10"
              textAnchor="middle"
              dominantBaseline="middle"
              fontWeight="700"
            >
              {label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/** All eight corners of an axis-aligned box, for fitting views. */
export function boxCorners(
  x: number,
  y: number,
  z: number,
  w: number,
  d: number,
  h: number,
): Vec3[] {
  const out: Vec3[] = []
  for (const dx of [0, w])
    for (const dy of [0, d]) for (const dz of [0, h]) out.push({ x: x + dx, y: y + dy, z: z + dz })
  return out
}
/** A viewBox that fits the projected extent of the given model-space points with a margin. */
export function fitViewBox(points: Vec3[], orientation: Orientation, margin = 40): string {
  if (!points.length) return '-100 -100 200 200'
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity
  for (const p of points) {
    const q = project(p, orientation)
    minX = Math.min(minX, q.x)
    minY = Math.min(minY, q.y)
    maxX = Math.max(maxX, q.x)
    maxY = Math.max(maxY, q.y)
  }
  const w = Math.max(1, maxX - minX) + margin * 2
  const h = Math.max(1, maxY - minY) + margin * 2
  return `${minX - margin} ${minY - margin} ${w} ${h}`
}
