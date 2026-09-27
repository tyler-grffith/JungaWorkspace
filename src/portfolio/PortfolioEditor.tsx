// Assembling a portfolio: settings on the left, sections of entries in the middle, and the
// library picker on the right. The editor is controlled by the host (every edit goes through
// `onChange` and comes back as the next `portfolio`), like the module editors, so the library
// write can wait for a pause in typing. It never touches storage.
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  ChevronDown,
  Download,
  ExternalLink,
  Eye,
  Plus,
  Search,
  Trash2,
  TriangleAlert,
  X,
} from 'lucide-react'
import type { Library, Project } from '../library'
import { moduleById } from '../modules/registry'
import { ProjectPreview, previewSummary } from '../present/ProjectPreview'
import { downloadBlob } from '../canvas/export'
import { portfolioFilename, portfolioHtml, portfolioMarkdown } from '../export/portfolio'
import type { PageCopy } from './PortfolioPage'
import { PAGE_STYLE } from './pageStyle'
import {
  addEntry,
  addSection,
  entriesOf,
  LAYOUTS,
  LIMITS,
  MAX_LINKS,
  moveEntry,
  moveEntryToSection,
  moveSection,
  portfolioProblem,
  portfolioSummary,
  removeEntry,
  removeSection,
  resolveSections,
  safeUrl,
  SIZES,
  updateEntry,
  updateLinks,
  updateSection,
  type Portfolio,
  type PortfolioLink,
  type PortfolioSection,
  type ResolvedEntry,
} from './model'
import './portfolio.css'

export type PortfolioEditorProps = {
  portfolio: Portfolio
  library: Library
  unsaved: boolean
  copy: PageCopy
  onChange: (next: Portfolio) => boolean
  onRemove: () => void
  onBack: () => void
}

export default function PortfolioEditor({
  portfolio,
  library,
  unsaved,
  copy,
  onChange,
  onRemove,
  onBack,
}: PortfolioEditorProps) {
  const [notice, setNotice] = useState('')
  const sections = useMemo(() => resolveSections(portfolio, library), [portfolio, library])
  const problem = portfolioProblem(portfolio)
  /** Apply a pure change; a refusal (a duplicate entry, a limit) becomes a notice. */
  const mutate = (change: (current: Portfolio) => Portfolio): boolean => {
    try {
      const next = change(portfolio)
      if (next === portfolio) return true
      return onChange(next)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'That change could not be made.')
      return false
    }
  }
  const exportAs = (kind: 'html' | 'md') => {
    const text =
      kind === 'html'
        ? portfolioHtml(portfolio, library, copy)
        : portfolioMarkdown(portfolio, library)
    const filename = portfolioFilename(portfolio, kind)
    downloadBlob(
      new Blob([text], { type: kind === 'html' ? 'text/html' : 'text/markdown' }),
      filename,
    )
    setNotice(
      kind === 'html'
        ? `Downloaded ${filename}: a standalone page with every preview inside it.`
        : `Downloaded ${filename}.`,
    )
  }
  const title = portfolio.title.trim() || 'Untitled portfolio'
  return (
    <div className="pfe-editor-page">
      <style>{PAGE_STYLE}</style>
      <button type="button" className="back-link" onClick={onBack}>
        <ArrowLeft size={15} />
        Back to library
      </button>
      <div className="pfe-heading">
        <div>
          <div className="eyebrow">PORTFOLIO · {portfolioSummary(portfolio)}</div>
          <h1>{title}</h1>
        </div>
        <div className="pfe-actions">
          <a className="button primary" href={`#/portfolio/${portfolio.id}/present`}>
            <Eye size={15} />
            Preview
          </a>
          <ExportMenu onExport={exportAs} />
          <button type="button" className="button secondary" onClick={onRemove}>
            <Trash2 size={15} />
            Delete portfolio
          </button>
        </div>
      </div>
      <p className="pfe-status" role="status">
        {unsaved
          ? 'Changes not saved yet. They are kept on this page; check the workspace save error.'
          : 'Saved as you edit. Preview shows the page a reader sees.'}
      </p>
      {problem && (
        <p role="alert" className="form-error">
          {problem}
        </p>
      )}
      {notice && (
        <p className="pfe-notice" role="status">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')}>
            Dismiss
          </button>
        </p>
      )}
      <div className="pfe-editor">
        <SettingsPanel portfolio={portfolio} onChange={onChange} />
        <div className="pfe-main">
          {sections.map(({ section, entries }, index) => (
            <SectionBlock
              key={section.id}
              section={section}
              entries={entries}
              index={index}
              count={sections.length}
              sections={portfolio.sections}
              mutate={mutate}
            />
          ))}
          <button
            type="button"
            className="button secondary"
            onClick={() => mutate((p) => addSection(p))}
          >
            <Plus size={15} />
            Add section
          </button>
        </div>
        <LibraryPicker
          portfolio={portfolio}
          library={library}
          onAdd={(project, outputId, sectionId) =>
            mutate((p) => addEntry(p, project.id, outputId, sectionId))
          }
        />
      </div>
    </div>
  )
}

function ExportMenu({ onExport }: { onExport: (kind: 'html' | 'md') => void }) {
  const ref = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) ref.current?.removeAttribute('open')
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') ref.current?.removeAttribute('open')
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [])
  const run = (kind: 'html' | 'md') => {
    ref.current?.removeAttribute('open')
    onExport(kind)
  }
  return (
    <details className="project-menu pfe-menu" ref={ref}>
      <summary className="button secondary" aria-label="Export">
        <Download size={15} />
        Export
        <ChevronDown size={13} />
      </summary>
      <div className="menu-panel" role="menu">
        <button type="button" role="menuitem" onClick={() => run('html')}>
          Web page (HTML)
        </button>
        <button type="button" role="menuitem" onClick={() => run('md')}>
          Markdown
        </button>
      </div>
    </details>
  )
}

function SettingsPanel({
  portfolio,
  onChange,
}: {
  portfolio: Portfolio
  onChange: (next: Portfolio) => boolean
}) {
  const id = useId()
  const set = (patch: Partial<Portfolio>) => onChange({ ...portfolio, ...patch })
  return (
    <aside className="pfe-panel" aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`}>About this portfolio</h2>
      <label className="pfe-field">
        Portfolio title
        <input
          value={portfolio.title}
          maxLength={LIMITS.title}
          placeholder="e.g. Selected engineering work"
          onChange={(e) => set({ title: e.target.value })}
        />
      </label>
      <label className="pfe-field">
        Tagline
        <input
          value={portfolio.tagline}
          maxLength={LIMITS.tagline}
          placeholder="One line under the title"
          onChange={(e) => set({ tagline: e.target.value })}
        />
      </label>
      <label className="pfe-field">
        Your name
        <input
          value={portfolio.author}
          maxLength={LIMITS.author}
          placeholder="Shown under the tagline"
          onChange={(e) => set({ author: e.target.value })}
        />
      </label>
      <label className="pfe-field">
        Introduction
        <textarea
          value={portfolio.intro}
          maxLength={LIMITS.intro}
          rows={5}
          placeholder="A few sentences about you or this body of work. Blank lines start new paragraphs."
          onChange={(e) => set({ intro: e.target.value })}
        />
      </label>
      <div className="pfe-field" role="group" aria-labelledby={`${id}-links`}>
        <span id={`${id}-links`}>Links</span>
        <div className="pfe-links">
          {portfolio.links.map((link, index) => (
            <LinkRow
              key={index}
              link={link}
              onCommit={(next) =>
                onChange(
                  updateLinks(
                    portfolio,
                    portfolio.links.map((l, i) => (i === index ? next : l)),
                  ),
                )
              }
              onRemove={() =>
                onChange(
                  updateLinks(
                    portfolio,
                    portfolio.links.filter((_, i) => i !== index),
                  ),
                )
              }
            />
          ))}
        </div>
        {portfolio.links.length < MAX_LINKS && (
          <button
            type="button"
            className="text-button"
            onClick={() =>
              onChange(updateLinks(portfolio, [...portfolio.links, { label: '', url: '' }]))
            }
          >
            <Plus size={14} />
            Add a link
          </button>
        )}
      </div>
      <div className="pfe-row">
        <label className="pfe-field">
          Layout
          <select
            value={portfolio.layout}
            onChange={(e) => set({ layout: e.target.value as Portfolio['layout'] })}
          >
            {LAYOUTS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        <label className="pfe-field">
          Accent
          <input
            type="color"
            value={portfolio.accent}
            onChange={(e) => set({ accent: e.target.value })}
          />
        </label>
      </div>
      <p className="pfe-help">
        Export writes a standalone web page with every preview drawn inside it, or a Markdown
        outline. Projects link to their reference links on the exported page.
      </p>
    </aside>
  )
}

/** A link's fields are typed locally and committed on blur, so a half-typed URL is not refused. */
function LinkRow({
  link,
  onCommit,
  onRemove,
}: {
  link: PortfolioLink
  onCommit: (next: PortfolioLink) => boolean
  onRemove: () => void
}) {
  const [label, setLabel] = useState(link.label)
  const [url, setUrl] = useState(link.url)
  const [error, setError] = useState('')
  useEffect(() => {
    setLabel(link.label)
    setUrl(link.url)
  }, [link.label, link.url])
  const commit = () => {
    const clean = url.trim()
    if (clean && !safeUrl(clean)) {
      setError('Use a full link starting with https://, http://, or mailto:.')
      return
    }
    setError('')
    if (clean !== link.url || label !== link.label) onCommit({ label, url: clean })
  }
  return (
    <div className="pfe-link">
      <input
        aria-label="Link label"
        placeholder="Label"
        maxLength={LIMITS.linkLabel}
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={commit}
      />
      <input
        aria-label="Link address"
        placeholder="https://"
        maxLength={LIMITS.url}
        value={url}
        aria-invalid={error ? true : undefined}
        onChange={(e) => setUrl(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit()
          }
        }}
      />
      <button type="button" className="icon-button" aria-label="Remove link" onClick={onRemove}>
        <X size={15} />
      </button>
      {error && <span className="pfe-link-error">{error}</span>}
    </div>
  )
}

function SectionBlock({
  section,
  entries,
  index,
  count,
  sections,
  mutate,
}: {
  section: PortfolioSection
  entries: ResolvedEntry[]
  index: number
  count: number
  sections: PortfolioSection[]
  mutate: (change: (current: Portfolio) => Portfolio) => boolean
}) {
  const name = section.title.trim() || `Section ${index + 1}`
  return (
    <section className="pfe-section" aria-label={name}>
      <div className="pfe-section-head">
        <input
          className="pfe-section-title"
          aria-label="Section title"
          placeholder="Section title"
          maxLength={LIMITS.sectionTitle}
          value={section.title}
          onChange={(e) => mutate((p) => updateSection(p, section.id, { title: e.target.value }))}
        />
        <div className="pfe-section-tools">
          <button
            type="button"
            className="icon-button"
            aria-label={`Move ${name} up`}
            disabled={index === 0}
            onClick={() => mutate((p) => moveSection(p, section.id, -1))}
          >
            <ArrowUp size={15} />
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label={`Move ${name} down`}
            disabled={index === count - 1}
            onClick={() => mutate((p) => moveSection(p, section.id, 1))}
          >
            <ArrowDown size={15} />
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label={`Remove ${name}`}
            onClick={() => {
              if (
                !entries.length ||
                window.confirm(
                  `Remove ${name} and its ${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} from the portfolio? The projects stay in your library.`,
                )
              )
                mutate((p) => removeSection(p, section.id))
            }}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
      <input
        className="pfe-section-description"
        aria-label="Section description"
        placeholder="A line about this section (optional)"
        maxLength={LIMITS.sectionDescription}
        value={section.description}
        onChange={(e) =>
          mutate((p) => updateSection(p, section.id, { description: e.target.value }))
        }
      />
      {entries.length ? (
        <ol className="pfe-entries">
          {entries.map((resolved, i) => (
            <EntryCard
              key={resolved.entry.id}
              resolved={resolved}
              sectionId={section.id}
              sections={sections}
              first={i === 0 && index === 0}
              last={i === entries.length - 1 && index === count - 1}
              mutate={mutate}
            />
          ))}
        </ol>
      ) : (
        <p className="pfe-empty">
          No entries in this section yet. Add projects from the library picker.
        </p>
      )}
    </section>
  )
}

function EntryCard({
  resolved,
  sectionId,
  sections,
  first,
  last,
  mutate,
}: {
  resolved: ResolvedEntry
  sectionId: string
  sections: PortfolioSection[]
  first: boolean
  last: boolean
  mutate: (change: (current: Portfolio) => Portfolio) => boolean
}) {
  const { entry, project, output, title, problem } = resolved
  const id = useId()
  const patch = (fields: Parameters<typeof updateEntry>[2]) =>
    mutate((p) => updateEntry(p, entry.id, fields))
  return (
    <li className="pfe-entry">
      <div className="pfe-entry-figure">
        {project ? (
          <ProjectPreview project={project} output={output} scope={entry.id} />
        ) : (
          <div className="pf-figure">
            <span className="pf-empty">Missing project</span>
          </div>
        )}
      </div>
      <div className="pfe-entry-fields">
        <div className="pfe-entry-top">
          <strong>{project?.title ?? 'Missing project'}</strong>
          {project && (
            <span className="pfe-entry-facts">
              {project.projectType === 'code'
                ? 'Code project'
                : project.tools.map((t) => moduleById[t].name).join(', ')}
              {' · '}
              {previewSummary(project, output)}
              {output ? ` · featuring ${output.title}` : ''}
            </span>
          )}
          {problem && (
            <span className="pfe-problem">
              <TriangleAlert size={13} />
              {problem}
            </span>
          )}
        </div>
        <div className="pfe-entry-row">
          <label className="pfe-field" htmlFor={`${id}-title`}>
            Shown title
            <input
              id={`${id}-title`}
              value={entry.title}
              maxLength={LIMITS.entryTitle}
              placeholder={project?.title ?? 'Title'}
              onChange={(e) => patch({ title: e.target.value })}
            />
          </label>
          <label className="pfe-field" htmlFor={`${id}-role`}>
            Role or year
            <input
              id={`${id}-role`}
              value={entry.role}
              maxLength={LIMITS.role}
              placeholder="e.g. Design and analysis · 2026"
              onChange={(e) => patch({ role: e.target.value })}
            />
          </label>
        </div>
        <label className="pfe-field" htmlFor={`${id}-caption`}>
          Caption
          <textarea
            id={`${id}-caption`}
            rows={2}
            value={entry.caption}
            maxLength={LIMITS.caption}
            placeholder={project?.description || 'Why this piece matters, in a sentence or two.'}
            onChange={(e) => patch({ caption: e.target.value })}
          />
        </label>
        <div className="pfe-entry-row">
          {project && project.outputs.length > 0 && (
            <label className="pfe-field" htmlFor={`${id}-feature`}>
              Feature
              <select
                id={`${id}-feature`}
                value={entry.outputId}
                onChange={(e) => patch({ outputId: e.target.value })}
              >
                <option value="">The project</option>
                {project.outputs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="pfe-field" htmlFor={`${id}-size`}>
            Size
            <select
              id={`${id}-size`}
              value={entry.size}
              onChange={(e) => patch({ size: e.target.value as ResolvedEntry['entry']['size'] })}
            >
              {SIZES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          {sections.length > 1 && (
            <label className="pfe-field" htmlFor={`${id}-section`}>
              Section
              <select
                id={`${id}-section`}
                value={sectionId}
                onChange={(e) => mutate((p) => moveEntryToSection(p, entry.id, e.target.value))}
              >
                {sections.map((s, i) => (
                  <option key={s.id} value={s.id}>
                    {s.title.trim() || `Section ${i + 1}`}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>
      <div className="pfe-entry-tools">
        <button
          type="button"
          className="icon-button"
          aria-label={`Move ${title} up`}
          disabled={first}
          onClick={() => mutate((p) => moveEntry(p, entry.id, -1))}
        >
          <ArrowUp size={15} />
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label={`Move ${title} down`}
          disabled={last}
          onClick={() => mutate((p) => moveEntry(p, entry.id, 1))}
        >
          <ArrowDown size={15} />
        </button>
        {project && (
          <a
            className="icon-button"
            href={
              output ? `#/project/${project.id}/output/${output.id}` : `#/project/${project.id}`
            }
            aria-label={`Open ${project.title}`}
            title={output ? 'Open the featured output' : 'Open the project'}
          >
            <ExternalLink size={15} />
          </a>
        )}
        <button
          type="button"
          className="icon-button"
          aria-label={`Remove ${title} from the portfolio`}
          onClick={() => mutate((p) => removeEntry(p, entry.id))}
        >
          <X size={15} />
        </button>
      </div>
    </li>
  )
}

function LibraryPicker({
  portfolio,
  library,
  onAdd,
}: {
  portfolio: Portfolio
  library: Library
  onAdd: (project: Project, outputId: string, sectionId: string) => boolean
}) {
  const id = useId()
  const [query, setQuery] = useState('')
  const [sectionId, setSectionId] = useState('')
  const entries = entriesOf(portfolio)
  const target =
    portfolio.sections.find((s) => s.id === sectionId) ??
    portfolio.sections[portfolio.sections.length - 1]
  const candidates = useMemo(() => {
    const search = query.trim().toLocaleLowerCase()
    const rank = (p: Project) => (p.status === 'archived' ? 2 : p.builtIn ? 1 : 0)
    return library.projects
      .filter((p) => p.status !== 'trashed')
      .filter(
        (p) =>
          !search ||
          `${p.title} ${p.description} ${p.tools.map((t) => moduleById[t].name).join(' ')}`
            .toLocaleLowerCase()
            .includes(search),
      )
      .sort((a, b) => rank(a) - rank(b) || b.updatedAt.localeCompare(a.updatedAt))
  }, [library.projects, query])
  return (
    <aside className="pfe-picker" aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`}>Add from the library</h2>
      <div className="search-box">
        <Search size={15} />
        <input
          type="search"
          aria-label="Search the library"
          placeholder="Search projects…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {portfolio.sections.length > 1 && (
        <label className="pfe-picker-target">
          Add to section
          <select value={target?.id ?? ''} onChange={(e) => setSectionId(e.target.value)}>
            {portfolio.sections.map((s, i) => (
              <option key={s.id} value={s.id}>
                {s.title.trim() || `Section ${i + 1}`}
              </option>
            ))}
          </select>
        </label>
      )}
      <ul className="pfe-picker-list" aria-label="Library projects">
        {candidates.map((project) => {
          const included = entries.some((e) => e.projectId === project.id)
          // A project already in the portfolio can be added again featuring an output it
          // does not feature yet; with nothing left to feature, the button rests.
          const nextOutput = project.outputs.find(
            (o) => !entries.some((e) => e.projectId === project.id && e.outputId === o.id),
          )
          const canAdd = !included || !!nextOutput
          const Icon =
            project.projectType === 'code' || !project.tools.length
              ? null
              : moduleById[project.tools[0]].icon
          return (
            <li key={project.id} className={included ? 'is-added' : ''}>
              <span className="pfe-picker-icon" aria-hidden="true">
                {Icon ? <Icon size={16} /> : <span>{'</>'}</span>}
              </span>
              <span className="pfe-picker-text">
                <strong>{project.title}</strong>
                <small>
                  {project.projectType === 'code'
                    ? 'Code project'
                    : project.tools.map((t) => moduleById[t].name).join(', ')}
                  {project.builtIn
                    ? ' · Example'
                    : project.status === 'archived'
                      ? ' · Archived'
                      : ''}
                </small>
              </span>
              <button
                type="button"
                className="button secondary"
                aria-label={
                  included
                    ? canAdd
                      ? `Add ${project.title} again, featuring ${nextOutput!.title}`
                      : `${project.title} is already in the portfolio`
                    : `Add ${project.title}`
                }
                disabled={!canAdd}
                onClick={() =>
                  onAdd(project, included ? (nextOutput?.id ?? '') : '', target?.id ?? '')
                }
              >
                {included ? <Check size={14} /> : <Plus size={14} />}
                {included ? 'Added' : 'Add'}
              </button>
            </li>
          )
        })}
        {!candidates.length && <li className="pfe-empty">No projects match.</li>}
      </ul>
    </aside>
  )
}
