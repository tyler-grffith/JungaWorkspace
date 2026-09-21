import { describe, expect, it } from 'vitest'
import {
  actOnProject,
  addEarthClock,
  addProject,
  commitLibrary,
  createCosmicClock,
  duplicateProject,
  editProject,
  emptyLibrary,
  parseLibrary,
  saveOutput,
  starterInput,
  type Library,
} from './library'
import { parseBackup, restoreBackup, restoreCopies, serializeBackup } from './backup'
import { earthClockOutput, validOutput } from './outputs'

function store(library: Library) {
  let raw = JSON.stringify(library),
    writes = 0
  return {
    getItem: () => raw,
    setItem: (_key: string, value: string) => {
      raw = value
      writes++
    },
    get writes() {
      return writes
    },
  }
}
describe('code projects and owned outputs', () => {
  it('upgrades unchanged legacy library and backup data without writing on read', () => {
    const original = addProject(emptyLibrary(), starterInput, 'Keep notes').library
    const legacy = JSON.parse(JSON.stringify(original))
    delete legacy.projects[0].projectType
    delete legacy.projects[0].outputs
    const raw = JSON.stringify(legacy)
    const migrated = parseLibrary(raw)
    expect(migrated.projects[0]).toMatchObject({
      projectType: 'workable',
      outputs: [],
      notes: 'Keep notes',
    })
    expect(parseBackup(raw).library).toEqual(migrated)
    expect(JSON.stringify(legacy)).toBe(raw)
    expect(parseLibrary(JSON.stringify(original))).toEqual(original)
  })
  it('creates the template only on demand and supports an empty code project', () => {
    const empty = emptyLibrary(),
      result = createCosmicClock(empty)
    expect(empty.projects).toEqual([])
    expect(result.project).toMatchObject({
      title: 'Cosmic Clock',
      projectType: 'code',
      tools: [],
      sourceManifest: { kind: 'cosmic-clock', version: 1 },
    })
    expect(result.project.outputs[0]).toMatchObject({
      title: 'Earth Clock',
      type: 'interactive-scene',
      status: 'ready',
    })
    const custom = addProject(empty, { ...starterInput, projectType: 'code', tools: [] })
    const attached = addEarthClock(custom.library, custom.project.id)
    expect(attached.projects[0].outputs).toHaveLength(1)
    expect(attached.projects[0].sourceManifest).toEqual(result.project.sourceManifest)
    expect(parseLibrary(JSON.stringify(attached))).toEqual(attached)
    expect(() => editProject(result.library, result.project.id, starterInput)).toThrow('owns code')
  })
  it('keeps independent output identities and data when duplicating', () => {
    const { library, project } = createCosmicClock(emptyLibrary())
    const copy = duplicateProject(library, project.id)
    expect(copy.project.outputs[0].id).not.toBe(project.outputs[0].id)
    expect(copy.project.sourceManifest).toEqual(project.sourceManifest)
    copy.project.outputs[0].source.defaultState.camera.latitude = -30
    copy.project.outputs[0].metadata.attribution = 'Copy only'
    expect(project.outputs[0].source.defaultState.camera.latitude).toBe(20)
    expect(project.outputs[0].metadata.attribution).not.toBe('Copy only')
  })
  it('retains outputs through metadata edits, archive, trash, restore, export and both restore modes', () => {
    const { library, project } = createCosmicClock(emptyLibrary())
    let next = editProject(library, project.id, { ...project, title: 'Renamed source' })
    next = actOnProject(next, project.id, 'archive')
    next = actOnProject(next, project.id, 'trash')
    expect(() => saveOutput(next, project.id, project.outputs[0])).toThrow('Restore')
    const backup = parseBackup(serializeBackup(next)).library
    expect(backup.projects[0].outputs).toEqual(project.outputs)
    expect(backup.projects[0].sourceManifest).toEqual(project.sourceManifest)
    const restored = actOnProject(backup, project.id, 'restore')
    expect(restored.projects[0].status).toBe('archived')
    expect(restored.projects[0].outputs).toEqual(project.outputs)
    const copies = restoreCopies(library, backup)
    expect(copies.projects[0].outputs[0].id).not.toBe(project.outputs[0].id)
    copies.projects[0].outputs[0].source.defaultState.showTimeZones = false
    expect(project.outputs[0].source.defaultState.showTimeZones).toBe(true)
    const storage = store(emptyLibrary())
    expect(
      restoreBackup(storage, backup, 'replace', storage.getItem()).projects[0].outputs,
    ).toEqual(project.outputs)
    expect(storage.writes).toBe(1)
  })
  it('validates definitions, rejects executable/unknown payloads, and leaves storage intact', () => {
    const { library, project } = createCosmicClock(emptyLibrary())
    const invalid = [
      (x: any) => {
        x.type = '3d-modeler'
      },
      (x: any) => {
        x.source.sceneKind = 'arbitrary-code'
      },
      (x: any) => {
        x.source.version = 2
      },
      (x: any) => {
        x.source.script = 'alert(1)'
      },
      (x: any) => {
        x.source.defaultState.camera.latitude = 91
      },
      (x: any) => {
        x.source.defaultState.camera.distance = 0
      },
      (x: any) => {
        x.source.defaultState.time.date = '2026-02-30T00:00:00.000Z'
      },
      (x: any) => {
        x.source.defaultState.time.speed = 0
      },
      (x: any) => {
        x.source.defaultState.time.mode = 'other'
      },
      (x: any) => {
        x.source.defaultState.time.paused = true
      },
      (x: any) => {
        x.source.defaultState.showTimeZones = 'yes'
      },
      (x: any) => {
        x.metadata.sourceUrl = 'javascript:alert(1)'
      },
      (x: any) => {
        x.id = '../../script'
      },
      (x: any) => {
        x.title = ' '
      },
    ]
    for (const corrupt of invalid) {
      const output = structuredClone(project.outputs[0])
      corrupt(output)
      expect(validOutput(output)).toBe(false)
      const storage = store(library),
        before = storage.getItem()
      expect(() =>
        commitLibrary(storage, (current) => saveOutput(current, project.id, output)),
      ).toThrow()
      expect(storage.writes).toBe(0)
      expect(storage.getItem()).toBe(before)
      const broken = structuredClone(library)
      broken.projects[0].outputs = [output]
      expect(() => parseBackup(JSON.stringify(broken))).toThrow('damaged')
    }
    const duplicate = structuredClone(library)
    duplicate.projects[0].outputs.push(duplicate.projects[0].outputs[0])
    expect(() => parseLibrary(JSON.stringify(duplicate))).toThrow()
  })
  it('explicitly saves valid defaults, protects stale edits, and never aliases a form draft', () => {
    const { library, project } = createCosmicClock(emptyLibrary()),
      output = structuredClone(project.outputs[0])
    output.source.defaultState.time = {
      mode: 'simulation',
      date: '2026-06-21T12:00:00.000Z',
      speed: 3600,
      paused: true,
    }
    output.source.defaultState.camera = { latitude: -20, sunLongitudeOffset: 100, distance: 4 }
    output.source.defaultState.showTimeZones = false
    output.metadata.sourceUrl = 'https://example.com/source'
    const next = saveOutput(library, project.id, output, project.outputs[0])
    expect(next.projects[0].outputs[0]).toEqual(output)
    output.title = 'Unsaved draft'
    expect(next.projects[0].outputs[0].title).toBe('Earth Clock')
    expect(() => saveOutput(next, project.id, output, project.outputs[0])).toThrow('another tab')
    expect(validOutput(earthClockOutput())).toBe(true)
  })
})
