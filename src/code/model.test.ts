import { describe, expect, it } from 'vitest'
import {
  MAX_FILE_CHARS,
  emptyCode,
  entryCandidates,
  normalizePath,
  resolveFrom,
  sortFiles,
  validCode,
} from './model'
import {
  addCodeOutput,
  addProject,
  duplicateProject,
  emptyLibrary,
  initializeTools,
  parseLibrary,
  removeOutput,
  saveCode,
  starterInput,
} from '../library'
import { libraryWithDrafts, parseBackup, serializeBackup } from '../backup'

const codeInput = { ...starterInput, title: 'Sketch', tools: ['code' as const] }
const withCode = () => {
  const { library, project } = addProject(emptyLibrary(), codeInput)
  return { library: initializeTools(library, project.id, ['code']), id: project.id }
}

describe('code file paths', () => {
  it('normalizes separators and rejects traversal, empty, and odd characters', () => {
    expect(normalizePath(' lib/util.js ')).toBe('lib/util.js')
    expect(normalizePath('/main.js')).toBe('main.js')
    expect(normalizePath('lib\\util.js')).toBe('lib/util.js')
    expect(normalizePath('a//b.js')).toBe('a/b.js')
    expect(normalizePath('../secret.js')).toBe('')
    expect(normalizePath('lib/../main.js')).toBe('')
    expect(normalizePath('')).toBe('')
    expect(normalizePath('a b.js')).toBe('')
    expect(normalizePath('a/b/c/d/e/f/g/h/i.js')).toBe('')
  })
  it('resolves specifiers against the importing file and refuses to escape the project', () => {
    expect(resolveFrom('main.js', './lib/util.js')).toBe('lib/util.js')
    expect(resolveFrom('lib/scene.js', './util.js')).toBe('lib/util.js')
    expect(resolveFrom('lib/scene.js', '../main.js')).toBe('main.js')
    expect(resolveFrom('lib/scene.js', '/main.js')).toBe('main.js')
    expect(resolveFrom('main.js', '../outside.js')).toBe('')
  })
  it('lists folders before files at each level', () => {
    const order = sortFiles([
      { path: 'main.js', content: '' },
      { path: 'lib/b.js', content: '' },
      { path: 'lib/a.js', content: '' },
      { path: 'index.html', content: '' },
    ]).map((file) => file.path)
    expect(order).toEqual(['lib/a.js', 'lib/b.js', 'index.html', 'main.js'])
  })
})

describe('code documents', () => {
  it('accepts the starter document and offers its HTML files as entries', () => {
    const document = emptyCode()
    expect(validCode(document)).toBe(true)
    expect(entryCandidates(document).map((file) => file.path)).toEqual(['index.html'])
  })
  it('refuses unstorable paths, duplicates, binary kinds, oversize files, and unknown entries', () => {
    const base = emptyCode()
    expect(validCode({ ...base, files: [{ path: '../x.js', content: '' }] })).toBe(false)
    expect(
      validCode({
        ...base,
        entry: '',
        files: [
          { path: 'a.js', content: '' },
          { path: 'A.js', content: '' },
        ],
      }),
    ).toBe(false)
    expect(validCode({ ...base, entry: '', files: [{ path: 'logo.png', content: '' }] })).toBe(
      false,
    )
    expect(
      validCode({
        ...base,
        entry: '',
        files: [{ path: 'big.js', content: 'x'.repeat(MAX_FILE_CHARS + 1) }],
      }),
    ).toBe(false)
    expect(validCode({ ...base, entry: 'missing.html' })).toBe(false)
    expect(validCode({ ...base, extra: 1 })).toBe(false)
  })
})

describe('code projects in the library', () => {
  it('creates the starter document only for projects holding the code tool', () => {
    const { library, id } = withCode()
    expect(library.projects[0].code?.files.length).toBe(4)
    expect(initializeTools(library, id, ['code'])).toBe(library)
    const other = addProject(emptyLibrary(), starterInput)
    expect(() => saveCode(other.library, other.project.id, emptyCode())).toThrow('code tool')
  })
  it('refuses a document that would not survive a reload', () => {
    const { library, id } = withCode()
    expect(() => saveCode(library, id, { ...emptyCode(), entry: 'nope.html' })).toThrow(
      'could not be saved',
    )
  })
  it('adds, keeps, and removes outputs that run the project files', () => {
    const { library, id } = withCode()
    const added = addCodeOutput(library, id, 'Sketch output')
    const output = added.projects[0].outputs[0]
    expect(output.type).toBe('code-run')
    expect(output.type === 'code-run' && output.source.entry).toBe('index.html')
    expect(parseLibrary(JSON.stringify(added))).toEqual(added)
    expect(removeOutput(added, id, output.id).projects[0].outputs).toEqual([])
  })
  it('gives a copy its own files and output identities', () => {
    const { library, id } = withCode()
    const added = addCodeOutput(library, id)
    const copy = duplicateProject(added, id)
    expect(copy.project.outputs[0].id).not.toBe(added.projects[0].outputs[0].id)
    copy.project.code!.files[0].content = 'changed'
    expect(added.projects[0].code!.files[0].content).not.toBe('changed')
  })
  it('refuses stored outputs on a project that owns neither the tool nor bundled source', () => {
    const { library, id } = withCode()
    const added = addCodeOutput(library, id)
    const raw = JSON.parse(JSON.stringify(added))
    raw.projects[0].tools = ['graph']
    expect(() => parseLibrary(JSON.stringify(raw))).toThrow()
  })
  it('carries files and unsaved file drafts through a backup', () => {
    const { library, id } = withCode()
    const restored = parseBackup(serializeBackup(library)).library
    expect(restored.projects[0].code).toEqual(library.projects[0].code)
    const draft = { ...emptyCode(), files: [{ path: 'index.html', content: '<p>draft</p>' }] }
    const snapshot = libraryWithDrafts(library, { code: { id, value: draft } })
    expect(snapshot.projects[0].code).toEqual(draft)
    expect(library.projects[0].code).not.toEqual(draft)
  })
})
