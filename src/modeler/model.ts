// Saved document for the 3D modeler: a SolidWorks-shaped feature tree with sketches and
// features and their parameters, plus view settings. Geometry is derived, never stored: `derive`
// rebuilds the part's solids from the history with the shared mesh layer, so extrusions,
// revolves, cuts, holes, mirrors, and patterns are real shapes. Fillets, chamfers, and shells
// are recorded in the history and await a kernel.
import {
  bounds,
  compact,
  decimate,
  extrude,
  flip,
  frames,
  mirror,
  profile,
  revolve,
  settle,
  translate,
  vec,
  volume,
  type Mesh,
  type PlaneName,
} from '../workbench/geometry'

export type Plane = PlaneName
export type SketchShape = 'rectangle' | 'circle' | 'slot' | 'polygon'
export type Sketch = {
  id: string
  name: string
  plane: Plane
  shape: SketchShape
  /** Overall size of the sketch profile in model units. */
  width: number
  height: number
  /** Distance of the sketch plane from its base plane, along the plane's normal. */
  offset?: number
  /** Position of the profile's centre on the plane. */
  x?: number
  y?: number
}
export type FeatureType =
  | 'extrude'
  | 'cut'
  | 'revolve'
  | 'fillet'
  | 'chamfer'
  | 'hole'
  | 'shell'
  | 'mirror'
  | 'pattern'
  | 'plane'
export type Feature = {
  id: string
  type: FeatureType
  name: string
  /** The sketch this feature consumes, when it needs one. */
  sketchId: string | null
  params: Record<string, number | string | boolean>
  suppressed: boolean
}
export type Orientation = 'iso' | 'front' | 'top' | 'right'
export type DisplayStyle = 'shaded' | 'shadedEdges' | 'wireframe' | 'hidden'
export type ModelerDocument = {
  version: 1
  units: 'mm' | 'in'
  material: string
  color: string
  sketches: Sketch[]
  features: Feature[]
  view: { orientation: Orientation; style: DisplayStyle; showPlanes: boolean; showOrigin: boolean }
  notes: string
}

export const MAX_FEATURES = 500
export const MAX_DOCUMENT_CHARS = 512 * 1024
export const FEATURE_TYPES: readonly FeatureType[] = [
  'extrude',
  'cut',
  'revolve',
  'fillet',
  'chamfer',
  'hole',
  'shell',
  'mirror',
  'pattern',
  'plane',
]
export const FEATURE_LABELS: Record<FeatureType, string> = {
  extrude: 'Boss-Extrude',
  cut: 'Cut-Extrude',
  revolve: 'Revolve',
  fillet: 'Fillet',
  chamfer: 'Chamfer',
  hole: 'Hole Wizard',
  shell: 'Shell',
  mirror: 'Mirror',
  pattern: 'Linear Pattern',
  plane: 'Plane',
}
export const MATERIALS = [
  'Plain Carbon Steel',
  'Aluminum 6061',
  'ABS PC',
  'PLA',
  'Brass',
  'Titanium',
] as const

export const newId = () => crypto.randomUUID().slice(0, 8)
export function newSketch(
  plane: Plane,
  shape: SketchShape,
  width: number,
  height: number,
  index: number,
  placement: { offset?: number; x?: number; y?: number } = {},
): Sketch {
  return { id: newId(), name: `Sketch${index}`, plane, shape, width, height, ...placement }
}
export function newFeature(
  type: FeatureType,
  index: number,
  params: Feature['params'] = {},
  sketchId: string | null = null,
): Feature {
  return {
    id: newId(),
    type,
    name: `${FEATURE_LABELS[type]}${index}`,
    sketchId,
    params,
    suppressed: false,
  }
}
export function emptyModeler(): ModelerDocument {
  return {
    version: 1,
    units: 'mm',
    material: MATERIALS[0],
    color: '#9aa7b4',
    sketches: [],
    features: [],
    view: { orientation: 'iso', style: 'shadedEdges', showPlanes: true, showOrigin: true },
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
const ID = /^[A-Za-z0-9_-]{1,40}$/
const isId = (v: unknown): v is string => typeof v === 'string' && ID.test(v)
const validParams = (v: unknown) =>
  record(v) &&
  Object.keys(v).length <= 20 &&
  Object.values(v).every(
    (p) =>
      (typeof p === 'string' && p.length <= 100) || num(p, -1e6, 1e6) || typeof p === 'boolean',
  )
export function validModeler(v: unknown): v is ModelerDocument {
  if (
    !record(v) ||
    !keys(v, ['version', 'units', 'material', 'color', 'sketches', 'features', 'view', 'notes'])
  )
    return false
  if (v.version !== 1 || !['mm', 'in'].includes(v.units as string)) return false
  if (typeof v.material !== 'string' || v.material.length > 60) return false
  if (typeof v.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(v.color)) return false
  if (typeof v.notes !== 'string' || v.notes.length > 20000) return false
  const { view } = v
  if (
    !record(view) ||
    !keys(view, ['orientation', 'style', 'showPlanes', 'showOrigin']) ||
    !['iso', 'front', 'top', 'right'].includes(view.orientation as string) ||
    !['shaded', 'shadedEdges', 'wireframe', 'hidden'].includes(view.style as string) ||
    typeof view.showPlanes !== 'boolean' ||
    typeof view.showOrigin !== 'boolean'
  )
    return false
  if (!Array.isArray(v.sketches) || v.sketches.length > MAX_FEATURES) return false
  const sketchIds = new Set<string>()
  for (const s of v.sketches) {
    if (
      !record(s) ||
      !keys(s, ['id', 'name', 'plane', 'shape', 'width', 'height'], ['offset', 'x', 'y']) ||
      !isId(s.id) ||
      typeof s.name !== 'string' ||
      !s.name ||
      s.name.length > 60 ||
      !['Front', 'Top', 'Right'].includes(s.plane as string) ||
      !['rectangle', 'circle', 'slot', 'polygon'].includes(s.shape as string) ||
      !num(s.width, 0.01, 1e5) ||
      !num(s.height, 0.01, 1e5) ||
      !(s.offset === undefined || num(s.offset, -1e5, 1e5)) ||
      !(s.x === undefined || num(s.x, -1e5, 1e5)) ||
      !(s.y === undefined || num(s.y, -1e5, 1e5)) ||
      sketchIds.has(s.id)
    )
      return false
    sketchIds.add(s.id)
  }
  if (!Array.isArray(v.features) || v.features.length > MAX_FEATURES) return false
  const featureIds = new Set<string>()
  for (const f of v.features) {
    if (
      !record(f) ||
      !keys(f, ['id', 'type', 'name', 'sketchId', 'params', 'suppressed']) ||
      !isId(f.id) ||
      !FEATURE_TYPES.includes(f.type as FeatureType) ||
      typeof f.name !== 'string' ||
      !f.name ||
      f.name.length > 60 ||
      !(f.sketchId === null || (isId(f.sketchId) && sketchIds.has(f.sketchId))) ||
      !validParams(f.params) ||
      typeof f.suppressed !== 'boolean' ||
      featureIds.has(f.id)
    )
      return false
    featureIds.add(f.id)
  }
  return JSON.stringify(v).length <= MAX_DOCUMENT_CHARS
}
export const modelerProblem = (doc: ModelerDocument) =>
  validModeler(doc) ? '' : 'The model could not be saved. Check its features.'

// --- Derived geometry ------------------------------------------------------------------------
export type Solid = {
  /** The feature that made this solid; patterns and mirrors share their source's feature. */
  featureId: string
  name: string
  mesh: Mesh
  /** Cuts and holes are drawn hollow and slice as holes. */
  cut: boolean
}
export type RefPlane = { id: string; name: string; base: Plane; offset: number }
export type Part = { solids: Solid[]; planes: RefPlane[] }
const SEGMENTS = 40
const THROUGH = 1e4
const sketchFrame = (s: Sketch) => {
  const f = frames[s.plane](s.offset ?? 0)
  const o = f.origin
  return {
    ...f,
    origin: vec(
      o.x + f.u.x * (s.x ?? 0) + f.v.x * (s.y ?? 0),
      o.y + f.u.y * (s.x ?? 0) + f.v.y * (s.y ?? 0),
      o.z + f.u.z * (s.x ?? 0) + f.v.z * (s.y ?? 0),
    ),
  }
}
const depthOf = (f: Feature, fallback: number) => Math.max(0.01, Number(f.params.depth ?? fallback))
/** Top of the material so far, for holes drilled from above. */
const topOf = (solids: Solid[]) =>
  Math.max(0, ...solids.filter((s) => !s.cut).map((s) => bounds(s.mesh)?.max.z ?? 0))

/** Rebuild the part from its history. Suppressed features contribute nothing. */
export function derive(doc: ModelerDocument): Part {
  const solids: Solid[] = []
  const planes: RefPlane[] = []
  const sketchOf = (f: Feature) => doc.sketches.find((s) => s.id === f.sketchId)
  const add = (f: Feature, mesh: Mesh, cut: boolean) =>
    solids.push({ featureId: f.id, name: f.name, mesh, cut })
  for (const f of doc.features) {
    if (f.suppressed) continue
    const sketch = sketchOf(f)
    const shape = sketch ? profile(sketch.shape, sketch.width, sketch.height, SEGMENTS) : null
    switch (f.type) {
      case 'extrude': {
        if (!sketch || !shape) break
        const depth = depthOf(f, 20)
        const [from, to] = f.params.end === 'Mid Plane' ? [-depth / 2, depth / 2] : [0, depth]
        add(f, extrude(shape, sketchFrame(sketch), from, to), false)
        break
      }
      case 'revolve': {
        if (!sketch || !shape) break
        add(f, revolve(shape, sketchFrame(sketch), Number(f.params.angle ?? 360), SEGMENTS), false)
        break
      }
      case 'cut': {
        if (!sketch || !shape) break
        const depth = f.params.end === 'Through All' ? THROUGH : depthOf(f, 10)
        const frame = sketchFrame(sketch)
        add(
          f,
          flip(extrude(shape, frame, f.params.end === 'Through All' ? THROUGH : 0, -depth)),
          true,
        )
        break
      }
      case 'hole': {
        const top = topOf(solids)
        const depth =
          f.params.end === 'Through All' ? top || 10 : Math.min(depthOf(f, 10), top || 10)
        const d = Math.max(0.1, Number(f.params.diameter ?? 8))
        const frame = frames.Top(top)
        frame.origin = vec(Number(f.params.x ?? 0), Number(f.params.y ?? 0), top)
        add(f, flip(extrude(profile('circle', d, d, SEGMENTS), frame, 0, -depth)), true)
        break
      }
      case 'mirror': {
        const axis = ({ Front: 'y', Right: 'x', Top: 'z' } as const)[
          String(f.params.plane ?? 'Front') as Plane
        ]
        for (const s of [...solids])
          solids.push({
            ...s,
            featureId: f.id,
            name: `${f.name} of ${s.name}`,
            mesh: mirror(s.mesh, axis),
          })
        break
      }
      case 'pattern': {
        const source = solids.at(-1)
        if (!source) break
        const count = Math.min(50, Math.max(2, Math.round(Number(f.params.count ?? 3))))
        const spacing = Number(f.params.spacing ?? 20)
        const alongY = f.params.direction === 'Y'
        for (let i = 1; i < count; i++)
          solids.push({
            ...source,
            featureId: f.id,
            name: `${f.name} ${i}`,
            mesh: translate(
              source.mesh,
              vec(alongY ? 0 : spacing * i, alongY ? spacing * i : 0, 0),
            ),
          })
        break
      }
      case 'plane':
        planes.push({
          id: f.id,
          name: f.name,
          base: String(f.params.base ?? 'Top') as Plane,
          offset: Number(f.params.offset ?? 20),
        })
        break
      default:
        // Fillet, chamfer, and shell are recorded in the history; they change no geometry yet.
        break
    }
  }
  return { solids, planes }
}
/** Every solid as one mesh; cuts keep their reversed winding so volume and slicing see holes. */
export const partMesh = (part: Part): Mesh => part.solids.flatMap((s) => s.mesh)
/** The part as one printable mesh: on the ground, footprint centred, compact enough to store. */
export const printableMesh = (doc: ModelerDocument, maxTriangles = 4000): Mesh =>
  compact(settle(decimate(partMesh(derive(doc)), maxTriangles)))
/** Feature types that produce or change geometry; the rest are annotations until a kernel exists. */
export const GEOMETRIC: readonly FeatureType[] = [
  'extrude',
  'revolve',
  'cut',
  'hole',
  'mirror',
  'pattern',
]

const DENSITY: Record<string, number> = {
  'Plain Carbon Steel': 7.8,
  'Aluminum 6061': 2.7,
  'ABS PC': 1.07,
  PLA: 1.24,
  Brass: 8.5,
  Titanium: 4.5,
}
/** Mass properties from the derived solids: signed volumes, so cuts inside a boss subtract. */
export function massProperties(doc: ModelerDocument): {
  volume: number
  mass: number
  solids: number
  size: { x: number; y: number; z: number }
} {
  const part = derive(doc)
  const cubic = Math.max(
    0,
    part.solids.reduce((sum, s) => sum + volume(s.mesh), 0),
  )
  const scale = doc.units === 'in' ? 16.387 : 1
  const b = bounds(partMesh({ ...part, solids: part.solids.filter((s) => !s.cut) }))
  return {
    volume: cubic,
    mass: ((cubic * scale) / 1000) * (DENSITY[doc.material] ?? 1),
    solids: part.solids.length,
    size: b
      ? { x: b.max.x - b.min.x, y: b.max.y - b.min.y, z: b.max.z - b.min.z }
      : { x: 0, y: 0, z: 0 },
  }
}
