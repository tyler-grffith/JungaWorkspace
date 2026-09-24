// The Outputs panel on a project overview for projects with the visual canvas tool: a list of
// presentation outputs with Open and Remove, and a button that adds one.
import { Play, Plus, Trash2 } from 'lucide-react'
import type { Project } from '../library'
import { isCanvasShow } from '../outputs'
import { MODE_LABELS, type CanvasDocument } from '../canvas/model'
import './canvas.css'

export default function CanvasOutputs({
  project,
  document: canvas,
  onAdd,
  onRemove,
}: {
  project: Project
  document: CanvasDocument
  onAdd: () => boolean
  onRemove: (outputId: string) => boolean
}) {
  const outputs = project.outputs.filter(isCanvasShow)
  return (
    <section className="canvas-outputs" aria-labelledby="canvas-outputs-heading">
      <div className="section-heading">
        <h2 id="canvas-outputs-heading">Canvas outputs</h2>
        <span>
          {MODE_LABELS[canvas.mode]} · {canvas.pages.length}{' '}
          {canvas.pages.length === 1 ? 'canvas' : 'canvases'}
        </span>
      </div>
      <p className="canvas-outputs-help">
        An output opens the canvases on their own page, shaped by the mode: a deck to present, a
        mockup to click through, a board to pan, or an animation to play.
      </p>
      {outputs.length > 0 && (
        <ul className="canvas-output-list">
          {outputs.map((output) => (
            <li key={output.id}>
              <div>
                <h3>{output.title}</h3>
                <p>{output.description}</p>
              </div>
              <div className="canvas-output-actions">
                <a className="button primary" href={`#/project/${project.id}/output/${output.id}`}>
                  <Play size={14} />
                  Open output
                </a>
                {project.status !== 'trashed' && (
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Remove ${output.title}`}
                    onClick={() => {
                      if (window.confirm(`Remove the output “${output.title}”? The canvases stay.`))
                        onRemove(output.id)
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {project.status !== 'trashed' && (
        <button type="button" className="button" onClick={onAdd}>
          <Plus size={15} />
          Add canvas output
        </button>
      )}
    </section>
  )
}
