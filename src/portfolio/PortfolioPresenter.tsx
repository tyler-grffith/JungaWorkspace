// The portfolio as a reader sees it, on its own route. Read-only boundary like the output
// route: no library object with a commit callback enters here, only the portfolio to show,
// the library to read projects from, and the design's page copy.
import { useEffect } from 'react'
import { ArrowLeft, Briefcase, Download, Printer } from 'lucide-react'
import type { Library } from '../library'
import { downloadBlob } from '../canvas/export'
import { portfolioFilename, portfolioHtml, portfolioMarkdown } from '../export/portfolio'
import PortfolioPage, { type PageCopy } from './PortfolioPage'
import type { Portfolio } from './model'
import './portfolio.css'

export default function PortfolioPresenter({
  portfolio,
  library,
  copy,
}: {
  portfolio?: Portfolio
  library: Library
  copy: PageCopy
}) {
  useEffect(() => {
    window.scrollTo(0, 0)
    document.getElementById('portfolio-content')?.focus({ preventScroll: true })
  }, [portfolio?.id])
  const exportAs = (kind: 'html' | 'md') => {
    if (!portfolio) return
    const text =
      kind === 'html'
        ? portfolioHtml(portfolio, library, copy)
        : portfolioMarkdown(portfolio, library)
    downloadBlob(
      new Blob([text], { type: kind === 'html' ? 'text/html' : 'text/markdown' }),
      portfolioFilename(portfolio, kind),
    )
  }
  return (
    <div className="pfp-shell">
      <a
        className="skip-link"
        href="#portfolio-content"
        onClick={(event) => {
          event.preventDefault()
          document.getElementById('portfolio-content')?.focus()
        }}
      >
        Skip to portfolio
      </a>
      <header className="pfp-header">
        <a href={portfolio ? `#/portfolio/${portfolio.id}` : '#/all'}>
          <ArrowLeft size={16} />
          {portfolio ? 'Back to assembling' : 'Back to library'}
        </a>
        <span>
          <Briefcase size={16} />
          Junga · Portfolio
        </span>
        {portfolio && (
          <div className="pfp-tools">
            <button type="button" className="button secondary" onClick={() => exportAs('html')}>
              <Download size={14} />
              Web page
            </button>
            <button type="button" className="button secondary" onClick={() => exportAs('md')}>
              <Download size={14} />
              Markdown
            </button>
            <button type="button" className="button secondary" onClick={() => window.print()}>
              <Printer size={14} />
              Print or save as PDF
            </button>
          </div>
        )}
      </header>
      <main id="portfolio-content" tabIndex={-1} aria-label="Portfolio">
        {portfolio ? (
          <PortfolioPage portfolio={portfolio} library={library} links="app" copy={copy} />
        ) : (
          <div className="empty-state">
            <h1>Portfolio not found</h1>
            <p>It may have been removed, or it belongs to a different browser.</p>
          </div>
        )}
      </main>
    </div>
  )
}
