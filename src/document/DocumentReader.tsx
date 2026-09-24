// Read-only rendering of a document: the page plus an optional outline. Used by the output
// route and by the editor's Preview. It draws through the same HTML the editor edits.
import { useMemo } from 'react'
import { Printer, X } from 'lucide-react'
import { PAGE_SIZES, outline, wordCount, type TextDocument } from './model'
import { blocksToHtml } from './html'
import './document.css'

export default function DocumentReader({
  document: doc,
  title,
  showOutline = true,
  onExit,
}: {
  document: TextDocument
  title: string
  showOutline?: boolean
  onExit?: () => void
}) {
  const html = useMemo(() => blocksToHtml(doc.blocks), [doc.blocks])
  const headings = outline(doc)
  const count = wordCount(doc)
  const page = PAGE_SIZES[doc.page.size]
  return (
    <div className="doc-reader">
      <h1 className="visually-hidden">{title}</h1>
      {showOutline && headings.length > 0 && (
        <nav className="doc-outline" aria-label="Document outline">
          <h2>Outline</h2>
          <ul>
            {headings.map((h) => (
              <li key={h.id} className={`level-${h.level}`}>
                <a
                  href={`#doc-${h.id}`}
                  onClick={(e) => {
                    e.preventDefault()
                    window.document
                      .querySelector(`[data-id="${h.id}"]`)
                      ?.scrollIntoView({ block: 'start', behavior: 'smooth' })
                  }}
                >
                  {h.text}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <div className="doc-reader-page-wrap">
        <article
          className="doc-page doc-content"
          style={{
            width: page.width,
            padding: `min(${doc.page.margin}in, 5vw)`,
            fontFamily: doc.style.fontFamily,
            fontSize: `${doc.style.fontSize}pt`,
            lineHeight: doc.style.lineHeight,
          }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
        <p className="doc-reader-footer">
          {count.words} {count.words === 1 ? 'word' : 'words'} · {count.characters} characters
        </p>
      </div>
      <div className="doc-reader-actions">
        <button
          type="button"
          className="icon-button"
          aria-label="Print or save as PDF"
          onClick={() => window.print()}
        >
          <Printer size={18} />
        </button>
        {onExit && (
          <button type="button" className="icon-button" aria-label="Close preview" onClick={onExit}>
            <X size={18} />
          </button>
        )}
      </div>
    </div>
  )
}
