// The library's import dialog: drop or choose files (or a folder), see what each will become,
// adjust the kind and title, and add them all as projects in one save. A Junga backup file is
// handed to the restore dialog instead, because restoring is a bigger decision than importing.
import { useEffect, useId, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { FolderOpen, Upload, X } from 'lucide-react'
import type { Library } from '../library'
import {
  importKinds,
  kindInfo,
  kindsFor,
  prepareCode,
  prepareImport,
  sniffJson,
  titleFromName,
  type ImportKind,
  type ImportOptions,
  type Prepared,
} from './importers'
import './import.css'

type Row = {
  id: string
  files: File[]
  /** The kinds this file can become, best first. */
  kinds: ImportKind[]
  kind: ImportKind
  title: string
  status: 'reading' | 'ready' | 'error' | 'unsupported'
  prepared?: Prepared
  error?: string
}
const rowId = () => crypto.randomUUID().slice(0, 8)
const size = (bytes: number) =>
  bytes < 1024
    ? `${bytes} B`
    : bytes < 1024 * 1024
      ? `${Math.round(bytes / 1024)} KB`
      : `${(bytes / 1024 / 1024).toFixed(1)} MB`
export const SUPPORTED =
  'draw.io diagrams, Markdown, HTML, and text, CSV and TSV, STL meshes, pictures, code files or a whole folder, Junga collection exports, exported Junga projects, and library backups'

export default function ImportDialog({
  library,
  initialFiles = [],
  options,
  error,
  onImport,
  onRestoreBackup,
  onClose,
}: {
  library: Library
  initialFiles?: File[]
  options: ImportOptions
  error: string
  onImport: (prepared: Prepared[], collectionId: string | null) => boolean
  onRestoreBackup: (file: File) => void
  onClose: () => void
}) {
  const id = useId()
  const [rows, setRows] = useState<Row[]>([])
  const [collectionId, setCollectionId] = useState('')
  const [over, setOver] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const folderInput = useRef<HTMLInputElement>(null)
  const seeded = useRef(false)
  useEffect(() => {
    if (seeded.current || !initialFiles.length) return
    seeded.current = true
    void addFiles(initialFiles)
  }, [initialFiles]) // eslint-disable-line react-hooks/exhaustive-deps

  const update = (rowId: string, patch: Partial<Row>) =>
    setRows((current) => current.map((r) => (r.id === rowId ? { ...r, ...patch } : r)))
  async function prepare(row: Row, kind: ImportKind, title: string) {
    update(row.id, { kind, title, status: 'reading', error: undefined, prepared: undefined })
    if (kind === 'backup') {
      update(row.id, { status: 'ready' })
      return
    }
    try {
      const prepared =
        row.files.length > 1
          ? await prepareCode(row.files, title)
          : await prepareImport(row.files, kind, title, options)
      update(row.id, { status: 'ready', prepared, title: prepared.title })
    } catch (e) {
      update(row.id, {
        status: 'error',
        error: e instanceof Error ? e.message : 'This file could not be read.',
      })
    }
  }
  async function addFiles(files: File[]) {
    for (const file of files) {
      let kinds = kindsFor(file)
      if (file.name.toLowerCase().endsWith('.json')) {
        const sniffed = sniffJson(await file.text())
        kinds = sniffed
          ? [sniffed, ...kinds.filter((k) => k !== sniffed && k === 'code')]
          : ['code']
      }
      const row: Row = {
        id: rowId(),
        files: [file],
        kinds,
        kind: kinds[0] ?? 'code',
        title: titleFromName(file.name),
        status: kinds.length ? 'reading' : 'unsupported',
      }
      setRows((current) => [...current, row])
      if (kinds.length) void prepare(row, row.kind, row.title)
    }
  }
  /** A folder becomes one code project named after it. */
  async function addFolder(files: File[]) {
    if (!files.length) return
    const first = (files[0] as File & { webkitRelativePath?: string }).webkitRelativePath || ''
    const folder = first.split('/')[0] || 'Folder'
    const row: Row = {
      id: rowId(),
      files,
      kinds: ['code'],
      kind: 'code',
      title: titleFromName(folder),
      status: 'reading',
    }
    setRows((current) => [...current, row])
    await prepare(row, 'code', row.title)
  }
  const chooseFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files ?? [])]
    event.target.value = ''
    void addFiles(files)
  }
  const chooseFolder = (event: ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files ?? [])]
    event.target.value = ''
    void addFolder(files)
  }
  const drop = (event: DragEvent) => {
    event.preventDefault()
    setOver(false)
    void addFiles([...event.dataTransfer.files])
  }
  const ready = rows.filter((r) => r.status === 'ready' && r.prepared)
  const reading = rows.some((r) => r.status === 'reading')
  const backups = rows.filter((r) => r.kind === 'backup')
  return (
    <div className="import-dialog">
      <div
        className={`import-drop ${over ? 'is-over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={drop}
      >
        <strong>Drop files here</strong>
        Each file becomes a project of its own; a folder becomes one code project.
        <div className="import-drop-actions">
          <button
            type="button"
            className="button secondary"
            onClick={() => fileInput.current?.click()}
          >
            <Upload size={14} />
            Choose files
          </button>
          <button
            type="button"
            className="button secondary"
            onClick={() => folderInput.current?.click()}
          >
            <FolderOpen size={14} />
            Choose a folder
          </button>
        </div>
        <input
          ref={fileInput}
          type="file"
          multiple
          hidden
          aria-label="Files to import"
          onChange={chooseFiles}
        />
        <input
          ref={folderInput}
          type="file"
          hidden
          aria-label="Folder to import"
          onChange={chooseFolder}
          {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
        />
      </div>
      <p className="import-formats">Reads {SUPPORTED}.</p>
      {rows.length > 0 && (
        <ul className="import-rows" aria-label="Files to import">
          {rows.map((row) => (
            <li key={row.id} className="import-row">
              <div className="import-row-name">
                <span>
                  {row.files.length > 1 ? `${row.files.length} files` : row.files[0].name}
                </span>
                <small>{size(row.files.reduce((n, f) => n + f.size, 0))}</small>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label={`Remove ${row.files[0].name}`}
                onClick={() => setRows((current) => current.filter((r) => r.id !== row.id))}
              >
                <X size={15} />
              </button>
              {row.status !== 'unsupported' && row.kind !== 'backup' && (
                <div className="import-row-fields">
                  <label htmlFor={`${id}-${row.id}-kind`}>
                    Import as
                    <select
                      id={`${id}-${row.id}-kind`}
                      value={row.kind}
                      disabled={row.kinds.length < 2}
                      onChange={(e) => void prepare(row, e.target.value as ImportKind, row.title)}
                    >
                      {row.kinds.map((kind) => (
                        <option key={kind} value={kind}>
                          {kindInfo(kind).label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label htmlFor={`${id}-${row.id}-title`}>
                    Project name
                    <input
                      id={`${id}-${row.id}-title`}
                      value={row.title}
                      maxLength={100}
                      onChange={(e) =>
                        update(row.id, {
                          title: e.target.value,
                          prepared: row.prepared
                            ? { ...row.prepared, title: e.target.value }
                            : undefined,
                        })
                      }
                    />
                  </label>
                </div>
              )}
              <div
                className={`import-row-status ${row.status === 'error' || row.status === 'unsupported' ? 'is-error' : ''}`}
              >
                {row.status === 'unsupported' && 'No importer reads this kind of file yet.'}
                {row.status === 'reading' && 'Reading…'}
                {row.status === 'error' && row.error}
                {row.status === 'ready' && row.kind === 'backup' && (
                  <>
                    <span>
                      A whole library backup. Restore it as copies, or replace the library.
                    </span>
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => onRestoreBackup(row.files[0])}
                    >
                      Open the restore dialog
                    </button>
                  </>
                )}
                {row.status === 'ready' && row.kind !== 'backup' && row.prepared && (
                  <span>
                    {kindInfo(row.kind).label} · {row.prepared.summary}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {rows.length > 0 && (
        <div className="import-footer-fields">
          <label>
            Add to collection
            <select value={collectionId} onChange={(e) => setCollectionId(e.target.value)}>
              <option value="">Unfiled</option>
              {library.collections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      <div className="modal-footer">
        <button type="button" className="button secondary" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="button primary"
          disabled={!ready.length || reading}
          onClick={() => {
            if (
              onImport(
                ready.map((r) => ({ ...r.prepared!, title: r.title.trim() || r.prepared!.title })),
                collectionId || null,
              )
            )
              onClose()
          }}
        >
          {reading
            ? 'Reading…'
            : `Import ${ready.length || ''} ${ready.length === 1 ? 'project' : 'projects'}`.replace(
                '  ',
                ' ',
              )}
        </button>
      </div>
      {backups.length > 0 && rows.length === backups.length && null}
      <datalist id={`${id}-kinds`}>
        {importKinds.map((k) => (
          <option key={k.id} value={k.label} />
        ))}
      </datalist>
    </div>
  )
}
