import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import {
  MAX_VIEW_CHARS,
  materialFor,
  type Material,
} from './interactive-scenes/cosmic-clock/sources'

const CodeMirrorField = lazy(() => import('./code/CodeMirrorField'))

type Loaded =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'text'; content: string; truncated: number }
  | { state: 'image'; url: string }

async function read(material: Material): Promise<Loaded> {
  if (material.kind === 'image') return { state: 'image', url: material.url }
  const whole =
    material.kind === 'source'
      ? await material.load()
      : await fetch(material.url).then((response) => {
          if (!response.ok) throw new Error(`${response.status}`)
          return response.text()
        })
  return {
    state: 'text',
    content: whole.slice(0, MAX_VIEW_CHARS),
    truncated: Math.max(0, whole.length - MAX_VIEW_CHARS),
  }
}

const kilobytes = (count: number) => `${Math.round(count / 1024).toLocaleString()} KB`

/**
 * Read-only view of one bundled file. The file ships with the application, so this shows what is
 * running rather than anything stored in the browser; nothing here can edit a project.
 */
export default function SourceViewer({
  path,
  description,
  close,
}: {
  path: string
  description: string
  close: () => void
}) {
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' })
  const dialog = useRef<HTMLDialogElement>(null)
  const material = materialFor(path)
  const openable = material && material.kind !== 'source' ? material.url : null

  useEffect(() => {
    const element = dialog.current!
    const opener = document.activeElement as HTMLElement | null
    element.showModal()
    return () => {
      element.close()
      if (opener?.isConnected) opener.focus()
    }
  }, [])

  useEffect(() => {
    let current = true
    if (!material) {
      setLoaded({ state: 'error', message: 'This file is not bundled with the application.' })
      return
    }
    read(material)
      .then((result) => current && setLoaded(result))
      .catch(
        () =>
          current &&
          setLoaded({
            state: 'error',
            message: 'This file could not be read from the application.',
          }),
      )
    return () => {
      current = false
    }
  }, [path])

  return (
    <dialog
      ref={dialog}
      className="modal source-viewer"
      aria-labelledby="source-viewer-title"
      onCancel={(event) => {
        event.preventDefault()
        close()
      }}
    >
      <div className="modal-heading">
        <div>
          <h2 id="source-viewer-title">{path}</h2>
          <p>{description}</p>
        </div>
        <button type="button" onClick={close} aria-label="Close file">
          ×
        </button>
      </div>
      <div className="source-viewer-body">
        {loaded.state === 'loading' && <p className="source-viewer-note">Opening the file…</p>}
        {loaded.state === 'error' && (
          <p className="form-error" role="alert">
            {loaded.message}
          </p>
        )}
        {loaded.state === 'image' && (
          <img className="source-viewer-image" src={loaded.url} alt={`Preview of ${path}`} />
        )}
        {loaded.state === 'text' && (
          <>
            {loaded.truncated > 0 && (
              <p className="source-viewer-note" role="status">
                Showing the first {kilobytes(MAX_VIEW_CHARS)} of this file.{' '}
                {kilobytes(loaded.truncated)} more is not shown.
              </p>
            )}
            <Suspense fallback={<p className="source-viewer-note">Opening the file…</p>}>
              <CodeMirrorField path={path} value={loaded.content} readOnly onChange={() => {}} />
            </Suspense>
          </>
        )}
      </div>
      <div className="modal-footer">
        <p className="source-viewer-origin">
          This file ships with the application and is shown read-only.
        </p>
        {openable && (
          <a className="button secondary" href={openable} target="_blank" rel="noreferrer">
            <ExternalLink size={15} />
            Open in a new tab
          </a>
        )}
        <button type="button" className="button primary" onClick={close}>
          Close
        </button>
      </div>
    </dialog>
  )
}
