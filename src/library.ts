import {
  canvasShowOutput,
  codeRunOutput,
  earthClockOutput,
  validOutput,
  validOutputs,
  validManifest,
  type Output,
  type SourceManifest,
} from './outputs'
import {
  MAX_FILES,
  MAX_FILE_CHARS,
  MAX_TOTAL_CHARS,
  availablePath,
  emptyCode,
  entryCandidates,
  isTextPath,
  normalizePath,
  totalChars,
  validCode,
  type CodeDocument,
} from './code/model'
import {
  emptyGraph,
  laplaceGraph,
  LAPLACE_URL,
  validGraph,
  type GraphDocument,
} from './graph/model'
import { emptySheet, validSheet, type SheetDocument } from './sheet/model'
import { emptyCanvas, validCanvas, canvasProblem, type CanvasDocument } from './canvas/model'
import { TOOL_IDS, isTool, type Tool } from './modules/ids'

export type { Tool } from './modules/ids'
export type ProjectType = 'workable' | 'code'
export type ProjectStatus = 'active' | 'archived' | 'trashed'
export type Collection = { id: string; name: string }
export type Project = {
  id: string
  title: string
  description: string
  projectType: ProjectType
  outputs: Output[]
  sourceManifest?: SourceManifest
  tools: Tool[]
  collectionId: string | null
  notes: string
  referenceUrl: string
  favorite: boolean
  status: ProjectStatus
  trashedFrom: 'active' | 'archived' | null
  createdAt: string
  updatedAt: string
  openedAt: string | null
  graph?: GraphDocument
  sheet?: SheetDocument
  code?: CodeDocument
  canvas?: CanvasDocument
}
export type Library = { version: 1; projects: Project[]; collections: Collection[] }
export type ProjectInput = Pick<
  Project,
  'title' | 'description' | 'tools' | 'collectionId' | 'referenceUrl'
> & { projectType?: ProjectType }
export type View = 'all' | 'favorites' | 'archive' | 'trash' | `collection:${string}`
export type Sort = 'updated' | 'name' | 'created'
export const STORAGE_KEY = 'junga.library.v1'
export const emptyLibrary = (): Library => ({ version: 1, projects: [], collections: [] })
const timestamp = () => new Date().toISOString()
const name = (value: string, label: string, max: number) => {
  const clean = value.trim()
  if (!clean || clean.length > max)
    throw new Error(`${label} must be between 1 and ${max} characters.`)
  return clean
}

export function validateInput(
  input: ProjectInput,
  library: Library,
): ProjectInput & { projectType: ProjectType } {
  const title = name(input.title, 'Project name', 100)
  if (input.description.length > 500) throw new Error('Keep the description under 500 characters.')
  const projectType = input.projectType ?? 'workable'
  if (!['workable', 'code'].includes(projectType))
    throw new Error('Choose a supported project type.')
  if ((projectType === 'workable' && !input.tools.length) || !input.tools.every(isTool))
    throw new Error('Choose at least one tool.')
  if (input.collectionId && !library.collections.some((c) => c.id === input.collectionId))
    throw new Error('That collection no longer exists. Choose another collection.')
  const referenceUrl = input.referenceUrl.trim()
  if (referenceUrl) {
    let url: URL
    try {
      url = new URL(referenceUrl)
    } catch {
      throw new Error('Use a complete reference link starting with https:// or http://.')
    }
    if (!['http:', 'https:'].includes(url.protocol))
      throw new Error('Reference links must start with https:// or http://.')
  }
  return {
    title,
    projectType,
    description: input.description.trim(),
    tools: [...new Set(input.tools)],
    collectionId: input.collectionId,
    referenceUrl,
  }
}

export function addProject(
  library: Library,
  input: ProjectInput,
  notes = '',
  graph?: GraphDocument,
  sheet?: SheetDocument,
  code?: CodeDocument,
  canvas?: CanvasDocument,
): { library: Library; project: Project } {
  const now = timestamp()
  const project: Project = {
    ...validateInput(input, library),
    id: crypto.randomUUID(),
    outputs: [],
    notes,
    favorite: false,
    status: 'active',
    trashedFrom: null,
    createdAt: now,
    updatedAt: now,
    openedAt: null,
    ...(graph ? { graph: structuredClone(graph) } : {}),
    ...(sheet ? { sheet: structuredClone(sheet) } : {}),
    ...(code ? { code: structuredClone(code) } : {}),
    ...(canvas ? { canvas: structuredClone(canvas) } : {}),
  }
  return { library: { ...library, projects: [project, ...library.projects] }, project }
}

function changeProject(
  library: Library,
  id: string,
  change: (project: Project) => Project,
): Library {
  if (!library.projects.some((p) => p.id === id))
    throw new Error('This project is no longer available.')
  return { ...library, projects: library.projects.map((p) => (p.id === id ? change(p) : p)) }
}

export function editProject(library: Library, id: string, input: ProjectInput): Library {
  const fields = validateInput(input, library)
  return changeProject(library, id, (p) => {
    if (p.status === 'trashed') throw new Error('Restore this project before editing it.')
    if (!ownsOutputs({ projectType: fields.projectType, tools: fields.tools }) && p.outputs.length)
      throw new Error(
        'This project owns code or canvas outputs. Keep its code or canvas tool, or Code project type.',
      )
    if (fields.projectType !== 'code' && p.sourceManifest)
      throw new Error(
        'This project owns code material bundled with the app. Keep its Code project type.',
      )
    return { ...p, ...fields, updatedAt: timestamp() }
  })
}

export type ProjectAction = 'favorite' | 'archive' | 'activate' | 'trash' | 'restore' | 'open'
export function actOnProject(library: Library, id: string, action: ProjectAction): Library {
  return changeProject(library, id, (p) => {
    if (action === 'open') return { ...p, openedAt: timestamp() }
    if (action === 'restore') {
      if (p.status !== 'trashed') return p
      return { ...p, status: p.trashedFrom ?? 'active', trashedFrom: null, updatedAt: timestamp() }
    }
    if (p.status === 'trashed') return p
    if (action === 'favorite') return { ...p, favorite: !p.favorite, updatedAt: timestamp() }
    if (action === 'trash')
      return { ...p, status: 'trashed', trashedFrom: p.status, updatedAt: timestamp() }
    return { ...p, status: action === 'archive' ? 'archived' : 'active', updatedAt: timestamp() }
  })
}

export function saveNotes(library: Library, id: string, notes: string): Library {
  if (notes.length > 20000) throw new Error('Notes can contain up to 20,000 characters.')
  return changeProject(library, id, (p) => {
    if (p.status === 'trashed') throw new Error('Restore this project before editing its notes.')
    return { ...p, notes, updatedAt: timestamp() }
  })
}

export function duplicateProject(library: Library, id: string) {
  const original = library.projects.find((p) => p.id === id)
  if (!original) throw new Error('This project is no longer available.')
  const titles = new Set(library.projects.map((p) => p.title))
  const base = original.title.slice(0, 83)
  let title = `${base} (copy)`
  let n = 2
  while (titles.has(title)) title = `${base} (copy ${n++})`
  const result = addProject(
    library,
    { ...original, title },
    original.notes,
    original.graph,
    original.sheet,
    original.code,
    original.canvas,
  )
  result.project.outputs = structuredClone(original.outputs).map((output) => ({
    ...output,
    id: crypto.randomUUID(),
  }))
  if (original.sourceManifest)
    result.project.sourceManifest = structuredClone(original.sourceManifest)
  return result
}

export function saveGraph(library: Library, id: string, graph: GraphDocument): Library {
  if (!validGraph(graph)) throw new Error('The graph could not be saved. Check its settings.')
  return changeProject(library, id, (project) => {
    if (project.status === 'trashed')
      throw new Error('Restore this project before editing its graph.')
    if (!project.tools.includes('graph'))
      throw new Error('Add the graphing tool to this project before editing it.')
    return { ...project, graph, updatedAt: timestamp() }
  })
}

export function initializeGraph(library: Library, id: string): Library {
  const project = library.projects.find((p) => p.id === id)
  if (!project) throw new Error('This project is no longer available.')
  if (project.graph) return library
  return saveGraph(
    library,
    id,
    project.referenceUrl === LAPLACE_URL ? laplaceGraph() : emptyGraph(),
  )
}

export function saveSheet(library: Library, id: string, sheet: SheetDocument): Library {
  if (!validSheet(sheet))
    throw new Error('The spreadsheet could not be saved. Check its cells and dimensions.')
  return changeProject(library, id, (project) => {
    if (project.status === 'trashed')
      throw new Error('Restore this project before editing its spreadsheet.')
    if (!project.tools.includes('sheet'))
      throw new Error('Add the spreadsheet tool before editing its cells.')
    return { ...project, sheet, updatedAt: timestamp() }
  })
}

export function initializeSheet(library: Library, id: string): Library {
  const project = library.projects.find((p) => p.id === id)
  if (!project) throw new Error('This project is no longer available.')
  return project.sheet ? library : saveSheet(library, id, emptySheet())
}
export function saveCode(library: Library, id: string, code: CodeDocument): Library {
  if (!validCode(code))
    throw new Error('The files could not be saved. Check their names, sizes, and entry file.')
  return changeProject(library, id, (project) => {
    if (project.status === 'trashed')
      throw new Error('Restore this project before editing its files.')
    if (!project.tools.includes('code'))
      throw new Error('Add the code tool to this project before editing its files.')
    return { ...project, code, updatedAt: timestamp() }
  })
}

export function initializeCode(library: Library, id: string): Library {
  const project = library.projects.find((p) => p.id === id)
  if (!project) throw new Error('This project is no longer available.')
  return project.code ? library : saveCode(library, id, emptyCode())
}
export function saveCanvas(library: Library, id: string, canvas: CanvasDocument): Library {
  if (!validCanvas(canvas)) throw new Error(canvasProblem(canvas))
  return changeProject(library, id, (project) => {
    if (project.status === 'trashed')
      throw new Error('Restore this project before editing its canvas.')
    if (!project.tools.includes('canvas'))
      throw new Error('Add the canvas tool to this project before drawing on it.')
    return { ...project, canvas, updatedAt: timestamp() }
  })
}

export function initializeCanvas(library: Library, id: string): Library {
  const project = library.projects.find((p) => p.id === id)
  if (!project) throw new Error('This project is no longer available.')
  return project.canvas ? library : saveCanvas(library, id, emptyCanvas())
}
const initializers: Record<Tool, (library: Library, id: string) => Library> = {
  graph: initializeGraph,
  sheet: initializeSheet,
  code: initializeCode,
  canvas: initializeCanvas,
}
/** Create the saved document for each listed module if the project lacks it. */
export function initializeTools(library: Library, id: string, tools: readonly Tool[]): Library {
  return tools.reduce((current, tool) => initializers[tool](current, id), library)
}
export function saveWorkspace(
  library: Library,
  id: string,
  sheet: SheetDocument,
  graph: GraphDocument,
): Library {
  return saveGraph(saveSheet(library, id, sheet), id, graph)
}

export function saveCollection(library: Library, value: string, id?: string): Library {
  const clean = name(value, 'Collection name', 60)
  if (
    library.collections.some(
      (c) => c.id !== id && c.name.toLocaleLowerCase() === clean.toLocaleLowerCase(),
    )
  )
    throw new Error('A collection with that name already exists.')
  if (id && !library.collections.some((c) => c.id === id))
    throw new Error('This collection no longer exists.')
  const collections = id
    ? library.collections.map((c) => (c.id === id ? { ...c, name: clean } : c))
    : [...library.collections, { id: crypto.randomUUID(), name: clean }]
  return { ...library, collections }
}

export function removeCollection(library: Library, id: string): Library {
  return {
    ...library,
    collections: library.collections.filter((c) => c.id !== id),
    projects: library.projects.map((p) =>
      p.collectionId === id ? { ...p, collectionId: null } : p,
    ),
  }
}

export function selectProjects(
  library: Library,
  view: View,
  query = '',
  tool: Tool | 'all' = 'all',
  sort: Sort = 'updated',
): Project[] {
  const search = query.trim().toLocaleLowerCase()
  return library.projects
    .filter((p) => {
      const visible =
        view === 'archive'
          ? p.status === 'archived'
          : view === 'trash'
            ? p.status === 'trashed'
            : p.status === 'active' &&
              (view === 'all' ||
                (view === 'favorites' && p.favorite) ||
                (view.startsWith('collection:') && p.collectionId === view.slice(11)))
      return (
        visible &&
        (tool === 'all' || p.tools.includes(tool)) &&
        (!search || `${p.title} ${p.description} ${p.notes}`.toLocaleLowerCase().includes(search))
      )
    })
    .sort((a, b) =>
      sort === 'name'
        ? a.title.localeCompare(b.title)
        : (sort === 'created'
            ? b.createdAt.localeCompare(a.createdAt)
            : b.updatedAt.localeCompare(a.updatedAt)) || a.title.localeCompare(b.title),
    )
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const isDate = (v: unknown) => typeof v === 'string' && Number.isFinite(Date.parse(v))

export function parseLibrary(raw: string | null): Library {
  if (raw === null) return emptyLibrary()
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    throw new Error(
      'The saved library could not be read. Your stored data has been left untouched.',
    )
  }
  const invalid = () =>
    new Error(
      'This saved library has an unsupported or damaged format. Your stored data has been left untouched.',
    )
  if (
    !isRecord(data) ||
    data.version !== 1 ||
    !Array.isArray(data.projects) ||
    !Array.isArray(data.collections)
  )
    throw invalid()
  if (
    !data.collections.every(
      (c) =>
        isRecord(c) &&
        typeof c.id === 'string' &&
        c.id.length > 0 &&
        typeof c.name === 'string' &&
        c.name.trim().length > 0 &&
        c.name.length <= 60,
    )
  )
    throw invalid()
  const ids = new Set(data.collections.map((c) => c.id))
  if (ids.size !== data.collections.length) throw invalid()
  if (
    !data.projects.every((p) => {
      if (!isRecord(p)) return false
      const valid =
        typeof p.id === 'string' &&
        p.id.length > 0 &&
        typeof p.title === 'string' &&
        p.title.trim().length > 0 &&
        p.title.length <= 100 &&
        typeof p.description === 'string' &&
        p.description.length <= 500 &&
        typeof p.notes === 'string' &&
        p.notes.length <= 20000 &&
        typeof p.referenceUrl === 'string' &&
        typeof p.favorite === 'boolean' &&
        Array.isArray(p.tools) &&
        (p.projectType === 'code' || p.tools.length > 0) &&
        p.tools.length <= TOOL_IDS.length &&
        new Set(p.tools).size === p.tools.length &&
        p.tools.every(isTool) &&
        (p.collectionId === null || ids.has(p.collectionId)) &&
        ['active', 'archived', 'trashed'].includes(p.status as string) &&
        (p.status === 'trashed'
          ? ['active', 'archived'].includes(p.trashedFrom as string)
          : p.trashedFrom === null) &&
        isDate(p.createdAt) &&
        isDate(p.updatedAt) &&
        (p.openedAt === null || isDate(p.openedAt))
      if (!valid) return false
      if (p.projectType !== undefined && !['workable', 'code'].includes(p.projectType as string))
        return false
      if (p.outputs !== undefined && !validOutputs(p.outputs)) return false
      if (p.sourceManifest !== undefined && !validManifest(p.sourceManifest)) return false
      const ownsOutput =
        p.projectType === 'code' ||
        (p.tools as unknown[]).includes('code') ||
        (p.tools as unknown[]).includes('canvas')
      if (!ownsOutput && Array.isArray(p.outputs) && p.outputs.length) return false
      if (p.projectType !== 'code' && p.sourceManifest) return false
      if (p.graph !== undefined && !validGraph(p.graph)) return false
      if (p.sheet !== undefined && !validSheet(p.sheet)) return false
      if (p.code !== undefined && !validCode(p.code)) return false
      if (p.canvas !== undefined && !validCanvas(p.canvas)) return false
      if (p.referenceUrl) {
        try {
          if (!['http:', 'https:'].includes(new URL(p.referenceUrl as string).protocol))
            return false
        } catch {
          return false
        }
      }
      return true
    })
  )
    throw invalid()
  if (new Set(data.projects.map((p) => p.id)).size !== data.projects.length) throw invalid()
  // Upgrade in memory only; reading/reloading an old library never rewrites storage.
  return {
    ...data,
    projects: data.projects.map((p) => ({
      ...p,
      projectType: p.projectType ?? 'workable',
      outputs: p.outputs ?? [],
    })),
  } as Library
}

export type StorageAccess = Pick<Storage, 'getItem' | 'setItem'>
export function readLibrary(storage: StorageAccess): Library {
  return parseLibrary(storage.getItem(STORAGE_KEY))
}

// Read immediately before writing so edits do not overwrite another tab's newer library.
// A failed write never advances the in-memory library or reports a successful save.
export function commitLibrary(
  storage: StorageAccess,
  change: (current: Library) => Library,
): Library {
  const next = change(readLibrary(storage))
  const serialized = JSON.stringify(next)
  parseLibrary(serialized)
  try {
    storage.setItem(STORAGE_KEY, serialized)
  } catch {
    throw new Error(
      'Your change could not be saved. Browser storage may be full or unavailable. Free up space, then try again.',
    )
  }
  return next
}

export const starterInput: ProjectInput = {
  title: 'LaPlace Intuition',
  description:
    'Explore how exponential and sine functions combine. The first graphing reference for Junga.',
  tools: ['graph'],
  collectionId: null,
  referenceUrl: 'https://www.desmos.com/calculator/2awcmk9fzy',
}
export const starterNotes =
  'Reference for the first graphing prototype.\n\nf(t) = e^(-t) sin(t), for t > 0\nf₂(t) = e^(a t), for t > 0\nfₚ(t) = sin(p t)\nzₜ(t) = f(t) f₂(t) fₚ(t)\nzₚ(t) = f(t) f₂(t)\n\nParameters in the reference: p = 3.8 (0 to 10); a = 1.16 (-0.5 to 2).\n\nOpen the calculator to explore this recreated example with editable functions, sliders, domain restrictions, and graph notes. The original Desmos project remains linked as a reference.'

export function createCosmicClock(library: Library, collectionId: string | null = null) {
  const result = addProject(library, {
    projectType: 'code',
    title: 'Cosmic Clock',
    description: 'Source, assets, and scene defaults for a three-dimensional Earth clock.',
    tools: [],
    collectionId,
    referenceUrl: 'https://www.figma.com/design/RYHxY6TlREXHVtGa6GwZSa/Clock-Mockup',
  })
  result.project.sourceManifest = { kind: 'cosmic-clock', version: 1 }
  result.project.outputs = [earthClockOutput()]
  return result
}
const isHtml = (path: string) => /\.html?$/i.test(path)

/**
 * Check a file can be stored before copying it in, so the caller reports one clear reason
 * instead of a failed save. Returns '' when the file is storable.
 */
export function codeFileProblem(code: CodeDocument, path: string, content: string): string {
  const clean = normalizePath(path)
  if (!clean) return 'That file name cannot be stored in a code project.'
  if (!isTextPath(clean)) return 'A code project stores text files, so this file cannot be copied.'
  if (content.length > MAX_FILE_CHARS)
    return `This file is larger than the ${Math.round(MAX_FILE_CHARS / 1024)} KB limit for one file.`
  if (code.files.length >= MAX_FILES) return `That project already holds ${MAX_FILES} files.`
  if (totalChars([...code.files, { path: clean, content }]) > MAX_TOTAL_CHARS)
    return `That project would pass its ${Math.round(MAX_TOTAL_CHARS / 1024)} KB total limit.`
  return ''
}

/** Copy one text file into a project that holds the code tool, never replacing a file it has. */
export function addCodeFile(
  library: Library,
  projectId: string,
  path: string,
  content: string,
): Library {
  const project = library.projects.find((p) => p.id === projectId)
  if (!project) throw new Error('That project is no longer available.')
  if (project.status === 'trashed') throw new Error('Restore that project before copying into it.')
  if (!project.tools.includes('code')) throw new Error('Choose a project that has the code tool.')
  const code = project.code ?? emptyCode()
  const problem = codeFileProblem(code, path, content)
  if (problem) throw new Error(problem)
  const stored = availablePath(code.files, normalizePath(path))
  if (!stored) throw new Error('That project already holds too many copies of this file.')
  return saveCode(library, projectId, {
    ...code,
    entry: !code.entry && isHtml(stored) ? stored : code.entry,
    files: [...code.files, { path: stored, content }],
  })
}

/** Start a code project from one copied file, rather than the starter template. */
export function createCodeProjectWithFile(
  library: Library,
  title: string,
  path: string,
  content: string,
  collectionId: string | null = null,
) {
  const stored = normalizePath(path)
  const empty: CodeDocument = { version: 1, entry: '', files: [] }
  const problem = codeFileProblem(empty, stored, content)
  if (problem) throw new Error(problem)
  return addProject(
    library,
    { title, description: '', tools: ['code'], collectionId, referenceUrl: '' },
    '',
    undefined,
    undefined,
    { version: 1, entry: isHtml(stored) ? stored : '', files: [{ path: stored, content }] },
  )
}

/** Cosmic Clock projects and projects holding the code or canvas tool own outputs. */
export const ownsOutputs = (project: Pick<Project, 'projectType' | 'tools'>) =>
  project.projectType === 'code' ||
  project.tools.includes('code') ||
  project.tools.includes('canvas')

/** A presentation output that plays the project's canvas pages. */
export function addCanvasOutput(library: Library, projectId: string, title?: string): Library {
  return changeProject(library, projectId, (project) => {
    if (!project.tools.includes('canvas') || project.status === 'trashed')
      throw new Error('Add the canvas tool to this project outside the trash.')
    if (project.outputs.length >= 20) throw new Error('A project can contain up to 20 outputs.')
    return {
      ...project,
      outputs: [...project.outputs, canvasShowOutput(title || `${project.title} presentation`)],
      updatedAt: timestamp(),
    }
  })
}

export function addCodeOutput(library: Library, projectId: string, title?: string): Library {
  return changeProject(library, projectId, (project) => {
    if (!project.tools.includes('code') || project.status === 'trashed')
      throw new Error('Add the code tool to this project outside the trash.')
    if (project.outputs.length >= 20) throw new Error('A project can contain up to 20 outputs.')
    const code = project.code ?? emptyCode()
    const entry = code.entry || (entryCandidates(code)[0]?.path ?? '')
    if (!entry)
      throw new Error('Add an HTML file to this project before creating an output that runs it.')
    return {
      ...project,
      outputs: [...project.outputs, codeRunOutput(entry, title || `${project.title} output`)],
      updatedAt: timestamp(),
    }
  })
}

export function removeOutput(library: Library, projectId: string, outputId: string): Library {
  return changeProject(library, projectId, (project) => {
    if (project.status === 'trashed')
      throw new Error('Restore this project before removing its outputs.')
    if (!project.outputs.some((output) => output.id === outputId))
      throw new Error('This output is no longer available.')
    return {
      ...project,
      outputs: project.outputs.filter((output) => output.id !== outputId),
      updatedAt: timestamp(),
    }
  })
}

export function addEarthClock(library: Library, projectId: string): Library {
  return changeProject(library, projectId, (project) => {
    if (project.projectType !== 'code' || project.status === 'trashed')
      throw new Error('Choose a code project outside the trash.')
    if (project.outputs.length >= 20) throw new Error('A project can contain up to 20 outputs.')
    return {
      ...project,
      sourceManifest: { kind: 'cosmic-clock', version: 1 },
      outputs: [...project.outputs, earthClockOutput()],
      updatedAt: timestamp(),
    }
  })
}
export function saveOutput(
  library: Library,
  projectId: string,
  output: Output,
  expected?: Output,
): Library {
  if (!validOutput(output)) throw new Error('Check the output metadata and scene defaults.')
  return changeProject(library, projectId, (project) => {
    if (!ownsOutputs(project) || project.status === 'trashed')
      throw new Error('Restore this code project before editing its output.')
    const previous = project.outputs.find((item) => item.id === output.id)
    if (!previous) throw new Error('This output is no longer available.')
    if (expected && JSON.stringify(previous) !== JSON.stringify(expected))
      throw new Error(
        'This output changed in another tab. Cancel and reopen its settings before saving.',
      )
    return {
      ...project,
      outputs: project.outputs.map((item) =>
        item.id === output.id ? structuredClone(output) : item,
      ),
      updatedAt: timestamp(),
    }
  })
}
