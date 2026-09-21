import { useEffect, useRef } from 'react'
import { EditorView, basicSetup } from 'codemirror'
import { Compartment, EditorState } from '@codemirror/state'
import { javascript } from '@codemirror/lang-javascript'
import { html } from '@codemirror/lang-html'
import { css } from '@codemirror/lang-css'
import { json } from '@codemirror/lang-json'
import { markdown } from '@codemirror/lang-markdown'
import { extensionOf } from './model'

/** Language support per extension. Unknown text opens with no highlighting rather than failing. */
function languageFor(path: string) {
  const extension = extensionOf(path)
  if (['js', 'mjs', 'jsx'].includes(extension)) return [javascript({ jsx: extension === 'jsx' })]
  if (['ts', 'tsx'].includes(extension))
    return [javascript({ typescript: true, jsx: extension === 'tsx' })]
  if (['html', 'htm', 'svg', 'xml'].includes(extension)) return [html()]
  if (extension === 'css') return [css()]
  if (extension === 'json') return [json()]
  if (extension === 'md') return [markdown()]
  return []
}

/**
 * CodeMirror wrapped as a controlled field. The view owns its document, so `value` is pushed in
 * only when it differs from what the view already holds; that keeps the cursor still while typing.
 */
export default function CodeMirrorField({
  path,
  value,
  readOnly,
  onChange,
}: {
  path: string
  value: string
  readOnly: boolean
  onChange: (next: string) => void
}) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const latest = useRef(onChange)
  latest.current = onChange
  const editable = useRef(new Compartment())

  useEffect(() => {
    const state = EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        ...languageFor(path),
        EditorView.lineWrapping,
        editable.current.of([EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly)]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) latest.current(update.state.doc.toString())
        }),
      ],
    })
    const instance = new EditorView({ state, parent: host.current! })
    view.current = instance
    return () => {
      instance.destroy()
      view.current = null
    }
    // The view is rebuilt per file so language and history follow the open file.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path])

  useEffect(() => {
    const instance = view.current
    if (!instance) return
    const current = instance.state.doc.toString()
    if (current !== value)
      instance.dispatch({ changes: { from: 0, to: current.length, insert: value } })
  }, [value])

  useEffect(() => {
    view.current?.dispatch({
      effects: editable.current.reconfigure([
        EditorState.readOnly.of(readOnly),
        EditorView.editable.of(!readOnly),
      ]),
    })
  }, [readOnly])

  return <div className="code-mirror-host" ref={host} data-path={path} />
}
