// The Outputs panel on a project overview for projects with the collection tool: browse
// outputs with Open and Remove, and a button that adds one.
import { BookOpen, Plus, Trash2 } from 'lucide-react'
import type { Project } from '../library'
import { isCollectionBrowse } from '../outputs'
import type { CollectionDocument } from './model'
import './collection.css'

export default function CollectionOutputs({
  project,
  document: collections,
  onAdd,
  onRemove,
}: {
  project: Project
  document: CollectionDocument
  onAdd: () => boolean
  onRemove: (outputId: string) => boolean
}) {
  const outputs = project.outputs.filter(isCollectionBrowse)
  return (
    <section className="col-outputs" aria-labelledby="col-outputs-heading">
      <div className="section-heading">
        <h2 id="col-outputs-heading">Collection outputs</h2>
        <span>
          {collections.collections.length}{' '}
          {collections.collections.length === 1 ? 'collection' : 'collections'} ·{' '}
          {collections.items.length} {collections.items.length === 1 ? 'item' : 'items'}
        </span>
      </div>
      <p className="col-outputs-help">
        A browse output opens the collections on their own page to peruse: the tree, the cards, and
        each item's details and links, without the editing controls.
      </p>
      {outputs.length > 0 && (
        <ul className="col-output-list">
          {outputs.map((output) => (
            <li key={output.id}>
              <div>
                <h3>{output.title}</h3>
                <p>{output.description}</p>
              </div>
              <div className="col-output-actions">
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
                        window.confirm(`Remove the output “${output.title}”? The collections stay.`)
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
          Add browse output
        </button>
      )}
    </section>
  )
}
