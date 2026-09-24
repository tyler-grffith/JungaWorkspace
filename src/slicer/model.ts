// Saved document for the slicer: printer, filament, and process settings in the shape of
// Bambu Studio, plates of placed objects, and the last slice summary. An object is a box unless
// it carries a mesh (imported STL or a part sent from the modeler); `slicing.ts` turns the
// plate's meshes into real layer toolpaths, and the summary stored here comes from those.
import {
  bounds,
  boundsSize,
  extrude,
  frames,
  profile,
  rotateZ,
  scaleMesh,
  translate,
  vec,
  type Mesh,
} from '../workbench/geometry'

export type PlateObject = {
  id: string
  name: string
  /** Footprint and height in mm (the mesh's bounds when there is one). */
  width: number
  depth: number
  height: number
  x: number
  y: number
  rotation: number
  color: string
  /** Triangle soup in object space: footprint centred, resting on z = 0. Boxes have none. */
  mesh?: Mesh
  /** Uniform scale applied to the mesh; 1 when absent. */
  scale?: number
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
/** Imported meshes are decimated to this many triangles so a plate stays storable. */
export const MAX_TRIANGLES = 4000
export const MAX_DOCUMENT_CHARS = 2 * 1024 * 1024

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
/** An object around a mesh: sized from its bounds, named, coloured like the others. */
export function meshObject(name: string, mesh: Mesh, index = 0): PlateObject {
  const size = boundsSize(bounds(mesh) ?? { min: vec(0, 0, 0), max: vec(1, 1, 1) })
  const round = (n: number) => Math.max(0.1, Math.round(n * 10) / 10)
  return { ...newObject(name, round(size.x), round(size.y), round(size.z), index), mesh }
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
const keys = (
  v: Record<string, unknown>,
  names: readonly string[],
  optional: readonly string[] = [],
) =>
  names.every((n) => n in v) &&
  Object.keys(v).every((k) => names.includes(k) || optional.includes(k))
const validMesh = (v: unknown): v is Mesh =>
  Array.isArray(v) &&
  v.length % 9 === 0 &&
  v.length <= MAX_TRIANGLES * 9 &&
  v.every((n) => typeof n === 'number' && Number.isFinite(n))
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
        !keys(
          o,
          ['id', 'name', 'width', 'depth', 'height', 'x', 'y', 'rotation', 'color'],
          ['mesh', 'scale'],
        ) ||
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
        !(o.mesh === undefined || validMesh(o.mesh)) ||
        !(o.scale === undefined || num(o.scale, 0.01, 100)) ||
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

// --- Geometry ------------------------------------------------------------------------------
export const activePlate = (doc: SlicerDocument) =>
  doc.plates.find((p) => p.id === doc.activePlate) ?? doc.plates[0]
/** The object's mesh in plate space: its own mesh or a box, scaled, turned, and placed. */
export function objectMesh(o: PlateObject): Mesh {
  const local = o.mesh
    ? scaleMesh(o.mesh, o.scale ?? 1)
    : extrude(profile('rectangle', o.width, o.depth), frames.Top(), 0, o.height)
  return translate(rotateZ(local, o.rotation), vec(o.x, o.y, 0))
}
/** Everything on a plate as one mesh, ready to slice. */
export const plateMesh = (plate: Plate): Mesh => plate.objects.flatMap(objectMesh)
/** The footprint an object occupies after rotation, for arranging and bed checks. */
export function footprint(o: PlateObject): { width: number; depth: number } {
  const t = (o.rotation * Math.PI) / 180
  const s = o.scale ?? 1
  const w = o.width * s
  const d = o.depth * s
  return {
    width: Math.abs(w * Math.cos(t)) + Math.abs(d * Math.sin(t)),
    depth: Math.abs(w * Math.sin(t)) + Math.abs(d * Math.cos(t)),
  }
}
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  return h ? `${h}h ${m}m` : `${m}m`
}
/** Auto-arrange objects in rows inside the bed, keeping each object's rotation. */
export function arrange(plate: Plate, bed: number): Plate {
  const gap = 8
  let x = -bed / 2 + gap
  let y = -bed / 2 + gap
  let rowDepth = 0
  const objects = plate.objects.map((o) => {
    const { width, depth } = footprint(o)
    if (x + width > bed / 2 - gap) {
      x = -bed / 2 + gap
      y += rowDepth + gap
      rowDepth = 0
    }
    const placed = { ...o, x: round(x + width / 2), y: round(y + depth / 2) }
    x += width + gap
    rowDepth = Math.max(rowDepth, depth)
    return placed
  })
  return { ...plate, objects }
}
const round = (n: number) => Math.round(n * 100) / 100
