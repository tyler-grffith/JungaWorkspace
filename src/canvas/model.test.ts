import { describe, expect, it } from 'vitest'
import {
  attachedAnchor,
  cloneElements,
  emptyCanvas,
  expandGroups,
  freeAnchor,
  newConnector,
  newPage,
  newShape,
  newText,
  parseMarkup,
  plainText,
  validCanvas,
  type CanvasDocument,
} from './model'
import {
  anchorPoint,
  connectorPath,
  elementBounds,
  hitTest,
  poseAt,
  resizeRect,
  rotatePoint,
  snapRect,
} from './geometry'
import {
  addCanvasOutput,
  addProject,
  duplicateProject,
  emptyLibrary,
  initializeTools,
  parseLibrary,
  saveCanvas,
  starterInput,
} from '../library'
import { libraryWithDrafts, parseBackup, serializeBackup } from '../backup'

const canvasInput = { ...starterInput, title: 'Board', tools: ['canvas' as const] }
const withCanvas = () => {
  const { library, project } = addProject(emptyLibrary(), canvasInput)
  return { library: initializeTools(library, project.id, ['canvas']), id: project.id }
}

describe('canvas document', () => {
  it('starts valid in every mode with one page and mode-specific page defaults', () => {
    for (const mode of ['deck', 'mockup', 'board', 'animation'] as const) {
      const doc = emptyCanvas(mode)
      expect(validCanvas(doc)).toBe(true)
      expect(doc.pages).toHaveLength(1)
      expect(doc.mode).toBe(mode)
    }
    expect(emptyCanvas('board').page.infinite).toBe(true)
    expect(emptyCanvas('mockup').page.width).toBe(390)
  })
  it('rejects unknown keys, bad paints, dangling anchors, and oversized documents', () => {
    const doc = emptyCanvas()
    const shape = newShape('rect', 10, 10)
    doc.pages[0].elements.push(shape)
    expect(validCanvas(doc)).toBe(true)
    expect(validCanvas({ ...doc, extra: 1 })).toBe(false)
    expect(
      validCanvas({ ...doc, pages: [{ ...doc.pages[0], elements: [{ ...shape, fill: 'red' }] }] }),
    ).toBe(false)
    expect(
      validCanvas({
        ...doc,
        pages: [
          { ...doc.pages[0], elements: [{ ...shape, fill: 'gradient(90,#ff0000,#0000ff)' }] },
        ],
      }),
    ).toBe(true)
    const dangling = newConnector(attachedAnchor('missing'), freeAnchor(0, 0))
    expect(validCanvas({ ...doc, pages: [{ ...doc.pages[0], elements: [dangling] }] })).toBe(false)
    const attached = newConnector(attachedAnchor(shape.id), freeAnchor(0, 0))
    expect(validCanvas({ ...doc, pages: [{ ...doc.pages[0], elements: [shape, attached] }] })).toBe(
      true,
    )
    const huge = newText(0, 0, 'x'.repeat(20001))
    expect(validCanvas({ ...doc, pages: [{ ...doc.pages[0], elements: [huge] }] })).toBe(false)
  })
  it('clones elements with fresh ids while keeping connectors attached inside the copy', () => {
    const a = newShape('rect', 0, 0)
    const b = newShape('ellipse', 200, 0)
    a.groupId = 'grp1'
    b.groupId = 'grp1'
    const link = newConnector(attachedAnchor(a.id), attachedAnchor(b.id))
    const outside = newConnector(attachedAnchor(a.id), attachedAnchor('elsewhere'))
    const copies = cloneElements([a, b, link, outside], 10, 10)
    expect(copies.map((e) => e.id)).not.toContain(a.id)
    expect(copies[0].groupId).toBe(copies[1].groupId)
    expect(copies[0].groupId).not.toBe('grp1')
    const copiedLink = copies[2]
    const copiedOutside = copies[3]
    if (copiedLink.type !== 'connector' || copiedOutside.type !== 'connector')
      throw new Error('type')
    expect(copiedLink.start.elementId).toBe(copies[0].id)
    expect(copiedLink.end.elementId).toBe(copies[1].id)
    expect(copiedOutside.end.elementId).toBeNull()
    expect(copies[0].x).toBe(10)
  })
  it('expands a selection to whole groups', () => {
    const page = newPage()
    const a = newShape('rect', 0, 0)
    const b = newShape('rect', 0, 0)
    const c = newShape('rect', 0, 0)
    a.groupId = b.groupId = 'g'
    page.elements = [a, b, c]
    expect(expandGroups(page, [a.id]).sort()).toEqual([a.id, b.id].sort())
    expect(expandGroups(page, [c.id])).toEqual([c.id])
  })
  it('parses subscript and superscript markup', () => {
    expect(parseMarkup('T_{0} = P^{2}x')).toEqual([
      { text: 'T', script: 'normal' },
      { text: '0', script: 'sub' },
      { text: ' = P', script: 'normal' },
      { text: '2', script: 'sup' },
      { text: 'x', script: 'normal' },
    ])
    expect(parseMarkup('a_b')).toEqual([{ text: 'a_b', script: 'normal' }])
    expect(plainText('T_{0}^{2}')).toBe('T02')
  })
})

describe('canvas geometry', () => {
  it('rotates points and finds bounds of rotated elements', () => {
    const p = rotatePoint({ x: 10, y: 0 }, { x: 0, y: 0 }, 90)
    expect(p.x).toBeCloseTo(0)
    expect(p.y).toBeCloseTo(10)
    const square = newShape('rect', 0, 0, 100, 100)
    square.rotation = 45
    const b = elementBounds(square, newPage())
    expect(b.width).toBeCloseTo(Math.SQRT2 * 100)
    expect(b.x).toBeCloseTo(50 - (Math.SQRT2 * 100) / 2)
  })
  it('anchors connectors at element edges, fixed points, or free points', () => {
    const page = newPage()
    const box = newShape('rect', 100, 100, 100, 50)
    const circle = newShape('ellipse', 400, 100, 100, 100)
    page.elements = [box, circle]
    const edge = anchorPoint(attachedAnchor(box.id), page, { x: 500, y: 125 })
    expect(edge.x).toBeCloseTo(200)
    expect(edge.y).toBeCloseTo(125)
    const fixed = anchorPoint(attachedAnchor(box.id, 0.5, 1), page)
    expect(fixed).toEqual({ x: 150, y: 150 })
    const rim = anchorPoint(attachedAnchor(circle.id), page, { x: 450, y: 0 })
    expect(rim.x).toBeCloseTo(450)
    expect(rim.y).toBeCloseTo(100)
    expect(anchorPoint(freeAnchor(3, 4), page)).toEqual({ x: 3, y: 4 })
    const link = newConnector(attachedAnchor(box.id), attachedAnchor(circle.id))
    page.elements.push(link)
    expect(
      connectorPath(
        [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
        ],
        'straight',
      ),
    ).toBe('M0 0 L10 10')
    expect(
      connectorPath(
        [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
        ],
        'orthogonal',
      ),
    ).toBe('M0 0 L5 0 L5 10 L10 10')
    expect(hitTest(link, page, { x: 300, y: 137 }, 6)).toBe(true)
    expect(hitTest(link, page, { x: 300, y: 200 }, 6)).toBe(false)
  })
  it('resizes from any handle, keeps aspect on corners when asked, and snaps to neighbours', () => {
    const start = { x: 100, y: 100, width: 200, height: 100 }
    expect(resizeRect(start, 'se', 50, 20)).toEqual({ x: 100, y: 100, width: 250, height: 120 })
    expect(resizeRect(start, 'nw', 50, 20)).toEqual({ x: 150, y: 120, width: 150, height: 80 })
    const aspect = resizeRect(start, 'se', 100, 0, true)
    expect(aspect.width / aspect.height).toBeCloseTo(2)
    expect(resizeRect(start, 'w', 500, 0).width).toBe(4)
    const moving = { x: 203, y: 50, width: 40, height: 40 }
    const other = { x: 200, y: 200, width: 100, height: 100 }
    const result = snapRect(moving, [other], 10, true)
    expect(result.dx).toBe(-3)
    expect(result.guides.some((g) => g.axis === 'x' && g.at === 200)).toBe(true)
    expect(result.dy).toBe(0)
  })
  it('interpolates keyframes with easing and holds outside the range', () => {
    const shape = newShape('rect', 0, 0, 100, 100)
    shape.keyframes = [
      { t: 0, x: 0, y: 0, width: 100, height: 100, rotation: 0, opacity: 1 },
      { t: 2, x: 200, y: 0, width: 100, height: 100, rotation: 90, opacity: 0 },
    ]
    expect(poseAt(shape, -1).x).toBe(0)
    expect(poseAt(shape, 5).x).toBe(200)
    const mid = poseAt(shape, 1)
    expect(mid.x).toBeCloseTo(100)
    expect(mid.rotation).toBeCloseTo(45)
    expect(mid.opacity).toBeCloseTo(0.5)
    expect(poseAt(newShape('rect', 5, 5), 1).x).toBe(5)
  })
})

describe('canvas in the library', () => {
  it('initializes, saves, validates, duplicates, and restores canvas documents', () => {
    const { library, id } = withCanvas()
    const project = library.projects[0]
    expect(project.canvas?.mode).toBe('deck')
    const next: CanvasDocument = structuredClone(project.canvas!)
    next.pages[0].elements.push(newShape('star', 40, 40))
    const saved = saveCanvas(library, id, next)
    expect(saved.projects[0].canvas?.pages[0].elements).toHaveLength(1)
    expect(() => saveCanvas(library, id, { ...next, mode: 'poster' as never })).toThrow()
    const copy = duplicateProject(saved, id)
    expect(copy.project.canvas?.pages[0].elements[0].id).toBe(next.pages[0].elements[0].id)
    expect(copy.project.id).not.toBe(id)
    const reparsed = parseLibrary(JSON.stringify(saved))
    expect(reparsed.projects[0].canvas).toEqual(saved.projects[0].canvas)
    const backup = parseBackup(serializeBackup(saved))
    expect(backup.library.projects[0].canvas?.pages[0].elements).toHaveLength(1)
    const drafted = libraryWithDrafts(library, { canvas: { id, value: next } })
    expect(drafted.projects[0].canvas?.pages[0].elements).toHaveLength(1)
  })
  it('refuses a canvas on a project without the tool and rejects invalid stored documents', () => {
    const { library, project } = addProject(emptyLibrary(), starterInput)
    expect(() => saveCanvas(library, project.id, emptyCanvas())).toThrow(/canvas tool/)
    const { library: withDoc } = withCanvas()
    const raw = JSON.parse(JSON.stringify(withDoc))
    raw.projects[0].canvas.pages[0].elements = [{ type: 'shape' }]
    expect(() => parseLibrary(JSON.stringify(raw))).toThrow()
  })
  it('owns presentation outputs and keeps them through duplication', () => {
    const { library, id } = withCanvas()
    const withOutput = addCanvasOutput(library, id)
    const output = withOutput.projects[0].outputs[0]
    expect(output.type).toBe('canvas-show')
    expect(output.title).toBe('Board presentation')
    const copy = duplicateProject(withOutput, id)
    expect(copy.project.outputs).toHaveLength(1)
    expect(copy.project.outputs[0].id).not.toBe(output.id)
    expect(parseLibrary(JSON.stringify(withOutput)).projects[0].outputs[0].type).toBe('canvas-show')
    const { library: plain, project } = addProject(emptyLibrary(), starterInput)
    expect(() => addCanvasOutput(plain, project.id)).toThrow()
  })
})
