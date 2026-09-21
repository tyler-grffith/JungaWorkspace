// Built-in example projects. The library offers each one with its own button; the
// registry decides where. Add an entry here to ship a new example; see docs/ARCHITECTURE.md.
import { laplaceGraph, type GraphDocument } from '../graph/model'
import type { SheetDocument } from '../sheet/model'
import type { CodeDocument } from '../code/model'
import { octahedronExample, OCTAHEDRON_URL } from '../linked/model'
import { starterInput, starterNotes, type ProjectInput } from '../library'
import type { Tool } from './ids'

export type ExampleProject = {
  id: string
  title: string
  description: string
  buttonLabel: string
  /** `welcome`: the empty-library starter strip. `toolbar`: the library heading actions. */
  placement: 'welcome' | 'toolbar'
  tools: readonly Tool[]
  input: Omit<ProjectInput, 'collectionId'>
  notes: string
  documents: () => { graph?: GraphDocument; sheet?: SheetDocument; code?: CodeDocument }
  /** Where to go after creation: the overview or one combined/module route segment. */
  openRoute: string
  toast?: string
}

export const examples: readonly ExampleProject[] = [
  {
    id: 'laplace',
    title: starterInput.title,
    description: 'Explore the recreated graph with editable functions and sliders.',
    buttonLabel: 'Use this example',
    placement: 'welcome',
    tools: ['graph'],
    input: starterInput,
    notes: starterNotes,
    documents: () => ({ graph: laplaceGraph() }),
    openRoute: '',
    toast: 'LaPlace example project created.',
  },
  {
    id: 'octahedron',
    title: 'Octahedron Sections',
    description: 'Six spreadsheet-driven vertices with s, derived h, and a t slider from 0 to 1.',
    buttonLabel: 'Create octahedron example',
    placement: 'toolbar',
    tools: ['sheet', 'graph'],
    input: {
      title: 'Octahedron Sections',
      description: 'Six spreadsheet-driven vertices with s, derived h, and a t slider from 0 to 1.',
      tools: ['sheet', 'graph'],
      referenceUrl: OCTAHEDRON_URL,
    },
    notes:
      'Recreated from Octahedron Sections (Parameterized Vertex Based).\ns = 5; h = SQRT(3)*s/2; t starts at 0.323 and ranges from 0 to 1.\nThe six rows pair (a,b), (c,d), (f,g), (i,j), (k,l), (m,n). The graph closes the outline from the last point to the first.\nEdit B2 or a coordinate formula, or move the t slider. Named cells and plotted ranges are editable in Link settings.',
    documents: () => {
      const example = octahedronExample()
      return { graph: example.graph, sheet: example.sheet }
    },
    openRoute: 'workspace',
  },
]
