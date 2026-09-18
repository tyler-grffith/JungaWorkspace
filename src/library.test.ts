import { describe, expect, it } from 'vitest'
import {
  actOnProject,
  addProject,
  commitLibrary,
  duplicateProject,
  editProject,
  emptyLibrary,
  parseLibrary,
  readLibrary,
  removeCollection,
  saveCollection,
  saveNotes,
  saveGraph,
  initializeGraph,
  selectProjects,
  STORAGE_KEY,
  starterInput,
  type Library,
  type StorageAccess,
} from './library'
import { laplaceGraph } from './graph/model'

const create = () => addProject(emptyLibrary(), starterInput)
function memoryStorage(initial: Library = emptyLibrary()): StorageAccess {
  const values = new Map([[STORAGE_KEY, JSON.stringify(initial)]])
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value)
    },
  }
}

describe('project lifecycle', () => {
  it('creates, saves notes, renames, and reopens a project without losing its identity or contents', () => {
    const { library, project } = create()
    const storage = memoryStorage(library)
    commitLibrary(storage, (current) =>
      saveNotes(current, project.id, 'Keep this model and its assumptions.'),
    )
    commitLibrary(storage, (current) =>
      editProject(current, project.id, { ...starterInput, title: '  Revised model  ' }),
    )
    commitLibrary(storage, (current) => actOnProject(current, project.id, 'open'))
    const reopened = readLibrary(storage).projects[0]
    expect(reopened.id).toBe(project.id)
    expect(reopened.title).toBe('Revised model')
    expect(reopened.notes).toBe('Keep this model and its assumptions.')
    expect(reopened.referenceUrl).toBe(starterInput.referenceUrl)
    expect(reopened.openedAt).not.toBeNull()
  })

  it('restores trashed projects to their original active or archived location', () => {
    for (const archived of [false, true]) {
      const { library, project } = create()
      let next = saveNotes(library, project.id, 'Irreplaceable notes')
      if (archived) next = actOnProject(next, project.id, 'archive')
      next = actOnProject(next, project.id, 'trash')
      next = actOnProject(next, project.id, 'trash')
      expect(selectProjects(next, 'all')).toHaveLength(0)
      expect(selectProjects(next, 'trash')).toHaveLength(1)
      expect(() => saveNotes(next, project.id, 'overwrite')).toThrow('Restore')
      next = actOnProject(next, project.id, 'restore')
      expect(next.projects[0].status).toBe(archived ? 'archived' : 'active')
      expect(next.projects[0].notes).toBe('Irreplaceable notes')
      expect(next.projects[0].trashedFrom).toBeNull()
    }
  })

  it('duplicates content with a new identity and a unique name', () => {
    const { library, project } = create()
    const original = saveNotes(library, project.id, 'Seed content')
    const first = duplicateProject(original, project.id)
    const second = duplicateProject(first.library, project.id)
    expect(new Set(second.library.projects.map((p) => p.id)).size).toBe(3)
    expect(second.project.title).toBe('LaPlace Intuition (copy 2)')
    expect(second.project.notes).toBe('Seed content')
    const updated = saveNotes(second.library, second.project.id, 'Only the copy changes')
    expect(updated.projects.find((p) => p.id === project.id)?.notes).toBe('Seed content')
  })

  it('keeps all project content when a collection is removed', () => {
    let library = saveCollection(emptyLibrary(), 'Engineering')
    const collectionId = library.collections[0].id
    const added = addProject(library, { ...starterInput, collectionId }, 'Keep me')
    library = actOnProject(added.library, added.project.id, 'archive')
    library = removeCollection(library, collectionId)
    expect(library.collections).toEqual([])
    expect(library.projects[0]).toMatchObject({
      collectionId: null,
      status: 'archived',
      notes: 'Keep me',
    })
  })

  it('filters favorites, collections, tools, and text without exposing archived or trashed projects', () => {
    let library = saveCollection(emptyLibrary(), 'Coursework')
    const collection = library.collections[0]
    const one = addProject(
      library,
      { ...starterInput, collectionId: collection.id },
      'oscillations',
    )
    library = actOnProject(one.library, one.project.id, 'favorite')
    const two = addProject(library, { ...starterInput, title: 'Sheet', tools: ['sheet'] })
    library = two.library
    expect(selectProjects(library, 'all', 'OSCILLATIONS', 'graph')).toHaveLength(1)
    expect(selectProjects(library, 'favorites')).toHaveLength(1)
    expect(selectProjects(library, `collection:${collection.id}`)).toHaveLength(1)
    expect(selectProjects(library, 'all', '', 'sheet')[0].title).toBe('Sheet')
    library = actOnProject(library, one.project.id, 'archive')
    expect(selectProjects(library, 'favorites')).toHaveLength(0)
    expect(selectProjects(library, `collection:${collection.id}`)).toHaveLength(0)
    expect(selectProjects(library, 'archive')).toHaveLength(1)
  })

  it('rejects blank names, missing collections, unsafe links, and duplicate collection names', () => {
    expect(() => addProject(emptyLibrary(), { ...starterInput, title: ' ' })).toThrow(
      'Project name',
    )
    expect(() => addProject(emptyLibrary(), { ...starterInput, tools: [] })).toThrow('tool')
    expect(() => addProject(emptyLibrary(), { ...starterInput, collectionId: 'gone' })).toThrow(
      'collection',
    )
    expect(() =>
      addProject(emptyLibrary(), { ...starterInput, referenceUrl: 'javascript:alert(1)' }),
    ).toThrow('https://')
    const library = saveCollection(emptyLibrary(), 'Science')
    expect(() => saveCollection(library, ' science ')).toThrow('already exists')
  })
})

describe('storage integrity', () => {
  it('opens legacy projects without replacing their notes or graph after initialization', () => {
    const { library, project } = create()
    const legacy = parseLibrary(JSON.stringify(library))
    expect(legacy.projects[0].graph).toBeUndefined()
    const initialized = initializeGraph(
      saveNotes(legacy, project.id, 'My existing notes'),
      project.id,
    )
    expect(initialized.projects[0].graph?.entries).toHaveLength(8)
    expect(initialized.projects[0].notes).toBe('My existing notes')
    expect(initializeGraph(initialized, project.id)).toBe(initialized)
  })

  it('preserves graphs through duplication, metadata edits, archive, trash, restoration, and reload', () => {
    const { library, project } = create()
    const graph = laplaceGraph()
    const saved = saveGraph(library, project.id, graph)
    const copied = duplicateProject(saved, project.id)
    expect(copied.project.graph).toEqual(graph)
    expect(copied.project.graph).not.toBe(graph)
    let next = saveGraph(copied.library, copied.project.id, { ...graph, entries: [] })
    next = editProject(next, project.id, { ...starterInput, title: 'Renamed', tools: ['sheet'] })
    expect(next.projects.find((p) => p.id === project.id)?.graph).toEqual(graph)
    expect(() => saveGraph(next, project.id, graph)).toThrow('Add the graphing tool')
    next = editProject(next, project.id, starterInput)
    next = actOnProject(next, project.id, 'archive')
    next = actOnProject(next, project.id, 'trash')
    expect(() => saveGraph(next, project.id, graph)).toThrow('Restore')
    next = actOnProject(next, project.id, 'restore')
    const original = parseLibrary(JSON.stringify(next)).projects.find((p) => p.id === project.id)!
    expect(original.graph).toEqual(graph)
    expect(original.status).toBe('archived')
  })

  it('rejects invalid graph payloads without changing storage', () => {
    const { library, project } = create()
    const storage = memoryStorage(library)
    const graph = { ...laplaceGraph(), viewport: { xMin: 5, xMax: 1, yMin: -1, yMax: 1 } }
    expect(() =>
      commitLibrary(storage, (current) => saveGraph(current, project.id, graph)),
    ).toThrow('could not be saved')
    expect(readLibrary(storage)).toEqual(library)
    expect(() =>
      parseLibrary(JSON.stringify({ ...library, projects: [{ ...project, graph }] })),
    ).toThrow('untouched')
  })
  it('treats absent data as a new library, but rejects corrupted and unknown-version data', () => {
    expect(parseLibrary(null)).toEqual(emptyLibrary())
    expect(() => parseLibrary('broken')).toThrow('untouched')
    expect(() => parseLibrary('{"version":2,"projects":[],"collections":[]}')).toThrow('untouched')
    const { library } = create()
    library.projects[0].referenceUrl = 'javascript:alert(1)'
    expect(() => parseLibrary(JSON.stringify(library))).toThrow('untouched')
  })

  it('leaves the stored library untouched if it cannot be read or a write fails', () => {
    let written = false
    expect(() =>
      commitLibrary(
        {
          getItem: () => 'bad data',
          setItem: () => {
            written = true
          },
        },
        () => emptyLibrary(),
      ),
    ).toThrow()
    expect(written).toBe(false)
    const { library } = create()
    const raw = JSON.stringify(library)
    const full = {
      getItem: () => raw,
      setItem: () => {
        throw new DOMException('Full', 'QuotaExceededError')
      },
    }
    expect(() => commitLibrary(full, () => emptyLibrary())).toThrow('could not be saved')
    expect(readLibrary(full)).toEqual(library)
  })

  it('reads the most recent persisted state when applying another tab’s change', () => {
    const storage = memoryStorage()
    commitLibrary(storage, (current) => addProject(current, starterInput).library)
    commitLibrary(storage, (current) => saveCollection(current, 'Second tab'))
    expect(readLibrary(storage).projects).toHaveLength(1)
    expect(readLibrary(storage).collections).toHaveLength(1)
  })

  it('rejects duplicate IDs and orphan collection references', () => {
    const { library, project } = create()
    expect(() =>
      parseLibrary(JSON.stringify({ ...library, projects: [project, project] })),
    ).toThrow()
    expect(() =>
      parseLibrary(
        JSON.stringify({ ...library, projects: [{ ...project, collectionId: 'missing' }] }),
      ),
    ).toThrow()
  })
})
