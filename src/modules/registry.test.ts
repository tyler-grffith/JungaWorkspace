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
import { addProject, emptyLibrary, initializeTools, validateInput } from '../library'

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
  it('ships examples whose inputs validate and whose documents match their tools', () => {
    const library = emptyLibrary()
    for (const example of examples) {
      const input = validateInput({ ...example.input, collectionId: null }, library)
      expect(input.tools).toEqual([...new Set(example.tools)])
      const documents = example.documents()
      for (const tool of example.tools) expect(documents[tool]).toBeDefined()
      if (example.openRoute)
        expect(
          modules.some((m) => m.route === example.openRoute) ||
            combinedViews.some((v) => v.route === example.openRoute),
        ).toBe(true)
    }
  })
})
