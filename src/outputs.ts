import { normalizePath } from './code/model'

/** Serializable authoring data. Runtime interaction never writes these definitions. */
export type CosmicClockDefaults = {
  camera: { latitude: number; sunLongitudeOffset: number; distance: number }
  time: { mode: 'live' | 'simulation'; date: string; speed: number; paused: boolean }
  showTimeZones: boolean
}
type OutputBase = {
  id: string
  title: string
  description: string
  status: 'draft' | 'ready'
  metadata: { attribution: string; sourceUrl: string }
}
/** An experience built into the app, configured by authored defaults. */
export type SceneOutput = OutputBase & {
  type: 'interactive-scene'
  source: { sceneKind: 'cosmic-clock'; version: 1; defaultState: CosmicClockDefaults }
}
/** The project's own files, run in a sandboxed frame from the named entry document. */
export type CodeRunOutput = OutputBase & {
  type: 'code-run'
  source: { kind: 'project-files'; version: 1; entry: string }
}
/** The project's canvas pages, presented read-only with keyboard navigation. */
export type CanvasShowOutput = OutputBase & {
  type: 'canvas-show'
  source: { kind: 'canvas-pages'; version: 1; startPage: string; loop: boolean }
}
/** The project's document, presented read-only as a reading page. */
export type DocumentReadOutput = OutputBase & {
  type: 'document-read'
  source: { kind: 'document'; version: 1; showOutline: boolean }
}
/** The project's collections, browsed read-only from a starting collection. */
export type CollectionBrowseOutput = OutputBase & {
  type: 'collection-browse'
  source: { kind: 'collections'; version: 1; startId: string }
}
/** The project's 3D model, shown read-only in the modeler viewport. */
export type ModelerViewOutput = OutputBase & {
  type: 'modeler-view'
  source: { kind: 'model'; version: 1 }
}
/** The project's print plate, shown read-only in the slicer viewport. */
export type SlicerViewOutput = OutputBase & {
  type: 'slicer-view'
  source: { kind: 'plate'; version: 1 }
}
/** The project's filament painting with its swap plan, shown read-only. */
export type PainterViewOutput = OutputBase & {
  type: 'painter-view'
  source: { kind: 'painting'; version: 1 }
}
export type Output =
  | SceneOutput
  | CodeRunOutput
  | CanvasShowOutput
  | DocumentReadOutput
  | CollectionBrowseOutput
  | ModelerViewOutput
  | SlicerViewOutput
  | PainterViewOutput
export const isCollectionBrowse = (output: Output): output is CollectionBrowseOutput =>
  output.type === 'collection-browse'
export const isDocumentRead = (output: Output): output is DocumentReadOutput =>
  output.type === 'document-read'
export const isCanvasShow = (output: Output): output is CanvasShowOutput =>
  output.type === 'canvas-show'
export const isCodeRun = (output: Output): output is CodeRunOutput => output.type === 'code-run'
export type SourceManifest = { kind: 'cosmic-clock'; version: 1 }
export const MIN_SCENE_DATE = Date.UTC(1970, 0, 1)
export const MAX_SCENE_DATE = Date.UTC(2101, 0, 1) - 1
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
const keys = (value: Record<string, unknown>, names: string[]) =>
  Object.keys(value).length === names.length && names.every((name) => name in value)
const text = (value: unknown, max: number, required = false) =>
  typeof value === 'string' && value.length <= max && (!required || value.trim().length > 0)
const number = (value: unknown, min: number, max: number) =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
export function safeSourceUrl(value: unknown): value is string {
  if (!text(value, 2000)) return false
  if (value === '') return true
  try {
    return ['https:', 'http:'].includes(new URL(value as string).protocol)
  } catch {
    return false
  }
}
export function validDefaults(value: unknown): value is CosmicClockDefaults {
  if (!record(value) || !keys(value, ['camera', 'time', 'showTimeZones'])) return false
  const { camera, time } = value
  return (
    record(camera) &&
    keys(camera, ['latitude', 'sunLongitudeOffset', 'distance']) &&
    number(camera.latitude, -75, 75) &&
    number(camera.sunLongitudeOffset, -180, 180) &&
    number(camera.distance, 2.05, 6) &&
    record(time) &&
    keys(time, ['mode', 'date', 'speed', 'paused']) &&
    ['live', 'simulation'].includes(time.mode as string) &&
    typeof time.date === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(time.date) &&
    number(Date.parse(time.date), MIN_SCENE_DATE, MAX_SCENE_DATE) &&
    new Date(time.date).toISOString() === time.date &&
    number(time.speed, 1, 86400) &&
    typeof time.paused === 'boolean' &&
    (time.mode !== 'live' || (time.speed === 1 && !time.paused)) &&
    typeof value.showTimeZones === 'boolean'
  )
}
export function validOutput(value: unknown): value is Output {
  if (
    !record(value) ||
    !keys(value, ['id', 'type', 'title', 'description', 'status', 'source', 'metadata'])
  )
    return false
  const { source, metadata } = value
  const shared =
    typeof value.id === 'string' &&
    /^[a-zA-Z0-9_-]{1,100}$/.test(value.id) &&
    text(value.title, 100, true) &&
    text(value.description, 500) &&
    ['draft', 'ready'].includes(value.status as string) &&
    record(metadata) &&
    keys(metadata, ['attribution', 'sourceUrl']) &&
    text(metadata.attribution, 4000) &&
    safeSourceUrl(metadata.sourceUrl)
  if (!shared || !record(source)) return false
  if (value.type === 'modeler-view')
    return keys(source, ['kind', 'version']) && source.kind === 'model' && source.version === 1
  if (value.type === 'slicer-view')
    return keys(source, ['kind', 'version']) && source.kind === 'plate' && source.version === 1
  if (value.type === 'painter-view')
    return keys(source, ['kind', 'version']) && source.kind === 'painting' && source.version === 1
  if (value.type === 'collection-browse')
    return (
      keys(source, ['kind', 'version', 'startId']) &&
      source.kind === 'collections' &&
      source.version === 1 &&
      typeof source.startId === 'string' &&
      /^[A-Za-z0-9_-]{0,40}$/.test(source.startId)
    )
  if (value.type === 'document-read')
    return (
      keys(source, ['kind', 'version', 'showOutline']) &&
      source.kind === 'document' &&
      source.version === 1 &&
      typeof source.showOutline === 'boolean'
    )
  if (value.type === 'canvas-show')
    return (
      keys(source, ['kind', 'version', 'startPage', 'loop']) &&
      source.kind === 'canvas-pages' &&
      source.version === 1 &&
      typeof source.startPage === 'string' &&
      /^[A-Za-z0-9_-]{0,40}$/.test(source.startPage) &&
      typeof source.loop === 'boolean'
    )
  if (value.type === 'code-run')
    return (
      keys(source, ['kind', 'version', 'entry']) &&
      source.kind === 'project-files' &&
      source.version === 1 &&
      typeof source.entry === 'string' &&
      normalizePath(source.entry) === source.entry
    )
  return (
    value.type === 'interactive-scene' &&
    keys(source, ['sceneKind', 'version', 'defaultState']) &&
    source.sceneKind === 'cosmic-clock' &&
    source.version === 1 &&
    validDefaults(source.defaultState)
  )
}
export function validOutputs(value: unknown): value is Output[] {
  return (
    Array.isArray(value) &&
    value.length <= 20 &&
    value.every(validOutput) &&
    new Set(value.map((output) => output.id)).size === value.length
  )
}
export function validManifest(value: unknown): value is SourceManifest {
  return (
    record(value) &&
    keys(value, ['kind', 'version']) &&
    value.kind === 'cosmic-clock' &&
    value.version === 1
  )
}
export function earthClockOutput(): SceneOutput {
  return {
    id: crypto.randomUUID(),
    type: 'interactive-scene',
    title: 'Earth Clock',
    description: 'Explore a living Earth, its sunlit edge, and the local time in every time zone.',
    status: 'ready',
    source: {
      sceneKind: 'cosmic-clock',
      version: 1,
      defaultState: {
        camera: { latitude: 20, sunLongitudeOffset: 57, distance: 3.6 },
        time: { mode: 'live', date: new Date().toISOString(), speed: 1, paused: false },
        showTimeZones: true,
      },
    },
    metadata: {
      attribution:
        'NASA Blue Marble and Black Marble imagery. Timezone Boundary Builder 2026d, © OpenStreetMap contributors, ODbL 1.0. p5.js (LGPL-2.1), Astronomy Engine (MIT), DM fonts and Instrument Serif (OFL).',
      sourceUrl: 'https://www.figma.com/design/RYHxY6TlREXHVtGa6GwZSa/Clock-Mockup',
    },
  }
}

export function modelerViewOutput(title = 'Model'): ModelerViewOutput {
  return {
    id: crypto.randomUUID(),
    type: 'modeler-view',
    title,
    description: 'Shows this project\u2019s model read-only.',
    status: 'draft',
    source: { kind: 'model', version: 1 },
    metadata: { attribution: '', sourceUrl: '' },
  }
}
export function painterViewOutput(title = 'Print sheet'): PainterViewOutput {
  return {
    id: crypto.randomUUID(),
    type: 'painter-view',
    title,
    description: 'Shows this project\u2019s filament painting and swap plan read-only.',
    status: 'draft',
    source: { kind: 'painting', version: 1 },
    metadata: { attribution: '', sourceUrl: '' },
  }
}
export function slicerViewOutput(title = 'Print plate'): SlicerViewOutput {
  return {
    id: crypto.randomUUID(),
    type: 'slicer-view',
    title,
    description: 'Shows this project\u2019s print plate read-only.',
    status: 'draft',
    source: { kind: 'plate', version: 1 },
    metadata: { attribution: '', sourceUrl: '' },
  }
}

/** A new output that presents the project's collections as a browsing page. */
export function collectionBrowseOutput(title = 'Collections'): CollectionBrowseOutput {
  return {
    id: crypto.randomUUID(),
    type: 'collection-browse',
    title,
    description: 'Presents this project\u2019s collections to browse.',
    status: 'draft',
    source: { kind: 'collections', version: 1, startId: '' },
    metadata: { attribution: '', sourceUrl: '' },
  }
}

/** A new output that presents the project's document as a reading page. */
export function documentReadOutput(title = 'Document'): DocumentReadOutput {
  return {
    id: crypto.randomUUID(),
    type: 'document-read',
    title,
    description: 'Presents this project\u2019s document as a reading page.',
    status: 'draft',
    source: { kind: 'document', version: 1, showOutline: true },
    metadata: { attribution: '', sourceUrl: '' },
  }
}

/** A new output that presents the project's canvas pages from the first page. */
export function canvasShowOutput(title = 'Presentation'): CanvasShowOutput {
  return {
    id: crypto.randomUUID(),
    type: 'canvas-show',
    title,
    description: 'Presents this project\u2019s canvas pages full screen.',
    status: 'draft',
    source: { kind: 'canvas-pages', version: 1, startPage: '', loop: false },
    metadata: { attribution: '', sourceUrl: '' },
  }
}

/** A new output that runs the project's own files. */
export function codeRunOutput(entry: string, title = 'Run output'): CodeRunOutput {
  return {
    id: crypto.randomUUID(),
    type: 'code-run',
    title,
    description: 'Runs this project\u2019s files in a sandboxed frame.',
    status: 'draft',
    source: { kind: 'project-files', version: 1, entry },
    metadata: { attribution: '', sourceUrl: '' },
  }
}
