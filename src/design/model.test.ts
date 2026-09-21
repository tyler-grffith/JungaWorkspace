import { describe, expect, it } from 'vitest'
import { savedDesign } from './defaults'
import type { Field } from './registry'
import {
  completeDesign,
  defaultDesign,
  designGroups,
  designVariables,
  groupIds,
  refinementBrief,
  validDesign,
} from './model'

describe('designer settings registry', () => {
  it('accepts the committed design, the registry defaults, and supported control variants', () => {
    expect(validDesign(savedDesign)).toBe(true)
    expect(validDesign(defaultDesign())).toBe(true)
    expect(
      validDesign({
        ...savedDesign,
        labels: {
          ...savedDesign.labels,
          angleControl: 'dropdown',
          sizeControl: 'number',
          angleStep: 5,
        },
      }),
    ).toBe(true)
  })
  it('rejects unsafe, malformed, out-of-bounds, and unsupported settings', () => {
    for (const value of [
      null,
      {},
      { ...savedDesign, version: 1 },
      { ...savedDesign, path: '../other.json' },
      { ...savedDesign, theme: { ...savedDesign.theme, accent: 'url(evil)' } },
      { ...savedDesign, graph: { ...savedDesign.graph, panelWidth: Infinity } },
      { ...savedDesign, labels: { ...savedDesign.labels, defaultSize: 100 } },
      { ...savedDesign, labels: { ...savedDesign.labels, title: '  ' } },
      { ...savedDesign, labels: { ...savedDesign.labels, angleControl: 'script' } },
      { ...savedDesign, labels: { ...savedDesign.labels, angleStep: 0 } },
      { ...savedDesign, library: { ...savedDesign.library, showExamples: 'yes' } },
      { ...savedDesign, shell: { ...savedDesign.shell, extra: 1 } },
    ])
      expect(validDesign(value)).toBe(false)
  })
  it('completes older or partial files with defaults but never invents unknown fields', () => {
    const { theme, graph, labels } = savedDesign
    const older = { version: 1, theme, graph, labels }
    expect(validDesign(older)).toBe(false)
    const completed = completeDesign(older)
    expect(completed).not.toBeNull()
    expect(validDesign(completed)).toBe(true)
    expect(completed!.library.title).toBe(designGroups.library.fields.title.default)
    expect(completed!.labels).toEqual(labels)
    expect(completeDesign({ ...older, labels: { ...labels, mystery: 1 } })).toBeNull()
    expect(completeDesign({ ...older, unknownGroup: {} })).toBeNull()
    expect(completeDesign({ ...older, labels: { ...labels, width: 5000 } })).toBeNull()
  })
  it('keeps every registered field valid by default and emits declared CSS variables', () => {
    const defaults = defaultDesign()
    for (const id of groupIds)
      for (const [key, field] of Object.entries(designGroups[id].fields as Record<string, Field>)) {
        expect(field.label.length, `${id}.${key} label`).toBeGreaterThan(0)
        if (field.kind === 'select')
          expect(field.options.some((o) => o.value === field.default)).toBe(true)
      }
    const variables = designVariables(defaults)
    expect(variables['--green']).toBe(defaults.theme.accent)
    expect(variables['--design-sidebar-width']).toBe(`${defaults.shell.sidebarWidth}px`)
    expect(variables['--design-grid-columns']).toBe(String(defaults.library.gridColumns))
    expect(variables['--design-heading-font']).toBe(defaults.theme.headingFont)
  })
  it('prepares a scoped refinement with the request, feature context, and boundaries', () => {
    const brief = refinementBrief('labels', '  Put the angle buttons below the field.  ')
    expect(brief).toContain('Small refinement: Label manager')
    expect(brief).toContain('Requested change: Put the angle buttons below the field.')
    expect(brief).toContain('features/curve label controls.md')
    expect(brief).toContain('src/design/registry.ts')
    expect(brief).toContain('docs/REFINEMENTS.md')
    expect(brief).toContain('ProductManagement is read-only')
  })
})
