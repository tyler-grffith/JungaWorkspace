import { describe, expect, it } from 'vitest'
import { savedDesign } from './defaults'
import { refinementBrief, validDesign } from './model'

describe('designer settings', () => {
  it('accepts the committed design and both supported control variants', () => {
    expect(validDesign(savedDesign)).toBe(true)
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
      { ...savedDesign, path: '../other.json' },
      { ...savedDesign, theme: { ...savedDesign.theme, accent: 'url(evil)' } },
      { ...savedDesign, graph: { ...savedDesign.graph, panelWidth: Infinity } },
      { ...savedDesign, labels: { ...savedDesign.labels, defaultSize: 100 } },
      { ...savedDesign, labels: { ...savedDesign.labels, title: '  ' } },
      { ...savedDesign, labels: { ...savedDesign.labels, angleControl: 'script' } },
      { ...savedDesign, labels: { ...savedDesign.labels, angleStep: 0 } },
    ])
      expect(validDesign(value)).toBe(false)
  })
  it('prepares a scoped refinement with the request, feature context, and boundaries', () => {
    const brief = refinementBrief('Label manager', '  Put the angle buttons below the field.  ')
    expect(brief).toContain('Requested change: Put the angle buttons below the field.')
    expect(brief).toContain('features/curve label controls.md')
    expect(brief).toContain('docs/REFINEMENTS.md')
    expect(brief).toContain('ProductManagement is read-only')
  })
})
