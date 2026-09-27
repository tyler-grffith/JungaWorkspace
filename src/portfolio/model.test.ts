import { describe, expect, it } from 'vitest'
import {
  addEntry,
  addSection,
  emptyPortfolio,
  entriesOf,
  moveEntry,
  moveEntryToSection,
  moveSection,
  portfolioProblem,
  presentableSections,
  removeEntry,
  removeSection,
  resolveEntry,
  updateEntry,
  updateLinks,
  validPortfolio,
  validPortfolios,
} from './model'
import {
  actOnProject,
  addModuleOutput,
  addPortfolio,
  addProject,
  addProjectToPortfolio,
  emptyLibrary,
  initializeTools,
  parseLibrary,
  removePortfolio,
  savePortfolio,
  starterInput,
  type Library,
} from '../library'
import { laplaceGraph } from '../graph/model'
import { motionExample } from '../sheet/model'
import { fromMarkdown } from '../document/model'
import { libraryWithDrafts, parseBackup, restoreCopies, serializeBackup } from '../backup'
import { portfolioHtml, portfolioMarkdown } from '../export/portfolio'
import { previewSummary } from '../present/ProjectPreview'
import { mergeBuiltIns } from '../modules/builtins'
import { builtInId } from '../modules/builtins'

/** A library with a graph+sheet project, a document project with a reading output, and a portfolio. */
function fixture() {
  const first = addProject(
    emptyLibrary(),
    { ...starterInput, description: 'Exponentials and sines, combined.' },
    'notes',
    laplaceGraph(),
    motionExample(),
  )
  const second = addProject(
    first.library,
    {
      title: 'Field notes',
      description: 'A short write-up.',
      tools: ['document'],
      collectionId: null,
      referenceUrl: 'https://example.com/notes',
    },
    '',
    undefined,
    undefined,
    undefined,
    { document: fromMarkdown('# Field notes\n\nA paragraph about the field.') },
  )
  let library = initializeTools(second.library, second.project.id, ['document'])
  library = addModuleOutput(library, second.project.id, 'document', 'Field notes reading')
  const output = library.projects.find((p) => p.id === second.project.id)!.outputs[0]
  const created = addPortfolio(library, 'Selected work', { author: 'Tyler' })
  library = created.library
  library = addProjectToPortfolio(library, created.portfolio.id, first.project.id)
  library = addProjectToPortfolio(
    library,
    created.portfolio.id,
    second.project.id,
    undefined,
    output.id,
  )
  const portfolio = library.portfolios![0]
  return { library, portfolio, graphProject: first.project, docProject: second.project, output }
}
const portfolioOf = (library: Library, id: string) => library.portfolios!.find((p) => p.id === id)!

describe('portfolio model', () => {
  it('starts valid with one section and rejects malformed portfolios', () => {
    const portfolio = emptyPortfolio('Mine', { author: 'Me', accent: '#112233', layout: 'rows' })
    expect(validPortfolio(portfolio)).toBe(true)
    expect(portfolio.sections).toHaveLength(1)
    expect(portfolioProblem(portfolio)).toBe('')
    expect(validPortfolio({ ...portfolio, accent: 'green' })).toBe(false)
    expect(validPortfolio({ ...portfolio, layout: 'masonry' })).toBe(false)
    expect(validPortfolio({ ...portfolio, links: [{ label: 'x', url: 'javascript:1' }] })).toBe(
      false,
    )
    expect(validPortfolio({ ...portfolio, links: [{ label: '', url: 'mailto:me@x.io' }] })).toBe(
      true,
    )
    expect(validPortfolio({ ...portfolio, extra: 1 })).toBe(false)
    expect(validPortfolio({ ...portfolio, title: 'x'.repeat(101) })).toBe(false)
    expect(portfolioProblem({ ...portfolio, title: 'x'.repeat(101) })).toContain('under 100')
    // An empty title is allowed while typing; the page shows a placeholder instead.
    expect(validPortfolio({ ...portfolio, title: '' })).toBe(true)
    expect(validPortfolios([portfolio, { ...portfolio }])).toBe(false)
    expect(validPortfolios([portfolio, emptyPortfolio('Other')])).toBe(true)
  })

  it('adds, edits, moves, and removes entries and sections, refusing a repeated feature', () => {
    let p = emptyPortfolio('Mine')
    p = addEntry(p, 'a')
    p = addEntry(p, 'b')
    p = addEntry(p, 'a', 'out-1')
    expect(entriesOf(p).map((e) => `${e.projectId}/${e.outputId}`)).toEqual(['a/', 'b/', 'a/out-1'])
    expect(() => addEntry(p, 'a')).toThrow('already in this portfolio')
    expect(() => addEntry(p, 'a', 'out-1')).toThrow('already in this portfolio')
    p = addSection(p, 'Earlier')
    expect(p.sections.map((s) => s.title)).toEqual(['Selected work', 'Earlier'])
    p = addEntry(p, 'c', '', p.sections[1].id)
    expect(p.sections[1].entries.map((e) => e.projectId)).toEqual(['c'])
    const b = p.sections[0].entries[1]
    p = moveEntry(p, b.id, -1)
    expect(p.sections[0].entries.map((e) => e.projectId)).toEqual(['b', 'a', 'a'])
    // Past the end of a section, an entry crosses into the next one.
    const lastA = p.sections[0].entries[2]
    p = moveEntry(p, lastA.id, 1)
    expect(p.sections[0].entries.map((e) => e.projectId)).toEqual(['b', 'a'])
    expect(p.sections[1].entries.map((e) => e.projectId)).toEqual(['a', 'c'])
    p = moveEntryToSection(p, lastA.id, p.sections[0].id)
    expect(p.sections[0].entries.map((e) => e.projectId)).toEqual(['b', 'a', 'a'])
    p = updateEntry(p, b.id, { title: 'B, featured', role: '2026', size: 'wide' })
    expect(p.sections[0].entries[0]).toMatchObject({ title: 'B, featured', size: 'wide' })
    p = moveSection(p, p.sections[1].id, -1)
    expect(p.sections.map((s) => s.title)).toEqual(['Earlier', 'Selected work'])
    p = removeEntry(p, b.id)
    expect(entriesOf(p)).toHaveLength(3)
    p = removeSection(p, p.sections[0].id)
    expect(p.sections).toHaveLength(1)
    expect(entriesOf(p)).toHaveLength(2)
    expect(() => removeEntry(p, 'nope')).toThrow('no longer')
    p = updateLinks(p, [{ label: 'Site', url: 'https://example.com' }])
    expect(validPortfolio(p)).toBe(true)
    expect(p.links).toHaveLength(1)
  })

  it('lives on the library, saves through validation, and keeps titles unique', () => {
    const { library, portfolio } = fixture()
    expect(library.portfolios).toHaveLength(1)
    expect(entriesOf(portfolio)).toHaveLength(2)
    expect(() => addPortfolio(library, 'selected WORK')).toThrow('already exists')
    const other = addPortfolio(library, 'Other')
    expect(() =>
      savePortfolio(other.library, { ...other.portfolio, title: 'Selected work' }),
    ).toThrow('already exists')
    const saved = savePortfolio(other.library, { ...other.portfolio, title: '' })
    expect(portfolioOf(saved, other.portfolio.id).title).toBe('')
    expect(() => savePortfolio(library, { ...portfolio, accent: 'bad' })).toThrow()
    expect(() => savePortfolio(library, { ...portfolio, id: 'missing' })).toThrow('no longer')
    const removed = removePortfolio(library, portfolio.id)
    expect(removed.portfolios).toEqual([])
    expect(removed.projects).toHaveLength(2)
    expect(() => removePortfolio(removed, portfolio.id)).toThrow('no longer')
  })

  it('adds projects and outputs from the library, refusing trashed projects and unknown outputs', () => {
    const { library, portfolio, graphProject, docProject } = fixture()
    expect(() => addProjectToPortfolio(library, portfolio.id, graphProject.id)).toThrow(
      'already in this portfolio',
    )
    expect(() =>
      addProjectToPortfolio(library, portfolio.id, docProject.id, undefined, 'nope'),
    ).toThrow('no longer available')
    const trashed = actOnProject(library, graphProject.id, 'trash')
    expect(() =>
      addProjectToPortfolio(trashed, portfolio.id, graphProject.id, undefined, ''),
    ).toThrow('trash')
    expect(() => addProjectToPortfolio(library, 'nope', graphProject.id)).toThrow('no longer')
    // Built-in examples can be featured; their ids are stable across libraries.
    const merged = mergeBuiltIns(library)
    const withExample = addProjectToPortfolio(merged, portfolio.id, builtInId('laplace'))
    expect(entriesOf(portfolioOf(withExample, portfolio.id))).toHaveLength(3)
  })

  it('survives the strict parser and older libraries keep loading without portfolios', () => {
    const { library } = fixture()
    const parsed = parseLibrary(JSON.stringify(library))
    expect(parsed.portfolios).toEqual(library.portfolios)
    expect(parseLibrary(JSON.stringify(emptyLibrary())).portfolios).toBeUndefined()
    expect(() => parseLibrary(JSON.stringify({ ...library, portfolios: [{ id: 'x' }] }))).toThrow(
      'untouched',
    )
    expect(() =>
      parseLibrary(
        JSON.stringify({
          ...library,
          portfolios: [...library.portfolios!, ...library.portfolios!],
        }),
      ),
    ).toThrow('untouched')
  })

  it('resolves entries against the library and hides trashed or missing projects from readers', () => {
    const { library, portfolio, graphProject, docProject, output } = fixture()
    const [first, second] = entriesOf(portfolio)
    expect(resolveEntry(first, library)).toMatchObject({
      title: 'LaPlace Intuition',
      caption: 'Exponentials and sines, combined.',
      problem: '',
    })
    expect(resolveEntry(second, library)).toMatchObject({
      title: 'Field notes reading',
      problem: '',
    })
    expect(resolveEntry(second, library).output?.id).toBe(output.id)
    const trashed = actOnProject(library, graphProject.id, 'trash')
    expect(resolveEntry(first, trashed).problem).toContain('trash')
    expect(presentableSections(portfolio, trashed)[0].entries.map((e) => e.project?.id)).toEqual([
      docProject.id,
    ])
    const gone = { ...library, projects: library.projects.filter((p) => p.id !== docProject.id) }
    expect(resolveEntry(second, gone).problem).toContain('no longer')
    const noOutput = {
      ...library,
      projects: library.projects.map((p) => (p.id === docProject.id ? { ...p, outputs: [] } : p)),
    }
    expect(resolveEntry(second, noOutput).problem).toContain('output was removed')
    expect(presentableSections(emptyPortfolio('Empty'), library)).toEqual([])
  })

  it('rides along in backups, restores as copies pointing at the copied projects, and overlays drafts', () => {
    const { library, portfolio, graphProject, output } = fixture()
    const backup = parseBackup(serializeBackup(library))
    expect(backup.library.portfolios).toEqual(library.portfolios)
    expect(parseBackup(JSON.stringify(emptyLibrary())).library.portfolios).toBeUndefined()
    const restored = restoreCopies(library, backup.library)
    expect(restored.portfolios).toHaveLength(2)
    const copy = restored.portfolios![1]
    expect(copy.id).not.toBe(portfolio.id)
    expect(copy.title).toBe('Selected work (restored)')
    const copiedGraph = restored.projects.find((p) => p.title === 'LaPlace Intuition (restored)')!
    expect(copy.sections[0].entries[0].projectId).toBe(copiedGraph.id)
    expect(copy.sections[0].entries[0].projectId).not.toBe(graphProject.id)
    const copiedDoc = restored.projects.find((p) => p.title === 'Field notes (restored)')!
    expect(copy.sections[0].entries[1].outputId).toBe(copiedDoc.outputs[0].id)
    expect(copy.sections[0].entries[1].outputId).not.toBe(output.id)
    expect(() => parseLibrary(JSON.stringify(restored))).not.toThrow()
    // A library without portfolios restoring a backup without them stays without the key.
    expect(restoreCopies(emptyLibrary(), emptyLibrary()).portfolios).toBeUndefined()
    const draft = { ...portfolio, tagline: 'Unsaved tagline' }
    const overlaid = libraryWithDrafts(library, { portfolio: { id: portfolio.id, value: draft } })
    expect(overlaid.portfolios![0].tagline).toBe('Unsaved tagline')
    expect(library.portfolios![0].tagline).toBe('')
  })

  it('exports a standalone page with figures and a Markdown outline', () => {
    const { library, portfolio, docProject } = fixture()
    const tagged = savePortfolio(library, {
      ...portfolio,
      tagline: 'Things I made',
      intro: 'First paragraph.\n\nSecond paragraph.',
      links: [{ label: 'Site', url: 'https://example.com' }],
    })
    const html = portfolioHtml(portfolioOf(tagged, portfolio.id), tagged)
    expect(html).toContain('<title>Selected work · Tyler</title>')
    expect(html).toContain('<h1>Selected work</h1>')
    expect(html).toContain('Things I made')
    expect(html).toContain('<p>First paragraph.</p><p>Second paragraph.</p>')
    expect(html).toContain('href="https://example.com"')
    expect(html).toContain('aria-label="Graph: LaPlace Intuition"')
    expect(html).toContain('Field notes reading')
    expect(html).toContain('class="pf-doc"')
    expect(html).toContain('href="https://example.com/notes"')
    expect(html).not.toContain('#/project/')
    expect(html).toContain('.pf-page {')
    const markdown = portfolioMarkdown(portfolioOf(tagged, portfolio.id), tagged)
    expect(markdown).toContain('# Selected work')
    expect(markdown).toContain('*Things I made*')
    expect(markdown).toContain('## Selected work')
    expect(markdown).toContain('### LaPlace Intuition')
    expect(markdown).toContain('### Field notes reading')
    expect(markdown).toContain('Reference: https://example.com/notes')
    // Trashed projects leave the exports.
    const trashed = actOnProject(tagged, docProject.id, 'trash')
    expect(portfolioHtml(portfolioOf(trashed, portfolio.id), trashed)).not.toContain(
      'Field notes reading',
    )
  })

  it('summarizes what a figure shows', () => {
    const { library, graphProject, docProject, output } = fixture()
    const graph = library.projects.find((p) => p.id === graphProject.id)!
    expect(previewSummary(graph)).toBe('5 curves · 2 sliders')
    expect(previewSummary({ ...graph, tools: ['sheet'] })).toMatch(/filled cells · 50 × 12$/)
    const doc = library.projects.find((p) => p.id === docProject.id)!
    expect(previewSummary(doc, output)).toBe('7 words')
  })
})
