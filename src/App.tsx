import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import {
  Archive,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Copy,
  ExternalLink,
  Folder,
  FolderOpen,
  Grid2X2,
  Layers3,
  LayoutGrid,
  Library as LibraryIcon,
  List,
  Menu,
  Monitor,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  SquareFunction,
  Star,
  StickyNote,
  Table2,
  Trash2,
  X,
} from 'lucide-react'
import {
  actOnProject,
  addProject,
  duplicateProject,
  editProject,
  removeCollection,
  saveCollection,
  saveNotes,
  saveGraph,
  initializeGraph,
  selectProjects,
  starterInput,
  starterNotes,
  STORAGE_KEY,
  type Collection,
  type Library,
  type Project,
  type ProjectAction,
  type ProjectInput,
  type Sort,
  type Tool,
  type View,
} from './library'
import { useLibrary } from './useLibrary'
import GraphCalculator from './graph/GraphCalculator'
import { emptyGraph, laplaceGraph, LAPLACE_URL, type GraphDocument } from './graph/model'

type ModalState =
  | { kind: 'project'; project?: Project }
  | { kind: 'collection'; collection?: Collection }
  | { kind: 'removeCollection'; collection: Collection }
  | { kind: 'storage' }
  | null
const toolNames: Record<Tool, string> = { graph: 'Graphing', sheet: 'Spreadsheet' }
const formatDate = (date: string) =>
  new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(date))
const projectRoute = (id: string) => `#/project/${id}`
const viewRoute = (view: View) =>
  `#/${view.startsWith('collection:') ? `collection/${view.slice(11)}` : view}`
const readRoute = () => window.location.hash || '#/all'

function ToolIcon({ tool, size = 18 }: { tool: Tool; size?: number }) {
  return tool === 'graph' ? <SquareFunction size={size} /> : <Table2 size={size} />
}
function ToolLabels({ tools }: { tools: Tool[] }) {
  return (
    <span className="tool-labels">
      {tools.map((tool) => (
        <span key={tool}>
          <ToolIcon tool={tool} size={13} />
          {toolNames[tool]}
        </span>
      ))}
    </span>
  )
}

function ProjectArt({ tools, large = false }: { tools: Tool[]; large?: boolean }) {
  return (
    <div
      className={`project-art ${tools.length === 2 ? 'mixed-art' : tools[0]} ${large ? 'large-art' : ''}`}
      aria-hidden="true"
    >
      {tools.includes('graph') && (
        <svg className="graph-art" viewBox="0 0 320 140" fill="none">
          <path className="art-axis" d="M20 100H306M72 14V129" />
          <path
            className="art-curve-secondary"
            d="M18 89C62 89 81 58 122 57S165 114 205 82 244 25 301 23"
          />
          <path
            className="art-curve"
            d="M20 108C67 108 65 32 107 32S145 108 179 91 207 42 241 57 266 89 301 66"
          />
          <circle cx="107" cy="32" r="4" className="art-dot" />
        </svg>
      )}
      {tools.includes('sheet') && (
        <div className="sheet-art">
          <div className="sheet-ruler">
            <span />
            {['A', 'B', 'C'].map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>
          {[1, 2, 3, 4].map((n) => (
            <div key={n}>
              <span>{n}</span>
              <span />
              <span className={n === 2 ? 'selected-cell' : ''} />
              <span />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Modal({
  title,
  subtitle,
  children,
  onClose,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current!
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialog.showModal()
    dialog.querySelector<HTMLInputElement>('input, textarea, select')?.focus()
    return () => {
      dialog.close()
      if (opener?.isConnected) opener.focus()
    }
  }, [])
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby="dialog-title"
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
    >
      <div className="modal-heading">
        <div>
          <h2 id="dialog-title">{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Close dialog">
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  )
}

function ProjectForm({
  project,
  library,
  collectionId,
  error,
  onSave,
  onClose,
}: {
  project?: Project
  library: Library
  collectionId: string | null
  error: string
  onSave: (input: ProjectInput) => void
  onClose: () => void
}) {
  const [title, setTitle] = useState(project?.title ?? '')
  const [description, setDescription] = useState(project?.description ?? '')
  const [tools, setTools] = useState<Tool[]>(project?.tools ?? ['graph', 'sheet'])
  const [collection, setCollection] = useState(project?.collectionId ?? collectionId ?? '')
  const [referenceUrl, setReferenceUrl] = useState(project?.referenceUrl ?? '')
  const [validation, setValidation] = useState('')
  function submit(event: FormEvent) {
    event.preventDefault()
    if (!title.trim()) {
      setValidation('Give your project a name.')
      return
    }
    if (!tools.length) {
      setValidation('Choose at least one tool.')
      return
    }
    setValidation('')
    onSave({ title, description, tools, collectionId: collection || null, referenceUrl })
  }
  return (
    <form onSubmit={submit} className="project-form">
      <label>
        Project name
        <input
          autoFocus
          required
          maxLength={100}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. My next experiment"
        />
      </label>
      <label>
        Description <span className="optional">optional</span>
        <textarea
          rows={2}
          maxLength={500}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What are you working on?"
        />
      </label>
      <fieldset>
        <legend>Tools in this project</legend>
        <div className="tool-choices">
          {(['graph', 'sheet'] as Tool[]).map((tool) => (
            <label className={`tool-choice ${tools.includes(tool) ? 'selected' : ''}`} key={tool}>
              <input
                type="checkbox"
                checked={tools.includes(tool)}
                onChange={(e) =>
                  setTools(e.target.checked ? [...tools, tool] : tools.filter((t) => t !== tool))
                }
              />
              <ToolIcon tool={tool} size={23} />
              <span>{toolNames[tool]}</span>
              <span className="check-box">{tools.includes(tool) && <Check size={13} />}</span>
            </label>
          ))}
        </div>
        <p className="field-hint">
          The graphing calculator is ready. The spreadsheet editor comes next.
        </p>
      </fieldset>
      <label>
        Collection
        <select value={collection} onChange={(e) => setCollection(e.target.value)}>
          <option value="">Unfiled</option>
          {library.collections.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Reference link <span className="optional">optional</span>
        <input
          type="url"
          maxLength={2000}
          placeholder="https://"
          value={referenceUrl}
          onChange={(e) => setReferenceUrl(e.target.value)}
        />
      </label>
      {(validation || error) && (
        <p role="alert" className="form-error">
          {validation || error}
        </p>
      )}
      <div className="modal-footer">
        <button type="button" className="button secondary" onClick={onClose}>
          Cancel
        </button>
        <button className="button primary" type="submit">
          {project ? 'Save changes' : 'Create project'}
          <ArrowRight size={16} />
        </button>
      </div>
    </form>
  )
}

function CollectionForm({
  collection,
  error,
  onSave,
  onClose,
}: {
  collection?: Collection
  error: string
  onSave: (name: string) => void
  onClose: () => void
}) {
  const [value, setValue] = useState(collection?.name ?? '')
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        onSave(value)
      }}
    >
      <label>
        Collection name
        <input
          autoFocus
          required
          maxLength={60}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. Engineering, Ideas, Coursework"
        />
      </label>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <div className="modal-footer">
        <button type="button" className="button secondary" onClick={onClose}>
          Cancel
        </button>
        <button className="button primary">
          {collection ? 'Save changes' : 'Create collection'}
        </button>
      </div>
    </form>
  )
}

function ProjectMenu({
  project,
  onAction,
  onEdit,
  onDuplicate,
}: {
  project: Project
  onAction: (p: Project, action: ProjectAction) => void
  onEdit: (p: Project) => void
  onDuplicate: (p: Project) => void
}) {
  const ref = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    function outside(event: PointerEvent) {
      if (!ref.current?.contains(event.target as Node)) ref.current?.removeAttribute('open')
    }
    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape') ref.current?.removeAttribute('open')
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [])
  const run = (action: () => void) => {
    ref.current?.removeAttribute('open')
    action()
  }
  return (
    <details className="project-menu" ref={ref}>
      <summary
        className="icon-button"
        aria-label={`Actions for ${project.title}`}
        title="Project actions"
      >
        <MoreHorizontal size={20} />
      </summary>
      <div className="menu-panel">
        {project.status === 'trashed' ? (
          <button onClick={() => run(() => onAction(project, 'restore'))}>
            <RotateCcw size={16} />
            Restore project
          </button>
        ) : (
          <>
            <button onClick={() => run(() => onEdit(project))}>
              <Pencil size={16} />
              Edit details
            </button>
            <button onClick={() => run(() => onDuplicate(project))}>
              <Copy size={16} />
              Duplicate
            </button>
            <button
              onClick={() =>
                run(() => onAction(project, project.status === 'archived' ? 'activate' : 'archive'))
              }
            >
              <Archive size={16} />
              {project.status === 'archived' ? 'Move to library' : 'Archive'}
            </button>
            <div className="menu-rule" />
            <button className="danger-text" onClick={() => run(() => onAction(project, 'trash'))}>
              <Trash2 size={16} />
              Move to trash
            </button>
          </>
        )}
      </div>
    </details>
  )
}

function ProjectCard({
  project,
  library,
  open,
  action,
  edit,
  duplicate,
}: {
  project: Project
  library: Library
  open: (p: Project) => void
  action: (p: Project, action: ProjectAction) => void
  edit: (p: Project) => void
  duplicate: (p: Project) => void
}) {
  const collection = library.collections.find((c) => c.id === project.collectionId)
  return (
    <article className="project-card" aria-label={project.title}>
      <a
        href={projectRoute(project.id)}
        className="card-art-link"
        tabIndex={-1}
        aria-hidden="true"
        onClick={(e) => {
          e.preventDefault()
          open(project)
        }}
      >
        <ProjectArt tools={project.tools} />
      </a>
      <div className="card-body">
        <div className="card-heading">
          <a
            className="project-link"
            href={projectRoute(project.id)}
            onClick={(e) => {
              e.preventDefault()
              open(project)
            }}
          >
            {project.title}
          </a>
          <ProjectMenu project={project} onAction={action} onEdit={edit} onDuplicate={duplicate} />
        </div>
        <p className="card-description">
          {project.description || 'A little space for your next idea.'}
        </p>
        <ToolLabels tools={project.tools} />
        <div className="card-footer">
          <span className="card-collection">
            <Folder size={13} />
            {collection?.name ?? 'Unfiled'}
          </span>
          <span>{formatDate(project.updatedAt)}</span>
          {project.status !== 'trashed' && (
            <button
              className={`icon-button favorite-button ${project.favorite ? 'is-favorite' : ''}`}
              aria-label={`${project.favorite ? 'Unfavorite' : 'Favorite'} ${project.title}`}
              onClick={() => action(project, 'favorite')}
            >
              <Star size={16} fill={project.favorite ? 'currentColor' : 'none'} />
            </button>
          )}
        </div>
      </div>
    </article>
  )
}

export default function App() {
  const { library, error, saveError, commit, reload } = useLibrary()
  const [route, setRoute] = useState(readRoute)
  const [query, setQuery] = useState('')
  const [tool, setTool] = useState<Tool | 'all'>('all')
  const [sort, setSort] = useState<Sort>('updated')
  const [layout, setLayout] = useState<'grid' | 'list'>('grid')
  const [modal, setModal] = useState<ModalState>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [toast, setToast] = useState<{ text: string; undo?: () => void } | null>(null)
  const [notesDraft, setNotesDraft] = useState<{ id: string; value: string } | null>(null)
  const [graphDraft, setGraphDraft] = useState<{ id: string; value: GraphDocument } | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const changed = () => {
      if ((notesDraft || graphDraft) && readRoute() !== route) {
        if (
          !window.confirm(
            'Your latest changes have not been saved. Leave this project and discard those unsaved changes?',
          )
        ) {
          window.history.replaceState(null, '', route)
          return
        }
        setNotesDraft(null)
        setGraphDraft(null)
      }
      setRoute(readRoute())
    }
    window.addEventListener('hashchange', changed)
    return () => window.removeEventListener('hashchange', changed)
  }, [notesDraft, graphDraft, route])
  useEffect(() => {
    if (!notesDraft && !graphDraft) return
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [notesDraft, graphDraft])
  useEffect(() => {
    setQuery('')
    setTool('all')
    setSidebarOpen(false)
  }, [route])
  useEffect(() => {
    if (!toast) return
    const timeout = setTimeout(() => setToast(null), 6000)
    return () => clearTimeout(timeout)
  }, [toast])
  useEffect(() => {
    const shortcut = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k' && searchRef.current && !modal) {
        e.preventDefault()
        searchRef.current.focus()
      }
    }
    window.addEventListener('keydown', shortcut)
    return () => window.removeEventListener('keydown', shortcut)
  }, [modal])
  const view: View = route.startsWith('#/collection/')
    ? `collection:${route.slice(13)}`
    : route === '#/favorites'
      ? 'favorites'
      : route === '#/archive'
        ? 'archive'
        : route === '#/trash'
          ? 'trash'
          : 'all'
  const projectId = route.startsWith('#/project/') ? route.slice(10).split('/')[0] : null
  const currentProject = library?.projects.find((p) => p.id === projectId)
  const graphOpen = !!currentProject?.tools.includes('graph') && route.endsWith('/graph')
  const fallbackGraph = useMemo(
    () => (currentProject?.referenceUrl === LAPLACE_URL ? laplaceGraph() : emptyGraph()),
    [currentProject?.id, currentProject?.referenceUrl],
  )
  const currentCollection = library?.collections.find((c) => `collection:${c.id}` === view)
  const title =
    view === 'favorites'
      ? 'Favorites'
      : view === 'archive'
        ? 'Archive'
        : view === 'trash'
          ? 'Trash'
          : view.startsWith('collection:')
            ? (currentCollection?.name ?? 'Collection not found')
            : 'Your library'
  useEffect(() => {
    document.title = `${currentProject?.title ?? title} · Junga`
  }, [title, currentProject?.title])

  function navigate(view: View) {
    window.location.hash = viewRoute(view)
    setSidebarOpen(false)
  }
  function showModal(value: ModalState) {
    setModal(value)
  }
  function open(project: Project) {
    commit((current) => actOnProject(current, project.id, 'open'))
    window.location.hash = projectRoute(project.id)
  }
  function action(project: Project, kind: ProjectAction) {
    if (commit((current) => actOnProject(current, project.id, kind))) {
      const text =
        kind === 'trash'
          ? 'Project moved to trash.'
          : kind === 'restore'
            ? `Project restored to ${project.trashedFrom === 'archived' ? 'Archive' : 'your library'}.`
            : kind === 'archive'
              ? 'Project archived.'
              : kind === 'activate'
                ? 'Project moved to your library.'
                : project.favorite
                  ? 'Removed from favorites.'
                  : 'Added to favorites.'
      setToast({
        text,
        undo:
          kind === 'trash'
            ? () => {
                if (commit((current) => actOnProject(current, project.id, 'restore')))
                  setToast({ text: 'Project restored.' })
              }
            : undefined,
      })
    }
  }
  function openGraph(project: Project) {
    if (project.status === 'trashed' || commit((current) => initializeGraph(current, project.id))) {
      window.location.hash = `${projectRoute(project.id)}/graph`
    }
  }
  function duplicate(project: Project) {
    if (commit((current) => duplicateProject(current, project.id).library))
      setToast({ text: 'A copy was added to your library.' })
  }
  function addStarter() {
    let id = ''
    if (
      commit((current) => {
        const result = addProject(
          current,
          { ...starterInput, collectionId: currentCollection?.id ?? null },
          starterNotes,
          laplaceGraph(),
        )
        id = result.project.id
        return result.library
      })
    ) {
      window.location.hash = projectRoute(id)
      setToast({ text: 'LaPlace example project created.' })
    }
  }
  function exportBackup() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY) ?? JSON.stringify(library, null, 2)
      const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }))
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `junga-library-${new Date().toISOString().slice(0, 10)}.json`
      anchor.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setToast({ text: 'Library backup downloaded.' })
    } catch {
      setToast({ text: 'The backup could not be downloaded. Browser storage is unavailable.' })
    }
  }
  if (!library || error)
    return (
      <main className="recovery">
        <div className="brand-mark">J</div>
        <h1>Let’s keep your work safe.</h1>
        <p role="alert">{error || 'The library is unavailable.'}</p>
        <p>
          Nothing has been overwritten. Download the stored library before trying to recover it.
        </p>
        <div className="button-row">
          <button className="button primary" onClick={exportBackup}>
            <ArrowDownToLine size={17} />
            Download stored data
          </button>
          <button className="button secondary" onClick={reload}>
            Try again
          </button>
        </div>
      </main>
    )

  const projects = selectProjects(library, view, query, tool, sort)
  const total = selectProjects(library, view).length
  const activeCount = selectProjects(library, 'all').length
  const missingCollection = view.startsWith('collection:') && !currentCollection
  const navItems = [
    { id: 'all' as View, name: 'All projects', icon: LibraryIcon },
    { id: 'favorites' as View, name: 'Favorites', icon: Star },
    { id: 'archive' as View, name: 'Archive', icon: Archive },
    { id: 'trash' as View, name: 'Trash', icon: Trash2 },
  ]

  return (
    <div className="app-shell">
      <a
        href="#main-content"
        className="skip-link"
        onClick={(e) => {
          e.preventDefault()
          document.getElementById('main-content')?.focus()
        }}
      >
        Skip to content
      </a>
      {sidebarOpen && (
        <button
          className="sidebar-scrim"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close navigation"
        />
      )}
      <aside
        id="workspace-sidebar"
        aria-label="Workspace sidebar"
        className={`sidebar ${sidebarOpen ? 'is-open' : ''}`}
      >
        <a href="#/all" className="brand" aria-label="Junga home">
          <img src="/favicon.svg" alt="" width="35" height="35" />
          <span>
            junga<span className="brand-subtitle">YOUR WORKSPACE</span>
          </span>
        </a>
        <div className="workspace-switch">
          <span className="workspace-avatar">J</span>
          <div>
            <strong>Personal workspace</strong>
            <span>A place for your work</span>
          </div>
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Library navigation">
          {navItems.map((item) => (
            <a
              key={item.id}
              href={viewRoute(item.id)}
              onClick={() => setSidebarOpen(false)}
              className={`nav-item ${!projectId && view === item.id ? 'active' : ''}`}
              aria-current={!projectId && view === item.id ? 'page' : undefined}
            >
              <item.icon size={18} />
              <span>{item.name}</span>
              <span className="nav-count">{selectProjects(library, item.id).length}</span>
            </a>
          ))}
        </nav>
        <div className="nav-label collections-label">
          <span>COLLECTIONS</span>
          <button
            className="icon-button"
            aria-label="New collection"
            title="New collection"
            onClick={() => showModal({ kind: 'collection' })}
          >
            <Plus size={17} />
          </button>
        </div>
        <nav aria-label="Collections" className="collections-nav">
          {library.collections.map((collection) => (
            <div
              key={collection.id}
              className={`collection-item ${!projectId && currentCollection?.id === collection.id ? 'active' : ''}`}
            >
              <a
                href={viewRoute(`collection:${collection.id}`)}
                onClick={() => setSidebarOpen(false)}
                aria-current={
                  !projectId && currentCollection?.id === collection.id ? 'page' : undefined
                }
              >
                <span className="collection-dot" />
                <span>{collection.name}</span>
              </a>
              <button
                className="icon-button"
                aria-label={`Edit collection ${collection.name}`}
                onClick={() => showModal({ kind: 'collection', collection })}
              >
                <Pencil size={13} />
              </button>
            </div>
          ))}
        </nav>
        {!library.collections.length && (
          <button className="add-collection" onClick={() => showModal({ kind: 'collection' })}>
            <Plus size={14} />
            Add a collection
          </button>
        )}
        <div className="sidebar-bottom">
          <div className="local-note">
            <span className="local-icon">
              <Monitor size={18} />
            </span>
            <div>
              <strong>Your space, on this device</strong>
              <p>Projects are saved in this browser.</p>
            </div>
            <button
              className="icon-button"
              aria-label="About local storage"
              onClick={() => showModal({ kind: 'storage' })}
            >
              <CircleHelp size={15} />
            </button>
          </div>
          <button className="backup-link" onClick={exportBackup}>
            <ArrowDownToLine size={15} />
            Download library backup
          </button>
          <div className="sidebar-signoff">
            <span className="tiny-mark">J</span>
            <span>Junga Workspace</span>
            <span className="version-badge">Prototype</span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              aria-expanded={sidebarOpen}
              aria-controls="workspace-sidebar"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={20} />
            </button>
            <Layers3 size={16} />
            <a href="#/all">Workspace</a>
            <ChevronRight size={14} />
            <span>
              {graphOpen
                ? 'Graphing'
                : projectId
                  ? 'Project'
                  : currentCollection
                    ? 'Collection'
                    : 'Library'}
            </span>
          </div>
          <button className="save-indicator" onClick={() => showModal({ kind: 'storage' })}>
            <span className="status-dot" />
            {saveError || notesDraft || graphDraft ? 'Changes not saved' : 'Saved on this device'}
            <ChevronDown size={12} />
          </button>
        </header>
        <main
          id="main-content"
          className={`main-content ${graphOpen ? 'calculator-main' : ''}`}
          tabIndex={-1}
        >
          {saveError && (
            <div className="error-banner" role="alert">
              <strong>Change not saved.</strong> {saveError}
            </div>
          )}
          {projectId ? (
            currentProject ? (
              graphOpen ? (
                <GraphCalculator
                  key={currentProject.id}
                  title={currentProject.title}
                  graph={
                    graphDraft?.id === currentProject.id
                      ? graphDraft.value
                      : (currentProject.graph ?? fallbackGraph)
                  }
                  readOnly={currentProject.status === 'trashed'}
                  unsaved={graphDraft?.id === currentProject.id}
                  onBack={() => {
                    window.location.hash = projectRoute(currentProject.id)
                  }}
                  onChange={(graph) => {
                    setGraphDraft({ id: currentProject.id, value: graph })
                    const saved = commit((current) => saveGraph(current, currentProject.id, graph))
                    if (saved) setGraphDraft(null)
                    return saved
                  }}
                />
              ) : (
                <>
                  <button
                    className="back-link"
                    onClick={() =>
                      navigate(
                        currentProject.status === 'trashed'
                          ? 'trash'
                          : currentProject.status === 'archived'
                            ? 'archive'
                            : 'all',
                      )
                    }
                  >
                    <ArrowLeft size={15} />
                    Back to{' '}
                    {currentProject.status === 'trashed'
                      ? 'trash'
                      : currentProject.status === 'archived'
                        ? 'archive'
                        : 'library'}
                  </button>
                  <div className="project-detail-heading">
                    <div className="detail-icon">
                      {currentProject.tools.length === 2 ? (
                        <Layers3 size={27} />
                      ) : (
                        <ToolIcon tool={currentProject.tools[0]} size={27} />
                      )}
                    </div>
                    <div className="detail-title">
                      <div className="eyebrow">PROJECT OVERVIEW</div>
                      <h1>{currentProject.title}</h1>
                    </div>
                    <div className="detail-actions">
                      {currentProject.status !== 'trashed' && (
                        <>
                          <button
                            className={`icon-button ${currentProject.favorite ? 'is-favorite' : ''}`}
                            aria-label={`${currentProject.favorite ? 'Unfavorite' : 'Favorite'} ${currentProject.title}`}
                            onClick={() => action(currentProject, 'favorite')}
                          >
                            <Star
                              size={20}
                              fill={currentProject.favorite ? 'currentColor' : 'none'}
                            />
                          </button>
                          <button
                            className="button secondary"
                            onClick={() => showModal({ kind: 'project', project: currentProject })}
                          >
                            <Pencil size={15} />
                            Edit details
                          </button>
                        </>
                      )}
                      <ProjectMenu
                        project={currentProject}
                        onAction={action}
                        onEdit={(p) => showModal({ kind: 'project', project: p })}
                        onDuplicate={duplicate}
                      />
                    </div>
                  </div>
                  {currentProject.status !== 'active' && (
                    <div className="state-banner">
                      <Archive size={17} />
                      <span>
                        {currentProject.status === 'trashed'
                          ? 'This project is in the trash. Restore it to continue working.'
                          : 'This project is archived. Your work is kept here for later.'}
                      </span>
                      <button
                        onClick={() =>
                          action(
                            currentProject,
                            currentProject.status === 'trashed' ? 'restore' : 'activate',
                          )
                        }
                      >
                        {currentProject.status === 'trashed'
                          ? 'Restore project'
                          : 'Move to library'}
                        <RotateCcw size={14} />
                      </button>
                    </div>
                  )}
                  <p className="detail-description">
                    {currentProject.description ||
                      'Add a description to give this project a little context.'}
                  </p>
                  <div className="detail-meta">
                    <span>
                      <Folder size={14} />
                      {library.collections.find((c) => c.id === currentProject.collectionId)
                        ?.name ?? 'Unfiled'}
                    </span>
                    <span>Created {formatDate(currentProject.createdAt)}</span>
                    <span>Updated {formatDate(currentProject.updatedAt)}</span>
                  </div>
                  <div className="project-detail-grid">
                    <section className="project-main">
                      <div className="section-heading">
                        <h2>Project tools</h2>
                        <span>
                          {currentProject.tools.length}{' '}
                          {currentProject.tools.length === 1 ? 'tool' : 'tools'}
                        </span>
                      </div>
                      <div className="tool-panels">
                        {currentProject.tools.map((t) => (
                          <div className={`tool-panel ${t}`} key={t}>
                            <div className="tool-panel-icon">
                              <ToolIcon tool={t} size={25} />
                            </div>
                            <h3>
                              {toolNames[t] === 'Graphing' ? 'Graphing calculator' : 'Spreadsheet'}
                            </h3>
                            <p>
                              {t === 'graph'
                                ? 'A space to explore functions, parameters, and the shapes they make.'
                                : 'A space to organize values, build formulas, and work through ideas.'}
                            </p>
                            {t === 'graph' ? (
                              <button
                                className="button primary open-calculator"
                                onClick={() => openGraph(currentProject)}
                              >
                                Open calculator
                                <ArrowRight size={15} />
                              </button>
                            ) : (
                              <span className="coming-label">Editor in a later build</span>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="section-heading notes-heading">
                        <h2>
                          <StickyNote size={18} />
                          Project notes
                        </h2>
                        <span>
                          <CheckCheck size={14} />
                          {notesDraft ? 'Draft not saved' : 'Saved as you type'}
                        </span>
                      </div>
                      <textarea
                        className="notes-editor"
                        aria-label="Project notes"
                        placeholder="Capture an idea, outline your model, or leave a note for next time…"
                        value={
                          notesDraft?.id === currentProject.id
                            ? notesDraft.value
                            : currentProject.notes
                        }
                        maxLength={20000}
                        disabled={currentProject.status === 'trashed'}
                        onChange={(e) => {
                          const value = e.target.value
                          setNotesDraft({ id: currentProject.id, value })
                          if (commit((current) => saveNotes(current, currentProject.id, value)))
                            setNotesDraft(null)
                        }}
                      />
                      <>
                        {notesDraft?.id === currentProject.id && (
                          <div className="unsaved-note" role="status">
                            <span>Your draft is kept on this page. Save it before leaving.</span>
                            <button
                              className="button secondary"
                              onClick={() => {
                                if (
                                  commit((current) =>
                                    saveNotes(current, currentProject.id, notesDraft.value),
                                  )
                                ) {
                                  setNotesDraft(null)
                                  setToast({ text: 'Notes saved.' })
                                }
                              }}
                            >
                              Retry saving notes
                            </button>
                          </div>
                        )}
                      </>
                      <p className="notes-footnote">
                        A little context now makes it easier to pick up later.
                      </p>
                    </section>
                    <aside className="project-context" aria-label="Project references and context">
                      <h2>Project reference</h2>
                      {currentProject.referenceUrl ? (
                        <a
                          className="reference-card"
                          href={currentProject.referenceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <span className="reference-icon">
                            <ExternalLink size={18} />
                          </span>
                          <strong>{new URL(currentProject.referenceUrl).hostname}</strong>
                          <span>
                            Open reference
                            <ExternalLink size={13} />
                          </span>
                        </a>
                      ) : (
                        <div className="no-reference">
                          <ExternalLink size={21} />
                          <p>Keep a link to the inspiration or source behind your project.</p>
                          {currentProject.status !== 'trashed' && (
                            <button
                              className="text-button"
                              onClick={() =>
                                showModal({ kind: 'project', project: currentProject })
                              }
                            >
                              Add a reference
                              <Plus size={14} />
                            </button>
                          )}
                        </div>
                      )}
                      <div className="context-tip">
                        <FolderOpen size={22} />
                        <h3>A home for the whole project</h3>
                        <p>
                          Your notes, references, and tools stay together. Each tool will have its
                          own working data.
                        </p>
                      </div>
                    </aside>
                  </div>
                </>
              )
            ) : (
              <div className="empty-state">
                <FolderOpen size={42} />
                <h1>Project not found</h1>
                <p>It may belong to a different browser or device.</p>
                <button className="button primary" onClick={() => navigate('all')}>
                  Back to library
                </button>
              </div>
            )
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">YOUR WORK, TOGETHER</div>
                  <h1>{title}</h1>
                  <p>
                    {view === 'archive'
                      ? 'Finished for now. Ready whenever you need it.'
                      : view === 'trash'
                        ? 'Projects stay here until you’re ready to restore them.'
                        : view === 'favorites'
                          ? 'The projects you want to keep close.'
                          : currentCollection
                            ? 'A shared home for related projects.'
                            : 'A home for your ideas, models, and working projects.'}
                  </p>
                </div>
                <div className="heading-actions">
                  {currentCollection && (
                    <button
                      className="icon-button"
                      aria-label={`Remove collection ${currentCollection.name}`}
                      title="Remove collection"
                      onClick={() =>
                        showModal({ kind: 'removeCollection', collection: currentCollection })
                      }
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                  {view !== 'trash' && view !== 'archive' && !missingCollection && (
                    <button
                      className="button primary"
                      onClick={() => showModal({ kind: 'project' })}
                    >
                      <Plus size={18} />
                      New project
                    </button>
                  )}
                </div>
              </div>
              <div className="library-toolbar">
                <div className="search-box">
                  <Search size={17} />
                  <input
                    ref={searchRef}
                    type="search"
                    aria-label="Search projects"
                    placeholder="Search projects…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <kbd>Ctrl K</kbd>
                </div>
                <div className="toolbar-controls">
                  <div className="select-wrap">
                    <SlidersHorizontal size={15} />
                    <select
                      aria-label="Filter by tool"
                      value={tool}
                      onChange={(e) => setTool(e.target.value as Tool | 'all')}
                    >
                      <option value="all">All tools</option>
                      <option value="graph">Graphing</option>
                      <option value="sheet">Spreadsheet</option>
                    </select>
                  </div>
                  <select
                    className="sort-select"
                    aria-label="Sort projects"
                    value={sort}
                    onChange={(e) => setSort(e.target.value as Sort)}
                  >
                    <option value="updated">Last updated</option>
                    <option value="name">Name A–Z</option>
                    <option value="created">Newest created</option>
                  </select>
                  <div className="view-toggle" role="group" aria-label="Library view">
                    <button
                      className={layout === 'grid' ? 'selected' : ''}
                      aria-label="Grid view"
                      aria-pressed={layout === 'grid'}
                      onClick={() => setLayout('grid')}
                    >
                      <LayoutGrid size={16} />
                    </button>
                    <button
                      className={layout === 'list' ? 'selected' : ''}
                      aria-label="List view"
                      aria-pressed={layout === 'list'}
                      onClick={() => setLayout('list')}
                    >
                      <List size={17} />
                    </button>
                  </div>
                </div>
              </div>
              <div className="results-heading">
                <span>
                  {projects.length} {projects.length === 1 ? 'project' : 'projects'}
                  {query || tool !== 'all' ? ` of ${total}` : ''}
                </span>
                <span>
                  {view === 'trash'
                    ? 'Nothing is permanently deleted'
                    : 'Make something worth keeping.'}
                </span>
              </div>
              {projects.length ? (
                <div className={`project-grid ${layout === 'list' ? 'list-view' : ''}`}>
                  {projects.map((project) => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      library={library}
                      open={open}
                      action={action}
                      edit={(p) => showModal({ kind: 'project', project: p })}
                      duplicate={duplicate}
                    />
                  ))}
                </div>
              ) : query || tool !== 'all' ? (
                <div className="empty-state">
                  <Search size={35} />
                  <h2>No matching projects</h2>
                  <p>Try another name, description, or tool.</p>
                  <button
                    className="button secondary"
                    onClick={() => {
                      setQuery('')
                      setTool('all')
                    }}
                  >
                    Clear filters
                  </button>
                </div>
              ) : view === 'all' && activeCount === 0 && library.projects.length === 0 ? (
                <>
                  <section className="welcome-panel">
                    <div className="welcome-copy">
                      <span className="welcome-tag">
                        <span className="status-dot" />A FRESH WORKSPACE
                      </span>
                      <h2>
                        Good ideas deserve
                        <br />a place to grow.
                      </h2>
                      <p>
                        Bring your projects together. Give each one a name, a home, and a little
                        room to explore.
                      </p>
                      <button
                        className="button primary"
                        onClick={() => showModal({ kind: 'project' })}
                      >
                        Create your first project
                        <ArrowRight size={17} />
                      </button>
                      <span className="welcome-footnote">Start small. Make it yours.</span>
                    </div>
                    <div className="welcome-illustration" aria-hidden="true">
                      <div className="illustration-sheet">
                        <div className="illustration-title">
                          <Table2 size={15} />
                          <span>Spreadsheet</span>
                          <MoreHorizontal size={16} />
                        </div>
                        <ProjectArt tools={['sheet']} />
                      </div>
                      <div className="illustration-graph">
                        <div className="illustration-title">
                          <SquareFunction size={15} />
                          <span>Graphing</span>
                          <span className="illustration-dot" />
                        </div>
                        <ProjectArt tools={['graph']} />
                        <div className="illustration-caption">
                          <span>One project. New possibilities.</span>
                          <ArrowRight size={14} />
                        </div>
                      </div>
                      <div className="illustration-folder">
                        <Folder size={20} />
                        All in one place
                        <Check size={14} />
                      </div>
                    </div>
                  </section>
                  <section className="starter-strip">
                    <div className="starter-icon">
                      <SquareFunction size={24} />
                    </div>
                    <div>
                      <span className="eyebrow">FROM YOUR EXAMPLES</span>
                      <h3>LaPlace Intuition</h3>
                      <p>Explore the recreated graph with editable functions and sliders.</p>
                    </div>
                    <button className="button secondary" onClick={addStarter}>
                      Use this example
                      <ArrowRight size={15} />
                    </button>
                  </section>
                  <div className="workflow-strip">
                    <div>
                      <span>01</span>
                      <h3>Create a project</h3>
                      <p>Give your work a starting point.</p>
                    </div>
                    <div>
                      <span>02</span>
                      <h3>Keep it organized</h3>
                      <p>Group related ideas into collections.</p>
                    </div>
                    <div>
                      <span>03</span>
                      <h3>Pick up where you left off</h3>
                      <p>Your work stays saved in this browser.</p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="empty-state">
                  {view === 'trash' ? (
                    <Trash2 size={36} />
                  ) : view === 'favorites' ? (
                    <Star size={36} />
                  ) : view === 'archive' ? (
                    <Archive size={36} />
                  ) : (
                    <FolderOpen size={36} />
                  )}
                  <h2>
                    {missingCollection
                      ? 'This collection is no longer here'
                      : view === 'trash'
                        ? 'The trash is empty'
                        : view === 'favorites'
                          ? 'Keep your favorites close'
                          : view === 'archive'
                            ? 'Nothing archived yet'
                            : 'A little room for something new'}
                  </h2>
                  <p>
                    {view === 'favorites'
                      ? 'Star a project and you’ll find it here.'
                      : view === 'trash'
                        ? 'Projects you move to trash can be restored here.'
                        : view === 'archive'
                          ? 'Archive a project when you want to put it aside.'
                          : missingCollection
                            ? 'Its projects are still in your library.'
                            : 'Create a project or move one here using Edit details.'}
                  </p>
                  {(view.startsWith('collection:') || view === 'all') && !missingCollection && (
                    <button
                      className="button primary"
                      onClick={() => showModal({ kind: 'project' })}
                    >
                      <Plus size={16} />
                      New project
                    </button>
                  )}
                  <button className="text-button" onClick={() => navigate('all')}>
                    View all projects
                    <ArrowRight size={15} />
                  </button>
                </div>
              )}
              <footer className="library-footer">
                <span>
                  <Grid2X2 size={13} />A little more organized. A little more possible.
                </span>
                <span>JUNGA / LIBRARY</span>
              </footer>
            </>
          )}
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          <span>{toast.text}</span>
          {toast.undo && <button onClick={toast.undo}>Undo</button>}
          <button aria-label="Dismiss notification" onClick={() => setToast(null)}>
            <X size={15} />
          </button>
        </div>
      )}
      {modal?.kind === 'project' && (
        <Modal
          title={modal.project ? 'Edit project' : 'A new beginning'}
          subtitle={
            modal.project
              ? 'Keep the details of your work up to date.'
              : 'Give your next idea a place in your workspace.'
          }
          onClose={() => setModal(null)}
        >
          <ProjectForm
            project={modal.project}
            library={library}
            collectionId={currentCollection?.id ?? null}
            error={saveError}
            onClose={() => setModal(null)}
            onSave={(input) => {
              let id = modal.project?.id ?? ''
              const success = commit((current) => {
                if (modal.project) return editProject(current, modal.project.id, input)
                const result = addProject(current, input)
                id = result.project.id
                return result.library
              })
              if (success) {
                setModal(null)
                window.location.hash = projectRoute(id)
                setToast({
                  text: modal.project ? 'Project details saved.' : 'Your project is ready.',
                })
              }
            }}
          />
        </Modal>
      )}
      {modal?.kind === 'collection' && (
        <Modal
          title={modal.collection ? 'Edit collection' : 'Create a collection'}
          subtitle="A simple way to keep related projects together."
          onClose={() => setModal(null)}
        >
          <CollectionForm
            collection={modal.collection}
            error={saveError}
            onClose={() => setModal(null)}
            onSave={(name) => {
              let id = modal.collection?.id
              if (
                commit((current) => {
                  const next = saveCollection(current, name, id)
                  id ??= next.collections.at(-1)!.id
                  return next
                })
              ) {
                setModal(null)
                navigate(`collection:${id}`)
                setToast({ text: 'Collection saved.' })
              }
            }}
          />
        </Modal>
      )}
      {modal?.kind === 'removeCollection' && (
        <Modal title={`Remove ${modal.collection.name}?`} onClose={() => setModal(null)}>
          <p className="modal-copy">
            Your projects will be kept in the library and marked as unfiled. Only the collection is
            removed.
          </p>
          {saveError && (
            <p role="alert" className="form-error">
              {saveError}
            </p>
          )}
          <div className="modal-footer">
            <button className="button secondary" onClick={() => setModal(null)}>
              Cancel
            </button>
            <button
              className="button danger"
              onClick={() => {
                if (commit((current) => removeCollection(current, modal.collection.id))) {
                  setModal(null)
                  navigate('all')
                  setToast({ text: 'Collection removed. Your projects are safe.' })
                }
              }}
            >
              Remove collection
            </button>
          </div>
        </Modal>
      )}
      {modal?.kind === 'storage' && (
        <Modal
          title="Saved in this browser"
          subtitle="Your personal workspace, on this device."
          onClose={() => setModal(null)}
        >
          <div className="storage-info">
            <Monitor size={32} />
            <p>
              Projects and notes save automatically in this browser. They’ll be here when you return
              to the same site address.
            </p>
            <p>
              They aren’t synced to an account or another device yet. Clearing this site’s browser
              data also clears this copy of your library.
            </p>
            <p>
              You can download a backup of the library. Restoring a backup will be added in a later
              build.
            </p>
          </div>
          <div className="modal-footer">
            <button className="button secondary" onClick={exportBackup}>
              <ArrowDownToLine size={16} />
              Download backup
            </button>
            <button className="button primary" onClick={() => setModal(null)}>
              Got it
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
