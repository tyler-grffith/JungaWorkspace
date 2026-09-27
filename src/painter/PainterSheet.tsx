// The pieces both the editor and the read-only output show: a hook that turns the saved image
// into a painting, the pixel canvases (printed preview, heightmap), the colour ramp with its swap
// marks, the swap list, and the print sheet that puts them together.
import { useEffect, useMemo, useRef, useState } from 'react'
import { gridFor, printedHeight, type PainterDocument } from './model'
import { paint, printStats, ramp, rgbToHex, scrubPixels, type Painting } from './paint'
import './painter.css'

/** The image's pixels scaled to the working grid; null until the image has loaded. */
export function usePixels(src: string | null, cols: number, rows: number) {
  const [pixels, setPixels] = useState<Uint8ClampedArray | null>(null)
  useEffect(() => {
    if (!src) {
      setPixels(null)
      return
    }
    let cancelled = false
    const image = new Image()
    image.onload = () => {
      if (cancelled) return
      const canvas = document.createElement('canvas')
      canvas.width = cols
      canvas.height = rows
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(image, 0, 0, cols, rows)
      setPixels(ctx.getImageData(0, 0, cols, rows).data)
    }
    image.onerror = () => !cancelled && setPixels(null)
    image.src = src
    return () => {
      cancelled = true
    }
  }, [src, cols, rows])
  return pixels
}
/** The painting for a document, recomputed as the recipe changes; pass pixels already read. */
export function usePainting(
  doc: PainterDocument,
  given?: Uint8ClampedArray | null,
): Painting | null {
  const { cols, rows } = gridFor(doc)
  const own = usePixels(given === undefined ? (doc.image?.src ?? null) : null, cols, rows)
  const pixels = given === undefined ? own : given
  return useMemo(() => (pixels ? paint(pixels, cols, rows, doc) : null), [pixels, cols, rows, doc])
}

/**
 * Draws the painting as the print will look, as a heightmap (taller is lighter), as the print
 * after a given layer, or as the original beside the print split at a percentage.
 */
export function PaintingCanvas({
  painting,
  doc,
  mode,
  label,
  layer,
  split,
}: {
  painting: Painting
  doc: PainterDocument
  mode: 'printed' | 'heightmap' | 'scrub' | 'compare'
  label: string
  layer?: number
  split?: number
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    canvas.width = painting.cols
    canvas.height = painting.rows
    let rgba: Uint8ClampedArray
    if (mode === 'printed') rgba = painting.preview
    else if (mode === 'heightmap') rgba = heightmapPixels(painting.layers, doc.maxLayers)
    else if (mode === 'scrub') rgba = scrubPixels(painting, doc, layer ?? doc.maxLayers)
    else {
      rgba = new Uint8ClampedArray(painting.preview)
      const source = painting.source ?? painting.preview
      const edge = Math.round((painting.cols * (split ?? 50)) / 100)
      for (let r = 0; r < painting.rows; r++)
        for (let c = 0; c < edge; c++) {
          const i = (r * painting.cols + c) * 4
          rgba[i] = source[i]
          rgba[i + 1] = source[i + 1]
          rgba[i + 2] = source[i + 2]
        }
      for (let r = 0; r < painting.rows; r++)
        if (edge > 0 && edge < painting.cols)
          rgba.set([255, 255, 255, 255], (r * painting.cols + edge) * 4)
    }
    ctx.putImageData(
      new ImageData(rgba as Uint8ClampedArray<ArrayBuffer>, painting.cols, painting.rows),
      0,
      0,
    )
  }, [painting, mode, doc, layer, split])
  return (
    <canvas
      ref={ref}
      className="painter-canvas"
      role="img"
      aria-label={label}
      style={{ aspectRatio: `${painting.cols} / ${painting.rows}` }}
    />
  )
}
function heightmapPixels(layers: Uint8Array, maxLayers: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(layers.length * 4)
  for (let i = 0; i < layers.length; i++) {
    const v = Math.round((layers[i] / maxLayers) * 255)
    out.set([v, v, v, 255], i * 4)
  }
  return out
}

/** The colour seen at each layer count, bottom to top, with a mark where each spool starts. */
export function RampBar({ doc }: { doc: PainterDocument }) {
  const steps = ramp(doc)
  return (
    <div className="painter-ramp" aria-label="Colour by layer">
      <div className="painter-ramp-colors">
        {steps.map((s) => (
          <span
            key={s.layer}
            title={`Layer ${s.layer} · ${s.height.toFixed(2)} mm · ${s.filament.name}`}
            style={{ background: rgbToHex(s.color) }}
            className={s.layer <= doc.baseLayers ? 'base' : undefined}
          />
        ))}
      </div>
      <div className="painter-ramp-marks">
        {doc.stack.map((f) => (
          <span
            key={f.id}
            style={{ left: `${((f.startLayer - 1) / doc.maxLayers) * 100}%` }}
            title={`${f.name} from layer ${f.startLayer}`}
          >
            <i style={{ background: f.color }} />
            {f.startLayer}
          </span>
        ))}
      </div>
    </div>
  )
}

export function SwapList({ doc }: { doc: PainterDocument }) {
  const [base, ...rest] = doc.stack
  return (
    <ol className="painter-swaps">
      <li>
        <i className="painter-swatch" style={{ background: base.color }} />
        <span>
          Start with <strong>{base.name}</strong>
        </span>
      </li>
      {rest.map((f) => (
        <li key={f.id}>
          <i className="painter-swatch" style={{ background: f.color }} />
          <span>
            Layer <strong>{f.startLayer}</strong> at{' '}
            {(Math.round((f.startLayer - 1) * doc.layerHeight * 1000) / 1000).toFixed(2)} mm: change
            to <strong>{f.name}</strong>
          </span>
        </li>
      ))}
    </ol>
  )
}

export function Stats({ doc, painting }: { doc: PainterDocument; painting: Painting | null }) {
  const s = printStats(doc, painting)
  const h = Math.floor(s.seconds / 3600)
  const m = Math.round((s.seconds % 3600) / 60)
  const rows: [string, string][] = [
    [
      'Size',
      `${doc.width} × ${Math.round(printedHeight(doc))} mm${doc.frame?.width ? ` + ${doc.frame.width} mm frame` : ''}`,
    ],
    ['Height', `${s.height} mm · ${doc.maxLayers} layers of ${doc.layerHeight} mm`],
    ['Grid', `${s.cols} × ${s.rows} pixels`],
    ['Filament', painting ? `about ${s.grams} g` : 'add an image'],
    ['Print time', painting ? `about ${h ? `${h}h ${m}m` : `${m}m`}` : '—'],
    ['Colour error', painting ? `ΔE ${s.error.toFixed(1)}` : '—'],
  ]
  return (
    <dl className="painter-stats">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  )
}

/** The read-only output: the printed preview and everything needed at the printer. */
export default function PainterSheet({
  document: doc,
  title,
}: {
  document: PainterDocument
  title: string
}) {
  const painting = usePainting(doc)
  return (
    <article className="painter-sheet-page">
      <h1>{title}</h1>
      <div className="painter-sheet-body">
        <div className="painter-sheet-picture">
          {painting ? (
            <PaintingCanvas painting={painting} doc={doc} mode="printed" label="Printed preview" />
          ) : (
            <p className="painter-empty">This painting has no image yet.</p>
          )}
          <RampBar doc={doc} />
        </div>
        <aside aria-label="Print sheet">
          <h2>Print sheet</h2>
          <Stats doc={doc} painting={painting} />
          <SwapList doc={doc} />
          <p className="painter-hint">
            Print at 100% infill with one wall; pause at each listed layer and swap spools.
          </p>
          {doc.notes && <p className="painter-notes">{doc.notes}</p>}
        </aside>
      </div>
    </article>
  )
}
