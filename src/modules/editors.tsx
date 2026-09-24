// React half of the document-module registry: the editor, the outputs panel, the output
// viewer, and the library-card art for each document module. The shell renders from this, so
// a new module is one entry here and one in `documents.ts`.
import type { ComponentType, ReactNode } from 'react'
import { FileText, LibraryBig, Shapes, type LucideIcon } from 'lucide-react'
import type { Project } from '../library'
import type { Output } from '../outputs'
import type { DesignSettings } from '../design/registry'
import { emptyCanvas } from '../canvas/model'
import { emptyDocument } from '../document/model'
import { emptyCollections } from '../collection/model'
import CanvasEditor from '../canvas/CanvasEditor'
import CanvasOutputs from '../canvas/CanvasOutputs'
import CanvasPresenter from '../canvas/CanvasPresenter'
import DocumentEditor from '../document/DocumentEditor'
import DocumentOutputs from '../document/DocumentOutputs'
import DocumentReader from '../document/DocumentReader'
import CollectionEditor from '../collection/CollectionEditor'
import CollectionOutputs from '../collection/CollectionOutputs'
import CollectionBrowser from '../collection/CollectionBrowser'
import type { DocumentTool, ModuleDocuments } from './documents'

export type EditorProps<D> = {
  title: string
  document: D
  readOnly: boolean
  unsaved: boolean
  onBack: () => void
  onChange: (next: D) => boolean
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
}
