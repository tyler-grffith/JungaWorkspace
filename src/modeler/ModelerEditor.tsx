// The 3D modeler: a SolidWorks-shaped workbench (menus, CommandManager tabs, FeatureManager
// tree, PropertyManager panels, heads-up view toolbar, status bar) over a feature history that
// rebuilds one closed body with real booleans. Sketches are drawn in a 2D sketcher on a plane
// or made from quick shapes; features are added and edited through their property panels,
// appear in the tree, and are picked in an orbitable viewport; parts export as STL, 3MF, or
// OBJ, or go straight to the project's slicer.
import { forwardRef, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
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
  FileUp,
  FlipHorizontal2,
  Focus,
  Grid3x3,
  Hexagon,
  Layers,
  Minus,
  Orbit,
  Palette,
  PenTool,
  Pencil,
  Pentagon,
  Printer,
  Radius,
  RectangleHorizontal,
  RotateCw,
  Rotate3d,
  Ruler,
  ScanLine,
  ShieldCheck,
  Square,
  Trash2,
  Triangle,
  Waves,
  Weight,
} from 'lucide-react'
import Workbench from '../workbench/Workbench'
import Viewport3D, {
  gridLines,
  type SceneItem,
  type ViewName,
  type ViewportHandle,
} from '../workbench/Viewport3D'
import {
  bounds,
  compact,
  decimate,
  extrude,
  frames,
  parseStl,
  profile,
  settle,
  toStl,
  triangleCount,
  vec,
  type Vec3,
} from '../workbench/geometry'
import { toObj, toThreeMf } from '../workbench/threemf'
import { downloadBlob, safeFilename } from '../canvas/export'
import { BED_SIZE, activePlate, arrange, meshObject } from '../slicer/model'
import type { Menu, ParamValue, RibbonTab, ToolDef, TreeNode } from '../workbench/types'
import {
  BOSSES,
  CUTS,
  FEATURE_LABELS,
  MATERIALS,
  MAX_MESH_TRIANGLES,
  MODIFIERS,
  ORIENTATIONS,
  checkMesh,
  derive,
  featureSummary,
  massProperties,
  newFeature,
  newId,
  newSketch,
  planeSection,
  sectionOf,
  sketchFrame,
  sketchRegionsOf,
  validModeler,
  type DisplayStyle,
  type Feature,
  type FeatureType,
  type ModelerDocument,
  type Orientation,
  type Part,
  type Plane,
  type Sketch,
  type SketchShape,
} from './model'
import { shapeEntities, type SketchEntity } from './sketch'
import SketchEditor from './SketchEditor'
import type { EditorProps } from '../modules/editors'
import '../canvas/canvas.css'

const PLANES: readonly Plane[] = ['Front', 'Top', 'Right']
const END_CONDITIONS = ['Blind', 'Through All', 'Up To Next', 'Mid Plane'] as const
const EDGE_SETS = [
  'All edges',
  'Top edges',
  'Bottom edges',
  'Vertical edges',
  'Top and bottom',
] as const
const mm = (id: string, label: string, def: number, min = 0.1, max = 5000, help?: string) => ({
  id,
  label,
  kind: 'number' as const,
  default: def,
  unit: 'mm',
  min,
  max,
  help,
})
const deg = (id: string, label: string, def: number, min = 0, max = 360) => ({
  id,
  label,
  kind: 'number' as const,
  default: def,
  unit: '°',
  min,
  max,
})
const pick = (
  id: string,
  label: string,
  def: string,
  options: readonly string[],
  help?: string,
) => ({
  id,
  label,
  kind: 'select' as const,
  default: def,
  options,
  help,
})
const flag = (id: string, label: string, def: boolean) => ({
  id,
  label,
  kind: 'toggle' as const,
  default: def,
})

/** Parameters shown by name in the panel but stored as ids; `derive` reads the stored keys. */
const NAMED_PARAMS: Record<string, 'feature' | 'sketch' | 'mesh'> = {
  targetId: 'feature',
  sketch2: 'sketch',
  pathSketch: 'sketch',
  meshId: 'mesh',
}
const sketchTool = (shape: SketchShape, label: string, icon: ToolDef['icon']): ToolDef => ({
  id: `sketch:${shape}`,
  label,
  icon,
  hint: `Start a sketch with a ${shape} profile on a plane; edit it later in the sketcher.`,
  params: [
    pick('plane', 'Sketch plane', 'Top', PLANES),
    mm('width', 'Width', 60),
    mm('height', 'Height', 40),
    mm(
      'offset',
      'Offset from plane',
      0,
      -5000,
      5000,
      'Starts at the top of the material, so a new sketch sits on the last face.',
    ),
    mm('x', 'Centre X', 0, -5000, 5000),
    mm('y', 'Centre Y', 0, -5000, 5000),
  ],
})
const featureTool = (
  type: FeatureType,
  label: string,
  icon: ToolDef['icon'],
  hint: string,
  params: ToolDef['params'],
  needs: ToolDef['needs'] = 'none',
  id = `feature:${type}`,
): ToolDef => ({ id, label, icon, hint, params, needs })
const sketchDepthParams = (cut: boolean) => [
  pick('end', 'End condition', 'Blind', END_CONDITIONS),
  mm('depth', 'Depth', cut ? 10 : 20),
  pick(
    'direction',
    'Direction',
    'Normal',
    ['Normal', 'Reverse', 'Both'],
    'Both extrudes each way; the second depth is below.',
  ),
  mm('depth2', 'Second depth (Both)', 10),
  deg('draft', 'Draft angle', 0, 0, 80),
]
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
            'Extruded Boss/Base',
            Cuboid,
            'Extrude the selected sketch to make or add a solid.',
            [...sketchDepthParams(false), flag('merge', 'Merge result', true)],
            'sketch',
          ),
          featureTool(
            'revolve',
            'Revolved Boss/Base',
            Cylinder,
            'Revolve the selected sketch about an axis.',
            [
              deg('angle', 'Angle', 360, 1, 360),
              pick(
                'axis',
                'Axis of revolution',
                'Sketch centreline',
                ['Sketch centreline', 'Left edge', 'Right edge'],
                'The vertical line the profile turns about: through its centre, or along its left or right edge.',
              ),
              mm(
                'axisOffset',
                'Axis offset',
                0,
                -5000,
                5000,
                'Shifts the axis sideways; a centred rectangle with an offset becomes a ring.',
              ),
            ],
            'sketch',
          ),
          featureTool(
            'loft',
            'Lofted Boss/Base',
            Waves,
            'Blend the selected sketch into a second sketch.',
            [
              pick(
                'sketch2',
                'Second profile',
                '',
                [],
                'The sketch to loft to; usually on an offset plane.',
              ),
            ],
            'sketch',
          ),
          featureTool(
            'sweep',
            'Swept Boss/Base',
            PenTool,
            'Sweep the selected profile along a path sketch.',
            [
              pick(
                'pathSketch',
                'Path sketch',
                '',
                [],
                'A sketch of connected lines and arcs, not closed, on a plane through the profile.',
              ),
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
            'Extruded Cut',
            Crop,
            'Remove material with the selected sketch.',
            [...sketchDepthParams(true), flag('flip', 'Flip side to cut', false)],
            'sketch',
          ),
          featureTool(
            'revolve',
            'Revolved Cut',
            RotateCw,
            'Remove material by revolving the selected sketch.',
            [
              deg('angle', 'Angle', 360, 1, 360),
              pick('axis', 'Axis of revolution', 'Sketch centreline', [
                'Sketch centreline',
                'Left edge',
                'Right edge',
              ]),
              mm('axisOffset', 'Axis offset', 0, -5000, 5000),
              flag('cut', 'Cut', true),
            ],
            'sketch',
            'feature:revolvecut',
          ),
          featureTool('hole', 'Hole Wizard', Drill, 'Drill a hole into a face of the body.', [
            pick('face', 'Face', 'Top', ['Top', 'Bottom', 'Front', 'Back', 'Right', 'Left']),
            pick('type', 'Hole type', 'Simple', ['Simple', 'Counterbore', 'Countersink']),
            mm('x', 'Position X', 0, -5000, 5000, 'On the face, from the model origin.'),
            mm('y', 'Position Y', 0, -5000, 5000),
            mm('diameter', 'Diameter', 8, 0.1, 500),
            pick('end', 'End condition', 'Blind', ['Blind', 'Through All']),
            mm('depth', 'Depth', 10),
            mm('cbDiameter', 'Counterbore diameter', 14, 0.1, 500),
            mm('cbDepth', 'Counterbore depth', 4, 0.01, 500),
            mm('csDiameter', 'Countersink diameter', 16, 0.1, 500),
            deg('csAngle', 'Countersink angle', 90, 10, 170),
            pick('standard', 'Standard', 'ISO', ['ISO', 'ANSI Metric', 'ANSI Inch', 'DIN']),
          ]),
        ],
      },
      {
        label: 'Features',
        tools: [
          featureTool('fillet', 'Fillet', Radius, 'Round the edges of a feature.', [
            pick(
              'targetId',
              'Feature',
              '',
              [],
              'The extrusion, revolve, cut, or hole whose edges to round.',
            ),
            mm('radius', 'Radius', 2, 0.01, 500),
            pick('edges', 'Edges', 'All edges', EDGE_SETS),
          ]),
          featureTool('chamfer', 'Chamfer', Triangle, 'Bevel the edges of a feature.', [
            pick('targetId', 'Feature', '', []),
            mm('distance', 'Distance', 1, 0.01, 500),
            pick('edges', 'Edges', 'All edges', EDGE_SETS),
          ]),
          featureTool('shell', 'Shell', Layers, 'Hollow a feature to a wall thickness.', [
            pick('targetId', 'Feature', '', []),
            mm('thickness', 'Wall thickness', 2, 0.01, 500),
            pick('open', 'Open face', 'Top', ['Top', 'Bottom', 'Both', 'None']),
          ]),
        ],
      },
      {
        label: 'Pattern',
        tools: [
          featureTool(
            'pattern',
            'Linear Pattern',
            Copy,
            'Repeat the last feature along one or two directions.',
            [
              pick('direction', 'Direction 1', 'X', ['X', 'Y', 'Z']),
              mm('spacing', 'Spacing 1', 30, -5000, 5000),
              { id: 'count', label: 'Instances 1', kind: 'number', default: 3, min: 1, max: 100 },
              pick('direction2', 'Direction 2', 'Y', ['X', 'Y', 'Z']),
              mm('spacing2', 'Spacing 2', 30, -5000, 5000),
              { id: 'count2', label: 'Instances 2', kind: 'number', default: 1, min: 1, max: 100 },
            ],
          ),
          featureTool(
            'circular',
            'Circular Pattern',
            Orbit,
            'Repeat the last feature around an axis.',
            [
              pick('axis', 'Axis', 'Z', ['Z', 'X', 'Y']),
              { id: 'count', label: 'Instances', kind: 'number', default: 6, min: 2, max: 100 },
              deg('angle', 'Total angle', 360, 1, 360),
              flag('equal', 'Equal spacing', true),
              mm('x', 'Axis X', 0, -5000, 5000),
              mm('y', 'Axis Y', 0, -5000, 5000),
              mm('z', 'Axis Z', 0, -5000, 5000),
            ],
          ),
          featureTool(
            'mirror',
            'Mirror',
            FlipHorizontal2,
            'Mirror the body or the last feature about a plane.',
            [
              pick('plane', 'Mirror plane', 'Right', PLANES),
              pick('target', 'Mirror', 'Body', ['Body', 'Last feature']),
            ],
          ),
        ],
      },
      {
        label: 'Reference',
        tools: [
          featureTool('plane', 'Plane', Square, 'Add a reference plane offset from a base plane.', [
            pick('base', 'Offset from', 'Top', PLANES),
            mm('offset', 'Offset distance', 25, -5000, 5000),
          ]),
          {
            id: 'import:mesh',
            label: 'Mesh Body',
            icon: FileUp,
            hint: 'Insert an STL file as a body in the history.',
          },
        ],
      },
      {
        label: 'Edit',
        tools: [
          {
            id: 'edit:feature',
            label: 'Edit Feature',
            icon: Pencil,
            hint: 'Change the selected feature’s parameters.',
            shortcut: 'Ctrl+E',
          },
          {
            id: 'edit:sketch',
            label: 'Edit Sketch',
            icon: PenTool,
            hint: 'Open the selected sketch, or the selected feature’s sketch, in the sketcher.',
          },
          {
            id: 'suppress',
            label: 'Suppress',
            icon: EyeOff,
            hint: 'Suppress or unsuppress the selected feature.',
          },
          {
            id: 'delete',
            label: 'Delete',
            icon: Trash2,
            hint: 'Delete the selected feature or sketch.',
            shortcut: 'Del',
          },
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
          {
            id: 'sketch:new',
            label: 'Sketch',
            icon: PenTool,
            hint: 'Start a free sketch on a plane and draw it in the sketcher.',
            params: [
              pick('plane', 'Sketch plane', 'Top', PLANES),
              mm(
                'offset',
                'Offset from plane',
                0,
                -5000,
                5000,
                'Starts at the top of the material.',
              ),
              mm('grid', 'Snap grid', 1, 0, 100, '0 turns grid snapping off.'),
            ],
          },
          {
            id: 'edit:sketch',
            label: 'Edit Sketch',
            icon: Pencil,
            hint: 'Open the selected sketch in the sketcher.',
          },
        ],
      },
      {
        label: 'Quick shapes',
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
            hint: 'Select an entity in the sketcher and type its size in the dimensions box.',
          },
          {
            id: 'noop:offset',
            label: 'Offset Entities',
            icon: Hexagon,
            hint: 'In the sketcher: select a closed entity, set the distance, press Offset.',
          },
          {
            id: 'noop:mirrorsk',
            label: 'Mirror Entities',
            icon: FlipHorizontal2,
            hint: 'In the sketcher: select an entity and press one of the mirror buttons.',
          },
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
            hint: 'Volume, mass, surface area, and centre of mass from the body and its material.',
          },
          {
            id: 'report:measure',
            label: 'Measure',
            icon: Ruler,
            hint: 'Overall size of the body and of the selected feature.',
          },
          {
            id: 'view:section',
            label: 'Section View',
            icon: ScanLine,
            hint: 'Cut the body with a plane and cap the cut.',
            params: [
              pick('plane', 'Section plane', 'Front', PLANES),
              mm(
                'position',
                'Position',
                0,
                -5000,
                5000,
                'Offset of the section plane from the base plane.',
              ),
              flag('flip', 'Flip side', false),
            ],
          },
          {
            id: 'report:check',
            label: 'Check',
            icon: ShieldCheck,
            hint: 'Count triangles and open edges in the body.',
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
            hint: 'Place this part on the build plate of the project’s slicer.',
          },
          {
            id: 'export:stl',
            label: 'Export STL',
            icon: Box,
            hint: 'Download the body as a binary STL mesh.',
          },
          {
            id: 'export:3mf',
            label: 'Export 3MF',
            icon: Boxes,
            hint: 'Download the body as a 3MF file with its colour.',
          },
          {
            id: 'export:obj',
            label: 'Export OBJ',
            icon: Cuboid,
            hint: 'Download the body as a Wavefront OBJ file.',
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
            params: [pick('material', 'Material', MATERIALS[0], MATERIALS)],
          },
          {
            id: 'set:color',
            label: 'Edit Appearance',
            icon: Palette,
            hint: 'Body colour in the viewport.',
            params: [{ id: 'color', label: 'Colour', kind: 'color', default: '#9aa7b4' }],
          },
          {
            id: 'set:featurecolor',
            label: 'Feature Colour',
            icon: Palette,
            hint: 'Colour the selected feature’s faces.',
            params: [
              { id: 'color', label: 'Colour', kind: 'color', default: '#e0a33b' },
              flag('clear', 'Use the body colour', false),
            ],
          },
          {
            id: 'set:units',
            label: 'Units',
            icon: Ruler,
            params: [pick('units', 'Unit system', 'mm', ['mm', 'in'])],
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
      { label: 'Open Part (JSON)…', shortcut: 'Ctrl+O', command: 'import:json' },
      { label: 'Save', shortcut: 'Ctrl+S', command: 'save' },
      'separator',
      { label: 'Insert Mesh Body (STL)…', command: 'import:mesh' },
      'separator',
      { label: 'Export Part (JSON)…', command: 'export:json' },
      { label: 'Export STL…', command: 'export:stl' },
      { label: 'Export 3MF…', command: 'export:3mf' },
      { label: 'Export OBJ…', command: 'export:obj' },
      { label: 'Send to Slicer', command: 'send:slicer' },
    ],
  },
  {
    label: 'Edit',
    items: [
      { label: 'Undo', shortcut: 'Ctrl+Z', command: 'undo' },
      { label: 'Redo', shortcut: 'Ctrl+Y', command: 'redo' },
      'separator',
      { label: 'Edit Feature', shortcut: 'Ctrl+E', command: 'edit:feature' },
      { label: 'Edit Sketch', command: 'edit:sketch' },
      { label: 'Rename', shortcut: 'F2', command: 'rename' },
      { label: 'Move Up', command: 'move:up' },
      { label: 'Move Down', command: 'move:down' },
      'separator',
      { label: 'Rebuild', shortcut: 'Ctrl+B', command: 'rebuild' },
      { label: 'Roll Back to Selected', command: 'rollback' },
      { label: 'Roll to End', command: 'rollforward' },
      { label: 'Suppress / Unsuppress', command: 'suppress' },
      { label: 'Delete', shortcut: 'Del', command: 'delete' },
    ],
  },
  {
    label: 'View',
    items: [
      ...ORIENTATIONS.map((o) => ({
        label: o[0].toUpperCase() + o.slice(1),
        command: `view:${o}`,
      })),
      'separator',
      { label: 'Zoom to Fit', shortcut: 'F', command: 'fit' },
      'separator',
      { label: 'Shaded With Edges', command: 'style:shadedEdges' },
      { label: 'Shaded', command: 'style:shaded' },
      { label: 'Wireframe', command: 'style:wireframe' },
      { label: 'Hidden Lines Visible', command: 'style:hidden' },
      'separator',
      { label: 'Planes', command: 'toggle:planes' },
      { label: 'Origin', command: 'toggle:origin' },
      { label: 'Section View', command: 'toggle:section' },
    ],
  },
  {
    label: 'Insert',
    items: [
      { label: 'Sketch', command: 'tool:sketch:new' },
      { label: 'Boss/Base › Extrude', command: 'tool:feature:extrude' },
      { label: 'Boss/Base › Revolve', command: 'tool:feature:revolve' },
      { label: 'Boss/Base › Loft', command: 'tool:feature:loft' },
      { label: 'Boss/Base › Sweep', command: 'tool:feature:sweep' },
      { label: 'Cut › Extrude', command: 'tool:feature:cut' },
      { label: 'Cut › Revolve', command: 'tool:feature:revolvecut' },
      { label: 'Cut › Hole Wizard', command: 'tool:feature:hole' },
      { label: 'Features › Fillet', command: 'tool:feature:fillet' },
      { label: 'Features › Chamfer', command: 'tool:feature:chamfer' },
      { label: 'Features › Shell', command: 'tool:feature:shell' },
      { label: 'Pattern › Linear', command: 'tool:feature:pattern' },
      { label: 'Pattern › Circular', command: 'tool:feature:circular' },
      { label: 'Pattern › Mirror', command: 'tool:feature:mirror' },
      { label: 'Reference Geometry › Plane', command: 'tool:feature:plane' },
      { label: 'Mesh Body…', command: 'import:mesh' },
    ],
  },
  {
    label: 'Tools',
    items: [
      { label: 'Measure', command: 'report:measure' },
      { label: 'Mass Properties', command: 'report:mass' },
      { label: 'Check', command: 'report:check' },
      'separator',
      { label: 'Rebuild Everything', command: 'rebuild:all' },
    ],
  },
  {
    label: 'Help',
    items: [
      { label: 'About the modeler', command: 'about' },
      { label: 'Keyboard shortcuts', command: 'shortcuts' },
    ],
  },
]
const SHORTCUTS: Record<string, string> = {
  'Ctrl+Z': 'undo',
  'Ctrl+Y': 'redo',
  'Ctrl+Shift+Z': 'redo',
  'Ctrl+E': 'edit:feature',
  'Ctrl+B': 'rebuild',
  Del: 'delete',
  F2: 'rename',
}
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
  { id: 'toggle:section', label: 'Section View', icon: ScanLine },
  { id: 'toggle:planes', label: 'Planes', icon: Eye },
  { id: 'rotate', label: 'Rotate view (cycles the standard views)', icon: Rotate3d },
]
const allTools = RIBBON.flatMap((t) => t.groups.flatMap((g) => g.tools))
const findTool = (id: string) => allTools.find((t) => t.id === id) ?? null
const toolForFeature = (f: Feature) =>
  f.type === 'revolve' && f.params.cut === true
    ? findTool('feature:revolvecut')
    : findTool(`feature:${f.type}`)

/** The FeatureManager tree derived from the document. */
function featureTree(
  doc: ModelerDocument,
  part: Part,
  title: string,
  rollback: number | null,
): TreeNode[] {
  const children: TreeNode[] = [
    { id: 'material', label: doc.material, icon: Boxes, badge: doc.units },
    { id: 'plane:Front', label: 'Front Plane', icon: Square, suppressed: !doc.view.showPlanes },
    { id: 'plane:Top', label: 'Top Plane', icon: Square, suppressed: !doc.view.showPlanes },
    { id: 'plane:Right', label: 'Right Plane', icon: Square, suppressed: !doc.view.showPlanes },
    { id: 'origin', label: 'Origin', icon: Axis3d, suppressed: !doc.view.showOrigin },
  ]
  const consumed = new Set(
    doc.features
      .flatMap((f) => [f.sketchId, f.params.sketch2, f.params.pathSketch])
      .filter(Boolean),
  )
  const sketchNode = (s: Sketch): TreeNode => ({
    id: `sketch:${s.id}`,
    label: s.name,
    icon: Diameter,
    badge: s.entities ? `${s.plane} · ${s.entities.length}` : s.plane,
    kind: 'sketch',
    error: !sketchRegionsOf(s).length,
    title: sketchRegionsOf(s).length ? undefined : 'This sketch does not enclose a closed region.',
  })
  for (const s of doc.sketches) if (!consumed.has(s.id)) children.push(sketchNode(s))
  doc.features.forEach((f, i) => {
    const sketches = [f.sketchId, f.params.sketch2, f.params.pathSketch]
      .map((id) => doc.sketches.find((s) => s.id === id))
      .filter((s): s is Sketch => !!s)
    const rolled = rollback !== null && i >= rollback
    const error = part.errors[f.id]
    children.push({
      id: `feature:${f.id}`,
      label: f.name,
      icon: featureIcon(f.type),
      suppressed: f.suppressed || rolled,
      badge: rolled ? 'rolled back' : error ? 'error' : featureSummary(f),
      error: !!error,
      title: error ?? undefined,
      kind: 'feature',
      children: sketches.length ? sketches.map(sketchNode) : undefined,
    })
  })
  return [{ id: 'part', label: title, icon: Box, children }]
}
const featureIcon = (type: FeatureType) =>
  ({
    extrude: Cuboid,
    cut: Crop,
    revolve: Cylinder,
    loft: Waves,
    sweep: PenTool,
    fillet: Radius,
    chamfer: Triangle,
    hole: Drill,
    shell: Layers,
    mirror: FlipHorizontal2,
    pattern: Copy,
    circular: Orbit,
    mesh: FileUp,
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
const DEFAULT_EXTENT = extrude(profile('rectangle', 120, 120), frames.Top(), 0, 40)
export type SectionState = { on: boolean; axis: 'x' | 'y' | 'z'; at: number; flip: boolean }
const AXIS_OF: Record<Plane, 'x' | 'y' | 'z'> = { Front: 'y', Top: 'z', Right: 'x' }
const tint = (hex: string, toward: string, t: number) => {
  const a = parseInt(hex.slice(1), 16)
  const b = parseInt(toward.slice(1), 16)
  const ch = (shift: number) =>
    Math.round(((a >> shift) & 255) * (1 - t) + ((b >> shift) & 255) * t)
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`
}

/** The viewport: grid, planes, sketches, the body with feature colours, section, and highlight. */
export const ModelerViewport = forwardRef<
  ViewportHandle,
  {
    document: ModelerDocument
    part?: Part
    selectedFeature: string | null
    selectedSketch?: string | null
    section: boolean | SectionState
    onPick?: (featureId: string | null) => void
  }
>(function ModelerViewport(
  { document: doc, part: given, selectedFeature, selectedSketch, section, onPick },
  ref,
) {
  const part = useMemo(() => given ?? derive(doc), [given, doc])
  const style = doc.view.style
  const wire = style === 'wireframe' || style === 'hidden'
  const sectionState: SectionState =
    typeof section === 'boolean' ? { on: section, axis: 'y', at: 0, flip: false } : section
  const body = useMemo(
    () =>
      sectionState.on
        ? sectionOf(part.body, sectionState.axis, sectionState.at, !sectionState.flip)
        : part.body,
    [part, sectionState.on, sectionState.axis, sectionState.at, sectionState.flip],
  )
  const extent = body.mesh.length
    ? body.mesh
    : part.body.mesh.length
      ? part.body.mesh
      : DEFAULT_EXTENT
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
  const featureColor = new Map(
    doc.features.map((f) => [
      f.id,
      typeof f.params.color === 'string' && /^#[0-9a-f]{6}$/i.test(f.params.color)
        ? f.params.color
        : doc.color,
    ]),
  )
  const colors = body.tags.map((tag) => {
    const base = featureColor.get(tag) ?? doc.color
    return tag === selectedFeature ? tint(base, '#2f6fed', 0.55) : base
  })
  if (body.mesh.length)
    items.push({
      kind: 'mesh',
      id: 'body',
      ids: body.tags.map((t) => `feature:${t}`),
      mesh: body.mesh,
      fill: doc.color,
      colors,
      wire,
      dashed: style === 'hidden',
      stroke: style === 'shaded' ? null : 'rgba(20,30,40,0.55)',
    })
  // Sketches: their loops on their planes, the selected one highlighted, consumed ones faint.
  const consumed = new Set(
    doc.features.flatMap((f) => [f.sketchId, f.params.sketch2, f.params.pathSketch]),
  )
  for (const s of doc.sketches) {
    const frame = sketchFrame(s, part.planes)
    const loops = sketchRegionsOf(s).flatMap((r) => [r.outer, ...r.holes])
    const at = (p: { x: number; y: number }): Vec3 =>
      vec(
        frame.origin.x + frame.u.x * p.x + frame.v.x * p.y,
        frame.origin.y + frame.u.y * p.x + frame.v.y * p.y,
        frame.origin.z + frame.u.z * p.x + frame.v.z * p.y,
      )
    const selected = selectedSketch === s.id
    if (!selected && consumed.has(s.id)) continue
    items.push({
      kind: 'lines',
      polylines: loops.map((l) => [...l, l[0]].map(at)),
      stroke: selected ? '#2f6fed' : 'rgba(30,60,120,0.8)',
      width: selected ? 2 : 1.2,
      layer: 'over',
    })
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
  const errors = Object.keys(part.errors).length
  return (
    <Viewport3D
      ref={ref}
      items={items}
      fitTo={extent}
      initialView={doc.view.orientation as ViewName}
      label={`Model with ${count} ${count === 1 ? 'solid' : 'solids'}`}
      onPick={onPick ? (id) => onPick(id?.startsWith('feature:') ? id.slice(8) : null) : undefined}
    >
      <div className="wb-viewport-note">
        {count
          ? `${count} ${count === 1 ? 'feature' : 'features'} built · ${triangleCount(body.mesh).toLocaleString()} triangles · ${doc.view.style}${
              errors ? ` · ${errors} ${errors === 1 ? 'error' : 'errors'}` : ''
            }${part.approximate ? ' · stacked (past the boolean budget)' : ''}`
          : 'No features yet. Draw a sketch, then extrude it.'}
      </div>
    </Viewport3D>
  )
})

type History = { past: ModelerDocument[]; future: ModelerDocument[] }
type Editing = { sketchId: string; original: SketchEntity[] | undefined; grid: number }

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
  const stlInput = useRef<HTMLInputElement>(null)
  const jsonInput = useRef<HTMLInputElement>(null)
  const [rollback, setRollback] = useState<number | null>(null)
  const part = useMemo(() => derive(doc, { upTo: rollback ?? undefined }), [doc, rollback])
  const [tool, setTool] = useState<ToolDef | null>(null)
  const [editingFeature, setEditingFeature] = useState<string | null>(null)
  const [values, setValues] = useState<Record<string, ParamValue>>({})
  const [selected, setSelected] = useState<string | null>('part')
  const [section, setSection] = useState<SectionState>({ on: false, axis: 'y', at: 0, flip: false })
  const [report, setReport] = useState<ReactNode>(null)
  const [message, setMessage] = useState('')
  const [history, setHistory] = useState<History>({ past: [], future: [] })
  const [editing, setEditing] = useState<Editing | null>(null)

  const apply = (next: ModelerDocument, record = true) => {
    if (readOnly) return false
    if (!validModeler(next)) {
      setMessage('That change could not be saved; the part may be too large to store.')
      return false
    }
    if (record) setHistory((h) => ({ past: [...h.past.slice(-49), doc], future: [] }))
    return onChange(next)
  }
  const selectedFeature = selected?.startsWith('feature:') ? selected.slice(8) : null
  const feature = doc.features.find((f) => f.id === selectedFeature) ?? null
  const selectedSketch = selected?.startsWith('sketch:')
    ? selected.slice(7)
    : (feature?.sketchId ??
      doc.sketches.find((s) => !doc.features.some((f) => f.sketchId === s.id))?.id ??
      null)
  const sketch = doc.sketches.find((s) => s.id === selectedSketch) ?? null
  const bodyBounds = () => bounds(part.body.mesh)

  // --- Tools ---
  /** Fill the selects that list features, sketches, or meshes by name. */
  const withOptions = (t: ToolDef, editingId: string | null): ToolDef => ({
    ...t,
    params: t.params?.map((p) => {
      const kind = NAMED_PARAMS[p.id]
      if (!kind) return p
      const before = editingId
        ? doc.features.findIndex((f) => f.id === editingId)
        : doc.features.length
      const options =
        kind === 'feature'
          ? doc.features
              .slice(0, before < 0 ? undefined : before)
              .filter((f) => BOSSES.includes(f.type) || CUTS.includes(f.type))
              .map((f) => f.name)
          : kind === 'sketch'
            ? doc.sketches.filter((s) => s.id !== selectedSketch).map((s) => s.name)
            : (doc.meshes ?? []).map((m) => m.name)
      return { ...p, options, default: options.at(-1) ?? '' }
    }),
  })
  const nameToId = (key: string, name: string): string => {
    const kind = NAMED_PARAMS[key]
    if (kind === 'feature') return doc.features.find((f) => f.name === name)?.id ?? ''
    if (kind === 'sketch') return doc.sketches.find((s) => s.name === name)?.id ?? ''
    return doc.meshes?.find((m) => m.name === name)?.id ?? ''
  }
  const idToName = (key: string, id: unknown): string => {
    const kind = NAMED_PARAMS[key]
    if (kind === 'feature') return doc.features.find((f) => f.id === id)?.name ?? ''
    if (kind === 'sketch') return doc.sketches.find((s) => s.id === id)?.name ?? ''
    return doc.meshes?.find((m) => m.id === id)?.name ?? ''
  }
  /** Tools with parameters open the property panel; the rest run as commands at once. */
  function startTool(t: ToolDef, edit: Feature | null = null) {
    if (!t.params) {
      command(t.id)
      return
    }
    if (t.needs === 'sketch' && !sketch) {
      setMessage('Select or create a sketch first; the Sketch tab draws one on a plane.')
      setTab('sketch')
      return
    }
    if (t.needs === 'sketch' && sketch && !sketchRegionsOf(sketch).length) {
      setMessage(
        `${sketch.name} does not enclose a closed region yet. Edit the sketch to close it.`,
      )
      return
    }
    const ready = withOptions(t, edit?.id ?? null)
    setReport(null)
    setTool(ready)
    setEditingFeature(edit?.id ?? null)
    const defaults = Object.fromEntries((ready.params ?? []).map((p) => [p.id, p.default]))
    if (t.id.startsWith('sketch:')) defaults.offset = topAlong(String(defaults.plane) as Plane)
    if (edit)
      for (const p of ready.params ?? [])
        if (p.id in edit.params)
          defaults[p.id] = NAMED_PARAMS[p.id]
            ? idToName(p.id, edit.params[p.id])
            : edit.params[p.id]
    if (t.id === 'set:material') defaults.material = doc.material
    if (t.id === 'set:color') defaults.color = doc.color
    if (t.id === 'set:units') defaults.units = doc.units
    if (t.id === 'set:featurecolor' && feature && typeof feature.params.color === 'string')
      defaults.color = feature.params.color
    if (t.id === 'view:section') {
      defaults.plane =
        (Object.keys(AXIS_OF) as Plane[]).find((p) => AXIS_OF[p] === section.axis) ?? 'Front'
      defaults.position = section.at
      defaults.flip = section.flip
    }
    setValues(defaults)
  }
  /** The material's extent along a base plane's normal. */
  function topAlong(plane: Plane): number {
    const b = bodyBounds()
    if (!b) return 0
    return Math.round({ Top: b.max.z, Front: -b.min.y, Right: b.max.x }[plane] * 100) / 100
  }
  function finishTool() {
    if (!tool) return
    const [kind, name] = tool.id.split(':')
    if (kind === 'sketch' && name === 'editing') {
      exitSketch(true)
      return
    }
    if (kind === 'sketch') {
      const plane = String(values.plane) as Plane
      const placement = {
        offset: Number(values.offset) || 0,
        x: Number(values.x) || 0,
        y: Number(values.y) || 0,
      }
      const sk =
        name === 'new'
          ? newSketch(plane, 'rectangle', 1, 1, doc.sketches.length + 1, {
              offset: placement.offset,
              entities: [],
            })
          : newSketch(
              plane,
              name as SketchShape,
              Number(values.width),
              Number(values.height),
              doc.sketches.length + 1,
              {
                ...placement,
                entities: shapeEntities(
                  name as SketchShape,
                  Number(values.width),
                  Number(values.height),
                  placement.x,
                  placement.y,
                ),
              },
            )
      if (name !== 'new') {
        sk.x = 0
        sk.y = 0
      }
      if (apply({ ...doc, sketches: [...doc.sketches, sk] })) {
        setSelected(`sketch:${sk.id}`)
        if (name === 'new') {
          setTool(null)
          enterSketch(sk, Number(values.grid) || 0, [...doc.sketches, sk])
          return
        }
        setTab('features')
        setMessage(
          `${sk.name} added on the ${sk.plane} plane. Extrude it from the Features tab, or edit it in the sketcher.`,
        )
      }
    } else if (kind === 'feature') {
      const type = (name === 'revolvecut' ? 'revolve' : name) as FeatureType
      const params: Feature['params'] = {}
      for (const [k, v] of Object.entries(values))
        params[k] = NAMED_PARAMS[k] ? nameToId(k, String(v)) : v
      if (editingFeature) {
        const next = doc.features.map((f) =>
          f.id === editingFeature ? { ...f, params: { ...f.params, ...params } } : f,
        )
        if (apply({ ...doc, features: next }))
          setMessage(`${doc.features.find((f) => f.id === editingFeature)?.name} updated.`)
      } else {
        const usesSketch = tool.needs === 'sketch'
        const f = newFeature(
          type,
          doc.features.filter((g) => g.type === type).length + 1,
          params,
          usesSketch ? selectedSketch : null,
        )
        if (MODIFIERS.includes(type) && !params.targetId) {
          setMessage('Pick the feature to modify; add an extrusion or a cut first.')
          return
        }
        if (apply({ ...doc, features: insertAt(doc.features, f) })) {
          setSelected(`feature:${f.id}`)
          setRollback(null)
          setMessage(`${f.name} added.`)
        }
      }
    } else if (kind === 'set') {
      if (name === 'material') apply({ ...doc, material: String(values.material) })
      else if (name === 'color') apply({ ...doc, color: String(values.color) })
      else if (name === 'units') apply({ ...doc, units: values.units as 'mm' | 'in' })
      else if (name === 'featurecolor' && feature) {
        const params = { ...feature.params }
        if (values.clear) delete params.color
        else params.color = String(values.color)
        apply({
          ...doc,
          features: doc.features.map((f) => (f.id === feature.id ? { ...f, params } : f)),
        })
      }
    } else if (tool.id === 'view:section') {
      setSection({
        on: true,
        axis: AXIS_OF[String(values.plane) as Plane],
        at: Number(values.position) || 0,
        flip: Boolean(values.flip),
      })
    }
    setTool(null)
    setEditingFeature(null)
  }
  /** New features go after the rollback point when rolled back, else at the end. */
  const insertAt = (features: Feature[], f: Feature) =>
    rollback === null
      ? [...features, f]
      : [...features.slice(0, rollback), f, ...features.slice(rollback)]

  // --- Sketching ---
  const editingTool: ToolDef = {
    id: 'sketch:editing',
    label: 'Sketch',
    icon: PenTool,
    hint: 'Draw in the viewport. OK keeps the sketch; Cancel restores it.',
    params: [
      { id: 'name', label: 'Name', kind: 'text', default: 'Sketch' },
      mm('offset', 'Offset from plane', 0, -5000, 5000),
      mm('grid', 'Snap grid', 1, 0, 100, '0 turns grid snapping off; hold Alt to skip it.'),
    ],
  }
  function enterSketch(s: Sketch, grid = 1, sketches = doc.sketches) {
    if (readOnly) return
    const entities = s.entities ?? shapeEntities(s.shape, s.width, s.height, s.x ?? 0, s.y ?? 0)
    setHistory((h) => ({ past: [...h.past.slice(-49), doc], future: [] }))
    setEditing({ sketchId: s.id, original: s.entities, grid })
    setTool(editingTool)
    setValues({ name: s.name, offset: s.offset ?? 0, grid })
    setSelected(`sketch:${s.id}`)
    setReport(null)
    if (!s.entities)
      onChange({
        ...doc,
        sketches: sketches.map((x) => (x.id === s.id ? { ...x, entities, x: 0, y: 0 } : x)),
      })
  }
  function exitSketch(keep: boolean) {
    if (!editing) return
    const s = doc.sketches.find((x) => x.id === editing.sketchId)
    if (s) {
      const sketches = keep
        ? doc.sketches.map((x) =>
            x.id === s.id
              ? {
                  ...x,
                  name: String(values.name).trim() || x.name,
                  offset: Number(values.offset) || 0,
                }
              : x,
          )
        : doc.sketches.map((x) =>
            x.id === s.id ? { ...x, entities: editing.original ?? x.entities } : x,
          )
      onChange({ ...doc, sketches })
      setMessage(
        keep
          ? `${s.name} kept: ${sketchRegionsOf({ ...s, entities: s.entities }).length} closed region(s).`
          : `${s.name} restored.`,
      )
    }
    setEditing(null)
    setTool(null)
  }
  const editingSketch = editing
    ? (doc.sketches.find((s) => s.id === editing.sketchId) ?? null)
    : null
  const sketchReference = useMemo(() => {
    if (!editingSketch) return []
    const s = { ...editingSketch, offset: Number(values.offset) || 0, x: 0, y: 0 }
    return planeSection(
      derive(doc, { upTo: rollback ?? undefined }).body.mesh,
      sketchFrame(s, part.planes),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingSketch?.id, values.offset, doc.features, rollback])

  // --- Commands ---
  function command(id: string) {
    if (id.startsWith('tool:')) {
      const t = findTool(id.slice(5))
      if (t) startTool(t)
      return
    }
    if (id.startsWith('noop:')) {
      setMessage(findTool(id)?.hint ?? 'This tool is not built yet.')
      return
    }
    if (id.startsWith('report:')) {
      setReport(
        id === 'report:mass' ? (
          <MassReport doc={doc} part={part} />
        ) : id === 'report:check' ? (
          <CheckReport part={part} />
        ) : (
          <MeasureReport doc={doc} part={part} feature={feature} />
        ),
      )
      setTool(null)
      return
    }
    if (id.startsWith('view:')) {
      if (id === 'view:section') startTool(findTool(id)!)
      else look(id.slice(5) as Orientation)
      return
    }
    if (id.startsWith('style:')) {
      apply({ ...doc, view: { ...doc.view, style: id.slice(6) as DisplayStyle } }, false)
      return
    }
    if (id.startsWith('set:') || id.startsWith('feature:') || id.startsWith('sketch:')) {
      const t = findTool(id)
      if (t) startTool(t)
      return
    }
    switch (id) {
      case 'toggle:planes':
        apply({ ...doc, view: { ...doc.view, showPlanes: !doc.view.showPlanes } }, false)
        break
      case 'toggle:origin':
        apply({ ...doc, view: { ...doc.view, showOrigin: !doc.view.showOrigin } }, false)
        break
      case 'toggle:section':
        setSection((s) => ({ ...s, on: !s.on }))
        break
      case 'fit':
        viewport.current?.fit()
        break
      case 'rotate': {
        const views: Orientation[] = ['iso', 'front', 'top', 'right']
        look(views[(views.indexOf(doc.view.orientation) + 1) % views.length])
        break
      }
      case 'undo': {
        const previous = history.past.at(-1)
        if (!previous) return
        setHistory({ past: history.past.slice(0, -1), future: [doc, ...history.future] })
        setEditing(null)
        setTool(null)
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
      case 'rebuild:all': {
        const errors = Object.keys(part.errors).length
        setMessage(
          `Rebuild complete: ${doc.features.filter((f) => !f.suppressed).length} features, ${triangleCount(part.body.mesh).toLocaleString()} triangles${
            errors ? `, ${errors} with errors` : ''
          }.`,
        )
        break
      }
      case 'edit:feature':
        if (feature) {
          const t = toolForFeature(feature)
          if (t?.params) startTool(t, feature)
          else setMessage(`${feature.name} has nothing to edit.`)
        } else setMessage('Select a feature in the tree first.')
        break
      case 'edit:sketch':
        if (sketch) enterSketch(sketch, editing?.grid ?? 1)
        else setMessage('Select a sketch, or a feature with a sketch, first.')
        break
      case 'rename':
        if (feature || (selected?.startsWith('sketch:') && sketch))
          setReport(
            <RenameForm
              name={feature ? feature.name : sketch!.name}
              onRename={rename}
              onClose={() => setReport(null)}
            />,
          )
        else setMessage('Select a feature or sketch to rename.')
        break
      case 'move:up':
      case 'move:down':
        if (feature) {
          const i = doc.features.indexOf(feature)
          const j = id === 'move:up' ? i - 1 : i + 1
          if (j < 0 || j >= doc.features.length) return
          const next = [...doc.features]
          ;[next[i], next[j]] = [next[j], next[i]]
          apply({ ...doc, features: next })
        } else setMessage('Select a feature to move.')
        break
      case 'rollback':
        if (feature) setRollback(doc.features.indexOf(feature))
        else setMessage('Select the feature to roll back to.')
        break
      case 'rollforward':
        setRollback(null)
        break
      case 'suppress':
        if (feature)
          apply({
            ...doc,
            features: doc.features.map((f) =>
              f.id === feature.id ? { ...f, suppressed: !f.suppressed } : f,
            ),
          })
        else setMessage('Select a feature in the tree first.')
        break
      case 'delete':
        if (feature) {
          const orphans = doc.features.filter(
            (f) => MODIFIERS.includes(f.type) && f.params.targetId === feature.id,
          ).length
          apply({ ...doc, features: doc.features.filter((f) => f.id !== feature.id) })
          setSelected('part')
          setRollback(null)
          if (orphans)
            setMessage(
              `${feature.name} deleted; ${orphans} fillet/chamfer/shell feature(s) now need a new target.`,
            )
        } else if (selected?.startsWith('sketch:')) {
          const sid = selected.slice(7)
          if (
            doc.features.some(
              (f) => f.sketchId === sid || f.params.sketch2 === sid || f.params.pathSketch === sid,
            )
          )
            setMessage('Delete the feature that uses this sketch first.')
          else {
            apply({ ...doc, sketches: doc.sketches.filter((s) => s.id !== sid) })
            setSelected('part')
          }
        } else setMessage('Select a feature or sketch in the tree first.')
        break
      case 'new':
        if (doc.features.length || doc.sketches.length) apply({ ...emptyLike(doc) })
        setMessage('A new, empty part. Undo brings the previous one back.')
        break
      case 'save':
        setMessage(
          unsaved
            ? 'Saving is retried automatically; check the workspace save error.'
            : 'Everything is saved as you work.',
        )
        break
      case 'import:json':
        jsonInput.current?.click()
        break
      case 'import:mesh':
        stlInput.current?.click()
        break
      case 'export:json':
        downloadBlob(
          new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' }),
          `${fileBase()}.part.json`,
        )
        break
      case 'export:stl':
        if (!part.body.mesh.length) setMessage('Extrude something before exporting.')
        else downloadBlob(toStl(part.body.mesh, title), `${fileBase()}.stl`)
        break
      case 'export:3mf':
        if (!part.body.mesh.length) setMessage('Extrude something before exporting.')
        else
          downloadBlob(
            toThreeMf([{ name: title, mesh: part.body.mesh, color: doc.color }], title),
            `${fileBase()}.3mf`,
          )
        break
      case 'export:obj':
        if (!part.body.mesh.length) setMessage('Extrude something before exporting.')
        else
          downloadBlob(
            new Blob([toObj([{ name: title, mesh: part.body.mesh }], title)], {
              type: 'model/obj',
            }),
            `${fileBase()}.obj`,
          )
        break
      case 'send:slicer':
        sendToSlicer()
        break
      case 'about':
        setMessage(
          'A SolidWorks-shaped modeler: sketches, features, and real booleans rebuild one closed body; fillets, chamfers, and shells are real geometry.',
        )
        break
      case 'shortcuts':
        setMessage(
          'Ctrl+Z/Y undo and redo · Ctrl+E edit feature · Del delete · F2 rename · viewport: drag orbit, shift-drag pan, wheel zoom, F fit · sketcher: L R C A P O tools, Esc/Enter finish a line.',
        )
        break
      default:
        break
    }
  }
  const fileBase = () => safeFilename(title) || 'part'
  const emptyLike = (d: ModelerDocument): ModelerDocument => ({
    ...d,
    sketches: [],
    features: [],
    meshes: undefined,
    notes: '',
  })
  function rename(name: string) {
    const clean = name.trim().slice(0, 60)
    if (!clean) return
    if (feature)
      apply({
        ...doc,
        features: doc.features.map((f) => (f.id === feature.id ? { ...f, name: clean } : f)),
      })
    else if (sketch)
      apply({
        ...doc,
        sketches: doc.sketches.map((s) => (s.id === sketch.id ? { ...s, name: clean } : s)),
      })
    setReport(null)
  }
  /** Turn the camera to a standard view and remember it with the document. */
  function look(orientation: Orientation) {
    viewport.current?.look(orientation as ViewName)
    if (orientation !== doc.view.orientation)
      apply({ ...doc, view: { ...doc.view, orientation } }, false)
  }
  async function importStl(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const raw = parseStl(await file.arrayBuffer())
      const mesh = compact(settle(decimate(raw, MAX_MESH_TRIANGLES)))
      const body = {
        id: newId(),
        name: file.name.replace(/\.stl$/i, '').slice(0, 80) || 'Mesh',
        mesh,
      }
      const f = newFeature('mesh', (doc.meshes?.length ?? 0) + 1, {
        meshId: body.id,
        x: 0,
        y: 0,
        z: 0,
        scale: 1,
      })
      if (
        apply({
          ...doc,
          meshes: [...(doc.meshes ?? []), body],
          features: insertAt(doc.features, f),
        })
      ) {
        setSelected(`feature:${f.id}`)
        setMessage(
          `${body.name} inserted (${triangleCount(mesh).toLocaleString()} triangles${triangleCount(raw) > triangleCount(mesh) ? `, simplified from ${triangleCount(raw).toLocaleString()}` : ''}).`,
        )
      } else setMessage('That mesh is too large to store in the part.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'That file could not be read.')
    }
  }
  async function importJson(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const parsed: unknown = JSON.parse(await file.text())
      if (!validModeler(parsed)) throw new Error('That file is not a Junga part.')
      if (apply(parsed)) {
        setSelected('part')
        setRollback(null)
        setMessage(`${file.name} opened: ${parsed.features.length} features.`)
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'That file could not be read.')
    }
  }
  /** Put the part on the project's slicer plate; both modules live on the same project. */
  function sendToSlicer() {
    if (!related?.tools.includes('slicer')) {
      setMessage('Add the Slicer tool to this project to send parts to it.')
      return
    }
    if (!part.body.mesh.length) {
      setMessage('Extrude something before sending the part to the slicer.')
      return
    }
    const slicer = related.get('slicer')
    const plate = activePlate(slicer)
    const object = meshObject(
      title,
      compact(settle(decimate(part.body.mesh, 4000))),
      plate.objects.length,
    )
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
    else setMessage('The part is too detailed for the slicer’s storage budget.')
  }

  const tree = useMemo(() => featureTree(doc, part, title, rollback), [doc, part, title, rollback])
  const mass = useMemo(() => massProperties(doc, part), [doc, part])
  const errors = Object.keys(part.errors).length
  const activeViewTools = [
    `view:${doc.view.orientation}`,
    `style:${doc.view.style}`,
    ...(section.on ? ['toggle:section'] : []),
    ...(doc.view.showPlanes ? ['toggle:planes'] : []),
  ]
  const detail = (
    <div className="wb-panel">
      {feature ? (
        <>
          <div className="wb-panel-title">{feature.name}</div>
          <div className="wb-stat">
            <span>Type</span>
            <strong>{FEATURE_LABELS[feature.type]}</strong>
          </div>
          {Object.entries(feature.params)
            .filter(([k]) => k !== 'color')
            .slice(0, 12)
            .map(([k, v]) => (
              <div className="wb-stat" key={k}>
                <span>{NAMED_PARAMS[k] ? k.replace('Id', '') : k}</span>
                <strong>
                  {NAMED_PARAMS[k]
                    ? idToName(k, v) || '—'
                    : typeof v === 'boolean'
                      ? v
                        ? 'yes'
                        : 'no'
                      : String(v)}
                </strong>
              </div>
            ))}
          {part.errors[feature.id] && (
            <p className="wb-hint" style={{ color: '#c0392b' }}>
              {part.errors[feature.id]}
            </p>
          )}
          {!readOnly && (
            <div className="wb-toolbar-row">
              {toolForFeature(feature)?.params && (
                <button
                  type="button"
                  className="wb-button primary"
                  onClick={() => command('edit:feature')}
                >
                  <Pencil size={12} /> Edit
                </button>
              )}
              {feature.sketchId && (
                <button type="button" className="wb-button" onClick={() => command('edit:sketch')}>
                  <PenTool size={12} /> Sketch
                </button>
              )}
              <button type="button" className="wb-button" onClick={() => command('suppress')}>
                {feature.suppressed ? 'Unsuppress' : 'Suppress'}
              </button>
              <button
                type="button"
                className="wb-button"
                onClick={() => command('move:up')}
                aria-label="Move up"
              >
                <ArrowUp size={12} />
              </button>
              <button
                type="button"
                className="wb-button"
                onClick={() => command('move:down')}
                aria-label="Move down"
              >
                <ArrowDown size={12} />
              </button>
              <button type="button" className="wb-button" onClick={() => command('delete')}>
                <Trash2 size={12} /> Delete
              </button>
            </div>
          )}
        </>
      ) : selected?.startsWith('sketch:') && sketch ? (
        <>
          <div className="wb-panel-title">{sketch.name}</div>
          <div className="wb-stat">
            <span>Plane</span>
            <strong>
              {sketch.plane}
              {sketch.offset ? ` + ${sketch.offset} mm` : ''}
            </strong>
          </div>
          <div className="wb-stat">
            <span>Entities</span>
            <strong>{sketch.entities?.length ?? 1}</strong>
          </div>
          <div className="wb-stat">
            <span>Closed regions</span>
            <strong>{sketchRegionsOf(sketch).length}</strong>
          </div>
          {!readOnly && (
            <div className="wb-toolbar-row">
              <button
                type="button"
                className="wb-button primary"
                onClick={() => command('edit:sketch')}
              >
                <PenTool size={12} /> Edit sketch
              </button>
              <button
                type="button"
                className="wb-button"
                onClick={() => command('feature:extrude')}
              >
                Extrude
              </button>
              <button type="button" className="wb-button" onClick={() => command('feature:cut')}>
                Cut
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="wb-panel-title">{title}</div>
          <div className="wb-stat">
            <span>Features</span>
            <strong>
              {doc.features.length} · {doc.sketches.length} sketches
            </strong>
          </div>
          <div className="wb-stat">
            <span>Size</span>
            <strong>
              {mass.size.x.toFixed(1)} × {mass.size.y.toFixed(1)} × {mass.size.z.toFixed(1)}{' '}
              {doc.units}
            </strong>
          </div>
          <div className="wb-stat">
            <span>Mass</span>
            <strong>{mass.mass.toFixed(1)} g</strong>
          </div>
          <div className="wb-stat">
            <span>Rebuild</span>
            <strong>{errors ? `${errors} error(s)` : part.approximate ? 'stacked' : 'OK'}</strong>
          </div>
          <p className="wb-hint">
            Click a face in the viewport or a row in the tree to select its feature; double-click a
            feature to edit it.
          </p>
        </>
      )}
      {section.on && (
        <>
          <div className="wb-panel-title">Section</div>
          <label className="wb-field">
            <span>
              Position ({section.axis.toUpperCase()} = {section.at} mm)
            </span>
            <input
              type="range"
              className="wb-range"
              min={-200}
              max={200}
              step={0.5}
              value={section.at}
              onChange={(e) => setSection((s) => ({ ...s, at: Number(e.target.value) }))}
            />
          </label>
          <div className="wb-toolbar-row">
            <button
              type="button"
              className="wb-button"
              onClick={() => setSection((s) => ({ ...s, flip: !s.flip }))}
            >
              Flip
            </button>
            <button
              type="button"
              className="wb-button"
              onClick={() => setSection((s) => ({ ...s, on: false }))}
            >
              Close section
            </button>
          </div>
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
          <div className="eyebrow">3D MODELER</div>
          <h1>{title}</h1>
        </div>
        <div className="canvas-heading-actions">
          {unsaved && <span className="unsaved-note">Changes not saved</span>}
          <span className="unsaved-note">Feature history rebuilt with real booleans</span>
        </div>
      </div>
      <input
        ref={stlInput}
        type="file"
        accept=".stl,model/stl"
        hidden
        aria-label="Insert an STL mesh body"
        onChange={importStl}
      />
      <input
        ref={jsonInput}
        type="file"
        accept=".json,application/json"
        hidden
        aria-label="Open a part file"
        onChange={importJson}
      />
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
          onActivate: (id) => {
            setSelected(id)
            const f = doc.features.find((x) => `feature:${x.id}` === id)
            const s = doc.sketches.find((x) => `sketch:${x.id}` === id)
            if (f) {
              const t = toolForFeature(f)
              if (t?.params) startTool(t, f)
            } else if (s) enterSketch(s)
          },
          panel: report,
        }}
        activeTool={tool}
        toolValues={values}
        onToolValue={(id, value) => setValues((v) => ({ ...v, [id]: value }))}
        onToolOk={finishTool}
        onToolCancel={() => {
          if (editing) exitSketch(false)
          else {
            setTool(null)
            setEditingFeature(null)
          }
        }}
        onTool={startTool}
        onCommand={command}
        shortcuts={SHORTCUTS}
        viewport={
          editingSketch ? (
            <SketchEditor
              entities={editingSketch.entities ?? []}
              onChange={(entities) =>
                onChange({
                  ...doc,
                  sketches: doc.sketches.map((s) =>
                    s.id === editingSketch.id ? { ...s, entities } : s,
                  ),
                })
              }
              reference={sketchReference}
              planeLabel={editingSketch.plane}
              grid={Number(values.grid) || 0}
              readOnly={readOnly}
            />
          ) : (
            <ModelerViewport
              ref={viewport}
              document={doc}
              part={part}
              selectedFeature={selectedFeature}
              selectedSketch={selected?.startsWith('sketch:') ? selected.slice(7) : null}
              section={section}
              onPick={(id) => {
                setSelected(id ? `feature:${id}` : 'part')
                setReport(null)
              }}
            />
          )
        }
        viewToolbar={editingSketch ? undefined : VIEW_TOOLS}
        onViewTool={command}
        activeViewTools={activeViewTools}
        rightPanel={detail}
        status={[
          {
            id: 'mode',
            text: editingSketch
              ? `Editing ${editingSketch.name}`
              : readOnly
                ? 'Viewing Part'
                : 'Editing Part',
          },
          { id: 'units', text: doc.units === 'mm' ? 'MMGS' : 'IPS', icon: Ruler },
          {
            id: 'features',
            text: `${doc.features.length} features · ${doc.sketches.length} sketches`,
          },
          { id: 'mass', text: `${mass.mass.toFixed(1)} g`, icon: Weight },
          {
            id: 'rebuild',
            text: errors
              ? `${errors} rebuild error(s)`
              : rollback !== null
                ? `Rolled back to ${rollback}`
                : 'Rebuild OK',
            icon: errors ? CircleDot : undefined,
          },
        ]}
        message={message}
        readOnly={readOnly}
      />
    </div>
  )
}

function MassReport({ doc, part }: { doc: ModelerDocument; part: Part }) {
  const m = massProperties(doc, part)
  const u = doc.units
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
          {m.volume.toLocaleString(undefined, { maximumFractionDigits: 0 })} {u}³
        </strong>
      </div>
      <div className="wb-stat">
        <span>Mass</span>
        <strong>{m.mass.toFixed(2)} g</strong>
      </div>
      <div className="wb-stat">
        <span>Surface area</span>
        <strong>
          {m.area.toLocaleString(undefined, { maximumFractionDigits: 0 })} {u}²
        </strong>
      </div>
      <div className="wb-stat">
        <span>Centre of mass</span>
        <strong>
          {m.centroid.x.toFixed(1)}, {m.centroid.y.toFixed(1)}, {m.centroid.z.toFixed(1)}
        </strong>
      </div>
      <div className="wb-stat">
        <span>Features built</span>
        <strong>{m.solids}</strong>
      </div>
      <p className="wb-hint">
        Computed from the closed body: cuts, holes, and shells are real removals.
      </p>
    </div>
  )
}
function MeasureReport({
  doc,
  part,
  feature,
}: {
  doc: ModelerDocument
  part: Part
  feature: Feature | null
}) {
  const { size } = massProperties(doc, part)
  const own = feature
    ? bounds(part.solids.find((s) => s.featureId === feature.id)?.mesh ?? [])
    : null
  return (
    <div>
      <div className="wb-panel-title">Measure</div>
      <div className="wb-stat">
        <span>Body</span>
        <strong>
          {size.x.toFixed(2)} × {size.y.toFixed(2)} × {size.z.toFixed(2)} {doc.units}
        </strong>
      </div>
      {feature && own && (
        <>
          <div className="wb-stat">
            <span>{feature.name}</span>
            <strong>
              {(own.max.x - own.min.x).toFixed(2)} × {(own.max.y - own.min.y).toFixed(2)} ×{' '}
              {(own.max.z - own.min.z).toFixed(2)}
            </strong>
          </div>
          <div className="wb-stat">
            <span>From</span>
            <strong>
              {own.min.x.toFixed(1)}, {own.min.y.toFixed(1)}, {own.min.z.toFixed(1)}
            </strong>
          </div>
          <div className="wb-stat">
            <span>To</span>
            <strong>
              {own.max.x.toFixed(1)}, {own.max.y.toFixed(1)}, {own.max.z.toFixed(1)}
            </strong>
          </div>
        </>
      )}
      <p className="wb-hint">
        Overall extents of the finished body, and of the selected feature’s own solid.
      </p>
    </div>
  )
}
function CheckReport({ part }: { part: Part }) {
  const c = checkMesh(part.body.mesh)
  return (
    <div>
      <div className="wb-panel-title">Check</div>
      <div className="wb-stat">
        <span>Triangles</span>
        <strong>{c.triangles.toLocaleString()}</strong>
      </div>
      <div className="wb-stat">
        <span>Edges</span>
        <strong>{c.edges.toLocaleString()}</strong>
      </div>
      <div className="wb-stat">
        <span>Unshared edges</span>
        <strong>{c.open.toLocaleString()}</strong>
      </div>
      <div className="wb-stat">
        <span>Errors</span>
        <strong>{Object.keys(part.errors).length}</strong>
      </div>
      <p className="wb-hint">
        Boolean results keep T-junctions where faces were split, which count as unshared edges here;
        the body is still watertight and slices and exports as one solid.
      </p>
    </div>
  )
}
function RenameForm({
  name,
  onRename,
  onClose,
}: {
  name: string
  onRename: (name: string) => void
  onClose: () => void
}) {
  const [value, setValue] = useState(name)
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onRename(value)
      }}
    >
      <div className="wb-panel-title">Rename</div>
      <label className="wb-field">
        <span>Name</span>
        <input value={value} maxLength={60} autoFocus onChange={(e) => setValue(e.target.value)} />
      </label>
      <div className="wb-properties-actions">
        <button type="submit" className="wb-button primary">
          Rename
        </button>
        <button type="button" className="wb-button" onClick={onClose}>
          Cancel
        </button>
      </div>
    </form>
  )
}
