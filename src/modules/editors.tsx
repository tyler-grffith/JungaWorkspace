// React half of the document-module registry: the editor, the outputs panel, the output
// viewer, and the library-card art for each document module. The shell renders from this, so
// a new module is one entry here and one in `documents.ts`.
//
// Editors and viewers are lazy: the library page loads only the shell, and a module's code
// arrives the first time one of its projects or outputs is opened. Outputs panels stay eager
// because they are small and render on the project overview.
import { lazy, type ComponentType, type ReactNode } from 'react'
import { Box, FileText, LibraryBig, Printer, Shapes, type LucideIcon } from 'lucide-react'
import type { Project } from '../library'
import type { Output } from '../outputs'
import type { DesignSettings } from '../design/registry'
import { emptyCanvas } from '../canvas/model'
import { emptyDocument } from '../document/model'
import { emptyCollections } from '../collection/model'
import { emptyModeler } from '../modeler/model'
import { emptySlicer, formatDuration } from '../slicer/model'
import CanvasOutputs from '../canvas/CanvasOutputs'
import DocumentOutputs from '../document/DocumentOutputs'
import CollectionOutputs from '../collection/CollectionOutputs'
import ModuleOutputs from './ModuleOutputs'
import '../workbench/workbench.css'
import type { DocumentTool, ModuleDocuments } from './documents'

/** The other document modules on the same project, so editors can hand work to each other. */
export type RelatedDocuments = {
  /** Document tools the project has (including the editor's own). */
  tools: readonly DocumentTool[]
  /** A sibling module's current document (its default when it was never opened). */
  get: <K extends DocumentTool>(tool: K) => ModuleDocuments[K]
  /** Save a sibling module's document at once; returns whether the write succeeded. */
  save: <K extends DocumentTool>(tool: K, next: ModuleDocuments[K]) => boolean
  /** Open a sibling module's editor. */
  open: (tool: DocumentTool) => void
}
export type EditorProps<D> = {
  title: string
  document: D
  readOnly: boolean
  unsaved: boolean
  onBack: () => void
  onChange: (next: D) => boolean
  related?: RelatedDocuments
}
export type OutputsProps<D> = {
  project: Project
  document: D
  onAdd: () => boolean
  onRemove: (outputId: string) => boolean
}
export type ViewerProps<D> = { project: Project; document: D; output: Output }
export type EditorModule<D> = {
  Editor: ComponentType<EditorProps<D>>
  Outputs: ComponentType<OutputsProps<D>>
  /** Renders the module's output on the read-only output route. */
  Viewer: ComponentType<ViewerProps<D>>
  /** The document a new project starts with, given the accepted design settings. */
  empty: (design: DesignSettings) => D
  /** Header label and icon on the output route. */
  outputLabel: string
  outputIcon: LucideIcon
  /** Card artwork for a project whose only tool is this module. */
  art: ReactNode
}

const CanvasEditor = lazy(() => import('../canvas/CanvasEditor'))
const CanvasPresenter = lazy(() => import('../canvas/CanvasPresenter'))
const DocumentEditor = lazy(() => import('../document/DocumentEditor'))
const DocumentReader = lazy(() => import('../document/DocumentReader'))
const CollectionEditor = lazy(() => import('../collection/CollectionEditor'))
const CollectionBrowser = lazy(() => import('../collection/CollectionBrowser'))
const ModelerEditor = lazy(() => import('../modeler/ModelerEditor'))
const ModelerViewport = lazy(() =>
  import('../modeler/ModelerEditor').then((m) => ({ default: m.ModelerViewport })),
)
const SlicerEditor = lazy(() => import('../slicer/SlicerEditor'))
const SlicerViewport = lazy(() =>
  import('../slicer/SlicerEditor').then((m) => ({ default: m.SlicerViewport })),
)

/** Shown while a module's code loads the first time it is opened. */
export function ModuleLoading({ what = 'editor' }: { what?: string }) {
  return (
    <div className="module-loading" role="status">
      Loading the {what}…
    </div>
  )
}

export const editorModules: { [K in DocumentTool]: EditorModule<ModuleDocuments[K]> } = {
  canvas: {
    Editor: CanvasEditor,
    Outputs: CanvasOutputs,
    Viewer: ({ document, output }) =>
      output.type === 'canvas-show' ? (
        <CanvasPresenter
          document={document}
          title={output.title}
          startPage={output.source.startPage}
          loop={output.source.loop}
        />
      ) : null,
    empty: (design) => emptyCanvas('deck', design.canvas.gridSize),
    outputLabel: 'Canvas output',
    outputIcon: Shapes,
    art: (
      <svg className="canvas-art" viewBox="0 0 320 140" fill="none" aria-hidden="true">
        <rect className="art-shape" x="24" y="30" width="96" height="60" rx="8" />
        <circle className="art-shape" cx="250" cy="60" r="34" />
        <path className="art-line" d="M120 60H206" />
        <path className="art-line" d="M196 50L208 60L196 70" />
        <path className="art-shape" d="M60 112L90 140H30Z" transform="translate(90 -20)" />
      </svg>
    ),
  },
  document: {
    Editor: DocumentEditor,
    Outputs: DocumentOutputs,
    Viewer: ({ document, output }) =>
      output.type === 'document-read' ? (
        <DocumentReader
          document={document}
          title={output.title}
          showOutline={output.source.showOutline}
        />
      ) : null,
    empty: (design) =>
      emptyDocument(
        { fontFamily: design.document.defaultFont, fontSize: design.document.defaultFontSize },
        { margin: design.document.defaultMargin },
      ),
    outputLabel: 'Document',
    outputIcon: FileText,
    art: (
      <svg className="document-art" viewBox="0 0 320 140" fill="none" aria-hidden="true">
        <rect className="art-page" x="96" y="8" width="128" height="150" rx="6" />
        <path className="art-text" d="M116 36H176M116 54H204M116 72H204M116 90H190M116 108H204" />
      </svg>
    ),
  },
  collection: {
    Editor: CollectionEditor,
    Outputs: CollectionOutputs,
    Viewer: ({ document, output }) =>
      output.type === 'collection-browse' ? (
        <CollectionBrowser
          document={document}
          title={output.title}
          startId={output.source.startId}
        />
      ) : null,
    empty: () => emptyCollections(),
    outputLabel: 'Collection',
    outputIcon: LibraryBig,
    art: (
      <svg className="collection-art" viewBox="0 0 320 140" fill="none" aria-hidden="true">
        <rect x="40" y="30" width="70" height="80" rx="8" />
        <rect x="125" y="30" width="70" height="80" rx="8" />
        <rect x="210" y="30" width="70" height="80" rx="8" />
      </svg>
    ),
  },
  modeler: {
    Editor: ModelerEditor,
    Outputs: ({ project, document, onAdd, onRemove }) => (
      <ModuleOutputs
        project={project}
        tool="modeler"
        heading="Model outputs"
        help="A model view shows the part read-only in the modeler viewport with its feature list."
        summary={`${document.features.length} features · ${document.material}`}
        onAdd={onAdd}
        onRemove={onRemove}
      />
    ),
    Viewer: ({ document, output }) => (
      <div className="workbench theme-light wb-output">
        <h1 className="visually-hidden">{output.title}</h1>
        <section className="wb-viewport" aria-label="Model">
          <ModelerViewport document={document} selectedFeature={null} section={false} />
        </section>
        <ul className="wb-output-list">
          {document.features.map((f) => (
            <li key={f.id}>{f.name}</li>
          ))}
          {!document.features.length && <li>No features yet.</li>}
        </ul>
      </div>
    ),
    empty: () => emptyModeler(),
    outputLabel: 'Model view',
    outputIcon: Box,
    art: (
      <svg className="canvas-art" viewBox="0 0 320 140" fill="none" aria-hidden="true">
        <path className="art-shape" d="M160 5L230 40V100L160 135L90 100V40Z" />
        <path className="art-line" d="M160 5V135M90 40L230 100M230 40L90 100" opacity="0.5" />
      </svg>
    ),
  },
  slicer: {
    Editor: SlicerEditor,
    Outputs: ({ project, document, onAdd, onRemove }) => (
      <ModuleOutputs
        project={project}
        tool="slicer"
        heading="Print outputs"
        help="A plate view shows the build plate read-only with its objects and the last estimate."
        summary={
          document.sliced
            ? `${formatDuration(document.sliced.seconds)} · ${document.sliced.grams} g`
            : `${document.plates.length} ${document.plates.length === 1 ? 'plate' : 'plates'} · not sliced`
        }
        onAdd={onAdd}
        onRemove={onRemove}
      />
    ),
    Viewer: ({ document, output }) => (
      <div className="workbench theme-dark wb-output">
        <h1 className="visually-hidden">{output.title}</h1>
        <section className="wb-viewport" aria-label="Build plate">
          <SlicerViewport document={document} selected={null} />
        </section>
        <ul className="wb-output-list">
          <li>{document.printer}</li>
          <li>
            {document.filament.type} · {document.process.layerHeight} mm layers ·{' '}
            {document.process.infill}% infill
          </li>
          {document.sliced && (
            <li>
              {formatDuration(document.sliced.seconds)} · {document.sliced.grams} g ·{' '}
              {document.sliced.layers} layers
            </li>
          )}
        </ul>
      </div>
    ),
    empty: () => emptySlicer(),
    outputLabel: 'Plate view',
    outputIcon: Printer,
    art: (
      <svg className="canvas-art" viewBox="0 0 320 140" fill="none" aria-hidden="true">
        <rect className="art-shape" x="70" y="96" width="180" height="16" rx="4" />
        <rect className="art-shape" x="120" y="46" width="60" height="50" rx="4" />
        <path className="art-line" d="M120 60H180M120 74H180M120 88H180" opacity="0.6" />
      </svg>
    ),
  },
}
