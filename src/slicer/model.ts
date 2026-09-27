// Saved document for the slicer: printer, filament, and process settings in the shape of
// Bambu Studio, plates of placed objects, and the last slice summary. An object is a box unless
// it carries a mesh (imported STL, or a part sent from the modeler or painter); `slicing.ts`
// turns the plate's meshes into real layer toolpaths, and the summary stored here comes from
// those. Older documents load unchanged: every setting added since the first version is
// optional on disk and filled in by `normalizeSlicer`.
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
import {
  FILAMENT_PROFILES,
  FILAMENT_TYPES,
  PRINTERS,
  PROCESS_PRESETS,
  printerProfile,
  type FilamentType,
} from './profiles'

export {
  PRINTERS,
  PRINTER_PROFILES,
  FILAMENT_TYPES,
  PROCESS_PRESETS,
  printerProfile,
} from './profiles'
export type { FilamentType, PrinterProfile } from './profiles'

export type ObjectOverrides = Partial<
  Pick<Process, 'walls' | 'infill' | 'infillPattern' | 'supports' | 'topLayers' | 'bottomLayers'>
>
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
  /** Filament slot (AMS) this object prints with; 0 when absent. */
  slot?: number
  /** Process settings that differ from the plate's for this object. */
  overrides?: ObjectOverrides
}
export type Plate = { id: string; name: string; objects: PlateObject[] }
export type Filament = {
  type: FilamentType
  brand: string
  color: string
  /** Overrides of the material profile, when set. */
  nozzleTemp?: number
  bedTemp?: number
  pricePerKg?: number
}
export type InfillPattern =
  'grid' | 'lines' | 'triangles' | 'cubic' | 'gyroid' | 'honeycomb' | 'concentric' | 'lightning'
export const INFILL_PATTERNS: readonly InfillPattern[] = [
  'grid',
  'lines',
  'triangles',
  'cubic',
  'gyroid',
  'honeycomb',
  'concentric',
  'lightning',
]
/** A spool change while printing: pause for a manual swap (slot −1) or switch to an AMS slot. */
export type FilamentChange = { layer: number; slot: number }
export type Process = {
  layerHeight: number
  firstLayerHeight: number
  walls: number
  infill: number
  infillPattern: InfillPattern
  supports: boolean
  supportType: 'normal' | 'tree'
  brim: boolean
  seam: 'aligned' | 'back' | 'random'
  speed: 'silent' | 'standard' | 'sport' | 'ludicrous'
  nozzleTemp: number
  bedTemp: number
  // Added after the first version; optional on disk.
  topLayers: number
  bottomLayers: number
  brimWidth: number
  skirtLoops: number
  raft: boolean
  supportAngle: number
  supportDensity: number
  retractLength: number
  retractSpeed: number
  zHop: number
  outerWallSpeed: number
  innerWallSpeed: number
  infillSpeed: number
  topSpeed: number
  travelSpeed: number
  firstLayerSpeed: number
  fanSpeed: number
  minLayerTime: number
  wallOrder: 'inner-outer' | 'outer-inner'
  ironing: boolean
  changes: FilamentChange[]
}
export type SliceResult = {
  seconds: number
  grams: number
  meters: number
  layers: number
  cost: number
  /** Seconds spent per line type, when known. */
  byType?: Record<string, number>
  /** Grams per filament slot, when known. */
  bySlot?: number[]
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
  /** Extra AMS spools beyond `filament`, which is slot 0. */
  slots?: Filament[]
}

/** Build-plate X size per printer; the profile has the full volume. */
export const BED_SIZE: Record<string, number> = Object.fromEntries(
  PRINTERS.map((name) => [name, printerProfile(name).bed.x]),
)
export const bedFor = (printer: string) => printerProfile(printer).bed
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
export const MAX_SLOTS = 8

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
export const DEFAULT_PROCESS: Process = {
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
  topLayers: 4,
  bottomLayers: 3,
  brimWidth: 5,
  skirtLoops: 1,
  raft: false,
  supportAngle: 45,
  supportDensity: 15,
  retractLength: 0.8,
  retractSpeed: 30,
  zHop: 0.4,
  outerWallSpeed: 200,
  innerWallSpeed: 300,
  infillSpeed: 270,
  topSpeed: 200,
  travelSpeed: 500,
  firstLayerSpeed: 50,
  fanSpeed: 100,
  minLayerTime: 8,
  wallOrder: 'inner-outer',
  ironing: false,
  changes: [],
}
export function emptySlicer(): SlicerDocument {
  const plate = newPlate(1)
  return {
    version: 1,
    printer: PRINTERS[0],
    nozzle: 0.4,
    filament: { type: 'PLA', brand: 'Bambu', color: '#f2a93b' },
    process: { ...DEFAULT_PROCESS, changes: [] },
    plates: [plate],
    activePlate: plate.id,
    sliced: null,
    view: 'prepare',
    previewLayer: 0,
    notes: '',
  }
}
/** Fill in every setting a document from an earlier version lacks. */
export function normalizeSlicer(doc: SlicerDocument): SlicerDocument {
  const process = { ...DEFAULT_PROCESS, ...doc.process, changes: doc.process.changes ?? [] }
  return { ...doc, process }
}
/** Apply a process preset, keeping everything the preset does not speak to. */
export function applyPreset(process: Process, name: string): Process {
  const preset = PROCESS_PRESETS.find((p) => p.name === name)
  if (!preset) return process
  const { name: _name, ...values } = preset
  return { ...process, ...values }
}
/** The temperatures a filament prints at: its own overrides, else the material profile. */
export function filamentTemps(f: Filament): { nozzleTemp: number; bedTemp: number } {
  const profile = FILAMENT_PROFILES[f.type] ?? FILAMENT_PROFILES.PLA
  return { nozzleTemp: f.nozzleTemp ?? profile.nozzleTemp, bedTemp: f.bedTemp ?? profile.bedTemp }
}
export const filamentDensity = (f: Filament) =>
  (FILAMENT_PROFILES[f.type] ?? FILAMENT_PROFILES.PLA).density
export const filamentPrice = (f: Filament) =>
  f.pricePerKg ?? (FILAMENT_PROFILES[f.type] ?? FILAMENT_PROFILES.PLA).pricePerKg
/** Every spool the plate can print with: the main filament first, then the extra slots. */
export const allSlots = (doc: SlicerDocument): Filament[] => [doc.filament, ...(doc.slots ?? [])]

// --- Validation ----------------------------------------------------------------------------
const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const num = (v: unknown, min: number, max: number) =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max
const opt = (v: unknown, test: (v: unknown) => boolean) => v === undefined || test(v)
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
const validFilament = (f: unknown) =>
  record(f) &&
  keys(f, ['type', 'brand', 'color'], ['nozzleTemp', 'bedTemp', 'pricePerKg']) &&
  FILAMENT_TYPES.includes(f.type as FilamentType) &&
  typeof f.brand === 'string' &&
  f.brand.length <= 40 &&
  color(f.color) &&
  opt(f.nozzleTemp, (v) => num(v, 150, 350)) &&
  opt(f.bedTemp, (v) => num(v, 0, 130)) &&
  opt(f.pricePerKg, (v) => num(v, 0, 1000))
const OVERRIDE_KEYS = [
  'walls',
  'infill',
  'infillPattern',
  'supports',
  'topLayers',
  'bottomLayers',
] as const
const validOverrides = (v: unknown) =>
  record(v) &&
  keys(v, [], OVERRIDE_KEYS) &&
  opt(v.walls, (n) => num(n, 1, 10)) &&
  opt(v.infill, (n) => num(n, 0, 100)) &&
  opt(v.infillPattern, (p) => INFILL_PATTERNS.includes(p as InfillPattern)) &&
  opt(v.supports, (b) => typeof b === 'boolean') &&
  opt(v.topLayers, (n) => num(n, 0, 20)) &&
  opt(v.bottomLayers, (n) => num(n, 0, 20))
function validProcess(process: unknown): boolean {
  if (
    !record(process) ||
    !keys(
      process,
      [
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
      ],
      Object.keys(DEFAULT_PROCESS),
    )
  )
    return false
  const p = process
  return (
    num(p.layerHeight, 0.05, 0.6) &&
    num(p.firstLayerHeight, 0.05, 0.6) &&
    num(p.walls, 1, 10) &&
    num(p.infill, 0, 100) &&
    INFILL_PATTERNS.includes(p.infillPattern as InfillPattern) &&
    typeof p.supports === 'boolean' &&
    ['normal', 'tree'].includes(p.supportType as string) &&
    typeof p.brim === 'boolean' &&
    ['aligned', 'back', 'random'].includes(p.seam as string) &&
    ['silent', 'standard', 'sport', 'ludicrous'].includes(p.speed as string) &&
    num(p.nozzleTemp, 150, 350) &&
    num(p.bedTemp, 0, 130) &&
    opt(p.topLayers, (v) => num(v, 0, 20)) &&
    opt(p.bottomLayers, (v) => num(v, 0, 20)) &&
    opt(p.brimWidth, (v) => num(v, 0, 50)) &&
    opt(p.skirtLoops, (v) => num(v, 0, 10)) &&
    opt(p.raft, (v) => typeof v === 'boolean') &&
    opt(p.supportAngle, (v) => num(v, 10, 89)) &&
    opt(p.supportDensity, (v) => num(v, 5, 100)) &&
    opt(p.retractLength, (v) => num(v, 0, 10)) &&
    opt(p.retractSpeed, (v) => num(v, 1, 120)) &&
    opt(p.zHop, (v) => num(v, 0, 5)) &&
    opt(p.outerWallSpeed, (v) => num(v, 5, 1000)) &&
    opt(p.innerWallSpeed, (v) => num(v, 5, 1000)) &&
    opt(p.infillSpeed, (v) => num(v, 5, 1000)) &&
    opt(p.topSpeed, (v) => num(v, 5, 1000)) &&
    opt(p.travelSpeed, (v) => num(v, 5, 1000)) &&
    opt(p.firstLayerSpeed, (v) => num(v, 5, 500)) &&
    opt(p.fanSpeed, (v) => num(v, 0, 100)) &&
    opt(p.minLayerTime, (v) => num(v, 0, 120)) &&
    opt(p.wallOrder, (v) => ['inner-outer', 'outer-inner'].includes(v as string)) &&
    opt(p.ironing, (v) => typeof v === 'boolean') &&
    opt(
      p.changes,
      (v) =>
        Array.isArray(v) &&
        v.length <= 200 &&
        v.every(
          (c) =>
            record(c) &&
            keys(c, ['layer', 'slot']) &&
            num(c.layer, 1, 100000) &&
            Number.isInteger(c.layer) &&
            num(c.slot, -1, MAX_SLOTS - 1) &&
            Number.isInteger(c.slot),
        ),
    )
  )
}
export function validSlicer(v: unknown): v is SlicerDocument {
  if (
    !record(v) ||
    !keys(
      v,
      [
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
      ],
      ['slots'],
    )
  )
    return false
  if (v.version !== 1 || !PRINTERS.includes(v.printer as string)) return false
  if (!printerProfile(v.printer as string).nozzles.includes(v.nozzle as number)) return false
  if (!validFilament(v.filament) || !validProcess(v.process)) return false
  if (
    v.slots !== undefined &&
    !(Array.isArray(v.slots) && v.slots.length < MAX_SLOTS && v.slots.every(validFilament))
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
          ['mesh', 'scale', 'slot', 'overrides'],
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
        !(o.slot === undefined || (num(o.slot, 0, MAX_SLOTS - 1) && Number.isInteger(o.slot))) ||
        !(o.overrides === undefined || validOverrides(o.overrides)) ||
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
      keys(v.sliced, ['seconds', 'grams', 'meters', 'layers', 'cost'], ['byType', 'bySlot']) &&
      num(v.sliced.seconds, 0, 1e8) &&
      num(v.sliced.grams, 0, 1e6) &&
      num(v.sliced.meters, 0, 1e6) &&
      num(v.sliced.layers, 0, 1e6) &&
      num(v.sliced.cost, 0, 1e6) &&
      opt(v.sliced.byType, (b) => record(b) && Object.values(b).every((n) => num(n, 0, 1e8))) &&
      opt(v.sliced.bySlot, (b) => Array.isArray(b) && b.every((n) => num(n, 0, 1e6)))
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
/** Objects that stick out of the build volume, by name. */
export function outsideBed(plate: Plate, bed: { x: number; y: number; z: number }): PlateObject[] {
  return plate.objects.filter((o) => {
    const f = footprint(o)
    return (
      Math.abs(o.x) + f.width / 2 > bed.x / 2 + 1e-6 ||
      Math.abs(o.y) + f.depth / 2 > bed.y / 2 + 1e-6 ||
      o.height * (o.scale ?? 1) > bed.z + 1e-6
    )
  })
}
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  return h ? `${h}h ${m}m` : `${m}m`
}
/** Auto-arrange objects in rows inside the bed, largest first, keeping each object's rotation. */
export function arrange(plate: Plate, bed: number | { x: number; y: number }): Plate {
  const size = typeof bed === 'number' ? { x: bed, y: bed } : bed
  const gap = 8
  const order = [...plate.objects].sort((a, b) => {
    const fa = footprint(a)
    const fb = footprint(b)
    return fb.width * fb.depth - fa.width * fa.depth
  })
  let x = -size.x / 2 + gap
  let y = -size.y / 2 + gap
  let rowDepth = 0
  const placed = new Map<string, PlateObject>()
  for (const o of order) {
    const { width, depth } = footprint(o)
    if (x + width > size.x / 2 - gap && x > -size.x / 2 + gap) {
      x = -size.x / 2 + gap
      y += rowDepth + gap
      rowDepth = 0
    }
    placed.set(o.id, { ...o, x: round(x + width / 2), y: round(y + depth / 2) })
    x += width + gap
    rowDepth = Math.max(rowDepth, depth)
  }
  return { ...plate, objects: plate.objects.map((o) => placed.get(o.id) ?? o) }
}
const round = (n: number) => Math.round(n * 100) / 100
