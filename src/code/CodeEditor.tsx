import { Suspense, lazy, useMemo, useRef, useState, type ChangeEvent } from 'react'
import {
  ArrowLeft,
  FileCode2,
  FilePlus2,
  FolderOpen,
  Play,
  Trash2,
  Upload,
  PencilLine,
  Star,
} from 'lucide-react'
// CodeMirror is a large dependency; it loads when a code project is opened, not with the shell.
const CodeMirrorField = lazy(() => import('./CodeMirrorField'))
import CodeRunner from './CodeRunner'
import {
  MAX_FILES,
  MAX_FILE_CHARS,
  MAX_TOTAL_CHARS,
  TEXT_EXTENSIONS,
  isTextPath,
  normalizePath,
  sortFiles,
  totalChars,
  type CodeDocument,
  type CodeFile,
} from './model'
import './code.css'

type TreeNode = { name: string; path: string; folder: boolean; children: TreeNode[] }

/** Nested view of the flat path list, with folders before files at every level. */
function buildTree(files: readonly CodeFile[]): TreeNode[] {
  const roots: TreeNode[] = []
  for (const file of sortFiles(files)) {
    const parts = file.path.split('/')
    let level = roots
    parts.forEach((part, index) => {
      const path = parts.slice(0, index + 1).join('/')
      if (index === parts.length - 1) {
        level.push({ name: part, path, folder: false, children: [] })
        return
      }
      let folder = level.find((node) => node.folder && node.path === path)
      if (!folder) {
        folder = { name: part, path, folder: true, children: [] }
        level.push(folder)
      }
      level = folder.children
    })
  }
  return roots
}

function Tree({
  nodes,
  selected,
  entry,
  onSelect,
}: {
  nodes: TreeNode[]
  selected: string
  entry: string
  onSelect: (path: string) => void
}) {
  return (
    <ul className="code-tree">
      {nodes.map((node) =>
        node.folder ? (
          <li key={node.path} className="code-tree-folder">
            <span>
              <FolderOpen size={14} />
              {node.name}
            </span>
            <Tree nodes={node.children} selected={selected} entry={entry} onSelect={onSelect} />
          </li>
        ) : (
          <li key={node.path}>
            <button
              type="button"
              className={`code-tree-file${node.path === selected ? ' selected' : ''}`}
              aria-current={node.path === selected}
              onClick={() => onSelect(node.path)}
            >
              <FileCode2 size={14} />
              <span>{node.name}</span>
              {node.path === entry && (
                <span className="code-entry-flag" title="Entry file">
                  <Star size={12} />
                </span>
              )}
            </button>
          </li>
        ),
      )}
    </ul>
  )
}

export default function CodeEditor({
  title,
  code,
  readOnly,
  unsaved,
  onBack,
  onChange,
}: {
  title: string
  code: CodeDocument
  readOnly: boolean
  unsaved: boolean
  onBack: () => void
  onChange: (next: CodeDocument) => boolean
}) {
  const [selected, setSelected] = useState(() => code.entry || (code.files[0]?.path ?? ''))
  const [adding, setAdding] = useState(false)
  const [draftPath, setDraftPath] = useState('')
  const [renaming, setRenaming] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(false)
  const importInput = useRef<HTMLInputElement>(null)
  const latest = useRef(code)
  latest.current = code

  const tree = useMemo(() => buildTree(code.files), [code.files])
  const active = code.files.find((file) => file.path === selected) ?? code.files[0] ?? null
  const used = totalChars(code.files)

  function apply(next: CodeDocument, message = 'Your code changes are kept on this page.') {
    setError(onChange(next) ? '' : message)
  }

  function addFile(path: string, content: string) {
    const clean = normalizePath(path)
    const current = latest.current
    if (!clean)
      return `Use a name like main.js or lib/util.js: letters, numbers, dot, dash, underscore, and / for folders.`
    if (!isTextPath(clean))
      return `Junga stores text files. Use one of: ${TEXT_EXTENSIONS.join(', ')}.`
    if (current.files.some((file) => file.path.toLowerCase() === clean.toLowerCase()))
      return `${clean} already exists in this project.`
    if (current.files.length >= MAX_FILES) return `A code project holds up to ${MAX_FILES} files.`
    if (content.length > MAX_FILE_CHARS)
      return `${clean} is larger than the ${Math.round(MAX_FILE_CHARS / 1024)} KB limit for one file.`
    if (totalChars([...current.files, { path: clean, content }]) > MAX_TOTAL_CHARS)
      return `This project would pass the ${Math.round(MAX_TOTAL_CHARS / 1024)} KB total limit.`
    const next: CodeDocument = { ...current, files: [...current.files, { path: clean, content }] }
    latest.current = next
    apply(next)
    setSelected(clean)
    return ''
  }

  function createFile() {
    const message = addFile(draftPath, '')
    setError(message)
    if (!message) {
      setDraftPath('')
      setAdding(false)
    }
  }

  function rename(nextPath: string) {
    if (!active) return
    const clean = normalizePath(nextPath)
    if (!clean || !isTextPath(clean)) {
      setError('Use a file name with a text extension, such as scene.js.')
      return
    }
    if (
      clean !== active.path &&
      code.files.some((file) => file.path.toLowerCase() === clean.toLowerCase())
    ) {
      setError(`${clean} already exists in this project.`)
      return
    }
    const next: CodeDocument = {
      ...code,
      entry: code.entry === active.path ? clean : code.entry,
      files: code.files.map((file) =>
        file.path === active.path ? { ...file, path: clean } : file,
      ),
    }
    apply(next)
    setSelected(clean)
    setRenaming(false)
  }

  function remove() {
    if (!active) return
    if (!window.confirm(`Delete ${active.path}? This cannot be undone from here.`)) return
    const files = code.files.filter((file) => file.path !== active.path)
    const next: CodeDocument = {
      ...code,
      files,
      entry:
        code.entry === active.path
          ? (files.find((f) => f.path.endsWith('.html'))?.path ?? '')
          : code.entry,
    }
    apply(next)
    setSelected(files[0]?.path ?? '')
  }

  async function importFiles(event: ChangeEvent<HTMLInputElement>) {
    const chosen = [...(event.target.files ?? [])]
    event.target.value = ''
    const problems: string[] = []
    for (const file of chosen) {
      const path = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name
      if (!isTextPath(path)) {
        problems.push(`${file.name} is not a text file Junga can store`)
        continue
      }
      const message = addFile(path, await file.text())
      if (message) problems.push(message)
    }
    setError(problems.join(' '))
  }

  const entryOptions = sortFiles(code.files.filter((file) => /\.html?$/i.test(file.path)))

  return (
    <div className="code-editor">
      <div className="code-heading">
        <div>
          <button className="back-link" onClick={onBack}>
            <ArrowLeft size={14} />
            Project overview
          </button>
          <div className="eyebrow">CODE</div>
          <h1>{title}</h1>
        </div>
        <div className="code-heading-actions">
          <label className="code-entry-select">
            Entry
            <select
              value={code.entry}
              disabled={readOnly || !entryOptions.length}
              onChange={(event) => apply({ ...code, entry: event.target.value })}
            >
              {!entryOptions.some((file) => file.path === code.entry) && (
                <option value={code.entry}>{code.entry || 'None'}</option>
              )}
              {entryOptions.map((file) => (
                <option key={file.path} value={file.path}>
                  {file.path}
                </option>
              ))}
            </select>
          </label>
          <button
            className={`button ${preview ? 'secondary' : 'primary'}`}
            onClick={() => setPreview((value) => !value)}
          >
            <Play size={14} />
            {preview ? 'Hide run' : 'Run'}
          </button>
        </div>
      </div>
      {readOnly && (
        <div className="state-banner">
          This project is in the trash. Its files are preserved; restore it to edit.
        </div>
      )}
      {unsaved && (
        <div className="unsaved-note" role="status">
          <span>Your code changes are kept on this page. Save them before leaving.</span>
          <button className="button secondary" onClick={() => apply(latest.current)}>
            Retry saving code
          </button>
        </div>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className={`code-body${preview ? ' with-preview' : ''}`}>
        <aside className="code-files" aria-label="Project files">
          <div className="code-files-heading">
            <h2>Files</h2>
            <span>
              {code.files.length}/{MAX_FILES}
            </span>
          </div>
          <Tree
            nodes={tree}
            selected={active?.path ?? ''}
            entry={code.entry}
            onSelect={setSelected}
          />
          {!readOnly && (
            <div className="code-files-actions">
              {adding ? (
                <div className="code-new-file">
                  <label>
                    New file path
                    <input
                      autoFocus
                      value={draftPath}
                      placeholder="lib/util.js"
                      onChange={(event) => setDraftPath(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') createFile()
                        if (event.key === 'Escape') {
                          setAdding(false)
                          setDraftPath('')
                        }
                      }}
                    />
                  </label>
                  <div className="button-row">
                    <button className="button primary" onClick={createFile}>
                      Create file
                    </button>
                    <button
                      className="button secondary"
                      onClick={() => {
                        setAdding(false)
                        setDraftPath('')
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <button className="button secondary" onClick={() => setAdding(true)}>
                    <FilePlus2 size={14} />
                    New file
                  </button>
                  <button className="button secondary" onClick={() => importInput.current?.click()}>
                    <Upload size={14} />
                    Import files
                  </button>
                  <input
                    ref={importInput}
                    type="file"
                    multiple
                    className="visually-hidden"
                    aria-label="Import files"
                    onChange={importFiles}
                  />
                </>
              )}
            </div>
          )}
          <p className="code-usage">
            {Math.round(used / 1024)} KB of {Math.round(MAX_TOTAL_CHARS / 1024)} KB used
          </p>
        </aside>
        <section className="code-pane" aria-label="File contents">
          {active ? (
            <>
              <div className="code-pane-bar">
                {renaming ? (
                  <input
                    autoFocus
                    className="code-rename"
                    defaultValue={active.path}
                    aria-label="File path"
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') rename(event.currentTarget.value)
                      if (event.key === 'Escape') setRenaming(false)
                    }}
                    onBlur={(event) => rename(event.currentTarget.value)}
                  />
                ) : (
                  <span className="code-pane-path">{active.path}</span>
                )}
                {!readOnly && (
                  <div className="code-pane-actions">
                    <button className="button quiet" onClick={() => setRenaming(true)}>
                      <PencilLine size={14} />
                      Rename
                    </button>
                    {/\.html?$/i.test(active.path) && active.path !== code.entry && (
                      <button
                        className="button quiet"
                        onClick={() => apply({ ...code, entry: active.path })}
                      >
                        <Star size={14} />
                        Set as entry
                      </button>
                    )}
                    <button className="button quiet" onClick={remove}>
                      <Trash2 size={14} />
                      Delete
                    </button>
                  </div>
                )}
              </div>
              <Suspense fallback={<div className="code-loading">Opening the editor…</div>}>
                <CodeMirrorField
                  key={active.path}
                  path={active.path}
                  value={active.content}
                  readOnly={readOnly}
                  onChange={(content) =>
                    apply({
                      ...latest.current,
                      files: latest.current.files.map((file) =>
                        file.path === active.path ? { ...file, content } : file,
                      ),
                    })
                  }
                />
              </Suspense>
            </>
          ) : (
            <div className="code-empty">
              <h3>No files yet</h3>
              <p>Create a file or import one to start this project.</p>
            </div>
          )}
        </section>
        {preview && (
          <section className="code-preview" aria-label="Run preview">
            <CodeRunner files={code.files} entry={code.entry} />
          </section>
        )}
      </div>
    </div>
  )
}
