// Links between projects. A project may name related projects (`relatedIds`), and other places
// in the library point at projects by route: collection items, document links, and portfolio
// entries. `backlinks` gathers everything that points at a project, so the overview can show
// where it is referenced from without any of those places knowing about each other. No React.
import type { Library, Project } from './library'

export const PROJECT_ROUTE = /^#\/project\/([A-Za-z0-9_-]{1,40})(?:\/[a-z-]+)*$/
export const projectRoute = (id: string) => `#/project/${id}`
/** The project id a Junga route points at, or null for any other link. */
export const projectIdFromLink = (link: string): string | null =>
  PROJECT_ROUTE.exec(link)?.[1] ?? null
/** A link to a project that works from anywhere the app is hosted, for the clipboard. */
export const absoluteProjectLink = (id: string, location: Location = window.location) =>
  `${location.origin}${location.pathname}${location.search}${projectRoute(id)}`

export type Backlink = {
  kind: 'project' | 'collection' | 'document' | 'portfolio'
  /** The project (or portfolio) that holds the reference. */
  id: string
  title: string
  route: string
  /** What in it points here: an item's title, a linked phrase, a section. */
  detail: string
}

/** The projects this one names as related, in order, that still exist outside the trash. */
export function relatedProjects(library: Library, project: Project): Project[] {
  return (project.relatedIds ?? [])
    .map((id) => library.projects.find((p) => p.id === id))
    .filter((p): p is Project => !!p && p.status !== 'trashed')
}

/** Everything in the library that points at this project, excluding trashed sources. */
export function backlinks(library: Library, project: Project): Backlink[] {
  const links: Backlink[] = []
  const pointsHere = (link: string) => projectIdFromLink(link) === project.id
  for (const other of library.projects) {
    if (other.id === project.id || other.status === 'trashed') continue
    if (other.relatedIds?.includes(project.id))
      links.push({
        kind: 'project',
        id: other.id,
        title: other.title,
        route: projectRoute(other.id),
        detail: 'Related project',
      })
    for (const item of other.collection?.items ?? [])
      if (pointsHere(item.link))
        links.push({
          kind: 'collection',
          id: other.id,
          title: other.title,
          route: `${projectRoute(other.id)}/collection`,
          detail: `Collection item “${item.title}”`,
        })
    const phrases = new Set<string>()
    for (const block of other.document?.blocks ?? [])
      for (const run of block.runs) if (run.link && pointsHere(run.link)) phrases.add(run.text)
    if (phrases.size)
      links.push({
        kind: 'document',
        id: other.id,
        title: other.title,
        route: `${projectRoute(other.id)}/document`,
        detail: `Linked from “${[...phrases][0].trim().slice(0, 60)}”`,
      })
  }
  for (const portfolio of library.portfolios ?? [])
    for (const section of portfolio.sections)
      if (section.entries.some((e) => e.projectId === project.id))
        links.push({
          kind: 'portfolio',
          id: portfolio.id,
          title: portfolio.title.trim() || 'Untitled portfolio',
          route: `#/portfolio/${portfolio.id}`,
          detail: section.title.trim() ? `Section “${section.title}”` : 'Featured',
        })
  return links
}
