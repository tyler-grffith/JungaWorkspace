// A generic Outputs panel for document modules whose output is simply "present this
// document read-only". Modules with richer panels (canvas, document, collection) keep their own.
import { BookOpen, Plus, Trash2 } from 'lucide-react'
import type { Project } from '../library'
import { documentModules, type DocumentTool } from './documents'
import '../canvas/canvas.css'

export default function ModuleOutputs({
  project,
  tool,
  heading,
  help,
  summary,
  onAdd,
  onRemove,
}: {
  project: Project
  tool: DocumentTool
  heading: string
  help: string
  summary: string
  onAdd: () => boolean
  onRemove: (outputId: string) => boolean
}) {
  const module = documentModules[tool]
  const outputs = project.outputs.filter((output) => output.type === module.output.type)
  return (
    <section className="canvas-outputs" aria-labelledby={`${tool}-outputs-heading`}>
      <div className="section-heading">
        <h2 id={`${tool}-outputs-heading`}>{heading}</h2>
        <span>{summary}</span>
      </div>
      <p className="canvas-outputs-help">{help}</p>
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
                  <BookOpen size={14} />
                  Open output
                </a>
                {project.status !== 'trashed' && (
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Remove ${output.title}`}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Remove the output “${output.title}”? The ${module.noun} stays.`,
                        )
                      )
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
          {module.output.addLabel}
        </button>
      )}
    </section>
  )
}
