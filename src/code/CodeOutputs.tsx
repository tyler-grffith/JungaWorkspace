import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Play, Plus, Trash2 } from 'lucide-react'
import type { Project } from '../library'
import { validOutput, type CodeRunOutput, type Output } from '../outputs'
import { entryCandidates, type CodeDocument } from './model'
import '../code-project.css'
import './code.css'

function OutputSettings({
  output,
  code,
  save,
  close,
  onDraftChange,
}: {
  output: CodeRunOutput
  code: CodeDocument
  save: (value: Output, expected: Output) => boolean
  close: () => void
  onDraftChange: (dirty: boolean) => void
}) {
  const [original] = useState(() => structuredClone(output))
  const [value, setValue] = useState(() => structuredClone(output))
  const [error, setError] = useState('')
  const dialog = useRef<HTMLDialogElement>(null)
  const dirty = JSON.stringify(value) !== JSON.stringify(original)
  useEffect(() => {
    const element = dialog.current!
    const opener = document.activeElement as HTMLElement | null
    element.showModal()
    element.querySelector('input')?.focus()
    return () => {
      element.close()
      if (opener?.isConnected) opener.focus()
    }
  }, [])
  useEffect(() => {
    onDraftChange(dirty)
    return () => onDraftChange(false)
  }, [dirty, onDraftChange])
  function change(update: (next: CodeRunOutput) => void) {
    setValue((current) => {
      const next = structuredClone(current)
      update(next)
      return next
    })
  }
  function cancel() {
    if (!dirty || window.confirm('Discard the output settings you have not applied?')) close()
  }
  function submit(event: FormEvent) {
    event.preventDefault()
    if (!validOutput(value)) {
      setError('Check the output title, entry file, and metadata.')
      return
    }
    if (save(value, original)) close()
    else
      setError(
        'Settings could not be applied. Your edits remain here. Check the workspace save error, then retry or cancel.',
      )
  }
  const candidates = entryCandidates(code)
  return (
    <dialog
      ref={dialog}
      className="modal code-output-settings"
      aria-labelledby="run-output-settings-title"
      onCancel={(event) => {
        event.preventDefault()
        cancel()
      }}
    >
      <div className="modal-heading">
        <div>
          <h2 id="run-output-settings-title">Output settings</h2>
          <p>Name this output and choose the file it opens.</p>
        </div>
        <button type="button" onClick={cancel} aria-label="Close output settings">
          ×
        </button>
      </div>
      <form className="project-form" onSubmit={submit}>
        <label>
          Output title
          <input
            required
            maxLength={100}
            value={value.title}
            onChange={(e) =>
              change((next) => {
                next.title = e.target.value
              })
            }
          />
        </label>
        <label>
          Output description
          <textarea
            maxLength={500}
            value={value.description}
            onChange={(e) =>
              change((next) => {
                next.description = e.target.value
              })
            }
          />
        </label>
        <label>
          Entry file
          <select
            value={value.source.entry}
            onChange={(e) =>
              change((next) => {
                next.source.entry = e.target.value
              })
            }
          >
            {!candidates.some((file) => file.path === value.source.entry) && (
              <option value={value.source.entry}>{value.source.entry} (missing)</option>
            )}
            {candidates.map((file) => (
              <option key={file.path} value={file.path}>
                {file.path}
              </option>
            ))}
          </select>
        </label>
        <p className="field-hint">
          The output opens this HTML file and loads the project&rsquo;s other files with it.
        </p>
        <label>
          Output status
          <select
            value={value.status}
            onChange={(e) =>
              change((next) => {
                next.status = e.target.value as Output['status']
              })
            }
          >
            <option value="ready">Ready</option>
            <option value="draft">Draft</option>
          </select>
        </label>
        <label>
          Attribution
          <textarea
            maxLength={4000}
            value={value.metadata.attribution}
            onChange={(e) =>
              change((next) => {
                next.metadata.attribution = e.target.value
              })
            }
          />
        </label>
        <label>
          Output source reference
          <input
            type="url"
            maxLength={2000}
            value={value.metadata.sourceUrl}
            onChange={(e) =>
              change((next) => {
                next.metadata.sourceUrl = e.target.value
              })
            }
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-footer">
          <button type="button" className="button secondary" onClick={cancel}>
            Cancel
          </button>
          <button className="button primary" type="submit">
            Apply output settings
          </button>
        </div>
      </form>
    </dialog>
  )
}

/** Outputs that run a project's own files, shown on the overview of any project with the code tool. */
export default function CodeOutputs({
  project,
  code,
  onSave,
  onAdd,
  onRemove,
  onDraftChange,
}: {
  project: Project
  code: CodeDocument
  onSave: (value: Output, expected: Output) => boolean
  onAdd: () => void
  onRemove: (outputId: string) => void
  onDraftChange: (dirty: boolean) => void
}) {
  const [editing, setEditing] = useState<CodeRunOutput | null>(null)
  const outputs = project.outputs.filter(
    (output): output is CodeRunOutput => output.type === 'code-run',
  )
  const editable = project.status !== 'trashed'
  return (
    <section className="code-outputs">
      <div className="section-heading">
        <h2>Outputs</h2>
        <span>{outputs.length}</span>
      </div>
      <p>Each output runs this project&rsquo;s files from its own entry file.</p>
      {outputs.map((output) => (
        <article key={output.id} className="code-output-card" aria-label={output.title}>
          <div className="code-output-art" aria-hidden="true">
            <div />
          </div>
          <div className="code-output-body">
            <div className="code-output-medium">
              Runs {output.source.entry}{' '}
              <span>{output.status === 'ready' ? 'Ready' : 'Draft'}</span>
            </div>
            <h3>{output.title}</h3>
            <p>{output.description}</p>
            <div className="code-output-actions">
              {editable ? (
                <>
                  <a
                    className="button primary"
                    href={`#/project/${project.id}/output/${output.id}`}
                  >
                    <Play size={15} />
                    Open output
                  </a>
                  <button className="button secondary" onClick={() => setEditing(output)}>
                    Edit output settings
                  </button>
                  <button
                    className="button quiet"
                    onClick={() => {
                      if (window.confirm(`Remove the output ${output.title}?`)) onRemove(output.id)
                    }}
                  >
                    <Trash2 size={14} />
                    Remove
                  </button>
                </>
              ) : (
                <p>Restore this project to open its output.</p>
              )}
            </div>
          </div>
        </article>
      ))}
      {editable && (
        <button className="button secondary" onClick={onAdd}>
          <Plus size={15} />
          Add output
        </button>
      )}
      {editing && (
        <OutputSettings
          key={editing.id}
          output={editing}
          code={code}
          save={onSave}
          close={() => setEditing(null)}
          onDraftChange={onDraftChange}
        />
      )}
    </section>
  )
}
