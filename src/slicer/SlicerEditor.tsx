// The slicer prototype: a Bambu Studio-shaped workbench (Prepare / Preview / Device / Project
// tabs, printer-filament-process sidebar, build plate viewport, object panel, slice button) over
// a real project document. Objects are boxes, slicing is an estimate; the workflow is real.
import { useMemo, useState, type ReactNode } from 'react'
import {
  ArrowLeft,
  Boxes,
  Copy,
  Fan,
  Gauge,
  Home,
  LayoutGrid,
  Layers,
  PackagePlus,
  Paintbrush,
  Pause,
  Play,
  Power,
  Printer,
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
import {
  Box as IsoBox,
  Grid,
  Triad,
  boxCorners,
  fitViewBox,
  type Orientation,
} from '../workbench/Isometric'
import type { Menu, ParamValue, RibbonTab, ToolDef, TreeNode } from '../workbench/types'
import {
  BED_SIZE,
  OBJECT_COLORS,
  PRINTERS,
  activePlate,
  arrange,
  estimateSlice,
  formatDuration,
  newObject,
  newPlate,
  validSlicer,
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
            hint: 'Place a box of the given size on the plate. STL/3MF import arrives with the geometry loader.',
            params: [
              { id: 'name', label: 'Name', kind: 'text', default: 'Bracket' },
              {
                id: 'width',
                label: 'Width (X)',
                kind: 'number',
                default: 40,
                unit: 'mm',
                min: 1,
                max: 256,
              },
              {
                id: 'depth',
                label: 'Depth (Y)',
                kind: 'number',
                default: 40,
                unit: 'mm',
                min: 1,
                max: 256,
              },
              {
                id: 'height',
                label: 'Height (Z)',
                kind: 'number',
                default: 30,
                unit: 'mm',
                min: 1,
                max: 250,
              },
            ],
          },
          { id: 'clone', label: 'Clone', icon: Copy, hint: 'Duplicate the selected object.' },
          { id: 'delete', label: 'Delete', icon: Trash2 },
          {
            id: 'arrange',
            label: 'Arrange',
            icon: LayoutGrid,
            hint: 'Lay the plate out on a grid.',
          },
          {
            id: 'orient',
            label: 'Auto Orient',
            icon: Shuffle,
            hint: 'Orientation is fixed for boxes in this prototype.',
          },
        ],
      },
      {
        label: 'Edit',
        tools: [
          { id: 'noop:split', label: 'Split to Parts', icon: Scissors, disabled: true },
          { id: 'noop:cut', label: 'Cut', icon: Slice, disabled: true },
          { id: 'noop:support', label: 'Support Painting', icon: Paintbrush, disabled: true },
          { id: 'noop:seam', label: 'Seam Painting', icon: Waves, disabled: true },
        ],
      },
      {
        label: 'Plates',
        tools: [
          { id: 'plate:add', label: 'Add Plate', icon: Square },
          { id: 'plate:next', label: 'Next Plate', icon: Layers },
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
          { id: 'layer:all', label: 'All Layers', icon: Boxes },
        ],
      },
      {
        label: 'Color scheme',
        tools: [
          { id: 'scheme:type', label: 'Line Type', icon: Paintbrush },
          { id: 'scheme:speed', label: 'Speed', icon: Gauge },
          { id: 'scheme:height', label: 'Layer Height', icon: Layers },
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
            id: 'export:json',
            label: 'Export Project',
            icon: Boxes,
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
      { label: 'New Project', shortcut: 'Ctrl+N', command: 'notyet:New Project' },
      { label: 'Import 3MF/STL…', shortcut: 'Ctrl+I', command: 'notyet:Mesh import' },
      { label: 'Save Project', shortcut: 'Ctrl+S', command: 'save' },
      'separator',
      { label: 'Export Project (JSON)…', command: 'export:json' },
      { label: 'Export Plate Sliced File…', command: 'notyet:G-code export' },
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
      { label: 'Select All', shortcut: 'Ctrl+A', command: 'notyet:Multi-select' },
    ],
  },
  {
    label: 'View',
    items: [
      { label: 'Prepare', command: 'view:prepare' },
      { label: 'Preview', command: 'view:preview' },
      { label: 'Device', command: 'view:device' },
      { label: 'Project', command: 'view:project' },
    ],
  },
  { label: 'Help', items: [{ label: 'About this prototype', command: 'about' }] },
]
type History = { past: SlicerDocument[]; future: SlicerDocument[] }

/** The build plate viewport shared by the editor and the read-only output. */
export function SlicerViewport({
  document: doc,
  selected,
  onPick,
}: {
  document: SlicerDocument
  selected: string | null
  onPick?: (id: string) => void
}) {
  const plate = activePlate(doc)
  const bed = BED_SIZE[doc.printer] ?? 256
  const orientation: Orientation = doc.view === 'preview' ? 'iso' : 'iso'
  const viewBox = fitViewBox(
    boxCorners(
      -bed / 2,
      -bed / 2,
      -2,
      bed,
      bed,
      Math.max(40, ...plate.objects.map((o) => o.height)),
    ),
    orientation,
    24,
  )
  const layerHeight = doc.process.layerHeight
  return (
    <>
      <svg
        viewBox={viewBox}
        role="img"
        aria-label={`Build plate with ${plate.objects.length} objects`}
        preserveAspectRatio="xMidYMid meet"
      >
        <IsoBox
          x={-bed / 2}
          y={-bed / 2}
          z={-2}
          w={bed}
          d={bed}
          h={2}
          orientation={orientation}
          fill="#3a4048"
          stroke="#5b636d"
        />
        <Grid size={bed} step={bed / 8} orientation={orientation} color="var(--wb-grid)" />
        {[...plate.objects]
          .sort((a, b) => a.y + a.x - (b.y + b.x))
          .map((o) => {
            const shownHeight =
              doc.view === 'preview' && doc.sliced
                ? Math.min(o.height, Math.max(layerHeight, doc.previewLayer * layerHeight))
                : o.height
            return (
              <g
                key={o.id}
                onClick={() => onPick?.(o.id)}
                style={{ cursor: onPick ? 'pointer' : 'default' }}
              >
                <IsoBox
                  x={o.x - o.width / 2}
                  y={o.y - o.depth / 2}
                  z={0}
                  w={o.width}
                  d={o.depth}
                  h={shownHeight}
                  orientation={orientation}
                  fill={doc.view === 'preview' ? doc.filament.color : o.color}
                  stroke={selected === o.id ? '#3b8beb' : 'rgba(0,0,0,0.45)'}
                />
              </g>
            )
          })}
      </svg>
      <Triad orientation={orientation} />
      <div className="wb-viewport-note">
        {doc.printer} · {bed} × {bed} mm · {plate.name}
        {doc.view === 'preview' && doc.sliced
          ? ` · layer ${doc.previewLayer}/${doc.sliced.layers}`
          : ''}
        {!plate.objects.length ? ' · Add an object from the Prepare tab.' : ''}
      </div>
    </>
  )
}

export default function SlicerEditor({
  title,
  document: doc,
  readOnly,
  unsaved,
  onBack,
  onChange,
}: EditorProps<SlicerDocument>) {
  const [tool, setTool] = useState<ToolDef | null>(null)
  const [values, setValues] = useState<Record<string, ParamValue>>({})
  const [selected, setSelected] = useState<string | null>(null)
  const [panelTab, setPanelTab] = useState<'settings' | 'objects'>('settings')
  const [message, setMessage] = useState('')
  const [history, setHistory] = useState<History>({ past: [], future: [] })
  const [device, setDevice] = useState<{ state: 'idle' | 'printing' | 'paused'; progress: number }>(
    { state: 'idle', progress: 0 },
  )
  const plate = activePlate(doc)
  const bed = BED_SIZE[doc.printer] ?? 256
  const selectedObject = plate.objects.find((o) => o.id === selected) ?? null

  const apply = (next: SlicerDocument, record = true) => {
    if (readOnly) return false
    if (!validSlicer(next)) {
      setMessage('That change could not be saved. Keep objects inside the plate limits.')
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

  function startTool(t: ToolDef) {
    if (t.id.startsWith('noop:')) {
      setMessage(t.hint ?? `${t.label} arrives with mesh support.`)
      return
    }
    if (t.params) {
      setTool(t)
      setValues(Object.fromEntries(t.params.map((p) => [p.id, p.default])))
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
      const placed = arrange({ ...plate, objects: [...plate.objects, object] }, bed)
      if (changePlate(() => placed)) {
        setSelected(object.id)
        setPanelTab('objects')
        setMessage(`${object.name} added to ${plate.name}.`)
      }
    }
    setTool(null)
  }
  function command(id: string) {
    if (id.startsWith('notyet:')) {
      setMessage(`${id.slice(7)} is not part of this prototype yet.`)
      return
    }
    if (id.startsWith('view:')) {
      apply({ ...doc, view: id.slice(5) as SlicerView }, false)
      return
    }
    if (id.startsWith('scheme:')) {
      setMessage(`Preview color scheme: ${id.slice(7)} (visual only in this prototype).`)
      return
    }
    switch (id) {
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
        setMessage('Boxes are already best oriented; auto-orient arrives with mesh support.')
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
      case 'slice': {
        if (!plate.objects.length) {
          setMessage('Add an object before slicing.')
          return
        }
        const result = estimateSlice(doc)
        apply({ ...doc, sliced: result, view: 'preview', previewLayer: result.layers }, false)
        setMessage(`Sliced ${plate.name}: ${formatDuration(result.seconds)}, ${result.grams} g.`)
        break
      }
      case 'layer:up':
        if (doc.sliced)
          apply({ ...doc, previewLayer: Math.min(doc.sliced.layers, doc.previewLayer + 1) }, false)
        break
      case 'layer:down':
        if (doc.sliced) apply({ ...doc, previewLayer: Math.max(1, doc.previewLayer - 1) }, false)
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
          setDevice({ state: 'printing', progress: 12 })
          apply({ ...doc, view: 'device' }, false)
        }
        break
      case 'device:pause':
        setDevice((d) => ({ ...d, state: d.state === 'paused' ? 'printing' : 'paused' }))
        break
      case 'device:stop':
        setDevice({ state: 'idle', progress: 0 })
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
      case 'save':
        setMessage(
          unsaved
            ? 'Saving is retried automatically; check the workspace save error.'
            : 'Everything is saved as you work.',
        )
        break
      case 'export:json': {
        const url = URL.createObjectURL(
          new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' }),
        )
        const a = document.createElement('a')
        a.href = url
        a.download = `${
          title
            .replace(/[^a-z0-9-_ ]/gi, '')
            .trim()
            .replace(/\s+/g, '-')
            .toLowerCase() || 'project'
        }.3mf.json`
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
        break
      }
      case 'notes':
        apply({ ...doc, view: 'project' }, false)
        break
      case 'about':
        setMessage(
          'A clickable Bambu Studio-style prototype: real settings and plates, estimated slicing.',
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
          badge: `${o.width}×${o.depth}×${o.height}`,
        })),
      },
    ],
    [plate],
  )
  const estimate = doc.sliced
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
              onChange={(e) => apply({ ...doc, printer: e.target.value, sliced: null })}
            >
              {PRINTERS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <label className="wb-field">
            <span>Nozzle</span>
            <select
              value={doc.nozzle}
              disabled={readOnly}
              onChange={(e) => apply({ ...doc, nozzle: Number(e.target.value), sliced: null })}
            >
              {[0.2, 0.4, 0.6, 0.8].map((n) => (
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
          <div className="wb-row">
            <label className="wb-field">
              <span>Type</span>
              <select
                value={doc.filament.type}
                disabled={readOnly}
                onChange={(e) =>
                  apply({
                    ...doc,
                    filament: {
                      ...doc.filament,
                      type: e.target.value as SlicerDocument['filament']['type'],
                    },
                    sliced: null,
                  })
                }
              >
                {['PLA', 'PETG', 'ABS', 'TPU', 'PLA-CF'].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className="wb-field">
              <span>Color</span>
              <input
                type="color"
                value={doc.filament.color}
                disabled={readOnly}
                onChange={(e) =>
                  apply({ ...doc, filament: { ...doc.filament, color: e.target.value } }, false)
                }
              />
            </label>
          </div>
          <label className="wb-field">
            <span>Brand</span>
            <input
              value={doc.filament.brand}
              maxLength={40}
              disabled={readOnly}
              onChange={(e) =>
                apply({ ...doc, filament: { ...doc.filament, brand: e.target.value } }, false)
              }
            />
          </label>
        </div>
      </details>
      <details className="wb-section" open>
        <summary>
          <Settings2 size={14} /> Process
        </summary>
        <div className="wb-section-body">
          <div className="wb-row">
            <label className="wb-field">
              <span>Layer height (mm)</span>
              <select
                value={doc.process.layerHeight}
                disabled={readOnly}
                onChange={(e) => setProcess({ layerHeight: Number(e.target.value) })}
              >
                {[0.08, 0.12, 0.16, 0.2, 0.24, 0.28].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
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
                {['grid', 'gyroid', 'honeycomb', 'triangles', 'lightning'].map((p) => (
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
            <label className="wb-field">
              <span>Support type</span>
              <select
                value={doc.process.supportType}
                disabled={readOnly}
                onChange={(e) =>
                  setProcess({ supportType: e.target.value as Process['supportType'] })
                }
              >
                <option value="tree">Tree</option>
                <option value="normal">Normal</option>
              </select>
            </label>
          )}
          <label className="wb-field inline">
            <input
              type="checkbox"
              checked={doc.process.brim}
              disabled={readOnly}
              onChange={(e) => setProcess({ brim: e.target.checked })}
            />
            <span>Brim</span>
          </label>
          <div className="wb-row">
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
          </div>
          <div className="wb-row">
            <label className="wb-field">
              <span>Nozzle temp (°C)</span>
              <input
                type="number"
                min={150}
                max={320}
                value={doc.process.nozzleTemp}
                disabled={readOnly}
                onChange={(e) => setProcess({ nozzleTemp: Number(e.target.value) })}
              />
            </label>
            <label className="wb-field">
              <span>Bed temp (°C)</span>
              <input
                type="number"
                min={0}
                max={120}
                value={doc.process.bedTemp}
                disabled={readOnly}
                onChange={(e) => setProcess({ bedTemp: Number(e.target.value) })}
              />
            </label>
          </div>
        </div>
      </details>
    </div>
  )
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
            aria-valuenow={device.progress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div style={{ width: `${device.progress}%` }} />
          </div>
          <div className="wb-stat">
            <span>
              <Thermometer size={12} /> Nozzle
            </span>
            <strong>{device.state === 'idle' ? 24 : doc.process.nozzleTemp} °C</strong>
          </div>
          <div className="wb-stat">
            <span>
              <Thermometer size={12} /> Bed
            </span>
            <strong>{device.state === 'idle' ? 23 : doc.process.bedTemp} °C</strong>
          </div>
          <div className="wb-stat">
            <span>
              <Fan size={12} /> Part fan
            </span>
            <strong>{device.state === 'printing' ? '100%' : '0%'}</strong>
          </div>
          <p className="wb-hint">
            A simulated printer. Connecting to a real one is a later increment.
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
                    min={-bed / 2}
                    max={bed / 2}
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
                    min={-bed / 2}
                    max={bed / 2}
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
                      max={dim === 'height' ? 250 : bed}
                      value={selectedObject[dim]}
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
              <label className="wb-field">
                <span>Color</span>
                <input
                  type="color"
                  value={selectedObject.color}
                  onChange={(e) =>
                    changeObject(selectedObject.id, (o) => ({ ...o, color: e.target.value }))
                  }
                />
              </label>
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
            </>
          )}
          <p className="wb-hint">
            Estimates come from object volume and settings, not a real slicer.
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
          <div className="eyebrow">SLICER · PROTOTYPE</div>
          <h1>{title}</h1>
        </div>
        <div className="canvas-heading-actions">
          {unsaved && <span className="unsaved-note">Changes not saved</span>}
          <span className="unsaved-note">
            Clickable prototype: real settings and plates, estimated slicing
          </span>
        </div>
      </div>
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
        viewport={
          <SlicerViewport document={doc} selected={selected} onPick={(id) => setSelected(id)} />
        }
        rightPanel={rightPanel}
        status={[
          { id: 'printer', text: doc.printer, icon: Printer },
          { id: 'filament', text: `${doc.filament.type} · ${doc.nozzle} mm nozzle` },
          { id: 'objects', text: `${plate.objects.length} objects on ${plate.name}` },
          {
            id: 'slice',
            text: estimate
              ? `${formatDuration(estimate.seconds)} · ${estimate.grams} g`
              : 'Not sliced',
          },
        ]}
        message={message}
        readOnly={readOnly}
      />
    </div>
  )
}
