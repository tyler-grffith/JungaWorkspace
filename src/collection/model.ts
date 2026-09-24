// Saved document for the Collection module: a pool of items and a graph of collections that
// reference them. Collections nest, and a collection or an item may belong to several parents,
// so nothing is copied when it is filed in two places. Each collection names the fields its
// items show; items hold whatever fields they have, so one item can appear in collections with
// different templates.
export type FieldKind = 'text' | 'longtext' | 'link' | 'number' | 'date' | 'tags'
export type FieldDef = { id: string; name: string; kind: FieldKind; onCard: boolean }
export type FieldValue = string | number | string[]
export type Item = {
  id: string
  title: string
  subtitle: string
  /** A data URL after downscaling, or an https URL, or '' for none. */
  image: string
  link: string
  notes: string
  rating: number
  fields: Record<string, FieldValue>
  createdAt: string
}
export type Layout = 'grid' | 'list' | 'gallery'
export type Collection = {
  id: string
  name: string
  description: string
  emoji: string
  accent: string
  layout: Layout
  fields: FieldDef[]
  itemIds: string[]
  childIds: string[]
  sort: 'manual' | 'title' | 'added' | 'rating'
}
export type CollectionDocument = {
  version: 1
  rootIds: string[]
  collections: Collection[]
  items: Item[]
}

export const MAX_COLLECTIONS = 500
export const MAX_ITEMS = 5000
export const MAX_FIELDS = 24
export const MAX_IMAGE_CHARS = 200 * 1024
export const MAX_DOCUMENT_CHARS = 2500 * 1024
export const MAX_TEXT = 5000
export const FIELD_KINDS: readonly { value: FieldKind; label: string }[] = [
  { value: 'text', label: 'Short text' },
  { value: 'longtext', label: 'Long text' },
  { value: 'link', label: 'Link' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'tags', label: 'Tags' },
]

export const newId = () => crypto.randomUUID().slice(0, 8)
export const field = (name: string, kind: FieldKind = 'text', onCard = true): FieldDef => ({
  id: newId(),
  name,
  kind,
  onCard,
})

/** Starting points for common collections; each is just a name, an emoji, and fields. */
export const PRESETS: readonly {
  id: string
  name: string
  emoji: string
  accent: string
  layout: Layout
  fields: () => FieldDef[]
  itemNoun: string
}[] = [
  {
    id: 'music',
    name: 'Music',
    emoji: '🎵',
    accent: '#7c3aed',
    layout: 'grid',
    itemNoun: 'song or album',
    fields: () => [
      field('Artist'),
      field('Album'),
      field('Year', 'number'),
      field('Genre', 'tags'),
    ],
  },
  {
    id: 'movies',
    name: 'Movies',
    emoji: '🎬',
    accent: '#b45309',
    layout: 'grid',
    itemNoun: 'movie',
    fields: () => [
      field('Director'),
      field('Year', 'number'),
      field('Watched', 'date', false),
      field('Genre', 'tags'),
    ],
  },
  {
    id: 'photos',
    name: 'Photography',
    emoji: '📷',
    accent: '#0f766e',
    layout: 'gallery',
    itemNoun: 'photo',
    fields: () => [field('Location'), field('Taken', 'date'), field('Camera', 'text', false)],
  },
  {
    id: 'poems',
    name: 'Poems',
    emoji: '✒️',
    accent: '#9d174d',
    layout: 'list',
    itemNoun: 'poem',
    fields: () => [field('Poet'), field('Text', 'longtext'), field('Source', 'link', false)],
  },
  {
    id: 'books',
    name: 'Books',
    emoji: '📚',
    accent: '#1d4ed8',
    layout: 'list',
    itemNoun: 'book',
    fields: () => [
      field('Author'),
      field('Year', 'number'),
      field('Read', 'date', false),
      field('Topics', 'tags'),
    ],
  },
  {
    id: 'ideas',
    name: 'Ideas',
    emoji: '💡',
    accent: '#ca8a04',
    layout: 'list',
    itemNoun: 'idea',
    fields: () => [field('Status'), field('Details', 'longtext'), field('Tags', 'tags')],
  },
  {
    id: 'custom',
    name: 'New collection',
    emoji: '📁',
    accent: '#285f4b',
    layout: 'grid',
    itemNoun: 'item',
    fields: () => [field('Details', 'longtext', false), field('Tags', 'tags')],
  },
]

export function newCollection(presetId = 'custom', name?: string): Collection {
  const preset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[PRESETS.length - 1]
  return {
    id: newId(),
    name: name ?? preset.name,
    description: '',
    emoji: preset.emoji,
    accent: preset.accent,
    layout: preset.layout,
    fields: preset.fields(),
    itemIds: [],
    childIds: [],
    sort: 'manual',
  }
}
export function newItem(title: string): Item {
  return {
    id: newId(),
    title,
    subtitle: '',
    image: '',
    link: '',
    notes: '',
    rating: 0,
    fields: {},
    createdAt: new Date().toISOString(),
  }
}
export function emptyCollections(): CollectionDocument {
  const root = newCollection('custom', 'My collections')
  root.description = 'Everything you curate, in one place. Add a collection to begin.'
  return { version: 1, rootIds: [root.id], collections: [root], items: [] }
}

// --- Validation ---------------------------------------------------------------------------
const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const num = (v: unknown, min: number, max: number) =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max
const str = (v: unknown, max: number) => typeof v === 'string' && v.length <= max
const keys = (v: Record<string, unknown>, names: readonly string[]) =>
  Object.keys(v).length === names.length && names.every((n) => n in v)
const ID = /^[A-Za-z0-9_-]{1,40}$/
const isId = (v: unknown): v is string => typeof v === 'string' && ID.test(v)
/** A link to another Junga project, so a collection can file the workspace's own work. */
export const PROJECT_LINK = /^#\/project\/[A-Za-z0-9_-]{1,40}(\/[a-z-]+)*$/
export const isProjectLink = (link: string) => PROJECT_LINK.test(link)
export function safeUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2000) return false
  if (isProjectLink(value)) return true
  try {
    return ['https:', 'http:'].includes(new URL(value).protocol)
  } catch {
    return false
  }
}
export const safeImage = (v: unknown) =>
  typeof v === 'string' &&
  v.length <= MAX_IMAGE_CHARS &&
  (v === '' ||
    safeUrl(v) ||
    /^data:image\/(png|jpeg|gif|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(v))
const validFieldValue = (v: unknown) =>
  str(v, MAX_TEXT) ||
  num(v, -1e12, 1e12) ||
  (Array.isArray(v) && v.length <= 50 && v.every((t) => str(t, 60)))
export function validItem(v: unknown): v is Item {
  return (
    record(v) &&
    keys(v, [
      'id',
      'title',
      'subtitle',
      'image',
      'link',
      'notes',
      'rating',
      'fields',
      'createdAt',
    ]) &&
    isId(v.id) &&
    str(v.title, 200) &&
    str(v.subtitle, 200) &&
    safeImage(v.image) &&
    (v.link === '' || safeUrl(v.link)) &&
    str(v.notes, MAX_TEXT) &&
    num(v.rating, 0, 5) &&
    Number.isInteger(v.rating) &&
    record(v.fields) &&
    Object.keys(v.fields).length <= MAX_FIELDS &&
    Object.keys(v.fields).every(isId) &&
    Object.values(v.fields).every(validFieldValue) &&
    typeof v.createdAt === 'string' &&
    Number.isFinite(Date.parse(v.createdAt))
  )
}
export function validCollection(v: unknown): v is Collection {
  return (
    record(v) &&
    keys(v, [
      'id',
      'name',
      'description',
      'emoji',
      'accent',
      'layout',
      'fields',
      'itemIds',
      'childIds',
      'sort',
    ]) &&
    isId(v.id) &&
    str(v.name, 100) &&
    (v.name as string).trim().length > 0 &&
    str(v.description, 1000) &&
    str(v.emoji, 8) &&
    typeof v.accent === 'string' &&
    /^#[0-9a-f]{6}$/i.test(v.accent) &&
    ['grid', 'list', 'gallery'].includes(v.layout as string) &&
    Array.isArray(v.fields) &&
    v.fields.length <= MAX_FIELDS &&
    v.fields.every(
      (f) =>
        record(f) &&
        keys(f, ['id', 'name', 'kind', 'onCard']) &&
        isId(f.id) &&
        str(f.name, 60) &&
        (f.name as string).trim().length > 0 &&
        FIELD_KINDS.some((k) => k.value === f.kind) &&
        typeof f.onCard === 'boolean',
    ) &&
    new Set((v.fields as FieldDef[]).map((f) => f.id)).size === (v.fields as FieldDef[]).length &&
    Array.isArray(v.itemIds) &&
    v.itemIds.every(isId) &&
    new Set(v.itemIds).size === v.itemIds.length &&
    Array.isArray(v.childIds) &&
    v.childIds.every(isId) &&
    new Set(v.childIds).size === v.childIds.length &&
    !v.childIds.includes(v.id) &&
    ['manual', 'title', 'added', 'rating'].includes(v.sort as string)
  )
}
export function validCollections(v: unknown): v is CollectionDocument {
  if (!record(v) || !keys(v, ['version', 'rootIds', 'collections', 'items']) || v.version !== 1)
    return false
  if (
    !Array.isArray(v.collections) ||
    !v.collections.length ||
    v.collections.length > MAX_COLLECTIONS
  )
    return false
  if (!Array.isArray(v.items) || v.items.length > MAX_ITEMS) return false
  if (!v.collections.every(validCollection) || !v.items.every(validItem)) return false
  const collectionIds = new Set(v.collections.map((c: Collection) => c.id))
  const itemIds = new Set(v.items.map((i: Item) => i.id))
  if (collectionIds.size !== v.collections.length || itemIds.size !== v.items.length) return false
  if (
    !Array.isArray(v.rootIds) ||
    !v.rootIds.length ||
    !v.rootIds.every((id) => collectionIds.has(id))
  )
    return false
  if (new Set(v.rootIds).size !== v.rootIds.length) return false
  for (const c of v.collections as Collection[]) {
    if (!c.childIds.every((id) => collectionIds.has(id))) return false
    if (!c.itemIds.every((id) => itemIds.has(id))) return false
  }
  if (hasCycle(v as CollectionDocument)) return false
  return JSON.stringify(v).length <= MAX_DOCUMENT_CHARS
}
/** Nesting is a directed acyclic graph: a collection may have several parents but no ancestor loop. */
export function hasCycle(doc: CollectionDocument): boolean {
  const byId = new Map(doc.collections.map((c) => [c.id, c]))
  const state = new Map<string, 1 | 2>()
  const visit = (id: string): boolean => {
    const s = state.get(id)
    if (s === 2) return false
    if (s === 1) return true
    state.set(id, 1)
    for (const child of byId.get(id)?.childIds ?? []) if (visit(child)) return true
    state.set(id, 2)
    return false
  }
  return doc.collections.some((c) => visit(c.id))
}
export function collectionsProblem(doc: CollectionDocument): string {
  if (validCollections(doc)) return ''
  if (hasCycle(doc)) return 'A collection cannot contain one of its own ancestors.'
  if (JSON.stringify(doc).length > MAX_DOCUMENT_CHARS)
    return `These collections passed their ${Math.round(MAX_DOCUMENT_CHARS / 1024)} KB storage limit. Use image links instead of uploaded images, or remove some.`
  return 'The collections could not be saved. Check their contents.'
}

// --- Queries --------------------------------------------------------------------------------
export const collectionById = (doc: CollectionDocument, id: string) =>
  doc.collections.find((c) => c.id === id) ?? null
export const itemById = (doc: CollectionDocument, id: string) =>
  doc.items.find((i) => i.id === id) ?? null
/** Every collection that lists `id` as a child. */
export const parentsOf = (doc: CollectionDocument, id: string) =>
  doc.collections.filter((c) => c.childIds.includes(id))
/** Every collection that holds an item. */
export const holdersOf = (doc: CollectionDocument, itemId: string) =>
  doc.collections.filter((c) => c.itemIds.includes(itemId))
/** Ids of a collection and everything nested under it. */
export function descendantIds(doc: CollectionDocument, id: string): Set<string> {
  const byId = new Map(doc.collections.map((c) => [c.id, c]))
  const seen = new Set<string>()
  const walk = (current: string) => {
    if (seen.has(current)) return
    seen.add(current)
    for (const child of byId.get(current)?.childIds ?? []) walk(child)
  }
  walk(id)
  return seen
}
/** Items shown by a collection in its chosen order. */
export function itemsOf(doc: CollectionDocument, collection: Collection): Item[] {
  const byId = new Map(doc.items.map((i) => [i.id, i]))
  const items = collection.itemIds.map((id) => byId.get(id)).filter((i): i is Item => !!i)
  switch (collection.sort) {
    case 'title':
      return [...items].sort((a, b) => a.title.localeCompare(b.title))
    case 'added':
      return [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    case 'rating':
      return [...items].sort((a, b) => b.rating - a.rating || a.title.localeCompare(b.title))
    default:
      return items
  }
}
/** Count of items in a collection and all of its descendants, each counted once. */
export function deepItemCount(doc: CollectionDocument, id: string): number {
  return deepItemCounts(doc).get(id) ?? 0
}
/** Distinct items under every collection at once, for trees and child grids. */
export function deepItemCounts(doc: CollectionDocument): Map<string, number> {
  const byId = new Map(doc.collections.map((c) => [c.id, c]))
  const items = new Map<string, Set<string>>()
  const visiting = new Set<string>()
  const collect = (id: string): Set<string> => {
    const done = items.get(id)
    if (done) return done
    const set = new Set<string>(byId.get(id)?.itemIds)
    if (!visiting.has(id)) {
      visiting.add(id)
      for (const child of byId.get(id)?.childIds ?? [])
        for (const item of collect(child)) set.add(item)
      visiting.delete(id)
    }
    items.set(id, set)
    return set
  }
  return new Map(doc.collections.map((c) => [c.id, collect(c.id).size]))
}

// --- Mutations (pure) -----------------------------------------------------------------------
const replaceCollection = (doc: CollectionDocument, next: Collection): CollectionDocument => ({
  ...doc,
  collections: doc.collections.map((c) => (c.id === next.id ? next : c)),
})
export function updateCollection(
  doc: CollectionDocument,
  id: string,
  change: (c: Collection) => Collection,
): CollectionDocument {
  const current = collectionById(doc, id)
  return current ? replaceCollection(doc, change(current)) : doc
}
export function updateItem(
  doc: CollectionDocument,
  id: string,
  change: (i: Item) => Item,
): CollectionDocument {
  return { ...doc, items: doc.items.map((i) => (i.id === id ? change(i) : i)) }
}
/** Add a new child collection under `parentId` (or at the root when null). */
export function addCollection(
  doc: CollectionDocument,
  parentId: string | null,
  presetId: string,
  name?: string,
): { document: CollectionDocument; collection: Collection } {
  const collection = newCollection(presetId, name)
  let next: CollectionDocument = { ...doc, collections: [...doc.collections, collection] }
  if (parentId)
    next = updateCollection(next, parentId, (c) => ({
      ...c,
      childIds: [...c.childIds, collection.id],
    }))
  else next = { ...next, rootIds: [...next.rootIds, collection.id] }
  return { document: next, collection }
}
/** File an existing collection under another parent as well. Refused when it would loop. */
export function linkCollection(
  doc: CollectionDocument,
  parentId: string,
  childId: string,
): CollectionDocument {
  if (parentId === childId || descendantIds(doc, childId).has(parentId)) return doc
  const parent = collectionById(doc, parentId)
  if (!parent || parent.childIds.includes(childId)) return doc
  return updateCollection(doc, parentId, (c) => ({ ...c, childIds: [...c.childIds, childId] }))
}
/** Remove a collection from one parent; when nothing else holds it, delete it (items stay in the pool). */
export function unlinkCollection(
  doc: CollectionDocument,
  parentId: string | null,
  childId: string,
): CollectionDocument {
  let next = parentId
    ? updateCollection(doc, parentId, (c) => ({
        ...c,
        childIds: c.childIds.filter((id) => id !== childId),
      }))
    : { ...doc, rootIds: doc.rootIds.filter((id) => id !== childId) }
  const stillHeld = next.rootIds.includes(childId) || parentsOf(next, childId).length > 0
  if (!stillHeld) next = removeCollectionEverywhere(next, childId)
  return next
}
function removeCollectionEverywhere(doc: CollectionDocument, id: string): CollectionDocument {
  const gone = collectionById(doc, id)
  if (!gone) return doc
  let next: CollectionDocument = {
    ...doc,
    rootIds: doc.rootIds.filter((r) => r !== id),
    collections: doc.collections
      .filter((c) => c.id !== id)
      .map((c) => ({ ...c, childIds: c.childIds.filter((child) => child !== id) })),
  }
  // Children with no other parent are removed too; shared ones stay.
  for (const child of gone.childIds)
    if (!next.rootIds.includes(child) && !parentsOf(next, child).length)
      next = removeCollectionEverywhere(next, child)
  if (!next.collections.length) return emptyCollections()
  if (!next.rootIds.length) next = { ...next, rootIds: [next.collections[0].id] }
  return pruneItems(next)
}
/** Drop items no collection holds. */
export function pruneItems(doc: CollectionDocument): CollectionDocument {
  const held = new Set(doc.collections.flatMap((c) => c.itemIds))
  return { ...doc, items: doc.items.filter((i) => held.has(i.id)) }
}
export function addItem(
  doc: CollectionDocument,
  collectionId: string,
  item: Item,
): CollectionDocument {
  const next: CollectionDocument = { ...doc, items: [...doc.items, item] }
  return updateCollection(next, collectionId, (c) => ({ ...c, itemIds: [...c.itemIds, item.id] }))
}
/** File an existing item into another collection as well. */
export function fileItem(
  doc: CollectionDocument,
  collectionId: string,
  itemId: string,
): CollectionDocument {
  return updateCollection(doc, collectionId, (c) =>
    c.itemIds.includes(itemId) ? c : { ...c, itemIds: [...c.itemIds, itemId] },
  )
}
/** Take an item out of one collection; when nothing else holds it, it leaves the pool. */
export function removeItem(
  doc: CollectionDocument,
  collectionId: string,
  itemId: string,
): CollectionDocument {
  const next = updateCollection(doc, collectionId, (c) => ({
    ...c,
    itemIds: c.itemIds.filter((id) => id !== itemId),
  }))
  return pruneItems(next)
}
export function moveItem(
  doc: CollectionDocument,
  collectionId: string,
  itemId: string,
  delta: number,
): CollectionDocument {
  return updateCollection(doc, collectionId, (c) => {
    const index = c.itemIds.indexOf(itemId)
    const target = index + delta
    if (index < 0 || target < 0 || target >= c.itemIds.length) return c
    const itemIds = [...c.itemIds]
    ;[itemIds[index], itemIds[target]] = [itemIds[target], itemIds[index]]
    return { ...c, itemIds }
  })
}

// --- Links ------------------------------------------------------------------------------------
/** A YouTube or YouTube Music video id from a link, for a cover image with no upload. */
export function youtubeId(link: string): string | null {
  try {
    const url = new URL(link)
    const host = url.hostname.replace(/^www\./, '')
    if (host === 'youtu.be') return url.pathname.slice(1) || null
    if (host === 'youtube.com' || host === 'music.youtube.com' || host === 'm.youtube.com') {
      const v = url.searchParams.get('v')
      if (v) return v
      const short = /^\/(shorts|embed)\/([^/?]+)/.exec(url.pathname)
      return short ? short[2] : null
    }
  } catch {
    /* not a URL */
  }
  return null
}
/** The cover to show for an item: its own image, or a thumbnail derived from its link. */
export function coverFor(item: Item): string {
  if (item.image) return item.image
  const id = item.link ? youtubeId(item.link) : null
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : ''
}
export function linkLabel(link: string): string {
  if (isProjectLink(link)) return 'Junga'
  try {
    const url = new URL(link)
    const host = url.hostname.replace(/^www\./, '')
    if (host === 'music.youtube.com') return 'YouTube Music'
    if (host === 'youtube.com' || host === 'youtu.be') return 'YouTube'
    if (host === 'open.spotify.com') return 'Spotify'
    if (host === 'letterboxd.com') return 'Letterboxd'
    if (host === 'imdb.com') return 'IMDb'
    return host
  } catch {
    return 'Link'
  }
}

// --- Markdown ---------------------------------------------------------------------------------
export function toMarkdown(doc: CollectionDocument, rootId?: string): string {
  const lines: string[] = []
  const seen = new Set<string>()
  const write = (id: string, depth: number) => {
    const c = collectionById(doc, id)
    if (!c) return
    lines.push(`${'#'.repeat(Math.min(6, depth + 1))} ${c.emoji} ${c.name}`.trim(), '')
    if (c.description) lines.push(c.description, '')
    for (const item of itemsOf(doc, c)) {
      const parts = [item.link ? `[${item.title}](${item.link})` : `**${item.title}**`]
      if (item.subtitle) parts.push(item.subtitle)
      for (const f of c.fields) {
        const value = item.fields[f.id]
        if (value === undefined || value === '' || (Array.isArray(value) && !value.length)) continue
        parts.push(`${f.name}: ${Array.isArray(value) ? value.join(', ') : String(value)}`)
      }
      if (item.rating) parts.push('★'.repeat(item.rating))
      lines.push(`- ${parts.join(' · ')}`)
      if (item.notes) lines.push(`  ${item.notes.replace(/\n/g, '\n  ')}`)
    }
    if (c.itemIds.length) lines.push('')
    if (!seen.has(id)) {
      seen.add(id)
      for (const child of c.childIds) write(child, depth + 1)
    }
  }
  for (const id of rootId ? [rootId] : doc.rootIds) write(id, 0)
  return (
    lines
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim() + '\n'
  )
}
