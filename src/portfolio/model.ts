// A portfolio is a library-level presentation: a selection of projects (each optionally
// featuring one of its outputs) ordered into sections with captions, under a title, a tagline,
// an introduction, and links. It reads projects and never edits them, so it lives beside the
// library's collections rather than on any one project. Rendering is `PortfolioPage.tsx`,
// export is `src/export/portfolio.ts`, and the library-level operations (create, save, remove,
// add a project) are in `library.ts`. No React.
import type { Library, Project } from '../library'
import type { Output } from '../outputs'

export type EntrySize = 'normal' | 'wide'
export type PortfolioEntry = {
  id: string
  projectId: string
  /** The project output featured on the card; '' features the project itself. */
  outputId: string
  /** Shown instead of the project's title and description when set. */
  title: string
  caption: string
  /** A short line under the title: a role, a year, a course. */
  role: string
  size: EntrySize
}
export type PortfolioSection = {
  id: string
  title: string
  description: string
  entries: PortfolioEntry[]
}
export type PortfolioLink = { label: string; url: string }
export type PortfolioLayout = 'cards' | 'rows'
export type Portfolio = {
  version: 1
  id: string
  title: string
  tagline: string
  author: string
  /** Plain text; blank lines separate paragraphs. */
  intro: string
  links: PortfolioLink[]
  sections: PortfolioSection[]
  layout: PortfolioLayout
  /** Hex colour used for headings, links, and marks on the page. */
  accent: string
  createdAt: string
  updatedAt: string
}

export const MAX_PORTFOLIOS = 50
export const MAX_SECTIONS = 40
export const MAX_ENTRIES = 200
export const MAX_LINKS = 12
export const LIMITS = {
  title: 100,
  tagline: 160,
  author: 80,
  intro: 4000,
  sectionTitle: 100,
  sectionDescription: 600,
  entryTitle: 100,
  caption: 600,
  role: 80,
  linkLabel: 40,
  url: 2000,
} as const
export const LAYOUTS: readonly { value: PortfolioLayout; label: string }[] = [
  { value: 'cards', label: 'Cards' },
  { value: 'rows', label: 'Rows' },
]
export const SIZES: readonly { value: EntrySize; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'wide', label: 'Wide' },
]
export const DEFAULT_ACCENT = '#285f4b'
export const newId = () => crypto.randomUUID().slice(0, 8)
const timestamp = () => new Date().toISOString()

export function newSection(title = 'Selected work'): PortfolioSection {
  return { id: newId(), title, description: '', entries: [] }
}
export function newEntry(projectId: string, outputId = ''): PortfolioEntry {
  return { id: newId(), projectId, outputId, title: '', caption: '', role: '', size: 'normal' }
}
export function emptyPortfolio(
  title: string,
  options: { author?: string; accent?: string; layout?: PortfolioLayout } = {},
): Portfolio {
  const now = timestamp()
  return {
    version: 1,
    id: newId(),
    title,
    tagline: '',
    author: options.author ?? '',
    intro: '',
    links: [],
    sections: [newSection()],
    layout: options.layout ?? 'cards',
    accent: options.accent ?? DEFAULT_ACCENT,
    createdAt: now,
    updatedAt: now,
  }
}

// --- Validation ---------------------------------------------------------------------------
const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown, max: number) => typeof v === 'string' && v.length <= max
const keys = (v: Record<string, unknown>, names: readonly string[]) =>
  Object.keys(v).length === names.length && names.every((n) => n in v)
const ID = /^[A-Za-z0-9_-]{1,40}$/
const isId = (v: unknown): v is string => typeof v === 'string' && ID.test(v)
const isDate = (v: unknown) => typeof v === 'string' && Number.isFinite(Date.parse(v))
export function safeUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > LIMITS.url) return false
  try {
    return ['https:', 'http:', 'mailto:'].includes(new URL(value).protocol)
  } catch {
    return false
  }
}
export function validEntry(v: unknown): v is PortfolioEntry {
  return (
    record(v) &&
    keys(v, ['id', 'projectId', 'outputId', 'title', 'caption', 'role', 'size']) &&
    isId(v.id) &&
    typeof v.projectId === 'string' &&
    v.projectId.length > 0 &&
    v.projectId.length <= 100 &&
    typeof v.outputId === 'string' &&
    v.outputId.length <= 100 &&
    str(v.title, LIMITS.entryTitle) &&
    str(v.caption, LIMITS.caption) &&
    str(v.role, LIMITS.role) &&
    SIZES.some((s) => s.value === v.size)
  )
}
export function validSection(v: unknown): v is PortfolioSection {
  return (
    record(v) &&
    keys(v, ['id', 'title', 'description', 'entries']) &&
    isId(v.id) &&
    str(v.title, LIMITS.sectionTitle) &&
    str(v.description, LIMITS.sectionDescription) &&
    Array.isArray(v.entries) &&
    v.entries.every(validEntry)
  )
}
export function validPortfolio(v: unknown): v is Portfolio {
  if (
    !record(v) ||
    !keys(v, [
      'version',
      'id',
      'title',
      'tagline',
      'author',
      'intro',
      'links',
      'sections',
      'layout',
      'accent',
      'createdAt',
      'updatedAt',
    ]) ||
    v.version !== 1
  )
    return false
  if (!isId(v.id) || !str(v.title, LIMITS.title)) return false
  if (!str(v.tagline, LIMITS.tagline) || !str(v.author, LIMITS.author)) return false
  if (!str(v.intro, LIMITS.intro)) return false
  if (
    !Array.isArray(v.links) ||
    v.links.length > MAX_LINKS ||
    !v.links.every(
      (l) =>
        record(l) &&
        keys(l, ['label', 'url']) &&
        str(l.label, LIMITS.linkLabel) &&
        (l.url === '' || safeUrl(l.url)),
    )
  )
    return false
  if (!Array.isArray(v.sections) || v.sections.length > MAX_SECTIONS) return false
  if (!v.sections.every(validSection)) return false
  const sections = v.sections as PortfolioSection[]
  if (new Set(sections.map((s) => s.id)).size !== sections.length) return false
  const entries = sections.flatMap((s) => s.entries)
  if (entries.length > MAX_ENTRIES) return false
  if (new Set(entries.map((e) => e.id)).size !== entries.length) return false
  if (!LAYOUTS.some((l) => l.value === v.layout)) return false
  if (typeof v.accent !== 'string' || !/^#[0-9a-f]{6}$/i.test(v.accent)) return false
  return isDate(v.createdAt) && isDate(v.updatedAt)
}
export function validPortfolios(v: unknown): v is Portfolio[] {
  return (
    Array.isArray(v) &&
    v.length <= MAX_PORTFOLIOS &&
    v.every(validPortfolio) &&
    new Set(v.map((p) => p.id)).size === v.length
  )
}
/** Why a portfolio cannot be saved, or '' when it can. */
export function portfolioProblem(portfolio: Portfolio): string {
  if (validPortfolio(portfolio as unknown)) return ''
  if (portfolio.title.length > LIMITS.title)
    return `Keep the portfolio name under ${LIMITS.title} characters.`
  if (portfolio.links.some((l) => l.url && !safeUrl(l.url)))
    return 'Links must start with https://, http://, or mailto:.'
  if (portfolio.sections.flatMap((s) => s.entries).length > MAX_ENTRIES)
    return `A portfolio holds up to ${MAX_ENTRIES} entries.`
  return 'The portfolio could not be saved. Check its fields.'
}

// --- Entries and sections (pure) ------------------------------------------------------------
export const entriesOf = (portfolio: Portfolio): PortfolioEntry[] =>
  portfolio.sections.flatMap((s) => s.entries)
export const includesProject = (portfolio: Portfolio, projectId: string) =>
  entriesOf(portfolio).some((e) => e.projectId === projectId)
const touch = (portfolio: Portfolio, sections: PortfolioSection[]): Portfolio => ({
  ...portfolio,
  sections,
  updatedAt: timestamp(),
})
const sectionOf = (portfolio: Portfolio, entryId: string) =>
  portfolio.sections.find((s) => s.entries.some((e) => e.id === entryId))

/** Add a project (or one of its outputs) to a section, the last one by default. */
export function addEntry(
  portfolio: Portfolio,
  projectId: string,
  outputId = '',
  sectionId?: string,
): Portfolio {
  if (entriesOf(portfolio).some((e) => e.projectId === projectId && e.outputId === outputId))
    throw new Error(
      outputId
        ? 'That output is already in this portfolio.'
        : 'That project is already in this portfolio. Feature one of its outputs to show it again.',
    )
  if (entriesOf(portfolio).length >= MAX_ENTRIES)
    throw new Error(`A portfolio holds up to ${MAX_ENTRIES} entries.`)
  const sections = portfolio.sections.length ? portfolio.sections : [newSection()]
  const target = sections.find((s) => s.id === sectionId) ?? sections[sections.length - 1]
  const entry = newEntry(projectId, outputId)
  return touch(
    portfolio,
    sections.map((s) => (s === target ? { ...s, entries: [...s.entries, entry] } : s)),
  )
}
export function updateEntry(
  portfolio: Portfolio,
  entryId: string,
  patch: Partial<Omit<PortfolioEntry, 'id' | 'projectId'>>,
): Portfolio {
  if (!sectionOf(portfolio, entryId)) throw new Error('That entry is no longer in the portfolio.')
  return touch(
    portfolio,
    portfolio.sections.map((s) => ({
      ...s,
      entries: s.entries.map((e) => (e.id === entryId ? { ...e, ...patch } : e)),
    })),
  )
}
export function removeEntry(portfolio: Portfolio, entryId: string): Portfolio {
  if (!sectionOf(portfolio, entryId)) throw new Error('That entry is no longer in the portfolio.')
  return touch(
    portfolio,
    portfolio.sections.map((s) => ({ ...s, entries: s.entries.filter((e) => e.id !== entryId) })),
  )
}
/** Move an entry up or down within its section; past the edge it crosses into the neighbour. */
export function moveEntry(portfolio: Portfolio, entryId: string, delta: -1 | 1): Portfolio {
  const section = sectionOf(portfolio, entryId)
  if (!section) throw new Error('That entry is no longer in the portfolio.')
  const index = section.entries.findIndex((e) => e.id === entryId)
  const target = index + delta
  if (target >= 0 && target < section.entries.length) {
    const entries = [...section.entries]
    ;[entries[index], entries[target]] = [entries[target], entries[index]]
    return touch(
      portfolio,
      portfolio.sections.map((s) => (s === section ? { ...s, entries } : s)),
    )
  }
  const at = portfolio.sections.indexOf(section)
  const neighbour = portfolio.sections[at + delta]
  if (!neighbour) return portfolio
  const entry = section.entries[index]
  return touch(
    portfolio,
    portfolio.sections.map((s) =>
      s === section
        ? { ...s, entries: s.entries.filter((e) => e.id !== entryId) }
        : s === neighbour
          ? { ...s, entries: delta === 1 ? [entry, ...s.entries] : [...s.entries, entry] }
          : s,
    ),
  )
}
export function moveEntryToSection(
  portfolio: Portfolio,
  entryId: string,
  sectionId: string,
): Portfolio {
  const from = sectionOf(portfolio, entryId)
  const to = portfolio.sections.find((s) => s.id === sectionId)
  if (!from || !to) throw new Error('That entry or section is no longer in the portfolio.')
  if (from === to) return portfolio
  const entry = from.entries.find((e) => e.id === entryId)!
  return touch(
    portfolio,
    portfolio.sections.map((s) =>
      s === from
        ? { ...s, entries: s.entries.filter((e) => e.id !== entryId) }
        : s === to
          ? { ...s, entries: [...s.entries, entry] }
          : s,
    ),
  )
}
export function addSection(portfolio: Portfolio, title = 'New section'): Portfolio {
  if (portfolio.sections.length >= MAX_SECTIONS)
    throw new Error(`A portfolio holds up to ${MAX_SECTIONS} sections.`)
  return touch(portfolio, [...portfolio.sections, newSection(title)])
}
export function updateSection(
  portfolio: Portfolio,
  sectionId: string,
  patch: Partial<Pick<PortfolioSection, 'title' | 'description'>>,
): Portfolio {
  if (!portfolio.sections.some((s) => s.id === sectionId))
    throw new Error('That section is no longer in the portfolio.')
  return touch(
    portfolio,
    portfolio.sections.map((s) => (s.id === sectionId ? { ...s, ...patch } : s)),
  )
}
export function moveSection(portfolio: Portfolio, sectionId: string, delta: -1 | 1): Portfolio {
  const index = portfolio.sections.findIndex((s) => s.id === sectionId)
  const target = index + delta
  if (index < 0 || target < 0 || target >= portfolio.sections.length) return portfolio
  const sections = [...portfolio.sections]
  ;[sections[index], sections[target]] = [sections[target], sections[index]]
  return touch(portfolio, sections)
}
/** Remove a section and the entries it holds. */
export function removeSection(portfolio: Portfolio, sectionId: string): Portfolio {
  if (!portfolio.sections.some((s) => s.id === sectionId))
    throw new Error('That section is no longer in the portfolio.')
  return touch(
    portfolio,
    portfolio.sections.filter((s) => s.id !== sectionId),
  )
}
export function updateLinks(portfolio: Portfolio, links: PortfolioLink[]): Portfolio {
  return { ...portfolio, links: links.slice(0, MAX_LINKS), updatedAt: timestamp() }
}

// --- Resolution against the library ---------------------------------------------------------
export type ResolvedEntry = {
  entry: PortfolioEntry
  project?: Project
  output?: Output
  /** The title and caption shown: the entry's own, else the project's. */
  title: string
  caption: string
  /** Why the entry cannot be presented, or '' when it can. */
  problem: string
}
export function resolveEntry(entry: PortfolioEntry, library: Library): ResolvedEntry {
  const project = library.projects.find((p) => p.id === entry.projectId)
  const output = entry.outputId ? project?.outputs.find((o) => o.id === entry.outputId) : undefined
  const problem = !project
    ? 'This project is no longer in the library.'
    : project.status === 'trashed'
      ? 'This project is in the trash.'
      : entry.outputId && !output
        ? 'The featured output was removed from its project.'
        : ''
  return {
    entry,
    project,
    output,
    title: entry.title.trim() || output?.title || project?.title || 'Untitled',
    caption: entry.caption.trim() || project?.description || '',
    problem,
  }
}
export type ResolvedSection = { section: PortfolioSection; entries: ResolvedEntry[] }
/** Every section with every entry resolved, for the editor. */
export const resolveSections = (portfolio: Portfolio, library: Library): ResolvedSection[] =>
  portfolio.sections.map((section) => ({
    section,
    entries: section.entries.map((entry) => resolveEntry(entry, library)),
  }))
/** Sections with the entries a reader can see: present projects outside the trash. */
export const presentableSections = (portfolio: Portfolio, library: Library): ResolvedSection[] =>
  resolveSections(portfolio, library)
    .map(({ section, entries }) => ({ section, entries: entries.filter((e) => !e.problem) }))
    .filter(({ entries }) => entries.length > 0)
/** "3 projects in 2 sections", for cards and headers. */
export function portfolioSummary(portfolio: Portfolio): string {
  const entries = entriesOf(portfolio).length
  const sections = portfolio.sections.length
  return `${entries} ${entries === 1 ? 'entry' : 'entries'} in ${sections} ${sections === 1 ? 'section' : 'sections'}`
}
/** The introduction as paragraphs. */
export const introParagraphs = (intro: string) =>
  intro
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
