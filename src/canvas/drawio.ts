// Import of draw.io / diagrams.net files into canvas pages. Reads the mxGraphModel XML
// (compressed diagrams are inflated first) and maps vertices, edges, groups, and embedded
// images onto canvas elements. Shapes without an equivalent become plain rectangles that keep
// their label, so nothing is silently dropped.
import {
  FONTS,
  MAX_IMAGE_CHARS,
  attachedAnchor,
  defaultStroke,
  defaultTextStyle,
  freeAnchor,
  newConnector,
  newId,
  newImage,
  newPage,
  newShape,
  newText,
  type ArrowHead,
  type CanvasDocument,
  type CanvasElement,
  type Page,
  type Paint,
  type Point,
  type ShapeKind,
} from './model'
import { boundsOfPoints, corners } from './geometry'

export type ImportResult = {
  document: CanvasDocument
  pages: number
  elements: number
  skipped: number
  firstNewPage: number
}

type Style = Record<string, string> & { _shape?: string }
function parseStyle(style: string): Style {
  const out: Style = {}
  for (const token of style.split(';')) {
    if (!token) continue
    const eq = token.indexOf('=')
    if (eq < 0) {
      if (!out._shape) out._shape = token
      else out[token] = '1'
    } else out[token.slice(0, eq)] = token.slice(eq + 1)
  }
  if (out.shape) out._shape = out.shape
  return out
}

const SHAPE_MAP: Record<string, ShapeKind> = {
  rect: 'rect',
  rectangle: 'rect',
  ellipse: 'ellipse',
  rhombus: 'diamond',
  triangle: 'triangle',
  hexagon: 'hexagon',
  parallelogram: 'parallelogram',
  trapezoid: 'trapezoid',
  cylinder: 'cylinder',
  cylinder3: 'cylinder',
  cloud: 'cloud',
  callout: 'callout',
  document: 'document',
  cube: 'cube',
  step: 'chevron',
  'mxgraph.basic.star': 'star',
  'mxgraph.basic.octagon': 'octagon',
  'mxgraph.basic.pentagon': 'pentagon',
  'mxgraph.basic.heart': 'heart',
  'mxgraph.basic.cross': 'cross',
  'mxgraph.arrows2.arrow': 'arrow',
  'mxgraph.arrows2.twoWayArrow': 'doubleArrow',
  singleArrow: 'arrow',
  doubleArrow: 'doubleArrow',
  line: 'line',
  process: 'rect',
  card: 'rect',
  note: 'document',
  swimlane: 'rect',
}
const ARROW_MAP: Record<string, ArrowHead> = {
  classic: 'arrow',
  classicThin: 'arrow',
  open: 'arrow',
  openThin: 'arrow',
  block: 'triangle',
  blockThin: 'triangle',
  oval: 'circle',
  diamond: 'diamond',
  diamondThin: 'diamond',
  box: 'bar',
  halfCircle: 'bar',
  dash: 'bar',
  cross: 'bar',
  none: 'none',
}

function color(value: string | undefined, fallback: Paint): Paint {
  if (!value || value === 'default' || value === 'inherit') return fallback
  if (value === 'none') return 'none'
  const hex = value.trim()
  if (/^#[0-9a-f]{6}$/i.test(hex)) return hex.toLowerCase()
  if (/^#[0-9a-f]{3}$/i.test(hex))
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`.toLowerCase()
  return fallback
}
function fillPaint(style: Style): Paint {
  const fill = color(style.fillColor, '#ffffff')
  if (fill !== 'none' && style.gradientColor && style.gradientColor !== 'none') {
    const to = color(style.gradientColor, fill)
    const angle =
      { south: 180, north: 0, east: 90, west: 270 }[style.gradientDirection ?? 'south'] ?? 180
    if (to !== 'none') return `gradient(${angle},${fill},${to})`
  }
  return fill
}
function fontFamily(name: string | undefined): string {
  if (!name) return FONTS[0].value
  const known = FONTS.find((f) => f.label.toLowerCase() === name.toLowerCase())
  if (known) return known.value
  const clean = name.replace(/["']/g, '').slice(0, 60)
  return /serif|garamond|georgia|times/i.test(clean)
    ? `'${clean}', Georgia, serif`
    : `'${clean}', sans-serif`
}

/** draw.io labels are HTML; keep line breaks and turn sub/superscripts into canvas markup. */
export function labelText(value: string): string {
  if (!value) return ''
  if (!/[<&]/.test(value)) return value
  const html = value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(div|p|li|h[1-6])>/gi, '\n')
    .replace(/<sub>(.*?)<\/sub>/gi, '_{$1}')
    .replace(/<sup>(.*?)<\/sup>/gi, '^{$1}')
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  return (doc.body.textContent ?? '')
    .replace(/ /g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

async function inflate(compressed: string): Promise<string> {
  const bytes = Uint8Array.from(atob(compressed.trim()), (c) => c.charCodeAt(0))
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  const text = await new Response(stream).text()
  return decodeURIComponent(text)
}

type Cell = {
  id: string
  parent: string
  vertex: boolean
  edge: boolean
  value: string
  style: Style
  geometry: Element | null
  source: string
  target: string
}
function readCells(model: Element): Cell[] {
  const cells: Cell[] = []
  for (const node of model.querySelectorAll('root > *')) {
    // Cells may be wrapped in <object> / <UserObject> carrying a label and link.
    const cell = node.tagName === 'mxCell' ? node : node.querySelector(':scope > mxCell')
    if (!cell) continue
    const id = node.getAttribute('id') ?? cell.getAttribute('id') ?? ''
    const value =
      node.tagName === 'mxCell'
        ? (cell.getAttribute('value') ?? '')
        : (node.getAttribute('label') ?? cell.getAttribute('value') ?? '')
    cells.push({
      id,
      parent: cell.getAttribute('parent') ?? '',
      vertex: cell.getAttribute('vertex') === '1',
      edge: cell.getAttribute('edge') === '1',
      value,
      style: parseStyle(cell.getAttribute('style') ?? ''),
      geometry: cell.querySelector(':scope > mxGeometry'),
      source: cell.getAttribute('source') ?? '',
      target: cell.getAttribute('target') ?? '',
    })
  }
  return cells
}
const num = (value: string | null | undefined, fallback = 0) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function convertModel(model: Element, name: string): { page: Page; skipped: number } {
  const cells = readCells(model)
  const byId = new Map(cells.map((c) => [c.id, c]))
  const ids = new Map<string, string>()
  const fresh = (id: string) => {
    if (!ids.has(id)) ids.set(id, newId())
    return ids.get(id)!
  }
  // Absolute position of a vertex: its geometry plus every vertex ancestor's origin.
  const origin = (cell: Cell): Point => {
    let x = 0
    let y = 0
    let parent = byId.get(cell.parent)
    while (parent && parent.vertex && parent.geometry) {
      x += num(parent.geometry.getAttribute('x'))
      y += num(parent.geometry.getAttribute('y'))
      parent = byId.get(parent.parent)
    }
    return { x, y }
  }
  const groupOf = (cell: Cell): string | null => {
    let parent = byId.get(cell.parent)
    let group: string | null = null
    while (parent && parent.vertex) {
      group = fresh(parent.id)
      parent = byId.get(parent.parent)
    }
    return group
  }
  const elements: CanvasElement[] = []
  const edgeLabels = new Map<string, string[]>()
  let skipped = 0
  for (const cell of cells) {
    if (!cell.vertex || !cell.geometry) continue
    const parent = byId.get(cell.parent)
    if (parent?.edge) {
      const text = labelText(cell.value)
      if (text) edgeLabels.set(cell.parent, [...(edgeLabels.get(cell.parent) ?? []), text])
      continue
    }
    const o = origin(cell)
    const x = o.x + num(cell.geometry.getAttribute('x'))
    const y = o.y + num(cell.geometry.getAttribute('y'))
    const width = Math.max(1, num(cell.geometry.getAttribute('width'), 80))
    const height = Math.max(1, num(cell.geometry.getAttribute('height'), 40))
    const style = cell.style
    const text = labelText(cell.value)
    const shapeName = style._shape ?? 'rect'
    const isGroup = shapeName === 'group' || (style.group === '1' && !style.fillColor)
    if (isGroup && !text) {
      fresh(cell.id)
      continue
    }
    const textStyle = defaultTextStyle({
      fontFamily: fontFamily(style.fontFamily),
      fontSize: Math.max(4, num(style.fontSize, 12)),
      color:
        color(style.fontColor, '#000000') === 'none'
          ? '#000000'
          : (color(style.fontColor, '#000000') as string),
      bold: (num(style.fontStyle) & 1) === 1,
      italic: (num(style.fontStyle) & 2) === 2,
      underline: (num(style.fontStyle) & 4) === 4,
      align: (style.align as 'left' | 'center' | 'right') ?? 'center',
      valign: (style.verticalAlign as 'top' | 'middle' | 'bottom') ?? 'middle',
    })
    const common = {
      id: fresh(cell.id),
      groupId: groupOf(cell),
      rotation: num(style.rotation),
      opacity: style.opacity ? Math.max(0, Math.min(1, num(style.opacity, 100) / 100)) : 1,
      name: text ? text.slice(0, 40) : shapeName,
    }
    if (shapeName === 'image' || style.image) {
      let src = style.image ?? ''
      if (src.startsWith('data:image/') && !src.includes(';base64,'))
        src = src.replace(/^data:(image\/[a-z+]+),/, 'data:$1;base64,')
      if (
        src.startsWith('data:image/') &&
        src.length <= MAX_IMAGE_CHARS &&
        /^data:image\/(png|jpeg|gif|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(src)
      ) {
        const image = newImage(src, x, y, width, height)
        elements.push({ ...image, ...common, alt: text })
        if (text)
          elements.push({
            ...newText(x, y + height, text, width, 24),
            id: newId(),
            groupId: common.groupId,
            textStyle,
          })
        continue
      }
      skipped++
      const box = newShape('rect', x, y, width, height)
      elements.push({
        ...box,
        ...common,
        fill: '#f3f3f3',
        stroke: defaultStroke({ color: '#999999', dash: 'dashed' }),
        text: text || 'Image (not embedded)',
        textStyle,
      })
      continue
    }
    if (shapeName === 'text' || (style.text === '1' && !style.fillColor && !style.strokeColor)) {
      const element = newText(x, y, text, width, height)
      elements.push({
        ...element,
        ...common,
        textStyle: {
          ...textStyle,
          align: (style.align as 'left' | 'center' | 'right') ?? 'left',
          valign: (style.verticalAlign as 'top' | 'middle' | 'bottom') ?? 'top',
        },
        fill: style.fillColor && style.fillColor !== 'none' ? fillPaint(style) : 'none',
      })
      continue
    }
    let kind = SHAPE_MAP[shapeName]
    if (!kind) {
      kind = 'rect'
      skipped++
    }
    const shape = newShape(kind, x, y, width, height)
    const strokeColor = color(style.strokeColor, '#000000')
    elements.push({
      ...shape,
      ...common,
      fill: kind === 'line' ? 'none' : fillPaint(style),
      stroke: defaultStroke({
        color: strokeColor,
        width: Math.max(0, num(style.strokeWidth, 1)),
        dash: style.dashed === '1' ? 'dashed' : 'solid',
      }),
      radius: style.rounded === '1' ? Math.min(12, Math.min(width, height) * 0.15) : 0,
      shadow: style.shadow === '1',
      text,
      textStyle,
    })
  }
  const byOriginal = new Map(cells.map((c) => [c.id, c]))
  for (const cell of cells) {
    if (!cell.edge) continue
    const style = cell.style
    const sourceCell = byOriginal.get(cell.source)
    const targetCell = byOriginal.get(cell.target)
    const geometry = cell.geometry
    const pointOf = (selector: string): Point | null => {
      const p = geometry?.querySelector(`:scope > mxPoint[as="${selector}"]`)
      return p ? { x: num(p.getAttribute('x')), y: num(p.getAttribute('y')) } : null
    }
    const sourcePoint = pointOf('sourcePoint') ?? { x: 0, y: 0 }
    const targetPoint = pointOf('targetPoint') ?? { x: sourcePoint.x + 100, y: sourcePoint.y }
    const start =
      sourceCell && ids.has(sourceCell.id) && !sourceCell.edge
        ? attachedAnchor(
            ids.get(sourceCell.id)!,
            style.exitX ? num(style.exitX) : -1,
            style.exitY ? num(style.exitY) : -1,
          )
        : freeAnchor(sourcePoint.x, sourcePoint.y)
    const end =
      targetCell && ids.has(targetCell.id) && !targetCell.edge
        ? attachedAnchor(
            ids.get(targetCell.id)!,
            style.entryX ? num(style.entryX) : -1,
            style.entryY ? num(style.entryY) : -1,
          )
        : freeAnchor(targetPoint.x, targetPoint.y)
    const points: Point[] = []
    for (const p of geometry?.querySelectorAll(':scope > Array[as="points"] > mxPoint') ?? [])
      points.push({ x: num(p.getAttribute('x')), y: num(p.getAttribute('y')) })
    const connector = newConnector(start, end)
    const flex = style._shape === 'flexArrow'
    const labels = [labelText(cell.value), ...(edgeLabels.get(cell.id) ?? [])].filter(Boolean)
    elements.push({
      ...connector,
      id: fresh(cell.id),
      name: labels[0]?.slice(0, 40) || 'Connector',
      points: points.slice(0, 50),
      routing:
        style.edgeStyle?.includes('orthogonal') || style.edgeStyle === 'elbowEdgeStyle'
          ? 'orthogonal'
          : style.curved === '1'
            ? 'curved'
            : 'straight',
      stroke: defaultStroke({
        color: color(style.strokeColor, '#000000'),
        width: flex ? Math.max(6, num(style.width, 10)) : Math.max(0.5, num(style.strokeWidth, 1)),
        dash: style.dashed === '1' ? 'dashed' : 'solid',
      }),
      startArrow: ARROW_MAP[style.startArrow ?? 'none'] ?? 'none',
      endArrow: flex ? 'triangle' : (ARROW_MAP[style.endArrow ?? 'classic'] ?? 'arrow'),
      label: labels.join('\n').slice(0, 1000),
      opacity: style.opacity ? Math.max(0, Math.min(1, num(style.opacity, 100) / 100)) : 1,
      textStyle: defaultTextStyle({
        fontSize: Math.max(4, num(style.fontSize, 11)),
        color: '#000000',
      }),
    })
  }
  // Shift everything so the content starts near the origin.
  const pointsForBounds = elements.flatMap((e) =>
    e.type === 'connector'
      ? [e.start, e.end, ...e.points]
          .filter((p) => !('elementId' in p) || !p.elementId)
          .map((p) => ({ x: p.x, y: p.y }))
      : corners(e, e.rotation),
  )
  const bounds = boundsOfPoints(pointsForBounds)
  const dx = 40 - bounds.x
  const dy = 40 - bounds.y
  for (const e of elements) {
    e.x += dx
    e.y += dy
    if (e.type === 'connector') {
      for (const a of [e.start, e.end]) {
        a.x += dx
        a.y += dy
      }
      e.points = e.points.map((p) => ({ x: p.x + dx, y: p.y + dy }))
      e.x = Math.min(e.start.x, e.end.x)
      e.y = Math.min(e.start.y, e.end.y)
    }
  }
  const page = newPage(name)
  const background = color(model.getAttribute('background') ?? undefined, '#ffffff')
  page.background = background === 'none' ? '#ffffff' : background
  page.elements = elements.slice(0, 2000)
  return { page, skipped }
}

/** Parse a .drawio file and append its diagrams as canvases. */
export async function importDrawio(text: string, document: CanvasDocument): Promise<ImportResult> {
  const xml = new DOMParser().parseFromString(text, 'text/xml')
  if (xml.querySelector('parsererror')) throw new Error('This file is not readable draw.io XML.')
  let diagrams = [...xml.querySelectorAll('diagram')]
  const models: { model: Element; name: string }[] = []
  if (!diagrams.length) {
    const model = xml.querySelector('mxGraphModel')
    if (!model) throw new Error('No diagram was found in this file.')
    models.push({ model, name: 'Imported diagram' })
  }
  for (const [index, diagram] of diagrams.entries()) {
    let model = diagram.querySelector('mxGraphModel')
    if (!model) {
      const inflated = await inflate(diagram.textContent ?? '')
      model = new DOMParser().parseFromString(inflated, 'text/xml').querySelector('mxGraphModel')
      if (!model) throw new Error('A compressed diagram in this file could not be read.')
    }
    models.push({ model, name: diagram.getAttribute('name') || `Imported ${index + 1}` })
  }
  let skipped = 0
  let elements = 0
  const pages: Page[] = []
  for (const { model, name } of models) {
    const result = convertModel(model, name)
    skipped += result.skipped
    elements += result.page.elements.length
    pages.push(result.page)
  }
  const replaceOnly = document.pages.length === 1 && document.pages[0].elements.length === 0
  const nextPages = replaceOnly ? pages : [...document.pages, ...pages]
  const extent = boundsOfPoints(
    pages.flatMap((p) =>
      p.elements.flatMap((e) => (e.type === 'connector' ? [] : corners(e, e.rotation))),
    ),
  )
  const overflows =
    extent.x + extent.width > document.page.width || extent.y + extent.height > document.page.height
  return {
    document: {
      ...document,
      pages: nextPages.slice(0, 200),
      page: overflows && replaceOnly ? { ...document.page, infinite: true } : document.page,
      mode: replaceOnly && overflows ? 'board' : document.mode,
    },
    pages: pages.length,
    elements,
    skipped,
    firstNewPage: replaceOnly ? 0 : document.pages.length,
  }
}
