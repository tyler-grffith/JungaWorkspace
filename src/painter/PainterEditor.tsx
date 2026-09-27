// PLA Painter: an image becomes a filament painting, in the manner of HueForge and Chroma
// Canvas. Settings on the left (image and its processing, size, layers, matching, the filament
// stack with automatic placement and suggestions, the frame), the picture in the middle
// (printed preview, heightmap, original, a compare slider, a layer-by-layer scrub, and the
// painted 3D relief), and the print sheet on the right (numbers, swap plan, exports including
// G-code with pauses, and a hand-off to the project's slicer).
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Box,
  Download,
  FileText,
  ImagePlus,
  Printer,
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-react'
import type { EditorProps } from '../modules/editors'
import { readImageFile } from '../canvas/images'
import { downloadBlob, safeFilename } from '../canvas/export'
import Viewport3D, { type SceneItem } from '../workbench/Viewport3D'
import { compact, decimate, settle, toStl, triangleCount } from '../workbench/geometry'
import { toThreeMf } from '../workbench/threemf'
import {
  MAX_TRIANGLES,
  activePlate,
  arrange,
  bedFor,
  emptySlicer,
  meshObject,
  printerProfile,
  type SlicerDocument,
} from '../slicer/model'
import { slicePlate, toGcode } from '../slicer/slicing'
import {
  FILAMENT_PRESETS,
  MAX_STACK,
  frameOf,
  gridFor,
  newFilament,
  newId,
  normalizeStack,
  painterProblem,
  printedHeight,
  renderOf,
  spaceSwapsEvenly,
  totalHeight,
  validPainter,
  type Filament,
  type PainterDocument,
  type PainterFrame,
  type Render,
} from './model'
import {
  downsample,
  placeSwaps,
  printSheet,
  relief,
  reliefMesh,
  suggestStack,
  type Painting,
} from './paint'
import { PaintingCanvas, RampBar, Stats, SwapList, usePainting, usePixels } from './PainterSheet'
import '../canvas/canvas.css'
import './painter.css'

type View = 'printed' | 'heightmap' | 'original' | 'compare' | 'layers' | 'relief'
const VIEWS: { id: View; label: string }[] = [
  { id: 'printed', label: 'Printed' },
  { id: 'heightmap', label: 'Heightmap' },
  { id: 'original', label: 'Original' },
  { id: 'compare', label: 'Compare' },
  { id: 'layers', label: 'By layer' },
  { id: 'relief', label: '3D relief' },
]
const LAYER_HEIGHTS = [0.04, 0.06, 0.08, 0.1, 0.12, 0.16, 0.2]
/** Cells kept for the interactive 3D preview and for the slicer's triangle budget. */
const RELIEF_PREVIEW_CELLS = 2500
const SLICER_CELLS = 900
const STL_CELLS = 60000

export default function PainterEditor({
  title,
  document: doc,
  readOnly,
  unsaved,
  onBack,
  onChange,
  related,
}: EditorProps<PainterDocument>) {
  const [view, setView] = useState<View>('printed')
  const [message, setMessage] = useState('')
  const [over, setOver] = useState(false)
  const [scrub, setScrub] = useState(0)
  const [split, setSplit] = useState(50)
  const [busy, setBusy] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const grid = gridFor(doc)
  const pixels = usePixels(doc.image?.src ?? null, grid.cols, grid.rows)
  const painting = usePainting(doc, pixels)
  const render = renderOf(doc)
  const frame = frameOf(doc)

  const apply = (next: PainterDocument) => {
    if (readOnly) return false
    const normalized = normalizeStack(next)
    if (!validPainter(normalized)) {
      setMessage(painterProblem(normalized))
      return false
    }
    return onChange(normalized)
  }
  const set = (patch: Partial<PainterDocument>) => apply({ ...doc, ...patch })
  const setRender = (patch: Partial<Render>) => set({ render: { ...render, ...patch } })
  const setFrame = (patch: Partial<PainterFrame>) => {
    const next = { ...frame, ...patch }
    set({ frame: next.width === 0 && next.holeDiameter === 0 ? undefined : next })
  }
  const setFilament = (id: string, patch: Partial<Filament>) =>
    apply({ ...doc, stack: doc.stack.map((f) => (f.id === id ? { ...f, ...patch } : f)) })

  // --- Image -----------------------------------------------------------------------------------
  async function importImage(file: File | undefined) {
    if (!file || readOnly) return
    if (!file.type.startsWith('image/')) {
      setMessage('Choose an image file (PNG, JPEG, GIF, or WebP).')
      return
    }
    try {
      const { src, width, height } = await readImageFile(file, 640)
      const name = file.name.replace(/\.[^.]+$/, '')
      if (apply({ ...doc, image: { src, width, height, name } }))
        setMessage(`${name} loaded (${width} × ${height} px).`)
      else setMessage('That image is too large to store; try a smaller one.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'That image could not be read.')
    }
  }
  function drop(event: DragEvent) {
    event.preventDefault()
    setOver(false)
    void importImage(event.dataTransfer.files[0])
  }
  useEffect(() => {
    if (readOnly) return
    const pasted = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return
      const file = [...(event.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'))
      if (!file) return
      event.preventDefault()
      void importImage(file)
    }
    window.addEventListener('paste', pasted)
    return () => window.removeEventListener('paste', pasted)
  })

  // --- Stack -------------------------------------------------------------------------------------
  function addFilament(event: ChangeEvent<HTMLSelectElement>) {
    const preset = FILAMENT_PRESETS[Number(event.target.value)]
    event.target.value = ''
    if (!preset || doc.stack.length >= MAX_STACK) return
    apply({ ...doc, stack: [...doc.stack, newFilament(preset, doc.maxLayers)] })
  }
  function removeFilament(id: string) {
    if (doc.stack.length > 1) apply({ ...doc, stack: doc.stack.filter((f) => f.id !== id) })
  }
  /** Swap start layers with a neighbour, so the order in the stack changes and the marks stay. */
  function moveFilament(index: number, direction: -1 | 1) {
    const other = index + direction
    if (other < 0 || other >= doc.stack.length) return
    const stack = doc.stack.map((f, i) =>
      i === index
        ? { ...f, startLayer: doc.stack[other].startLayer }
        : i === other
          ? { ...f, startLayer: doc.stack[index].startLayer }
          : f,
    )
    apply({ ...doc, stack })
  }
  /** Run an optimiser after the next paint so the "working" note shows first. */
  function optimise(label: string, run: () => PainterDocument) {
    if (!pixels) return setMessage('Add an image first.')
    setBusy(true)
    setMessage(`${label}…`)
    window.setTimeout(() => {
      try {
        const started = performance.now()
        const next = run()
        if (apply(next))
          setMessage(`${label} done in ${((performance.now() - started) / 1000).toFixed(1)} s.`)
      } finally {
        setBusy(false)
      }
    }, 30)
  }
  const autoPlace = () =>
    optimise('Placing swaps', () => placeSwaps(pixels!, grid.cols, grid.rows, doc))
  const suggest = (count: number) =>
    optimise(`Choosing ${count} filaments`, () =>
      suggestStack(pixels!, grid.cols, grid.rows, doc, FILAMENT_PRESETS.slice(0, 13), count, newId),
    )

  // --- Exports ------------------------------------------------------------------------------------
  const name = safeFilename(title) || 'painting'
  const exportMesh = () => reliefMesh(downsample(painting!, STL_CELLS), doc)
  function exportStl() {
    if (!painting) return setMessage('Add an image first.')
    downloadBlob(toStl(exportMesh(), title), `${name}.stl`)
  }
  function export3mf() {
    if (!painting) return setMessage('Add an image first.')
    downloadBlob(
      toThreeMf([{ name: title, mesh: exportMesh(), color: doc.stack[0].color }], title),
      `${name}.3mf`,
    )
  }
  function exportSheet() {
    downloadBlob(
      new Blob([printSheet(title, doc, painting)], { type: 'text/plain' }),
      `${name}-print-sheet.txt`,
    )
  }
  function exportPreview() {
    if (!painting) return setMessage('Add an image first.')
    const canvas = document.createElement('canvas')
    canvas.width = painting.cols
    canvas.height = painting.rows
    canvas
      .getContext('2d')!
      .putImageData(
        new ImageData(
          painting.preview as Uint8ClampedArray<ArrayBuffer>,
          painting.cols,
          painting.rows,
        ),
        0,
        0,
      )
    canvas.toBlob((blob) => blob && downloadBlob(blob, `${name}-preview.png`), 'image/png')
  }
  /** The slicer document that prints this relief: one wall, full infill, pauses at every swap. */
  function slicerProject(base: SlicerDocument): SlicerDocument {
    const plate = activePlate(base)
    const mesh = compact(
      settle(decimate(reliefMesh(downsample(painting!, SLICER_CELLS), doc), MAX_TRIANGLES)),
    )
    const object = meshObject(title, mesh, plate.objects.length)
    const placed = arrange({ ...plate, objects: [...plate.objects, object] }, bedFor(base.printer))
    const stack = normalizeStack(doc).stack
    const ams = printerProfile(base.printer).slots >= stack.length
    const slots: SlicerDocument['slots'] = ams
      ? stack.slice(1).map((f) => ({ type: 'PLA', brand: f.name, color: f.color }))
      : base.slots
    const changes = stack.slice(1).map((f, i) => ({ layer: f.startLayer, slot: ams ? i + 1 : -1 }))
    const sheet = printSheet(title, doc, painting)
    return {
      ...base,
      filament: ams
        ? { ...base.filament, color: stack[0].color, brand: stack[0].name }
        : base.filament,
      slots,
      process: {
        ...base.process,
        layerHeight: doc.layerHeight,
        firstLayerHeight: doc.layerHeight,
        walls: 1,
        infill: 100,
        infillPattern: 'lines',
        topLayers: 0,
        bottomLayers: 0,
        supports: false,
        changes,
      },
      plates: base.plates.map((p) => (p.id === plate.id ? placed : p)),
      notes: [base.notes, sheet].filter(Boolean).join('\n\n').slice(0, 20000),
      sliced: null,
      view: 'prepare',
    }
  }
  function exportGcode() {
    if (!painting) return setMessage('Add an image first.')
    setBusy(true)
    setMessage('Slicing the relief…')
    window.setTimeout(() => {
      try {
        const project = slicerProject(
          related?.tools.includes('slicer') ? related.get('slicer') : emptySlicer(),
        )
        const only = {
          ...project,
          plates: project.plates.map((p) => ({ ...p, objects: p.objects.slice(-1) })),
        }
        const sliced = slicePlate(only)
        downloadBlob(
          new Blob([toGcode(sliced, only, title)], { type: 'text/x-gcode' }),
          `${name}.gcode`,
        )
        setMessage(
          `G-code written: ${sliced.result.layers} layers with ${project.process.changes.length} spool changes.`,
        )
      } finally {
        setBusy(false)
      }
    }, 30)
  }
  /** Put the relief on the project's slicer plate with the swap plan as pauses and notes. */
  function sendToSlicer() {
    if (!related?.tools.includes('slicer'))
      return setMessage('Add the Slicer tool to this project to send paintings to it.')
    if (!painting) return setMessage('Add an image first.')
    const saved = related.save('slicer', slicerProject(related.get('slicer')))
    if (saved) related.open('slicer')
    else setMessage('The relief would pass the slicer’s storage budget.')
  }
  /** A calibration strip: steps of 1 … 12 layers of the chosen filament over the base, to measure TD. */
  function exportCalibration(index: number) {
    const test = doc.stack[index]
    if (!test) return
    const stepDoc: PainterDocument = {
      ...doc,
      width: 96,
      frame: undefined,
      baseLayers: 2,
      maxLayers: 14,
      stack: [doc.stack[0], { ...test, startLayer: 3 }].map((f, i) => ({
        ...f,
        startLayer: i ? 3 : 1,
      })),
    }
    const cols = 96
    const rows = 20
    const layers = new Uint8Array(cols * rows)
    const preview = new Uint8ClampedArray(cols * rows * 4)
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        layers[r * cols + c] = 2 + Math.min(12, Math.floor(c / 8) + 1)
        preview.set([200, 200, 200, 255], (r * cols + c) * 4)
      }
    const mesh = reliefMesh({ cols, rows, layers, preview }, { ...stepDoc, width: 96 })
    downloadBlob(
      toStl(mesh, `${test.name} TD strip`),
      `${safeFilename(test.name) || 'filament'}-td-strip.stl`,
    )
    setMessage(
      `${test.name} calibration strip: twelve 8 mm steps, 1 to 12 layers of ${test.name} over ${doc.stack[0].name}; the step where the base stops showing is the TD.`,
    )
  }

  const reliefScene = useMemo<{ items: SceneItem[]; triangles: number } | null>(() => {
    if (!painting || view !== 'relief') return null
    const { mesh, colors } = relief(downsample(painting, RELIEF_PREVIEW_CELLS), doc)
    return {
      items: [{ kind: 'mesh', mesh, fill: doc.stack[0].color, colors, stroke: null }],
      triangles: triangleCount(mesh),
    }
  }, [painting, view, doc])
  const scrubLayer = Math.min(doc.maxLayers, Math.max(1, scrub || doc.maxLayers))

  return (
    <div className="painter-editor">
      <div className="canvas-heading">
        <div>
          <button className="back-link" onClick={onBack}>
            <ArrowLeft size={15} />
            Back to project
          </button>
          <div className="eyebrow">PLA PAINTER</div>
          <h1>{title}</h1>
        </div>
        <div className="canvas-heading-actions">
          {unsaved && <span className="unsaved-note">Changes not saved</span>}
          {message && (
            <span className="unsaved-note" role="status">
              {message}
            </span>
          )}
        </div>
      </div>
      <div className="painter-body">
        <aside className="painter-panel" aria-label="Painting settings">
          <section className="painter-section" aria-labelledby="painter-image-heading">
            <h2 id="painter-image-heading">Image</h2>
            <div
              className={`painter-drop ${over ? 'over' : ''}`}
              onDragOver={(e) => {
                e.preventDefault()
                setOver(true)
              }}
              onDragLeave={() => setOver(false)}
              onDrop={drop}
            >
              {doc.image ? (
                <>
                  <img src={doc.image.src} alt={doc.image.name} />
                  <span>
                    {doc.image.name} · {doc.image.width} × {doc.image.height} px
                  </span>
                </>
              ) : (
                <span>Drop a picture here, paste one, or choose a file.</span>
              )}
              {!readOnly && (
                <button type="button" className="button" onClick={() => fileInput.current?.click()}>
                  <ImagePlus size={15} />
                  {doc.image ? 'Replace image' : 'Choose image…'}
                </button>
              )}
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                hidden
                aria-label="Choose an image"
                onChange={(e) => {
                  void importImage(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
            </div>
          </section>

          <section className="painter-section" aria-labelledby="painter-size-heading">
            <h2 id="painter-size-heading">Size</h2>
            <div className="painter-row">
              <label className="painter-field">
                Printed width (mm)
                <input
                  type="number"
                  min={10}
                  max={400}
                  step={1}
                  value={doc.width}
                  disabled={readOnly}
                  onChange={(e) => set({ width: Number(e.target.value) })}
                />
              </label>
              <label className="painter-field">
                Detail (px/mm)
                <input
                  type="number"
                  min={0.2}
                  max={8}
                  step={0.1}
                  value={doc.detail}
                  disabled={readOnly}
                  onChange={(e) => set({ detail: Number(e.target.value) })}
                />
              </label>
            </div>
            <p className="painter-note">
              {doc.width} × {Math.round(printedHeight(doc))} mm · {grid.cols} × {grid.rows} pixels
            </p>
            <div className="painter-row">
              <label className="painter-field">
                Frame (mm)
                <input
                  type="number"
                  min={0}
                  max={50}
                  step={0.5}
                  value={frame.width}
                  disabled={readOnly}
                  onChange={(e) => setFrame({ width: Number(e.target.value) })}
                />
              </label>
              <label className="painter-field">
                Hanging hole Ø (mm)
                <input
                  type="number"
                  min={0}
                  max={30}
                  step={0.5}
                  value={frame.holeDiameter}
                  disabled={readOnly || frame.width === 0}
                  onChange={(e) => setFrame({ holeDiameter: Number(e.target.value) })}
                />
              </label>
            </div>
          </section>

          <section className="painter-section" aria-labelledby="painter-layers-heading">
            <h2 id="painter-layers-heading">Layers</h2>
            <div className="painter-row">
              <label className="painter-field">
                Layer height (mm)
                <select
                  value={doc.layerHeight}
                  disabled={readOnly}
                  onChange={(e) => set({ layerHeight: Number(e.target.value) })}
                >
                  {LAYER_HEIGHTS.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </label>
              <label className="painter-field">
                Total layers
                <input
                  type="number"
                  min={doc.baseLayers + 1}
                  max={150}
                  value={doc.maxLayers}
                  disabled={readOnly}
                  onChange={(e) => set({ maxLayers: Number(e.target.value) })}
                />
              </label>
            </div>
            <div className="painter-row">
              <label className="painter-field">
                Base layers
                <input
                  type="number"
                  min={1}
                  max={Math.min(20, doc.maxLayers - 1)}
                  value={doc.baseLayers}
                  disabled={readOnly}
                  onChange={(e) => set({ baseLayers: Number(e.target.value) })}
                />
              </label>
              <p className="painter-note" style={{ alignSelf: 'end' }}>
                {totalHeight(doc).toFixed(2)} mm tall
              </p>
            </div>
          </section>

          <section className="painter-section" aria-labelledby="painter-adjust-heading">
            <h2 id="painter-adjust-heading">Picture</h2>
            <label className="painter-field">
              Brightness ({doc.adjust.brightness})
              <input
                type="range"
                min={-100}
                max={100}
                value={doc.adjust.brightness}
                disabled={readOnly}
                onChange={(e) =>
                  set({ adjust: { ...doc.adjust, brightness: Number(e.target.value) } })
                }
              />
            </label>
            <label className="painter-field">
              Contrast ({doc.adjust.contrast.toFixed(2)})
              <input
                type="range"
                min={0.2}
                max={3}
                step={0.05}
                value={doc.adjust.contrast}
                disabled={readOnly}
                onChange={(e) =>
                  set({ adjust: { ...doc.adjust, contrast: Number(e.target.value) } })
                }
              />
            </label>
            <label className="painter-field">
              Gamma ({render.gamma.toFixed(2)})
              <input
                type="range"
                min={0.2}
                max={4}
                step={0.05}
                value={render.gamma}
                disabled={readOnly}
                onChange={(e) => setRender({ gamma: Number(e.target.value) })}
              />
            </label>
            <label className="painter-field">
              Saturation ({render.saturation.toFixed(2)})
              <input
                type="range"
                min={0}
                max={3}
                step={0.05}
                value={render.saturation}
                disabled={readOnly}
                onChange={(e) => setRender({ saturation: Number(e.target.value) })}
              />
            </label>
            <div className="painter-row">
              <label className="painter-field">
                Blur (px)
                <input
                  type="number"
                  min={0}
                  max={20}
                  step={1}
                  value={render.blur}
                  disabled={readOnly}
                  onChange={(e) => setRender({ blur: Number(e.target.value) })}
                />
              </label>
              <label className="painter-field">
                Sharpen
                <input
                  type="number"
                  min={0}
                  max={3}
                  step={0.1}
                  value={render.sharpen}
                  disabled={readOnly}
                  onChange={(e) => setRender({ sharpen: Number(e.target.value) })}
                />
              </label>
            </div>
          </section>

          <section className="painter-section" aria-labelledby="painter-match-heading">
            <h2 id="painter-match-heading">Matching</h2>
            <div className="painter-row">
              <label className="painter-field">
                Colour distance
                <select
                  value={render.match}
                  disabled={readOnly}
                  onChange={(e) => setRender({ match: e.target.value as Render['match'] })}
                >
                  <option value="lab">Perceptual (ΔE2000)</option>
                  <option value="rgb">Weighted RGB</option>
                </select>
              </label>
              <label className="painter-field">
                Dithering
                <select
                  value={render.dither}
                  disabled={readOnly}
                  onChange={(e) => setRender({ dither: e.target.value as Render['dither'] })}
                >
                  <option value="none">None</option>
                  <option value="floyd">Floyd–Steinberg</option>
                </select>
              </label>
            </div>
            <label className="painter-field">
              Smallest feature (mm)
              <input
                type="number"
                min={0}
                max={20}
                step={0.5}
                value={render.minFeature}
                disabled={readOnly}
                onChange={(e) => setRender({ minFeature: Number(e.target.value) })}
              />
            </label>
            <p className="painter-note">
              {painting?.error !== undefined
                ? `Average colour error ΔE ${painting.error.toFixed(1)} (about 2 is just noticeable).`
                : 'Add an image to see the colour error.'}
            </p>
          </section>

          <section className="painter-section" aria-labelledby="painter-stack-heading">
            <h2 id="painter-stack-heading">Filament stack</h2>
            <div className="painter-stack-head" aria-hidden="true">
              <span />
              <span>Filament</span>
              <span>TD mm</span>
              <span>Layer</span>
              <span />
            </div>
            <ol className="painter-stack" aria-label="Filament stack, bottom first">
              {doc.stack.map((f, i) => (
                <li key={f.id}>
                  <input
                    type="color"
                    value={f.color}
                    aria-label={`${f.name} colour`}
                    disabled={readOnly}
                    onChange={(e) => setFilament(f.id, { color: e.target.value })}
                  />
                  <input
                    value={f.name}
                    maxLength={40}
                    aria-label={`Filament ${i + 1} name`}
                    disabled={readOnly}
                    onChange={(e) => setFilament(f.id, { name: e.target.value || f.name })}
                  />
                  <input
                    type="number"
                    min={0.1}
                    max={20}
                    step={0.1}
                    value={f.td}
                    aria-label={`${f.name} transmission distance (mm)`}
                    title="Transmission distance: the thickness at which this filament fully hides the one below"
                    disabled={readOnly}
                    onChange={(e) => setFilament(f.id, { td: Number(e.target.value) })}
                  />
                  <input
                    type="number"
                    min={doc.baseLayers + 1}
                    max={doc.maxLayers}
                    value={f.startLayer}
                    aria-label={`${f.name} start layer`}
                    disabled={readOnly || i === 0}
                    title={i === 0 ? 'The base filament starts at layer 1' : undefined}
                    onChange={(e) => setFilament(f.id, { startLayer: Number(e.target.value) })}
                  />
                  <span className="painter-stack-actions">
                    <button
                      type="button"
                      aria-label={`Move ${f.name} down the stack`}
                      disabled={readOnly || i === 0}
                      onClick={() => moveFilament(i, -1)}
                    >
                      <ArrowDown size={14} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${f.name} up the stack`}
                      disabled={readOnly || i === doc.stack.length - 1}
                      onClick={() => moveFilament(i, 1)}
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove ${f.name}`}
                      disabled={readOnly || doc.stack.length === 1}
                      onClick={() => removeFilament(f.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </span>
                </li>
              ))}
            </ol>
            {!readOnly && (
              <>
                <div className="painter-stack-add">
                  <select
                    aria-label="Add a filament"
                    defaultValue=""
                    disabled={doc.stack.length >= MAX_STACK}
                    onChange={addFilament}
                  >
                    <option value="">Add a filament…</option>
                    {FILAMENT_PRESETS.map((p, i) => (
                      <option key={p.name} value={i}>
                        {p.name} · TD {p.td} mm
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="button"
                    onClick={() => apply(spaceSwapsEvenly(doc))}
                    disabled={doc.stack.length < 2}
                  >
                    Space evenly
                  </button>
                </div>
                <div className="painter-stack-add">
                  <button
                    type="button"
                    className="button"
                    onClick={autoPlace}
                    disabled={busy || !painting || doc.stack.length < 2}
                    title="Search the start layers for the lowest colour error"
                  >
                    <Wand2 size={14} />
                    Auto-place swaps
                  </button>
                  <button
                    type="button"
                    className="button"
                    onClick={() => suggest(4)}
                    disabled={busy || !painting}
                    title="Choose four filaments from the library that suit this picture"
                  >
                    <Sparkles size={14} />
                    Suggest 4 filaments
                  </button>
                </div>
                <label className="painter-field">
                  TD calibration strip
                  <select
                    aria-label="Export a calibration strip for a filament"
                    value=""
                    onChange={(e) => {
                      if (e.target.value !== '') exportCalibration(Number(e.target.value))
                      e.target.value = ''
                    }}
                  >
                    <option value="">Export STL for…</option>
                    {doc.stack.slice(1).map((f, i) => (
                      <option key={f.id} value={i + 1}>
                        {f.name} over {doc.stack[0].name}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
            <p className="painter-note">
              Transmission distances are approximate; print a calibration strip and measure your own
              spools for faithful colours.
            </p>
          </section>

          <section className="painter-section" aria-labelledby="painter-notes-heading">
            <h2 id="painter-notes-heading">Notes</h2>
            <label className="painter-field">
              <span className="visually-hidden">Notes</span>
              <textarea
                rows={3}
                value={doc.notes}
                maxLength={20000}
                disabled={readOnly}
                placeholder="Which spools, what worked, what to change…"
                onChange={(e) => set({ notes: e.target.value })}
              />
            </label>
          </section>
        </aside>

        <div className="painter-stage">
          <div className="painter-tabs" role="tablist" aria-label="Views">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                role="tab"
                id={`painter-tab-${v.id}`}
                aria-selected={view === v.id}
                aria-controls="painter-view"
                onClick={() => setView(v.id)}
              >
                {v.label}
              </button>
            ))}
          </div>
          <div
            id="painter-view"
            className="painter-view"
            role="tabpanel"
            aria-labelledby={`painter-tab-${view}`}
          >
            {!doc.image ? (
              <p className="painter-empty">
                Add a picture to paint it. Photos with strong light and shade and a few clear
                colours print best.
              </p>
            ) : !painting ? (
              <p className="painter-empty">Painting…</p>
            ) : view === 'original' ? (
              <img src={doc.image.src} alt={`${doc.image.name}, original`} />
            ) : view === 'relief' && reliefScene ? (
              <Viewport3D
                items={reliefScene.items}
                label={`Painted relief, ${reliefScene.triangles.toLocaleString()} triangles`}
              />
            ) : view === 'compare' ? (
              <PaintingCanvas
                painting={painting}
                doc={doc}
                mode="compare"
                split={split}
                label="Original beside printed"
              />
            ) : view === 'layers' ? (
              <PaintingCanvas
                painting={painting}
                doc={doc}
                mode="scrub"
                layer={scrubLayer}
                label={`Print after layer ${scrubLayer}`}
              />
            ) : (
              <PaintingCanvas
                painting={painting}
                doc={doc}
                mode={view === 'heightmap' ? 'heightmap' : 'printed'}
                label={view === 'heightmap' ? 'Heightmap' : 'Printed preview'}
              />
            )}
          </div>
          {view === 'compare' && painting && (
            <label className="painter-field">
              Original ◂ {split}% ▸ printed
              <input
                type="range"
                min={0}
                max={100}
                value={split}
                onChange={(e) => setSplit(Number(e.target.value))}
              />
            </label>
          )}
          {view === 'layers' && painting && (
            <label className="painter-field">
              Layer {scrubLayer} of {doc.maxLayers} · {(scrubLayer * doc.layerHeight).toFixed(2)} mm
              ·{' '}
              {
                normalizeStack(doc)
                  .stack.filter((f) => f.startLayer <= scrubLayer)
                  .at(-1)?.name
              }
              <input
                type="range"
                min={1}
                max={doc.maxLayers}
                value={scrubLayer}
                onChange={(e) => setScrub(Number(e.target.value))}
              />
            </label>
          )}
          <RampBar doc={doc} />
        </div>

        <aside className="painter-sheet" aria-label="Print sheet">
          <h2>Print sheet</h2>
          <Stats doc={doc} painting={painting} />
          <SwapList doc={doc} />
          <p className="painter-hint">
            Print at 100% infill with one wall, {doc.layerHeight} mm layers; pause at each listed
            layer and swap spools. The G-code below has the pauses built in.
          </p>
          <div className="painter-actions">
            <button
              type="button"
              className="button primary"
              onClick={exportStl}
              disabled={!painting}
            >
              <Box size={15} />
              Export STL
            </button>
            <button type="button" className="button" onClick={export3mf} disabled={!painting}>
              <Box size={15} />
              Export 3MF
            </button>
            <button
              type="button"
              className="button"
              onClick={exportGcode}
              disabled={!painting || busy}
            >
              <Printer size={15} />
              Export G-code with pauses
            </button>
            <button type="button" className="button" onClick={exportSheet}>
              <FileText size={15} />
              Export print sheet
            </button>
            <button type="button" className="button" onClick={exportPreview} disabled={!painting}>
              <Download size={15} />
              Export preview PNG
            </button>
            <button
              type="button"
              className="button"
              onClick={sendToSlicer}
              disabled={!painting || readOnly}
              title={
                related?.tools.includes('slicer')
                  ? 'Place the relief on this project’s build plate with the swaps as pauses'
                  : 'Add the Slicer tool to this project first'
              }
            >
              <Printer size={15} />
              Send to Slicer
            </button>
          </div>
        </aside>
      </div>
    </div>
  )
}

export type { Painting }
