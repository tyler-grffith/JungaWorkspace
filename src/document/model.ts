// Saved document for the Document module: a list of blocks, each a run of styled text or an
// image, plus page and type settings. The editor edits a contenteditable page natively and
// parses it back into this shape; the reader, exports, and thumbnails render from it.
export type Mark = 'bold' | 'italic' | 'underline' | 'strike' | 'code'
export type Run = { text: string; marks: Mark[]; link: string | null }
export type BlockType =
  | 'paragraph'
  | 'title'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'bullet'
  | 'numbered'
  | 'quote'
  | 'code'
  | 'divider'
  | 'image'
export type Align = 'left' | 'center' | 'right' | 'justify'
export type Block = {
  id: string
  type: BlockType
  runs: Run[]
  align: Align
  /** List nesting depth, 0 for top level. */
  indent: number
  /** Image blocks only: a data URL, alt text, and width as a percentage of the text width. */
  src: string
  alt: string
  width: number
}
export type PageSize = 'letter' | 'a4'
export type TextDocument = {
  version: 1
  blocks: Block[]
  page: { size: PageSize; margin: number }
  style: { fontFamily: string; fontSize: number; lineHeight: number }
}

export const MAX_BLOCKS = 5000
export const MAX_BLOCK_CHARS = 20000
export const MAX_RUNS = 500
export const MAX_IMAGE_CHARS = 600 * 1024
export const MAX_DOCUMENT_CHARS = 2500 * 1024
export const MARKS: readonly Mark[] = ['bold', 'italic', 'underline', 'strike', 'code']
export const BLOCK_TYPES: readonly BlockType[] = [
  'paragraph',
  'title',
  'heading1',
  'heading2',
  'heading3',
  'bullet',
  'numbered',
  'quote',
  'code',
  'divider',
  'image',
]
export const BLOCK_LABELS: Record<BlockType, string> = {
  paragraph: 'Normal text',
  title: 'Title',
  heading1: 'Heading 1',
  heading2: 'Heading 2',
  heading3: 'Heading 3',
  bullet: 'Bulleted list',
  numbered: 'Numbered list',
  quote: 'Quote',
  code: 'Code block',
  divider: 'Divider',
  image: 'Image',
}
/** Page widths in CSS pixels at 96 per inch. */
export const PAGE_SIZES: Record<PageSize, { label: string; width: number; height: number }> = {
  letter: { label: 'Letter (8.5 × 11 in)', width: 816, height: 1056 },
  a4: { label: 'A4 (210 × 297 mm)', width: 794, height: 1123 },
}
export const FONTS: readonly { value: string; label: string }[] = [
  { value: "'DM Sans Variable', 'Segoe UI', sans-serif", label: 'DM Sans' },
  { value: "'Manrope Variable', 'Segoe UI', sans-serif", label: 'Manrope' },
  { value: "'Instrument Serif', Georgia, serif", label: 'Instrument Serif' },
  { value: "Georgia, 'Times New Roman', serif", label: 'Georgia' },
  { value: "Garamond, 'EB Garamond', Georgia, serif", label: 'Garamond' },
  { value: "'Times New Roman', Times, serif", label: 'Times New Roman' },
  { value: 'Arial, Helvetica, sans-serif', label: 'Arial' },
  { value: "'DM Mono', Menlo, Consolas, monospace", label: 'DM Mono' },
]

export const newId = () => crypto.randomUUID().slice(0, 8)
export const run = (text: string, marks: Mark[] = [], link: string | null = null): Run => ({
  text,
  marks,
  link,
})
export function newBlock(type: BlockType = 'paragraph', runs: Run[] = []): Block {
  return { id: newId(), type, runs, align: 'left', indent: 0, src: '', alt: '', width: 100 }
}
export function emptyDocument(
  style: Partial<TextDocument['style']> = {},
  page: Partial<TextDocument['page']> = {},
): TextDocument {
  return {
    version: 1,
    blocks: [newBlock('paragraph')],
    page: { size: 'letter', margin: 1, ...page },
    style: { fontFamily: FONTS[0].value, fontSize: 12, lineHeight: 1.5, ...style },
  }
}

// --- Validation ---------------------------------------------------------------------------
const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const num = (v: unknown, min: number, max: number) =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max
const keys = (v: Record<string, unknown>, names: readonly string[]) =>
  Object.keys(v).length === names.length && names.every((n) => n in v)
const ID = /^[A-Za-z0-9_-]{1,40}$/
export function safeLink(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2000) return false
  try {
    return ['https:', 'http:', 'mailto:'].includes(new URL(value).protocol)
  } catch {
    return false
  }
}
export function validRun(v: unknown): v is Run {
  return (
    record(v) &&
    keys(v, ['text', 'marks', 'link']) &&
    typeof v.text === 'string' &&
    Array.isArray(v.marks) &&
    v.marks.length <= MARKS.length &&
    new Set(v.marks).size === v.marks.length &&
    v.marks.every((m) => MARKS.includes(m as Mark)) &&
    (v.link === null || safeLink(v.link))
  )
}
export function validBlock(v: unknown): v is Block {
  if (!record(v) || !keys(v, ['id', 'type', 'runs', 'align', 'indent', 'src', 'alt', 'width']))
    return false
  if (typeof v.id !== 'string' || !ID.test(v.id)) return false
  if (!BLOCK_TYPES.includes(v.type as BlockType)) return false
  if (!Array.isArray(v.runs) || v.runs.length > MAX_RUNS || !v.runs.every(validRun)) return false
  if (v.runs.reduce((n: number, r: Run) => n + r.text.length, 0) > MAX_BLOCK_CHARS) return false
  if (!['left', 'center', 'right', 'justify'].includes(v.align as string)) return false
  if (!num(v.indent, 0, 8) || !Number.isInteger(v.indent)) return false
  if (typeof v.alt !== 'string' || v.alt.length > 300) return false
  if (!num(v.width, 5, 100)) return false
  if (typeof v.src !== 'string' || v.src.length > MAX_IMAGE_CHARS) return false
  if (v.type === 'image')
    return /^data:image\/(png|jpeg|gif|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(v.src)
  return v.src === ''
}
export function validDocument(v: unknown): v is TextDocument {
  if (!record(v) || !keys(v, ['version', 'blocks', 'page', 'style'])) return false
  if (v.version !== 1) return false
  const { page, style } = v
  if (
    !record(page) ||
    !keys(page, ['size', 'margin']) ||
    typeof page.size !== 'string' ||
    !(page.size in PAGE_SIZES) ||
    !num(page.margin, 0.25, 2)
  )
    return false
  if (
    !record(style) ||
    !keys(style, ['fontFamily', 'fontSize', 'lineHeight']) ||
    typeof style.fontFamily !== 'string' ||
    !style.fontFamily ||
    style.fontFamily.length > 120 ||
    !num(style.fontSize, 6, 72) ||
    !num(style.lineHeight, 0.8, 3)
  )
    return false
  if (!Array.isArray(v.blocks) || !v.blocks.length || v.blocks.length > MAX_BLOCKS) return false
  if (new Set(v.blocks.map((b) => record(b) && b.id)).size !== v.blocks.length) return false
  if (!v.blocks.every(validBlock)) return false
  return JSON.stringify(v).length <= MAX_DOCUMENT_CHARS
}
export function documentProblem(doc: TextDocument): string {
  if (validDocument(doc)) return ''
  if (JSON.stringify(doc).length > MAX_DOCUMENT_CHARS)
    return `This document passed its ${Math.round(MAX_DOCUMENT_CHARS / 1024)} KB storage limit. Remove or shrink images to save.`
  return 'The document could not be saved. Check its contents.'
}

// --- Text helpers ---------------------------------------------------------------------------
export const blockText = (block: Block) => block.runs.map((r) => r.text).join('')
export const plainText = (doc: TextDocument) =>
  doc.blocks.map((b) => (b.type === 'image' ? b.alt : blockText(b))).join('\n')
export function wordCount(doc: TextDocument): { words: number; characters: number } {
  const text = doc.blocks
    .filter((b) => b.type !== 'image')
    .map(blockText)
    .join('\n')
  const words = text.split(/\s+/).filter((w) => w.length > 0).length
  return { words, characters: text.replace(/\n/g, '').length }
}
/** Headings in order, for an outline. */
export const outline = (doc: TextDocument) =>
  doc.blocks
    .filter(
      (b) => ['title', 'heading1', 'heading2', 'heading3'].includes(b.type) && blockText(b).trim(),
    )
    .map((b) => ({
      id: b.id,
      level: b.type === 'title' ? 0 : Number(b.type.slice(-1)),
      text: blockText(b),
    }))
/** Merge adjacent runs with identical styling and drop empty ones. */
export function normalizeRuns(runs: Run[]): Run[] {
  const out: Run[] = []
  for (const r of runs) {
    if (!r.text) continue
    const last = out[out.length - 1]
    const marks = [...new Set(r.marks)].sort() as Mark[]
    if (last && last.link === r.link && last.marks.join() === marks.join()) last.text += r.text
    else out.push({ text: r.text, marks, link: r.link })
  }
  return out
}
export const estimatedPages = (doc: TextDocument, heightPx: number) =>
  Math.max(1, Math.ceil(heightPx / PAGE_SIZES[doc.page.size].height))

// --- Markdown ---------------------------------------------------------------------------------
const escapeMd = (s: string) => s.replace(/([\\`*_{}[\]()#+\-!>])/g, '\\$1')
function runMarkdown(r: Run): string {
  let t = r.marks.includes('code') ? `\`${r.text}\`` : escapeMd(r.text)
  if (r.marks.includes('bold')) t = `**${t}**`
  if (r.marks.includes('italic')) t = `*${t}*`
  if (r.marks.includes('strike')) t = `~~${t}~~`
  if (r.marks.includes('underline')) t = `<u>${t}</u>`
  if (r.link) t = `[${t}](${r.link})`
  return t
}
/** Markdown for the whole document; underline and alignment have no Markdown and degrade. */
export function toMarkdown(doc: TextDocument): string {
  const lines: string[] = []
  let number = 0
  for (const b of doc.blocks) {
    const text = b.runs.map(runMarkdown).join('').replace(/\n/g, '  \n')
    if (b.type !== 'numbered') number = 0
    switch (b.type) {
      case 'title':
        lines.push(`# ${text}`, '')
        break
      case 'heading1':
        lines.push(`## ${text}`, '')
        break
      case 'heading2':
        lines.push(`### ${text}`, '')
        break
      case 'heading3':
        lines.push(`#### ${text}`, '')
        break
      case 'bullet':
        lines.push(`${'  '.repeat(b.indent)}- ${text}`)
        break
      case 'numbered':
        number++
        lines.push(`${'   '.repeat(b.indent)}${number}. ${text}`)
        break
      case 'quote':
        lines.push(`> ${text}`, '')
        break
      case 'code':
        lines.push('```', blockText(b), '```', '')
        break
      case 'divider':
        lines.push('---', '')
        break
      case 'image':
        lines.push(`![${b.alt}](${b.src})`, '')
        break
      default:
        lines.push(text, '')
    }
  }
  return (
    lines
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim() + '\n'
  )
}
/** Inline Markdown (bold, italic, strike, code, links) into runs. */
export function parseInline(text: string): Run[] {
  const runs: Run[] = []
  const pattern =
    /(\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|_([^_]+)_|~~([^~]+)~~|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\))/g
  let last = 0
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0
    if (index > last) runs.push(run(unescapeMd(text.slice(last, index))))
    const [whole, , bold, bold2, italic, italic2, strike, code, linkText, href] = match
    if (bold || bold2)
      runs.push(
        ...parseInline(bold ?? bold2).map((r) => ({ ...r, marks: [...r.marks, 'bold' as Mark] })),
      )
    else if (italic || italic2)
      runs.push(
        ...parseInline(italic ?? italic2).map((r) => ({
          ...r,
          marks: [...r.marks, 'italic' as Mark],
        })),
      )
    else if (strike)
      runs.push(
        ...parseInline(strike).map((r) => ({ ...r, marks: [...r.marks, 'strike' as Mark] })),
      )
    else if (code) runs.push(run(code, ['code']))
    else if (linkText)
      runs.push(...parseInline(linkText).map((r) => ({ ...r, link: safeLink(href) ? href : null })))
    last = index + whole.length
  }
  if (last < text.length) runs.push(run(unescapeMd(text.slice(last))))
  return normalizeRuns(runs)
}
const unescapeMd = (s: string) => s.replace(/\\([\\`*_{}[\]()#+\-!>])/g, '$1')
/** A small Markdown reader: headings, lists, quotes, fenced code, dividers, images, paragraphs. */
export function fromMarkdown(text: string, base = emptyDocument()): TextDocument {
  const blocks: Block[] = []
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  let i = 0
  let paragraph: string[] = []
  const flush = () => {
    if (paragraph.length) blocks.push(newBlock('paragraph', parseInline(paragraph.join('\n'))))
    paragraph = []
  }
  while (i < lines.length) {
    const line = lines[i]
    if (/^```/.test(line)) {
      flush()
      const code: string[] = []
      i++
      while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++])
      i++
      blocks.push(newBlock('code', [run(code.join('\n'))]))
      continue
    }
    const heading = /^(#{1,4})\s+(.*)$/.exec(line)
    if (heading) {
      flush()
      const level = heading[1].length
      blocks.push(
        newBlock(
          level === 1 ? 'title' : (`heading${level - 1}` as BlockType),
          parseInline(heading[2]),
        ),
      )
      i++
      continue
    }
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      flush()
      blocks.push(newBlock('divider'))
      i++
      continue
    }
    const image = /^!\[([^\]]*)\]\((data:image\/[^)]+)\)\s*$/.exec(line)
    if (image) {
      flush()
      const block = newBlock('image')
      block.alt = image[1]
      block.src = image[2]
      blocks.push(block)
      i++
      continue
    }
    const bullet = /^(\s*)[-*+]\s+(.*)$/.exec(line)
    const numbered = /^(\s*)\d+[.)]\s+(.*)$/.exec(line)
    if (bullet || numbered) {
      flush()
      const m = (bullet ?? numbered)!
      const block = newBlock(bullet ? 'bullet' : 'numbered', parseInline(m[2]))
      block.indent = Math.min(8, Math.floor(m[1].replace(/\t/g, '  ').length / 2))
      blocks.push(block)
      i++
      continue
    }
    if (/^>\s?/.test(line)) {
      flush()
      const quote: string[] = []
      while (i < lines.length && /^>\s?/.test(lines[i])) quote.push(lines[i++].replace(/^>\s?/, ''))
      blocks.push(newBlock('quote', parseInline(quote.join('\n'))))
      continue
    }
    if (!line.trim()) {
      flush()
      i++
      continue
    }
    paragraph.push(line)
    i++
  }
  flush()
  if (!blocks.length) blocks.push(newBlock('paragraph'))
  return { ...base, blocks: blocks.slice(0, MAX_BLOCKS) }
}
