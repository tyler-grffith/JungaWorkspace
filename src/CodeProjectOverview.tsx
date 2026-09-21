import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { Project } from './library'
import { validOutput, type Output, type SceneOutput } from './outputs'
import { cosmicClockManifest } from './interactive-scenes/cosmic-clock/manifest'
import './code-project.css'

function OutputSettings({
  output,
  save,
  close,
  onDraftChange,
}: {
  output: SceneOutput
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
  function change(update: (next: SceneOutput) => void) {
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
      setError('Check the date, camera limits, playback speed, and metadata.')
      return
    }
    if (save(value, original)) close()
    else
      setError(
        'Settings could not be applied. Your edits remain here. Check the workspace save error, then retry or cancel.',
      )
  }
  const state = value.source.defaultState
  return (
    <dialog
      ref={dialog}
      className="modal code-output-settings"
      aria-labelledby="output-settings-title"
      onCancel={(event) => {
        event.preventDefault()
        cancel()
      }}
    >
      <div className="modal-heading">
        <div>
          <h2 id="output-settings-title">Output settings</h2>
          <p>Set the authored starting point for a new visit.</p>
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
        <fieldset>
          <legend>Default camera</legend>
          <p className="field-hint">
            Longitude is measured east from the sunlit center. Distance is in Earth radii. Narrow
            screens pull back slightly to fit the globe.
          </p>
          <div className="code-settings-grid">
            <label>
              Latitude (degrees)
              <input
                type="number"
                min={-75}
                max={75}
                step="any"
                required
                value={state.camera.latitude}
                onChange={(e) =>
                  change((next) => {
                    next.source.defaultState.camera.latitude = e.target.valueAsNumber
                  })
                }
              />
            </label>
            <label>
              Sun-relative longitude (degrees)
              <input
                type="number"
                min={-180}
                max={180}
                step="any"
                required
                value={state.camera.sunLongitudeOffset}
                onChange={(e) =>
                  change((next) => {
                    next.source.defaultState.camera.sunLongitudeOffset = e.target.valueAsNumber
                  })
                }
              />
            </label>
            <label>
              Camera distance
              <input
                type="number"
                min={2.05}
                max={6}
                step="any"
                required
                value={state.camera.distance}
                onChange={(e) =>
                  change((next) => {
                    next.source.defaultState.camera.distance = e.target.valueAsNumber
                  })
                }
              />
            </label>
          </div>
        </fieldset>
        <fieldset>
          <legend>Default time</legend>
          <label>
            Time mode
            <select
              value={state.time.mode}
              onChange={(e) =>
                change((next) => {
                  next.source.defaultState.time.mode = e.target.value as 'live' | 'simulation'
                  if (e.target.value === 'live') {
                    next.source.defaultState.time.speed = 1
                    next.source.defaultState.time.paused = false
                  }
                })
              }
            >
              <option value="live">Live clock</option>
              <option value="simulation">Simulation</option>
            </select>
          </label>
          <div className="code-settings-grid">
            <label>
              Starting date (UTC)
              <input
                type="datetime-local"
                step="1"
                min="1970-01-01T00:00:00"
                max="2100-12-31T23:59:59"
                required
                value={state.time.date.slice(0, 19)}
                onChange={(e) =>
                  change((next) => {
                    const date = Date.parse(`${e.target.value}Z`)
                    next.source.defaultState.time.date = Number.isFinite(date)
                      ? new Date(date).toISOString()
                      : ''
                  })
                }
              />
            </label>
            <label>
              Default playback speed
              <input
                type="number"
                min={1}
                max={86400}
                step="any"
                required
                disabled={state.time.mode === 'live'}
                value={state.time.speed}
                onChange={(e) =>
                  change((next) => {
                    next.source.defaultState.time.speed = e.target.valueAsNumber
                  })
                }
              />
            </label>
          </div>
          <label className="code-check">
            <input
              type="checkbox"
              disabled={state.time.mode === 'live'}
              checked={state.time.paused}
              onChange={(e) =>
                change((next) => {
                  next.source.defaultState.time.paused = e.target.checked
                })
              }
            />
            Start paused
          </label>
          <p className="field-hint">
            Live uses the current date at 1×. Starting date and pause apply to Simulation.
          </p>
        </fieldset>
        <label className="code-check">
          <input
            type="checkbox"
            checked={state.showTimeZones}
            onChange={(e) =>
              change((next) => {
                next.source.defaultState.showTimeZones = e.target.checked
              })
            }
          />
          Show time-zone boundaries by default
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
        <p className="field-hint">
          Bundled asset credits and licenses remain available in the viewer. Apply these settings
          before downloading a library backup.
        </p>
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
export default function CodeProjectOverview({
  project,
  onSave,
  onAdd,
  onDraftChange,
}: {
  project: Project
  onSave: (value: Output, expected: Output) => boolean
  onAdd: () => void
  onDraftChange: (dirty: boolean) => void
}) {
  const [editing, setEditing] = useState<SceneOutput | null>(null)
  const credits = `${import.meta.env.BASE_URL}assets/cosmic-clock/CREDITS.md`
  return (
    <div className="code-project-overview">
      <section className="code-working">
        <div className="section-heading">
          <h2>Working material</h2>
          <span>Code project</span>
        </div>
        <p>
          The source behind this project lives in the repository. Junga manages its output metadata
          and starting configuration here.
        </p>
        {project.sourceManifest ? (
          <>
            <p className="code-manifest-version">Cosmic Clock source manifest · Version 1</p>
            {cosmicClockManifest.map((group) => (
              <details key={group.group} className="code-inventory">
                <summary>
                  {group.group}
                  <span>{group.entries.length} items</span>
                </summary>
                <ul>
                  {group.entries.map((entry) => (
                    <li key={entry.path}>
                      <code>{entry.path}</code>
                      <p>{entry.description}</p>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
            <a className="code-source-link" href={credits} target="_blank" rel="noreferrer">
              Asset attribution, licenses & original sources ↗
            </a>
          </>
        ) : (
          <p className="code-manifest-version">
            Add an Earth Clock output to attach its bundled source manifest.
          </p>
        )}
        {project.referenceUrl && (
          <a
            className="code-source-link"
            href={project.referenceUrl}
            target="_blank"
            rel="noreferrer"
          >
            Project source reference ↗
          </a>
        )}
        <p className="code-repository-note">
          Repository files are listed for reference. Editing code or synchronizing files from the
          browser is future work.
        </p>
      </section>
      <section className="code-outputs">
        <div className="section-heading">
          <h2>Outputs</h2>
          <span>{project.outputs.length}</span>
        </div>
        <p>Interactive experiences made by {project.title}.</p>
        {project.outputs
          .filter((output): output is SceneOutput => output.type === 'interactive-scene')
          .map((output) => (
            <article key={output.id} className="code-output-card" aria-label={output.title}>
              <div className="code-output-art" aria-hidden="true">
                <div />
              </div>
              <div className="code-output-body">
                <div className="code-output-medium">
                  Interactive scene <span>{output.status === 'ready' ? 'Ready' : 'Draft'}</span>
                </div>
                <h3>{output.title}</h3>
                <p>{output.description}</p>
                <div className="code-output-actions">
                  {project.status !== 'trashed' ? (
                    <>
                      <a
                        className="button primary"
                        href={`#/project/${project.id}/output/${output.id}`}
                      >
                        Open scene
                      </a>
                      <button className="button secondary" onClick={() => setEditing(output)}>
                        Edit output settings
                      </button>
                    </>
                  ) : (
                    <p>Restore this project to open its output.</p>
                  )}
                </div>
              </div>
            </article>
          ))}
        {project.status !== 'trashed' && (
          <button className="button secondary" onClick={onAdd}>
            Add Earth Clock output
          </button>
        )}
      </section>
      {editing && (
        <OutputSettings
          key={editing.id}
          output={editing}
          save={onSave}
          close={() => setEditing(null)}
          onDraftChange={onDraftChange}
        />
      )}
    </div>
  )
}
