// The Library folder dialog: connect a folder on this computer that mirrors the library, see
// when it was last written, write now, load the folder's library back through the restore
// dialog, or disconnect. Explains itself where the browser cannot do it.
import { FolderOpen, FolderSync, HardDrive, RotateCcw, Unplug } from 'lucide-react'
import type { Library } from '../library'
import { LIBRARY_FILE, PROJECTS_DIR } from './folder'
import { connect, disconnect, grantAccess, loadFromFolder, useHome, writeNow } from './useHome'
import './home.css'

export default function LibraryHome({
  library,
  onRestoreFile,
  onNotice,
  onClose,
}: {
  library: Library
  /** Open the restore dialog on the folder's library file. */
  onRestoreFile: (file: File) => void
  onNotice: (text: string) => void
  onClose: () => void
}) {
  const home = useHome()
  const written = home.lastWrite
    ? new Date(home.lastWrite).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : null
  return (
    <div className="home-dialog">
      {!home.supported ? (
        <p className="home-copy">
          This browser cannot write to folders on this computer, so the library stays in browser
          storage here. Chrome and Edge can keep a folder in step; in any browser,{' '}
          <strong>Download library backup</strong> saves the same file by hand.
        </p>
      ) : !home.handle ? (
        <>
          <p className="home-copy">
            Choose a folder and Junga writes your library into it after every change:{' '}
            <code>{LIBRARY_FILE}</code> (the whole library, in the backup format) and one file per
            project under <code>{PROJECTS_DIR}/</code>. The folder is a mirror you can back up,
            sync, or keep in git; this browser stays the working copy. Load the folder into another
            browser with <strong>Load from folder</strong> there.
          </p>
          <div className="modal-footer">
            <button type="button" className="button secondary" onClick={onClose}>
              Not now
            </button>
            <button type="button" className="button primary" onClick={() => void connect(library)}>
              <FolderOpen size={16} />
              Choose a folder
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="home-status">
            <HardDrive size={22} />
            <div>
              <strong>{home.name}</strong>
              <span>
                {home.permission === 'granted'
                  ? home.writing
                    ? 'Writing…'
                    : written
                      ? `Written at ${written}`
                      : 'Connected; the next change writes it.'
                  : home.permission === 'prompt'
                    ? 'The browser needs a click before it can write here again.'
                    : 'Access was not granted.'}
              </span>
            </div>
          </div>
          {home.error && (
            <p role="alert" className="form-error">
              {home.error}
            </p>
          )}
          <p className="home-copy">
            <code>{LIBRARY_FILE}</code> holds the whole library; <code>{PROJECTS_DIR}/</code> holds
            one file per project. Built-in examples are written only once edited.
          </p>
          <div className="home-actions">
            {home.permission !== 'granted' && (
              <button
                type="button"
                className="button primary"
                onClick={() => void grantAccess(library)}
              >
                <FolderSync size={15} />
                Allow writing
              </button>
            )}
            <button
              type="button"
              className="button secondary"
              disabled={home.writing}
              onClick={() =>
                void writeNow(library).then((ok) => {
                  if (ok) onNotice(`Library written to ${home.name}.`)
                })
              }
            >
              <FolderSync size={15} />
              Write now
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() =>
                void loadFromFolder().then(onRestoreFile, (error: unknown) =>
                  onNotice(
                    error instanceof Error ? error.message : 'The folder could not be read.',
                  ),
                )
              }
            >
              <RotateCcw size={15} />
              Load from folder…
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() =>
                void disconnect().then(() =>
                  onNotice('Folder disconnected. Its files stay as they are.'),
                )
              }
            >
              <Unplug size={15} />
              Disconnect
            </button>
          </div>
          <div className="modal-footer">
            <button type="button" className="button primary" onClick={onClose}>
              Done
            </button>
          </div>
        </>
      )}
    </div>
  )
}
