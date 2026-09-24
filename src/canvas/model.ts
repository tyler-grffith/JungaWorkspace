// Saved document for the visual canvas module: pages ("canvases") of positioned elements.
// One document shape serves every mode; the mode says how the canvases are organized and
// output afterwards: a presentation deck, an interactive mockup, a diagram board, or a simple
// animation. Elements are a flat list in z-order; groups are a shared `groupId`, not nesting.
export type CanvasMode = 'deck' | 'mockup' | 'board' | 'animation'
export type Point = { x: number; y: number }
export type Align = 'left' | 'center' | 'right'
export type VAlign = 'top' | 'middle' | 'bottom'
export type Dash = 'solid' | 'dashed' | 'dotted'
export type ArrowHead = 'none' | 'arrow' | 'triangle' | 'circle' | 'diamond' | 'bar'
export type Routing = 'straight' | 'orthogonal' | 'curved'
export type Transition = 'none' | 'fade' | 'slide'
/** A paint is `none`, a hex color, or `gradient(angle,#from,#to)`. */
export type Paint = string
export type Stroke = { color: Paint; width: number; dash: Dash }
export type TextStyle = {
  fontFamily: string
  fontSize: number
  color: string
  bold: boolean
  italic: boolean
  underline: boolean
  align: Align
  valign: VAlign
  lineHeight: number
}
export const SHAPE_KINDS = [
  'rect',
  'ellipse',
  'triangle',
  'rightTriangle',
  'diamond',
  'parallelogram',
  'trapezoid',
  'pentagon',
  'hexagon',
  'octagon',
  'star',
  'arrow',
  'doubleArrow',
  'chevron',
  'cylinder',
  'cloud',
  'callout',
  'cross',
  'document',
  'cube',
  'heart',
  'line',
] as const
export type ShapeKind = (typeof SHAPE_KINDS)[number]

/** One moment of an element's motion: where it is at `t` seconds into the page's animation. */
export type Keyframe = {
  t: number
  x: number
  y: number
  width: number
  height: number
  rotation: number
  opacity: number
}
type ElementBase = {
  id: string
  name: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  opacity: number
  locked: boolean
  groupId: string | null
  /** Build step in a presentation: 0 shows with the page, n appears on the nth click. */
  appear: number
  /** In a mockup, clicking this element opens the canvas with this id. */
  link: string | null
  /** Motion over the page's duration, played in animation mode. Empty means still. */
  keyframes: Keyframe[]
}
export type ShapeElement = ElementBase & {
  type: 'shape'
  shape: ShapeKind
  fill: Paint
  stroke: Stroke
  radius: number
  shadow: boolean
  text: string
  textStyle: TextStyle
}
export type TextElement = ElementBase & {
  type: 'text'
  text: string
  textStyle: TextStyle
  fill: Paint
}
export type ImageElement = ElementBase & {
  type: 'image'
  src: string
  fit: 'contain' | 'cover' | 'stretch'
  radius: number
  alt: string
}
/** An end of a connector: a free point, or a point on an element (px/py in 0..1, or -1 for auto). */
export type Anchor = { x: number; y: number; elementId: string | null; px: number; py: number }
export type ConnectorElement = ElementBase & {
  type: 'connector'
  start: Anchor
  end: Anchor
  points: Point[]
  routing: Routing
  stroke: Stroke
  startArrow: ArrowHead
  endArrow: ArrowHead
  label: string
  textStyle: TextStyle
}
export type CanvasElement = ShapeElement | TextElement | ImageElement | ConnectorElement
export type ElementType = CanvasElement['type']
export type Page = {
  id: string
  name: string
  background: Paint
  elements: CanvasElement[]
  notes: string
  transition: Transition
  /** Animation length in seconds; also the auto-advance time in a looping deck. */
  duration: number
}
export type PageSize = { width: number; height: number; infinite: boolean }
export type CanvasDocument = {
  version: 1
  mode: CanvasMode
  page: PageSize
  pages: Page[]
  grid: { size: number; show: boolean; snap: boolean }
}

/** Bounds keep a document inside the library's shared local-storage budget. */
export const MAX_PAGES = 200
export const MAX_ELEMENTS = 2000
export const MAX_TEXT = 20000
export const MAX_POINTS = 50
export const MAX_IMAGE_CHARS = 600 * 1024
export const MAX_DOCUMENT_CHARS = 2500 * 1024
export const MAX_COORD = 200000
export const MAX_SIZE = 100000
export const MIN_SIZE = 1
export const MAX_FONT = 400
export const MAX_KEYFRAMES = 60
export const MAX_DURATION = 600

export const PAGE_PRESETS: readonly { id: string; label: string; size: PageSize }[] = [
  {
    id: 'wide',
    label: 'Slide 16:9 (960 × 540)',
    size: { width: 960, height: 540, infinite: false },
  },
  {
    id: 'standard',
    label: 'Slide 4:3 (960 × 720)',
    size: { width: 960, height: 720, infinite: false },
  },
  {
    id: 'letter',
    label: 'Letter portrait (816 × 1056)',
    size: { width: 816, height: 1056, infinite: false },
  },
  {
    id: 'letterWide',
    label: 'Letter landscape (1056 × 816)',
    size: { width: 1056, height: 816, infinite: false },
  },
  {
    id: 'a4',
    label: 'A4 portrait (794 × 1123)',
    size: { width: 794, height: 1123, infinite: false },
  },
  { id: 'phone', label: 'Phone (390 × 844)', size: { width: 390, height: 844, infinite: false } },
  {
    id: 'tablet',
    label: 'Tablet (820 × 1180)',
    size: { width: 820, height: 1180, infinite: false },
  },
  {
    id: 'desktop',
    label: 'Desktop (1440 × 900)',
    size: { width: 1440, height: 900, infinite: false },
  },
  {
    id: 'infinite',
    label: 'Unbounded canvas',
    size: { width: 1600, height: 1000, infinite: true },
  },
]
export const MODE_LABELS: Record<CanvasMode, string> = {
  deck: 'Presentation deck',
  mockup: 'Interactive mockup',
  board: 'Diagram board',
  animation: 'Simple animation',
}
export const MODE_HELP: Record<CanvasMode, string> = {
  deck: 'Canvases are slides. Present them in order with build steps and transitions.',
  mockup: 'Canvases are screens. Link elements to other canvases and click through them.',
  board: 'One or more unbounded canvases for diagrams. Pan and zoom freely.',
  animation: 'Elements move over each canvas\u2019s duration along their keyframes.',
}
export const FONTS: readonly { value: string; label: string }[] = [
  { value: "'DM Sans Variable', 'Segoe UI', sans-serif", label: 'DM Sans' },
  { value: "'Manrope Variable', 'Segoe UI', sans-serif", label: 'Manrope' },
  { value: "'Instrument Serif', Georgia, serif", label: 'Instrument Serif' },
  { value: "Georgia, 'Times New Roman', serif", label: 'Georgia' },
  { value: "Garamond, 'EB Garamond', Georgia, serif", label: 'Garamond' },
  { value: "'DM Mono', Menlo, Consolas, monospace", label: 'DM Mono' },
  { value: 'Arial, Helvetica, sans-serif', label: 'Arial' },
]

export const PAINT =
  /^(none|#[0-9a-f]{6}([0-9a-f]{2})?|gradient\((\d{1,3}),#[0-9a-f]{6},#[0-9a-f]{6}\))$/i
export const COLOR = /^#[0-9a-f]{6}([0-9a-f]{2})?$/i
export const isPaint = (value: unknown): value is Paint =>
  typeof value === 'string' && PAINT.test(value)
export const isColor = (value: unknown): value is string =>
  typeof value === 'string' && COLOR.test(value)

export const newId = () => crypto.randomUUID().slice(0, 8)

export function defaultTextStyle(overrides: Partial<TextStyle> = {}): TextStyle {
  return {
    fontFamily: FONTS[0].value,
    fontSize: 16,
    color: '#233c32',
    bold: false,
    italic: false,
    underline: false,
    align: 'center',
    valign: 'middle',
    lineHeight: 1.25,
    ...overrides,
  }
}
export const defaultStroke = (overrides: Partial<Stroke> = {}): Stroke => ({
  color: '#233c32',
  width: 1.5,
  dash: 'solid',
  ...overrides,
})
const base = (x: number, y: number, width: number, height: number, name: string): ElementBase => ({
  id: newId(),
  name,
  x,
  y,
  width,
  height,
  rotation: 0,
  opacity: 1,
  locked: false,
  groupId: null,
  appear: 0,
  link: null,
  keyframes: [],
})
export function newShape(
  shape: ShapeKind,
  x: number,
  y: number,
  width = 160,
  height = 100,
): ShapeElement {
  return {
    ...base(x, y, width, height, shape === 'line' ? 'Line' : 'Shape'),
    type: 'shape',
    shape,
    fill: shape === 'line' ? 'none' : '#eef3e9',
    stroke: defaultStroke({ color: '#285f4b' }),
    radius: shape === 'rect' ? 6 : 0,
    shadow: false,
    text: '',
    textStyle: defaultTextStyle(),
  }
}
export function newText(
  x: number,
  y: number,
  text = 'Text',
  width = 200,
  height = 40,
): TextElement {
  return {
    ...base(x, y, width, height, 'Text'),
    type: 'text',
    text,
    textStyle: defaultTextStyle({ align: 'left', valign: 'top' }),
    fill: 'none',
  }
}
export function newImage(
  src: string,
  x: number,
  y: number,
  width: number,
  height: number,
): ImageElement {
  return {
    ...base(x, y, width, height, 'Image'),
    type: 'image',
    src,
    fit: 'contain',
    radius: 0,
    alt: '',
  }
}
export const freeAnchor = (x: number, y: number): Anchor => ({
  x,
  y,
  elementId: null,
  px: -1,
  py: -1,
})
export const attachedAnchor = (elementId: string, px = -1, py = -1): Anchor => ({
  x: 0,
  y: 0,
  elementId,
  px,
  py,
})
export function newConnector(start: Anchor, end: Anchor): ConnectorElement {
  return {
    ...base(Math.min(start.x, end.x), Math.min(start.y, end.y), 1, 1, 'Connector'),
    type: 'connector',
    start,
    end,
    points: [],
    routing: 'straight',
    stroke: defaultStroke(),
    startArrow: 'none',
    endArrow: 'arrow',
    label: '',
    textStyle: defaultTextStyle({ fontSize: 13 }),
  }
}
export function newPage(name = 'Canvas 1'): Page {
  return {
    id: newId(),
    name,
    background: '#ffffff',
    elements: [],
    notes: '',
    transition: 'none',
    duration: 5,
  }
}
export const pageNoun = (mode: CanvasMode) =>
  mode === 'deck' ? 'Slide' : mode === 'mockup' ? 'Screen' : mode === 'board' ? 'Board' : 'Scene'
export function emptyCanvas(mode: CanvasMode = 'deck', gridSize = 10): CanvasDocument {
  const preset = mode === 'board' ? 'infinite' : mode === 'mockup' ? 'phone' : 'wide'
  return {
    version: 1,
    mode,
    page: { ...PAGE_PRESETS.find((p) => p.id === preset)!.size },
    pages: [newPage(`${pageNoun(mode)} 1`)],
    grid: { size: gridSize, show: mode === 'board', snap: true },
  }
}

// --- Validation ---------------------------------------------------------------------------
const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const num = (v: unknown, min: number, max: number) =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max
const str = (v: unknown, max: number) => typeof v === 'string' && v.length <= max
const oneOf = <T extends string>(v: unknown, values: readonly T[]): v is T =>
  values.includes(v as T)
const keys = (v: Record<string, unknown>, names: readonly string[]) =>
  Object.keys(v).length === names.length && names.every((n) => n in v)
const ID = /^[A-Za-z0-9_-]{1,40}$/

const TEXT_KEYS = [
  'fontFamily',
  'fontSize',
  'color',
  'bold',
  'italic',
  'underline',
  'align',
  'valign',
  'lineHeight',
]
export function validTextStyle(v: unknown): v is TextStyle {
  return (
    record(v) &&
    keys(v, TEXT_KEYS) &&
    str(v.fontFamily, 120) &&
    (v.fontFamily as string).length > 0 &&
    num(v.fontSize, 1, MAX_FONT) &&
    isColor(v.color) &&
    typeof v.bold === 'boolean' &&
    typeof v.italic === 'boolean' &&
    typeof v.underline === 'boolean' &&
    oneOf(v.align, ['left', 'center', 'right']) &&
    oneOf(v.valign, ['top', 'middle', 'bottom']) &&
    num(v.lineHeight, 0.5, 4)
  )
}
export function validStroke(v: unknown): v is Stroke {
  return (
    record(v) &&
    keys(v, ['color', 'width', 'dash']) &&
    isPaint(v.color) &&
    num(v.width, 0, 200) &&
    oneOf(v.dash, ['solid', 'dashed', 'dotted'])
  )
}
const validPoint = (v: unknown): v is Point =>
  record(v) &&
  keys(v, ['x', 'y']) &&
  num(v.x, -MAX_COORD, MAX_COORD) &&
  num(v.y, -MAX_COORD, MAX_COORD)
function validAnchor(v: unknown, ids: Set<string>): v is Anchor {
  return (
    record(v) &&
    keys(v, ['x', 'y', 'elementId', 'px', 'py']) &&
    num(v.x, -MAX_COORD, MAX_COORD) &&
    num(v.y, -MAX_COORD, MAX_COORD) &&
    (v.elementId === null || (typeof v.elementId === 'string' && ids.has(v.elementId))) &&
    num(v.px, -1, 1) &&
    num(v.py, -1, 1)
  )
}
const BASE_KEYS = [
  'id',
  'name',
  'type',
  'x',
  'y',
  'width',
  'height',
  'rotation',
  'opacity',
  'locked',
  'groupId',
  'appear',
  'link',
  'keyframes',
]
const KEYFRAME_KEYS = ['t', 'x', 'y', 'width', 'height', 'rotation', 'opacity']
export const validKeyframe = (v: unknown): v is Keyframe =>
  record(v) &&
  keys(v, KEYFRAME_KEYS) &&
  num(v.t, 0, MAX_DURATION) &&
  num(v.x, -MAX_COORD, MAX_COORD) &&
  num(v.y, -MAX_COORD, MAX_COORD) &&
  num(v.width, MIN_SIZE, MAX_SIZE) &&
  num(v.height, MIN_SIZE, MAX_SIZE) &&
  num(v.rotation, -3600, 3600) &&
  num(v.opacity, 0, 1)
const TYPE_KEYS: Record<ElementType, string[]> = {
  shape: ['shape', 'fill', 'stroke', 'radius', 'shadow', 'text', 'textStyle'],
  text: ['text', 'textStyle', 'fill'],
  image: ['src', 'fit', 'radius', 'alt'],
  connector: [
    'start',
    'end',
    'points',
    'routing',
    'stroke',
    'startArrow',
    'endArrow',
    'label',
    'textStyle',
  ],
}
const ARROWS = ['none', 'arrow', 'triangle', 'circle', 'diamond', 'bar'] as const
export function validElement(v: unknown, ids: Set<string>): v is CanvasElement {
  if (!record(v) || !oneOf(v.type, ['shape', 'text', 'image', 'connector'])) return false
  if (!keys(v, [...BASE_KEYS, ...TYPE_KEYS[v.type]])) return false
  const ok =
    typeof v.id === 'string' &&
    ID.test(v.id) &&
    str(v.name, 100) &&
    num(v.x, -MAX_COORD, MAX_COORD) &&
    num(v.y, -MAX_COORD, MAX_COORD) &&
    num(v.width, MIN_SIZE, MAX_SIZE) &&
    num(v.height, MIN_SIZE, MAX_SIZE) &&
    num(v.rotation, -360, 360) &&
    num(v.opacity, 0, 1) &&
    typeof v.locked === 'boolean' &&
    (v.groupId === null || (typeof v.groupId === 'string' && ID.test(v.groupId))) &&
    num(v.appear, 0, 100) &&
    Number.isInteger(v.appear) &&
    (v.link === null || (typeof v.link === 'string' && ID.test(v.link))) &&
    Array.isArray(v.keyframes) &&
    v.keyframes.length <= MAX_KEYFRAMES &&
    v.keyframes.every(validKeyframe)
  if (!ok) return false
  switch (v.type) {
    case 'shape':
      return (
        oneOf(v.shape, SHAPE_KINDS) &&
        isPaint(v.fill) &&
        validStroke(v.stroke) &&
        num(v.radius, 0, 1000) &&
        typeof v.shadow === 'boolean' &&
        str(v.text, MAX_TEXT) &&
        validTextStyle(v.textStyle)
      )
    case 'text':
      return str(v.text, MAX_TEXT) && validTextStyle(v.textStyle) && isPaint(v.fill)
    case 'image':
      return (
        typeof v.src === 'string' &&
        v.src.length <= MAX_IMAGE_CHARS &&
        /^data:image\/(png|jpeg|gif|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(v.src) &&
        oneOf(v.fit, ['contain', 'cover', 'stretch']) &&
        num(v.radius, 0, 1000) &&
        str(v.alt, 300)
      )
    case 'connector':
      return (
        validAnchor(v.start, ids) &&
        validAnchor(v.end, ids) &&
        Array.isArray(v.points) &&
        v.points.length <= MAX_POINTS &&
        v.points.every(validPoint) &&
        oneOf(v.routing, ['straight', 'orthogonal', 'curved']) &&
        validStroke(v.stroke) &&
        oneOf(v.startArrow, ARROWS) &&
        oneOf(v.endArrow, ARROWS) &&
        str(v.label, 1000) &&
        validTextStyle(v.textStyle)
      )
  }
}
export function validPage(v: unknown): v is Page {
  if (
    !record(v) ||
    !keys(v, ['id', 'name', 'background', 'elements', 'notes', 'transition', 'duration'])
  )
    return false
  if (typeof v.id !== 'string' || !ID.test(v.id)) return false
  if (!str(v.name, 100) || !isPaint(v.background) || !str(v.notes, MAX_TEXT)) return false
  if (!oneOf(v.transition, ['none', 'fade', 'slide'])) return false
  if (!num(v.duration, 0.1, MAX_DURATION)) return false
  if (!Array.isArray(v.elements) || v.elements.length > MAX_ELEMENTS) return false
  const ids = new Set<string>()
  for (const element of v.elements) {
    if (!record(element) || typeof element.id !== 'string' || ids.has(element.id)) return false
    ids.add(element.id)
  }
  return v.elements.every((element) => validElement(element, ids))
}
export function validCanvas(v: unknown): v is CanvasDocument {
  if (!record(v) || !keys(v, ['version', 'mode', 'page', 'pages', 'grid'])) return false
  if (v.version !== 1 || !oneOf(v.mode, ['deck', 'mockup', 'board', 'animation'])) return false
  const { page, grid } = v
  if (
    !record(page) ||
    !keys(page, ['width', 'height', 'infinite']) ||
    !num(page.width, 16, 20000) ||
    !num(page.height, 16, 20000) ||
    typeof page.infinite !== 'boolean'
  )
    return false
  if (
    !record(grid) ||
    !keys(grid, ['size', 'show', 'snap']) ||
    !num(grid.size, 1, 500) ||
    typeof grid.show !== 'boolean' ||
    typeof grid.snap !== 'boolean'
  )
    return false
  if (!Array.isArray(v.pages) || !v.pages.length || v.pages.length > MAX_PAGES) return false
  if (new Set(v.pages.map((p) => record(p) && p.id)).size !== v.pages.length) return false
  if (!v.pages.every(validPage)) return false
  return JSON.stringify(v).length <= MAX_DOCUMENT_CHARS
}

/** Human-readable reason a document cannot be saved, or '' when it is valid. */
export function canvasProblem(document: CanvasDocument): string {
  if (validCanvas(document)) return ''
  if (JSON.stringify(document).length > MAX_DOCUMENT_CHARS)
    return `This canvas passed its ${Math.round(MAX_DOCUMENT_CHARS / 1024)} KB storage limit. Remove or shrink images to save.`
  return 'The canvas could not be saved. Check its pages and elements.'
}

// --- Text markup ---------------------------------------------------------------------------
export type TextRun = { text: string; script: 'normal' | 'sub' | 'sup' }
/** `x_{1}` and `x^{2}` become sub/superscript runs; a lone `\n` separates lines. */
export function parseMarkup(line: string): TextRun[] {
  const runs: TextRun[] = []
  let buffer = ''
  let i = 0
  const flush = () => {
    if (buffer) runs.push({ text: buffer, script: 'normal' })
    buffer = ''
  }
  while (i < line.length) {
    const ch = line[i]
    if ((ch === '_' || ch === '^') && line[i + 1] === '{') {
      const close = line.indexOf('}', i + 2)
      if (close > i) {
        flush()
        runs.push({ text: line.slice(i + 2, close), script: ch === '_' ? 'sub' : 'sup' })
        i = close + 1
        continue
      }
    }
    buffer += ch
    i++
  }
  flush()
  return runs
}
export const plainText = (text: string) => text.replace(/[_^]\{([^}]*)\}/g, '$1')

// --- Document helpers ----------------------------------------------------------------------
export const pageById = (document: CanvasDocument, id: string) =>
  document.pages.find((page) => page.id === id) ?? document.pages[0]
export function updatePage(
  document: CanvasDocument,
  pageId: string,
  change: (page: Page) => Page,
): CanvasDocument {
  return { ...document, pages: document.pages.map((p) => (p.id === pageId ? change(p) : p)) }
}
export function updateElements(
  document: CanvasDocument,
  pageId: string,
  change: (element: CanvasElement) => CanvasElement,
): CanvasDocument {
  return updatePage(document, pageId, (page) => ({ ...page, elements: page.elements.map(change) }))
}
export const elementsById = (page: Page) => new Map(page.elements.map((e) => [e.id, e]))

/** Elements in the same group as any of `ids`, plus `ids` themselves. */
export function expandGroups(page: Page, ids: readonly string[]): string[] {
  const groups = new Set(
    page.elements.filter((e) => ids.includes(e.id) && e.groupId).map((e) => e.groupId!),
  )
  return page.elements
    .filter((e) => ids.includes(e.id) || (e.groupId && groups.has(e.groupId)))
    .map((e) => e.id)
}

/** Copy elements with fresh ids, remapping connectors and groups that stay inside the copy. */
export function cloneElements(elements: readonly CanvasElement[], dx = 0, dy = 0): CanvasElement[] {
  const ids = new Map(elements.map((e) => [e.id, newId()]))
  const groups = new Map<string, string>()
  return elements.map((element) => {
    const copy = structuredClone(element)
    copy.id = ids.get(element.id)!
    if (copy.groupId) {
      if (!groups.has(copy.groupId)) groups.set(copy.groupId, newId())
      copy.groupId = groups.get(copy.groupId)!
    }
    copy.x += dx
    copy.y += dy
    copy.keyframes = copy.keyframes.map((k) => ({ ...k, x: k.x + dx, y: k.y + dy }))
    if (copy.type === 'connector') {
      for (const anchor of [copy.start, copy.end]) {
        anchor.x += dx
        anchor.y += dy
        if (anchor.elementId) {
          const mapped = ids.get(anchor.elementId)
          if (mapped) anchor.elementId = mapped
          else {
            anchor.elementId = null
            anchor.px = -1
            anchor.py = -1
          }
        }
      }
      copy.points = copy.points.map((p) => ({ x: p.x + dx, y: p.y + dy }))
    }
    return copy
  })
}

export const documentChars = (document: CanvasDocument) => JSON.stringify(document).length
