import { describe, expect, it } from 'vitest'
import {
  actOnProject,
  addPortfolio,
  addProject,
  addProjectToPortfolio,
  duplicateProject,
  emptyLibrary,
  initializeTools,
  linkProjects,
  parseLibrary,
  saveModuleDocument,
  starterInput,
  unlinkProjects,
} from './library'
import { absoluteProjectLink, backlinks, projectIdFromLink, relatedProjects } from './linking'
import { restoreCopies } from './backup'
import { fromMarkdown, safeLink } from './document/model'
import { blocksToHtml } from './document/html'
import { addItem, emptyCollections, newItem } from './collection/model'

function fixture() {
  const a = addProject(emptyLibrary(), { ...starterInput, title: 'Alpha' })
  const b = addProject(a.library, { ...starterInput, title: 'Beta', tools: ['sheet'] })
  const c = addProject(b.library, {
    title: 'Gamma notes',
    description: '',
    tools: ['document', 'collection'],
    collectionId: null,
    referenceUrl: '',
  })
  return { library: c.library, alpha: a.project, beta: b.project, gamma: c.project }
}

describe('project links', () => {
  it('links and unlinks projects one way, refusing self, missing, and trashed targets', () => {
    const { library, alpha, beta } = fixture()
    let next = linkProjects(library, alpha.id, beta.id)
    expect(next.projects.find((p) => p.id === alpha.id)?.relatedIds).toEqual([beta.id])
    expect(next.projects.find((p) => p.id === beta.id)?.relatedIds).toBeUndefined()
    next = linkProjects(next, alpha.id, beta.id)
    expect(next.projects.find((p) => p.id === alpha.id)?.relatedIds).toEqual([beta.id])
    expect(() => linkProjects(next, alpha.id, alpha.id)).toThrow('itself')
    expect(() => linkProjects(next, alpha.id, 'nope')).toThrow('no longer')
    const trashed = actOnProject(next, beta.id, 'trash')
    expect(() => linkProjects(trashed, alpha.id, beta.id)).toThrow('trash')
    expect(
      relatedProjects(
        trashed,
        trashed.projects.find((p) => p.id === alpha.id)!,
      ),
    ).toEqual([])
    expect(
      relatedProjects(
        next,
        next.projects.find((p) => p.id === alpha.id)!,
      )[0].title,
    ).toBe('Beta')
    const unlinked = unlinkProjects(next, alpha.id, beta.id)
    expect(unlinked.projects.find((p) => p.id === alpha.id)?.relatedIds).toBeUndefined()
    expect(() => parseLibrary(JSON.stringify(next))).not.toThrow()
    expect(() =>
      parseLibrary(
        JSON.stringify({
          ...next,
          projects: next.projects.map((p) =>
            p.id === alpha.id ? { ...p, relatedIds: [alpha.id] } : p,
          ),
        }),
      ),
    ).toThrow('untouched')
  })

  it('gathers backlinks from related projects, collection items, document links, and portfolios', () => {
    const { library, alpha, beta, gamma } = fixture()
    let next = linkProjects(library, beta.id, alpha.id)
    next = initializeTools(next, gamma.id, ['document', 'collection'])
    const doc = fromMarkdown(`See [the alpha model](#/project/${alpha.id}) for the curves.`)
    next = saveModuleDocument(next, gamma.id, 'document', doc)
    let collections = emptyCollections()
    collections = addItem(collections, collections.rootIds[0], {
      ...newItem('Alpha, filed'),
      link: `#/project/${alpha.id}/graph`,
    })
    next = saveModuleDocument(next, gamma.id, 'collection', collections)
    const portfolio = addPortfolio(next, 'Selected')
    next = addProjectToPortfolio(portfolio.library, portfolio.portfolio.id, alpha.id)
    const found = backlinks(
      next,
      next.projects.find((p) => p.id === alpha.id)!,
    )
    expect(found.map((b) => `${b.kind}:${b.title}`).sort()).toEqual([
      'collection:Gamma notes',
      'document:Gamma notes',
      'portfolio:Selected',
      'project:Beta',
    ])
    expect(found.find((b) => b.kind === 'document')?.detail).toBe('Linked from “the alpha model”')
    expect(found.find((b) => b.kind === 'collection')?.detail).toBe(
      'Collection item “Alpha, filed”',
    )
    expect(found.find((b) => b.kind === 'portfolio')?.detail).toBe('Section “Selected work”')
    // Trashed sources drop out.
    const trashed = actOnProject(next, gamma.id, 'trash')
    expect(
      backlinks(
        trashed,
        trashed.projects.find((p) => p.id === alpha.id)!,
      ),
    ).toHaveLength(2)
  })

  it('accepts project routes as document links and opens them in the same tab', () => {
    expect(safeLink('#/project/abc-123')).toBe(true)
    expect(safeLink('#/project/abc-123/graph')).toBe(true)
    expect(safeLink('#/portfolio/abc')).toBe(false)
    expect(safeLink('javascript:alert(1)')).toBe(false)
    const html = blocksToHtml(fromMarkdown('[a](#/project/abc) and [b](https://x.io)').blocks)
    expect(html).toContain('<a href="#/project/abc">a</a>')
    expect(html).toContain('href="https://x.io" target="_blank"')
    expect(projectIdFromLink('#/project/abc/graph')).toBe('abc')
    expect(projectIdFromLink('https://x.io')).toBeNull()
    expect(
      absoluteProjectLink('abc', {
        origin: 'https://site.example',
        pathname: '/junga/',
        search: '',
      } as Location),
    ).toBe('https://site.example/junga/#/project/abc')
  })

  it('copies links with a duplicate and remaps them when restoring copies', () => {
    const { library, alpha, beta } = fixture()
    const linked = linkProjects(library, alpha.id, beta.id)
    const copy = duplicateProject(linked, alpha.id)
    expect(copy.project.relatedIds).toEqual([beta.id])
    const restored = restoreCopies(emptyLibrary(), linked)
    const alphaCopy = restored.projects.find((p) => p.title === 'Alpha')!
    const betaCopy = restored.projects.find((p) => p.title === 'Beta')!
    expect(alphaCopy.relatedIds).toEqual([betaCopy.id])
    expect(betaCopy.id).not.toBe(beta.id)
  })
})
