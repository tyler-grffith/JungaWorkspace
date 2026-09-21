import { useEffect } from 'react'
import { ArrowLeft, Layers3 } from 'lucide-react'
import type { Project } from './library'
import type { Output } from './outputs'
import SceneHost from './interactive-scenes/cosmic-clock/SceneHost'

/** Read-only boundary: no library object, commit callback, or authoring controls enter this route. */
export default function OutputPage({ project, output }: { project?: Project; output?: Output }) {
  useEffect(() => {
    window.scrollTo(0, 0)
    document.getElementById('output-content')?.focus({ preventScroll: true })
  }, [project?.id, output?.id])
  const available = project && project.status !== 'trashed' && output
  return (
    <div className="output-page">
      <a
        className="skip-link"
        href="#output-content"
        onClick={(event) => {
          event.preventDefault()
          document.getElementById('output-content')?.focus()
        }}
      >
        Skip to output
      </a>
      <header className="output-header">
        <a href={project ? `#/project/${project.id}` : '#/all'}>
          <ArrowLeft size={16} />
          {project ? `Back to ${project.title}` : 'Back to library'}
        </a>
        <span>
          <Layers3 size={16} />
          Junga · Interactive scene{project ? ` · Made by ${project.title}` : ''}
        </span>
      </header>
      <main id="output-content" tabIndex={-1}>
        {available ? (
          <SceneHost key={`${project.id}/${output.id}`} output={output} />
        ) : (
          <div className="empty-state">
            <h1>Output unavailable</h1>
            <p>
              {project?.status === 'trashed'
                ? 'Restore the source project from Trash to open its output.'
                : 'This output may belong to another browser or have been removed.'}
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
