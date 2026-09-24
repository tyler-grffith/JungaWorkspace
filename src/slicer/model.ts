// Saved document for the slicer prototype: printer, filament, and process settings in the
// shape of Bambu Studio, plates of placed objects, and the last slice estimate. Objects are
// boxes with a footprint and height; slicing is an estimate from volume and settings, so the
// workflow (prepare, slice, preview, print) is real while geometry is a stand-in.
export type PlateObject = {
  id: string
  name: string
  /** Footprint and height in mm. */
  width: number
  depth: number
  height: number
  x: number
  y: number
  rotation: number
  color: string
}
export type Plate = { id: string; name: string; objects: PlateObject[] }
export type Filament = {
  type: 'PLA' | 'PETG' | 'ABS' | 'TPU' | 'PLA-CF'
  brand: string
  color: string
}
export type Process = {
  layerHeight: number
  firstLayerHeight: number
  walls: number
  infill: number
  infillPattern: 'grid' | 'gyroid' | 'honeycomb' | 'triangles' | 'lightning'
  supports: boolean
  supportType: 'normal' | 'tree'
  brim: boolean
  seam: 'aligned' | 'back' | 'random'
  speed: 'silent' | 'standard' | 'sport' | 'ludicrous'
  nozzleTemp: number
  bedTemp: number
}
export type SliceResult = {
  seconds: number
  grams: number
  meters: number
  layers: number
  cost: number
}
export type SlicerView = 'prepare' | 'preview' | 'device' | 'project'
export type SlicerDocument = {
  version: 1
  printer: string
  nozzle: number
  filament: Filament
  process: Process
  plates: Plate[]
  activePlate: string
  sliced: SliceResult | null
  view: SlicerView
  previewLayer: number
  notes: string
}

export const PRINTERS = [
  'Bambu Lab X1 Carbon',
  'Bambu Lab P1S',
  'Bambu Lab A1',
  'Bambu Lab A1 mini',
] as const
export const BED_SIZE: Record<string, number> = {
  'Bambu Lab X1 Carbon': 256,
  'Bambu Lab P1S': 256,
  'Bambu Lab A1': 256,
  'Bambu Lab A1 mini': 180,
}
export const OBJECT_COLORS = [
  '#f2a93b',
  '#3b8beb',
  '#4fbf6a',
  '#e0457b',
  '#9d5bd2',
  '#e8e8e8',
] as const
export const MAX_OBJECTS = 200
export const MAX_DOCUMENT_CHARS = 512 * 1024

export const newId = () => crypto.randomUUID().slice(0, 8)
export function newObject(
  name: string,
  width = 40,
  depth = 40,
  height = 30,
  index = 0,
): PlateObject {
  return {
    id: newId(),
    name,
    width,
    depth,
    height,
    x: 0,
    y: 0,
    rotation: 0,
    color: OBJECT_COLORS[index % OBJECT_COLORS.length],
  }
}
export function newPlate(index: number): Plate {
  return { id: newId(), name: `Plate ${index}`, objects: [] }
}
export function emptySlicer(): SlicerDocument {
  const plate = newPlate(1)
  return {
    version: 1,
    printer: PRINTERS[0],
    nozzle: 0.4,
    filament: { type: 'PLA', brand: 'Bambu', color: '#f2a93b' },
    process: {
      layerHeight: 0.2,
      firstLayerHeight: 0.2,
      walls: 2,
      infill: 15,
      infillPattern: 'grid',
      supports: false,
      supportType: 'tree',
      brim: false,
      seam: 'aligned',
      speed: 'standard',
      nozzleTemp: 220,
      bedTemp: 55,
    },
    plates: [plate],
    activePlate: plate.id,
    sliced: null,
    view: 'prepare',
    previewLayer: 0,
    notes: '',
  }
}

// --- Validation ----------------------------------------------------------------------------
const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const num = (v: unknown, min: number, max: number) =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max
const keys = (v: Record<string, unknown>, names: readonly string[]) =>
  Object.keys(v).length === names.length && names.every((n) => n in v)
const ID = /^[A-Za-z0-9_-]{1,40}$/
const isId = (v: unknown): v is string => typeof v === 'string' && ID.test(v)
const color = (v: unknown) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)
export function validSlicer(v: unknown): v is SlicerDocument {
  if (
    !record(v) ||
    !keys(v, [
      'version',
      'printer',
      'nozzle',
      'filament',
      'process',
      'plates',
      'activePlate',
      'sliced',
      'view',
      'previewLayer',
      'notes',
    ])
  )
    return false
  if (v.version !== 1 || !PRINTERS.includes(v.printer as (typeof PRINTERS)[number])) return false
  if (![0.2, 0.4, 0.6, 0.8].includes(v.nozzle as number)) return false
  const { filament, process } = v
  if (
    !record(filament) ||
    !keys(filament, ['type', 'brand', 'color']) ||
    !['PLA', 'PETG', 'ABS', 'TPU', 'PLA-CF'].includes(filament.type as string) ||
    typeof filament.brand !== 'string' ||
    filament.brand.length > 40 ||
    !color(filament.color)
  )
    return false
  if (
    !record(process) ||
    !keys(process, [
      'layerHeight',
      'firstLayerHeight',
      'walls',
      'infill',
      'infillPattern',
      'supports',
      'supportType',
      'brim',
      'seam',
      'speed',
      'nozzleTemp',
      'bedTemp',
    ]) ||
    !num(process.layerHeight, 0.05, 0.6) ||
    !num(process.firstLayerHeight, 0.05, 0.6) ||
    !num(process.walls, 1, 10) ||
    !num(process.infill, 0, 100) ||
    !['grid', 'gyroid', 'honeycomb', 'triangles', 'lightning'].includes(
      process.infillPattern as string,
    ) ||
    typeof process.supports !== 'boolean' ||
    !['normal', 'tree'].includes(process.supportType as string) ||
    typeof process.brim !== 'boolean' ||
    !['aligned', 'back', 'random'].includes(process.seam as string) ||
    !['silent', 'standard', 'sport', 'ludicrous'].includes(process.speed as string) ||
    !num(process.nozzleTemp, 150, 320) ||
    !num(process.bedTemp, 0, 120)
  )
    return false
  if (!Array.isArray(v.plates) || !v.plates.length || v.plates.length > 20) return false
  const plateIds = new Set<string>()
  for (const p of v.plates) {
    if (
      !record(p) ||
      !keys(p, ['id', 'name', 'objects']) ||
      !isId(p.id) ||
      typeof p.name !== 'string' ||
      !p.name ||
      p.name.length > 40 ||
      plateIds.has(p.id)
    )
      return false
    plateIds.add(p.id)
    if (!Array.isArray(p.objects) || p.objects.length > MAX_OBJECTS) return false
    const ids = new Set<string>()
    for (const o of p.objects) {
      if (
        !record(o) ||
        !keys(o, ['id', 'name', 'width', 'depth', 'height', 'x', 'y', 'rotation', 'color']) ||
        !isId(o.id) ||
        typeof o.name !== 'string' ||
        !o.name ||
        o.name.length > 80 ||
        !num(o.width, 0.1, 1000) ||
        !num(o.depth, 0.1, 1000) ||
        !num(o.height, 0.1, 1000) ||
        !num(o.x, -1000, 1000) ||
        !num(o.y, -1000, 1000) ||
        !num(o.rotation, -360, 360) ||
        !color(o.color) ||
        ids.has(o.id)
      )
        return false
      ids.add(o.id)
    }
  }
  if (!isId(v.activePlate) || !plateIds.has(v.activePlate)) return false
  if (
    v.sliced !== null &&
    !(
      record(v.sliced) &&
      keys(v.sliced, ['seconds', 'grams', 'meters', 'layers', 'cost']) &&
      num(v.sliced.seconds, 0, 1e8) &&
      num(v.sliced.grams, 0, 1e6) &&
      num(v.sliced.meters, 0, 1e6) &&
      num(v.sliced.layers, 0, 1e6) &&
      num(v.sliced.cost, 0, 1e6)
    )
  )
    return false
  if (!['prepare', 'preview', 'device', 'project'].includes(v.view as string)) return false
  if (!num(v.previewLayer, 0, 1e6) || typeof v.notes !== 'string' || v.notes.length > 20000)
    return false
  return JSON.stringify(v).length <= MAX_DOCUMENT_CHARS
}
export const slicerProblem = (doc: SlicerDocument) =>
  validSlicer(doc) ? '' : 'The print project could not be saved. Check its plates and settings.'

// --- Estimates ------------------------------------------------------------------------------
export const activePlate = (doc: SlicerDocument) =>
  doc.plates.find((p) => p.id === doc.activePlate) ?? doc.plates[0]
/**
 * A slice estimate from box volumes and settings. Not a slicer: a consistent, adjustable model
 * that makes the prepare → slice → preview loop behave, with numbers in plausible ranges.
 */
export function estimateSlice(doc: SlicerDocument): SliceResult {
  const plate = activePlate(doc)
  const p = doc.process
  const speedFactor = { silent: 1.35, standard: 1, sport: 0.8, ludicrous: 0.65 }[p.speed]
  let material = 0
  let tallest = 0
  for (const o of plate.objects) {
    const volume = o.width * o.depth * o.height
    const shell =
      2 * (o.width * o.depth + o.width * o.height + o.depth * o.height) * p.walls * doc.nozzle
    const inner = Math.max(0, volume - shell) * (p.infill / 100)
    material += Math.min(volume, shell + inner)
    if (p.supports) material += volume * 0.08
    tallest = Math.max(tallest, o.height)
  }
  const density = { PLA: 1.24, PETG: 1.27, ABS: 1.04, TPU: 1.21, 'PLA-CF': 1.3 }[doc.filament.type]
  const grams = (material / 1000) * density
  const meters = material / (Math.PI * 0.875 ** 2) / 1000
  const layers = tallest ? Math.ceil((tallest - p.firstLayerHeight) / p.layerHeight) + 1 : 0
  const seconds = Math.round(
    ((material / 12) * speedFactor * (0.2 / p.layerHeight) + layers * 4) *
      (plate.objects.length ? 1 : 0),
  )
  return {
    seconds,
    grams: Math.round(grams * 10) / 10,
    meters: Math.round(meters * 100) / 100,
    layers,
    cost: Math.round(grams * 0.025 * 100) / 100,
  }
}
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  return h ? `${h}h ${m}m` : `${m}m`
}
/** Auto-arrange objects on a grid inside the bed. */
export function arrange(plate: Plate, bed: number): Plate {
  const gap = 8
  let x = -bed / 2 + gap
  let y = -bed / 2 + gap
  let rowDepth = 0
  const objects = plate.objects.map((o) => {
    if (x + o.width > bed / 2 - gap) {
      x = -bed / 2 + gap
      y += rowDepth + gap
      rowDepth = 0
    }
    const placed = { ...o, x: x + o.width / 2, y: y + o.depth / 2, rotation: 0 }
    x += o.width + gap
    rowDepth = Math.max(rowDepth, o.depth)
    return placed
  })
  return { ...plate, objects }
}
