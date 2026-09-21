/** Serializable authoring data. Runtime interaction never writes these definitions. */
export type CosmicClockDefaults = {
  camera: { latitude: number; sunLongitudeOffset: number; distance: number }
  time: { mode: 'live' | 'simulation'; date: string; speed: number; paused: boolean }
  showTimeZones: boolean
}
export type Output = {
  id: string
  type: 'interactive-scene'
  title: string
  description: string
  status: 'draft' | 'ready'
  source: { sceneKind: 'cosmic-clock'; version: 1; defaultState: CosmicClockDefaults }
  metadata: { attribution: string; sourceUrl: string }
}
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
  return (
    typeof value.id === 'string' &&
    /^[a-zA-Z0-9_-]{1,100}$/.test(value.id) &&
    value.type === 'interactive-scene' &&
    text(value.title, 100, true) &&
    text(value.description, 500) &&
    ['draft', 'ready'].includes(value.status as string) &&
    record(source) &&
    keys(source, ['sceneKind', 'version', 'defaultState']) &&
    source.sceneKind === 'cosmic-clock' &&
    source.version === 1 &&
    validDefaults(source.defaultState) &&
    record(metadata) &&
    keys(metadata, ['attribution', 'sourceUrl']) &&
    text(metadata.attribution, 4000) &&
    safeSourceUrl(metadata.sourceUrl)
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
export function earthClockOutput(): Output {
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
