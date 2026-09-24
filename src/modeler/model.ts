// Saved document for the 3D modeler prototype: a SolidWorks-shaped feature tree with sketches
// and features and their parameters, plus view settings. There is no geometry kernel yet; the
// viewport draws each feature as a projected box from its sketch size and depth, so the tree,
// the property panels, and the history are real while the rendering is a stand-in.
export type Plane = 'Front' | 'Top' | 'Right'
export type SketchShape = 'rectangle' | 'circle' | 'slot' | 'polygon'
export type Sketch = {
  id: string
  name: string
  plane: Plane
  shape: SketchShape
  /** Overall size of the sketch profile in model units. */
  width: number
  height: number
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
): Sketch {
  return { id: newId(), name: `Sketch${index}`, plane, shape, width, height }
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
const keys = (v: Record<string, unknown>, names: readonly string[]) =>
  Object.keys(v).length === names.length && names.every((n) => n in v)
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
      !keys(s, ['id', 'name', 'plane', 'shape', 'width', 'height']) ||
      !isId(s.id) ||
      typeof s.name !== 'string' ||
      !s.name ||
      s.name.length > 60 ||
      !['Front', 'Top', 'Right'].includes(s.plane as string) ||
      !['rectangle', 'circle', 'slot', 'polygon'].includes(s.shape as string) ||
      !num(s.width, 0.01, 1e5) ||
      !num(s.height, 0.01, 1e5) ||
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

// --- Derived geometry (placeholder) --------------------------------------------------------
export type SolidBox = {
  id: string
  x: number
  y: number
  z: number
  w: number
  d: number
  h: number
  cut: boolean
  color: string
}
/**
 * The stand-in for a geometry kernel: every unsuppressed extrude stacks a box on the last one,
 * a cut carves a smaller dashed box into the top of the stack, other features leave marks.
 */
export function solids(doc: ModelerDocument): SolidBox[] {
  const boxes: SolidBox[] = []
  let top = 0
  for (const f of doc.features) {
    if (f.suppressed) continue
    const sketch = doc.sketches.find((s) => s.id === f.sketchId)
    const w = sketch?.width ?? 60
    const d = sketch?.height ?? 40
    if (f.type === 'extrude' || f.type === 'revolve') {
      const h = Number(f.params.depth ?? 20)
      boxes.push({ id: f.id, x: -w / 2, y: -d / 2, z: top, w, d, h, cut: false, color: doc.color })
      top += h
    } else if (f.type === 'cut' || f.type === 'hole') {
      const h = Math.min(Number(f.params.depth ?? 10), top || 10)
      const cw = f.type === 'hole' ? Number(f.params.diameter ?? 8) : w * 0.6
      const cd = f.type === 'hole' ? cw : d * 0.6
      boxes.push({
        id: f.id,
        x: -cw / 2,
        y: -cd / 2,
        z: Math.max(0, top - h),
        w: cw,
        d: cd,
        h,
        cut: true,
        color: doc.color,
      })
    }
  }
  return boxes
}
/** Rough mass properties from the placeholder solids, for the Evaluate tab. */
export function massProperties(doc: ModelerDocument): {
  volume: number
  mass: number
  boxes: number
} {
  const density: Record<string, number> = {
    'Plain Carbon Steel': 7.8,
    'Aluminum 6061': 2.7,
    'ABS PC': 1.07,
    PLA: 1.24,
    Brass: 8.5,
    Titanium: 4.5,
  }
  let volume = 0
  for (const b of solids(doc)) volume += (b.cut ? -1 : 1) * b.w * b.d * b.h
  volume = Math.max(0, volume)
  const scale = doc.units === 'in' ? 16.387 : 1
  const cm3 = (volume * scale) / 1000
  return { volume, mass: cm3 * (density[doc.material] ?? 1), boxes: solids(doc).length }
}
