import type { CosmicClockDefaults } from '../../outputs'
export type Snapshot = {
  ready: boolean
  error: string
  timestamp: number
  live: boolean
  paused: boolean
  speed: number
  showZones: boolean
  pinned: boolean
  hovered: boolean
  zoneName: string
  zoneId: string
  local: { time: string; date: string; offset: string }
  hint: string
  daylight: string
  zones: string[]
  pointer: number[] | null
}
export type SceneController = {
  dispose(): void
  live(): void
  pause(): void
  speed(value: number): void
  date(value: number): void
  toggleZones(): void
  reset(): void
  selectZone(value: string): void
  unpin(): void
}
export function mountScene(
  element: HTMLElement,
  defaults: CosmicClockDefaults,
  update: (snapshot: Snapshot) => void,
): SceneController
