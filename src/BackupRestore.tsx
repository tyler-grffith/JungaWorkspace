import { useRef, useState, type ChangeEvent } from 'react'
import {
  downloadData,
  MAX_BACKUP_BYTES,
  parseBackup,
  type Backup,
  type RestoreMode,
} from './backup'
import { parseLibrary, STORAGE_KEY, type Library } from './library'
import './backup.css'

type Snapshot = { raw: string | null; library: Library | null }
export default function BackupRestore({
  onRestore,
  onClose,
  hasDrafts,
  onDownloadDrafts,
}: {
  onRestore: (library: Library, mode: RestoreMode, expectedRaw: string | null) => void
  onClose: () => void
  hasDrafts: boolean
  onDownloadDrafts: () => boolean
}) {
  const [backup, setBackup] = useState<Backup | null>(null)
  const [filename, setFilename] = useState('')
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [mode, setMode] = useState<RestoreMode>('copies')
  const [replaceConfirmed, setReplaceConfirmed] = useState(false)
  const [discardConfirmed, setDiscardConfirmed] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [reading, setReading] = useState(false)
  const request = useRef(0)
  function refresh() {
    setReplaceConfirmed(false)
    setDiscardConfirmed(false)
    setError('')
    setNotice('')
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      let library: Library | null = null
      try {
        library = parseLibrary(raw)
      } catch {
        /* Preserve unreadable data for download. */
      }
      setSnapshot({ raw, library })
    } catch {
      setSnapshot(null)
      setError(
        'Browser storage cannot be accessed. Keep your backup file and try again when storage is available.',
      )
    }
  }
  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    const id = ++request.current
    setBackup(null)
    setError('')
    setNotice('')
    setMode('copies')
    setReplaceConfirmed(false)
    setDiscardConfirmed(false)
    if (!file) {
      setReading(false)
      return
    }
    setReading(true)
    try {
      if (file.size > MAX_BACKUP_BYTES)
        throw new Error('This file is too large. Choose a Junga backup smaller than 10 MB.')
      const parsed = parseBackup(await file.text())
      if (id !== request.current) return
      setBackup(parsed)
      setFilename(file.name)
      refresh()
    } catch (e) {
      if (id === request.current)
        setError(e instanceof Error ? e.message : 'The file could not be read. Choose it again.')
    } finally {
      if (id === request.current) setReading(false)
    }
  }
  function restore() {
    if (
      !backup ||
      !snapshot ||
      (mode === 'replace' && !replaceConfirmed) ||
      (hasDrafts && !discardConfirmed)
    )
      return
    try {
      onRestore(backup.library, mode, snapshot.raw)
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Restoration failed. Your current library has not been changed.',
      )
    }
  }
  const projects = backup?.library.projects ?? []
  return (
    <div className="backup-restore">
      <label>
        Backup file
        <input type="file" accept=".json,application/json" onChange={choose} />
      </label>
      <p className="field-hint">
        Choose a Junga library backup. Files stay on this device. Maximum size: 10 MB.
      </p>
      {reading && <p role="status">Reading backup…</p>}
      {backup && (
        <>
          <section className="backup-preview" aria-label="Backup preview">
            <h3>{filename}</h3>
            <p>
              {backup.exportedAt
                ? `Downloaded ${new Date(backup.exportedAt).toLocaleString()}`
                : 'Older backup — download date unavailable.'}
            </p>
            <p>
              <strong>
                {projects.length} projects · {backup.library.collections.length} collections
              </strong>
            </p>
            <p>
              {projects.filter((p) => p.status === 'active').length} active ·{' '}
              {projects.filter((p) => p.status === 'archived').length} archived ·{' '}
              {projects.filter((p) => p.status === 'trashed').length} in trash
            </p>
            <p>
              {projects.filter((p) => p.graph).length} saved graphs ·{' '}
              {projects.filter((p) => p.sheet).length} saved spreadsheets
            </p>
            <ul className="backup-projects" tabIndex={0} aria-label="Projects in this backup">
              {projects.slice(0, 100).map((p) => (
                <li key={p.id}>
                  <strong>{p.title}</strong>
                  <span>
                    {p.status === 'trashed'
                      ? 'In trash'
                      : p.status === 'archived'
                        ? 'Archived'
                        : 'Active'}{' '}
                    ·{' '}
                    {backup.library.collections.find((c) => c.id === p.collectionId)?.name ??
                      'Unfiled'}
                  </span>
                </li>
              ))}
            </ul>
            {projects.length > 100 && (
              <p>And {projects.length - 100} more projects. All will be restored.</p>
            )}
            {backup.library.collections.length > 0 && (
              <details>
                <summary>Collections in this backup</summary>
                <ul>
                  {backup.library.collections.slice(0, 100).map((c) => (
                    <li key={c.id}>{c.name}</li>
                  ))}
                </ul>
                {backup.library.collections.length > 100 && (
                  <p>
                    And {backup.library.collections.length - 100} more collections. All will be
                    restored.
                  </p>
                )}
              </details>
            )}
            {!projects.length && <p>This backup contains no projects.</p>}
          </section>
          <div className="backup-current">
            <p>
              {snapshot?.library
                ? `Current library: ${snapshot.library.projects.length} projects and ${snapshot.library.collections.length} collections.`
                : 'The current library cannot be read. Restoration as copies is unavailable; you can replace it with this backup.'}
            </p>
            <div className="backup-actions">
              <button
                className="button secondary"
                onClick={() => {
                  refresh()
                }}
              >
                Refresh preview
              </button>
              {snapshot?.raw !== null && snapshot && (
                <button
                  className="button secondary"
                  onClick={() => {
                    try {
                      downloadData(snapshot.raw!, 'junga-before-restore')
                      setNotice(
                        'Current stored data sent to your downloads. Keep that file before replacing the library.',
                      )
                    } catch {
                      setError(
                        'The download could not be started. Your current library has not been changed.',
                      )
                    }
                  }}
                >
                  Download current data
                </button>
              )}
            </div>
          </div>
          <fieldset className="restore-options">
            <legend>How should this backup be restored?</legend>
            <label>
              <input
                type="radio"
                name="restore-mode"
                checked={mode === 'copies'}
                disabled={!snapshot?.library}
                onChange={() => {
                  setMode('copies')
                  setReplaceConfirmed(false)
                }}
              />
              <span>
                <strong>Add as separate copies</strong>
                <small>
                  Keep existing work. Matching project and collection names get “(restored)”.
                  Archive and trash status are preserved.
                </small>
              </span>
            </label>
            <label>
              <input
                type="radio"
                name="restore-mode"
                checked={mode === 'replace'}
                onChange={() => {
                  setMode('replace')
                  setReplaceConfirmed(false)
                }}
              />
              <span>
                <strong>Replace current library</strong>
                <small>
                  Make this library match the backup, including its archive and trash. Projects
                  absent from the backup will be removed from this browser.
                </small>
              </span>
            </label>
          </fieldset>
          {mode === 'replace' && (
            <label className="restore-confirm">
              <input
                type="checkbox"
                checked={replaceConfirmed}
                onChange={(e) => setReplaceConfirmed(e.target.checked)}
              />
              <span>
                I understand that this replaces all current projects and collections. I have kept
                any current data I need.
              </span>
            </label>
          )}
          {hasDrafts && (
            <div className="backup-drafts">
              <p>
                You have unsaved edits on this page. Download them before restoring if you want to
                keep them.
              </p>
              <button
                className="button secondary"
                onClick={() => {
                  if (onDownloadDrafts())
                    setNotice(
                      'Backup downloaded, including unsaved edits. This does not save them in the browser.',
                    )
                  else
                    setError(
                      'The backup could not be downloaded. Keep this page open; close this dialog to review the download message and try again.',
                    )
                }}
              >
                Download unsaved work
              </button>
              <label className="restore-confirm">
                <input
                  type="checkbox"
                  checked={discardConfirmed}
                  onChange={(e) => setDiscardConfirmed(e.target.checked)}
                />
                <span>I have downloaded or no longer need my unsaved edits.</span>
              </label>
            </div>
          )}
        </>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <div className="modal-footer">
        <button className="button secondary" onClick={onClose}>
          Cancel
        </button>
        <button
          className="button primary"
          onClick={restore}
          disabled={
            !backup ||
            !snapshot ||
            reading ||
            (mode === 'copies' && !snapshot.library) ||
            (mode === 'replace' && !replaceConfirmed) ||
            (hasDrafts && !discardConfirmed)
          }
        >
          {mode === 'copies' ? 'Restore copies' : 'Replace library'}
        </button>
      </div>
    </div>
  )
}
