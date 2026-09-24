// Registry of "document modules": tools whose saved data is one versioned document on the
// project, edited by one editor and presented by one read-only output. Graph, sheet, and code
// keep their explicit wiring (their editors share state with each other); every newer module
// registers here and gets storage, validation, backup drafts, outputs, and the shell's editor
// host for free. Adding a module is one entry here plus one in `editors.tsx`. No React.
import { canvasProblem, emptyCanvas, validCanvas, type CanvasDocument } from '../canvas/model'
import { documentProblem, emptyDocument, validDocument, type TextDocument } from '../document/model'
import {
  collectionsProblem,
  emptyCollections,
  validCollections,
  type CollectionDocument,
} from '../collection/model'
import {
  canvasShowOutput,
  collectionBrowseOutput,
  documentReadOutput,
  modelerViewOutput,
  painterViewOutput,
  slicerViewOutput,
  type Output,
} from '../outputs'
import { emptyModeler, modelerProblem, validModeler, type ModelerDocument } from '../modeler/model'
import { emptySlicer, slicerProblem, validSlicer, type SlicerDocument } from '../slicer/model'
import { emptyPainter, painterProblem, validPainter, type PainterDocument } from '../painter/model'

export type ModuleDocuments = {
  canvas: CanvasDocument
  document: TextDocument
  collection: CollectionDocument
  modeler: ModelerDocument
  slicer: SlicerDocument
  painter: PainterDocument
}
export type DocumentTool = keyof ModuleDocuments
export const DOCUMENT_TOOLS = [
  'canvas',
  'document',
  'collection',
  'modeler',
  'slicer',
  'painter',
] as const satisfies readonly DocumentTool[]
export const isDocumentTool = (value: unknown): value is DocumentTool =>
  DOCUMENT_TOOLS.includes(value as DocumentTool)

export type DocumentModule<D> = {
  /** Strict validation of a saved document. */
  valid: (value: unknown) => value is D
  /** A human-readable reason a document cannot be saved. */
  problem: (document: D) => string
  /** The document a project starts with when the tool is first opened. */
  empty: () => D
  /** What a user calls the thing this module edits, for messages. */
  noun: string
  /** The read-only output this module publishes on the output route. */
  output: { type: Output['type']; make: (title: string) => Output; addLabel: string }
}
export const documentModules: { [K in DocumentTool]: DocumentModule<ModuleDocuments[K]> } = {
  canvas: {
    valid: validCanvas,
    problem: canvasProblem,
    empty: () => emptyCanvas(),
    noun: 'canvas',
    output: {
      type: 'canvas-show',
      make: (title) => canvasShowOutput(`${title} presentation`),
      addLabel: 'Add canvas output',
    },
  },
  document: {
    valid: validDocument,
    problem: documentProblem,
    empty: () => emptyDocument(),
    noun: 'document',
    output: {
      type: 'document-read',
      make: (title) => documentReadOutput(title),
      addLabel: 'Add reading output',
    },
  },
  collection: {
    valid: validCollections,
    problem: collectionsProblem,
    empty: () => emptyCollections(),
    noun: 'collections',
    output: {
      type: 'collection-browse',
      make: (title) => collectionBrowseOutput(title),
      addLabel: 'Add browse output',
    },
  },
  modeler: {
    valid: validModeler,
    problem: modelerProblem,
    empty: () => emptyModeler(),
    noun: 'model',
    output: {
      type: 'modeler-view',
      make: (title) => modelerViewOutput(`${title} model`),
      addLabel: 'Add model view',
    },
  },
  slicer: {
    valid: validSlicer,
    problem: slicerProblem,
    empty: () => emptySlicer(),
    noun: 'print project',
    output: {
      type: 'slicer-view',
      make: (title) => slicerViewOutput(`${title} plate`),
      addLabel: 'Add plate view',
    },
  },
  painter: {
    valid: validPainter,
    problem: painterProblem,
    empty: () => emptyPainter(),
    noun: 'painting',
    output: {
      type: 'painter-view',
      make: (title) => painterViewOutput(`${title} print sheet`),
      addLabel: 'Add print sheet output',
    },
  },
}
/** Drafts of module documents that failed to save, keyed by tool. */
export type ModuleDrafts = {
  [K in DocumentTool]?: { id: string; value: ModuleDocuments[K] } | null
}
