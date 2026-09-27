// The slicer: a Bambu Studio-shaped workbench (Prepare / Preview / Device / Project tabs,
// printer-filament-process sidebar, build plate viewport, object panel, slice button) over a
// project document. Objects are boxes, imported STL meshes, or parts sent from the modeler or
// painter; the plate is really sliced into toolpaths that Preview draws layer by layer, by line
// type, speed, height, or filament, and that export as G-code or 3MF. The printer on the Device
// tab is simulated from the estimate.
import {
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from 'react'
import {
  ArrowLeft,
  Boxes,
  Copy,
  Fan,
  FileUp,
  FlipHorizontal2,
  FlipVertical2,
  Gauge,
  Home,
  LayoutGrid,
  Layers,
  Maximize2,
  PackagePlus,
  Paintbrush,
  Palette,
  Pause,
  Play,
  Power,
  Printer,
  RotateCcw,
  RotateCw,
  Route,
  Scissors,
  Settings2,
  Shuffle,
  Slice,
  Square,
  StickyNote,
  Thermometer,
  Trash2,
  Waves,
} from 'lucide-react'
import Workbench from '../workbench/Workbench'
import Viewport3D, { gridLines, type SceneItem, type ViewportHandle } from '../workbench/Viewport3D'
import {
  bounds,
  compact,
  decimate,
  extrude,
  frames,
  mirror as mirrorMesh,
  parseStl,
  profile,
  rotateX,
  rotateY,
  settle,
  toStl,
  translate,
  triangleCount,
  vec,
  type Mesh,
} from '../workbench/geometry'
import { intersect, tagged } from '../workbench/csg'
import { toThreeMf } from '../workbench/threemf'
import { downloadBlob, safeFilename } from '../canvas/export'
import { printableMesh } from '../modeler/model'
import {
  PATH_COLORS,
  PATH_KINDS,
  PATH_LABELS,
  slicePlate,
  toGcode,
  type SlicedPlate,
} from './slicing'
import type { Menu, ParamValue, RibbonTab, ToolDef, TreeNode } from '../workbench/types'
import {
  FILAMENT_TYPES,
  INFILL_PATTERNS,
  MAX_SLOTS,
  MAX_TRIANGLES,
  OBJECT_COLORS,
  PRINTERS,
  PROCESS_PRESETS,
  activePlate,
  allSlots,
  applyPreset,
  arrange,
  bedFor,
  filamentTemps,
  footprint,
  formatDuration,
  meshObject,
  newObject,
  newPlate,
  normalizeSlicer,
  objectMesh,
  outsideBed,
  plateMesh,
  printerProfile,
  validSlicer,
  type Filament,
  type FilamentType,
  type ObjectOverrides,
  type PlateObject,
  type Process,
  type SlicerDocument,
  type SlicerView,
} from './model'
import type { EditorProps } from '../modules/editors'
import '../canvas/canvas.css'

const RIBBON: RibbonTab[] = [
  {
    id: 'prepare',
    label: 'Prepare',
    groups: [
      {
        label: 'Objects',
        tools: [
          {
            id: 'add',
            label: 'Add Object',
            icon: PackagePlus,
            hint: 'Place a box of the given size on the plate.',
            params: [
              { id: 'name', label: 'Name', kind: 'text', default: 'Bracket' },
              {
                id: 'width',
                label: 'Width (X)',
                kind: 'number',
                default: 40,
                unit: 'mm',
                min: 1,
                max: 400,
              },
              {
                id: 'depth',
                label: 'Depth (Y)',
                kind: 'number',
                default: 40,
                unit: 'mm',
                min: 1,
                max: 400,
              },
              {
                id: 'height',
                label: 'Height (Z)',
                kind: 'number',
                default: 30,
                unit: 'mm',
                min: 1,
                max: 400,
              },
            ],
          },
          {
            id: 'import',
            label: 'Import STL',
            icon: FileUp,
            hint: 'Load a mesh from an STL file onto the plate.',
          },
          { id: 'clone', label: 'Clone', icon: Copy, hint: 'Duplicate the selected object.' },
          { id: 'delete', label: 'Delete', icon: Trash2, shortcut: 'Del' },
          {
            id: 'arrange',
            label: 'Arrange',
            icon: LayoutGrid,
            hint: 'Lay the plate out on a grid, largest first.',
          },
          {
            id: 'orient',
            label: 'Auto Orient',
            icon: Shuffle,
            hint: 'Turn the selected object so its longer side runs along X.',
          },
        ],
      },
      {
        label: 'Transform',
        tools: [
          {
            id: 'rotate:x',
            label: 'Rotate X 90°',
            icon: RotateCw,
            hint: 'Tip the selected object over the X axis.',
          },
          {
            id: 'rotate:y',
            label: 'Rotate Y 90°',
            icon: RotateCcw,
            hint: 'Tip the selected object over the Y axis.',
          },
          { id: 'mirror:x', label: 'Mirror X', icon: FlipHorizontal2 },
          { id: 'mirror:y', label: 'Mirror Y', icon: FlipVertical2 },
          {
            id: 'layflat',
            label: 'Lay Flat',
            icon: Layers,
            hint: 'Turn the selected object onto its lowest, widest face.',
          },
          {
            id: 'fit',
            label: 'Scale to Fit',
            icon: Maximize2,
            hint: 'Shrink the selected object until it fits the build volume.',
          },
          {
            id: 'cut',
            label: 'Cut',
            icon: Scissors,
            hint: 'Cut the selected object with a horizontal plane into two objects.',
            params: [
              {
                id: 'height',
                label: 'Cut height',
                kind: 'number',
                default: 10,
                unit: 'mm',
                min: 0.1,
                max: 400,
              },
            ],
          },
        ],
      },
      {
        label: 'Plates',
        tools: [
          { id: 'plate:add', label: 'Add Plate', icon: Square },
          { id: 'plate:next', label: 'Next Plate', icon: Layers },
          { id: 'plate:delete', label: 'Delete Plate', icon: Trash2 },
        ],
      },
    ],
  },
  {
    id: 'preview',
    label: 'Preview',
    groups: [
      {
        label: 'Layers',
        tools: [
          { id: 'layer:up', label: 'Layer Up', icon: Layers, hint: 'Show one more layer.' },
          { id: 'layer:down', label: 'Layer Down', icon: Layers },
          { id: 'layer:first', label: 'First Layer', icon: Square },
          { id: 'layer:all', label: 'All Layers', icon: Boxes },
        ],
      },
      {
        label: 'Colour scheme',
        tools: [
          { id: 'scheme:type', label: 'Line Type', icon: Paintbrush },
          { id: 'scheme:speed', label: 'Speed', icon: Gauge },
          { id: 'scheme:height', label: 'Layer Height', icon: Layers },
          { id: 'scheme:filament', label: 'Filament', icon: Palette },
          {
            id: 'toggle:travel',
            label: 'Travel',
            icon: Route,
            hint: 'Show the head’s moves between paths.',
          },
        ],
      },
    ],
  },
  {
    id: 'device',
    label: 'Device',
    groups: [
      {
        label: 'Control',
        tools: [
          { id: 'device:home', label: 'Home', icon: Home },
          { id: 'device:print', label: 'Print Plate', icon: Play },
          { id: 'device:pause', label: 'Pause', icon: Pause },
          { id: 'device:stop', label: 'Stop', icon: Power },
          { id: 'device:cool', label: 'Cooldown', icon: Fan },
        ],
      },
    ],
  },
  {
    id: 'project',
    label: 'Project',
    groups: [
      {
        label: 'Project',
        tools: [
          { id: 'notes', label: 'Notes', icon: StickyNote },
          {
            id: 'export:3mf',
            label: 'Export 3MF',
            icon: Boxes,
            hint: 'Download the plate as a 3MF file for Bambu Studio or PrusaSlicer.',
          },
          { id: 'export:gcode', label: 'Export G-code', icon: Printer },
          {
            id: 'export:json',
            label: 'Export Project',
            icon: FileUp,
            hint: 'Download the project as JSON.',
          },
        ],
      },
    ],
  },
]
const MENUS: Menu[] = [
  {
    label: 'File',
    items: [
      { label: 'New Project', shortcut: 'Ctrl+N', command: 'new' },
      { label: 'Import STL…', shortcut: 'Ctrl+I', command: 'import' },
      { label: 'Import from Modeler', command: 'import:modeler' },
      { label: 'Save Project', shortcut: 'Ctrl+S', command: 'save' },
      'separator',
      { label: 'Export Project (JSON)…', command: 'export:json' },
      { label: 'Export Plate as G-code…', command: 'export:gcode' },
      { label: 'Export Plate as 3MF…', command: 'export:3mf' },
      { label: 'Export Plate as STL…', command: 'export:stl' },
    ],
  },
  {
    label: 'Edit',
    items: [
      { label: 'Undo', shortcut: 'Ctrl+Z', command: 'undo' },
      { label: 'Redo', shortcut: 'Ctrl+Y', command: 'redo' },
      'separator',
      { label: 'Clone', shortcut: 'Ctrl+D', command: 'clone' },
      { label: 'Delete', shortcut: 'Del', command: 'delete' },
      { label: 'Arrange', shortcut: 'A', command: 'arrange' },
      { label: 'Lay Flat', shortcut: 'L', command: 'layflat' },
    ],
  },
  {
    label: 'View',
    items: [
      { label: 'Prepare', command: 'view:prepare' },
      { label: 'Preview', command: 'view:preview' },
      { label: 'Device', command: 'view:device' },
      { label: 'Project', command: 'view:project' },
      'separator',
      { label: 'Zoom to Fit', shortcut: 'F', command: 'zoom' },
    ],
  },
  { label: 'Help', items: [{ label: 'About the slicer', command: 'about' }] },
]
const SHORTCUTS: Record<string, string> = {
  'Ctrl+Z': 'undo',
  'Ctrl+Y': 'redo',
  'Ctrl+D': 'clone',
  Del: 'delete',
  A: 'arrange',
  L: 'layflat',
}
type History = { past: SlicerDocument[]; future: SlicerDocument[] }
export type Scheme = 'type' | 'speed' | 'height' | 'filament'

/** A colour along blue → green → yellow → red for a 0–1 value, as Bambu's speed view. */
export function heat(t: number): string {
  const stops = [
    [59, 76, 192],
    [46, 165, 110],
    [230, 200, 60],
    [210, 50, 40],
  ]
  const x = Math.max(0, Math.min(1, t)) * (stops.length - 1)
  const i = Math.min(stops.length - 2, Math.floor(x))
  const f = x - i
  const c = stops[i].map((v, k) => Math.round(v + (stops[i + 1][k] - v) * f))
  return `rgb(${c[0]},${c[1]},${c[2]})`
}

/** The build plate viewport shared by the editor and the read-only output. */
export const SlicerViewport = forwardRef<
  ViewportHandle,
  {
    document: SlicerDocument
    selected: string | null
    /** Layer toolpaths to draw instead of the objects, when previewing a slice. */
    sliced?: SlicedPlate | null
    scheme?: Scheme
    showTravel?: boolean
    onPick?: (id: string | null) => void
    onDrag?: (id: string, delta: { x: number; y: number }) => void
    onDrop?: (id: string) => void
  }
>(function SlicerViewport(
  { document: doc, selected, sliced, scheme = 'type', showTravel, onPick, onDrag, onDrop },
  ref,
) {
  const plate = activePlate(doc)
  const bed = bedFor(doc.printer)
  const previewing = doc.view === 'preview' && sliced && sliced.layers.length > 0
  const outside = new Set(outsideBed(plate, bed).map((o) => o.id))
  const slots = allSlots(doc)
  const items: SceneItem[] = [
    {
      kind: 'lines',
      polylines: gridLines(Math.max(bed.x, bed.y), Math.max(bed.x, bed.y) / 8),
      stroke: 'rgba(255,255,255,0.1)',
      layer: 'under',
    },
    {
      kind: 'lines',
      polylines: [
        [
          vec(-bed.x / 2, -bed.y / 2, 0),
          vec(bed.x / 2, -bed.y / 2, 0),
          vec(bed.x / 2, bed.y / 2, 0),
          vec(-bed.x / 2, bed.y / 2, 0),
          vec(-bed.x / 2, -bed.y / 2, 0),
        ],
        [vec(-bed.x / 2, -bed.y / 2, 0), vec(-bed.x / 2, -bed.y / 2, 6)],
        [vec(bed.x / 2, -bed.y / 2, 0), vec(bed.x / 2, -bed.y / 2, 6)],
        [vec(bed.x / 2, bed.y / 2, 0), vec(bed.x / 2, bed.y / 2, 6)],
        [vec(-bed.x / 2, bed.y / 2, 0), vec(-bed.x / 2, bed.y / 2, 6)],
      ],
      stroke: 'rgba(255,255,255,0.45)',
      width: 1.5,
      layer: 'under',
    },
  ]
  if (previewing) {
    const shown = sliced.layers.slice(0, Math.max(1, doc.previewLayer))
    const speeds = sliced.layers.flatMap((l) => l.paths.map((p) => p.speed))
    const minSpeed = Math.min(...speeds)
    const maxSpeed = Math.max(...speeds)
    const heights = sliced.layers.map((l) => l.height)
    const minH = Math.min(...heights)
    const maxH = Math.max(...heights)
    const byColor = new Map<string, { x: number; y: number; z: number }[][]>()
    const colorOf = (
      path: SlicedPlate['layers'][number]['paths'][number],
      layer: SlicedPlate['layers'][number],
    ) =>
      scheme === 'speed'
        ? heat(maxSpeed > minSpeed ? (path.speed - minSpeed) / (maxSpeed - minSpeed) : 0.5)
        : scheme === 'height'
          ? heat(maxH > minH ? (layer.height - minH) / (maxH - minH) : 0.5)
          : scheme === 'filament'
            ? (slots[path.slot]?.color ?? slots[0].color)
            : PATH_COLORS[path.kind]
    for (const layer of shown)
      for (const path of layer.paths) {
        const points = (path.closed ? [...path.points, path.points[0]] : path.points).map((p) =>
          vec(p.x, p.y, layer.z),
        )
        const color = colorOf(path, layer)
        byColor.set(color, [...(byColor.get(color) ?? []), points])
      }
    for (const [stroke, polylines] of byColor)
      items.push({ kind: 'lines', polylines, stroke, width: 1 })
    if (showTravel)
      items.push({
        kind: 'lines',
        polylines: shown.flatMap((l) =>
          l.travels.map((t) => [vec(t[0].x, t[0].y, l.z), vec(t[1].x, t[1].y, l.z)]),
        ),
        stroke: 'rgba(120,160,220,0.55)',
        width: 0.6,
        dashed: true,
      })
  } else
    for (const o of plate.objects)
      items.push({
        kind: 'mesh',
        id: o.id,
        mesh: objectMesh(o),
        fill: scheme === 'filament' ? (slots[o.slot ?? 0]?.color ?? o.color) : o.color,
        stroke: outside.has(o.id) ? '#e03b3b' : selected === o.id ? '#3b8beb' : 'rgba(0,0,0,0.35)',
      })
  const tallest = Math.max(40, ...plate.objects.map((o) => o.height * (o.scale ?? 1)))
  const extent = extrude(profile('rectangle', bed.x, bed.y), frames.Top(), 0, tallest)
  return (
    <Viewport3D
      ref={ref}
      items={items}
      fitTo={extent}
      label={`Build plate with ${plate.objects.length} objects`}
      onPick={onPick ? (id) => onPick(id) : undefined}
      onDrag={onDrag && !previewing ? onDrag : undefined}
      onDrop={onDrop}
    >
      <div className="wb-viewport-note">
        {doc.printer} · {bed.x} × {bed.y} × {bed.z} mm · {plate.name}
        {previewing
          ? ` · layer ${doc.previewLayer}/${sliced.layers.length} · z ${sliced.layers[Math.max(0, doc.previewLayer - 1)]?.z.toFixed(2)} mm`
          : ''}
        {outside.size ? ` · ${outside.size} outside the bed` : ''}
        {!plate.objects.length ? ' · Add or import an object from the Prepare tab.' : ''}
      </div>
    </Viewport3D>
  )
})

/** Mesh files become storable objects: decimated to the budget, settled on the bed, rounded. */
function objectFromMesh(name: string, mesh: Mesh, index: number) {
  return meshObject(name, compact(settle(decimate(mesh, MAX_TRIANGLES))), index)
}
/** Replace an object's geometry with a transformed copy, keeping its place and colour. */
function withMesh(o: PlateObject, mesh: Mesh): PlateObject {
  const next = meshObject(o.name, compact(settle(mesh)), 0)
  return {
    ...o,
    width: next.width,
    depth: next.depth,
    height: next.height,
    mesh: next.mesh,
    scale: 1,
  }
}
const boxOf = (w: number, d: number, h: number) =>
  extrude(profile('rectangle', w, d), frames.Top(), 0, h)

export default function SlicerEditor({
  title,
  document: raw,
  readOnly,
  unsaved,
  onBack,
  onChange,
  related,
}: EditorProps<SlicerDocument>) {
  const doc = useMemo(() => normalizeSlicer(raw), [raw])
  const [tool, setTool] = useState<ToolDef | null>(null)
  const viewport = useRef<ViewportHandle>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const dragging = useRef(false)
  const [values, setValues] = useState<Record<string, ParamValue>>({})
  const [selected, setSelected] = useState<string | null>(null)
  const [panelTab, setPanelTab] = useState<'settings' | 'objects'>('settings')
  const [message, setMessage] = useState('')
  const [history, setHistory] = useState<History>({ past: [], future: [] })
  const [scheme, setScheme] = useState<Scheme>('type')
  const [showTravel, setShowTravel] = useState(false)
  const [device, setDevice] = useState<{
    state: 'idle' | 'printing' | 'paused' | 'done'
    elapsed: number
  }>({ state: 'idle', elapsed: 0 })
  const plate = activePlate(doc)
  const bed = bedFor(doc.printer)
  const printer = printerProfile(doc.printer)
  const slots = allSlots(doc)
  const selectedObject = plate.objects.find((o) => o.id === selected) ?? null
  // Toolpaths for Preview and export. Every plate or process change clears `doc.sliced`, so it
  // is the one dependency that matters; the layer slider and view changes reuse the result.
  const sliced = useMemo(
    () => (doc.sliced ? slicePlate(doc) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [doc.sliced],
  )
  const estimate = doc.sliced

  const apply = (next: SlicerDocument, record = true) => {
    if (readOnly) return false
    if (!validSlicer(next)) {
      setMessage(
        'That change could not be saved. Keep objects inside the plate limits and meshes within the storage budget.',
      )
      return false
    }
    if (record) setHistory((h) => ({ past: [...h.past.slice(-49), doc], future: [] }))
    return onChange(next)
  }
  const changePlate = (change: (p: typeof plate) => typeof plate, record = true) =>
    apply(
      { ...doc, plates: doc.plates.map((p) => (p.id === plate.id ? change(p) : p)), sliced: null },
      record,
    )
  const changeObject = (id: string, change: (o: PlateObject) => PlateObject) =>
    changePlate((p) => ({ ...p, objects: p.objects.map((o) => (o.id === id ? change(o) : o)) }))
  const setProcess = (change: Partial<Process>) =>
    apply({ ...doc, process: { ...doc.process, ...change }, sliced: null })
  const setSlot = (index: number, change: Partial<Filament>) => {
    if (index === 0) apply({ ...doc, filament: { ...doc.filament, ...change }, sliced: null })
    else
      apply({
        ...doc,
        slots: (doc.slots ?? []).map((s, i) => (i === index - 1 ? { ...s, ...change } : s)),
        sliced: null,
      })
  }

  // --- The simulated printer runs through the estimate at 60× real time. ---
  useEffect(() => {
    if (device.state !== 'printing' || !estimate) return
    const timer = window.setInterval(
      () =>
        setDevice((d) => {
          const elapsed = d.elapsed + 60
          return elapsed >= estimate.seconds
            ? { state: 'done', elapsed: estimate.seconds }
            : { ...d, elapsed }
        }),
      1000,
    )
    return () => window.clearInterval(timer)
  }, [device.state, estimate])
  const deviceLayer = useMemo(() => {
    if (!sliced || device.state === 'idle') return 0
    let t = 0
    for (const layer of sliced.layers) {
      t += layer.seconds
      if (t >= device.elapsed) return layer.index + 1
    }
    return sliced.layers.length
  }, [sliced, device])

  function startTool(t: ToolDef) {
    if (t.params) {
      if (t.id === 'cut' && !selectedObject) {
        setMessage('Select an object to cut first.')
        return
      }
      setTool(t)
      const defaults = Object.fromEntries(t.params.map((p) => [p.id, p.default]))
      if (t.id === 'cut' && selectedObject)
        defaults.height = Math.round((selectedObject.height * (selectedObject.scale ?? 1)) / 2)
      setValues(defaults)
      return
    }
    command(t.id)
  }
  function finishTool() {
    if (!tool) return
    if (tool.id === 'add') {
      const object = newObject(
        String(values.name) || 'Object',
        Number(values.width),
        Number(values.depth),
        Number(values.height),
        plate.objects.length,
      )
      addObject(object, `${object.name} added to ${plate.name}.`)
    } else if (tool.id === 'cut' && selectedObject) cutObject(selectedObject, Number(values.height))
    setTool(null)
  }
  /** Add an object to the plate, arranged with the others, and select it. */
  function addObject(object: PlateObject, note: string) {
    const placed = arrange({ ...plate, objects: [...plate.objects, object] }, bed)
    if (changePlate(() => placed)) {
      setSelected(object.id)
      setPanelTab('objects')
      setMessage(note)
    } else setMessage(`${object.name} would pass the plate’s storage budget.`)
  }
  async function importFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])]
    event.target.value = ''
    for (const file of files) {
      try {
        const mesh = parseStl(await file.arrayBuffer())
        const object = objectFromMesh(file.name.replace(/\.stl$/i, ''), mesh, plate.objects.length)
        const before = triangleCount(mesh)
        const after = triangleCount(object.mesh!)
        const size = `${object.width} × ${object.depth} × ${object.height} mm`
        addObject(
          object,
          after < before
            ? `${object.name} imported (${size}); simplified from ${before.toLocaleString()} to ${after.toLocaleString()} triangles.`
            : `${object.name} imported (${size}, ${after.toLocaleString()} triangles).`,
        )
      } catch (error) {
        setMessage(error instanceof Error ? error.message : `${file.name} could not be read.`)
      }
    }
  }
  function importFromModeler() {
    if (!related?.tools.includes('modeler')) {
      setMessage('Add the 3D modeler tool to this project to import its part.')
      return
    }
    const mesh = printableMesh(related.get('modeler'))
    if (!mesh.length) {
      setMessage('The modeler part has no solids yet.')
      return
    }
    addObject(
      objectFromMesh(title, mesh, plate.objects.length),
      `${title} imported from the modeler.`,
    )
  }
  /** Move an object along the plate while it is dragged in the viewport; one undo step per drag. */
  function dragObject(id: string, delta: { x: number; y: number }) {
    if (readOnly) return
    if (!dragging.current) {
      dragging.current = true
      setHistory((h) => ({ past: [...h.past.slice(-49), doc], future: [] }))
    }
    const clamp = (n: number, limit: number) =>
      Math.round(Math.max(-limit, Math.min(limit, n)) * 100) / 100
    changePlate(
      (p) => ({
        ...p,
        objects: p.objects.map((o) =>
          o.id === id
            ? { ...o, x: clamp(o.x + delta.x, bed.x / 2), y: clamp(o.y + delta.y, bed.y / 2) }
            : o,
        ),
      }),
      false,
    )
  }
  /** Transform the selected object's geometry in place. */
  function transform(o: PlateObject, fn: (mesh: Mesh) => Mesh) {
    const mesh = o.mesh
      ? fn(o.mesh.length ? o.mesh : boxOf(o.width, o.depth, o.height))
      : fn(boxOf(o.width, o.depth, o.height))
    const next = withMesh(o, mesh)
    if (!o.mesh) {
      // Boxes stay boxes: read the new size off the turned mesh and drop the mesh again.
      changeObject(o.id, () => ({ ...next, mesh: undefined }))
    } else changeObject(o.id, () => next)
  }
  function layFlat(o: PlateObject) {
    const base = o.mesh ?? boxOf(o.width, o.depth, o.height)
    const candidates: Mesh[] = [
      base,
      rotateX(base, 90),
      rotateX(base, -90),
      rotateX(base, 180),
      rotateY(base, 90),
      rotateY(base, -90),
    ]
    let best = base
    let bestScore = Infinity
    for (const m of candidates) {
      const b = bounds(m)!
      const height = b.max.z - b.min.z
      const score = height - ((b.max.x - b.min.x) * (b.max.y - b.min.y)) / 1e6
      if (score < bestScore - 1e-6) {
        bestScore = score
        best = m
      }
    }
    transform(o, () => best)
    setMessage(`${o.name} laid on its widest face.`)
  }
  function cutObject(o: PlateObject, height: number) {
    const mesh = objectMesh(o)
    const b = bounds(mesh)
    if (!b || height <= 0 || height >= b.max.z - 0.01) {
      setMessage('Choose a cut height inside the object.')
      return
    }
    const big = Math.max(b.max.x - b.min.x, b.max.y - b.min.y) * 2 + 20
    const lower = intersect(
      tagged(mesh, 'o'),
      tagged(translate(boxOf(big, big, height), vec(o.x, o.y, 0)), 'b'),
    ).mesh
    const upper = intersect(
      tagged(mesh, 'o'),
      tagged(translate(boxOf(big, big, b.max.z - height + 1), vec(o.x, o.y, height)), 'b'),
    ).mesh
    if (!lower.length || !upper.length) {
      setMessage('The cut left one side empty.')
      return
    }
    const bottom = { ...withMesh(o, decimate(lower, MAX_TRIANGLES)), rotation: 0 }
    const top = {
      ...withMesh(o, decimate(upper, MAX_TRIANGLES)),
      id: newObject('x').id,
      name: `${o.name} (upper)`,
      rotation: 0,
      color: OBJECT_COLORS[plate.objects.length % OBJECT_COLORS.length],
    }
    if (
      changePlate((p) =>
        arrange(
          {
            ...p,
            objects: [
              ...p.objects.map((x) =>
                x.id === o.id ? { ...bottom, name: `${o.name} (lower)` } : x,
              ),
              top,
            ],
          },
          bed,
        ),
      )
    )
      setMessage(`${o.name} cut at ${height} mm into two objects.`)
  }
  function slice() {
    if (!plate.objects.length) {
      setMessage('Add an object before slicing.')
      return
    }
    const out = outsideBed(plate, bed)
    if (out.length) {
      setMessage(
        `${out.map((o) => o.name).join(', ')} ${out.length === 1 ? 'is' : 'are'} outside the build volume. Move, scale, or arrange first.`,
      )
      return
    }
    setMessage('Slicing…')
    window.setTimeout(() => {
      const started = performance.now()
      const { result } = slicePlate(doc)
      apply({ ...doc, sliced: result, view: 'preview', previewLayer: result.layers }, false)
      setDevice({ state: 'idle', elapsed: 0 })
      setMessage(
        `Sliced ${plate.name} in ${((performance.now() - started) / 1000).toFixed(1)} s: ${result.layers} layers, ${formatDuration(result.seconds)}, ${result.grams} g.`,
      )
    }, 30)
  }
  function command(id: string) {
    if (id.startsWith('view:')) {
      apply({ ...doc, view: id.slice(5) as SlicerView }, false)
      return
    }
    if (id.startsWith('scheme:')) {
      setScheme(id.slice(7) as Scheme)
      if (doc.view !== 'preview') apply({ ...doc, view: 'preview' }, false)
      return
    }
    switch (id) {
      case 'toggle:travel':
        setShowTravel((v) => !v)
        break
      case 'clone':
        if (selectedObject) {
          const copy = {
            ...selectedObject,
            id: newObject('x').id,
            name: `${selectedObject.name} copy`,
            color: OBJECT_COLORS[plate.objects.length % OBJECT_COLORS.length],
          }
          if (changePlate((p) => arrange({ ...p, objects: [...p.objects, copy] }, bed)))
            setSelected(copy.id)
        } else setMessage('Select an object first.')
        break
      case 'delete':
        if (selectedObject) {
          changePlate((p) => ({
            ...p,
            objects: p.objects.filter((o) => o.id !== selectedObject.id),
          }))
          setSelected(null)
        } else setMessage('Select an object first.')
        break
      case 'arrange':
        changePlate((p) => arrange(p, bed))
        break
      case 'orient':
        if (!selectedObject) setMessage('Select an object first.')
        else {
          const { width, depth } = footprint({ ...selectedObject, rotation: 0 })
          changeObject(selectedObject.id, (o) => ({ ...o, rotation: depth > width ? 90 : 0 }))
        }
        break
      case 'rotate:x':
      case 'rotate:y':
        if (!selectedObject) setMessage('Select an object first.')
        else transform(selectedObject, (m) => (id === 'rotate:x' ? rotateX(m, 90) : rotateY(m, 90)))
        break
      case 'mirror:x':
      case 'mirror:y':
        if (!selectedObject) setMessage('Select an object first.')
        else if (!selectedObject.mesh) setMessage('A box is its own mirror image.')
        else transform(selectedObject, (m) => mirrorMesh(m, id === 'mirror:x' ? 'x' : 'y'))
        break
      case 'layflat':
        if (!selectedObject) setMessage('Select an object first.')
        else layFlat(selectedObject)
        break
      case 'fit':
        if (!selectedObject) setMessage('Select an object first.')
        else {
          const f = footprint({ ...selectedObject, scale: 1 })
          const s = Math.min(
            1,
            (bed.x - 10) / f.width,
            (bed.y - 10) / f.depth,
            bed.z / selectedObject.height,
          )
          if (selectedObject.mesh)
            changeObject(selectedObject.id, (o) => ({
              ...o,
              scale: Math.round(s * 1000) / 1000,
              x: 0,
              y: 0,
            }))
          else
            changeObject(selectedObject.id, (o) => ({
              ...o,
              width: o.width * s,
              depth: o.depth * s,
              height: o.height * s,
              x: 0,
              y: 0,
            }))
          setMessage(
            s < 1
              ? `${selectedObject.name} scaled to ${Math.round(s * 100)}% to fit.`
              : `${selectedObject.name} already fits.`,
          )
        }
        break
      case 'import':
        fileInput.current?.click()
        break
      case 'import:modeler':
        importFromModeler()
        break
      case 'zoom':
        viewport.current?.fit()
        break
      case 'plate:add': {
        const p = newPlate(doc.plates.length + 1)
        if (apply({ ...doc, plates: [...doc.plates, p], activePlate: p.id, sliced: null }))
          setSelected(null)
        break
      }
      case 'plate:next': {
        const index = doc.plates.findIndex((p) => p.id === doc.activePlate)
        const next = doc.plates[(index + 1) % doc.plates.length]
        apply({ ...doc, activePlate: next.id, sliced: null }, false)
        setSelected(null)
        break
      }
      case 'plate:delete':
        if (doc.plates.length < 2) setMessage('A project keeps at least one plate.')
        else {
          const rest = doc.plates.filter((p) => p.id !== plate.id)
          apply({ ...doc, plates: rest, activePlate: rest[0].id, sliced: null })
          setSelected(null)
        }
        break
      case 'slice':
        slice()
        break
      case 'layer:up':
        if (doc.sliced)
          apply({ ...doc, previewLayer: Math.min(doc.sliced.layers, doc.previewLayer + 1) }, false)
        break
      case 'layer:down':
        if (doc.sliced) apply({ ...doc, previewLayer: Math.max(1, doc.previewLayer - 1) }, false)
        break
      case 'layer:first':
        if (doc.sliced) apply({ ...doc, previewLayer: 1 }, false)
        break
      case 'layer:all':
        if (doc.sliced) apply({ ...doc, previewLayer: doc.sliced.layers }, false)
        break
      case 'device:home':
        setMessage('Homing axes (simulated).')
        break
      case 'device:print':
        if (!doc.sliced) setMessage('Slice the plate first.')
        else {
          setDevice({ state: 'printing', elapsed: 0 })
          apply({ ...doc, view: 'device' }, false)
        }
        break
      case 'device:pause':
        setDevice((d) => ({
          ...d,
          state: d.state === 'paused' ? 'printing' : d.state === 'printing' ? 'paused' : d.state,
        }))
        break
      case 'device:stop':
        setDevice({ state: 'idle', elapsed: 0 })
        break
      case 'device:cool':
        setMessage('Cooling nozzle and bed (simulated).')
        break
      case 'undo': {
        const previous = history.past.at(-1)
        if (!previous) return
        setHistory({ past: history.past.slice(0, -1), future: [doc, ...history.future] })
        onChange(previous)
        break
      }
      case 'redo': {
        const next = history.future[0]
        if (!next) return
        setHistory({ past: [...history.past, doc], future: history.future.slice(1) })
        onChange(next)
        break
      }
      case 'new':
        changePlate((p) => ({ ...p, objects: [] }))
        setSelected(null)
        setMessage('The plate is empty. Undo brings the objects back.')
        break
      case 'save':
        setMessage(
          unsaved
            ? 'Saving is retried automatically; check the workspace save error.'
            : 'Everything is saved as you work.',
        )
        break
      case 'export:json':
        downloadBlob(
          new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' }),
          `${safeFilename(title) || 'project'}.3mf.json`,
        )
        break
      case 'export:gcode':
        if (!sliced) setMessage('Slice the plate first.')
        else
          downloadBlob(
            new Blob([toGcode(sliced, doc, title)], { type: 'text/x-gcode' }),
            `${safeFilename(title) || 'plate'}-${safeFilename(plate.name)}.gcode`,
          )
        break
      case 'export:3mf':
        if (!plate.objects.length) setMessage('The plate is empty.')
        else
          downloadBlob(
            toThreeMf(
              plate.objects.map((o) => ({
                name: o.name,
                mesh: objectMesh(o),
                color: slots[o.slot ?? 0]?.color ?? o.color,
              })),
              title,
            ),
            `${safeFilename(title) || 'plate'}-${safeFilename(plate.name)}.3mf`,
          )
        break
      case 'export:stl':
        if (!plate.objects.length) setMessage('The plate is empty.')
        else
          downloadBlob(
            toStl(plateMesh(plate), title),
            `${safeFilename(title) || 'plate'}-${safeFilename(plate.name)}.stl`,
          )
        break
      case 'notes':
        apply({ ...doc, view: 'project' }, false)
        break
      case 'about':
        setMessage(
          'A Bambu Studio-shaped slicer: profiles, plates, real toolpaths with skins and supports, G-code and 3MF. The printer is simulated.',
        )
        break
      default:
        break
    }
  }
  const objectTree: TreeNode[] = useMemo(
    () => [
      {
        id: 'plate',
        label: plate.name,
        icon: Square,
        children: plate.objects.map((o) => ({
          id: o.id,
          label: o.name,
          icon: Boxes,
          badge: o.mesh
            ? `${triangleCount(o.mesh).toLocaleString()} tris`
            : `${o.width}×${o.depth}×${o.height}`,
        })),
      },
    ],
    [plate],
  )

  const settingsPanel = (
    <div>
      <details className="wb-section" open>
        <summary>
          <Printer size={14} /> Printer
        </summary>
        <div className="wb-section-body">
          <label className="wb-field">
            <span>Printer</span>
            <select
              value={doc.printer}
              disabled={readOnly}
              onChange={(e) => {
                const p = printerProfile(e.target.value)
                apply({
                  ...doc,
                  printer: e.target.value,
                  nozzle: p.nozzles.includes(doc.nozzle) ? doc.nozzle : 0.4,
                  sliced: null,
                })
              }}
            >
              {PRINTERS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
            <small className="wb-field-help">
              {printer.bed.x} × {printer.bed.y} × {printer.bed.z} mm · up to {printer.maxSpeed} mm/s
              · {printer.slots} {printer.slots === 1 ? 'spool' : 'spool slots'}
            </small>
          </label>
          <label className="wb-field">
            <span>Nozzle</span>
            <select
              value={doc.nozzle}
              disabled={readOnly}
              onChange={(e) => apply({ ...doc, nozzle: Number(e.target.value), sliced: null })}
            >
              {printer.nozzles.map((n) => (
                <option key={n} value={n}>
                  {n} mm
                </option>
              ))}
            </select>
          </label>
        </div>
      </details>
      <details className="wb-section" open>
        <summary>
          <Waves size={14} /> Filament
        </summary>
        <div className="wb-section-body">
          {slots.map((f, i) => (
            <div key={i} className="wb-slot">
              <div className="wb-row three">
                <label className="wb-field">
                  <span>{i === 0 ? 'Slot 1' : `Slot ${i + 1}`}</span>
                  <select
                    value={f.type}
                    disabled={readOnly}
                    onChange={(e) => setSlot(i, { type: e.target.value as FilamentType })}
                  >
                    {FILAMENT_TYPES.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </label>
                <label className="wb-field">
                  <span>Colour</span>
                  <input
                    type="color"
                    value={f.color}
                    disabled={readOnly}
                    aria-label={`Slot ${i + 1} colour`}
                    onChange={(e) => setSlot(i, { color: e.target.value })}
                  />
                </label>
                <label className="wb-field">
                  <span>Brand</span>
                  <input
                    value={f.brand}
                    maxLength={40}
                    disabled={readOnly}
                    aria-label={`Slot ${i + 1} brand`}
                    onChange={(e) => setSlot(i, { brand: e.target.value })}
                  />
                </label>
              </div>
              <div className="wb-row three">
                <label className="wb-field">
                  <span>Nozzle °C</span>
                  <input
                    type="number"
                    min={150}
                    max={350}
                    value={filamentTemps(f).nozzleTemp}
                    disabled={readOnly}
                    aria-label={`Slot ${i + 1} nozzle temperature`}
                    onChange={(e) => setSlot(i, { nozzleTemp: Number(e.target.value) })}
                  />
                </label>
                <label className="wb-field">
                  <span>Bed °C</span>
                  <input
                    type="number"
                    min={0}
                    max={130}
                    value={filamentTemps(f).bedTemp}
                    disabled={readOnly}
                    aria-label={`Slot ${i + 1} bed temperature`}
                    onChange={(e) => setSlot(i, { bedTemp: Number(e.target.value) })}
                  />
                </label>
                {i > 0 && !readOnly ? (
                  <button
                    type="button"
                    className="wb-button"
                    style={{ alignSelf: 'end' }}
                    onClick={() =>
                      apply({
                        ...doc,
                        slots: (doc.slots ?? []).filter((_, k) => k !== i - 1),
                        sliced: null,
                      })
                    }
                  >
                    Remove
                  </button>
                ) : (
                  <span />
                )}
              </div>
            </div>
          ))}
          {!readOnly && slots.length < Math.min(MAX_SLOTS, Math.max(2, printer.slots)) && (
            <button
              type="button"
              className="wb-button"
              onClick={() =>
                apply({
                  ...doc,
                  slots: [
                    ...(doc.slots ?? []),
                    {
                      type: 'PLA',
                      brand: doc.filament.brand,
                      color: OBJECT_COLORS[slots.length % OBJECT_COLORS.length],
                    },
                  ],
                  sliced: null,
                })
              }
            >
              Add a spool slot
            </button>
          )}
        </div>
      </details>
      <details className="wb-section" open>
        <summary>
          <Settings2 size={14} /> Process
        </summary>
        <div className="wb-section-body">
          <label className="wb-field">
            <span>Preset</span>
            <select
              value=""
              disabled={readOnly}
              aria-label="Process preset"
              onChange={(e) =>
                e.target.value &&
                apply({ ...doc, process: applyPreset(doc.process, e.target.value), sliced: null })
              }
            >
              <option value="">Apply a preset…</option>
              {PROCESS_PRESETS.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <div className="wb-row">
            <label className="wb-field">
              <span>Layer height (mm)</span>
              <select
                value={doc.process.layerHeight}
                disabled={readOnly}
                onChange={(e) => setProcess({ layerHeight: Number(e.target.value) })}
              >
                {[0.08, 0.12, 0.16, 0.2, 0.24, 0.28, 0.32].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="wb-field">
              <span>First layer (mm)</span>
              <input
                type="number"
                min={0.05}
                max={0.6}
                step={0.02}
                value={doc.process.firstLayerHeight}
                disabled={readOnly}
                onChange={(e) => setProcess({ firstLayerHeight: Number(e.target.value) })}
              />
            </label>
          </div>
          <div className="wb-row three">
            <label className="wb-field">
              <span>Walls</span>
              <input
                type="number"
                min={1}
                max={10}
                value={doc.process.walls}
                disabled={readOnly}
                onChange={(e) => setProcess({ walls: Number(e.target.value) })}
              />
            </label>
            <label className="wb-field">
              <span>Top layers</span>
              <input
                type="number"
                min={0}
                max={20}
                value={doc.process.topLayers}
                disabled={readOnly}
                onChange={(e) => setProcess({ topLayers: Number(e.target.value) })}
              />
            </label>
            <label className="wb-field">
              <span>Bottom layers</span>
              <input
                type="number"
                min={0}
                max={20}
                value={doc.process.bottomLayers}
                disabled={readOnly}
                onChange={(e) => setProcess({ bottomLayers: Number(e.target.value) })}
              />
            </label>
          </div>
          <div className="wb-row">
            <label className="wb-field">
              <span>Infill (%)</span>
              <input
                type="number"
                min={0}
                max={100}
                value={doc.process.infill}
                disabled={readOnly}
                onChange={(e) => setProcess({ infill: Number(e.target.value) })}
              />
            </label>
            <label className="wb-field">
              <span>Pattern</span>
              <select
                value={doc.process.infillPattern}
                disabled={readOnly}
                onChange={(e) =>
                  setProcess({ infillPattern: e.target.value as Process['infillPattern'] })
                }
              >
                {INFILL_PATTERNS.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="wb-field inline">
            <input
              type="checkbox"
              checked={doc.process.supports}
              disabled={readOnly}
              onChange={(e) => setProcess({ supports: e.target.checked })}
            />
            <span>Enable supports</span>
          </label>
          {doc.process.supports && (
            <div className="wb-row three">
              <label className="wb-field">
                <span>Type</span>
                <select
                  value={doc.process.supportType}
                  disabled={readOnly}
                  onChange={(e) =>
                    setProcess({ supportType: e.target.value as Process['supportType'] })
                  }
                >
                  <option value="normal">Normal</option>
                  <option value="tree">Tree</option>
                </select>
              </label>
              <label className="wb-field">
                <span>Overhang (°)</span>
                <input
                  type="number"
                  min={10}
                  max={89}
                  value={doc.process.supportAngle}
                  disabled={readOnly}
                  onChange={(e) => setProcess({ supportAngle: Number(e.target.value) })}
                />
              </label>
              <label className="wb-field">
                <span>Density (%)</span>
                <input
                  type="number"
                  min={5}
                  max={100}
                  value={doc.process.supportDensity}
                  disabled={readOnly}
                  onChange={(e) => setProcess({ supportDensity: Number(e.target.value) })}
                />
              </label>
            </div>
          )}
          <div className="wb-row three">
            <label className="wb-field inline">
              <input
                type="checkbox"
                checked={doc.process.brim}
                disabled={readOnly}
                onChange={(e) => setProcess({ brim: e.target.checked })}
              />
              <span>Brim</span>
            </label>
            <label className="wb-field">
              <span>Brim width</span>
              <input
                type="number"
                min={0}
                max={50}
                value={doc.process.brimWidth}
                disabled={readOnly || !doc.process.brim}
                onChange={(e) => setProcess({ brimWidth: Number(e.target.value) })}
              />
            </label>
            <label className="wb-field">
              <span>Skirt loops</span>
              <input
                type="number"
                min={0}
                max={10}
                value={doc.process.skirtLoops}
                disabled={readOnly}
                onChange={(e) => setProcess({ skirtLoops: Number(e.target.value) })}
              />
            </label>
          </div>
          <label className="wb-field inline">
            <input
              type="checkbox"
              checked={doc.process.raft}
              disabled={readOnly}
              onChange={(e) => setProcess({ raft: e.target.checked })}
            />
            <span>Raft</span>
          </label>
          <div className="wb-row three">
            <label className="wb-field">
              <span>Speed</span>
              <select
                value={doc.process.speed}
                disabled={readOnly}
                onChange={(e) => setProcess({ speed: e.target.value as Process['speed'] })}
              >
                {['silent', 'standard', 'sport', 'ludicrous'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="wb-field">
              <span>Seam</span>
              <select
                value={doc.process.seam}
                disabled={readOnly}
                onChange={(e) => setProcess({ seam: e.target.value as Process['seam'] })}
              >
                {['aligned', 'back', 'random'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="wb-field">
              <span>Wall order</span>
              <select
                value={doc.process.wallOrder}
                disabled={readOnly}
                onChange={(e) => setProcess({ wallOrder: e.target.value as Process['wallOrder'] })}
              >
                <option value="inner-outer">inner first</option>
                <option value="outer-inner">outer first</option>
              </select>
            </label>
          </div>
          <details className="wb-subsection">
            <summary>Speeds (mm/s)</summary>
            <div className="wb-row three">
              {(
                [
                  ['outerWallSpeed', 'Outer wall'],
                  ['innerWallSpeed', 'Inner wall'],
                  ['infillSpeed', 'Infill'],
                  ['topSpeed', 'Top surface'],
                  ['travelSpeed', 'Travel'],
                  ['firstLayerSpeed', 'First layer'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="wb-field">
                  <span>{label}</span>
                  <input
                    type="number"
                    min={5}
                    max={1000}
                    value={doc.process[key]}
                    disabled={readOnly}
                    onChange={(e) => setProcess({ [key]: Number(e.target.value) })}
                  />
                </label>
              ))}
            </div>
          </details>
          <details className="wb-subsection">
            <summary>Retraction, cooling</summary>
            <div className="wb-row three">
              <label className="wb-field">
                <span>Retract (mm)</span>
                <input
                  type="number"
                  min={0}
                  max={10}
                  step={0.1}
                  value={doc.process.retractLength}
                  disabled={readOnly}
                  onChange={(e) => setProcess({ retractLength: Number(e.target.value) })}
                />
              </label>
              <label className="wb-field">
                <span>Retract speed</span>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={doc.process.retractSpeed}
                  disabled={readOnly}
                  onChange={(e) => setProcess({ retractSpeed: Number(e.target.value) })}
                />
              </label>
              <label className="wb-field">
                <span>Z hop (mm)</span>
                <input
                  type="number"
                  min={0}
                  max={5}
                  step={0.1}
                  value={doc.process.zHop}
                  disabled={readOnly}
                  onChange={(e) => setProcess({ zHop: Number(e.target.value) })}
                />
              </label>
              <label className="wb-field">
                <span>Fan (%)</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={doc.process.fanSpeed}
                  disabled={readOnly}
                  onChange={(e) => setProcess({ fanSpeed: Number(e.target.value) })}
                />
              </label>
              <label className="wb-field">
                <span>Min layer time (s)</span>
                <input
                  type="number"
                  min={0}
                  max={120}
                  value={doc.process.minLayerTime}
                  disabled={readOnly}
                  onChange={(e) => setProcess({ minLayerTime: Number(e.target.value) })}
                />
              </label>
              <label className="wb-field">
                <span>Nozzle °C</span>
                <input
                  type="number"
                  min={150}
                  max={350}
                  value={doc.process.nozzleTemp}
                  disabled={readOnly}
                  onChange={(e) => setProcess({ nozzleTemp: Number(e.target.value) })}
                />
              </label>
            </div>
          </details>
          <details className="wb-subsection" open={doc.process.changes.length > 0}>
            <summary>Filament changes ({doc.process.changes.length})</summary>
            <ul className="wb-list">
              {doc.process.changes.map((c, i) => (
                <li key={i} className="wb-change">
                  <span>Layer</span>
                  <input
                    type="number"
                    min={1}
                    max={100000}
                    value={c.layer}
                    aria-label={`Change ${i + 1} layer`}
                    disabled={readOnly}
                    onChange={(e) =>
                      setProcess({
                        changes: doc.process.changes.map((x, k) =>
                          k === i ? { ...x, layer: Number(e.target.value) } : x,
                        ),
                      })
                    }
                  />
                  <select
                    value={c.slot}
                    aria-label={`Change ${i + 1} filament`}
                    disabled={readOnly}
                    onChange={(e) =>
                      setProcess({
                        changes: doc.process.changes.map((x, k) =>
                          k === i ? { ...x, slot: Number(e.target.value) } : x,
                        ),
                      })
                    }
                  >
                    <option value={-1}>Pause for a manual swap</option>
                    {slots.map((s, k) => (
                      <option key={k} value={k}>
                        Slot {k + 1} · {s.type}
                      </option>
                    ))}
                  </select>
                  {!readOnly && (
                    <button
                      type="button"
                      className="wb-button"
                      aria-label={`Remove change ${i + 1}`}
                      onClick={() =>
                        setProcess({ changes: doc.process.changes.filter((_, k) => k !== i) })
                      }
                    >
                      ×
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {!readOnly && (
              <button
                type="button"
                className="wb-button"
                onClick={() =>
                  setProcess({
                    changes: [
                      ...doc.process.changes,
                      {
                        layer: Math.max(2, (doc.process.changes.at(-1)?.layer ?? 0) + 10),
                        slot: -1,
                      },
                    ],
                  })
                }
              >
                Add a change
              </button>
            )}
            <p className="wb-hint">
              A pause writes M600 so you can swap spools by hand; a slot writes a tool change for
              the AMS.
            </p>
          </details>
        </div>
      </details>
    </div>
  )
  const overrides = selectedObject?.overrides ?? {}
  const setOverride = (patch: ObjectOverrides) =>
    selectedObject &&
    changeObject(selectedObject.id, (o) => {
      const next = { ...(o.overrides ?? {}), ...patch }
      for (const k of Object.keys(next) as (keyof ObjectOverrides)[])
        if (next[k] === undefined) delete next[k]
      return { ...o, overrides: Object.keys(next).length ? next : undefined }
    })
  const rightPanel: ReactNode = (
    <div className="wb-panel">
      {doc.view === 'device' ? (
        <>
          <div className="wb-panel-title">Device</div>
          <div className="wb-stat">
            <span>{doc.printer}</span>
            <strong>{device.state}</strong>
          </div>
          <div
            className="wb-progress"
            role="progressbar"
            aria-label="Print progress"
            aria-valuenow={
              estimate ? Math.round((100 * device.elapsed) / Math.max(1, estimate.seconds)) : 0
            }
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              style={{
                width: `${estimate ? Math.min(100, (100 * device.elapsed) / Math.max(1, estimate.seconds)) : 0}%`,
              }}
            />
          </div>
          {estimate && device.state !== 'idle' && (
            <>
              <div className="wb-stat">
                <span>Layer</span>
                <strong>
                  {deviceLayer} / {estimate.layers}
                </strong>
              </div>
              <div className="wb-stat">
                <span>Remaining</span>
                <strong>{formatDuration(Math.max(0, estimate.seconds - device.elapsed))}</strong>
              </div>
            </>
          )}
          <div className="wb-stat">
            <span>
              <Thermometer size={12} /> Nozzle
            </span>
            <strong>
              {device.state === 'idle' || device.state === 'done' ? 24 : doc.process.nozzleTemp} °C
            </strong>
          </div>
          <div className="wb-stat">
            <span>
              <Thermometer size={12} /> Bed
            </span>
            <strong>
              {device.state === 'idle' || device.state === 'done' ? 23 : doc.process.bedTemp} °C
            </strong>
          </div>
          <div className="wb-stat">
            <span>
              <Fan size={12} /> Part fan
            </span>
            <strong>{device.state === 'printing' ? `${doc.process.fanSpeed}%` : '0%'}</strong>
          </div>
          <p className="wb-hint">
            A simulated printer running the estimate at 60× speed. Sending to a real printer over
            the network is a later increment.
          </p>
        </>
      ) : doc.view === 'project' ? (
        <>
          <div className="wb-panel-title">Project notes</div>
          <textarea
            rows={10}
            value={doc.notes}
            maxLength={20000}
            disabled={readOnly}
            placeholder="Print notes, settings that worked, what to change next time…"
            onChange={(e) => apply({ ...doc, notes: e.target.value }, false)}
            style={{ width: '100%', boxSizing: 'border-box', font: 'inherit', fontSize: 12 }}
          />
          <div className="wb-panel-title">Plates</div>
          <ul className="wb-list">
            {doc.plates.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className={p.id === doc.activePlate ? 'selected' : ''}
                  onClick={() =>
                    apply({ ...doc, activePlate: p.id, view: 'prepare', sliced: null }, false)
                  }
                >
                  <Square size={12} /> {p.name} · {p.objects.length} objects
                </button>
              </li>
            ))}
          </ul>
          {!readOnly && (
            <label className="wb-field">
              <span>Rename {plate.name}</span>
              <input
                value={plate.name}
                maxLength={40}
                onChange={(e) =>
                  changePlate((p) => ({ ...p, name: e.target.value || p.name }), false)
                }
              />
            </label>
          )}
        </>
      ) : (
        <>
          <div className="wb-panel-title">Objects on {plate.name}</div>
          <ul className="wb-list">
            {plate.objects.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  className={o.id === selected ? 'selected' : ''}
                  onClick={() => setSelected(o.id)}
                >
                  <span className="wb-swatch" style={{ background: o.color }} />
                  {o.name}
                </button>
              </li>
            ))}
            {!plate.objects.length && <li className="wb-hint">Nothing on this plate.</li>}
          </ul>
          {selectedObject && !readOnly && (
            <>
              <div className="wb-panel-title">{selectedObject.name}</div>
              <label className="wb-field">
                <span>Name</span>
                <input
                  value={selectedObject.name}
                  maxLength={80}
                  onChange={(e) =>
                    changeObject(selectedObject.id, (o) => ({
                      ...o,
                      name: e.target.value || o.name,
                    }))
                  }
                />
              </label>
              <div className="wb-row">
                <label className="wb-field">
                  <span>X (mm)</span>
                  <input
                    type="number"
                    value={selectedObject.x}
                    min={-bed.x / 2}
                    max={bed.x / 2}
                    onChange={(e) =>
                      changeObject(selectedObject.id, (o) => ({ ...o, x: Number(e.target.value) }))
                    }
                  />
                </label>
                <label className="wb-field">
                  <span>Y (mm)</span>
                  <input
                    type="number"
                    value={selectedObject.y}
                    min={-bed.y / 2}
                    max={bed.y / 2}
                    onChange={(e) =>
                      changeObject(selectedObject.id, (o) => ({ ...o, y: Number(e.target.value) }))
                    }
                  />
                </label>
              </div>
              <div className="wb-row three">
                {(['width', 'depth', 'height'] as const).map((dim) => (
                  <label key={dim} className="wb-field">
                    <span>{dim[0].toUpperCase() + dim.slice(1)}</span>
                    <input
                      type="number"
                      min={1}
                      max={dim === 'height' ? bed.z : Math.max(bed.x, bed.y)}
                      value={
                        Math.round(selectedObject[dim] * (selectedObject.scale ?? 1) * 100) / 100
                      }
                      readOnly={!!selectedObject.mesh}
                      title={
                        selectedObject.mesh
                          ? 'Mesh sizes come from the file; use Scale.'
                          : undefined
                      }
                      onChange={(e) =>
                        changeObject(selectedObject.id, (o) => ({
                          ...o,
                          [dim]: Number(e.target.value),
                        }))
                      }
                    />
                  </label>
                ))}
              </div>
              <div className="wb-row three">
                <label className="wb-field">
                  <span>Rotation (°)</span>
                  <input
                    type="number"
                    min={-360}
                    max={360}
                    step={15}
                    value={selectedObject.rotation}
                    onChange={(e) =>
                      changeObject(selectedObject.id, (o) => ({
                        ...o,
                        rotation: Number(e.target.value),
                      }))
                    }
                  />
                </label>
                {selectedObject.mesh && (
                  <label className="wb-field">
                    <span>Scale</span>
                    <input
                      type="number"
                      min={0.01}
                      max={100}
                      step={0.1}
                      value={selectedObject.scale ?? 1}
                      onChange={(e) =>
                        changeObject(selectedObject.id, (o) => ({
                          ...o,
                          scale: Number(e.target.value),
                        }))
                      }
                    />
                  </label>
                )}
                <label className="wb-field">
                  <span>Colour</span>
                  <input
                    type="color"
                    value={selectedObject.color}
                    onChange={(e) =>
                      changeObject(selectedObject.id, (o) => ({ ...o, color: e.target.value }))
                    }
                  />
                </label>
              </div>
              {slots.length > 1 && (
                <label className="wb-field">
                  <span>Filament slot</span>
                  <select
                    value={selectedObject.slot ?? 0}
                    onChange={(e) =>
                      changeObject(selectedObject.id, (o) => ({
                        ...o,
                        slot: Number(e.target.value),
                      }))
                    }
                  >
                    {slots.map((s, i) => (
                      <option key={i} value={i}>
                        Slot {i + 1} · {s.type} {s.brand}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <details className="wb-subsection" open={!!selectedObject.overrides}>
                <summary>Object settings {selectedObject.overrides ? '(overridden)' : ''}</summary>
                <div className="wb-row three">
                  <label className="wb-field">
                    <span>Walls</span>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      placeholder={String(doc.process.walls)}
                      value={overrides.walls ?? ''}
                      aria-label="Object walls"
                      onChange={(e) =>
                        setOverride({
                          walls: e.target.value === '' ? undefined : Number(e.target.value),
                        })
                      }
                    />
                  </label>
                  <label className="wb-field">
                    <span>Infill %</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      placeholder={String(doc.process.infill)}
                      value={overrides.infill ?? ''}
                      aria-label="Object infill"
                      onChange={(e) =>
                        setOverride({
                          infill: e.target.value === '' ? undefined : Number(e.target.value),
                        })
                      }
                    />
                  </label>
                  <label className="wb-field">
                    <span>Pattern</span>
                    <select
                      value={overrides.infillPattern ?? ''}
                      aria-label="Object infill pattern"
                      onChange={(e) =>
                        setOverride({
                          infillPattern: (e.target.value || undefined) as
                            Process['infillPattern'] | undefined,
                        })
                      }
                    >
                      <option value="">plate</option>
                      {INFILL_PATTERNS.map((p) => (
                        <option key={p}>{p}</option>
                      ))}
                    </select>
                  </label>
                  <label className="wb-field">
                    <span>Supports</span>
                    <select
                      value={
                        overrides.supports === undefined ? '' : overrides.supports ? 'on' : 'off'
                      }
                      aria-label="Object supports"
                      onChange={(e) =>
                        setOverride({
                          supports: e.target.value === '' ? undefined : e.target.value === 'on',
                        })
                      }
                    >
                      <option value="">plate</option>
                      <option value="on">on</option>
                      <option value="off">off</option>
                    </select>
                  </label>
                  <label className="wb-field">
                    <span>Top layers</span>
                    <input
                      type="number"
                      min={0}
                      max={20}
                      placeholder={String(doc.process.topLayers)}
                      value={overrides.topLayers ?? ''}
                      aria-label="Object top layers"
                      onChange={(e) =>
                        setOverride({
                          topLayers: e.target.value === '' ? undefined : Number(e.target.value),
                        })
                      }
                    />
                  </label>
                  <label className="wb-field">
                    <span>Bottom layers</span>
                    <input
                      type="number"
                      min={0}
                      max={20}
                      placeholder={String(doc.process.bottomLayers)}
                      value={overrides.bottomLayers ?? ''}
                      aria-label="Object bottom layers"
                      onChange={(e) =>
                        setOverride({
                          bottomLayers: e.target.value === '' ? undefined : Number(e.target.value),
                        })
                      }
                    />
                  </label>
                </div>
                <p className="wb-hint">Blank fields follow the plate’s process.</p>
              </details>
            </>
          )}
          <div className="wb-panel-title">Slice</div>
          <button
            type="button"
            className="wb-button primary large"
            disabled={readOnly || !plate.objects.length}
            onClick={() => command('slice')}
          >
            <Slice size={14} /> Slice plate
          </button>
          {estimate && (
            <>
              <div className="wb-stat">
                <span>Time</span>
                <strong>{formatDuration(estimate.seconds)}</strong>
              </div>
              <div className="wb-stat">
                <span>Filament</span>
                <strong>
                  {estimate.grams} g · {estimate.meters} m
                </strong>
              </div>
              {estimate.bySlot && estimate.bySlot.length > 1 && (
                <div className="wb-stat">
                  <span>By slot</span>
                  <strong>{estimate.bySlot.map((g, i) => `T${i + 1} ${g} g`).join(' · ')}</strong>
                </div>
              )}
              <div className="wb-stat">
                <span>Layers</span>
                <strong>{estimate.layers}</strong>
              </div>
              <div className="wb-stat">
                <span>Cost</span>
                <strong>${estimate.cost.toFixed(2)}</strong>
              </div>
              {doc.view === 'preview' && (
                <label className="wb-field">
                  <span>
                    Layer {doc.previewLayer} of {estimate.layers}
                    {sliced?.layers[doc.previewLayer - 1]
                      ? ` · ${formatDuration(Math.round(sliced.layers[doc.previewLayer - 1].seconds))} this layer`
                      : ''}
                  </span>
                  <input
                    type="range"
                    min={1}
                    max={estimate.layers}
                    value={doc.previewLayer}
                    onChange={(e) => apply({ ...doc, previewLayer: Number(e.target.value) }, false)}
                  />
                </label>
              )}
              <button type="button" className="wb-button" onClick={() => command('device:print')}>
                <Play size={13} /> Print plate
              </button>
              {doc.view === 'preview' && scheme === 'type' && (
                <ul className="wb-legend" aria-label="Line types">
                  {PATH_KINDS.filter(
                    (kind) => estimate.byType?.[kind] !== undefined || !estimate.byType,
                  ).map((kind) => (
                    <li key={kind}>
                      <span className="wb-swatch" style={{ background: PATH_COLORS[kind] }} />
                      <span style={{ flex: 1 }}>{PATH_LABELS[kind]}</span>
                      {estimate.byType?.[kind] !== undefined && (
                        <span className="wb-legend-time">
                          {formatDuration(estimate.byType[kind])}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {doc.view === 'preview' && scheme === 'filament' && (
                <ul className="wb-legend" aria-label="Filaments">
                  {slots.map((s, i) => (
                    <li key={i}>
                      <span className="wb-swatch" style={{ background: s.color }} />
                      Slot {i + 1} · {s.type} {s.brand}
                    </li>
                  ))}
                </ul>
              )}
              {doc.view === 'preview' && (scheme === 'speed' || scheme === 'height') && (
                <div
                  className="wb-heat"
                  aria-label={scheme === 'speed' ? 'Speed scale' : 'Layer height scale'}
                >
                  <span>{scheme === 'speed' ? 'slow' : 'thin'}</span>
                  <i />
                  <span>{scheme === 'speed' ? 'fast' : 'thick'}</span>
                </div>
              )}
            </>
          )}
          <p className="wb-hint">
            Time and filament come from the toolpaths in Preview: walls, skins, infill, supports,
            brim, skirt, and raft, with retractions and a cooling floor per layer.
          </p>
        </>
      )}
    </div>
  )

  return (
    <div className="wb-editor">
      <div className="canvas-heading">
        <div>
          <button className="back-link" onClick={onBack}>
            <ArrowLeft size={15} />
            Back to project
          </button>
          <div className="eyebrow">SLICER</div>
          <h1>{title}</h1>
        </div>
        <div className="canvas-heading-actions">
          {unsaved && <span className="unsaved-note">Changes not saved</span>}
          <span className="unsaved-note">
            Real toolpaths, supports, and G-code · simulated printer
          </span>
        </div>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept=".stl,model/stl"
        multiple
        hidden
        aria-label="Import STL files"
        onChange={importFiles}
      />
      <Workbench
        app={{
          name: 'Junga Slicer',
          theme: 'dark',
          accent: '#00ae42',
          documentName: `${title}.3mf`,
        }}
        menus={MENUS}
        ribbon={RIBBON}
        activeTab={doc.view}
        onTab={(id) => apply({ ...doc, view: id as SlicerView }, false)}
        tree={{
          title: 'Objects',
          nodes: objectTree,
          selectedId: selected,
          onSelect: (id) => setSelected(plate.objects.some((o) => o.id === id) ? id : null),
          tabs: [
            { id: 'settings', label: 'Settings', icon: Settings2 },
            { id: 'objects', label: 'Objects', icon: Boxes },
          ],
          activeTab: panelTab,
          onTreeTab: (id) => setPanelTab(id as 'settings' | 'objects'),
          panel: panelTab === 'settings' ? settingsPanel : undefined,
        }}
        activeTool={tool}
        toolValues={values}
        onToolValue={(id, value) => setValues((v) => ({ ...v, [id]: value }))}
        onToolOk={finishTool}
        onToolCancel={() => setTool(null)}
        onTool={startTool}
        onCommand={command}
        shortcuts={SHORTCUTS}
        viewport={
          <SlicerViewport
            ref={viewport}
            document={doc}
            selected={selected}
            sliced={sliced}
            scheme={scheme}
            showTravel={showTravel}
            onPick={setSelected}
            onDrag={readOnly ? undefined : dragObject}
            onDrop={() => {
              dragging.current = false
            }}
          />
        }
        viewToolbar={
          doc.view === 'preview'
            ? [
                { id: 'scheme:type', label: 'Line Type', icon: Paintbrush },
                { id: 'scheme:speed', label: 'Speed', icon: Gauge },
                { id: 'scheme:height', label: 'Layer Height', icon: Layers },
                { id: 'scheme:filament', label: 'Filament', icon: Palette },
                { id: 'toggle:travel', label: 'Travel', icon: Route },
                { id: 'zoom', label: 'Zoom to Fit', icon: Maximize2 },
              ]
            : [{ id: 'zoom', label: 'Zoom to Fit', icon: Maximize2 }]
        }
        onViewTool={command}
        activeViewTools={[`scheme:${scheme}`, ...(showTravel ? ['toggle:travel'] : [])]}
        rightPanel={rightPanel}
        status={[
          { id: 'printer', text: doc.printer, icon: Printer },
          {
            id: 'filament',
            text: `${slots.map((s) => s.type).join(' + ')} · ${doc.nozzle} mm nozzle`,
          },
          {
            id: 'objects',
            text: `${plate.objects.length} objects · ${triangleCount(plateMesh(plate)).toLocaleString()} triangles`,
          },
          {
            id: 'slice',
            text: estimate
              ? `${formatDuration(estimate.seconds)} · ${estimate.grams} g · $${estimate.cost.toFixed(2)}`
              : 'Not sliced',
          },
        ]}
        message={message}
        readOnly={readOnly}
      />
    </div>
  )
}
