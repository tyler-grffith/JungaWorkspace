// Registry of workspace modules. The shell (App.tsx) reads names, icons, copy, and routes
// from here instead of branching on tool ids, so a new module is mostly a new entry.
// Editor components and their draft/save plumbing stay explicit in App.tsx because each
// editor's document type and callbacks differ; see docs/ARCHITECTURE.md.
import {
  Code2,
  FileText,
  Layers3,
  Box,
  LibraryBig,
  Printer,
  Shapes,
  SquareFunction,
  Table2,
  type LucideIcon,
} from 'lucide-react'
import type { Tool } from './ids'

export type ModuleDefinition = {
  id: Tool
  /** Short name used in labels, filters, and breadcrumbs. */
  name: string
  /** Full name used on the project overview panel. */
  longName: string
  /** One-sentence purpose shown on the project overview panel. */
  description: string
  /** Button label that opens the editor. Browser tests reference these labels. */
  openLabel: string
  /** Route segment appended to #/project/<id>/ when the editor is open. */
  route: string
  icon: LucideIcon
  cssClass: string
}

export const modules: readonly ModuleDefinition[] = [
  {
    id: 'graph',
    name: 'Graphing',
    longName: 'Graphing calculator',
    description: 'A space to explore functions, parameters, and the shapes they make.',
    openLabel: 'Open calculator',
    route: 'graph',
    icon: SquareFunction,
    cssClass: 'graph',
  },
  {
    id: 'sheet',
    name: 'Spreadsheet',
    longName: 'Spreadsheet',
    description: 'A space to organize values, build formulas, and work through ideas.',
    openLabel: 'Open spreadsheet',
    route: 'sheet',
    icon: Table2,
    cssClass: 'sheet',
  },
  {
    id: 'code',
    name: 'Code',
    longName: 'Code project',
    description: 'A space to write or import files and run them as an output.',
    openLabel: 'Open files',
    route: 'code',
    icon: Code2,
    cssClass: 'code',
  },
  {
    id: 'canvas',
    name: 'Visual canvas',
    longName: 'Visual canvas',
    description:
      'Canvases for slides, diagrams, mockups, and simple animations, organized by how they are used.',
    openLabel: 'Open visual canvas',
    route: 'canvas',
    icon: Shapes,
    cssClass: 'canvas',
  },
  {
    id: 'document',
    name: 'Document',
    longName: 'Document',
    description: 'A space to write and format text with headings, lists, links, and images.',
    openLabel: 'Open document',
    route: 'document',
    icon: FileText,
    cssClass: 'document',
  },
  {
    id: 'collection',
    name: 'Collection',
    longName: 'Collection',
    description: 'Curate nested collections of music, movies, photos, poems, or anything else.',
    openLabel: 'Open collection',
    route: 'collection',
    icon: LibraryBig,
    cssClass: 'collection',
  },
  {
    id: 'modeler',
    name: '3D modeler',
    longName: '3D modeler',
    description:
      'A SolidWorks-style part modeler: sketches, features, and a history tree (prototype).',
    openLabel: 'Open modeler',
    route: 'modeler',
    icon: Box,
    cssClass: 'modeler',
  },
  {
    id: 'slicer',
    name: 'Slicer',
    longName: 'Slicer',
    description: 'A Bambu Studio-style slicer: printer, filament, process, plates (prototype).',
    openLabel: 'Open slicer',
    route: 'slicer',
    icon: Printer,
    cssClass: 'slicer',
  },
]

export const moduleById = Object.fromEntries(modules.map((m) => [m.id, m])) as Record<
  Tool,
  ModuleDefinition
>

/** Combined views that need more than one module in the same project. */
export type CombinedView = {
  id: string
  name: string
  openLabel: string
  route: string
  requires: readonly Tool[]
  icon: LucideIcon
}
export const combinedViews: readonly CombinedView[] = [
  {
    id: 'workspace',
    name: 'Spreadsheet + Graph',
    openLabel: 'Open side by side',
    route: 'workspace',
    requires: ['sheet', 'graph'],
    icon: Layers3,
  },
]

export const availableViews = (tools: readonly Tool[]) =>
  combinedViews.filter((view) => view.requires.every((tool) => tools.includes(tool)))

/** Which module (if any) a project route's trailing segment opens. */
export const moduleForRoute = (route: string, tools: readonly Tool[]) =>
  modules.find((m) => tools.includes(m.id) && route.endsWith(`/${m.route}`)) ?? null
export const combinedViewForRoute = (route: string, tools: readonly Tool[]) =>
  availableViews(tools).find((view) => route.endsWith(`/${view.route}`)) ?? null
