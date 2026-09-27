// "Render for presentation": one static figure per module, drawn from the saved document with
// no interaction, so the same components serve the portfolio page in the app, the assembly
// editor's cards, and the standalone HTML export (through renderToStaticMarkup). Nothing here
// reads storage, uses hooks, or depends on a module's stylesheet: every figure is inline SVG or
// plain HTML with its colours inline, so it looks the same outside the app. A blog or any other
// presentation view can reuse `figureFor` and `previewSummary` as they are.
import { memo, type ReactNode } from 'react'
import type { Project } from '../library'
import type { Output } from '../outputs'
import { compileGraph } from '../graph/engine'
import { equalAxesFor, type GraphDocument } from '../graph/model'
import { equalScaleView, pointPath, sampleCurve, ticks, toPixel } from '../graph/plot'
import { sampleImplicit } from '../graph/implicit'
import { resolveSheetPlots } from '../linked/model'
import { calculateSheet, displayValue } from '../sheet/engine'
import { address, columnName, position, type SheetDocument } from '../sheet/model'
import { PageView } from '../canvas/render'
import { elementBounds, union } from '../canvas/geometry'
import { MODE_LABELS, type CanvasDocument } from '../canvas/model'
import { blocksToHtml } from '../document/html'
import { blockText, wordCount, type TextDocument } from '../document/model'
import { coverFor, type CollectionDocument } from '../collection/model'
import type { ModelerDocument } from '../modeler/model'
import {
  activePlate,
  bedFor,
  footprint,
  formatDuration,
  type SlicerDocument,
} from '../slicer/model'
import type { PainterDocument } from '../painter/model'
import type { CodeDocument } from '../code/model'

const FONT = "'DM Sans Variable', 'DM Sans', -apple-system, 'Segoe UI', sans-serif"
const safeId = (scope: string) => scope.replace(/[^a-z0-9_-]/gi, '')
const truncate = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text

// --- Graph -------------------------------------------------------------------------------------
const GW = 320
const GH = 200
export function GraphFigure({
  graph,
  sheet,
  title,
  scope,
}: {
  graph: GraphDocument
  sheet?: SheetDocument
  title: string
  scope: string
}) {
  const compiled = compileGraph(graph)
  const series = resolveSheetPlots(graph, sheet)
  const equal = equalAxesFor(
    graph,
    !!(series.length || compiled.points.length || compiled.implicitCurves.length),
  )
  const view = equal ? equalScaleView(graph.viewport, GW, GH) : graph.viewport
  const px = (p: { x: number; y: number }) => toPixel(p, view, GW, GH)
  // `label` on a sampled curve is the anchor point for its text; `text` is the engine's label.
  const curves = [
    ...compiled.curves.map((c) => ({
      id: c.entry.id,
      color: c.entry.color,
      text: c.label,
      ...sampleCurve(c, view, GW, GH),
    })),
    ...compiled.implicitCurves.map((c) => ({
      id: c.entry.id,
      color: c.entry.color,
      text: c.label,
      ...sampleImplicit(c, view, GW, GH),
    })),
  ].filter((c) => c.path)
  const origin = px({ x: 0, y: 0 })
  const xTicks = ticks(view.xMin, view.xMax, 5)
  const yTicks = ticks(view.yMin, view.yMax, 4)
  const clip = `clip-${safeId(scope)}`
  const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))
  return (
    <svg
      className="pf-figure-svg"
      viewBox={`0 0 ${GW} ${GH}`}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={`Graph: ${title}`}
    >
      <defs>
        <clipPath id={clip}>
          <rect width={GW} height={GH} />
        </clipPath>
      </defs>
      <rect width={GW} height={GH} fill="#fbfcfa" />
      {graph.showGrid && (
        <g stroke="#e7ece4" strokeWidth="1">
          {xTicks.map((x) => (
            <line key={`x${x}`} x1={px({ x, y: 0 }).x} x2={px({ x, y: 0 }).x} y1={0} y2={GH} />
          ))}
          {yTicks.map((y) => (
            <line key={`y${y}`} x1={0} x2={GW} y1={px({ x: 0, y }).y} y2={px({ x: 0, y }).y} />
          ))}
        </g>
      )}
      <g stroke="#8f9f86" strokeWidth="1.2">
        {origin.y >= 0 && origin.y <= GH && <line x1={0} x2={GW} y1={origin.y} y2={origin.y} />}
        {origin.x >= 0 && origin.x <= GW && <line x1={origin.x} x2={origin.x} y1={0} y2={GH} />}
      </g>
      <g
        fontFamily={FONT}
        fontSize="9"
        fill="#607255"
        stroke="#fbfcfa"
        strokeWidth="3"
        paintOrder="stroke"
      >
        {xTicks
          .filter((x) => x !== 0)
          .map((x) => (
            <text
              key={x}
              x={clamp(px({ x, y: 0 }).x, 12, GW - 14)}
              y={clamp(origin.y + 12, 12, GH - 4)}
              textAnchor="middle"
            >
              {formatTick(x)}
            </text>
          ))}
        {yTicks
          .filter((y) => y !== 0)
          .map((y) => (
            <text
              key={y}
              x={clamp(origin.x - 4, 22, GW - 6)}
              y={clamp(px({ x: 0, y }).y - 3, 10, GH - 8)}
              textAnchor="end"
            >
              {formatTick(y)}
            </text>
          ))}
      </g>
      <g clipPath={`url(#${clip})`}>
        {series.map(({ plot, points }) => (
          <g key={plot.id}>
            {plot.connect && (
              <path
                d={pointPath(points, view, GW, GH, plot.closed)}
                stroke={plot.color}
                strokeWidth={1.8}
                fill="none"
                strokeLinejoin="round"
              />
            )}
            {points.map(
              (point, i) =>
                point && (
                  <circle
                    key={i}
                    cx={px(point).x}
                    cy={px(point).y}
                    r={3.2}
                    fill={plot.color}
                    stroke="#fff"
                    strokeWidth={1}
                  />
                ),
            )}
          </g>
        ))}
        {compiled.points.map((point) => (
          <circle
            key={point.entry.id}
            cx={px(point).x}
            cy={px(point).y}
            r={3.6}
            fill={point.entry.color}
            stroke="#fff"
            strokeWidth={1}
          />
        ))}
        {curves.map((curve) => (
          <path
            key={curve.id}
            d={curve.path}
            stroke={curve.color}
            strokeWidth={1.8}
            fill="none"
            strokeLinejoin="round"
          />
        ))}
        {graph.showLabels &&
          curves.map(
            (curve) =>
              curve.label &&
              curve.text && (
                <text
                  key={`${curve.id}-label`}
                  x={px(curve.label).x + 5}
                  y={px(curve.label).y - 5}
                  fontFamily="'Cambria Math', Georgia, serif"
                  fontSize="10"
                  fill={curve.color}
                  stroke="#fbfcfa"
                  strokeWidth="3"
                  paintOrder="stroke"
                >
                  {truncate(curve.text, 22)}
                </text>
              ),
          )}
      </g>
    </svg>
  )
}
const formatTick = (value: number) =>
  Math.abs(value) >= 1e5 || Math.abs(value) < 0.001
    ? value.toExponential(1)
    : String(Number(value.toPrecision(4)))

// --- Spreadsheet ---------------------------------------------------------------------------------
export function SheetFigure({
  sheet,
  title,
  maxRows = 7,
  maxCols = 5,
}: {
  sheet: SheetDocument
  title: string
  maxRows?: number
  maxCols?: number
}) {
  const results = calculateSheet(sheet)
  const used = Object.entries(sheet.cells)
    .filter(([, cell]) => cell.input.trim())
    .map(([ref]) => position(ref))
    .filter((p): p is NonNullable<typeof p> => !!p)
  const top = used.length ? Math.min(...used.map((p) => p.row)) : 0
  const left = used.length ? Math.min(...used.map((p) => p.col)) : 0
  const rows = Array.from({ length: Math.min(maxRows, sheet.rows - top) }, (_, i) => top + i)
  const cols = Array.from({ length: Math.min(maxCols, sheet.columns - left) }, (_, i) => left + i)
  return (
    <table className="pf-sheet" aria-label={`Spreadsheet: ${title}`}>
      <thead>
        <tr>
          <th />
          {cols.map((col) => (
            <th key={col} scope="col">
              {columnName(col)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row}>
            <th scope="row">{row + 1}</th>
            {cols.map((col) => {
              const ref = address({ row, col })
              const cell = sheet.cells[ref]
              const result = results[ref]
              const text = displayValue(result, cell?.format)
              const numeric = typeof result?.value === 'number'
              return (
                <td
                  key={col}
                  style={{
                    fontWeight: cell?.format?.bold ? 650 : undefined,
                    textAlign: cell?.format?.align ?? (numeric ? 'right' : 'left'),
                    background:
                      cell?.format?.fill && cell.format.fill !== 'none'
                        ? cell.format.fill
                        : undefined,
                  }}
                >
                  {truncate(text, 14)}
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// --- Canvas ------------------------------------------------------------------------------------
export function CanvasFigure({
  canvas,
  pageId,
  scope,
}: {
  canvas: CanvasDocument
  pageId?: string
  scope: string
}) {
  const page = canvas.pages.find((p) => p.id === pageId) ?? canvas.pages[0]
  if (!page) return <EmptyFigure text="No canvases yet" />
  const margin = 40
  const bounds =
    canvas.page.infinite && page.elements.length
      ? (() => {
          const b = union(page.elements.map((e) => elementBounds(e, page)))
          return {
            x: b.x - margin,
            y: b.y - margin,
            width: b.width + margin * 2,
            height: b.height + margin * 2,
          }
        })()
      : { x: 0, y: 0, width: canvas.page.width, height: canvas.page.height }
  return (
    <PageView
      page={page}
      size={canvas.page}
      scope={`pf-${safeId(scope)}`}
      className="pf-figure-svg"
      bounds={bounds}
    />
  )
}

// --- Document ------------------------------------------------------------------------------------
export function DocumentFigure({ document: doc }: { document: TextDocument }) {
  const blocks = doc.blocks
    .filter((b) => b.type === 'image' || b.type === 'divider' || blockText(b).trim())
    .slice(0, 8)
  if (!blocks.length) return <EmptyFigure text="An empty page" />
  return (
    <div
      className="pf-doc"
      aria-hidden="true"
      style={{ fontFamily: doc.style.fontFamily }}
      dangerouslySetInnerHTML={{ __html: blocksToHtml(blocks) }}
    />
  )
}

// --- Collection ---------------------------------------------------------------------------------
export function CollectionFigure({ collection }: { collection: CollectionDocument }) {
  const covers = collection.items.map(coverFor).filter(Boolean).slice(0, 6)
  if (covers.length)
    return (
      <div className={`pf-covers count-${Math.min(covers.length, 6)}`} aria-hidden="true">
        {covers.map((src, i) => (
          <img key={i} src={src} alt="" loading="lazy" />
        ))}
      </div>
    )
  const roots = collection.rootIds
    .map((id) => collection.collections.find((c) => c.id === id))
    .filter((c): c is NonNullable<typeof c> => !!c)
  const shown = roots.flatMap((root) =>
    root.childIds.length
      ? root.childIds
          .map((id) => collection.collections.find((c) => c.id === id))
          .filter((c): c is NonNullable<typeof c> => !!c)
      : [root],
  )
  return (
    <div className="pf-tiles" aria-hidden="true">
      {shown.slice(0, 6).map((c) => (
        <span key={c.id} style={{ borderColor: c.accent }}>
          <span className="pf-tile-emoji">{c.emoji || '📁'}</span>
          <span className="pf-tile-name">{truncate(c.name, 18)}</span>
        </span>
      ))}
    </div>
  )
}

// --- Modeler -------------------------------------------------------------------------------------
export function ModelerFigure({ model, title }: { model: ModelerDocument; title: string }) {
  const features = model.features.filter((f) => !f.suppressed)
  return (
    <div className="pf-art">
      <svg viewBox="0 0 160 140" role="img" aria-label={`3D model: ${title}`}>
        <path
          d="M80 8L140 40V100L80 132L20 100V40Z"
          fill={model.color || '#d9e3d2'}
          stroke="#3f5a4b"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <path
          d="M80 8V72M20 40L80 72L140 40"
          fill="none"
          stroke="#3f5a4b"
          strokeWidth="2.5"
          strokeLinejoin="round"
          opacity="0.55"
        />
      </svg>
      <ul className="pf-chips">
        {features.slice(0, 5).map((f) => (
          <li key={f.id}>{truncate(f.name, 20)}</li>
        ))}
        {features.length > 5 && <li>+{features.length - 5}</li>}
        {!features.length && <li>No features yet</li>}
      </ul>
    </div>
  )
}

// --- Slicer -------------------------------------------------------------------------------------
export function SlicerFigure({ plate, title }: { plate: SlicerDocument; title: string }) {
  const bed = bedFor(plate.printer)
  const objects = activePlate(plate)?.objects ?? []
  const step = 50
  const lines: number[] = []
  for (let v = step; v < Math.max(bed.x, bed.y); v += step) lines.push(v)
  return (
    <svg
      className="pf-figure-svg"
      viewBox={`0 0 ${bed.x} ${bed.y}`}
      role="img"
      aria-label={`Build plate: ${title}, ${objects.length} ${objects.length === 1 ? 'object' : 'objects'}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width={bed.x} height={bed.y} fill="#1f2a26" />
      <g stroke="#2f3d37" strokeWidth="1">
        {lines
          .filter((v) => v < bed.x)
          .map((v) => (
            <line key={`x${v}`} x1={v} x2={v} y1={0} y2={bed.y} />
          ))}
        {lines
          .filter((v) => v < bed.y)
          .map((v) => (
            <line key={`y${v}`} x1={0} x2={bed.x} y1={v} y2={v} />
          ))}
      </g>
      {objects.map((o) => {
        const f = footprint(o)
        return (
          <rect
            key={o.id}
            x={bed.x / 2 + o.x - f.width / 2}
            y={bed.y / 2 - o.y - f.depth / 2}
            width={Math.max(1, f.width)}
            height={Math.max(1, f.depth)}
            rx={2}
            fill={o.color || '#7db27f'}
            stroke="#e8f0e6"
            strokeWidth="1.5"
            opacity="0.92"
          />
        )
      })}
    </svg>
  )
}

// --- Painter ------------------------------------------------------------------------------------
export function PainterFigure({ painting }: { painting: PainterDocument }) {
  return (
    <div className="pf-painting" aria-hidden="true">
      {painting.image ? (
        <img src={painting.image.src} alt="" />
      ) : (
        <span className="pf-empty">No picture yet</span>
      )}
      <span className="pf-swatches">
        {painting.stack.map((f) => (
          <span key={f.id} style={{ background: f.color }} title={f.name} />
        ))}
      </span>
    </div>
  )
}

// --- Code and scenes -------------------------------------------------------------------------------
export function CodeFigure({ code, entry }: { code: CodeDocument; entry?: string }) {
  const files = code.files.map((f) => f.path).sort()
  const main = entry || code.entry
  if (!files.length) return <EmptyFigure text="No files yet" />
  return (
    <pre className="pf-code" aria-hidden="true">
      {files.slice(0, 8).map((path) => (
        <span key={path} className={path === main ? 'is-entry' : ''}>
          {path === main ? '★ ' : '  '}
          {truncate(path, 32)}
          {'\n'}
        </span>
      ))}
      {files.length > 8 ? `  … ${files.length - 8} more` : ''}
    </pre>
  )
}
export function SceneFigure({ title, scope }: { title: string; scope: string }) {
  const id = `globe-${safeId(scope)}`
  return (
    <svg
      className="pf-figure-svg"
      viewBox="0 0 320 200"
      role="img"
      aria-label={`Interactive scene: ${title}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id={id} cx="38%" cy="35%" r="70%">
          <stop offset="0" stopColor="#4c8ac4" />
          <stop offset="0.55" stopColor="#1f4d7a" />
          <stop offset="1" stopColor="#0a1a2b" />
        </radialGradient>
      </defs>
      <rect width="320" height="200" fill="#080f15" />
      <circle cx="160" cy="100" r="72" fill={`url(#${id})`} />
      <path d="M160 28A72 72 0 0 1 160 172A40 72 0 0 0 160 28Z" fill="#03080e" opacity="0.55" />
      <path
        d="M118 70c12-8 26-6 34 4s22 6 30-2 18-2 24 8-6 20-18 22-22-4-32-2-24 10-32 2-16-24-6-32z"
        fill="#5a9a5a"
        opacity="0.8"
      />
    </svg>
  )
}

export function EmptyFigure({ text }: { text: string }) {
  return (
    <div className="pf-empty" aria-hidden="true">
      {text}
    </div>
  )
}

// --- Choosing a figure ---------------------------------------------------------------------------
/** Modules in the order their figure stands for a project that has several tools. */
const PRIORITY = [
  'painter',
  'canvas',
  'graph',
  'sheet',
  'document',
  'collection',
  'modeler',
  'slicer',
  'code',
] as const

/** The figure for a project, or for one of its outputs when one is featured. */
export function figureFor(project: Project, output?: Output, scope = project.id): ReactNode {
  const title = output?.title ?? project.title
  if (output) {
    switch (output.type) {
      case 'canvas-show':
        return project.canvas ? (
          <CanvasFigure canvas={project.canvas} pageId={output.source.startPage} scope={scope} />
        ) : (
          <EmptyFigure text="No canvases yet" />
        )
      case 'document-read':
        return project.document ? (
          <DocumentFigure document={project.document} />
        ) : (
          <EmptyFigure text="An empty page" />
        )
      case 'collection-browse':
        return project.collection ? (
          <CollectionFigure collection={project.collection} />
        ) : (
          <EmptyFigure text="No collections yet" />
        )
      case 'modeler-view':
        return project.modeler ? (
          <ModelerFigure model={project.modeler} title={title} />
        ) : (
          <EmptyFigure text="No model yet" />
        )
      case 'slicer-view':
        return project.slicer ? (
          <SlicerFigure plate={project.slicer} title={title} />
        ) : (
          <EmptyFigure text="An empty plate" />
        )
      case 'painter-view':
        return project.painter ? (
          <PainterFigure painting={project.painter} />
        ) : (
          <EmptyFigure text="No painting yet" />
        )
      case 'code-run':
        return project.code ? (
          <CodeFigure code={project.code} entry={output.source.entry} />
        ) : (
          <EmptyFigure text="No files yet" />
        )
      case 'interactive-scene':
        return <SceneFigure title={title} scope={scope} />
    }
  }
  if (project.projectType === 'code') {
    const scene = project.outputs.find((o) => o.type === 'interactive-scene')
    return scene ? (
      <SceneFigure title={scene.title} scope={scope} />
    ) : (
      <CodeFigure code={project.code ?? { version: 1, files: [], entry: '' }} />
    )
  }
  const tool = PRIORITY.find((t) => project.tools.includes(t))
  switch (tool) {
    case 'painter':
      return project.painter ? (
        <PainterFigure painting={project.painter} />
      ) : (
        <EmptyFigure text="No painting yet" />
      )
    case 'canvas':
      return project.canvas ? (
        <CanvasFigure canvas={project.canvas} scope={scope} />
      ) : (
        <EmptyFigure text="No canvases yet" />
      )
    case 'graph':
      return project.graph ? (
        <GraphFigure graph={project.graph} sheet={project.sheet} title={title} scope={scope} />
      ) : (
        <EmptyFigure text="An empty graph" />
      )
    case 'sheet':
      return project.sheet ? (
        <SheetFigure sheet={project.sheet} title={title} />
      ) : (
        <EmptyFigure text="An empty spreadsheet" />
      )
    case 'document':
      return project.document ? (
        <DocumentFigure document={project.document} />
      ) : (
        <EmptyFigure text="An empty page" />
      )
    case 'collection':
      return project.collection ? (
        <CollectionFigure collection={project.collection} />
      ) : (
        <EmptyFigure text="No collections yet" />
      )
    case 'modeler':
      return project.modeler ? (
        <ModelerFigure model={project.modeler} title={title} />
      ) : (
        <EmptyFigure text="No model yet" />
      )
    case 'slicer':
      return project.slicer ? (
        <SlicerFigure plate={project.slicer} title={title} />
      ) : (
        <EmptyFigure text="An empty plate" />
      )
    case 'code':
      return project.code ? <CodeFigure code={project.code} /> : <EmptyFigure text="No files yet" />
    default:
      return <EmptyFigure text={project.title} />
  }
}

/** One line of facts about what the figure shows: "5 curves · 2 sliders", "1,240 words". */
export function previewSummary(project: Project, output?: Output): string {
  const n = (count: number, one: string, many = `${one}s`) =>
    `${count.toLocaleString('en-US')} ${count === 1 ? one : many}`
  const kind = output
    ? (
        {
          'canvas-show': 'canvas',
          'document-read': 'document',
          'collection-browse': 'collection',
          'modeler-view': 'modeler',
          'slicer-view': 'slicer',
          'painter-view': 'painter',
          'code-run': 'code',
          'interactive-scene': 'scene',
        } as const
      )[output.type]
    : project.projectType === 'code'
      ? project.outputs.some((o) => o.type === 'interactive-scene')
        ? 'scene'
        : 'code'
      : PRIORITY.find((t) => project.tools.includes(t))
  switch (kind) {
    case 'graph': {
      const entries = project.graph?.entries ?? []
      const plots = entries.filter((e) => e.kind !== 'parameter' && e.kind !== 'note').length
      const sliders = entries.filter((e) => e.kind === 'parameter' && e.mode === 'slider').length
      return [n(plots, 'curve'), sliders ? n(sliders, 'slider') : ''].filter(Boolean).join(' · ')
    }
    case 'sheet': {
      const sheet = project.sheet
      const filled = sheet ? Object.values(sheet.cells).filter((c) => c.input.trim()).length : 0
      return `${n(filled, 'filled cell')}${sheet ? ` · ${sheet.rows} × ${sheet.columns}` : ''}`
    }
    case 'canvas': {
      const canvas = project.canvas
      return canvas
        ? `${n(canvas.pages.length, 'canvas', 'canvases')} · ${MODE_LABELS[canvas.mode]}`
        : 'Visual canvas'
    }
    case 'document':
      return project.document ? n(wordCount(project.document).words, 'word') : 'Document'
    case 'collection': {
      const doc = project.collection
      return doc
        ? `${n(doc.items.length, 'item')} · ${n(doc.collections.length, 'collection')}`
        : 'Collection'
    }
    case 'modeler': {
      const model = project.modeler
      return model
        ? `${n(model.features.filter((f) => !f.suppressed).length, 'feature')} · ${model.material}`
        : '3D model'
    }
    case 'slicer': {
      const plate = project.slicer
      if (!plate) return 'Print plate'
      const objects = activePlate(plate)?.objects.length ?? 0
      return plate.sliced
        ? `${formatDuration(plate.sliced.seconds)} · ${plate.sliced.grams} g · ${n(objects, 'object')}`
        : `${n(objects, 'object')} · not sliced`
    }
    case 'painter': {
      const painting = project.painter
      return painting
        ? `${n(painting.stack.length, 'filament')} · ${n(painting.maxLayers, 'layer')} · ${painting.width} mm wide`
        : 'Filament painting'
    }
    case 'code':
      return project.code ? n(project.code.files.length, 'file') : 'Bundled source'
    case 'scene':
      return 'Interactive scene'
    default:
      return ''
  }
}

/** A project's figure in a box; memoized because portfolio editing never changes the project. */
export const ProjectPreview = memo(function ProjectPreview({
  project,
  output,
  scope,
}: {
  project: Project
  output?: Output
  scope?: string
}) {
  return <div className="pf-figure">{figureFor(project, output, scope ?? project.id)}</div>
})
