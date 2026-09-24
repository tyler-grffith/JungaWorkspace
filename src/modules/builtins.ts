// Built-in projects. Every example is a project that exists in every library, whatever the
// user's saved data: the app merges the pristine projects over what is stored, keeps only the
// ones the user has changed ("overlays") in storage, and can put any of them back to the
// original. Shortcuts are the built-ins the sidebar links to directly. No React.
import { examples, exampleById, type ExampleProject } from './examples'
import {
  addExampleProject,
  emptyLibrary,
  type ExampleDocuments,
  type Library,
  type Project,
} from '../library'

export const BUILT_IN_PREFIX = 'example-'
/** The date every pristine built-in carries; earlier registry entries read as more recent. */
export const BUILT_IN_DATE = '2026-09-24T12:00:00.000Z'
export const builtInId = (exampleId: string) => `${BUILT_IN_PREFIX}${exampleId}`
/** The example behind a built-in project id, if the id is one. */
export const builtInExample = (projectId: string): ExampleProject | undefined =>
  projectId.startsWith(BUILT_IN_PREFIX)
    ? exampleById(projectId.slice(BUILT_IN_PREFIX.length))
    : undefined

/** Heavy material an example loads on demand, kept once loaded for the rest of the session. */
const loaded = new Map<string, ExampleDocuments>()
const loading = new Map<string, Promise<void>>()
const listeners = new Set<() => void>()
let pristine: Project[] | null = null

function build(example: ExampleProject, index: number): Project {
  const id = builtInId(example.id)
  const { project } = addExampleProject(emptyLibrary(), {
    id: example.id,
    input: example.input,
    notes: example.notes,
    documents: { ...example.documents(), ...(loaded.get(example.id) ?? {}) },
    outputs: example.outputs?.(),
    sourceManifest: example.sourceManifest,
  })
  const date = new Date(Date.parse(BUILT_IN_DATE) - index * 60000).toISOString()
  return {
    ...project,
    id,
    builtIn: true,
    createdAt: date,
    updatedAt: date,
    // Stable output ids, so an output route survives a reload.
    outputs: project.outputs.map((output, i) => ({ ...output, id: `${id}-output-${i + 1}` })),
  }
}
/** The pristine built-in projects, built once per session. */
export function builtInProjects(): readonly Project[] {
  pristine ??= examples.map(build)
  return pristine
}
/** Forget the session's pristine projects (tests). */
export function resetBuiltInCache() {
  pristine = null
  loaded.clear()
}

/** Whether a built-in still waits for material its example loads on demand. */
export function builtInNeedsLoad(project: Project): boolean {
  const example = builtInExample(project.id)
  return (
    !!example?.loadDocuments &&
    !loaded.has(example.id) &&
    example.tools.some((tool) => !project[tool])
  )
}
/** Load an example's on-demand material once; listeners learn when the pristine project changed. */
export function loadBuiltInDocuments(projectId: string): Promise<void> {
  const example = builtInExample(projectId)
  if (!example?.loadDocuments || loaded.has(example.id)) return Promise.resolve()
  let pending = loading.get(example.id)
  if (!pending) {
    pending = example.loadDocuments().then(
      (documents) => {
        loaded.set(example.id, documents)
        loading.delete(example.id)
        if (pristine)
          pristine = pristine.map((p, i) => (p.id === projectId ? build(example, i) : p))
        for (const listener of listeners) listener()
      },
      (error) => {
        loading.delete(example.id)
        throw error
      },
    )
    loading.set(example.id, pending)
  }
  return pending
}
export function subscribeBuiltIns(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** The library as the app sees it: the user's projects plus every built-in, edited or pristine. */
export function mergeBuiltIns(stored: Library): Library {
  const overlays = new Map(
    stored.projects.filter((p) => builtInExample(p.id)).map((p) => [p.id, p] as const),
  )
  const own = stored.projects.filter((p) => !builtInExample(p.id))
  const merged = builtInProjects().map((p) => {
    const overlay = overlays.get(p.id)
    return overlay ? { ...overlay, builtIn: true, exampleId: p.exampleId } : p
  })
  return { ...stored, projects: [...own, ...merged] }
}
/** The library as storage keeps it: built-ins only when they differ from the original. */
export function stripBuiltIns(library: Library): Library {
  const base = new Map(builtInProjects().map((p) => [p.id, p] as const))
  return {
    ...library,
    projects: library.projects.filter((p) => {
      const original = base.get(p.id)
      if (!original) return true
      return p !== original && JSON.stringify(p) !== JSON.stringify(original)
    }),
  }
}
/** Put a built-in back to its original; the user's changes to it are discarded. */
export function resetBuiltIn(library: Library, projectId: string): Library {
  const original = builtInProjects().find((p) => p.id === projectId)
  if (!original) throw new Error('Only built-in examples can be reset to their original.')
  return { ...library, projects: library.projects.map((p) => (p.id === projectId ? original : p)) }
}

/** The shortcut examples named by a comma-separated list of ids, in that order. */
export function shortcutExamples(ids: string): ExampleProject[] {
  return ids
    .split(',')
    .map((id) => exampleById(id.trim()))
    .filter((example): example is ExampleProject => !!example)
}
