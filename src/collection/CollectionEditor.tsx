// The Collection editor: curate nested collections of things. The tree on the left navigates;
// the main area shows one collection with its sub-collections and item cards; the detail panel
// edits one item. Everything is meant to be quick to change: names edit in place, items are
// added from a single box that accepts a title or a pasted link, and fields are per collection.
import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BookOpen,
  Download,
  ExternalLink,
  FolderPlus,
  Image as ImageIcon,
  Link2,
  Plus,
  Settings2,
  Trash2,
  X,
} from 'lucide-react'
import { readImageFile } from '../canvas/images'
import {
  FIELD_KINDS,
  PRESETS,
  addCollection,
  addItem,
  collectionById,
  coverFor,
  field,
  fileItem,
  holdersOf,
  itemsOf,
  linkCollection,
  linkLabel,
  moveItem,
  newItem,
  removeItem,
  safeImage,
  safeUrl,
  toMarkdown,
  unlinkCollection,
  updateCollection,
  updateItem,
  validCollections,
  type Collection,
  type CollectionDocument,
  type FieldDef,
  type FieldKind,
  type Item,
} from './model'
import CollectionBrowser, {
  CollectionTree,
  ItemCard,
  Stars,
  fieldText,
  filterItems,
  pathTo,
} from './CollectionBrowser'
import './collection.css'

function download(text: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
const safeName = (title: string) =>
  title
    .replace(/[^a-z0-9-_ ]/gi, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase() || 'collection'
const article = (noun: string) => (/^[aeiou]/i.test(noun) ? 'an' : 'a')
const looksLikeUrl = (value: string) => /^https?:\/\/\S+$/i.test(value.trim())
/** A readable title for a pasted link when nothing else is known. */
function titleFromUrl(link: string): string {
  try {
    const url = new URL(link)
    const host = url.hostname.replace(/^www\./, '')
    const last = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() ?? '')
    const words = last
      .replace(/[-_+]+/g, ' ')
      .replace(/\.[a-z0-9]{2,5}$/i, '')
      .trim()
    return words && !/^(watch|embed|shorts)$/i.test(words) ? words : `Link from ${host}`
  } catch {
    return 'New item'
  }
}

export default function CollectionEditor({
  title,
  document: doc,
  readOnly,
  unsaved,
  onBack,
  onChange,
}: {
  title: string
  document: CollectionDocument
  readOnly: boolean
  unsaved: boolean
  onBack: () => void
  onChange: (next: CollectionDocument) => boolean
}) {
  const [currentId, setCurrentId] = useState(doc.rootIds[0])
  const [openItem, setOpenItem] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [quick, setQuick] = useState('')
  const [fieldsOpen, setFieldsOpen] = useState(false)
  const [presetMenu, setPresetMenu] = useState(false)
  const [exportMenu, setExportMenu] = useState(false)
  const [browse, setBrowse] = useState(false)
  const [message, setMessage] = useState('')
  const imageInput = useRef<HTMLInputElement>(null)
  const importInput = useRef<HTMLInputElement>(null)

  const collection = collectionById(doc, currentId) ?? doc.collections[0]
  const items = useMemo(
    () => filterItems(itemsOf(doc, collection), collection.fields, query),
    [doc, collection, query],
  )
  const detail = openItem ? (doc.items.find((i) => i.id === openItem) ?? null) : null
  const path = pathTo(doc, collection.id)
  const preset = PRESETS.find((p) => p.name === collection.name) ?? PRESETS[PRESETS.length - 1]

  const apply = (next: CollectionDocument) => {
    if (readOnly) return false
    const added = next.collections.length > doc.collections.length
    if (!validCollections(next)) {
      setMessage(
        added
          ? 'That collection could not be added.'
          : 'That change could not be saved. Check for loops or oversized images.',
      )
      return false
    }
    return onChange(next)
  }
  const changeCollection = (change: (c: Collection) => Collection) =>
    apply(updateCollection(doc, collection.id, change))
  const changeItem = (id: string, change: (i: Item) => Item) => apply(updateItem(doc, id, change))

  function addSub(presetId: string) {
    setPresetMenu(false)
    const result = addCollection(doc, collection.id, presetId)
    if (apply(result.document)) setCurrentId(result.collection.id)
  }
  function quickAdd(event: FormEvent) {
    event.preventDefault()
    const value = quick.trim()
    if (!value) return
    const item = newItem(looksLikeUrl(value) ? titleFromUrl(value) : value.slice(0, 200))
    if (looksLikeUrl(value)) item.link = value
    if (apply(addItem(doc, collection.id, item))) {
      setQuick('')
      setOpenItem(item.id)
    }
  }
  async function addImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !detail) return
    try {
      const { src } = await readImageFile(file, 800)
      if (!safeImage(src)) {
        setMessage(
          'That image is too large even after shrinking. Try a smaller one or paste an image link.',
        )
        return
      }
      changeItem(detail.id, (i) => ({ ...i, image: src }))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'That image could not be added.')
    }
  }
  function exportAs(kind: 'md' | 'json') {
    setExportMenu(false)
    const name = safeName(title)
    if (kind === 'md') download(toMarkdown(doc), `${name}.md`, 'text/markdown')
    else download(JSON.stringify(doc, null, 2), `${name}.collections.json`, 'application/json')
  }
  async function importJson(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text()) as unknown
      if (!validCollections(parsed)) throw new Error('That file is not a Junga collections export.')
      const incoming = parsed as CollectionDocument
      // Merge: keep existing, append incoming collections and items under the current collection.
      const known = new Set(doc.collections.map((c) => c.id))
      const knownItems = new Set(doc.items.map((i) => i.id))
      const merged: CollectionDocument = {
        ...doc,
        collections: [...doc.collections, ...incoming.collections.filter((c) => !known.has(c.id))],
        items: [...doc.items, ...incoming.items.filter((i) => !knownItems.has(i.id))],
      }
      let next = merged
      for (const rootId of incoming.rootIds) next = linkCollection(next, collection.id, rootId)
      if (apply(next))
        setMessage(
          `Imported ${incoming.collections.length} collections and ${incoming.items.length} items under ${collection.name}.`,
        )
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'That file could not be imported.')
    }
  }
  const otherCollections = doc.collections.filter((c) => c.id !== collection.id)
  const parents = doc.collections.filter((c) => c.childIds.includes(collection.id))
  const isRoot = doc.rootIds.includes(collection.id)

  return (
    <div className="col-editor" style={{ '--accent': collection.accent } as React.CSSProperties}>
      {browse && (
        <div className="col-browse-overlay">
          <CollectionBrowser
            document={doc}
            title={title}
            startId={collection.id}
            onExit={() => setBrowse(false)}
          />
        </div>
      )}
      <div className="col-heading">
        <div>
          <button className="back-link" onClick={onBack}>
            <ArrowLeft size={15} />
            Back to project
          </button>
          <div className="eyebrow">COLLECTION</div>
          <h1>{title}</h1>
        </div>
        <div className="col-heading-actions">
          {unsaved && <span className="unsaved-note">Changes not saved</span>}
          {readOnly && <span className="unsaved-note">Read only</span>}
          {message && (
            <span className="col-message" role="status">
              {message}
            </span>
          )}
          <div className="col-menu-anchor">
            <button
              className="button"
              onClick={() => setExportMenu(!exportMenu)}
              aria-expanded={exportMenu}
            >
              <Download size={15} />
              Export
            </button>
            {exportMenu && (
              <div className="col-menu" role="menu">
                <button role="menuitem" onClick={() => exportAs('md')}>
                  All collections as Markdown
                </button>
                <button role="menuitem" onClick={() => exportAs('json')}>
                  All collections as JSON
                </button>
                <button
                  role="menuitem"
                  disabled={readOnly}
                  onClick={() => {
                    setExportMenu(false)
                    importInput.current?.click()
                  }}
                >
                  Import a collections JSON file…
                </button>
              </div>
            )}
          </div>
          <input
            ref={importInput}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={importJson}
            aria-label="Collections file"
          />
          <button className="button primary" onClick={() => setBrowse(true)}>
            <BookOpen size={15} />
            Browse
          </button>
        </div>
      </div>
      <div className={`col-body ${detail ? 'with-detail' : ''}`}>
        <div>
          <CollectionTree
            document={doc}
            currentId={collection.id}
            onOpen={(id) => {
              setCurrentId(id)
              setOpenItem(null)
              setQuery('')
              setFieldsOpen(false)
            }}
          />
          {!readOnly && (
            <div className="col-menu-anchor">
              <button
                type="button"
                className="button col-tree-add"
                onClick={() => setPresetMenu(!presetMenu)}
                aria-expanded={presetMenu}
              >
                <FolderPlus size={14} />
                New collection here
              </button>
              {presetMenu && (
                <div className="col-menu left" role="menu" aria-label="Start from">
                  {PRESETS.map((p) => (
                    <button key={p.id} role="menuitem" onClick={() => addSub(p.id)}>
                      <span aria-hidden="true">{p.emoji}</span>
                      {p.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="col-main">
          <nav className="col-crumbs" aria-label="Breadcrumb">
            {path.map((c, i) => (
              <span key={c.id}>
                {i > 0 && <span aria-hidden="true">›</span>}
                <button
                  type="button"
                  onClick={() => setCurrentId(c.id)}
                  aria-current={i === path.length - 1 ? 'page' : undefined}
                >
                  {c.name}
                </button>
              </span>
            ))}
          </nav>
          <header className="col-header">
            {readOnly ? (
              <span className="col-header-emoji" aria-hidden="true">
                {collection.emoji}
              </span>
            ) : (
              <input
                className="col-emoji-input"
                aria-label="Collection emoji"
                value={collection.emoji}
                maxLength={8}
                onChange={(e) => changeCollection((c) => ({ ...c, emoji: e.target.value }))}
              />
            )}
            <div>
              {readOnly ? (
                <h2>{collection.name}</h2>
              ) : (
                <input
                  className="col-name"
                  aria-label="Collection name"
                  value={collection.name}
                  maxLength={100}
                  onChange={(e) =>
                    changeCollection((c) => ({ ...c, name: e.target.value || c.name }))
                  }
                />
              )}
              {readOnly ? (
                collection.description && <p>{collection.description}</p>
              ) : (
                <textarea
                  className="col-description"
                  aria-label="Collection description"
                  placeholder="Describe this collection…"
                  rows={1}
                  maxLength={1000}
                  value={collection.description}
                  onChange={(e) => changeCollection((c) => ({ ...c, description: e.target.value }))}
                />
              )}
            </div>
          </header>
          {!readOnly && (
            <div className="col-controls">
              <label>
                Layout{' '}
                <select
                  value={collection.layout}
                  aria-label="Layout"
                  onChange={(e) =>
                    changeCollection((c) => ({
                      ...c,
                      layout: e.target.value as Collection['layout'],
                    }))
                  }
                >
                  <option value="grid">Grid</option>
                  <option value="list">List</option>
                  <option value="gallery">Gallery</option>
                </select>
              </label>
              <label>
                Sort{' '}
                <select
                  value={collection.sort}
                  aria-label="Sort"
                  onChange={(e) =>
                    changeCollection((c) => ({ ...c, sort: e.target.value as Collection['sort'] }))
                  }
                >
                  <option value="manual">Manual</option>
                  <option value="title">Title</option>
                  <option value="added">Newest first</option>
                  <option value="rating">Rating</option>
                </select>
              </label>
              <label>
                Accent{' '}
                <input
                  type="color"
                  aria-label="Accent color"
                  value={collection.accent}
                  onChange={(e) => changeCollection((c) => ({ ...c, accent: e.target.value }))}
                />
              </label>
              <button
                type="button"
                className="button"
                aria-expanded={fieldsOpen}
                onClick={() => setFieldsOpen(!fieldsOpen)}
              >
                <Settings2 size={13} />
                Fields
              </button>
              <span className="col-controls-gap" />
              {otherCollections.length > 0 && (
                <label>
                  Also file under{' '}
                  <select
                    aria-label="Also file this collection under"
                    value=""
                    onChange={(e) => {
                      if (!e.target.value) return
                      const next = linkCollection(doc, e.target.value, collection.id)
                      if (next === doc) setMessage('That would make a collection contain itself.')
                      else apply(next)
                    }}
                  >
                    <option value="">Choose…</option>
                    {otherCollections
                      .filter((c) => !c.childIds.includes(collection.id))
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.emoji} {c.name}
                        </option>
                      ))}
                  </select>
                </label>
              )}
              {(parents.length > 0 || (isRoot && doc.collections.length > 1)) && (
                <button
                  type="button"
                  className="button"
                  onClick={() => {
                    const parentId = path.length > 1 ? path[path.length - 2].id : null
                    const elsewhere = parents.length + (isRoot ? 1 : 0) > 1
                    const message = elsewhere
                      ? `Remove “${collection.name}” from here? It stays in its other places.`
                      : `Delete “${collection.name}”? Items only it holds are removed too.`
                    if (!window.confirm(message)) return
                    const next = unlinkCollection(doc, parentId, collection.id)
                    if (apply(next))
                      setCurrentId(
                        parentId && collectionById(next, parentId) ? parentId : next.rootIds[0],
                      )
                  }}
                >
                  <Trash2 size={13} />
                  {parents.length + (isRoot ? 1 : 0) > 1 ? 'Remove from here' : 'Delete collection'}
                </button>
              )}
            </div>
          )}
          {fieldsOpen && !readOnly && (
            <FieldsEditor
              fields={collection.fields}
              onChange={(fields) => changeCollection((c) => ({ ...c, fields }))}
              onClose={() => setFieldsOpen(false)}
            />
          )}
          {collection.childIds.length > 0 && (
            <section className="col-children" aria-label="Sub-collections">
              {collection.childIds.map((id) => {
                const child = collectionById(doc, id)
                if (!child) return null
                const count = child.itemIds.length
                return (
                  <div key={id} className="col-child-wrap">
                    <button
                      type="button"
                      className="col-child-card"
                      style={{ '--accent': child.accent } as React.CSSProperties}
                      onClick={() => setCurrentId(id)}
                    >
                      <span className="col-emoji" aria-hidden="true">
                        {child.emoji}
                      </span>
                      <span className="col-child-name">{child.name}</span>
                      <span className="col-child-count">
                        {count} {count === 1 ? 'item' : 'items'}
                        {child.childIds.length ? ` · ${child.childIds.length} inside` : ''}
                      </span>
                    </button>
                    {!readOnly && (
                      <button
                        type="button"
                        className="col-child-remove"
                        aria-label={`Remove ${child.name} from ${collection.name}`}
                        onClick={() => {
                          const shared =
                            doc.rootIds.includes(id) ||
                            doc.collections.filter((c) => c.childIds.includes(id)).length > 1
                          if (
                            window.confirm(
                              shared
                                ? `Remove “${child.name}” from ${collection.name}? It stays elsewhere.`
                                : `Delete “${child.name}” and the items only it holds?`,
                            )
                          )
                            apply(unlinkCollection(doc, collection.id, id))
                        }}
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                )
              })}
            </section>
          )}
          {!readOnly && (
            <form className="col-add" onSubmit={quickAdd}>
              <input
                aria-label={`Add ${article(preset.itemNoun)} ${preset.itemNoun}`}
                placeholder={`Add ${article(preset.itemNoun)} ${preset.itemNoun}: type a title or paste a link`}
                value={quick}
                maxLength={2000}
                onChange={(e) => setQuick(e.target.value)}
              />
              <button type="submit" className="button primary" disabled={!quick.trim()}>
                <Plus size={14} />
                Add
              </button>
            </form>
          )}
          {collection.itemIds.length > 3 && (
            <input
              type="search"
              className="col-search"
              placeholder={`Search ${collection.name}…`}
              aria-label={`Search ${collection.name}`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          )}
          <div className={`col-items layout-${collection.layout}`}>
            {items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                fields={collection.fields}
                accent={collection.accent}
                selected={item.id === openItem}
                onOpen={() => setOpenItem(item.id === openItem ? null : item.id)}
              />
            ))}
            {!items.length && (
              <p className="col-empty">
                {collection.itemIds.length
                  ? 'No items match that search.'
                  : `No ${preset.itemNoun}s yet. Add one above, or start a sub-collection from the tree.`}
              </p>
            )}
          </div>
        </div>
        {detail && (
          <aside className="col-detail" aria-label={`${detail.title} details`}>
            <div className="col-detail-head">
              <h2>{detail.title}</h2>
              <button
                type="button"
                className="icon-button"
                aria-label="Close details"
                onClick={() => setOpenItem(null)}
              >
                <X size={18} />
              </button>
            </div>
            {coverFor(detail) && (
              <img className="col-detail-cover" src={coverFor(detail)} alt={detail.title} />
            )}
            {readOnly ? (
              <>
                {detail.subtitle && <p className="col-subtitle">{detail.subtitle}</p>}
                {detail.notes && <p className="col-notes">{detail.notes}</p>}
              </>
            ) : (
              <>
                <label>
                  Title
                  <input
                    value={detail.title}
                    maxLength={200}
                    onChange={(e) =>
                      changeItem(detail.id, (i) => ({ ...i, title: e.target.value }))
                    }
                  />
                </label>
                <label>
                  Subtitle
                  <input
                    value={detail.subtitle}
                    maxLength={200}
                    placeholder="A line under the title"
                    onChange={(e) =>
                      changeItem(detail.id, (i) => ({ ...i, subtitle: e.target.value }))
                    }
                  />
                </label>
                <label>
                  Link
                  <input
                    type="url"
                    value={detail.link}
                    placeholder="https://"
                    onChange={(e) => {
                      const link = e.target.value.trim()
                      if (link === '' || safeUrl(link))
                        changeItem(detail.id, (i) => ({ ...i, link }))
                      else setMessage('Links must start with https:// or http://.')
                    }}
                  />
                </label>
                {detail.link && (
                  <a
                    className="button"
                    href={detail.link}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink size={14} />
                    Open on {linkLabel(detail.link)}
                  </a>
                )}
                <div className="col-detail-row">
                  <button
                    type="button"
                    className="button"
                    onClick={() => imageInput.current?.click()}
                  >
                    <ImageIcon size={14} />
                    {detail.image ? 'Replace image' : 'Upload image'}
                  </button>
                  <button
                    type="button"
                    className="button"
                    onClick={() => {
                      const url = window.prompt(
                        'Image link (https://…)',
                        detail.image.startsWith('http') ? detail.image : '',
                      )
                      if (url === null) return
                      if (url === '' || safeUrl(url))
                        changeItem(detail.id, (i) => ({ ...i, image: url }))
                      else setMessage('Image links must start with https:// or http://.')
                    }}
                  >
                    <Link2 size={14} />
                    Image link
                  </button>
                  {detail.image && (
                    <button
                      type="button"
                      className="button"
                      onClick={() => changeItem(detail.id, (i) => ({ ...i, image: '' }))}
                    >
                      Clear image
                    </button>
                  )}
                </div>
                <input
                  ref={imageInput}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={addImage}
                  aria-label="Item image"
                />
                <label>
                  Rating
                  <Stars
                    value={detail.rating}
                    onChange={(rating) => changeItem(detail.id, (i) => ({ ...i, rating }))}
                  />
                </label>
                {collection.fields.map((f) => (
                  <FieldInput
                    key={f.id}
                    def={f}
                    value={detail.fields[f.id]}
                    onChange={(value) =>
                      changeItem(detail.id, (i) => {
                        const fields = { ...i.fields }
                        if (value === '' || (Array.isArray(value) && !value.length))
                          delete fields[f.id]
                        else fields[f.id] = value
                        return { ...i, fields }
                      })
                    }
                  />
                ))}
                <label>
                  Notes
                  <textarea
                    value={detail.notes}
                    maxLength={5000}
                    placeholder="Your writing about it"
                    onChange={(e) =>
                      changeItem(detail.id, (i) => ({ ...i, notes: e.target.value }))
                    }
                  />
                </label>
                <label>
                  Also in
                  <ul className="col-also">
                    {holdersOf(doc, detail.id).map((c) => (
                      <li key={c.id}>
                        {c.emoji} {c.name}
                        {holdersOf(doc, detail.id).length > 1 && (
                          <button
                            type="button"
                            aria-label={`Remove from ${c.name}`}
                            onClick={() => apply(removeItem(doc, c.id, detail.id))}
                          >
                            <X size={11} />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                  <select
                    aria-label="Also file this item in"
                    value=""
                    onChange={(e) =>
                      e.target.value && apply(fileItem(doc, e.target.value, detail.id))
                    }
                  >
                    <option value="">File in another collection…</option>
                    {doc.collections
                      .filter((c) => !c.itemIds.includes(detail.id))
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.emoji} {c.name}
                        </option>
                      ))}
                  </select>
                </label>
                <div className="col-detail-row">
                  {collection.sort === 'manual' && collection.itemIds.includes(detail.id) && (
                    <>
                      <button
                        type="button"
                        className="button"
                        aria-label="Move up"
                        onClick={() => apply(moveItem(doc, collection.id, detail.id, -1))}
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        className="button"
                        aria-label="Move down"
                        onClick={() => apply(moveItem(doc, collection.id, detail.id, 1))}
                      >
                        <ArrowDown size={14} />
                      </button>
                    </>
                  )}
                  {collection.itemIds.includes(detail.id) && (
                    <button
                      type="button"
                      className="button"
                      onClick={() => {
                        const elsewhere = holdersOf(doc, detail.id).length > 1
                        if (
                          window.confirm(
                            elsewhere
                              ? `Remove “${detail.title}” from ${collection.name}? It stays in its other collections.`
                              : `Delete “${detail.title}”?`,
                          )
                        ) {
                          apply(removeItem(doc, collection.id, detail.id))
                          setOpenItem(null)
                        }
                      }}
                    >
                      <Trash2 size={14} />
                      {holdersOf(doc, detail.id).length > 1 ? 'Remove from here' : 'Delete'}
                    </button>
                  )}
                </div>
              </>
            )}
          </aside>
        )}
      </div>
    </div>
  )
}

function FieldInput({
  def,
  value,
  onChange,
}: {
  def: FieldDef
  value: Item['fields'][string] | undefined
  onChange: (value: Item['fields'][string]) => void
}) {
  const text = fieldText(value)
  switch (def.kind) {
    case 'longtext':
      return (
        <label>
          {def.name}
          <textarea value={text} maxLength={5000} onChange={(e) => onChange(e.target.value)} />
        </label>
      )
    case 'number':
      return (
        <label>
          {def.name}
          <input
            type="number"
            value={text}
            onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          />
        </label>
      )
    case 'date':
      return (
        <label>
          {def.name}
          <input type="date" value={text} onChange={(e) => onChange(e.target.value)} />
        </label>
      )
    case 'link':
      return (
        <label>
          {def.name}
          <input
            type="url"
            value={text}
            placeholder="https://"
            onChange={(e) =>
              (e.target.value === '' || safeUrl(e.target.value)) && onChange(e.target.value)
            }
          />
        </label>
      )
    case 'tags':
      return (
        <label>
          {def.name}
          <input
            value={Array.isArray(value) ? value.join(', ') : text}
            placeholder="Comma-separated"
            onChange={(e) =>
              onChange(
                e.target.value
                  .split(',')
                  .map((t) => t.trim().slice(0, 60))
                  .filter((t, i, all) => t && all.indexOf(t) === i)
                  .slice(0, 50),
              )
            }
          />
        </label>
      )
    default:
      return (
        <label>
          {def.name}
          <input value={text} maxLength={5000} onChange={(e) => onChange(e.target.value)} />
        </label>
      )
  }
}

function FieldsEditor({
  fields,
  onChange,
  onClose,
}: {
  fields: FieldDef[]
  onChange: (fields: FieldDef[]) => void
  onClose: () => void
}) {
  return (
    <section className="col-fields-editor" aria-label="Fields">
      <h3>Fields shown on items in this collection</h3>
      {fields.map((f) => (
        <div key={f.id} className="col-field-row">
          <input
            aria-label="Field name"
            value={f.name}
            maxLength={60}
            onChange={(e) =>
              onChange(
                fields.map((x) => (x.id === f.id ? { ...x, name: e.target.value || x.name } : x)),
              )
            }
          />
          <select
            aria-label="Field kind"
            value={f.kind}
            onChange={(e) =>
              onChange(
                fields.map((x) =>
                  x.id === f.id ? { ...x, kind: e.target.value as FieldKind } : x,
                ),
              )
            }
          >
            {FIELD_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
          <label className="inline">
            <input
              type="checkbox"
              checked={f.onCard}
              onChange={(e) =>
                onChange(
                  fields.map((x) => (x.id === f.id ? { ...x, onCard: e.target.checked } : x)),
                )
              }
            />
            On card
          </label>
          <button
            type="button"
            className="icon-button"
            aria-label={`Remove field ${f.name}`}
            onClick={() => onChange(fields.filter((x) => x.id !== f.id))}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <div className="col-detail-row">
        <button
          type="button"
          className="button"
          disabled={fields.length >= 24}
          onClick={() => onChange([...fields, field('New field')])}
        >
          <Plus size={13} />
          Add field
        </button>
        <button type="button" className="button" onClick={onClose}>
          Done
        </button>
      </div>
    </section>
  )
}
