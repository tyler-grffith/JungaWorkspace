// Collection example: the ideas behind Junga Workspace, filed as nested collections. The
// mediums come from the owner's sub-app list, the library ideas from the library-ideas note,
// and the hobby libraries from the Pre-Development Plan.
import {
  newCollection,
  newItem,
  type Collection,
  type CollectionDocument,
  type Item,
} from '../collection/model'

type Seed = { title: string; subtitle?: string; status: string; details: string; tags: string[] }

function fill(collection: Collection, seeds: Seed[], items: Item[]) {
  const status = collection.fields.find((f) => f.name === 'Status')!.id
  const details = collection.fields.find((f) => f.name === 'Details')!.id
  const tags = collection.fields.find((f) => f.name === 'Tags')!.id
  for (const seed of seeds) {
    const item = newItem(seed.title)
    item.subtitle = seed.subtitle ?? ''
    item.fields = { [status]: seed.status, [details]: seed.details, [tags]: seed.tags }
    items.push(item)
    collection.itemIds.push(item.id)
  }
}

export function workspaceIdeasCollections(): CollectionDocument {
  const items: Item[] = []
  const root = newCollection('ideas', 'Junga Workspace ideas')
  root.description =
    'Everything the workspace is meant to become: the mediums it hosts, the libraries it keeps, and the hobby libraries it was first imagined for.'
  root.emoji = '🌱'

  const mediums = newCollection('ideas', 'Workspace mediums')
  mediums.description = 'One sub-app per medium, all under the same project manager shell.'
  mediums.emoji = '🧰'
  mediums.layout = 'grid'
  fill(
    mediums,
    [
      {
        title: 'Spreadsheet',
        status: 'Built',
        details: 'Cells, formulas, named cells, sliders; links to the graph.',
        tags: ['sheet', 'mvp'],
      },
      {
        title: 'Graphing calculator',
        status: 'Built',
        details: 'Functions, parameters, points, implicit equations, labels.',
        tags: ['graph', 'mvp'],
      },
      {
        title: 'Text',
        subtitle: 'Document module',
        status: 'Built',
        details: 'A Docs-style page with headings, lists, links, and images.',
        tags: ['document'],
      },
      {
        title: 'Diagram',
        subtitle: 'Visual canvas',
        status: 'Built',
        details: 'Boards and mockups; draw.io files import as editable elements.',
        tags: ['canvas'],
      },
      {
        title: 'Presentation',
        subtitle: 'Visual canvas',
        status: 'Built',
        details: 'Decks with build steps and transitions, presented from an output.',
        tags: ['canvas'],
      },
      {
        title: '3D modeler',
        status: 'Built',
        details: 'Sketches and features rebuilt into real meshes; STL out.',
        tags: ['modeler'],
      },
      {
        title: 'Slicer',
        status: 'Built',
        details: 'Plates, toolpaths, G-code; a simulated printer.',
        tags: ['slicer'],
      },
      {
        title: 'Photos',
        status: 'Planned',
        details: 'A photo library needs an asset store first.',
        tags: ['collection', 'later'],
      },
      {
        title: 'Code',
        subtitle: 'p5.js and the web',
        status: 'Built',
        details: 'Files run in a sandboxed frame; Cosmic Clock is the bundled example.',
        tags: ['code'],
      },
    ],
    items,
  )

  const libraries = newCollection('ideas', 'Library ideas')
  libraries.description = 'Libraries the workspace should keep and present.'
  libraries.emoji = '📚'
  fill(
    libraries,
    [
      {
        title: 'Knowledge library',
        status: 'Idea',
        details: 'A compact, referenceable library of formulas, style, and facts.',
        tags: ['reference'],
      },
      {
        title: 'Portfolio management',
        status: 'Idea',
        details: 'Select and order projects with presentation metadata; export as a site.',
        tags: ['export'],
      },
      {
        title: 'Blog management',
        status: 'Idea',
        details: 'A dated, tagged list with rich text, in-app and exported.',
        tags: ['export'],
      },
      {
        title: 'Resume and cover letter builder',
        status: 'Idea',
        details: 'Documents assembled from the library itself.',
        tags: ['document'],
      },
    ],
    items,
  )

  const hobbies = newCollection('ideas', 'Hobby libraries')
  hobbies.description =
    'Collect, browse, and search an organized set of files in a blog format, as lists or lists with preview images.'
  hobbies.emoji = '🎞️'
  fill(
    hobbies,
    [
      {
        title: 'Photo library',
        status: 'Idea',
        details: 'Photos with places and dates; a gallery layout.',
        tags: ['photos'],
      },
      {
        title: 'Movie library',
        status: 'Idea',
        details: 'Not the movies themselves: names, images, and my thoughts on them.',
        tags: ['movies'],
      },
      {
        title: 'Ideas',
        status: 'Started',
        details: 'This collection is the first one.',
        tags: ['ideas'],
      },
    ],
    items,
  )

  root.childIds = [mediums.id, libraries.id, hobbies.id]
  return { version: 1, rootIds: [root.id], collections: [root, mediums, libraries, hobbies], items }
}
