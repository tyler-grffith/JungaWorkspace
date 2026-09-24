// The Outputs panel on a project overview for projects with the document tool: reading
// outputs with Open and Remove, and a button that adds one.
import { BookOpen, Plus, Trash2 } from 'lucide-react'
import type { Project } from '../library'
import { isDocumentRead } from '../outputs'
import { wordCount, type TextDocument } from './model'
import './document.css'

export default function DocumentOutputs({
  project,
  document: doc,
  onAdd,
  onRemove,
}: {
  project: Project
  document: TextDocument
  onAdd: () => boolean
  onRemove: (outputId: string) => boolean
}) {
  const outputs = project.outputs.filter(isDocumentRead)
  const count = wordCount(doc)
  return (
    <section className="doc-outputs" aria-labelledby="doc-outputs-heading">
      <div className="section-heading">
        <h2 id="doc-outputs-heading">Document outputs</h2>
        <span>
          {count.words} {count.words === 1 ? 'word' : 'words'}
        </span>
      </div>
      <p className="doc-outputs-help">
        A reading output opens the document on its own page with an outline, ready to read or print,
        without the editing controls.
      </p>
      {outputs.length > 0 && (
        <ul className="doc-output-list">
          {outputs.map((output) => (
            <li key={output.id}>
              <div>
                <h3>{output.title}</h3>
                <p>{output.description}</p>
              </div>
              <div className="doc-output-actions">
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
                        window.confirm(`Remove the output “${output.title}”? The document stays.`)
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
          Add reading output
        </button>
      )}
    </section>
  )
}
