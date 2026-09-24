import { describe, expect, it } from 'vitest'
import { TOOL_IDS, isTool } from './ids'
import {
  availableViews,
  combinedViewForRoute,
  combinedViews,
  moduleById,
  moduleForRoute,
  modules,
} from './registry'
import { examples } from './examples'
import {
  builtInId,
  builtInNeedsLoad,
  builtInProjects,
  mergeBuiltIns,
  resetBuiltIn,
  shortcutExamples,
  stripBuiltIns,
} from './builtins'
import { compileGraph } from '../graph/engine'
import {
  addProject,
  emptyLibrary,
  initializeTools,
  parseLibrary,
  saveNotes,
  validateInput,
} from '../library'

describe('module registry', () => {
  it('registers every tool id exactly once with distinct routes and labels', () => {
    expect(modules.map((m) => m.id)).toEqual([...TOOL_IDS])
    expect(new Set(modules.map((m) => m.route)).size).toBe(modules.length)
    expect(new Set(modules.map((m) => m.openLabel)).size).toBe(modules.length)
    for (const id of TOOL_IDS) expect(moduleById[id].id).toBe(id)
    expect(isTool('graph')).toBe(true)
    expect(isTool('slides')).toBe(false)
  })
  it('resolves routes to modules and combined views only for the tools a project has', () => {
    expect(moduleForRoute('#/project/x/graph', ['graph', 'sheet'])?.id).toBe('graph')
    expect(moduleForRoute('#/project/x/graph', ['sheet'])).toBeNull()
    expect(moduleForRoute('#/project/x', ['graph'])).toBeNull()
    expect(combinedViewForRoute('#/project/x/workspace', ['sheet', 'graph'])?.id).toBe('workspace')
    expect(combinedViewForRoute('#/project/x/workspace', ['sheet'])).toBeNull()
    expect(availableViews(['graph'])).toEqual([])
    expect(availableViews(['graph', 'sheet'])).toEqual(combinedViews)
    for (const view of combinedViews)
      expect(modules.some((m) => m.route === view.route)).toBe(false)
  })
  it('creates the saved document for each requested module once', () => {
    const { library, project } = addProject(emptyLibrary(), {
      title: 'Both',
      description: '',
      tools: ['graph', 'sheet'],
      collectionId: null,
      referenceUrl: '',
    })
    const initialized = initializeTools(library, project.id, ['graph', 'sheet'])
    const saved = initialized.projects[0]
    expect(saved.graph).toBeDefined()
    expect(saved.sheet).toBeDefined()
    expect(initializeTools(initialized, project.id, ['graph'])).toBe(initialized)
  })
  it('ships one example per kind of project, each a valid built-in project', () => {
    expect(new Set(examples.map((e) => e.id)).size).toBe(examples.length)
    for (const id of TOOL_IDS)
      expect(
        examples.some((e) => e.tools.includes(id)),
        `example for ${id}`,
      ).toBe(true)
    expect(examples.some((e) => e.input.projectType === 'code')).toBe(true)
    const projects = builtInProjects()
    expect(projects.map((p) => p.exampleId)).toEqual(examples.map((e) => e.id))
    for (const example of examples) {
      const input = validateInput({ ...example.input, collectionId: null }, emptyLibrary())
      expect(input.tools).toEqual([...new Set(example.tools)])
      if (example.openRoute)
        expect(
          modules.some((m) => m.route === example.openRoute) ||
            combinedViews.some((v) => v.route === example.openRoute),
        ).toBe(true)
      const project = projects.find((p) => p.id === builtInId(example.id))!
      expect(project.builtIn).toBe(true)
      expect(project.outputs.length).toBe(example.outputs?.().length ?? 0)
      // Material an example loads on demand is the one document a pristine built-in may lack.
      for (const tool of example.tools)
        if (!example.loadDocuments) expect(project[tool], `${example.id} ${tool}`).toBeDefined()
      expect(builtInNeedsLoad(project)).toBe(!!example.loadDocuments)
    }
    // Every pristine project survives the strict parser, and the graphs compile without errors.
    const merged = mergeBuiltIns(emptyLibrary())
    expect(() => parseLibrary(JSON.stringify(merged))).not.toThrow()
    for (const project of merged.projects)
      if (project.graph) expect(compileGraph(project.graph).errors, project.title).toEqual({})
  })
  it('merges built-ins into every library and stores only the ones the user changed', () => {
    const merged = mergeBuiltIns(emptyLibrary())
    expect(merged.projects).toHaveLength(examples.length)
    expect(stripBuiltIns(merged).projects).toEqual([])
    const laplace = builtInId('laplace')
    const edited = saveNotes(merged, laplace, 'Mine')
    const stored = stripBuiltIns(edited)
    expect(stored.projects.map((p) => p.id)).toEqual([laplace])
    expect(stored.projects[0].notes).toBe('Mine')
    // Reading storage back shows the edit on the built-in, and the rest pristine.
    const again = mergeBuiltIns(parseLibrary(JSON.stringify(stored)))
    expect(again.projects).toHaveLength(examples.length)
    expect(again.projects.find((p) => p.id === laplace)?.notes).toBe('Mine')
    expect(again.projects.find((p) => p.id === laplace)?.builtIn).toBe(true)
    expect(stripBuiltIns(resetBuiltIn(again, laplace)).projects).toEqual([])
    // A user's own project passes through untouched.
    const own = addProject(again, {
      title: 'Mine',
      description: '',
      tools: ['sheet'],
      collectionId: null,
      referenceUrl: '',
    })
    expect(stripBuiltIns(own.library).projects.map((p) => p.id)).toEqual([own.project.id, laplace])
    expect(() => resetBuiltIn(own.library, own.project.id)).toThrow('built-in')
  })
  it('lists the shortcut examples the design names, in order, ignoring unknown ids', () => {
    expect(shortcutExamples('cosmic-clock, octahedron').map((e) => e.id)).toEqual([
      'cosmic-clock',
      'octahedron',
    ])
    expect(shortcutExamples(' octahedron,nope ,cosmic-clock').map((e) => e.id)).toEqual([
      'octahedron',
      'cosmic-clock',
    ])
    expect(shortcutExamples('')).toEqual([])
  })
})
