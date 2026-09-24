// Read-only views of a collection document, shared with the editor: the nested tree, item
// cards in grid/list/gallery layouts, and a detail panel. The output route and the editor's
// Browse button render `CollectionBrowser`; the editor reuses the pieces with controls added.
import { useMemo, useState } from 'react'
import { ChevronRight, ExternalLink, Star, X } from 'lucide-react'
import {
  collectionById,
  coverFor,
  deepItemCount,
  itemsOf,
  linkLabel,
  type Collection,
  type CollectionDocument,
  type FieldDef,
  type Item,
} from './model'
import './collection.css'

export function Stars({ value, onChange }: { value: number; onChange?: (n: number) => void }) {
  return (
    <span
      className="col-stars"
      role={onChange ? 'radiogroup' : undefined}
      aria-label={onChange ? 'Rating' : `${value} of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((n) =>
        onChange ? (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} ${n === 1 ? 'star' : 'stars'}`}
            className={n <= value ? 'on' : ''}
            onClick={() => onChange(value === n ? 0 : n)}
          >
            <Star size={14} fill={n <= value ? 'currentColor' : 'none'} />
          </button>
        ) : (
          <Star
            key={n}
            size={12}
            className={n <= value ? 'on' : ''}
            fill={n <= value ? 'currentColor' : 'none'}
          />
        ),
      )}
    </span>
  )
}
export const fieldText = (value: unknown) =>
  Array.isArray(value)
    ? value.join(', ')
    : value === undefined || value === null
      ? ''
      : String(value)

/** One item as a card; the layout class on the parent decides its shape. */
export function ItemCard({
  item,
  fields,
  accent,
  selected = false,
  onOpen,
}: {
  item: Item
  fields: FieldDef[]
  accent: string
  selected?: boolean
  onOpen: () => void
}) {
  const cover = coverFor(item)
  const shown = fields.filter(
    (f) => f.onCard && f.kind !== 'longtext' && fieldText(item.fields[f.id]),
  )
  return (
    <article
      className={`col-card ${selected ? 'selected' : ''}`}
      style={{ '--accent': accent } as React.CSSProperties}
    >
      <button
        type="button"
        className="col-card-button"
        onClick={onOpen}
        aria-label={`Open ${item.title}`}
      >
        <div className="col-cover">
          {cover ? (
            <img src={cover} alt="" loading="lazy" />
          ) : (
            <span className="col-cover-blank" aria-hidden="true" />
          )}
        </div>
        <div className="col-card-body">
          <h3>{item.title}</h3>
          {item.subtitle && <p className="col-subtitle">{item.subtitle}</p>}
          {shown.length > 0 && (
            <dl className="col-fields">
              {shown.slice(0, 4).map((f) => (
                <div key={f.id}>
                  <dt>{f.name}</dt>
                  <dd>{fieldText(item.fields[f.id])}</dd>
                </div>
              ))}
            </dl>
          )}
          <div className="col-card-meta">
            {item.rating > 0 && <Stars value={item.rating} />}
            {item.link && <span className="col-link-chip">{linkLabel(item.link)}</span>}
          </div>
        </div>
      </button>
    </article>
  )
}

/** Detail of one item: everything it holds, read-only. */
export function ItemDetail({
  item,
  fields,
  onClose,
}: {
  item: Item
  fields: FieldDef[]
  onClose: () => void
}) {
  const cover = coverFor(item)
  return (
    <aside className="col-detail" aria-label={`${item.title} details`}>
      <div className="col-detail-head">
        <h2>{item.title}</h2>
        <button type="button" className="icon-button" aria-label="Close details" onClick={onClose}>
          <X size={18} />
        </button>
      </div>
      {cover && <img className="col-detail-cover" src={cover} alt={item.title} />}
      {item.subtitle && <p className="col-subtitle">{item.subtitle}</p>}
      {item.rating > 0 && <Stars value={item.rating} />}
      {item.link && (
        <a className="button" href={item.link} target="_blank" rel="noopener noreferrer">
          <ExternalLink size={14} />
          Open on {linkLabel(item.link)}
        </a>
      )}
      <dl className="col-fields detail">
        {fields
          .filter((f) => fieldText(item.fields[f.id]))
          .map((f) => (
            <div key={f.id}>
              <dt>{f.name}</dt>
              <dd className={f.kind === 'longtext' ? 'long' : ''}>
                {f.kind === 'link' ? (
                  <a href={fieldText(item.fields[f.id])} target="_blank" rel="noopener noreferrer">
                    {fieldText(item.fields[f.id])}
                  </a>
                ) : (
                  fieldText(item.fields[f.id])
                )}
              </dd>
            </div>
          ))}
      </dl>
      {item.notes && <p className="col-notes">{item.notes}</p>}
    </aside>
  )
}

/** The nested tree of collections. A collection filed in two places appears under both. */
export function CollectionTree({
  document: doc,
  currentId,
  onOpen,
}: {
  document: CollectionDocument
  currentId: string
  onOpen: (id: string) => void
}) {
  const render = (id: string, depth: number, trail: Set<string>): React.ReactNode => {
    const c = collectionById(doc, id)
    if (!c || trail.has(id)) return null
    const next = new Set(trail).add(id)
    return (
      <li key={`${[...trail].join('/')}/${id}`}>
        <button
          type="button"
          className={`col-tree-row ${id === currentId ? 'current' : ''}`}
          style={{ paddingLeft: 8 + depth * 14 }}
          aria-current={id === currentId ? 'page' : undefined}
          onClick={() => onOpen(id)}
        >
          <span className="col-emoji" aria-hidden="true">
            {c.emoji}
          </span>
          <span className="col-tree-name">{c.name}</span>
          <span className="col-tree-count">{deepItemCount(doc, id)}</span>
        </button>
        {c.childIds.length > 0 && depth < 8 && (
          <ul>{c.childIds.map((child) => render(child, depth + 1, next))}</ul>
        )}
      </li>
    )
  }
  return (
    <nav className="col-tree" aria-label="Collection tree">
      <ul>{doc.rootIds.map((id) => render(id, 0, new Set()))}</ul>
    </nav>
  )
}

/** The first path from a root to `id`, for a breadcrumb. */
export function pathTo(doc: CollectionDocument, id: string): Collection[] {
  const byId = new Map(doc.collections.map((c) => [c.id, c]))
  const search = (current: string, trail: string[]): string[] | null => {
    if (current === id) return [...trail, current]
    if (trail.includes(current)) return null
    for (const child of byId.get(current)?.childIds ?? []) {
      const found = search(child, [...trail, current])
      if (found) return found
    }
    return null
  }
  for (const root of doc.rootIds) {
    const found = search(root, [])
    if (found) return found.map((i) => byId.get(i)!).filter(Boolean)
  }
  const self = byId.get(id)
  return self ? [self] : []
}

export function filterItems(items: Item[], fields: FieldDef[], query: string) {
  const q = query.trim().toLocaleLowerCase()
  if (!q) return items
  return items.filter((i) =>
    [i.title, i.subtitle, i.notes, ...fields.map((f) => fieldText(i.fields[f.id]))]
      .join(' ')
      .toLocaleLowerCase()
      .includes(q),
  )
}

export default function CollectionBrowser({
  document: doc,
  title,
  startId = '',
  onExit,
}: {
  document: CollectionDocument
  title: string
  startId?: string
  onExit?: () => void
}) {
  const [currentId, setCurrentId] = useState(collectionById(doc, startId)?.id ?? doc.rootIds[0])
  const [openItem, setOpenItem] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const collection = collectionById(doc, currentId) ?? doc.collections[0]
  const items = useMemo(
    () => filterItems(itemsOf(doc, collection), collection.fields, query),
    [doc, collection, query],
  )
  const detail = openItem
    ? (items.find((i) => i.id === openItem) ?? doc.items.find((i) => i.id === openItem))
    : null
  const path = pathTo(doc, collection.id)
  return (
    <div className="col-browser" style={{ '--accent': collection.accent } as React.CSSProperties}>
      <h1 className="visually-hidden">{title}</h1>
      <CollectionTree
        document={doc}
        currentId={collection.id}
        onOpen={(id) => {
          setCurrentId(id)
          setOpenItem(null)
        }}
      />
      <div className="col-main">
        <nav className="col-crumbs" aria-label="Breadcrumb">
          {path.map((c, i) => (
            <span key={c.id}>
              {i > 0 && <ChevronRight size={12} aria-hidden="true" />}
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
          <span className="col-header-emoji" aria-hidden="true">
            {collection.emoji}
          </span>
          <div>
            <h2>{collection.name}</h2>
            {collection.description && <p>{collection.description}</p>}
          </div>
          {onExit && (
            <button
              type="button"
              className="icon-button col-exit"
              aria-label="Close browse view"
              onClick={onExit}
            >
              <X size={18} />
            </button>
          )}
        </header>
        {collection.childIds.length > 0 && (
          <section className="col-children" aria-label="Sub-collections">
            {collection.childIds.map((id) => {
              const child = collectionById(doc, id)
              if (!child) return null
              return (
                <button
                  key={id}
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
                    {deepItemCount(doc, id)} {deepItemCount(doc, id) === 1 ? 'item' : 'items'}
                  </span>
                </button>
              )
            })}
          </section>
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
              onOpen={() => setOpenItem(item.id)}
            />
          ))}
          {!items.length && <p className="col-empty">Nothing here yet.</p>}
        </div>
      </div>
      {detail && (
        <ItemDetail item={detail} fields={collection.fields} onClose={() => setOpenItem(null)} />
      )}
    </div>
  )
}
