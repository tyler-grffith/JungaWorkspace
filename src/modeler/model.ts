// Saved document for the 3D modeler: a SolidWorks-shaped feature tree with sketches and
// features and their parameters, plus view settings. Geometry is derived, never stored:
// `derive` rebuilds the part from the history with the shared mesh layer and real booleans,
// so extrusions, revolves, lofts, sweeps, cuts, holes, fillets, chamfers, shells, mirrors, and
// patterns all produce one closed body whose faces remember the feature that made them.
import {
  bounds,
  compact,
  decimate,
  extrude,
  flip,
  frames,
  loft,
  mirror,
  offsetPolygon,
  profile,
  revolve,
  rotateAxis,
  roundCorners,
  chamferCorners,
  scaleMesh,
  settle,
  surfaceArea,
  sweepPath,
  translate,
  centroid,
  vec,
  volume,
  type ExtrudeOptions,
  type Frame,
  type Mesh,
  type PlaneName,
  type Polygon,
  type Segment,
  type Vec3,
  sliceMesh,
} from '../workbench/geometry'
import { concat, intersect, subtract, tagged, union, type TaggedMesh } from '../workbench/csg'
import { sketchPath, sketchRegions, validEntities, type Region, type SketchEntity } from './sketch'

export type Plane = PlaneName
export type SketchShape = 'rectangle' | 'circle' | 'slot' | 'polygon'
export type Sketch = {
  id: string
  name: string
  plane: Plane
  shape: SketchShape
  /** Overall size of the sketch profile in model units (the quick shapes). */
  width: number
  height: number
  /** Distance of the sketch plane from its base plane, along the plane's normal. */
  offset?: number
  /** Position of the profile's centre on the plane. */
  x?: number
  y?: number
  /** A free sketch: when present, the profile comes from these entities, not the quick shape. */
  entities?: SketchEntity[]
  /** Drawn on this reference-plane feature instead of the base plane. */
  planeId?: string
}
export type FeatureType =
  | 'extrude'
  | 'cut'
  | 'revolve'
  | 'loft'
  | 'sweep'
  | 'fillet'
  | 'chamfer'
  | 'hole'
  | 'shell'
  | 'mirror'
  | 'pattern'
  | 'circular'
  | 'mesh'
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
export type MeshBody = { id: string; name: string; mesh: Mesh }
export type Orientation = 'iso' | 'front' | 'back' | 'top' | 'bottom' | 'right' | 'left'
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
  /** Imported mesh bodies referenced by `mesh` features. */
  meshes?: MeshBody[]
}

export const MAX_FEATURES = 500
export const MAX_DOCUMENT_CHARS = 1024 * 1024
/** Imported mesh bodies are decimated to this many triangles so a part stays storable. */
export const MAX_MESH_TRIANGLES = 4000
/** Beyond this many triangles the rebuild stops doing booleans and stacks meshes instead. */
export const MAX_BODY_TRIANGLES = 60000
export const FEATURE_TYPES: readonly FeatureType[] = [
  'extrude',
  'cut',
  'revolve',
  'loft',
  'sweep',
  'fillet',
  'chamfer',
  'hole',
  'shell',
  'mirror',
  'pattern',
  'circular',
  'mesh',
  'plane',
]
export const FEATURE_LABELS: Record<FeatureType, string> = {
  extrude: 'Boss-Extrude',
  cut: 'Cut-Extrude',
  revolve: 'Revolve',
  loft: 'Loft',
  sweep: 'Sweep',
  fillet: 'Fillet',
  chamfer: 'Chamfer',
  hole: 'Hole',
  shell: 'Shell',
  mirror: 'Mirror',
  pattern: 'LPattern',
  circular: 'CirPattern',
  mesh: 'Mesh Body',
  plane: 'Plane',
}
/** Feature types that add material. */
export const BOSSES: readonly FeatureType[] = ['extrude', 'revolve', 'loft', 'sweep', 'mesh']
/** Feature types that remove material. */
export const CUTS: readonly FeatureType[] = ['cut', 'hole']
/** Feature types that reshape another feature. */
export const MODIFIERS: readonly FeatureType[] = ['fillet', 'chamfer', 'shell']
export const ORIENTATIONS: readonly Orientation[] = [
  'iso',
  'front',
  'back',
  'top',
  'bottom',
  'right',
  'left',
]
export const MATERIALS = [
  'Plain Carbon Steel',
  'Stainless Steel 304',
  'Aluminum 6061',
  'ABS PC',
  'PLA',
  'PETG',
  'Nylon 6/6',
  'Brass',
  'Copper',
  'Titanium',
  'Oak',
  'Acrylic',
] as const
const DENSITY: Record<string, number> = {
  'Plain Carbon Steel': 7.8,
  'Stainless Steel 304': 8.0,
  'Aluminum 6061': 2.7,
  'ABS PC': 1.07,
  PLA: 1.24,
  PETG: 1.27,
  'Nylon 6/6': 1.14,
  Brass: 8.5,
  Copper: 8.96,
  Titanium: 4.5,
  Oak: 0.75,
  Acrylic: 1.18,
}

export const newId = () => crypto.randomUUID().slice(0, 8)
export function newSketch(
  plane: Plane,
  shape: SketchShape,
  width: number,
  height: number,
  index: number,
  placement: { offset?: number; x?: number; y?: number; entities?: SketchEntity[] } = {},
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
  Object.keys(v).length <= 40 &&
  Object.values(v).every(
    (p) =>
      (typeof p === 'string' && p.length <= 100) || num(p, -1e6, 1e6) || typeof p === 'boolean',
  )
const validMesh = (v: unknown): v is Mesh =>
  Array.isArray(v) &&
  v.length % 9 === 0 &&
  v.length <= MAX_MESH_TRIANGLES * 9 &&
  v.every((n) => typeof n === 'number' && Number.isFinite(n))
export function validModeler(v: unknown): v is ModelerDocument {
  if (
    !record(v) ||
    !keys(
      v,
      ['version', 'units', 'material', 'color', 'sketches', 'features', 'view', 'notes'],
      ['meshes'],
    )
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
    !ORIENTATIONS.includes(view.orientation as Orientation) ||
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
      !keys(
        s,
        ['id', 'name', 'plane', 'shape', 'width', 'height'],
        ['offset', 'x', 'y', 'entities', 'planeId'],
      ) ||
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
      !(s.entities === undefined || validEntities(s.entities)) ||
      !(s.planeId === undefined || isId(s.planeId)) ||
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
  if (v.meshes !== undefined) {
    if (!Array.isArray(v.meshes) || v.meshes.length > 20) return false
    const meshIds = new Set<string>()
    for (const m of v.meshes) {
      if (
        !record(m) ||
        !keys(m, ['id', 'name', 'mesh']) ||
        !isId(m.id) ||
        typeof m.name !== 'string' ||
        m.name.length > 80 ||
        !validMesh(m.mesh) ||
        meshIds.has(m.id)
      )
        return false
      meshIds.add(m.id)
    }
  }
  return JSON.stringify(v).length <= MAX_DOCUMENT_CHARS
}
export const modelerProblem = (doc: ModelerDocument) =>
  validModeler(doc) ? '' : 'The model could not be saved. Check its features.'

// --- Sketch geometry -----------------------------------------------------------------------------
export type RefPlane = { id: string; name: string; base: Plane; offset: number }
/** The plane frame a sketch is drawn on, moved to the sketch's centre. */
export function sketchFrame(s: Sketch, planes: RefPlane[] = []): Frame {
  const ref = s.planeId ? planes.find((p) => p.id === s.planeId) : undefined
  const base = ref?.base ?? s.plane
  const f = frames[base]((ref?.offset ?? 0) + (s.offset ?? 0))
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
/** The closed regions a sketch encloses: a free sketch's loops, or the quick shape. */
export function sketchRegionsOf(s: Sketch): Region[] {
  if (s.entities) return sketchRegions(s.entities)
  return [{ outer: profile(s.shape, s.width, s.height, SEGMENTS), holes: [] }]
}
/** Whether a sketch encloses at least one region. */
export const sketchIsClosed = (s: Sketch) => sketchRegionsOf(s).length > 0
const SEGMENTS = 48
const THROUGH = 1e4

// --- Derived geometry ------------------------------------------------------------------------
export type Solid = {
  /** The feature that made this solid; patterns and mirrors share their source's feature. */
  featureId: string
  name: string
  mesh: Mesh
  /** Cuts and holes remove material. */
  cut: boolean
}
export type Part = {
  /** Every feature's own contribution before booleans, for the tree and highlights. */
  solids: Solid[]
  /** The finished body: one closed mesh whose triangles are tagged with their feature. */
  body: TaggedMesh
  planes: RefPlane[]
  /** Features that could not be built, and why. */
  errors: Record<string, string>
  /** True when the body grew past the boolean budget and later features were stacked instead. */
  approximate: boolean
}
type Contribution = { feature: Feature; mesh: Mesh; cut: boolean }
type Step = Part & { contributions: Contribution[] }
type Mods = ExtrudeOptions & { shell?: { thickness: number; open: string } }
type Options = { upTo?: number }

const cache = new Map<string, Step>()
const CACHE_LIMIT = 120
const remember = (key: string, step: Step) => {
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value!)
  cache.set(key, step)
}
export const clearDeriveCache = () => cache.clear()

/**
 * Rebuild the part from its history. Suppressed features contribute nothing; `upTo` rolls the
 * history back to that many features. Each step is cached by the history that leads to it, so
 * editing the last feature recomputes only the last boolean.
 */
export function derive(doc: ModelerDocument, options: Options = {}): Part {
  const features = doc.features.slice(0, options.upTo ?? doc.features.length)
  const modsByTarget = collectModifiers(features)
  let step: Step = {
    solids: [],
    body: { mesh: [], tags: [] },
    planes: [],
    errors: {},
    approximate: false,
    contributions: [],
  }
  let signature = ''
  for (const f of features) {
    signature += '|' + signatureOf(doc, f, modsByTarget.get(f.id) ?? [])
    const hit = cache.get(signature)
    if (hit) {
      step = hit
      continue
    }
    step =
      f.suppressed || MODIFIERS.includes(f.type)
        ? { ...step }
        : applyFeature(doc, step, f, modsByTarget)
    if (MODIFIERS.includes(f.type) && !f.suppressed) {
      const target = String(f.params.targetId ?? '')
      const exists = features.some(
        (g) => g.id === target && (BOSSES.includes(g.type) || CUTS.includes(g.type)),
      )
      if (!exists)
        step = {
          ...step,
          errors: {
            ...step.errors,
            [f.id]: 'Its target feature is gone; edit it and pick another.',
          },
        }
    }
    remember(signature, step)
  }
  return step
}
/** Fillets, chamfers, and shells reshape the feature they target; group them by that target. */
function collectModifiers(features: Feature[]): Map<string, Feature[]> {
  const out = new Map<string, Feature[]>()
  for (const f of features) {
    if (!MODIFIERS.includes(f.type) || f.suppressed) continue
    const target = String(f.params.targetId ?? '')
    out.set(target, [...(out.get(target) ?? []), f])
  }
  return out
}
function signatureOf(doc: ModelerDocument, f: Feature, mods: Feature[]): string {
  const sketchIds = [f.sketchId, f.params.sketch2, f.params.pathSketch]
    .map((id) => (typeof id === 'string' ? id : ''))
    .filter(Boolean)
  const sketches = sketchIds.map((id) => doc.sketches.find((s) => s.id === id))
  const planes = sketches.map((s) => s?.planeId && doc.features.find((p) => p.id === s.planeId))
  const mesh = f.type === 'mesh' ? doc.meshes?.find((m) => m.id === f.params.meshId) : undefined
  return JSON.stringify([f, mods, sketches, planes, mesh?.mesh.length, mesh?.id])
}
const modsFor = (f: Feature, mods: Map<string, Feature[]>): Mods => {
  const out: Mods = { segments: 10 }
  for (const m of mods.get(f.id) ?? []) {
    const edges = String(m.params.edges ?? 'All edges')
    const size = Math.max(0.01, Number(m.params.radius ?? m.params.distance ?? 1))
    const key = m.type === 'fillet' ? 'Fillet' : 'Chamfer'
    if (m.type === 'shell') {
      out.shell = {
        thickness: Math.max(0.01, Number(m.params.thickness ?? 2)),
        open: String(m.params.open ?? 'Top'),
      }
      continue
    }
    // On a cut the "top" edges are the pocket floor, which is the cutter's far end.
    const vertical = edges === 'All edges' || edges === 'Vertical edges'
    const top = edges === 'All edges' || edges === 'Top edges' || edges === 'Top and bottom'
    const bottom = edges === 'All edges' || edges === 'Bottom edges' || edges === 'Top and bottom'
    if (vertical) out[`corner${key}`] = size
    if (top) out[`top${key}`] = size
    if (bottom) out[`bottom${key}`] = size
  }
  return out
}
const paramNum = (f: Feature, key: string, fallback: number) => {
  const v = Number(f.params[key])
  return Number.isFinite(v) && f.params[key] !== undefined && f.params[key] !== '' ? v : fallback
}

function applyFeature(
  doc: ModelerDocument,
  prev: Step,
  f: Feature,
  modsByTarget: Map<string, Feature[]>,
): Step {
  const step: Step = {
    ...prev,
    solids: [...prev.solids],
    planes: [...prev.planes],
    errors: { ...prev.errors },
    contributions: [...prev.contributions],
  }
  const fail = (why: string) => {
    step.errors[f.id] = why
    return step
  }
  const sketch = doc.sketches.find((s) => s.id === f.sketchId)
  const regions = sketch ? sketchRegionsOf(sketch) : []
  const mods = modsFor(f, modsByTarget)
  const add = (mesh: Mesh, cut: boolean, name = f.name) => {
    if (!mesh.length) return
    step.solids.push({ featureId: f.id, name, mesh, cut })
    step.contributions.push({ feature: f, mesh, cut })
    combine(step, tagged(mesh, f.id), cut)
  }
  switch (f.type) {
    case 'extrude':
    case 'cut': {
      if (!sketch) return fail('Select a sketch for this feature.')
      if (!regions.length) return fail(`${sketch.name} does not enclose a closed region.`)
      const cut = f.type === 'cut'
      const frame = sketchFrame(sketch, step.planes)
      const end = String(f.params.end ?? 'Blind')
      const depth = Math.max(0.01, paramNum(f, 'depth', cut ? 10 : 20))
      const reverse = String(f.params.direction ?? 'Normal') === 'Reverse' || f.params.flip === true
      const both = String(f.params.direction ?? 'Normal') === 'Both'
      const sign = cut ? -1 : 1
      let from = 0
      let to = sign * depth
      if (end === 'Mid Plane') {
        from = -depth / 2
        to = depth / 2
      } else if (end === 'Through All') to = sign * THROUGH
      else if (end === 'Up To Next' || end === 'Up To Body') {
        const reach = extentAlong(step.body.mesh, frame, sign * (reverse ? -1 : 1) > 0 ? 1 : -1)
        to = sign * (reach > 0.01 ? reach : depth)
      }
      if (reverse) {
        from = -from
        to = -to
      }
      if (both) {
        from = -Math.max(0.01, paramNum(f, 'depth2', depth))
        to = sign * depth
      }
      if (end === 'Through All' && cut) from = THROUGH
      const draft = paramNum(f, 'draft', 0)
      const mesh = regions.flatMap((r) =>
        extrude(r.outer, frame, from, to, { ...mods, holes: r.holes, draft }),
      )
      add(mods.shell && !cut ? shelled(mesh, regions, frame, from, to, mods) : mesh, cut)
      return step
    }
    case 'revolve': {
      if (!sketch) return fail('Select a sketch for this feature.')
      if (!regions.length) return fail(`${sketch.name} does not enclose a closed region.`)
      const frame = sketchFrame(sketch, step.planes)
      const angle = Math.min(360, Math.max(1, paramNum(f, 'angle', 360)))
      const cut = f.params.cut === true
      const axis = String(f.params.axis ?? 'Sketch centreline')
      const meshes = regions.map((r) => {
        let ring = r.outer
        if (mods.cornerFillet) ring = roundCorners(ring, mods.cornerFillet, mods.segments)
        else if (mods.cornerChamfer) ring = chamferCorners(ring, mods.cornerChamfer)
        const shifted = shiftForAxis(ring, axis, paramNum(f, 'axisOffset', 0))
        const solid = revolve(shifted, frame, angle, SEGMENTS)
        if (!mods.shell) return solid
        const inner = offsetPolygon(shifted, mods.shell.thickness)
        return inner.length >= 3
          ? subtract(tagged(solid, f.id), tagged(revolve(inner, frame, angle, SEGMENTS), f.id)).mesh
          : solid
      })
      add(meshes.flat(), cut)
      return step
    }
    case 'loft': {
      const second = doc.sketches.find((s) => s.id === f.params.sketch2)
      if (!sketch || !second)
        return fail('A loft needs two sketches: select one and pick the other in its properties.')
      const a = regions[0]
      const b = sketchRegionsOf(second)[0]
      if (!a || !b) return fail('Both loft sketches must enclose a closed region.')
      add(
        loft(
          a.outer,
          sketchFrame(sketch, step.planes),
          b.outer,
          sketchFrame(second, step.planes),
          SEGMENTS,
        ),
        f.params.cut === true,
      )
      return step
    }
    case 'sweep': {
      const path = doc.sketches.find((s) => s.id === f.params.pathSketch)
      if (!sketch || !path) return fail('A sweep needs a profile sketch and a path sketch.')
      if (!regions.length) return fail(`${sketch.name} does not enclose a closed region.`)
      const points2 = sketchPath(path.entities ?? [])
      if (points2.length < 2) return fail(`${path.name} has no open line or arc chain to follow.`)
      const pf = sketchFrame(path, step.planes)
      const points3 = points2.map((p) =>
        vec(
          pf.origin.x + pf.u.x * p.x + pf.v.x * p.y,
          pf.origin.y + pf.u.y * p.x + pf.v.y * p.y,
          pf.origin.z + pf.u.z * p.x + pf.v.z * p.y,
        ),
      )
      const frame = sketchFrame(sketch, step.planes)
      add(
        regions.flatMap((r) => sweepPath(r.outer, points3, frame)),
        f.params.cut === true,
      )
      return step
    }
    case 'hole': {
      const face = String(f.params.face ?? 'Top')
      const frame = faceFrame(step.body.mesh, face)
      const along = extentAlong(step.body.mesh, frame, -1)
      const end = String(f.params.end ?? 'Blind')
      const depth =
        end === 'Through All'
          ? along || 10
          : Math.min(Math.max(0.01, paramNum(f, 'depth', 10)), along || 1e9)
      const d = Math.max(0.1, paramNum(f, 'diameter', 8))
      frame.origin = vec(
        frame.origin.x + frame.u.x * paramNum(f, 'x', 0) + frame.v.x * paramNum(f, 'y', 0),
        frame.origin.y + frame.u.y * paramNum(f, 'x', 0) + frame.v.y * paramNum(f, 'y', 0),
        frame.origin.z + frame.u.z * paramNum(f, 'x', 0) + frame.v.z * paramNum(f, 'y', 0),
      )
      const circle = (dia: number) => profile('circle', dia, dia, SEGMENTS)
      const kind = String(f.params.type ?? 'Simple')
      let cutter = extrude(circle(d), frame, 0.5, -depth, mods)
      if (kind === 'Counterbore') {
        const cd = Math.max(d, paramNum(f, 'cbDiameter', d * 1.8))
        const cdepth = Math.max(0.01, paramNum(f, 'cbDepth', d / 2))
        cutter = union(
          tagged(cutter, f.id),
          tagged(extrude(circle(cd), frame, 0.5, -cdepth), f.id),
        ).mesh
      } else if (kind === 'Countersink') {
        const cd = Math.max(d, paramNum(f, 'csDiameter', d * 2))
        const angle = Math.min(170, Math.max(10, paramNum(f, 'csAngle', 90)))
        const cdepth = (cd - d) / 2 / Math.tan(((angle / 2) * Math.PI) / 180)
        const top: Frame = { ...frame, origin: along3(frame, 0.5) }
        const bottom: Frame = { ...frame, origin: along3(frame, -cdepth) }
        cutter = union(
          tagged(cutter, f.id),
          tagged(
            loft(circle(cd + (0.5 * (cd - d)) / cdepth), top, circle(d), bottom, SEGMENTS),
            f.id,
          ),
        ).mesh
      }
      add(cutter, true)
      return step
    }
    case 'mirror': {
      const axis =
        ({ Front: 'y', Right: 'x', Top: 'z' } as const)[
          String(f.params.plane ?? 'Front') as Plane
        ] ?? 'y'
      if (String(f.params.target ?? 'Body') === 'Body') {
        const mirrored = { mesh: mirror(step.body.mesh, axis), tags: [...step.body.tags] }
        step.solids.push({ featureId: f.id, name: f.name, mesh: mirrored.mesh, cut: false })
        step.contributions.push({ feature: f, mesh: mirrored.mesh, cut: false })
        combine(step, mirrored, false)
      } else {
        const source = step.contributions.at(-1)
        if (!source) return fail('There is no feature to mirror yet.')
        add(mirror(source.mesh, axis), source.cut, `${f.name} of ${source.feature.name}`)
      }
      return step
    }
    case 'pattern': {
      const source = step.contributions.at(-1)
      if (!source) return fail('There is no feature to pattern yet.')
      const count = Math.min(100, Math.max(1, Math.round(paramNum(f, 'count', 3))))
      const count2 = Math.min(100, Math.max(1, Math.round(paramNum(f, 'count2', 1))))
      const along = (dir: string, distance: number): Vec3 =>
        dir === 'Y' ? vec(0, distance, 0) : dir === 'Z' ? vec(0, 0, distance) : vec(distance, 0, 0)
      const d1 = along(String(f.params.direction ?? 'X'), paramNum(f, 'spacing', 20))
      const d2 = along(String(f.params.direction2 ?? 'Y'), paramNum(f, 'spacing2', 20))
      const copies: Mesh[] = []
      for (let i = 0; i < count; i++)
        for (let j = 0; j < count2; j++) {
          if (!i && !j) continue
          copies.push(
            translate(
              source.mesh,
              vec(d1.x * i + d2.x * j, d1.y * i + d2.y * j, d1.z * i + d2.z * j),
            ),
          )
        }
      copies.forEach((m, i) => add(m, source.cut, `${f.name} ${i + 1}`))
      return step
    }
    case 'circular': {
      const source = step.contributions.at(-1)
      if (!source) return fail('There is no feature to pattern yet.')
      const count = Math.min(100, Math.max(2, Math.round(paramNum(f, 'count', 6))))
      const total = paramNum(f, 'angle', 360)
      const equal = f.params.equal !== false
      const axisName = String(f.params.axis ?? 'Z')
      const axis = axisName === 'X' ? vec(1, 0, 0) : axisName === 'Y' ? vec(0, 1, 0) : vec(0, 0, 1)
      const origin = vec(paramNum(f, 'x', 0), paramNum(f, 'y', 0), paramNum(f, 'z', 0))
      for (let i = 1; i < count; i++) {
        const angle = equal ? (total * i) / (total >= 360 ? count : count - 1) : total * i
        add(rotateAxis(source.mesh, axis, angle, origin), source.cut, `${f.name} ${i}`)
      }
      return step
    }
    case 'mesh': {
      const body = doc.meshes?.find((m) => m.id === f.params.meshId)
      if (!body) return fail('Its mesh is missing; import the file again.')
      const scale = Math.max(0.001, paramNum(f, 'scale', 1))
      add(
        translate(
          scaleMesh(body.mesh, scale),
          vec(paramNum(f, 'x', 0), paramNum(f, 'y', 0), paramNum(f, 'z', 0)),
        ),
        f.params.cut === true,
      )
      return step
    }
    case 'plane':
      step.planes.push({
        id: f.id,
        name: f.name,
        base: String(f.params.base ?? f.params.from ?? 'Top') as Plane,
        offset: paramNum(f, 'offset', 20),
      })
      return step
    default:
      return step
  }
}
/** Boolean a tagged contribution into the body, or stack it once the body is past the budget. */
function combine(step: Step, part: TaggedMesh, cut: boolean) {
  const heavy =
    step.approximate || (step.body.mesh.length + part.mesh.length) / 9 > MAX_BODY_TRIANGLES
  if (heavy) {
    step.approximate = true
    step.body = concat([step.body, cut ? { mesh: flip(part.mesh), tags: part.tags } : part])
    return
  }
  step.body = cut ? subtract(step.body, part) : union(step.body, part)
}
/** Hollow an extrusion: subtract the same sweep inset by the wall thickness, open where asked. */
function shelled(
  mesh: Mesh,
  regions: Region[],
  frame: Frame,
  from: number,
  to: number,
  mods: Mods,
): Mesh {
  const t = mods.shell!.thickness
  const open = mods.shell!.open
  const dir = Math.sign(to - from) || 1
  const innerFrom = open === 'Bottom' || open === 'Both' ? from - dir * 1 : from + dir * t
  const innerTo = open === 'Top' || open === 'Both' ? to + dir * 1 : to - dir * t
  if ((innerTo - innerFrom) * dir <= 0) return mesh
  const inner = regions.flatMap((r) => {
    const outer = offsetPolygon(r.outer, t)
    if (outer.length < 3) return []
    return extrude(outer, frame, innerFrom, innerTo, {
      holes: r.holes.map((h) => offsetPolygon(h, -t)).filter((h) => h.length >= 3),
      draft: mods.draft,
      cornerFillet: mods.cornerFillet ? Math.max(0.01, mods.cornerFillet - t) : undefined,
      cornerChamfer: mods.cornerChamfer,
      segments: mods.segments,
    })
  })
  return inner.length ? subtract(tagged(mesh, ''), tagged(inner, '')).mesh : mesh
}
/** Move a profile so the revolve axis (the frame's v axis) sits where the feature asks. */
function shiftForAxis(ring: Polygon, axis: string, offset: number): Polygon {
  const xs = ring.map((p) => p.x)
  const shift =
    axis === 'Left edge'
      ? -Math.min(...xs)
      : axis === 'Right edge'
        ? -Math.max(...xs)
        : axis === 'Sketch centreline'
          ? 0
          : 0
  return ring.map((p) => ({ x: p.x + shift + offset, y: p.y }))
}
/** How far the body extends from a frame's origin along its normal (or against it). */
function extentAlong(mesh: Mesh, frame: Frame, direction: 1 | -1): number {
  let reach = 0
  for (let i = 0; i + 2 < mesh.length; i += 3) {
    const d =
      (mesh[i] - frame.origin.x) * frame.normal.x +
      (mesh[i + 1] - frame.origin.y) * frame.normal.y +
      (mesh[i + 2] - frame.origin.z) * frame.normal.z
    reach = Math.max(reach, d * direction)
  }
  return reach
}
const along3 = (frame: Frame, d: number): Vec3 =>
  vec(
    frame.origin.x + frame.normal.x * d,
    frame.origin.y + frame.normal.y * d,
    frame.origin.z + frame.normal.z * d,
  )
/** A frame on the named outer face of the body, normal pointing out, for drilling into it. */
function faceFrame(mesh: Mesh, face: string): Frame {
  const b = bounds(mesh)
  switch (face) {
    case 'Bottom': {
      const f = frames.Top(b ? b.min.z : 0)
      return { ...f, v: vec(0, -1, 0), normal: vec(0, 0, -1) }
    }
    case 'Front':
      return frames.Front(b ? -b.min.y : 0)
    case 'Back': {
      const f = frames.Front(b ? -b.max.y : 0)
      return { ...f, u: vec(-1, 0, 0), normal: vec(0, 1, 0) }
    }
    case 'Right':
      return frames.Right(b ? b.max.x : 0)
    case 'Left': {
      const f = frames.Right(b ? b.min.x : 0)
      return { ...f, u: vec(0, -1, 0), normal: vec(-1, 0, 0) }
    }
    default:
      return frames.Top(b ? b.max.z : 0)
  }
}

/** The body's outline on a sketch plane, in the plane's own coordinates, for sketching on a face. */
export function planeSection(mesh: Mesh, frame: Frame): Segment[] {
  const local: Mesh = []
  for (let i = 0; i + 2 < mesh.length; i += 3) {
    const p = vec(
      mesh[i] - frame.origin.x,
      mesh[i + 1] - frame.origin.y,
      mesh[i + 2] - frame.origin.z,
    )
    local.push(
      p.x * frame.u.x + p.y * frame.u.y + p.z * frame.u.z,
      p.x * frame.v.x + p.y * frame.v.y + p.z * frame.v.z,
      p.x * frame.normal.x + p.y * frame.normal.y + p.z * frame.normal.z,
    )
  }
  // Nudge just inside the material so a sketch on a face sees that face's outline.
  const cut = sliceMesh(local, -0.01)
  return cut.length ? cut : sliceMesh(local, 0.01)
}
/** The finished body as one mesh. */
export const partMesh = (part: Part): Mesh => part.body.mesh
/** The part as one printable mesh: on the ground, footprint centred, compact enough to store. */
export const printableMesh = (doc: ModelerDocument, maxTriangles = 4000): Mesh =>
  compact(settle(decimate(partMesh(derive(doc)), maxTriangles)))
/** Feature types that produce or change geometry; reference planes are the exception. */
export const GEOMETRIC: readonly FeatureType[] = FEATURE_TYPES.filter((t) => t !== 'plane')
/** The body cut by a plane, capped, for section views. */
export function sectionOf(
  body: TaggedMesh,
  axis: 'x' | 'y' | 'z',
  at: number,
  keepBelow: boolean,
): TaggedMesh {
  const b = bounds(body.mesh)
  if (!b) return body
  const reach = Math.max(b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z) * 4 + 100
  const lo = { x: b.min.x - 10, y: b.min.y - 10, z: b.min.z - 10 }
  const hi = { x: b.max.x + 10, y: b.max.y + 10, z: b.max.z + 10 }
  if (keepBelow) hi[axis] = at
  else lo[axis] = at
  const size = vec(hi.x - lo.x, hi.y - lo.y, hi.z - lo.z)
  if (size.x <= 0 || size.y <= 0 || size.z <= 0) return { mesh: [], tags: [] }
  const box = translate(
    extrude(profile('rectangle', size.x, size.y), frames.Top(), 0, size.z),
    vec(lo.x + size.x / 2, lo.y + size.y / 2, lo.z),
  )
  void reach
  return intersect(body, tagged(box, 'section'))
}

/** Mass properties from the finished body. */
export function massProperties(
  doc: ModelerDocument,
  part = derive(doc),
): {
  volume: number
  mass: number
  area: number
  centroid: Vec3
  solids: number
  size: { x: number; y: number; z: number }
} {
  const mesh = part.body.mesh
  const cubic = Math.max(0, volume(mesh))
  const scale = doc.units === 'in' ? 16.387 : 1
  const b = bounds(mesh)
  return {
    volume: cubic,
    mass: ((cubic * scale) / 1000) * (DENSITY[doc.material] ?? 1),
    area: surfaceArea(mesh),
    centroid: centroid(mesh),
    solids: part.solids.length,
    size: b
      ? { x: b.max.x - b.min.x, y: b.max.y - b.min.y, z: b.max.z - b.min.z }
      : { x: 0, y: 0, z: 0 },
  }
}
/** Manifold check: every edge of a closed mesh is shared by exactly two triangles. */
export function checkMesh(mesh: Mesh): { edges: number; open: number; triangles: number } {
  const count = new Map<string, number>()
  const key = (i: number) =>
    `${mesh[i].toFixed(3)},${mesh[i + 1].toFixed(3)},${mesh[i + 2].toFixed(3)}`
  for (let t = 0; t + 8 < mesh.length; t += 9) {
    const k = [key(t), key(t + 3), key(t + 6)]
    for (let e = 0; e < 3; e++) {
      const edge = [k[e], k[(e + 1) % 3]].sort().join('|')
      count.set(edge, (count.get(edge) ?? 0) + 1)
    }
  }
  let open = 0
  for (const n of count.values()) if (n !== 2) open++
  return { edges: count.size, open, triangles: Math.floor(mesh.length / 9) }
}
/** A short description of a feature's key numbers for the tree. */
export function featureSummary(f: Feature): string {
  const n = (k: string) => f.params[k]
  switch (f.type) {
    case 'extrude':
    case 'cut':
      return n('end') === 'Through All' ? 'through' : `${n('depth') ?? ''} mm`
    case 'revolve':
      return `${n('angle') ?? 360}°`
    case 'hole':
      return `Ø${n('diameter') ?? 8}`
    case 'fillet':
      return `R${n('radius') ?? 2}`
    case 'chamfer':
      return `${n('distance') ?? 1} mm`
    case 'shell':
      return `${n('thickness') ?? 2} mm`
    case 'pattern':
      return `${n('count') ?? 3} × ${n('spacing') ?? 20}`
    case 'circular':
      return `${n('count') ?? 6} × ${n('angle') ?? 360}°`
    case 'plane':
      return `${n('offset') ?? 0} mm`
    case 'mirror':
      return String(n('plane') ?? 'Front')
    default:
      return ''
  }
}
