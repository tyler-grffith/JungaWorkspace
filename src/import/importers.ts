// Bringing existing files into the library as projects. Each importer turns one file (or, for
// code, a set of files) into the input and documents `addProject` needs, reusing the module
// importers that already exist (draw.io for the canvas, Markdown/HTML for documents, STL for
// the slicer, pictures for the painter, JSON for collections). Junga's own formats are here
// too: a single exported project, and a whole-library backup that hands off to the restore
// dialog. Kinds are a registry; the dialog offers a file's alternatives from it. No React.
import { parseProjectFile, type ImportKind, type Prepared } from './add'
export type { ImportKind, Prepared } from './add'
export { addImported, parseProjectFile, projectFilename, serializeProject } from './add'
import type { Tool } from '../modules/ids'
import {
  canvasShowOutput,
  collectionBrowseOutput,
  documentReadOutput,
  codeRunOutput,
} from '../outputs'
import { emptyCanvas } from '../canvas/model'
import { importDrawio } from '../canvas/drawio'
import { readImageFile } from '../canvas/images'
import { emptyDocument, fromMarkdown, wordCount } from '../document/model'
import { parseHtml } from '../document/html'
import { MAX_COLUMNS, MAX_ROWS, address, emptySheet, type SheetDocument } from '../sheet/model'
import {
  MAX_FILES,
  MAX_FILE_CHARS,
  MAX_TOTAL_CHARS,
  availablePath,
  extensionOf,
  isTextPath,
  normalizePath,
  type CodeDocument,
} from '../code/model'
import { validCollections } from '../collection/model'
import { MAX_TRIANGLES, arrange, bedFor, emptySlicer, meshObject } from '../slicer/model'
import { decimate, parseStl, settle, triangleCount } from '../workbench/geometry'
import { emptyPainter } from '../painter/model'
import { detectDelimiter, parseDelimited } from './csv'

export type ImportKindInfo = {
  id: ImportKind
  label: string
  /** What the import makes, for the dialog. */
  makes: string
  tool: Tool | null
}
export const importKinds: readonly ImportKindInfo[] = [
  {
    id: 'canvas',
    label: 'Visual canvas',
    makes: 'a canvas board from a draw.io file',
    tool: 'canvas',
  },
  {
    id: 'document',
    label: 'Document',
    makes: 'a document from Markdown, HTML, or text',
    tool: 'document',
  },
  { id: 'sheet', label: 'Spreadsheet', makes: 'a spreadsheet from CSV or TSV', tool: 'sheet' },
  { id: 'code', label: 'Code project', makes: 'a code project from text files', tool: 'code' },
  { id: 'slicer', label: 'Slicer plate', makes: 'a print plate from an STL mesh', tool: 'slicer' },
  {
    id: 'painter',
    label: 'PLA Painter',
    makes: 'a filament painting from a picture',
    tool: 'painter',
  },
  {
    id: 'collection',
    label: 'Collection',
    makes: 'a collection from a Junga collections export',
    tool: 'collection',
  },
  {
    id: 'project',
    label: 'Junga project',
    makes: 'a copy of an exported Junga project',
    tool: null,
  },
  {
    id: 'backup',
    label: 'Junga library backup',
    makes: 'projects restored through the backup dialog',
    tool: null,
  },
]
export const kindInfo = (kind: ImportKind) => importKinds.find((k) => k.id === kind)!

const IMAGE = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'avif']
const TEXTUAL = ['md', 'markdown', 'txt', 'text']
const CODE = ['js', 'mjs', 'jsx', 'ts', 'tsx', 'css', 'yml', 'yaml', 'frag', 'vert', 'glsl']
export const extensionOfName = (name: string) =>
  name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : ''

/** The kinds a file can become, best first; empty when nothing here can read it. */
export function kindsFor(file: { name: string; type?: string }): ImportKind[] {
  const ext = extensionOfName(file.name)
  if (ext === 'drawio') return ['canvas']
  if (ext === 'xml') return ['canvas', 'code']
  if (TEXTUAL.includes(ext)) return ['document', 'code']
  if (ext === 'html' || ext === 'htm') return ['document', 'code']
  if (ext === 'csv' || ext === 'tsv') return ['sheet', 'code']
  if (ext === 'stl') return ['slicer']
  if (ext === 'svg') return ['painter', 'code']
  if (IMAGE.includes(ext) || (file.type ?? '').startsWith('image/')) return ['painter']
  if (ext === 'json') return ['project', 'backup', 'collection', 'code']
  if (CODE.includes(ext)) return ['code']
  return []
}

/** Read a JSON file's shape to pick between Junga's own formats. */
export function sniffJson(text: string): ImportKind | null {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return null
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  const record = data as Record<string, unknown>
  if (record.junga === 'project' && record.version === 1 && record.project) return 'project'
  if (record.version === 1 && Array.isArray(record.projects) && Array.isArray(record.collections))
    return 'backup'
  if (validCollections(data)) return 'collection'
  return null
}

/** A project title from a file name: `pdr_visuals-final.drawio` → `pdr visuals final`. */
export function titleFromName(name: string): string {
  const stem = name.includes('.') ? name.slice(0, name.lastIndexOf('.')) : name
  const words = stem.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
  return (words || 'Imported project').slice(0, 100)
}

export type ImportOptions = {
  /** Printed width and layer height for a new painting, from the design registry. */
  painterWidth?: number
  layerHeight?: number
}

const readText = (file: File) => file.text()

async function prepareCanvas(file: File, title: string): Promise<Prepared> {
  const result = await importDrawio(await readText(file), emptyCanvas('board'))
  return {
    kind: 'canvas',
    title,
    input: { description: `Imported from ${file.name}.`, tools: ['canvas'], referenceUrl: '' },
    documents: { canvas: result.document },
    outputs: [canvasShowOutput(title)],
    notes: `Imported from ${file.name} through the canvas module's draw.io importer.${
      result.skipped
        ? ` ${result.skipped} shapes had no equivalent and became labelled rectangles.`
        : ''
    }`,
    summary: `${result.elements} elements on ${result.pages} ${result.pages === 1 ? 'canvas' : 'canvases'}${
      result.skipped ? ` · ${result.skipped} approximated` : ''
    }`,
  }
}
async function prepareDocument(file: File, title: string): Promise<Prepared> {
  const text = await readText(file)
  const ext = extensionOfName(file.name)
  const document =
    ext === 'html' || ext === 'htm'
      ? { ...emptyDocument(), blocks: parseHtml(text) }
      : fromMarkdown(text)
  const count = wordCount(document)
  return {
    kind: 'document',
    title,
    input: { description: '', tools: ['document'], referenceUrl: '' },
    documents: { document },
    outputs: [documentReadOutput(title)],
    notes: `Imported from ${file.name}.`,
    summary: `${count.words.toLocaleString('en-US')} ${count.words === 1 ? 'word' : 'words'} · ${document.blocks.length} blocks`,
  }
}
/** Cells from rows of text; numbers stay numbers, everything else is text as typed. */
export function sheetFromRows(rows: string[][]): { sheet: SheetDocument; truncated: boolean } {
  const sheet = emptySheet()
  const maxCols = rows.reduce((n, r) => Math.max(n, r.length), 0)
  const truncated = rows.length > MAX_ROWS || maxCols > MAX_COLUMNS
  sheet.rows = Math.min(MAX_ROWS, Math.max(sheet.rows, rows.length))
  sheet.columns = Math.min(MAX_COLUMNS, Math.max(sheet.columns, maxCols))
  for (let r = 0; r < Math.min(rows.length, MAX_ROWS); r++)
    for (let c = 0; c < Math.min(rows[r].length, MAX_COLUMNS); c++) {
      const value = rows[r][c].trim()
      if (value === '') continue
      // A leading apostrophe keeps a value that looks like a formula as text.
      const input = value.startsWith('=') ? `'${value}` : value
      sheet.cells[address({ row: r, col: c })] = { input: input.slice(0, 2000) }
    }
  return { sheet, truncated }
}
async function prepareSheet(file: File, title: string): Promise<Prepared> {
  const text = await readText(file)
  const rows = parseDelimited(text, detectDelimiter(text, file.name))
  if (!rows.length) throw new Error(`${file.name} holds no rows.`)
  const { sheet, truncated } = sheetFromRows(rows)
  const filled = Object.keys(sheet.cells).length
  return {
    kind: 'sheet',
    title,
    input: { description: '', tools: ['sheet'], referenceUrl: '' },
    documents: { sheet },
    outputs: [],
    notes: `Imported from ${file.name}.${truncated ? ` The file was larger than ${MAX_ROWS} rows × ${MAX_COLUMNS} columns; the rest was left out.` : ''}`,
    summary: `${filled.toLocaleString('en-US')} filled cells in ${Math.min(rows.length, MAX_ROWS)} rows${truncated ? ' · truncated' : ''}`,
  }
}
/** Text files as one code project; folder drops keep their paths below the dropped folder. */
export async function prepareCode(files: File[], title: string): Promise<Prepared> {
  const code: CodeDocument = { version: 1, entry: '', files: [] }
  const skipped: string[] = []
  for (const file of files.slice(0, MAX_FILES)) {
    const relative = (file as File & { webkitRelativePath?: string }).webkitRelativePath || ''
    const raw = relative.includes('/') ? relative.slice(relative.indexOf('/') + 1) : file.name
    const path = normalizePath(raw)
    if (!path || !isTextPath(path)) {
      skipped.push(file.name)
      continue
    }
    const content = await readText(file)
    if (content.length > MAX_FILE_CHARS) {
      skipped.push(file.name)
      continue
    }
    const stored = availablePath(code.files, path)
    if (!stored) continue
    code.files.push({ path: stored, content })
    if (!code.entry && ['html', 'htm'].includes(extensionOf(stored))) code.entry = stored
  }
  if (!code.files.length)
    throw new Error('None of these files can be stored as code (text files only).')
  const total = code.files.reduce((n, f) => n + f.content.length, 0)
  if (total > MAX_TOTAL_CHARS)
    throw new Error(
      `These files pass the ${Math.round(MAX_TOTAL_CHARS / 1024)} KB limit of one code project.`,
    )
  return {
    kind: 'code',
    title,
    input: { description: '', tools: ['code'], referenceUrl: '' },
    documents: { code },
    outputs: code.entry ? [codeRunOutput(code.entry, title)] : [],
    notes: `Imported ${code.files.length} ${code.files.length === 1 ? 'file' : 'files'}.${
      skipped.length ? ` Left out (not text, or too large): ${skipped.join(', ')}.` : ''
    }`,
    summary: `${code.files.length} ${code.files.length === 1 ? 'file' : 'files'}${code.entry ? ` · runs ${code.entry}` : ''}${
      skipped.length ? ` · ${skipped.length} left out` : ''
    }`,
  }
}
async function prepareSlicer(file: File, title: string): Promise<Prepared> {
  const mesh = parseStl(await file.arrayBuffer())
  const before = triangleCount(mesh)
  const object = meshObject(titleFromName(file.name), settle(decimate(mesh, MAX_TRIANGLES)), 0)
  const slicer = emptySlicer()
  const plate = arrange({ ...slicer.plates[0], objects: [object] }, bedFor(slicer.printer))
  const after = triangleCount(object.mesh!)
  return {
    kind: 'slicer',
    title,
    input: { description: '', tools: ['slicer'], referenceUrl: '' },
    documents: { slicer: { ...slicer, plates: [plate], activePlate: plate.id } },
    outputs: [],
    notes: `Imported ${file.name} onto the plate.${after < before ? ` Simplified from ${before.toLocaleString('en-US')} to ${after.toLocaleString('en-US')} triangles.` : ''}`,
    summary: `${object.width} × ${object.depth} × ${object.height} mm · ${after.toLocaleString('en-US')} triangles`,
  }
}
async function preparePainter(
  file: File,
  title: string,
  options: ImportOptions,
): Promise<Prepared> {
  const { src, width, height } = await readImageFile(file, 640)
  const painting = {
    ...emptyPainter(options.painterWidth, options.layerHeight),
    image: { src, width, height, name: file.name },
  }
  return {
    kind: 'painter',
    title,
    input: { description: '', tools: ['painter'], referenceUrl: '' },
    documents: { painter: painting },
    outputs: [],
    notes: `Imported ${file.name} as the picture to paint.`,
    summary: `${width} × ${height} px picture`,
  }
}
async function prepareCollection(file: File, title: string): Promise<Prepared> {
  const parsed = JSON.parse(await readText(file)) as unknown
  if (!validCollections(parsed)) throw new Error(`${file.name} is not a Junga collections export.`)
  return {
    kind: 'collection',
    title,
    input: { description: '', tools: ['collection'], referenceUrl: '' },
    documents: { collection: parsed },
    outputs: [collectionBrowseOutput(title)],
    notes: `Imported from ${file.name}.`,
    summary: `${parsed.items.length} items in ${parsed.collections.length} collections`,
  }
}
async function prepareProject(file: File): Promise<Prepared> {
  const project = parseProjectFile(await readText(file))
  return {
    kind: 'project',
    title: project.title,
    input: {
      description: project.description,
      tools: project.tools,
      referenceUrl: project.referenceUrl,
    },
    documents: {},
    outputs: [],
    notes: project.notes,
    summary: `${project.projectType === 'code' ? 'Code project' : project.tools.join(', ')} · exported ${project.updatedAt.slice(0, 10)}`,
    project,
  }
}

/** Prepare one file (or, for `code`, several) as the chosen kind. */
export async function prepareImport(
  files: File[],
  kind: ImportKind,
  title: string,
  options: ImportOptions = {},
): Promise<Prepared> {
  const file = files[0]
  switch (kind) {
    case 'canvas':
      return prepareCanvas(file, title)
    case 'document':
      return prepareDocument(file, title)
    case 'sheet':
      return prepareSheet(file, title)
    case 'code':
      return prepareCode(files, title)
    case 'slicer':
      return prepareSlicer(file, title)
    case 'painter':
      return preparePainter(file, title, options)
    case 'collection':
      return prepareCollection(file, title)
    case 'project':
      return prepareProject(file)
    case 'backup':
      throw new Error('A library backup is restored through the backup dialog.')
  }
}
