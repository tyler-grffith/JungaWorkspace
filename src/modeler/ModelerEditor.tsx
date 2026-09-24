// The 3D modeler: a SolidWorks-shaped workbench (menus, CommandManager tabs, FeatureManager
// tree, PropertyManager panels, heads-up view toolbar, status bar) over a feature history that
// rebuilds real meshes. Sketches and features are added through their property panels and
// appear in the tree and in an orbitable viewport; parts export as STL or go straight to the
// project's slicer. Fillets, chamfers, and shells are recorded but wait for a geometry kernel.
import { forwardRef, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  ArrowLeft,
  Axis3d,
  Box,
  Boxes,
  Circle,
  CircleDot,
  Combine,
  Copy,
  Crop,
  Cuboid,
  Cylinder,
  Diameter,
  Drill,
  Eye,
  EyeOff,
  FlipHorizontal2,
  Focus,
  Grid3x3,
  Hexagon,
  Layers,
  Minus,
  Orbit,
  Palette,
  Pentagon,
  Printer,
  Radius,
  RectangleHorizontal,
  Rotate3d,
  Ruler,
  ScanLine,
  Slice,
  Square,
  Triangle,
  Weight,
} from 'lucide-react'
import Workbench from '../workbench/Workbench'
import Viewport3D, {
  gridLines,
  type SceneItem,
  type ViewName,
  type ViewportHandle,
} from '../workbench/Viewport3D'
import { bounds, extrude, frames, profile, toStl, vec, type Mesh } from '../workbench/geometry'
import { downloadBlob, safeFilename } from '../canvas/export'
import { BED_SIZE, activePlate, arrange, meshObject } from '../slicer/model'
import type { Menu, ParamValue, RibbonTab, ToolDef, TreeNode } from '../workbench/types'
import {
  FEATURE_LABELS,
  GEOMETRIC,
  MATERIALS,
  derive,
  massProperties,
  newFeature,
  newSketch,
  partMesh,
  printableMesh,
  validModeler,
  type DisplayStyle,
  type Feature,
  type FeatureType,
  type ModelerDocument,
  type Part,
  type Plane,
  type SketchShape,
} from './model'
import type { EditorProps } from '../modules/editors'
import '../canvas/canvas.css'

const PLANES: readonly Plane[] = ['Front', 'Top', 'Right']
const END_CONDITIONS = ['Blind', 'Through All', 'Up To Next', 'Mid Plane'] as const
const sketchTool = (shape: SketchShape, label: string, icon: ToolDef['icon']): ToolDef => ({
  id: `sketch:${shape}`,
  label,
  icon,
  hint: `Start a sketch with a ${shape} profile on a plane.`,
  params: [
    { id: 'plane', label: 'Sketch plane', kind: 'select', default: 'Top', options: PLANES },
    { id: 'width', label: 'Width', kind: 'number', default: 60, unit: 'mm', min: 0.1, max: 5000 },
    { id: 'height', label: 'Height', kind: 'number', default: 40, unit: 'mm', min: 0.1, max: 5000 },
    {
      id: 'offset',
      label: 'Offset from plane',
      kind: 'number',
      default: 0,
      unit: 'mm',
      min: -5000,
      max: 5000,
      help: 'Starts at the top of the material, so a new sketch sits on the last face.',
    },
    { id: 'x', label: 'Centre X', kind: 'number', default: 0, unit: 'mm', min: -5000, max: 5000 },
    { id: 'y', label: 'Centre Y', kind: 'number', default: 0, unit: 'mm', min: -5000, max: 5000 },
  ],
})
const featureTool = (
  type: FeatureType,
  icon: ToolDef['icon'],
  hint: string,
  params: ToolDef['params'],
  needs: ToolDef['needs'] = 'none',
): ToolDef => ({
  id: `feature:${type}`,
  label: FEATURE_LABELS[type]
    .replace('Boss-Extrude', 'Extruded Boss/Base')
    .replace('Cut-Extrude', 'Extruded Cut')
    .replace('Revolve', 'Revolved Boss/Base'),
  icon,
  hint,
  params,
  needs,
})
export const RIBBON: RibbonTab[] = [
  {
    id: 'features',
    label: 'Features',
    groups: [
      {
        label: 'Boss/Base',
        tools: [
          featureTool(
            'extrude',
            Cuboid,
            'Extrude the selected sketch to make or add a solid.',
            [
              {
                id: 'end',
                label: 'End condition',
                kind: 'select',
                default: 'Blind',
                options: END_CONDITIONS,
              },
              {
                id: 'depth',
                label: 'Depth',
                kind: 'number',
                default: 20,
                unit: 'mm',
                min: 0.1,
                max: 5000,
              },
              {
                id: 'draft',
                label: 'Draft angle',
                kind: 'number',
                default: 0,
                unit: '°',
                min: 0,
                max: 89,
              },
              { id: 'merge', label: 'Merge result', kind: 'toggle', default: true },
            ],
            'sketch',
          ),
          featureTool(
            'revolve',
            Cylinder,
            'Revolve the selected sketch about an axis.',
            [
              {
                id: 'angle',
                label: 'Angle',
                kind: 'number',
                default: 360,
                unit: '°',
                min: 1,
                max: 360,
              },
              {
                id: 'axis',
                label: 'Axis of revolution',
                kind: 'select',
                default: 'Sketch centreline',
                options: ['Sketch centreline'],
                help: 'The profile turns about the vertical line through its centre; a centred rectangle becomes a cylinder, an off-centre one a ring.',
              },
            ],
            'sketch',
          ),
        ],
      },
      {
        label: 'Cut',
        tools: [
          featureTool(
            'cut',
            Crop,
            'Remove material with the selected sketch.',
            [
              {
                id: 'end',
                label: 'End condition',
                kind: 'select',
                default: 'Blind',
                options: END_CONDITIONS,
              },
              {
                id: 'depth',
                label: 'Depth',
                kind: 'number',
                default: 10,
                unit: 'mm',
                min: 0.1,
                max: 5000,
              },
              { id: 'flip', label: 'Flip side to cut', kind: 'toggle', default: false },
            ],
            'sketch',
          ),
          featureTool('hole', Drill, 'Drill a hole down from the top face.', [
            {
              id: 'x',
              label: 'Centre X',
              kind: 'number',
              default: 0,
              unit: 'mm',
              min: -5000,
              max: 5000,
            },
            {
              id: 'y',
              label: 'Centre Y',
              kind: 'number',
              default: 0,
              unit: 'mm',
              min: -5000,
              max: 5000,
            },
            {
              id: 'standard',
              label: 'Standard',
              kind: 'select',
              default: 'ISO',
              options: ['ISO', 'ANSI Metric', 'ANSI Inch', 'DIN'],
            },
            {
              id: 'diameter',
              label: 'Diameter',
              kind: 'number',
              default: 8,
              unit: 'mm',
              min: 0.1,
              max: 500,
            },
            {
              id: 'depth',
              label: 'Depth',
              kind: 'number',
              default: 10,
              unit: 'mm',
              min: 0.1,
              max: 5000,
            },
            {
              id: 'end',
              label: 'End condition',
              kind: 'select',
              default: 'Blind',
              options: ['Blind', 'Through All'],
            },
            { id: 'threaded', label: 'Cosmetic thread', kind: 'toggle', default: false },
          ]),
        ],
      },
      {
        label: 'Features',
        tools: [
          featureTool('fillet', Radius, 'Round the edges of the last feature.', [
            {
              id: 'radius',
              label: 'Radius',
              kind: 'number',
              default: 2,
              unit: 'mm',
              min: 0.01,
              max: 500,
            },
            {
              id: 'edges',
              label: 'Edges',
              kind: 'select',
              default: 'All edges',
              options: ['All edges', 'Top edges', 'Vertical edges'],
            },
          ]),
          featureTool('chamfer', Triangle, 'Bevel the edges of the last feature.', [
            {
              id: 'distance',
              label: 'Distance',
              kind: 'number',
              default: 1,
              unit: 'mm',
              min: 0.01,
              max: 500,
            },
            {
              id: 'angle',
              label: 'Angle',
              kind: 'number',
              default: 45,
              unit: '°',
              min: 1,
              max: 89,
            },
          ]),
          featureTool('shell', Layers, 'Hollow the body, removing the top face.', [
            {
              id: 'thickness',
              label: 'Wall thickness',
              kind: 'number',
              default: 2,
              unit: 'mm',
              min: 0.01,
              max: 500,
            },
            { id: 'outward', label: 'Shell outward', kind: 'toggle', default: false },
          ]),
        ],
      },
      {
        label: 'Pattern',
        tools: [
          featureTool('mirror', FlipHorizontal2, 'Mirror the body about a plane.', [
            {
              id: 'plane',
              label: 'Mirror plane',
              kind: 'select',
              default: 'Right',
              options: PLANES,
            },
          ]),
          featureTool('pattern', Copy, 'Repeat the last solid along a direction.', [
            {
              id: 'direction',
              label: 'Direction',
              kind: 'select',
              default: 'X',
              options: ['X', 'Y', 'Z'],
            },
            {
              id: 'spacing',
              label: 'Spacing',
              kind: 'number',
              default: 30,
              unit: 'mm',
              min: 0.1,
              max: 5000,
            },
            { id: 'count', label: 'Instances', kind: 'number', default: 3, min: 2, max: 100 },
          ]),
        ],
      },
      {
        label: 'Reference',
        tools: [
          featureTool('plane', Square, 'Add a reference plane offset from an existing one.', [
            { id: 'from', label: 'Offset from', kind: 'select', default: 'Top', options: PLANES },
            {
              id: 'offset',
              label: 'Offset distance',
              kind: 'number',
              default: 25,
              unit: 'mm',
              min: -5000,
              max: 5000,
            },
          ]),
        ],
      },
    ],
  },
  {
    id: 'sketch',
    label: 'Sketch',
    groups: [
      {
        label: 'Sketch',
        tools: [
          sketchTool('rectangle', 'Corner Rectangle', RectangleHorizontal),
          sketchTool('circle', 'Circle', Circle),
          sketchTool('slot', 'Straight Slot', Minus),
          sketchTool('polygon', 'Polygon', Pentagon),
        ],
      },
      {
        label: 'Relations',
        tools: [
          {
            id: 'noop:dimension',
            label: 'Smart Dimension',
            icon: Ruler,
            hint: 'Dimensions are set in the sketch parameters in this prototype.',
          },
          {
            id: 'noop:trim',
            label: 'Trim Entities',
            icon: Slice,
            hint: 'Sketch editing tools arrive with the geometry kernel.',
            disabled: true,
          },
          { id: 'noop:offset', label: 'Offset Entities', icon: Hexagon, disabled: true },
          { id: 'noop:mirrorsk', label: 'Mirror Entities', icon: FlipHorizontal2, disabled: true },
        ],
      },
    ],
  },
  {
    id: 'evaluate',
    label: 'Evaluate',
    groups: [
      {
        label: 'Evaluate',
        tools: [
          {
            id: 'report:mass',
            label: 'Mass Properties',
            icon: Weight,
            hint: 'Volume and mass from the part\u2019s solids and its material.',
          },
          {
            id: 'report:measure',
            label: 'Measure',
            icon: Ruler,
            hint: 'Overall bounding size of the model.',
          },
          {
            id: 'view:section',
            label: 'Section View',
            icon: ScanLine,
            hint: 'Toggle a section through the model.',
          },
          {
            id: 'noop:interference',
            label: 'Interference Detection',
            icon: Combine,
            disabled: true,
          },
        ],
      },
      {
        label: 'Output',
        tools: [
          {
            id: 'send:slicer',
            label: 'Send to Slicer',
            icon: Printer,
            hint: 'Place this part on the build plate of the project\u2019s slicer.',
          },
          {
            id: 'export:stl',
            label: 'Export STL',
            icon: Box,
            hint: 'Download the part as a binary STL mesh.',
          },
        ],
      },
    ],
  },
  {
    id: 'appearance',
    label: 'Appearance',
    groups: [
      {
        label: 'Appearance',
        tools: [
          {
            id: 'set:material',
            label: 'Edit Material',
            icon: Boxes,
            hint: 'The material drives mass properties.',
            params: [
              {
                id: 'material',
                label: 'Material',
                kind: 'select',
                default: MATERIALS[0],
                options: MATERIALS,
              },
            ],
          },
          {
            id: 'set:color',
            label: 'Edit Appearance',
            icon: Palette,
            hint: 'Body color in the viewport.',
            params: [{ id: 'color', label: 'Color (hex)', kind: 'text', default: '#9aa7b4' }],
          },
          {
            id: 'set:units',
            label: 'Units',
            icon: Ruler,
            params: [
              {
                id: 'units',
                label: 'Unit system',
                kind: 'select',
                default: 'mm',
                options: ['mm', 'in'],
              },
            ],
          },
        ],
      },
    ],
  },
]
export const MENUS: Menu[] = [
  {
    label: 'File',
    items: [
      { label: 'New Part', shortcut: 'Ctrl+N', command: 'new' },
      { label: 'Open…', shortcut: 'Ctrl+O', command: 'notyet:Open' },
      { label: 'Save', shortcut: 'Ctrl+S', command: 'save' },
      'separator',
      { label: 'Export Part (JSON)…', command: 'export:json' },
      { label: 'Export STL…', command: 'export:stl' },
      { label: 'Send to Slicer', command: 'send:slicer' },
      { label: 'Export STEP…', command: 'notyet:STEP export' },
      { label: 'Print…', shortcut: 'Ctrl+P', command: 'notyet:Print' },
    ],
  },
  {
    label: 'Edit',
    items: [
      { label: 'Undo', shortcut: 'Ctrl+Z', command: 'undo' },
      { label: 'Redo', shortcut: 'Ctrl+Y', command: 'redo' },
      'separator',
      { label: 'Rebuild', shortcut: 'Ctrl+B', command: 'rebuild' },
      { label: 'Suppress / Unsuppress', command: 'suppress' },
      { label: 'Delete', shortcut: 'Del', command: 'delete' },
    ],
  },
  {
    label: 'View',
    items: [
      { label: 'Isometric', command: 'view:iso' },
      { label: 'Front', command: 'view:front' },
      { label: 'Top', command: 'view:top' },
      { label: 'Right', command: 'view:right' },
      'separator',
      { label: 'Shaded With Edges', command: 'style:shadedEdges' },
      { label: 'Shaded', command: 'style:shaded' },
      { label: 'Wireframe', command: 'style:wireframe' },
      { label: 'Hidden Lines Visible', command: 'style:hidden' },
      'separator',
      { label: 'Planes', command: 'toggle:planes' },
      { label: 'Origin', command: 'toggle:origin' },
    ],
  },
  {
    label: 'Insert',
    items: [
      { label: 'Sketch', command: 'tool:sketch:rectangle' },
      { label: 'Boss/Base › Extrude', command: 'tool:feature:extrude' },
      { label: 'Boss/Base › Revolve', command: 'tool:feature:revolve' },
      { label: 'Cut › Extrude', command: 'tool:feature:cut' },
      { label: 'Features › Fillet', command: 'tool:feature:fillet' },
      { label: 'Features › Chamfer', command: 'tool:feature:chamfer' },
      { label: 'Features › Shell', command: 'tool:feature:shell' },
      { label: 'Reference Geometry › Plane', command: 'tool:feature:plane' },
    ],
  },
  {
    label: 'Tools',
    items: [
      { label: 'Measure', command: 'tool:report:measure' },
      { label: 'Mass Properties', command: 'tool:report:mass' },
      'separator',
      { label: 'Options…', command: 'notyet:Options' },
    ],
  },
  {
    label: 'Window',
    items: [
      { label: 'Viewport', command: 'noop' },
      { label: 'Close All', command: 'notyet:Close All' },
    ],
  },
  { label: 'Help', items: [{ label: 'About this prototype', command: 'about' }] },
]
const VIEW_TOOLS: ToolDef[] = [
  { id: 'fit', label: 'Zoom to Fit', icon: Focus },
  { id: 'view:iso', label: 'Isometric', icon: Axis3d },
  { id: 'view:front', label: 'Front', icon: Square },
  { id: 'view:top', label: 'Top', icon: Grid3x3 },
  { id: 'view:right', label: 'Right', icon: RectangleHorizontal },
  { id: 'style:shadedEdges', label: 'Shaded With Edges', icon: Box },
  { id: 'style:shaded', label: 'Shaded', icon: Cuboid },
  { id: 'style:wireframe', label: 'Wireframe', icon: Boxes },
  { id: 'style:hidden', label: 'Hidden Lines Visible', icon: EyeOff },
  { id: 'view:section', label: 'Section View', icon: ScanLine },
  { id: 'toggle:planes', label: 'Planes', icon: Eye },
  { id: 'rotate', label: 'Rotate view (cycles the standard views)', icon: Rotate3d },
  { id: 'orbit', label: 'Orbit (drag in the viewport)', icon: Orbit },
]
const allTools = RIBBON.flatMap((t) => t.groups.flatMap((g) => g.tools))
const findTool = (id: string) => allTools.find((t) => t.id === id) ?? null

/** The FeatureManager tree derived from the document. */
function featureTree(doc: ModelerDocument, title: string): TreeNode[] {
  const children: TreeNode[] = [
    { id: 'sensors', label: 'Sensors', icon: CircleDot },
    { id: 'annotations', label: 'Annotations', icon: Ruler },
    { id: 'material', label: doc.material, icon: Boxes, badge: doc.units },
    { id: 'plane:Front', label: 'Front Plane', icon: Square, suppressed: !doc.view.showPlanes },
    { id: 'plane:Top', label: 'Top Plane', icon: Square, suppressed: !doc.view.showPlanes },
    { id: 'plane:Right', label: 'Right Plane', icon: Square, suppressed: !doc.view.showPlanes },
    { id: 'origin', label: 'Origin', icon: Axis3d, suppressed: !doc.view.showOrigin },
  ]
  const consumed = new Set(doc.features.map((f) => f.sketchId).filter(Boolean))
  for (const s of doc.sketches)
    if (!consumed.has(s.id))
      children.push({
        id: `sketch:${s.id}`,
        label: s.name,
        icon: Diameter,
        badge: s.plane,
        kind: 'sketch',
      })
  for (const f of doc.features) {
    const sketch = doc.sketches.find((s) => s.id === f.sketchId)
    children.push({
      id: `feature:${f.id}`,
      label: f.name,
      icon: featureIcon(f.type),
      suppressed: f.suppressed,
      badge: GEOMETRIC.includes(f.type) ? undefined : 'awaits kernel',
      kind: 'feature',
      children: sketch
        ? [
            {
              id: `sketch:${sketch.id}`,
              label: sketch.name,
              icon: Diameter,
              badge: sketch.plane,
              kind: 'sketch',
            },
          ]
        : undefined,
    })
  }
  return [{ id: 'part', label: title, icon: Box, children }]
}
const featureIcon = (type: FeatureType) =>
  ({
    extrude: Cuboid,
    cut: Crop,
    revolve: Cylinder,
    fillet: Radius,
    chamfer: Triangle,
    hole: Drill,
    shell: Layers,
    mirror: FlipHorizontal2,
    pattern: Copy,
    plane: Square,
  })[type]

const PLANE_COLORS: Record<Plane, string> = { Front: '#3b6fd9', Top: '#2f9e44', Right: '#d97b3b' }
/** A translucent square on a plane, visible from both sides. */
function planeItem(plane: Plane, offset: number, size: number, id: string): SceneItem {
  const half = extrude(profile('rectangle', size, size), frames[plane](offset), 0, 0.001)
  return {
    kind: 'mesh',
    id,
    mesh: half,
    fill: PLANE_COLORS[plane],
    stroke: PLANE_COLORS[plane],
    opacity: 0.18,
  }
}
/** Drop the half of a mesh in front of the section plane (y > 0). */
const sectioned = (mesh: Mesh): Mesh => {
  const out: Mesh = []
  for (let i = 0; i + 8 < mesh.length; i += 9)
    if ((mesh[i + 1] + mesh[i + 4] + mesh[i + 7]) / 3 <= 0) out.push(...mesh.slice(i, i + 9))
  return out
}
const DEFAULT_EXTENT = extrude(profile('rectangle', 120, 120), frames.Top(), 0, 40)

/** The viewport: grid, planes, the derived solids, section, and selection highlight. */
export const ModelerViewport = forwardRef<
  ViewportHandle,
  {
    document: ModelerDocument
    part?: Part
    selectedFeature: string | null
    section: boolean
    onPick?: (featureId: string | null) => void
  }
>(function ModelerViewport({ document: doc, part: given, selectedFeature, section, onPick }, ref) {
  const part = useMemo(() => given ?? derive(doc), [given, doc])
  const style = doc.view.style
  const wire = style === 'wireframe' || style === 'hidden'
  const bosses = part.solids.filter((s) => !s.cut)
  const extent = bosses.length ? partMesh({ ...part, solids: bosses }) : DEFAULT_EXTENT
  const reach =
    Math.max(
      120,
      ...Object.values(bounds(extent) ?? {}).flatMap((v) => [
        Math.abs(v.x),
        Math.abs(v.y),
        Math.abs(v.z),
      ]),
    ) * 1.5
  const items: SceneItem[] = [
    {
      kind: 'lines',
      polylines: gridLines(reach, reach / 8),
      stroke: 'rgba(90,110,130,0.3)',
      layer: 'under',
    },
  ]
  if (doc.view.showPlanes)
    for (const plane of PLANES) items.push(planeItem(plane, 0, reach * 0.6, `plane:${plane}`))
  for (const plane of part.planes)
    items.push(planeItem(plane.base, plane.offset, reach * 0.5, `feature:${plane.id}`))
  for (const solid of part.solids) {
    const selected = selectedFeature === solid.featureId
    items.push(
      solid.cut
        ? {
            kind: 'mesh',
            id: solid.featureId,
            mesh: solid.mesh,
            fill: '#ffffff',
            wire: true,
            dashed: true,
            stroke: selected ? '#2f6fed' : 'rgba(200,40,40,0.75)',
          }
        : {
            kind: 'mesh',
            id: solid.featureId,
            mesh: section ? sectioned(solid.mesh) : solid.mesh,
            fill: doc.color,
            wire,
            dashed: style === 'hidden',
            stroke: selected ? '#2f6fed' : style === 'shaded' ? null : 'rgba(20,30,40,0.55)',
          },
    )
  }
  if (doc.view.showOrigin)
    items.push({
      kind: 'lines',
      polylines: [
        [vec(-6, 0, 0), vec(6, 0, 0)],
        [vec(0, -6, 0), vec(0, 6, 0)],
        [vec(0, 0, -6), vec(0, 0, 6)],
      ],
      stroke: '#2f6fed',
      width: 1.5,
    })
  const count = part.solids.length
  return (
    <Viewport3D
      ref={ref}
      items={items}
      fitTo={extent}
      initialView={doc.view.orientation as ViewName}
      label={`Model with ${count} ${count === 1 ? 'solid' : 'solids'}`}
      onPick={
        onPick
          ? (id) => onPick(id && !id.startsWith('plane:') && !id.startsWith('feature:') ? id : null)
          : undefined
      }
    >
      <div className="wb-viewport-note">
        {count
          ? `${count} ${count === 1 ? 'solid' : 'solids'} · ${doc.view.style} · drag to orbit, wheel to zoom`
          : 'No features yet. Start a sketch, then extrude it.'}
      </div>
    </Viewport3D>
  )
})

type History = { past: ModelerDocument[]; future: ModelerDocument[] }
export default function ModelerEditor({
  title,
  document: doc,
  readOnly,
  unsaved,
  onBack,
  onChange,
  related,
}: EditorProps<ModelerDocument>) {
  const [tab, setTab] = useState('features')
  const viewport = useRef<ViewportHandle>(null)
  const part = useMemo(() => derive(doc), [doc])
  const [tool, setTool] = useState<ToolDef | null>(null)
  const [values, setValues] = useState<Record<string, ParamValue>>({})
  const [selected, setSelected] = useState<string | null>('part')
  const [section, setSection] = useState(false)
  const [report, setReport] = useState<ReactNode>(null)
  const [message, setMessage] = useState('')
  const [history, setHistory] = useState<History>({ past: [], future: [] })

  const apply = (next: ModelerDocument, record = true) => {
    if (readOnly) return false
    if (!validModeler(next)) {
      setMessage('That change could not be saved.')
      return false
    }
    if (record) setHistory((h) => ({ past: [...h.past.slice(-49), doc], future: [] }))
    return onChange(next)
  }
  const selectedFeature = selected?.startsWith('feature:') ? selected.slice(8) : null
  const selectedSketch = selected?.startsWith('sketch:')
    ? selected.slice(7)
    : (doc.sketches.find((s) => !doc.features.some((f) => f.sketchId === s.id))?.id ?? null)

  /** Tools with parameters open the property panel; the rest run as commands at once. */
  function startTool(t: ToolDef) {
    if (!t.params) {
      command(t.id)
      return
    }
    if (t.needs === 'sketch' && !selectedSketch) {
      setMessage('Select or create a sketch first; the Sketch tab draws one on a plane.')
      setTab('sketch')
      return
    }
    setReport(null)
    setTool(t)
    const defaults = Object.fromEntries((t.params ?? []).map((p) => [p.id, p.default]))
    // A new sketch starts on top of the material, like sketching on the last face.
    if (t.id.startsWith('sketch:')) defaults.offset = topAlong(String(defaults.plane) as Plane)
    setValues(defaults)
  }
  /** The material's extent along a base plane's normal. */
  function topAlong(plane: Plane): number {
    const b = bounds(partMesh({ ...part, solids: part.solids.filter((s) => !s.cut) }))
    if (!b) return 0
    return Math.round({ Top: b.max.z, Front: -b.min.y, Right: b.max.x }[plane] * 100) / 100
  }
  function finishTool() {
    if (!tool) return
    const [kind, name] = tool.id.split(':')
    if (kind === 'sketch') {
      const sketch = newSketch(
        String(values.plane) as Plane,
        name as SketchShape,
        Number(values.width),
        Number(values.height),
        doc.sketches.length + 1,
        { offset: Number(values.offset) || 0, x: Number(values.x) || 0, y: Number(values.y) || 0 },
      )
      if (apply({ ...doc, sketches: [...doc.sketches, sketch] })) {
        setSelected(`sketch:${sketch.id}`)
        setTab('features')
        setMessage(
          `${sketch.name} added on the ${sketch.plane} plane. Now extrude it from the Features tab.`,
        )
      }
    } else if (kind === 'feature') {
      const type = name as FeatureType
      const usesSketch = tool.needs === 'sketch'
      const feature = newFeature(
        type,
        doc.features.filter((f) => f.type === type).length + 1,
        values as Feature['params'],
        usesSketch ? selectedSketch : null,
      )
      if (apply({ ...doc, features: [...doc.features, feature] })) {
        setSelected(`feature:${feature.id}`)
        setMessage(`${feature.name} added.`)
      }
    } else if (kind === 'set') {
      if (name === 'material') apply({ ...doc, material: String(values.material) })
      else if (name === 'color') {
        const c = String(values.color).trim()
        if (/^#[0-9a-f]{6}$/i.test(c)) apply({ ...doc, color: c })
        else setMessage('Use a hex color like #9aa7b4.')
      } else if (name === 'units') apply({ ...doc, units: values.units as 'mm' | 'in' })
    }
    setTool(null)
  }
  function command(id: string) {
    if (id.startsWith('tool:')) {
      const t = findTool(id.slice(5))
      if (t) startTool(t)
      return
    }
    if (id.startsWith('notyet:')) {
      setMessage(`${id.slice(7)} is not built yet.`)
      return
    }
    if (id.startsWith('noop:')) {
      setMessage(findTool(id)?.hint ?? 'This tool is not built yet.')
      return
    }
    if (id.startsWith('report:')) {
      setReport(id === 'report:mass' ? <MassReport doc={doc} /> : <MeasureReport doc={doc} />)
      setTool(null)
      return
    }
    if (id.startsWith('view:')) {
      if (id === 'view:section') setSection((s) => !s)
      else look(id.slice(5) as ModelerDocument['view']['orientation'])
      return
    }
    if (id.startsWith('style:')) {
      apply({ ...doc, view: { ...doc.view, style: id.slice(6) as DisplayStyle } }, false)
      return
    }
    switch (id) {
      case 'toggle:planes':
        apply({ ...doc, view: { ...doc.view, showPlanes: !doc.view.showPlanes } }, false)
        break
      case 'toggle:origin':
        apply({ ...doc, view: { ...doc.view, showOrigin: !doc.view.showOrigin } }, false)
        break
      case 'fit':
        viewport.current?.fit()
        break
      case 'rotate': {
        const views = ['iso', 'front', 'top', 'right'] as const
        look(views[(views.indexOf(doc.view.orientation) + 1) % views.length])
        break
      }
      case 'orbit':
        setMessage(
          'Drag in the viewport to orbit, shift-drag to pan, wheel to zoom, double-click to fit.',
        )
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
      case 'rebuild':
        setMessage(
          `Rebuild complete: ${doc.features.filter((f) => !f.suppressed).length} features, ${part.solids.length} solids.`,
        )
        break
      case 'suppress':
        if (selectedFeature)
          apply({
            ...doc,
            features: doc.features.map((f) =>
              f.id === selectedFeature ? { ...f, suppressed: !f.suppressed } : f,
            ),
          })
        else setMessage('Select a feature in the tree first.')
        break
      case 'delete':
        if (selectedFeature) {
          apply({ ...doc, features: doc.features.filter((f) => f.id !== selectedFeature) })
          setSelected('part')
        } else if (selected?.startsWith('sketch:')) {
          const id = selected.slice(7)
          if (doc.features.some((f) => f.sketchId === id))
            setMessage('Delete the feature that uses this sketch first.')
          else {
            apply({ ...doc, sketches: doc.sketches.filter((s) => s.id !== id) })
            setSelected('part')
          }
        } else setMessage('Select a feature or sketch in the tree first.')
        break
      case 'new':
        setMessage('Create a new project with the 3D modeler tool for another part.')
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
          `${safeFilename(title) || 'part'}.part.json`,
        )
        break
      case 'export:stl':
        if (!part.solids.length) setMessage('Extrude something before exporting.')
        else downloadBlob(toStl(printableMesh(doc), title), `${safeFilename(title) || 'part'}.stl`)
        break
      case 'send:slicer':
        sendToSlicer()
        break
      case 'about':
        setMessage(
          'A SolidWorks-shaped modeler: a real feature history rebuilt into meshes. Fillets, chamfers, and shells await a geometry kernel.',
        )
        break
      default:
        break
    }
  }
  /** Turn the camera to a standard view and remember it with the document. */
  function look(orientation: ModelerDocument['view']['orientation']) {
    viewport.current?.look(orientation as ViewName)
    if (orientation !== doc.view.orientation)
      apply({ ...doc, view: { ...doc.view, orientation } }, false)
  }
  /** Put the part on the project's slicer plate; both modules live on the same project. */
  function sendToSlicer() {
    if (!related?.tools.includes('slicer')) {
      setMessage('Add the Slicer tool to this project to send parts to it.')
      return
    }
    if (!part.solids.some((s) => !s.cut)) {
      setMessage('Extrude something before sending the part to the slicer.')
      return
    }
    const slicer = related.get('slicer')
    const plate = activePlate(slicer)
    const object = meshObject(title, printableMesh(doc), plate.objects.length)
    const placed = arrange(
      { ...plate, objects: [...plate.objects, object] },
      BED_SIZE[slicer.printer] ?? 256,
    )
    const saved = related.save('slicer', {
      ...slicer,
      plates: slicer.plates.map((p) => (p.id === plate.id ? placed : p)),
      sliced: null,
      view: 'prepare',
    })
    if (saved) related.open('slicer')
    else setMessage('The part is too detailed for the slicer\u2019s storage budget.')
  }
  const tree = useMemo(() => featureTree(doc, title), [doc, title])
  const mass = massProperties(doc)
  const activeViewTools = [
    `view:${doc.view.orientation}`,
    `style:${doc.view.style}`,
    ...(section ? ['view:section'] : []),
    ...(doc.view.showPlanes ? ['toggle:planes'] : []),
  ]

  return (
    <div className="wb-editor">
      <div className="canvas-heading">
        <div>
          <button className="back-link" onClick={onBack}>
            <ArrowLeft size={15} />
            Back to project
          </button>
          <div className="eyebrow">3D MODELER</div>
          <h1>{title}</h1>
        </div>
        <div className="canvas-heading-actions">
          {unsaved && <span className="unsaved-note">Changes not saved</span>}
          <span className="unsaved-note">Feature history rebuilt into real meshes</span>
        </div>
      </div>
      <Workbench
        app={{
          name: 'Junga Modeler',
          theme: 'light',
          accent: '#d9251d',
          documentName: `${title}.SLDPRT`,
        }}
        menus={MENUS}
        ribbon={RIBBON}
        activeTab={tab}
        onTab={setTab}
        tree={{
          title: 'FeatureManager',
          nodes: tree,
          selectedId: selected,
          onSelect: (id) => {
            setSelected(id)
            setReport(null)
          },
          panel: report,
        }}
        activeTool={tool}
        toolValues={values}
        onToolValue={(id, value) => setValues((v) => ({ ...v, [id]: value }))}
        onToolOk={finishTool}
        onToolCancel={() => setTool(null)}
        onTool={startTool}
        onCommand={command}
        viewport={
          <ModelerViewport
            ref={viewport}
            document={doc}
            part={part}
            selectedFeature={selectedFeature}
            section={section}
            onPick={(id) => setSelected(id ? `feature:${id}` : 'part')}
          />
        }
        viewToolbar={VIEW_TOOLS}
        onViewTool={command}
        activeViewTools={activeViewTools}
        status={[
          { id: 'mode', text: readOnly ? 'Viewing Part' : 'Editing Part' },
          { id: 'units', text: doc.units === 'mm' ? 'MMGS' : 'IPS', icon: Ruler },
          {
            id: 'features',
            text: `${doc.features.length} features · ${doc.sketches.length} sketches`,
          },
          { id: 'mass', text: `${mass.mass.toFixed(1)} g`, icon: Weight },
          { id: 'rebuild', text: 'Rebuild OK' },
        ]}
        message={message}
        readOnly={readOnly}
      />
    </div>
  )
}

function MassReport({ doc }: { doc: ModelerDocument }) {
  const m = massProperties(doc)
  return (
    <div>
      <div className="wb-panel-title">Mass Properties</div>
      <div className="wb-stat">
        <span>Material</span>
        <strong>{doc.material}</strong>
      </div>
      <div className="wb-stat">
        <span>Volume</span>
        <strong>
          {m.volume.toLocaleString(undefined, { maximumFractionDigits: 0 })} {doc.units}³
        </strong>
      </div>
      <div className="wb-stat">
        <span>Mass</span>
        <strong>{m.mass.toFixed(2)} g</strong>
      </div>
      <div className="wb-stat">
        <span>Solids</span>
        <strong>{m.solids}</strong>
      </div>
      <p className="wb-hint">
        Signed mesh volumes: cuts and holes subtract where they sit inside a boss.
      </p>
    </div>
  )
}
function MeasureReport({ doc }: { doc: ModelerDocument }) {
  const { size } = massProperties(doc)
  return (
    <div>
      <div className="wb-panel-title">Measure</div>
      <div className="wb-stat">
        <span>Bounding box</span>
        <strong>
          {size.x.toFixed(1)} × {size.y.toFixed(1)} × {size.z.toFixed(1)} {doc.units}
        </strong>
      </div>
      <p className="wb-hint">Overall extent of the material, cuts excluded.</p>
    </div>
  )
}
