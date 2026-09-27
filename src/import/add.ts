// The library side of importing: the shape a prepared import has, how it is added, and Junga's
// own single-project file (export and parse). Kept apart from the file readers in
// `importers.ts` so the shell can add imports and export projects without loading every
// module importer; the import dialog loads those on demand. No React.
import {
  addProject,
  parseLibrary,
  type ExampleDocuments,
  type Library,
  type Project,
  type ProjectInput,
} from '../library'
import type { Output } from '../outputs'
import { restoreCopies } from '../backup'

export type ImportKind =
  | 'canvas'
  | 'document'
  | 'sheet'
  | 'code'
  | 'slicer'
  | 'painter'
  | 'collection'
  | 'project'
  | 'backup'
/** What one import will add to the library, ready for `addImported`. */
export type Prepared = {
  kind: ImportKind
  title: string
  input: Omit<ProjectInput, 'collectionId' | 'title'>
  documents: ExampleDocuments
  outputs: Output[]
  notes: string
  /** One line for the dialog: what was read. */
  summary: string
  /** For `project`: the exported project to copy in, instead of documents. */
  project?: Project
}

/** Add a prepared import to the library; an exported project comes in as an independent copy. */
export function addImported(
  library: Library,
  prepared: Prepared,
  collectionId: string | null,
): { library: Library; project: Project } {
  if (prepared.project) {
    const next = restoreCopies(library, {
      version: 1,
      projects: [{ ...prepared.project, collectionId: null }],
      collections: [],
    })
    const project = { ...next.projects[0], collectionId }
    return {
      library: { ...next, projects: next.projects.map((p) => (p.id === project.id ? project : p)) },
      project,
    }
  }
  const result = addProject(
    library,
    { ...prepared.input, title: prepared.title, collectionId },
    prepared.notes,
    prepared.documents.graph,
    prepared.documents.sheet,
    prepared.documents.code,
    prepared.documents,
  )
  result.project.outputs = prepared.outputs
  return result
}

// --- Junga's single-project file --------------------------------------------------------------
export type ProjectFile = { junga: 'project'; version: 1; exportedAt: string; project: Project }
/** One project as a file of its own, so it can move between libraries without a whole backup. */
export function serializeProject(project: Project): string {
  const { builtIn, ...rest } = project
  void builtIn
  const file: ProjectFile = {
    junga: 'project',
    version: 1,
    exportedAt: new Date().toISOString(),
    project: rest as Project,
  }
  return JSON.stringify(file, null, 2)
}
export const projectFilename = (project: Project) =>
  `${
    project.title
      .replace(/[^a-z0-9-_ ]/gi, '')
      .trim()
      .replace(/\s+/g, '-')
      .toLowerCase() || 'project'
  }.junga-project.json`
/** Validate an exported project by reading it as a one-project library. */
export function parseProjectFile(raw: string): Project {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    throw new Error('This file is not readable JSON.')
  }
  const record = data as Record<string, unknown> | null
  if (!record || record.junga !== 'project' || record.version !== 1 || !record.project)
    throw new Error('This file is not an exported Junga project.')
  const project = { ...(record.project as Record<string, unknown>), collectionId: null }
  let library: Library
  try {
    library = parseLibrary(JSON.stringify({ version: 1, projects: [project], collections: [] }))
  } catch {
    throw new Error('This exported project is damaged or from a newer Junga.')
  }
  return library.projects[0]
}

/** Hand the browser a text file to save. */
export function downloadText(text: string, filename: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
