import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, RotateCw, Terminal } from 'lucide-react'
import { buildRunDocument } from './bundle'
import type { CodeFile } from './model'

export type RunMessage = { id: number; kind: string; text: string }

/**
 * Runs a code project inside a sandboxed iframe. `allow-same-origin` is deliberately absent, so
 * the document gets an opaque origin and cannot reach this app's local storage, cookies, or DOM.
 * Network access is allowed, so a project can load a library from a CDN.
 */
export default function CodeRunner({
  files,
  entry,
  className = '',
  showConsole = true,
}: {
  files: readonly CodeFile[]
  entry: string
  className?: string
  showConsole?: boolean
}) {
  const frame = useRef<HTMLIFrameElement>(null)
  const [generation, setGeneration] = useState(0)
  const [messages, setMessages] = useState<RunMessage[]>([])
  const [open, setOpen] = useState(false)
  const built = useMemo(() => buildRunDocument(files, entry), [files, entry])
  const hasEntry = files.some((file) => file.path === entry)

  useEffect(() => {
    setMessages([])
  }, [built.html, generation])

  useEffect(() => {
    let next = 0
    function receive(event: MessageEvent) {
      if (event.source !== frame.current?.contentWindow) return
      const data = event.data as { jungaRun?: boolean; kind?: string; text?: string } | null
      if (!data || data.jungaRun !== true || typeof data.text !== 'string') return
      const entry = { id: next++, kind: data.kind ?? 'log', text: data.text.slice(0, 2000) }
      setMessages((current) => [...current, entry].slice(-200))
    }
    window.addEventListener('message', receive)
    return () => window.removeEventListener('message', receive)
  }, [])

  const errors = messages.filter((message) => message.kind === 'error')

  if (!hasEntry)
    return (
      <div className={`code-runner ${className}`.trim()}>
        <div className="code-run-empty">
          <h3>No entry file</h3>
          <p>
            {entry
              ? `This output opens ${entry}, which is not in the project. Choose another entry file in the output settings.`
              : 'Choose an HTML entry file for this output.'}
          </p>
        </div>
      </div>
    )

  return (
    <div className={`code-runner ${className}`.trim()}>
      <div className="code-run-bar">
        <span className="code-run-entry">{entry}</span>
        <div className="code-run-actions">
          {showConsole && (
            <button
              type="button"
              className={`button quiet${errors.length ? ' has-errors' : ''}`}
              aria-expanded={open}
              onClick={() => setOpen((value) => !value)}
            >
              {errors.length ? <AlertTriangle size={14} /> : <Terminal size={14} />}
              Console{messages.length ? ` (${messages.length})` : ''}
            </button>
          )}
          <button
            type="button"
            className="button quiet"
            onClick={() => setGeneration((value) => value + 1)}
          >
            <RotateCw size={14} />
            Reload
          </button>
        </div>
      </div>
      {built.missing.length > 0 && (
        <p className="code-run-warning" role="status">
          <AlertTriangle size={14} />
          Not found in this project: {built.missing.slice(0, 5).join(', ')}
          {built.missing.length > 5 ? ` and ${built.missing.length - 5} more` : ''}. Those
          references were left for the browser to load.
        </p>
      )}
      <iframe
        ref={frame}
        key={`${entry}:${generation}`}
        className="code-run-frame"
        title={`Output preview: ${entry}`}
        sandbox="allow-scripts allow-modals allow-popups allow-forms allow-pointer-lock"
        srcDoc={built.html}
      />
      {showConsole && open && (
        <div className="code-run-console" role="log" aria-label="Output console">
          {messages.length === 0 ? (
            <p className="code-run-console-empty">
              Nothing logged yet. console.log, warnings, and errors from the running output appear
              here.
            </p>
          ) : (
            <ul>
              {messages.map((message) => (
                <li key={message.id} className={`code-run-${message.kind}`}>
                  {message.text}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
