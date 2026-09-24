import {
  emptyLibrary,
  parseLibrary,
  STORAGE_KEY,
  type Library,
  type StorageAccess,
} from './library'
import type { GraphDocument } from './graph/model'
import type { SheetDocument } from './sheet/model'
import type { CodeDocument } from './code/model'
import type { CanvasDocument } from './canvas/model'
import type { TextDocument } from './document/model'

export const MAX_BACKUP_BYTES = 10 * 1024 * 1024
export type RestoreMode = 'copies' | 'replace'
export type Backup = { library: Library; exportedAt?: string }
export type Drafts = {
  notes?: { id: string; value: string } | null
  graph?: { id: string; value: GraphDocument } | null
  sheet?: { id: string; value: SheetDocument } | null
  code?: { id: string; value: CodeDocument } | null
  canvas?: { id: string; value: CanvasDocument } | null
  document?: { id: string; value: TextDocument } | null
}

export function parseBackup(raw: string): Backup {
  if (new Blob([raw]).size > MAX_BACKUP_BYTES)
    throw new Error('This file is too large. Choose a Junga backup smaller than 10 MB.')
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    throw new Error('This file is not readable JSON. Choose a downloaded Junga library backup.')
  }
  if (typeof data !== 'object' || data === null || !('version' in data))
    throw new Error('This is not a Junga library backup.')
  if (data.version !== 1)
    throw new Error(
      'This backup uses an unsupported version. Open it with the Junga version that created it.',
    )
  let library: Library
  try {
    library = parseLibrary(raw)
  } catch {
    throw new Error(
      'This backup contains damaged or unsupported project data. Your current library has not been changed.',
    )
  }
  const exportedAt =
    'exportedAt' in data &&
    typeof data.exportedAt === 'string' &&
    Number.isFinite(Date.parse(data.exportedAt))
      ? data.exportedAt
      : undefined
  return {
    library: { version: 1, projects: library.projects, collections: library.collections },
    exportedAt,
  }
}

function uniqueName(value: string, used: Set<string>, max: number): string {
  let next = value,
    n = 1
  while (used.has(next.toLocaleLowerCase())) {
    const suffix = n === 1 ? ' (restored)' : ` (restored ${n})`
    next = value.slice(0, max - suffix.length) + suffix
    n++
  }
  used.add(next.toLocaleLowerCase())
  return next
}

export function restoreCopies(current: Library, backup: Library): Library {
  const names = new Set(current.collections.map((c) => c.name.toLocaleLowerCase()))
  const titles = new Set(current.projects.map((p) => p.title.toLocaleLowerCase()))
  const collectionIds = new Map<string, string>()
  const collections = backup.collections.map((c) => {
    const id = crypto.randomUUID()
    collectionIds.set(c.id, id)
    return { id, name: uniqueName(c.name, names, 60) }
  })
  const projects = structuredClone(backup.projects).map((p) => ({
    ...p,
    id: crypto.randomUUID(),
    outputs: p.outputs.map((output) => ({ ...output, id: crypto.randomUUID() })),
    title: uniqueName(p.title, titles, 100),
    collectionId: p.collectionId === null ? null : collectionIds.get(p.collectionId)!,
  }))
  return {
    version: 1,
    projects: [...projects, ...current.projects],
    collections: [...current.collections, ...collections],
  }
}

// Validate first, then perform one storage write. A stale preview must be reviewed again.
export function restoreBackup(
  storage: StorageAccess,
  backup: Library,
  mode: RestoreMode,
  expectedRaw: string | null,
): Library {
  const incoming = parseLibrary(JSON.stringify(backup))
  if (storage.getItem(STORAGE_KEY) !== expectedRaw)
    throw new Error(
      'Your stored library changed while this preview was open. Refresh the preview before restoring.',
    )
  let current = emptyLibrary()
  if (mode === 'copies') {
    try {
      current = parseLibrary(expectedRaw)
    } catch {
      throw new Error(
        'The current library cannot be read. Download its stored data, then choose Replace current library to recover from this backup.',
      )
    }
  }
  const next = mode === 'copies' ? restoreCopies(current, incoming) : incoming
  const raw = JSON.stringify(next)
  parseLibrary(raw)
  try {
    storage.setItem(STORAGE_KEY, raw)
  } catch {
    throw new Error(
      'The restored library could not be saved. Your stored data has not been replaced. Keep the backup file, free up browser storage, and try again.',
    )
  }
  return next
}

// Overlay failed-save drafts on a readable snapshot without writing to browser storage.
export function libraryWithDrafts(library: Library, drafts: Drafts): Library {
  const next = structuredClone(library)
  for (const key of ['notes', 'graph', 'sheet', 'code', 'canvas', 'document'] as const) {
    const draft = drafts[key]
    if (!draft) continue
    const project = next.projects.find((p) => p.id === draft.id)
    if (!project)
      throw new Error(
        'A draft belongs to a project missing from this library. Keep this page open and recover the project before downloading.',
      )
    if (key === 'notes') project.notes = drafts.notes!.value
    if (key === 'graph') project.graph = structuredClone(drafts.graph!.value)
    if (key === 'sheet') project.sheet = structuredClone(drafts.sheet!.value)
    if (key === 'code') project.code = structuredClone(drafts.code!.value)
    if (key === 'canvas') project.canvas = structuredClone(drafts.canvas!.value)
    if (key === 'document') project.document = structuredClone(drafts.document!.value)
    project.updatedAt = new Date().toISOString()
  }
  return parseLibrary(JSON.stringify(next))
}

export function downloadData(raw: string, prefix = 'junga-library') {
  const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${prefix}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function serializeBackup(library: Library): string {
  return JSON.stringify(
    { ...parseLibrary(JSON.stringify(library)), exportedAt: new Date().toISOString() },
    null,
    2,
  )
}
