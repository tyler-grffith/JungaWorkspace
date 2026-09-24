// Built-in example projects: one for every kind of project the workspace can hold. Every entry
// is a project that exists in every library whatever the user has saved (`builtins.ts` merges
// them in), listed in the library's Examples folder; the ones named in the design setting
// `library.shortcuts` are also linked from the sidebar. Add an entry here to ship a new example;
// see docs/ARCHITECTURE.md. Never rename an id: the user's edits are stored against it.
import { laplaceGraph } from '../graph/model'
import { octahedronExample, OCTAHEDRON_URL } from '../linked/model'
import {
  cosmicClockSeed,
  starterInput,
  starterNotes,
  type ExampleDocuments,
  type ProjectInput,
} from '../library'
import type { Output, SourceManifest } from '../outputs'
import type { Tool } from './ids'
import { documentModules, isDocumentTool } from './documents'
import { flightEnvelopeGraph, FLIGHT_ENVELOPE_URL } from '../examples/flightEnvelope'
import { octahedronGraph } from '../examples/octahedronGraph'
import { flowCalculatorSheet } from '../examples/flowCalculator'
import { pdrVisualsCanvas, PDR_VISUALS_URL } from '../examples/pdrVisuals'
import {
  preDevelopmentPlanDocument,
  PRE_DEVELOPMENT_PLAN_URL,
} from '../examples/preDevelopmentPlan'
import { workspaceIdeasCollections } from '../examples/workspaceIdeas'
import { bracketModel, bracketPlate } from '../examples/bracket'
import { sunsetReliefPainting } from '../examples/sunsetRelief'
import { orbitSketchCode } from '../examples/orbitSketch'
import { emptySlicer } from '../slicer/model'
import { codeRunOutput } from '../outputs'

export type ExampleProject = {
  /** Stable identifier, stored on the project it creates as `exampleId`. Never rename one. */
  id: string
  title: string
  description: string
  /** Also offered on the empty-library welcome strip. */
  welcome?: boolean
  tools: readonly Tool[]
  input: Omit<ProjectInput, 'collectionId'>
  notes: string
  /** The saved documents the project starts with. Must be quick: it runs on every load. */
  documents: () => ExampleDocuments
  /** Heavy material fetched the first time the project opens (a bundled draw.io file, say). */
  loadDocuments?: () => Promise<ExampleDocuments>
  /** Outputs the project starts with (a reading page, a presentation, a scene). */
  outputs?: () => Output[]
  sourceManifest?: SourceManifest
  /** Where to go after opening: the overview or one combined/module route segment. */
  openRoute: string
}

/** The read-only output a document module publishes, titled for the example. */
const moduleOutput = (tool: Tool, title: string) =>
  isDocumentTool(tool) ? [documentModules[tool].output.make(title)] : []

const cosmicClock = cosmicClockSeed()

export const examples: readonly ExampleProject[] = [
  {
    id: 'laplace',
    title: starterInput.title,
    description: 'Explore the recreated graph with editable functions and sliders.',
    welcome: true,
    tools: ['graph'],
    input: starterInput,
    notes: starterNotes,
    documents: () => ({ graph: laplaceGraph() }),
    openRoute: '',
  },
  {
    id: 'flight-envelope',
    title: 'XJ-1 Flight Envelope',
    description:
      'Power required and power available against ground speed, at sea level and at altitude, from an engineering model built in Desmos.',
    tools: ['graph'],
    input: {
      title: 'XJ-1 Flight Envelope',
      description:
        'A jet aircraft flight envelope in US units: power required and available against ground speed, with the density ratio as the slider.',
      tools: ['graph'],
      referenceUrl: FLIGHT_ENVELOPE_URL,
    },
    notes:
      'Recreated from V2 Jet Aircraft Flight Envelope (XJ-1)(US units).\nThe top-level slider s is for the reader: the air density ratio, 1 at sea level and 0.271 near 38,000 ft. The constants under Parameters are the author’s design point; each is a constant rather than a slider because the reference fixed its bounds.\nP_R is power required, P_A power available, and P_ex their difference. The green verticals mark V min and V max (no excess power) and the speed of best rate of climb, where d(P_ex)/dV = 0.',
    documents: () => ({ graph: flightEnvelopeGraph() }),
    openRoute: 'graph',
  },
  {
    id: 'octahedron-graph',
    title: 'Octahedron Sections (Graph)',
    description:
      'The parameterized octahedron section drawn entirely in the calculator: six vertex points and their outline, with t as the slider.',
    tools: ['graph'],
    input: {
      title: 'Octahedron Sections (Graph)',
      description:
        'A plane section through a regular octahedron, built from parameters, six points, and six segments in the graphing calculator alone.',
      tools: ['graph'],
      referenceUrl: OCTAHEDRON_URL,
    },
    notes:
      'Recreated from Octahedron Sections (Parameterized Vertex Based), the graphing-calculator way: s = 5 is a constant, h = √3·s/2, and t slides from 0 to 1.\nThe twelve coordinate definitions a … n are the reference’s own; each vertex is an ordered pair, and the outline is six segments restricted to the span between their ends.\nThe linked Octahedron Sections example drives the same vertices from a spreadsheet instead.',
    documents: () => ({ graph: octahedronGraph() }),
    openRoute: 'graph',
  },
  {
    id: 'flow-calculator',
    title: 'Compressible Flow Calculator',
    description:
      'Isentropic, normal-shock, oblique-shock, Rayleigh, and Fanno relations from one set of named inputs and a Mach slider.',
    tools: ['sheet'],
    input: {
      title: 'Compressible Flow Calculator',
      description:
        'One set of named inputs (γ, R, T, P, M) drives isentropic, shock, Rayleigh, and Fanno relations and a Prandtl–Meyer table.',
      tools: ['sheet'],
      referenceUrl: '',
    },
    notes:
      'Recreated from the calculator sheet of the compressible-flow workbook (Flow Calculator V2).\nYellow cells are inputs; M and β have sliders. Named cells (gamma, R, T, P, M, beta, cp, a) keep the formulas readable: select a cell to see its formula, or open Link settings to rename them.\nEvery panel recalculates from the same inputs, so raising M past 1 turns on the Mach and Prandtl–Meyer angles and the shock panels.',
    documents: () => ({ sheet: flowCalculatorSheet() }),
    openRoute: 'sheet',
  },
  {
    id: 'octahedron',
    title: 'Octahedron Sections',
    description: 'Six spreadsheet-driven vertices with s, derived h, and a t slider from 0 to 1.',
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
  {
    id: cosmicClock.id,
    title: cosmicClock.input.title,
    description:
      'The bundled Earth clock: its source inventory, assets, licenses, and an interactive scene output.',
    tools: [],
    input: cosmicClock.input,
    notes: '',
    documents: () => ({}),
    outputs: () => cosmicClockSeed().outputs ?? [],
    sourceManifest: cosmicClock.sourceManifest,
    openRoute: '',
  },
  {
    id: 'orbit-sketch',
    title: 'Orbit Sketch',
    description:
      'Three files (HTML, CSS, JavaScript) drawing planets that follow the pointer, run as an output.',
    tools: ['code'],
    input: {
      title: 'Orbit Sketch',
      description:
        'A small vanilla-JavaScript sketch: planets on orbits that lean toward the pointer, run from index.html.',
      tools: ['code'],
      referenceUrl: '',
    },
    notes:
      'Open the files to edit sketch.js (the drawing), style.css (the page), or index.html (the entry). The Run output opens the sketch in a sandboxed frame; re-open it after saving to see a change.\nCosmic Clock is the other code example: a project whose source ships with the app.',
    documents: () => ({ code: orbitSketchCode() }),
    outputs: () => [codeRunOutput('index.html', 'Orbit Sketch')],
    openRoute: 'code',
  },
  {
    id: 'pdr-visuals',
    title: 'PDR Visuals',
    description:
      'A preliminary design review board: mission phases, vehicles, and numbers, imported from the original draw.io file.',
    tools: ['canvas'],
    input: {
      title: 'PDR Visuals',
      description:
        'A preliminary design review board imported from PDR_visuals.drawio: mission phases, vehicles, and their numbers.',
      tools: ['canvas'],
      referenceUrl: PDR_VISUALS_URL,
    },
    notes:
      'Recreated from PDR_visuals.drawio through the canvas module’s draw.io import, so every shape, label, connector, and picture is an editable element. The pictures were downscaled to fit the canvas document budget.\nPan and zoom the board, present it from the canvas output, or export it as SVG, PNG, or PDF.',
    documents: () => ({}),
    loadDocuments: async () => ({ canvas: await pdrVisualsCanvas() }),
    outputs: () => moduleOutput('canvas', 'PDR Visuals'),
    openRoute: 'canvas',
  },
  {
    id: 'pre-development-plan',
    title: 'Pre-Development Plan',
    description: 'The plan this workspace grew from, as a native document with a reading output.',
    tools: ['document'],
    input: {
      title: 'Pre-Development Plan',
      description: 'The Junga Workspace pre-development plan, recreated as a native document.',
      tools: ['document'],
      referenceUrl: PRE_DEVELOPMENT_PLAN_URL,
    },
    notes:
      'Recreated from Pre-Development-Plan [Junga Workspace] in Google Drive. The original stays linked as the reference.\nEdit the page directly; the reading output presents it read-only. Export to Markdown, HTML, or PDF from the document menu.',
    documents: () => ({ document: preDevelopmentPlanDocument() }),
    outputs: () => moduleOutput('document', 'Pre-Development Plan'),
    openRoute: 'document',
  },
  {
    id: 'workspace-ideas',
    title: 'Workspace Ideas',
    description:
      'Nested collections of the mediums, libraries, and hobby libraries the workspace is meant to hold.',
    tools: ['collection'],
    input: {
      title: 'Workspace Ideas',
      description:
        'The ideas behind Junga Workspace, filed as nested collections with status, details, and tags.',
      tools: ['collection'],
      referenceUrl: '',
    },
    notes:
      'Three collections under one root: workspace mediums (from the sub-app list), library ideas, and the hobby libraries from the Pre-Development Plan.\nOpen an item to edit its fields, switch a collection between grid, list, and gallery, or browse read-only from the output.',
    documents: () => ({ collection: workspaceIdeasCollections() }),
    outputs: () => moduleOutput('collection', 'Workspace Ideas'),
    openRoute: 'collection',
  },
  {
    id: 'mounting-bracket',
    title: 'Mounting Bracket',
    description:
      'A part built from a feature history in the modeler, already placed on a print plate in the slicer.',
    tools: ['modeler', 'slicer'],
    input: {
      title: 'Mounting Bracket',
      description:
        'An 80 × 50 mm bracket with a boss, a through hole, four mounting holes, and a slot; sliced beside a calibration cube.',
      tools: ['modeler', 'slicer'],
      referenceUrl: '',
    },
    notes:
      'Modeler: three sketches and eight features rebuild the bracket; suppress one, orbit the part, check Mass Properties, or export STL.\nSlicer: the same bracket is on the plate with a calibration cube. Slice the plate, scrub the layer preview, and export G-code. Send to Slicer in the modeler places a fresh copy.',
    documents: () => {
      const model = bracketModel()
      return { modeler: model, slicer: bracketPlate(model) }
    },
    openRoute: 'modeler',
  },
  {
    id: 'sunset-relief',
    title: 'Sunset Relief',
    description:
      'A painted scene printed as a filament relief: four spools, a swap plan, and a print sheet.',
    tools: ['painter', 'slicer'],
    input: {
      title: 'Sunset Relief',
      description:
        'A sunset over hills painted in four filaments, with the swap plan, print sheet, and a plate to slice it on.',
      tools: ['painter', 'slicer'],
      referenceUrl: '',
    },
    notes:
      'The picture is drawn by the example itself, so nothing has to be uploaded. Drag the swap layers, change a transmission distance, or replace the image with a photo of your own.\nSend to Slicer places the relief on this project’s plate with the swap plan in the plate notes.',
    documents: () => ({
      painter: sunsetReliefPainting(),
      slicer: {
        ...emptySlicer(),
        notes: 'Send to Slicer from the painter places the relief on this plate.',
      },
    }),
    outputs: () => moduleOutput('painter', 'Sunset Relief'),
    openRoute: 'painter',
  },
]
export const exampleById = (id: string) => examples.find((example) => example.id === id)
