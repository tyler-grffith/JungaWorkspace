import { describe, expect, it } from 'vitest'
import {
  addCollection,
  addItem,
  coverFor,
  deepItemCount,
  emptyCollections,
  fileItem,
  hasCycle,
  itemsOf,
  linkCollection,
  newItem,
  removeItem,
  toMarkdown,
  unlinkCollection,
  updateCollection,
  validCollections,
  youtubeId,
} from './model'
import {
  addCollectionOutput,
  addProject,
  duplicateProject,
  emptyLibrary,
  initializeTools,
  parseLibrary,
  saveCollections,
  starterInput,
} from '../library'
import { libraryWithDrafts, parseBackup, serializeBackup } from '../backup'

const seed = () => {
  let doc = emptyCollections()
  const root = doc.rootIds[0]
  const music = addCollection(doc, root, 'music')
  doc = music.document
  const albums = addCollection(doc, music.collection.id, 'custom', 'Albums')
  doc = albums.document
  const song = newItem('Blue in Green')
  song.link = 'https://music.youtube.com/watch?v=abc123XYZ_-'
  doc = addItem(doc, music.collection.id, song)
  return { doc, root, music: music.collection.id, albums: albums.collection.id, song: song.id }
}

describe('collection model', () => {
  it('nests collections as a graph, shares children, and refuses loops', () => {
    const { doc, root, music, albums } = seed()
    expect(validCollections(doc)).toBe(true)
    const shared = linkCollection(doc, root, albums)
    expect(shared.collections.find((c) => c.id === root)?.childIds).toContain(albums)
    expect(validCollections(shared)).toBe(true)
    expect(linkCollection(shared, albums, music)).toBe(shared)
    const looped = updateCollection(shared, albums, (c) => ({ ...c, childIds: [music] }))
    expect(hasCycle(looped)).toBe(true)
    expect(validCollections(looped)).toBe(false)
  })
  it('shares items between collections and removes them only when nothing holds them', () => {
    const { doc, music, albums, song } = seed()
    const filed = fileItem(doc, albums, song)
    expect(
      itemsOf(
        filed,
        filed.collections.find((c) => c.id === albums)!,
      ),
    ).toHaveLength(1)
    expect(deepItemCount(filed, music)).toBe(1)
    const fromMusic = removeItem(filed, music, song)
    expect(fromMusic.items).toHaveLength(1)
    const fromAll = removeItem(fromMusic, albums, song)
    expect(fromAll.items).toHaveLength(0)
  })
  it('unlinking a shared collection keeps it; unlinking the last parent deletes it and its lone items', () => {
    const { doc, root, music, albums, song } = seed()
    const shared = linkCollection(doc, root, albums)
    const stillThere = unlinkCollection(shared, music, albums)
    expect(stillThere.collections.some((c) => c.id === albums)).toBe(true)
    const gone = unlinkCollection(doc, root, music)
    expect(gone.collections.some((c) => c.id === music)).toBe(false)
    expect(gone.collections.some((c) => c.id === albums)).toBe(false)
    expect(gone.items.some((i) => i.id === song)).toBe(false)
    expect(validCollections(gone)).toBe(true)
  })
  it('derives covers from YouTube links and writes readable Markdown', () => {
    expect(youtubeId('https://music.youtube.com/watch?v=abc123XYZ_-')).toBe('abc123XYZ_-')
    expect(youtubeId('https://youtu.be/xyz')).toBe('xyz')
    expect(youtubeId('https://example.com/watch?v=1')).toBeNull()
    const { doc } = seed()
    const item = doc.items[0]
    expect(coverFor(item)).toBe('https://img.youtube.com/vi/abc123XYZ_-/hqdefault.jpg')
    const md = toMarkdown(doc)
    expect(md).toContain('# 📁 My collections')
    expect(md).toContain('## 🎵 Music')
    expect(md).toContain('[Blue in Green](https://music.youtube.com/watch?v=abc123XYZ_-)')
  })
  it('rejects unsafe links, oversized images, and unknown field kinds', () => {
    const { doc, music } = seed()
    const bad = newItem('Bad')
    bad.link = 'javascript:alert(1)'
    expect(validCollections(addItem(doc, music, bad))).toBe(false)
    const big = newItem('Big')
    big.image = `data:image/png;base64,${'A'.repeat(300 * 1024)}`
    expect(validCollections(addItem(doc, music, big))).toBe(false)
    const wrongKind = updateCollection(doc, music, (c) => ({
      ...c,
      fields: [{ id: 'f1', name: 'X', kind: 'color' as never, onCard: true }],
    }))
    expect(validCollections(wrongKind)).toBe(false)
  })
})

describe('collections in the library', () => {
  it('initializes, saves, duplicates, backs up, and owns browse outputs', () => {
    const { library, project } = addProject(emptyLibrary(), {
      ...starterInput,
      title: 'Curations',
      tools: ['collection'],
    })
    const ready = initializeTools(library, project.id, ['collection'])
    expect(ready.projects[0].collection?.rootIds).toHaveLength(1)
    const { doc } = seed()
    const saved = saveCollections(ready, project.id, doc)
    expect(saved.projects[0].collection?.items).toHaveLength(1)
    expect(() => saveCollections(ready, project.id, { ...doc, version: 2 as never })).toThrow()
    const copy = duplicateProject(saved, project.id)
    expect(copy.project.collection?.items).toHaveLength(1)
    expect(parseLibrary(JSON.stringify(saved)).projects[0].collection).toEqual(doc)
    expect(parseBackup(serializeBackup(saved)).library.projects[0].collection?.items).toHaveLength(
      1,
    )
    expect(
      libraryWithDrafts(ready, { collection: { id: project.id, value: doc } }).projects[0]
        .collection?.items,
    ).toHaveLength(1)
    const withOutput = addCollectionOutput(saved, project.id)
    expect(withOutput.projects[0].outputs[0].type).toBe('collection-browse')
    expect(parseLibrary(JSON.stringify(withOutput)).projects[0].outputs).toHaveLength(1)
    const { library: plain, project: other } = addProject(emptyLibrary(), starterInput)
    expect(() => saveCollections(plain, other.id, emptyCollections())).toThrow(/collection tool/)
  })
})
