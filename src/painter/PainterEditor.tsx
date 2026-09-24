// PLA Painter: an image becomes a filament painting, in the manner of HueForge and Chroma
// Canvas. Settings on the left (image, size, layers, adjustments, the filament stack), the
// picture in the middle (printed preview, heightmap, original, painted 3D relief), and the print
// sheet on the right (numbers, swap plan, exports, and a hand-off to the project's slicer).
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
  Trash2,
} from 'lucide-react'
import type { EditorProps } from '../modules/editors'
import { readImageFile } from '../canvas/images'
import { downloadBlob, safeFilename } from '../canvas/export'
import Viewport3D, { type SceneItem } from '../workbench/Viewport3D'
import { compact, decimate, settle, toStl, triangleCount } from '../workbench/geometry'
import { BED_SIZE, MAX_TRIANGLES, activePlate, arrange, meshObject } from '../slicer/model'
import {
  FILAMENT_PRESETS,
  MAX_STACK,
  gridFor,
  newFilament,
  normalizeStack,
  painterProblem,
  printedHeight,
  spaceSwapsEvenly,
  totalHeight,
  validPainter,
  type Filament,
  type PainterDocument,
} from './model'
import { downsample, printSheet, relief, reliefMesh, type Painting } from './paint'
import { PaintingCanvas, RampBar, Stats, SwapList, usePainting } from './PainterSheet'
import '../canvas/canvas.css'
import './painter.css'

type View = 'printed' | 'heightmap' | 'original' | 'relief'
const VIEWS: { id: View; label: string }[] = [
  { id: 'printed', label: 'Printed' },
  { id: 'heightmap', label: 'Heightmap' },
  { id: 'original', label: 'Original' },
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
  const fileInput = useRef<HTMLInputElement>(null)
  const painting = usePainting(doc)
  const grid = gridFor(doc)

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

  // --- Exports ------------------------------------------------------------------------------------
  const name = safeFilename(title) || 'painting'
  function exportStl() {
    if (!painting) return setMessage('Add an image first.')
    downloadBlob(toStl(reliefMesh(downsample(painting, STL_CELLS), doc), title), `${name}.stl`)
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
  /** Put the relief on the project's slicer plate and its swap plan in the slicer's notes. */
  function sendToSlicer() {
    if (!related?.tools.includes('slicer'))
      return setMessage('Add the Slicer tool to this project to send paintings to it.')
    if (!painting) return setMessage('Add an image first.')
    const slicer = related.get('slicer')
    const plate = activePlate(slicer)
    const mesh = compact(
      settle(decimate(reliefMesh(downsample(painting, SLICER_CELLS), doc), MAX_TRIANGLES)),
    )
    const object = meshObject(title, mesh, plate.objects.length)
    const placed = arrange(
      { ...plate, objects: [...plate.objects, object] },
      BED_SIZE[slicer.printer] ?? 256,
    )
    const sheet = printSheet(title, doc, painting)
    const notes = [slicer.notes, sheet].filter(Boolean).join('\n\n').slice(0, 20000)
    const saved = related.save('slicer', {
      ...slicer,
      plates: slicer.plates.map((p) => (p.id === plate.id ? placed : p)),
      notes,
      sliced: null,
      view: 'prepare',
    })
    if (saved) related.open('slicer')
    else setMessage('The relief would pass the slicer’s storage budget.')
  }

  const reliefScene = useMemo<{ items: SceneItem[]; triangles: number } | null>(() => {
    if (!painting || view !== 'relief') return null
    const { mesh, colors } = relief(downsample(painting, RELIEF_PREVIEW_CELLS), doc)
    return {
      items: [{ kind: 'mesh', mesh, fill: doc.stack[0].color, colors, stroke: null }],
      triangles: triangleCount(mesh),
    }
  }, [painting, view, doc])

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
            <h2 id="painter-adjust-heading">Adjust</h2>
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
            )}
            <p className="painter-note">
              Transmission distances are approximate; measure your own spools for faithful colours.
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
            ) : (
              <PaintingCanvas
                painting={painting}
                doc={doc}
                mode={view === 'heightmap' ? 'heightmap' : 'printed'}
                label={view === 'heightmap' ? 'Heightmap' : 'Printed preview'}
              />
            )}
          </div>
          <RampBar doc={doc} />
        </div>

        <aside className="painter-sheet" aria-label="Print sheet">
          <h2>Print sheet</h2>
          <Stats doc={doc} painting={painting} />
          <SwapList doc={doc} />
          <p className="painter-hint">
            Print at 100% infill with one wall; pause at each listed layer and swap spools.
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
                  ? 'Place the relief on this project’s build plate'
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
