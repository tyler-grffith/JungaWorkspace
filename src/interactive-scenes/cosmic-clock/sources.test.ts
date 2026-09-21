import { describe, expect, it } from 'vitest'
import { cosmicClockManifest } from './manifest'
import { materialFor } from './sources'

describe('bundled source material', () => {
  it('can show every file the manifest lists', () => {
    const unavailable = cosmicClockManifest
      .flatMap((group) => group.entries)
      .filter((entry) => materialFor(entry.path) === null)
      .map((entry) => entry.path)
    expect(unavailable).toEqual([])
  })
  it('reads application source from the bundle and assets from their served URL', async () => {
    const module = materialFor('src/interactive-scenes/cosmic-clock/math.js')
    expect(module?.kind).toBe('source')
    expect(module?.kind === 'source' && (await module.load())).toContain('export')
    const shell = materialFor('src/outputs.ts')
    expect(shell?.kind).toBe('source')
    expect(materialFor('public/assets/cosmic-clock/CREDITS.md')).toEqual({
      kind: 'text',
      url: '/assets/cosmic-clock/CREDITS.md',
    })
    expect(materialFor('public/assets/cosmic-clock/earth-day.jpg')).toEqual({
      kind: 'image',
      url: '/assets/cosmic-clock/earth-day.jpg',
    })
  })
  it('reports a file it cannot show rather than guessing a URL', () => {
    expect(materialFor('src/library.ts')).toBeNull()
    expect(materialFor('elsewhere/notes.txt')).toBeNull()
  })
  it('keeps test files out of the bundle, whatever their extension', () => {
    // A leaked test file ships to the website inside the production build.
    expect(materialFor('src/interactive-scenes/cosmic-clock/sources.test.ts')).toBeNull()
    expect(materialFor('src/interactive-scenes/cosmic-clock/clock.test.js')).toBeNull()
  })
})
