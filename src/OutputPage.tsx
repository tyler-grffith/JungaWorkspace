import { useEffect } from 'react'
import { ArrowLeft, Code2, Layers3 } from 'lucide-react'
import type { Project } from './library'
import { isCodeRun, type Output } from './outputs'
import SceneHost from './interactive-scenes/cosmic-clock/SceneHost'
import CodeRunner from './code/CodeRunner'
import { emptyCode } from './code/model'
import { DOCUMENT_TOOLS, documentModules } from './modules/documents'
import { editorModules } from './modules/editors'

/** Read-only boundary: no library object, commit callback, or authoring controls enter this route. */
export default function OutputPage({ project, output }: { project?: Project; output?: Output }) {
  useEffect(() => {
    window.scrollTo(0, 0)
    document.getElementById('output-content')?.focus({ preventScroll: true })
  }, [project?.id, output?.id])
  const available = project && project.status !== 'trashed' && output
  const codeRun = output ? isCodeRun(output) : false
  // Document modules publish one output type each; find the module that owns this output.
  const moduleTool = output
    ? DOCUMENT_TOOLS.find((tool) => documentModules[tool].output.type === output.type)
    : undefined
  const viewer = moduleTool ? editorModules[moduleTool] : null
  const ViewerIcon = viewer?.outputIcon
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
          {codeRun ? (
            <Code2 size={16} />
          ) : ViewerIcon ? (
            <ViewerIcon size={16} />
          ) : (
            <Layers3 size={16} />
          )}
          Junga · {codeRun ? 'Code output' : (viewer?.outputLabel ?? 'Interactive scene')}
          {project ? ` · Made by ${project.title}` : ''}
        </span>
      </header>
      {/* Named so it stays distinct from any landmark inside a project's own running page. */}
      <main id="output-content" tabIndex={-1} aria-label="Output">
        {project && output && available ? (
          isCodeRun(output) ? (
            <CodeRunner
              key={`${project.id}/${output.id}`}
              files={(project.code ?? emptyCode()).files}
              entry={output.source.entry}
            />
          ) : moduleTool && viewer ? (
            <viewer.Viewer
              key={`${project.id}/${output.id}`}
              project={project}
              document={(project[moduleTool] ?? documentModules[moduleTool].empty()) as never}
              output={output}
            />
          ) : output.type === 'interactive-scene' ? (
            <SceneHost key={`${project.id}/${output.id}`} output={output} />
          ) : null
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
