// The portfolio as a reader sees it: hero, contents, sections of entries with a presentation
// figure each. One component serves the in-app presenter (`links="app"`, entries open their
// project or output) and the standalone HTML export (`links="export"`, entries link to the
// project's reference URL only, because a reader of the exported page has no library).
// No hooks and no stylesheet import: `PAGE_STYLE` travels with it.
import type { ReactNode } from 'react'
import type { Library } from '../library'
import { moduleById } from '../modules/registry'
import { figureFor, previewSummary } from '../present/ProjectPreview'
import { PAGE_STYLE } from './pageStyle'
import { introParagraphs, presentableSections, type Portfolio, type ResolvedEntry } from './model'

export type PageLinks = 'app' | 'export'
export type PageCopy = { eyebrow: string; footerLine: string }
export const DEFAULT_COPY: PageCopy = {
  eyebrow: 'PORTFOLIO',
  footerLine: 'Assembled in Junga Workspace',
}

const entryHref = (resolved: ResolvedEntry, links: PageLinks): string => {
  const { project, output } = resolved
  if (!project) return ''
  if (links === 'app')
    return output ? `#/project/${project.id}/output/${output.id}` : `#/project/${project.id}`
  return project.referenceUrl
}

export default function PortfolioPage({
  portfolio,
  library,
  links,
  copy = DEFAULT_COPY,
  date = new Date(),
  body = 'div',
}: {
  portfolio: Portfolio
  library: Library
  links: PageLinks
  copy?: PageCopy
  date?: Date
  /** The standalone export makes the sections its `main`; inside the app the presenter has one. */
  body?: 'main' | 'div'
}) {
  const sections = presentableSections(portfolio, library)
  const paragraphs = introParagraphs(portfolio.intro)
  const showToc = sections.filter((s) => s.section.title.trim()).length > 1
  const Body = body
  return (
    <div className="pf-page" style={{ '--pf-accent': portfolio.accent } as React.CSSProperties}>
      <style>{PAGE_STYLE}</style>
      <header className="pf-hero">
        <span className="pf-eyebrow">{copy.eyebrow}</span>
        <h1>{portfolio.title}</h1>
        {portfolio.tagline && <p className="pf-tagline">{portfolio.tagline}</p>}
        {portfolio.author && <p className="pf-author">{portfolio.author}</p>}
        {paragraphs.length > 0 && (
          <div className="pf-intro">
            {paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        )}
        {portfolio.links.some((l) => l.url) && (
          <ul className="pf-links">
            {portfolio.links
              .filter((l) => l.url)
              .map((l, i) => (
                <li key={i}>
                  <a href={l.url} target="_blank" rel="noopener noreferrer">
                    {l.label.trim() || linkText(l.url)}
                  </a>
                </li>
              ))}
          </ul>
        )}
      </header>
      {showToc && (
        <nav className="pf-toc" aria-label="Portfolio sections">
          {sections
            .filter((s) => s.section.title.trim())
            .map(({ section }) => (
              <a key={section.id} href={`#pf-section-${section.id}`}>
                {section.title}
              </a>
            ))}
        </nav>
      )}
      <Body className="pf-body">
        {sections.length === 0 && (
          <p className="pf-empty-page">
            Nothing to show yet. Add projects to this portfolio to present them here.
          </p>
        )}
        {sections.map(({ section, entries }) => {
          const titled = !!section.title.trim()
          const Heading = titled ? 'h3' : 'h2'
          return (
            <section
              key={section.id}
              id={`pf-section-${section.id}`}
              className="pf-section"
              aria-label={titled ? undefined : 'Work'}
            >
              {(titled || section.description.trim()) && (
                <div className="pf-section-head">
                  {titled && <h2>{section.title}</h2>}
                  {section.description.trim() && <p>{section.description}</p>}
                </div>
              )}
              <div className={`pf-grid ${portfolio.layout}`}>
                {entries.map((resolved) => (
                  <Entry
                    key={resolved.entry.id}
                    resolved={resolved}
                    links={links}
                    Heading={Heading}
                  />
                ))}
              </div>
            </section>
          )
        })}
      </Body>
      <footer className="pf-footer">
        <span>{copy.footerLine}</span>
        <span>
          {date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
        </span>
      </footer>
    </div>
  )
}

function Entry({
  resolved,
  links,
  Heading,
}: {
  resolved: ResolvedEntry
  links: PageLinks
  Heading: 'h2' | 'h3'
}) {
  const { entry, project, output, title, caption } = resolved
  if (!project) return null
  const href = entryHref(resolved, links)
  const summary = previewSummary(project, output)
  const tools: ReactNode =
    project.projectType === 'code' ? (
      <span>Code project</span>
    ) : (
      project.tools.map((tool) => <span key={tool}>{moduleById[tool].name}</span>)
    )
  return (
    <article className={`pf-entry ${entry.size}`}>
      <div className="pf-figure">{figureFor(project, output, `${entry.id}-${project.id}`)}</div>
      <div className="pf-entry-body">
        <Heading>{href ? <a href={href}>{title}</a> : title}</Heading>
        {entry.role.trim() && <p className="pf-role">{entry.role}</p>}
        {caption && <p className="pf-caption">{caption}</p>}
        <div className="pf-entry-meta">
          <span className="pf-tools">{tools}</span>
          {summary && <span>{summary}</span>}
          {links === 'app' && href && <a href={href}>{output ? 'Open output' : 'Open project'}</a>}
          {links === 'export' && project.referenceUrl && (
            <a href={project.referenceUrl} target="_blank" rel="noopener noreferrer">
              Reference
            </a>
          )}
        </div>
      </div>
    </article>
  )
}
const linkText = (url: string) => {
  try {
    const u = new URL(url)
    return u.protocol === 'mailto:' ? u.pathname : u.hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
