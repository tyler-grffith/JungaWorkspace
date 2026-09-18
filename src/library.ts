export type Tool = 'graph' | 'sheet'
export type ProjectStatus = 'active' | 'archived' | 'trashed'
export type Collection = { id: string; name: string }
export type Project = {
  id: string
  title: string
  description: string
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
}
export type Library = { version: 1; projects: Project[]; collections: Collection[] }
export type ProjectInput = Pick<
  Project,
  'title' | 'description' | 'tools' | 'collectionId' | 'referenceUrl'
>
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

export function validateInput(input: ProjectInput, library: Library): ProjectInput {
  const title = name(input.title, 'Project name', 100)
  if (input.description.length > 500) throw new Error('Keep the description under 500 characters.')
  if (!input.tools.length || input.tools.some((tool) => tool !== 'graph' && tool !== 'sheet'))
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
    ...input,
    title,
    description: input.description.trim(),
    tools: [...new Set(input.tools)],
    referenceUrl,
  }
}

export function addProject(
  library: Library,
  input: ProjectInput,
  notes = '',
): { library: Library; project: Project } {
  const now = timestamp()
  const project: Project = {
    ...validateInput(input, library),
    id: crypto.randomUUID(),
    notes,
    favorite: false,
    status: 'active',
    trashedFrom: null,
    createdAt: now,
    updatedAt: now,
    openedAt: null,
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
  return addProject(library, { ...original, title }, original.notes)
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
        p.tools.length > 0 &&
        p.tools.length <= 2 &&
        new Set(p.tools).size === p.tools.length &&
        p.tools.every((t) => t === 'graph' || t === 'sheet') &&
        (p.collectionId === null || ids.has(p.collectionId)) &&
        ['active', 'archived', 'trashed'].includes(p.status as string) &&
        (p.status === 'trashed'
          ? ['active', 'archived'].includes(p.trashedFrom as string)
          : p.trashedFrom === null) &&
        isDate(p.createdAt) &&
        isDate(p.updatedAt) &&
        (p.openedAt === null || isDate(p.openedAt))
      if (!valid) return false
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
  return data as Library
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
  'Reference for the first graphing prototype.\n\nf(t) = e^(-t) sin(t), for t > 0\nf₂(t) = e^(a t), for t > 0\nfₚ(t) = sin(p t)\nzₜ(t) = f(t) f₂(t) fₚ(t)\nzₚ(t) = f(t) f₂(t)\n\nParameters in the reference: p = 3.8 (0 to 10); a = 1.16 (-0.5 to 2).\n\nSupport function definitions, dependencies, domain restrictions, sliders, and text notes in the graphing increment. This project currently stores the reference and notes; it does not calculate or import the graph.'
