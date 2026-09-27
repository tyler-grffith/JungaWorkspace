import { describe, expect, it } from 'vitest'
import { detectDelimiter, parseDelimited } from './csv'
import {
  kindsFor,
  prepareCode,
  prepareImport,
  sheetFromRows,
  sniffJson,
  titleFromName,
} from './importers'
import { addImported, parseProjectFile, projectFilename, serializeProject } from './add'
import { addProject, emptyLibrary, parseLibrary, starterInput } from '../library'
import { laplaceGraph } from '../graph/model'
import { documentReadOutput } from '../outputs'
import { emptyCollections } from '../collection/model'

const file = (name: string, text: string, type = 'text/plain') => new File([text], name, { type })
const TETRAHEDRON = `solid tet
facet normal 0 0 0
 outer loop
  vertex 0 0 0
  vertex 10 0 0
  vertex 0 10 0
 endloop
endfacet
facet normal 0 0 0
 outer loop
  vertex 0 0 0
  vertex 0 0 10
  vertex 10 0 0
 endloop
endfacet
facet normal 0 0 0
 outer loop
  vertex 0 0 0
  vertex 0 10 0
  vertex 0 0 10
 endloop
endfacet
facet normal 0 0 0
 outer loop
  vertex 10 0 0
  vertex 0 0 10
  vertex 0 10 0
 endloop
endfacet
endsolid tet
`

describe('delimited text', () => {
  it('reads commas, semicolons, and tabs with quoted fields', () => {
    expect(parseDelimited('a,b\n"c,d",e\r\n"say ""hi""",f\n', ',')).toEqual([
      ['a', 'b'],
      ['c,d', 'e'],
      ['say "hi"', 'f'],
    ])
    expect(parseDelimited('"multi\nline",x', ',')).toEqual([['multi\nline', 'x']])
    expect(detectDelimiter('a;b;c\n1;2;3')).toBe(';')
    expect(detectDelimiter('a\tb\n1\t2')).toBe('\t')
    expect(detectDelimiter('a,b', 'x.tsv')).toBe('\t')
    expect(detectDelimiter('a,b,c')).toBe(',')
  })
  it('turns rows into a bounded sheet, keeping would-be formulas as text', () => {
    const { sheet, truncated } = sheetFromRows([
      ['Case', 'Load'],
      ['Dead', '12.5'],
      ['=SUM(B2)', ''],
    ])
    expect(truncated).toBe(false)
    expect(sheet.cells.A1.input).toBe('Case')
    expect(sheet.cells.B2.input).toBe('12.5')
    expect(sheet.cells.A3.input).toBe("'=SUM(B2)")
    expect(sheet.cells.B3).toBeUndefined()
    const big = sheetFromRows(Array.from({ length: 300 }, (_, i) => [String(i)]))
    expect(big.truncated).toBe(true)
    expect(big.sheet.rows).toBe(200)
  })
})

describe('import kinds', () => {
  it('offers the kinds a file can become and reads Junga JSON shapes', () => {
    expect(kindsFor({ name: 'board.drawio' })).toEqual(['canvas'])
    expect(kindsFor({ name: 'notes.md' })).toEqual(['document', 'code'])
    expect(kindsFor({ name: 'page.html' })).toEqual(['document', 'code'])
    expect(kindsFor({ name: 'data.csv' })).toEqual(['sheet', 'code'])
    expect(kindsFor({ name: 'part.STL' })).toEqual(['slicer'])
    expect(kindsFor({ name: 'photo.jpeg' })).toEqual(['painter'])
    expect(kindsFor({ name: 'x.bin', type: 'image/png' })).toEqual(['painter'])
    expect(kindsFor({ name: 'main.ts' })).toEqual(['code'])
    expect(kindsFor({ name: 'thing.exe' })).toEqual([])
    expect(sniffJson(JSON.stringify(emptyLibrary()))).toBe('backup')
    expect(sniffJson(serializeProject(addProject(emptyLibrary(), starterInput).project))).toBe(
      'project',
    )
    expect(sniffJson(JSON.stringify(emptyCollections()))).toBe('collection')
    expect(sniffJson('{"a":1}')).toBeNull()
    expect(sniffJson('nope')).toBeNull()
    expect(titleFromName('pdr_visuals-final.drawio')).toBe('pdr visuals final')
    expect(titleFromName('.hidden')).toBe('Imported project')
  })

  it('prepares documents, sheets, code, and meshes from files', async () => {
    const doc = await prepareImport(
      [file('notes.md', '# Notes\n\nHello **there**.')],
      'document',
      'Notes',
    )
    expect(doc.documents.document?.blocks).toHaveLength(2)
    expect(doc.summary).toBe('3 words · 2 blocks')
    expect(doc.outputs[0].type).toBe('document-read')
    // HTML documents parse through DOMParser and are covered by the browser tests.

    const sheet = await prepareImport(
      [file('loads.csv', 'Case,Load\nDead,12.5\n"Snow, drift",6\n')],
      'sheet',
      'Loads',
    )
    expect(sheet.documents.sheet?.cells.A3.input).toBe('Snow, drift')
    expect(sheet.summary).toContain('6 filled cells')
    await expect(prepareImport([file('empty.csv', '')], 'sheet', 'Empty')).rejects.toThrow(
      'no rows',
    )

    const code = await prepareCode(
      [
        file('index.html', '<script src="main.js"></script>'),
        file('main.js', 'console.log(1)'),
        file('pic.png', 'x'),
      ],
      'Site',
    )
    expect(code.documents.code?.entry).toBe('index.html')
    expect(code.documents.code?.files.map((f) => f.path)).toEqual(['index.html', 'main.js'])
    expect(code.outputs[0].type).toBe('code-run')
    expect(code.summary).toBe('2 files · runs index.html · 1 left out')
    await expect(prepareCode([file('pic.png', 'x')], 'Pictures')).rejects.toThrow('text files')

    const plate = await prepareImport([file('tet.stl', TETRAHEDRON)], 'slicer', 'Tet')
    const object = plate.documents.slicer?.plates[0].objects[0]
    expect(object?.width).toBe(10)
    expect(object?.height).toBe(10)
    expect(plate.summary).toContain('4 triangles')

    const collection = await prepareImport(
      [file('music.collections.json', JSON.stringify(emptyCollections()))],
      'collection',
      'Music',
    )
    expect(collection.documents.collection?.collections).toHaveLength(1)
    await expect(prepareImport([file('x.json', '{}')], 'collection', 'X')).rejects.toThrow(
      'collections export',
    )
    await expect(prepareImport([file('x.json', '{}')], 'backup', 'X')).rejects.toThrow(
      'backup dialog',
    )
  })
})

describe('project files', () => {
  it('round-trips a project and imports it as an independent copy', async () => {
    const { library, project } = addProject(
      emptyLibrary(),
      { ...starterInput, tools: ['graph', 'document'] },
      'notes',
      laplaceGraph(),
    )
    const withOutput = {
      ...library,
      projects: library.projects.map((p) =>
        p.id === project.id
          ? { ...p, outputs: [documentReadOutput('Read')], relatedIds: ['elsewhere'] }
          : p,
      ),
    }
    const text = serializeProject({ ...withOutput.projects[0], builtIn: true })
    expect(projectFilename(project)).toBe('laplace-intuition.junga-project.json')
    const parsed = parseProjectFile(text)
    expect(parsed.builtIn).toBeUndefined()
    expect(parsed.graph).toEqual(withOutput.projects[0].graph)
    expect(parsed.relatedIds).toEqual(['elsewhere'])
    expect(() => parseProjectFile('{"junga":"nope"}')).toThrow('exported Junga project')
    expect(() => parseProjectFile('{')).toThrow('JSON')
    expect(() => parseProjectFile('{"junga":"project","version":1,"project":{"id":"x"}}')).toThrow(
      'damaged',
    )
    const prepared = await prepareImport([file('p.json', text)], 'project', 'ignored')
    expect(prepared.project?.id).toBe(project.id)
    // Into the same library the copy gets a new id, a distinct title, and fresh output ids.
    const added = addImported(withOutput, prepared, null)
    expect(added.project.id).not.toBe(project.id)
    expect(added.project.title).toBe('LaPlace Intuition (restored)')
    expect(added.project.outputs[0].id).not.toBe(withOutput.projects[0].outputs[0].id)
    expect(added.project.graph).toEqual(withOutput.projects[0].graph)
    expect(added.library.projects).toHaveLength(2)
    expect(() => parseLibrary(JSON.stringify(added.library))).not.toThrow()
    // A prepared document import becomes a project with its outputs.
    const doc = await prepareImport([file('notes.md', '# T\n\nx')], 'document', 'Notes')
    const result = addImported(emptyLibrary(), doc, null)
    expect(result.project.tools).toEqual(['document'])
    expect(result.project.outputs).toHaveLength(1)
    expect(result.project.notes).toBe('Imported from notes.md.')
  })
})
