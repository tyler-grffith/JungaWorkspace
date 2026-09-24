import { describe, expect, it } from 'vitest'
import {
  emptyDocument,
  fromMarkdown,
  newBlock,
  normalizeRuns,
  outline,
  parseInline,
  run,
  toMarkdown,
  validDocument,
  wordCount,
  type TextDocument,
} from './model'
import {
  addDocumentOutput,
  addProject,
  duplicateProject,
  emptyLibrary,
  initializeTools,
  parseLibrary,
  saveDocument,
  starterInput,
} from '../library'
import { libraryWithDrafts, parseBackup, serializeBackup } from '../backup'

const input = { ...starterInput, title: 'Notes', tools: ['document' as const] }
const withDocument = () => {
  const { library, project } = addProject(emptyLibrary(), input)
  return { library: initializeTools(library, project.id, ['document']), id: project.id }
}

describe('document model', () => {
  it('starts valid and rejects bad links, marks, block types, and oversized text', () => {
    const doc = emptyDocument()
    expect(validDocument(doc)).toBe(true)
    const bad = (change: (d: TextDocument) => void) => {
      const copy = structuredClone(doc)
      change(copy)
      return validDocument(copy)
    }
    expect(bad((d) => (d.blocks[0].runs = [run('x', [], 'javascript:alert(1)')]))).toBe(false)
    expect(bad((d) => (d.blocks[0].runs = [run('x', [], 'https://example.com')]))).toBe(true)
    expect(
      bad((d) => (d.blocks[0].runs = [{ text: 'x', marks: ['huge' as never], link: null }])),
    ).toBe(false)
    expect(bad((d) => (d.blocks[0].type = 'table' as never))).toBe(false)
    expect(bad((d) => (d.blocks[0].runs = [run('x'.repeat(20001))]))).toBe(false)
    expect(bad((d) => (d.blocks[0].src = 'data:image/png;base64,AAAA'))).toBe(false)
    expect(bad((d) => (d.page.margin = 5))).toBe(false)
    expect(bad((d) => ((d as unknown as Record<string, unknown>).extra = 1))).toBe(false)
  })
  it('merges runs, counts words, and lists headings', () => {
    expect(normalizeRuns([run('a', ['bold']), run('b', ['bold']), run(''), run('c')])).toEqual([
      run('ab', ['bold']),
      run('c'),
    ])
    const doc = emptyDocument()
    doc.blocks = [
      newBlock('title', [run('Mission ')]),
      newBlock('paragraph', [run('Two words')]),
      newBlock('heading2', [run('Later')]),
    ]
    expect(wordCount(doc)).toEqual({ words: 4, characters: 22 })
    expect(outline(doc).map((h) => [h.level, h.text])).toEqual([
      [0, 'Mission '],
      [2, 'Later'],
    ])
  })
  it('round-trips Markdown for headings, lists, quotes, code, links, and emphasis', () => {
    const source = [
      '# Title',
      '',
      'Plain with **bold**, *italic*, `code`, and a [link](https://example.com).',
      '',
      '## Section',
      '',
      '- one',
      '- two',
      '  - nested',
      '',
      '1. first',
      '2. second',
      '',
      '> quoted',
      '',
      '```',
      'const x = 1',
      '```',
      '',
      '---',
      '',
    ].join('\n')
    const doc = fromMarkdown(source)
    const types = doc.blocks.map((b) => b.type)
    expect(types).toEqual([
      'title',
      'paragraph',
      'heading1',
      'bullet',
      'bullet',
      'bullet',
      'numbered',
      'numbered',
      'quote',
      'code',
      'divider',
    ])
    expect(doc.blocks[5].indent).toBe(1)
    const paragraph = doc.blocks[1].runs
    expect(paragraph.find((r) => r.marks.includes('bold'))?.text).toBe('bold')
    expect(paragraph.find((r) => r.marks.includes('code'))?.text).toBe('code')
    expect(paragraph.find((r) => r.link)?.link).toBe('https://example.com')
    expect(validDocument(doc)).toBe(true)
    const again = fromMarkdown(toMarkdown(doc))
    expect(again.blocks.map((b) => b.type)).toEqual(types)
    expect(again.blocks[1].runs).toEqual(paragraph)
  })
  it('parses inline markdown without breaking on stray markers', () => {
    expect(parseInline('a * b')).toEqual([run('a * b')])
    expect(parseInline('~~gone~~ **[x](https://a.b)**')).toEqual([
      run('gone', ['strike']),
      run(' '),
      run('x', ['bold'], 'https://a.b'),
    ])
  })
})

describe('document in the library', () => {
  it('initializes, saves, validates, duplicates, backs up, and owns reading outputs', () => {
    const { library, id } = withDocument()
    const next = structuredClone(library.projects[0].document!)
    next.blocks.push(newBlock('heading1', [run('Plan')]))
    const saved = saveDocument(library, id, next)
    expect(saved.projects[0].document?.blocks).toHaveLength(2)
    expect(() => saveDocument(library, id, { ...next, version: 2 as never })).toThrow()
    const copy = duplicateProject(saved, id)
    expect(copy.project.document?.blocks).toHaveLength(2)
    expect(parseLibrary(JSON.stringify(saved)).projects[0].document).toEqual(
      saved.projects[0].document,
    )
    expect(parseBackup(serializeBackup(saved)).library.projects[0].document?.blocks).toHaveLength(2)
    expect(
      libraryWithDrafts(library, { document: { id, value: next } }).projects[0].document?.blocks,
    ).toHaveLength(2)
    const withOutput = addDocumentOutput(saved, id)
    expect(withOutput.projects[0].outputs[0].type).toBe('document-read')
    expect(parseLibrary(JSON.stringify(withOutput)).projects[0].outputs).toHaveLength(1)
    const { library: plain, project } = addProject(emptyLibrary(), starterInput)
    expect(() => saveDocument(plain, project.id, emptyDocument())).toThrow(/document tool/)
    expect(() => addDocumentOutput(plain, project.id)).toThrow()
  })
})
