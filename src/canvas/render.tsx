// SVG rendering of canvas pages. The editor, page thumbnails, the presenter, and SVG export all
// draw through these components, so what you edit is exactly what you present and export.
import { Fragment, memo, type ReactNode } from 'react'
import {
  parseMarkup,
  type ArrowHead,
  type CanvasElement,
  type ConnectorElement,
  type ImageElement,
  type Page,
  type PageSize,
  type Paint,
  type ShapeElement,
  type ShapeKind,
  type TextElement,
  type TextStyle,
} from './model'
import { center, connectorPath, connectorPoints, endDirection, type Rect } from './geometry'

// --- Paint ---------------------------------------------------------------------------------
const gradientId = (paint: string, scope: string) =>
  `g-${scope}-${paint.replace(/[^a-z0-9]/gi, '')}`
export const parseGradient = (paint: Paint) => {
  const match = /^gradient\((\d{1,3}),(#[0-9a-f]{6}),(#[0-9a-f]{6})\)$/i.exec(paint)
  return match ? { angle: Number(match[1]), from: match[2], to: match[3] } : null
}
/** SVG paint value for a fill or stroke, referencing a gradient definition when needed. */
export function paintValue(paint: Paint, scope: string): string {
  if (paint === 'none' || paint === '') return 'none'
  if (parseGradient(paint)) return `url(#${gradientId(paint, scope)})`
  return paint
}
/** `<defs>` for every gradient used on the page. */
export function PaintDefs({ page, scope }: { page: Page; scope: string }) {
  const paints = new Set<string>([page.background])
  for (const e of page.elements) {
    if ('fill' in e) paints.add(e.fill)
    if ('stroke' in e) paints.add(e.stroke.color)
  }
  const gradients = [...paints].filter((p) => parseGradient(p))
  if (!gradients.length) return null
  return (
    <defs>
      {gradients.map((paint) => {
        const g = parseGradient(paint)!
        const a = ((g.angle - 90) * Math.PI) / 180
        const x = Math.cos(a) / 2
        const y = Math.sin(a) / 2
        return (
          <linearGradient
            key={paint}
            id={gradientId(paint, scope)}
            x1={0.5 - x}
            y1={0.5 - y}
            x2={0.5 + x}
            y2={0.5 + y}
          >
            <stop offset="0" stopColor={g.from} />
            <stop offset="1" stopColor={g.to} />
          </linearGradient>
        )
      })}
    </defs>
  )
}
export const dashArray = (dash: string, width: number) =>
  dash === 'dashed'
    ? `${width * 4} ${width * 3}`
    : dash === 'dotted'
      ? `${width} ${width * 2}`
      : undefined

// --- Shapes --------------------------------------------------------------------------------
type P = [number, number]
const poly = (points: P[]) => points.map(([x, y]) => `${x},${y}`).join(' ')
/** Path data for a shape kind within a w × h box at the origin. */
export function shapePath(shape: ShapeKind, w: number, h: number, radius = 0): string {
  const r = Math.min(radius, w / 2, h / 2)
  switch (shape) {
    case 'rect':
      return r
        ? `M${r} 0H${w - r}Q${w} 0 ${w} ${r}V${h - r}Q${w} ${h} ${w - r} ${h}H${r}Q0 ${h} 0 ${h - r}V${r}Q0 0 ${r} 0Z`
        : `M0 0H${w}V${h}H0Z`
    case 'ellipse': {
      const rx = w / 2
      const ry = h / 2
      return `M${rx} 0A${rx} ${ry} 0 1 1 ${rx} ${h}A${rx} ${ry} 0 1 1 ${rx} 0Z`
    }
    case 'triangle':
      return `M${w / 2} 0L${w} ${h}H0Z`
    case 'rightTriangle':
      return `M0 0L${w} ${h}H0Z`
    case 'diamond':
      return `M${w / 2} 0L${w} ${h / 2}L${w / 2} ${h}L0 ${h / 2}Z`
    case 'parallelogram': {
      const o = w * 0.2
      return `M${o} 0H${w}L${w - o} ${h}H0Z`
    }
    case 'trapezoid': {
      const o = w * 0.2
      return `M${o} 0H${w - o}L${w} ${h}H0Z`
    }
    case 'pentagon':
    case 'hexagon':
    case 'octagon': {
      const n = shape === 'pentagon' ? 5 : shape === 'hexagon' ? 6 : 8
      const pts: P[] = []
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / n + (n % 2 === 0 ? Math.PI / n : 0)
        pts.push([w / 2 + (w / 2) * Math.cos(a), h / 2 + (h / 2) * Math.sin(a)])
      }
      return `M${poly(pts).replace(/ /g, 'L')}Z`
    }
    case 'star': {
      const pts: P[] = []
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5
        const f = i % 2 ? 0.4 : 1
        pts.push([w / 2 + (w / 2) * f * Math.cos(a), h / 2 + (h / 2) * f * Math.sin(a)])
      }
      return `M${poly(pts).replace(/ /g, 'L')}Z`
    }
    case 'arrow': {
      const head = Math.min(w * 0.35, h)
      const body = h * 0.3
      return `M0 ${body}H${w - head}V0L${w} ${h / 2}L${w - head} ${h}V${h - body}H0Z`
    }
    case 'doubleArrow': {
      const head = Math.min(w * 0.25, h)
      const body = h * 0.3
      return `M0 ${h / 2}L${head} 0V${body}H${w - head}V0L${w} ${h / 2}L${w - head} ${h}V${h - body}H${head}V${h}Z`
    }
    case 'chevron': {
      const o = Math.min(w * 0.3, h / 2)
      return `M0 0H${w - o}L${w} ${h / 2}L${w - o} ${h}H0L${o} ${h / 2}Z`
    }
    case 'cylinder': {
      const ry = Math.min(h * 0.15, w / 2)
      return `M0 ${ry}A${w / 2} ${ry} 0 0 1 ${w} ${ry}V${h - ry}A${w / 2} ${ry} 0 0 1 0 ${h - ry}Z M0 ${ry}A${w / 2} ${ry} 0 0 0 ${w} ${ry}`
    }
    case 'cloud':
      return `M${w * 0.25} ${h * 0.9}A${w * 0.18} ${h * 0.25} 0 0 1 ${w * 0.15} ${h * 0.45}A${w * 0.2} ${h * 0.3} 0 0 1 ${w * 0.45} ${h * 0.2}A${w * 0.22} ${h * 0.3} 0 0 1 ${w * 0.82} ${h * 0.3}A${w * 0.18} ${h * 0.25} 0 0 1 ${w * 0.85} ${h * 0.75}A${w * 0.16} ${h * 0.2} 0 0 1 ${w * 0.6} ${h * 0.9}Z`
    case 'callout': {
      const tail = h * 0.25
      return `M${r} 0H${w - r}Q${w} 0 ${w} ${r}V${h - tail - r}Q${w} ${h - tail} ${w - r} ${h - tail}H${w * 0.4}L${w * 0.2} ${h}L${w * 0.25} ${h - tail}H${r}Q0 ${h - tail} 0 ${h - tail - r}V${r}Q0 0 ${r} 0Z`
    }
    case 'cross': {
      const a = w / 3
      const b = h / 3
      return `M${a} 0H${2 * a}V${b}H${w}V${2 * b}H${2 * a}V${h}H${a}V${2 * b}H0V${b}H${a}Z`
    }
    case 'document': {
      const wave = h * 0.12
      return `M0 0H${w}V${h - wave}Q${w * 0.75} ${h - wave * 2.5} ${w / 2} ${h - wave}T0 ${h - wave}Z`
    }
    case 'cube': {
      const d = Math.min(w, h) * 0.25
      return `M0 ${d}L${d} 0H${w}V${h - d}L${w - d} ${h}H0Z M0 ${d}H${w - d}V${h} M${w - d} ${d}L${w} 0`
    }
    case 'heart':
      return `M${w / 2} ${h}C${w * 0.1} ${h * 0.65} 0 ${h * 0.5} 0 ${h * 0.3}C0 ${h * 0.1} ${w * 0.15} 0 ${w * 0.3} 0C${w * 0.4} 0 ${w / 2} ${h * 0.1} ${w / 2} ${h * 0.2}C${w / 2} ${h * 0.1} ${w * 0.6} 0 ${w * 0.7} 0C${w * 0.85} 0 ${w} ${h * 0.1} ${w} ${h * 0.3}C${w} ${h * 0.5} ${w * 0.9} ${h * 0.65} ${w / 2} ${h}Z`
    case 'line':
      return `M0 ${h / 2}H${w}`
  }
}

// --- Text ----------------------------------------------------------------------------------
let measureContext: CanvasRenderingContext2D | null | undefined
/** Measured word widths by font, so re-rendering a page re-measures nothing. */
const widthCache = new Map<string, number>()
const fontFor = (style: TextStyle) =>
  `${style.italic ? 'italic ' : ''}${style.bold ? '700' : '400'} ${style.fontSize}px ${style.fontFamily}`
function textWidth(text: string, font: string): number {
  const key = `${font}|${text}`
  const cached = widthCache.get(key)
  if (cached !== undefined) return cached
  if (measureContext === undefined)
    measureContext =
      typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d')
  let width: number
  if (measureContext) {
    measureContext.font = font
    width = measureContext.measureText(text).width
  } else width = text.length * parseFloat(font.match(/(\d+(?:\.\d+)?)px/)?.[1] ?? '16') * 0.55
  if (widthCache.size > 20000) widthCache.clear()
  widthCache.set(key, width)
  return width
}
/** Break text into lines that fit `width`, honoring explicit newlines. */
export function wrapLines(text: string, style: TextStyle, width: number): string[] {
  const font = fontFor(style)
  const space = textWidth(' ', font)
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    let line = ''
    let lineWidth = 0
    for (const word of paragraph.split(' ')) {
      const wordWidth = textWidth(plain(word), font)
      if (line && lineWidth + space + wordWidth > width) {
        lines.push(line)
        line = word
        lineWidth = wordWidth
      } else {
        lineWidth += line ? space + wordWidth : wordWidth
        line = line ? `${line} ${word}` : word
      }
    }
    lines.push(line)
  }
  return lines
}
const plain = (s: string) => s.replace(/[_^]\{([^}]*)\}/g, '$1')

export function TextBlock({
  text,
  style,
  box,
  padding = 6,
  editing = false,
}: {
  text: string
  style: TextStyle
  box: Rect
  padding?: number
  editing?: boolean
}) {
  if (!text || editing) return null
  const lines = wrapLines(text, style, Math.max(10, box.width - padding * 2))
  const lineHeight = style.fontSize * style.lineHeight
  const total = lines.length * lineHeight
  const startY =
    style.valign === 'top'
      ? box.y + padding
      : style.valign === 'bottom'
        ? box.y + box.height - padding - total
        : box.y + (box.height - total) / 2
  const x =
    style.align === 'left'
      ? box.x + padding
      : style.align === 'right'
        ? box.x + box.width - padding
        : box.x + box.width / 2
  return (
    <text
      fontFamily={style.fontFamily}
      fontSize={style.fontSize}
      fontWeight={style.bold ? 700 : 400}
      fontStyle={style.italic ? 'italic' : undefined}
      textDecoration={style.underline ? 'underline' : undefined}
      fill={style.color}
      textAnchor={style.align === 'left' ? 'start' : style.align === 'right' ? 'end' : 'middle'}
      style={{ whiteSpace: 'pre', userSelect: 'none' }}
    >
      {lines.map((line, i) => (
        <tspan key={i} x={x} y={startY + i * lineHeight + style.fontSize * 0.85}>
          {parseMarkup(line).map((run, j) =>
            run.script === 'normal' ? (
              <Fragment key={j}>{run.text}</Fragment>
            ) : (
              <tspan
                key={j}
                fontSize={style.fontSize * 0.65}
                baselineShift={run.script === 'sub' ? 'sub' : 'super'}
              >
                {run.text}
              </tspan>
            ),
          )}
          {line === '' ? ' ' : null}
        </tspan>
      ))}
    </text>
  )
}

// --- Elements ------------------------------------------------------------------------------
const transform = (e: { x: number; y: number; width: number; height: number; rotation: number }) =>
  e.rotation ? `rotate(${e.rotation} ${e.x + e.width / 2} ${e.y + e.height / 2})` : undefined

function Shape({
  element: e,
  scope,
  editing,
}: {
  element: ShapeElement
  scope: string
  editing: boolean
}) {
  return (
    <g transform={transform(e)} opacity={e.opacity}>
      <path
        d={shapePath(e.shape, e.width, e.height, e.radius)}
        transform={`translate(${e.x} ${e.y})`}
        fill={e.shape === 'line' ? 'none' : paintValue(e.fill, scope)}
        stroke={paintValue(e.stroke.color, scope)}
        strokeWidth={e.stroke.width}
        strokeDasharray={dashArray(e.stroke.dash, e.stroke.width)}
        strokeLinejoin="round"
        strokeLinecap="round"
        style={e.shadow ? { filter: 'drop-shadow(2px 3px 4px rgba(0,0,0,0.25))' } : undefined}
        vectorEffect={e.shape === 'line' ? undefined : undefined}
      />
      <TextBlock text={e.text} style={e.textStyle} box={e} editing={editing} />
    </g>
  )
}
function Text({
  element: e,
  scope,
  editing,
}: {
  element: TextElement
  scope: string
  editing: boolean
}) {
  return (
    <g transform={transform(e)} opacity={e.opacity}>
      {e.fill !== 'none' && (
        <rect x={e.x} y={e.y} width={e.width} height={e.height} fill={paintValue(e.fill, scope)} />
      )}
      <TextBlock text={e.text} style={e.textStyle} box={e} editing={editing} />
    </g>
  )
}
function Image({ element: e, scope }: { element: ImageElement; scope: string }) {
  const clip = `clip-${scope}-${e.id}`
  return (
    <g transform={transform(e)} opacity={e.opacity}>
      {e.radius > 0 && (
        <clipPath id={clip}>
          <rect x={e.x} y={e.y} width={e.width} height={e.height} rx={e.radius} />
        </clipPath>
      )}
      <image
        href={e.src}
        x={e.x}
        y={e.y}
        width={e.width}
        height={e.height}
        preserveAspectRatio={
          e.fit === 'stretch' ? 'none' : e.fit === 'cover' ? 'xMidYMid slice' : 'xMidYMid meet'
        }
        clipPath={e.radius > 0 ? `url(#${clip})` : undefined}
      />
    </g>
  )
}
/** Marker-free arrowheads drawn as paths, so stroke color and export stay simple. */
function Head({
  kind,
  at,
  dir,
  color,
  width,
}: {
  kind: ArrowHead
  at: { x: number; y: number }
  dir: { x: number; y: number }
  color: string
  width: number
}) {
  if (kind === 'none') return null
  const size = 6 + width * 2.5
  const angle = (Math.atan2(dir.y, dir.x) * 180) / Math.PI
  const t = `translate(${at.x} ${at.y}) rotate(${angle})`
  switch (kind) {
    case 'arrow':
      return (
        <path
          d={`M${-size} ${-size / 2}L0 0L${-size} ${size / 2}`}
          transform={t}
          fill="none"
          stroke={color}
          strokeWidth={width}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )
    case 'triangle':
      return (
        <path d={`M${-size} ${-size / 2}L0 0L${-size} ${size / 2}Z`} transform={t} fill={color} />
      )
    case 'circle':
      return (
        <circle
          cx={at.x - (dir.x * size) / 2.5}
          cy={at.y - (dir.y * size) / 2.5}
          r={size / 2.5}
          fill={color}
        />
      )
    case 'diamond':
      return (
        <path
          d={`M0 0L${-size / 2} ${-size / 2.5}L${-size} 0L${-size / 2} ${size / 2.5}Z`}
          transform={t}
          fill={color}
        />
      )
    case 'bar':
      return (
        <path d={`M0 ${-size / 2}V${size / 2}`} transform={t} stroke={color} strokeWidth={width} />
      )
  }
}
function Connector({
  element: e,
  page,
  scope,
  editing,
}: {
  element: ConnectorElement
  page: Page
  scope: string
  editing: boolean
}) {
  const points = connectorPoints(e, page)
  const d = connectorPath(points, e.routing)
  const color = paintValue(e.stroke.color, scope)
  const mid = points[Math.floor((points.length - 1) / 2)]
  const next = points[Math.ceil((points.length - 1) / 2)] ?? mid
  const labelAt = points.length === 2 ? { x: (mid.x + next.x) / 2, y: (mid.y + next.y) / 2 } : mid
  return (
    <g opacity={e.opacity}>
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={e.stroke.width}
        strokeDasharray={dashArray(e.stroke.dash, e.stroke.width)}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Head
        kind={e.endArrow}
        at={points[points.length - 1]}
        dir={endDirection(points, e.routing, false)}
        color={color}
        width={e.stroke.width}
      />
      <Head
        kind={e.startArrow}
        at={points[0]}
        dir={endDirection(points, e.routing, true)}
        color={color}
        width={e.stroke.width}
      />
      {e.label && !editing && (
        <TextBlock
          text={e.label}
          style={e.textStyle}
          box={{ x: labelAt.x - 80, y: labelAt.y - 14, width: 160, height: 28 }}
          padding={0}
        />
      )}
    </g>
  )
}

export function Element({
  element,
  page,
  scope,
  editing = false,
}: {
  element: CanvasElement
  page: Page
  scope: string
  editing?: boolean
}) {
  switch (element.type) {
    case 'shape':
      return <Shape element={element} scope={scope} editing={editing} />
    case 'text':
      return <Text element={element} scope={scope} editing={editing} />
    case 'image':
      return <Image element={element} scope={scope} />
    case 'connector':
      return <Connector element={element} page={page} scope={scope} editing={editing} />
  }
}

/** A whole page's content: background then elements in z-order. `upTo` hides later build steps. */
export function PageContent({
  page,
  size,
  scope,
  upTo = Infinity,
  editingId = null,
  children,
}: {
  page: Page
  size: PageSize
  scope: string
  upTo?: number
  editingId?: string | null
  children?: ReactNode
}) {
  return (
    <>
      <PaintDefs page={page} scope={scope} />
      {!size.infinite && (
        <rect
          className="canvas-page-background"
          x={0}
          y={0}
          width={size.width}
          height={size.height}
          fill={paintValue(page.background, scope)}
        />
      )}
      {page.elements
        .filter((e) => e.appear <= upTo)
        .map((element) => (
          <Element
            key={element.id}
            element={element}
            page={page}
            scope={scope}
            editing={element.id === editingId}
          />
        ))}
      {children}
    </>
  )
}

/** A static, non-interactive rendering of one page, used for thumbnails and the presenter. */
export const PageView = memo(function PageView({
  page,
  size,
  scope,
  upTo,
  className,
  bounds,
}: {
  page: Page
  size: PageSize
  scope: string
  upTo?: number
  className?: string
  bounds?: Rect
}) {
  const box = bounds ?? { x: 0, y: 0, width: size.width, height: size.height }
  return (
    <svg
      className={className}
      viewBox={`${box.x} ${box.y} ${Math.max(1, box.width)} ${Math.max(1, box.height)}`}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={page.name}
    >
      {size.infinite && (
        <rect
          x={box.x}
          y={box.y}
          width={box.width}
          height={box.height}
          fill={paintValue(page.background, scope)}
        />
      )}
      <PageContent page={page} size={size} scope={scope} upTo={upTo} />
    </svg>
  )
})

export const pageCenter = (size: PageSize) => center({ x: 0, y: 0, ...size })
