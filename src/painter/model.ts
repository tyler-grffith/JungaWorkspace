// Saved document for PLA Painter: an image, the physical size it prints at, the layer recipe,
// and a stack of filaments with the layer each one starts on. Like HueForge and Chroma Canvas,
// the print is a relief whose height at each pixel decides which filaments show through; the
// picture, the heightmap, the swap plan, and the mesh are all derived by `paint.ts`.

export type Filament = {
  id: string
  name: string
  color: string
  /** Transmission distance in mm: the thickness at which this filament fully hides what is below. */
  td: number
  /** First layer printed with this filament; the bottom entry always starts at layer 1. */
  startLayer: number
}
export type PainterImage = { src: string; width: number; height: number; name: string }
export type PainterDocument = {
  version: 1
  image: PainterImage | null
  /** Printed width in mm; the height follows the image's aspect ratio. */
  width: number
  /** Pixels per mm of the printed relief. */
  detail: number
  layerHeight: number
  /** Layers of the bottom filament that every pixel gets, so the print holds together. */
  baseLayers: number
  /** Total layers, base included. */
  maxLayers: number
  stack: Filament[]
  adjust: { brightness: number; contrast: number }
  notes: string
}

export const MAX_STACK = 8
export const MAX_LAYERS = 150
export const MAX_DOCUMENT_CHARS = 1536 * 1024
/** The largest working grid the painter computes; finer settings are clamped to it. */
export const MAX_PIXELS = 240_000

/** Common PLA colours with approximate transmission distances. Measure your own spools. */
export const FILAMENT_PRESETS: readonly Omit<Filament, 'id' | 'startLayer'>[] = [
  { name: 'Black', color: '#1f1f1f', td: 0.6 },
  { name: 'White', color: '#f2f1ec', td: 3.5 },
  { name: 'Red', color: '#c8102e', td: 3.2 },
  { name: 'Yellow', color: '#ffd23f', td: 4.5 },
  { name: 'Orange', color: '#f26a1b', td: 4 },
  { name: 'Blue', color: '#1e4fbf', td: 2.4 },
  { name: 'Sky blue', color: '#66a9e8', td: 4.2 },
  { name: 'Green', color: '#1f8a5b', td: 3 },
  { name: 'Purple', color: '#6b3fa0', td: 2.2 },
  { name: 'Pink', color: '#f4a3c1', td: 5 },
  { name: 'Brown', color: '#6b4a2b', td: 1.8 },
  { name: 'Grey', color: '#9a9a9a', td: 3 },
  { name: 'Beige', color: '#e5cfae', td: 6 },
]

export const newId = () => crypto.randomUUID().slice(0, 8)
export const newFilament = (
  preset: Omit<Filament, 'id' | 'startLayer'>,
  startLayer: number,
): Filament => ({ id: newId(), ...preset, startLayer })

/** A new painting: the classic black → red → yellow → white stack, swaps spaced evenly. */
export function emptyPainter(width = 100, layerHeight = 0.08): PainterDocument {
  const [black, red, yellow, white] = [0, 2, 3, 1].map((i) => FILAMENT_PRESETS[i])
  return spaceSwapsEvenly({
    version: 1,
    image: null,
    width,
    detail: 2,
    layerHeight,
    baseLayers: 4,
    maxLayers: 40,
    stack: [black, red, yellow, white].map((f) => newFilament(f, 1)),
    adjust: { brightness: 0, contrast: 1 },
    notes: '',
  })
}

// --- Derived sizes ------------------------------------------------------------------------------
/** Printed height in mm from the image's aspect ratio. */
export const printedHeight = (doc: PainterDocument) =>
  doc.image ? (doc.width * doc.image.height) / doc.image.width : doc.width
/** The working grid: pixels per mm, clamped so the computation stays quick. */
export function gridFor(doc: PainterDocument): { cols: number; rows: number } {
  const height = printedHeight(doc)
  let detail = doc.detail
  if (doc.width * height * detail * detail > MAX_PIXELS)
    detail = Math.sqrt(MAX_PIXELS / (doc.width * height))
  return {
    cols: Math.max(2, Math.round(doc.width * detail)),
    rows: Math.max(2, Math.round(height * detail)),
  }
}
export const totalHeight = (doc: PainterDocument) => doc.maxLayers * doc.layerHeight

// --- Stack editing ----------------------------------------------------------------------------
/** Keep the stack ordered by start layer, the bottom entry on layer 1, the rest above the base. */
export function normalizeStack(doc: PainterDocument): PainterDocument {
  const stack = [...doc.stack]
    .sort((a, b) => a.startLayer - b.startLayer)
    .map((f, i) =>
      i === 0
        ? { ...f, startLayer: 1 }
        : {
            ...f,
            startLayer: Math.min(doc.maxLayers, Math.max(doc.baseLayers + 1, f.startLayer)),
          },
    )
  return { ...doc, stack }
}
/** Spread the swaps evenly between the base and the top. */
export function spaceSwapsEvenly(doc: PainterDocument): PainterDocument {
  const above = doc.stack.length - 1
  if (above < 1) return normalizeStack(doc)
  const span = doc.maxLayers - doc.baseLayers
  const stack = doc.stack.map((f, i) =>
    i === 0
      ? { ...f, startLayer: 1 }
      : { ...f, startLayer: doc.baseLayers + 1 + Math.round(((i - 1) * span) / above) },
  )
  return normalizeStack({ ...doc, stack })
}

// --- Validation ---------------------------------------------------------------------------------
const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const num = (v: unknown, min: number, max: number) =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max
const int = (v: unknown, min: number, max: number) => num(v, min, max) && Number.isInteger(v)
const keys = (v: Record<string, unknown>, names: readonly string[]) =>
  Object.keys(v).length === names.length && names.every((n) => n in v)
const ID = /^[A-Za-z0-9_-]{1,40}$/
const hex = (v: unknown) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)
const IMAGE_SRC = /^data:image\/(png|jpeg|gif|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/

export function validPainter(v: unknown): v is PainterDocument {
  if (
    !record(v) ||
    !keys(v, [
      'version',
      'image',
      'width',
      'detail',
      'layerHeight',
      'baseLayers',
      'maxLayers',
      'stack',
      'adjust',
      'notes',
    ])
  )
    return false
  if (v.version !== 1) return false
  const { image, adjust } = v
  if (
    image !== null &&
    !(
      record(image) &&
      keys(image, ['src', 'width', 'height', 'name']) &&
      typeof image.src === 'string' &&
      IMAGE_SRC.test(image.src) &&
      int(image.width, 1, 8192) &&
      int(image.height, 1, 8192) &&
      typeof image.name === 'string' &&
      image.name.length <= 120
    )
  )
    return false
  if (!num(v.width, 10, 400) || !num(v.detail, 0.2, 8)) return false
  if (!num(v.layerHeight, 0.04, 0.3)) return false
  if (!int(v.baseLayers, 1, 20) || !int(v.maxLayers, 2, MAX_LAYERS)) return false
  if ((v.baseLayers as number) >= (v.maxLayers as number)) return false
  if (!Array.isArray(v.stack) || !v.stack.length || v.stack.length > MAX_STACK) return false
  const ids = new Set<string>()
  for (const f of v.stack) {
    if (
      !record(f) ||
      !keys(f, ['id', 'name', 'color', 'td', 'startLayer']) ||
      typeof f.id !== 'string' ||
      !ID.test(f.id) ||
      typeof f.name !== 'string' ||
      !f.name ||
      f.name.length > 40 ||
      !hex(f.color) ||
      !num(f.td, 0.1, 20) ||
      !int(f.startLayer, 1, v.maxLayers as number) ||
      ids.has(f.id)
    )
      return false
    ids.add(f.id)
  }
  if (
    !record(adjust) ||
    !keys(adjust, ['brightness', 'contrast']) ||
    !num(adjust.brightness, -100, 100) ||
    !num(adjust.contrast, 0.2, 3)
  )
    return false
  if (typeof v.notes !== 'string' || v.notes.length > 20000) return false
  return JSON.stringify(v).length <= MAX_DOCUMENT_CHARS
}
export const painterProblem = (doc: PainterDocument) =>
  validPainter(doc)
    ? ''
    : 'The painting could not be saved. Check the image size, layers, and filament stack.'
