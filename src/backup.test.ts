import { describe, expect, it } from 'vitest'
import {
  addProject,
  actOnProject,
  emptyLibrary,
  parseLibrary,
  saveCollection,
  starterInput,
  type Library,
  type StorageAccess,
} from './library'
import { laplaceGraph } from './graph/model'
import { motionExample } from './sheet/model'
import {
  libraryWithDrafts,
  MAX_BACKUP_BYTES,
  parseBackup,
  restoreBackup,
  restoreCopies,
  serializeBackup,
} from './backup'

function fixture() {
  const lib = saveCollection(emptyLibrary(), 'Engineering')
  const added = addProject(
    lib,
    { ...starterInput, tools: ['graph', 'sheet'], collectionId: lib.collections[0].id },
    'Model notes',
    laplaceGraph(),
    motionExample(),
  )
  return actOnProject(
    actOnProject(added.library, added.project.id, 'archive'),
    added.project.id,
    'trash',
  )
}
function storage(raw: string | null) {
  let value = raw
  let writes = 0
  return {
    getItem: () => value,
    setItem: (_key: string, next: string) => {
      value = next
      writes++
    },
    get writes() {
      return writes
    },
  }
}
describe('backup recovery', () => {
  it('accepts legacy downloads and round trips full current backups with a date', () => {
    const library = fixture()
    expect(parseBackup(JSON.stringify(library))).toEqual({ library })
    const backup = parseBackup(serializeBackup(library))
    expect(backup.library.projects).toEqual(library.projects)
    expect(backup.library.collections).toEqual(library.collections)
    expect(Number.isFinite(Date.parse(backup.exportedAt!))).toBe(true)
  })
  it('rejects malformed JSON, wrong formats, future versions, damaged tools, duplicate IDs, and oversized files', () => {
    expect(() => parseBackup('broken')).toThrow('JSON')
    expect(() => parseBackup('null')).toThrow('not a Junga')
    expect(() => parseBackup('{"version":2}')).toThrow('unsupported version')
    const library = fixture()
    expect(() =>
      parseBackup(
        JSON.stringify({ ...library, projects: [...library.projects, ...library.projects] }),
      ),
    ).toThrow('damaged')
    library.projects[0].sheet!.rows = -1
    expect(() => parseBackup(JSON.stringify(library))).toThrow('damaged')
    expect(() => parseBackup(' '.repeat(MAX_BACKUP_BYTES + 1))).toThrow('too large')
  })
  it('restores independent copies, resolving names and collection links while preserving lifecycle and both tools', () => {
    const current = fixture(),
      before = structuredClone(current)
    const next = restoreCopies(current, current)
    const copy = next.projects[0],
      original = next.projects[1]
    expect(current).toEqual(before)
    expect(original).toEqual(before.projects[0])
    expect(copy.id).not.toBe(original.id)
    expect(copy.title).toBe('LaPlace Intuition (restored)')
    expect(next.collections[1].name).toBe('Engineering (restored)')
    expect(copy.collectionId).toBe(next.collections[1].id)
    expect(copy).toMatchObject({
      status: 'trashed',
      trashedFrom: 'archived',
      notes: 'Model notes',
      graph: original.graph,
      sheet: original.sheet,
    })
    copy.sheet!.cells.A1.input = 'Copy only'
    expect(original.sheet!.cells.A1.input).not.toBe('Copy only')
    expect(restoreCopies(next, current).projects[0].title).toBe('LaPlace Intuition (restored 2)')
    expect(() => parseLibrary(JSON.stringify(next))).not.toThrow()
  })
  it('keeps names within their limits and preserves empty collections', () => {
    const library = saveCollection(emptyLibrary(), 'c'.repeat(60))
    const added = addProject(library, { ...starterInput, title: 'x'.repeat(100) }).library
    const next = restoreCopies(added, added)
    expect(next.projects[0].title).toHaveLength(100)
    expect(next.collections[1].name).toHaveLength(60)
    expect(next.projects[0].collectionId).toBeNull()
    expect(() => parseLibrary(JSON.stringify(next))).not.toThrow()
  })
  it('replaces exactly in one write, including recovering unreadable storage', () => {
    for (const raw of [null, '{broken', JSON.stringify(emptyLibrary())]) {
      const store = storage(raw),
        backup = fixture()
      expect(restoreBackup(store, backup, 'replace', raw)).toEqual(backup)
      expect(parseLibrary(store.getItem())).toEqual(backup)
      expect(store.writes).toBe(1)
    }
  })
  it('rejects stale previews, invalid data, and copies into unreadable storage without writing', () => {
    const store = storage('{broken')
    expect(() => restoreBackup(store, fixture(), 'replace', null)).toThrow('changed')
    expect(() => restoreBackup(store, fixture(), 'copies', '{broken')).toThrow('cannot be read')
    const invalid = { ...fixture(), version: 2 } as unknown as Library
    expect(() => restoreBackup(store, invalid, 'replace', '{broken')).toThrow()
    expect(store.writes).toBe(0)
    expect(store.getItem()).toBe('{broken')
  })
  it('keeps previous data on storage failure and can retry successfully', () => {
    const old = JSON.stringify(fixture()),
      store = storage(old)
    const full: StorageAccess = {
      getItem: store.getItem,
      setItem: () => {
        throw new Error('Full')
      },
    }
    expect(() => restoreBackup(full, emptyLibrary(), 'replace', old)).toThrow('not been replaced')
    expect(store.getItem()).toBe(old)
    restoreBackup(store, emptyLibrary(), 'replace', old)
    expect(parseLibrary(store.getItem())).toEqual(emptyLibrary())
  })
  it('exports unsaved notes, graph and sheet as a valid restorable snapshot without changing saved data', () => {
    const base = fixture(),
      before = structuredClone(base),
      id = base.projects[0].id
    const graph = laplaceGraph(),
      sheet = motionExample()
    graph.entries = []
    sheet.cells.B2.input = '99'
    const snapshot = libraryWithDrafts(base, {
      notes: { id, value: 'Unsaved notes' },
      graph: { id, value: graph },
      sheet: { id, value: sheet },
    })
    expect(base).toEqual(before)
    const store = storage(null)
    restoreBackup(store, parseBackup(serializeBackup(snapshot)).library, 'copies', null)
    const p = JSON.parse(store.getItem()! as string).projects[0]
    expect(p.notes).toBe('Unsaved notes')
    expect(p.graph.entries).toEqual([])
    expect(p.sheet.cells.B2.input).toBe('99')
    expect(() => libraryWithDrafts(base, { notes: { id: 'missing', value: 'keep' } })).toThrow(
      'missing',
    )
  })
})
