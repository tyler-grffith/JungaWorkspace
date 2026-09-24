// Between the block model and HTML. `blocksToHtml` is the single renderer for the editable
// page, the reader, thumbnails, and exports; `parseRoot` reads an edited contenteditable page
// back into blocks, accepting only the tags the renderer writes (plus the aliases browsers
// produce while editing) so nothing else can enter the saved document.
import {
  newBlock,
  normalizeRuns,
  safeLink,
  type Block,
  type BlockType,
  type Mark,
  type Run,
  type TextDocument,
} from './model'

const escape = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

function runHtml(r: Run): string {
  let html = escape(r.text).replace(/\n/g, '<br>')
  if (r.marks.includes('code')) html = `<code>${html}</code>`
  if (r.marks.includes('bold')) html = `<strong>${html}</strong>`
  if (r.marks.includes('italic')) html = `<em>${html}</em>`
  if (r.marks.includes('underline')) html = `<u>${html}</u>`
  if (r.marks.includes('strike')) html = `<s>${html}</s>`
  if (r.link) html = `<a href="${escape(r.link)}" target="_blank" rel="noopener">${html}</a>`
  return html
}
const TAGS: Record<BlockType, string> = {
  paragraph: 'p',
  title: 'h1',
  heading1: 'h2',
  heading2: 'h3',
  heading3: 'h4',
  bullet: 'li',
  numbered: 'li',
  quote: 'blockquote',
  code: 'pre',
  divider: 'hr',
  image: 'figure',
}
const attrs = (b: Block) =>
  `data-id="${b.id}"${b.align !== 'left' ? ` style="text-align:${b.align}"` : ''}`
const inner = (b: Block) => {
  const html = b.runs.map(runHtml).join('')
  return html || '<br>'
}
function blockHtml(b: Block): string {
  switch (b.type) {
    case 'divider':
      return `<hr data-id="${b.id}">`
    case 'image':
      return `<figure data-id="${b.id}" contenteditable="false" style="text-align:${b.align}"><img src="${b.src}" alt="${escape(b.alt)}" style="width:${b.width}%"></figure>`
    case 'code':
      return `<pre data-id="${b.id}">${escape(b.runs.map((r) => r.text).join('')) || '<br>'}</pre>`
    default:
      return `<${TAGS[b.type]} ${attrs(b)}>${inner(b)}</${TAGS[b.type]}>`
  }
}
/** HTML for a block list, grouping consecutive list items into nested lists by indent. */
export function blocksToHtml(blocks: readonly Block[]): string {
  const out: string[] = []
  // One entry per open list: its tag and whether an <li> is currently open inside it.
  const open: { tag: 'ul' | 'ol'; item: boolean }[] = []
  const closeTo = (depth: number) => {
    while (open.length > depth) {
      const top = open.pop()!
      if (top.item) out.push('</li>')
      out.push(`</${top.tag}>`)
    }
  }
  for (const b of blocks) {
    if (b.type === 'bullet' || b.type === 'numbered') {
      const tag = b.type === 'bullet' ? 'ul' : 'ol'
      const depth = Math.min(b.indent, open.length) + 1
      closeTo(depth)
      if (open.length === depth && open[depth - 1].tag !== tag) closeTo(depth - 1)
      while (open.length < depth) {
        out.push(`<${tag}>`)
        open.push({ tag, item: false })
      }
      const list = open[depth - 1]
      if (list.item) out.push('</li>')
      out.push(blockHtml(b).replace(/<\/li>$/, ''))
      list.item = true
    } else {
      closeTo(0)
      out.push(blockHtml(b))
    }
  }
  closeTo(0)
  return out.join('')
}
/** A complete standalone HTML file for export. */
export function documentHtml(doc: TextDocument, title: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${escape(title)}</title>
<style>
body { max-width: 7.5in; margin: 1in auto; font-family: ${doc.style.fontFamily}; font-size: ${doc.style.fontSize}pt; line-height: ${doc.style.lineHeight}; color: #1f2a24; }
h1 { font-size: 2.2em; margin: 0.4em 0; } h2 { font-size: 1.6em; margin: 1em 0 0.3em; } h3 { font-size: 1.3em; margin: 0.9em 0 0.3em; } h4 { font-size: 1.1em; margin: 0.8em 0 0.3em; }
p, li { margin: 0 0 0.5em; white-space: pre-wrap; } blockquote { margin: 0.6em 0; padding-left: 1em; border-left: 3px solid #cbd5cf; color: #4a5a52; }
pre { background: #f3f5f2; padding: 0.8em 1em; border-radius: 6px; overflow-x: auto; font-family: 'DM Mono', Menlo, Consolas, monospace; font-size: 0.9em; white-space: pre-wrap; }
code { font-family: 'DM Mono', Menlo, Consolas, monospace; background: #f3f5f2; padding: 0 0.25em; border-radius: 3px; }
figure { margin: 1em 0; } img { max-width: 100%; } hr { border: 0; border-top: 1px solid #cbd5cf; margin: 1.2em 0; }
@page { size: ${doc.page.size === 'a4' ? 'A4' : 'letter'}; margin: ${doc.page.margin}in; }
</style></head><body>${blocksToHtml(doc.blocks)}</body></html>`
}

// --- Parsing ---------------------------------------------------------------------------------
const INLINE_MARKS: Record<string, Mark> = {
  B: 'bold',
  STRONG: 'bold',
  I: 'italic',
  EM: 'italic',
  U: 'underline',
  S: 'strike',
  STRIKE: 'strike',
  DEL: 'strike',
  CODE: 'code',
}
const BLOCK_TAGS = new Set([
  'P',
  'DIV',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'UL',
  'OL',
  'LI',
  'BLOCKQUOTE',
  'PRE',
  'HR',
  'FIGURE',
  'TABLE',
  'SECTION',
  'ARTICLE',
  'HEADER',
  'FOOTER',
  'MAIN',
])
const HEADINGS: Record<string, BlockType> = {
  H1: 'title',
  H2: 'heading1',
  H3: 'heading2',
  H4: 'heading3',
  H5: 'heading3',
  H6: 'heading3',
}

type Piece = { kind: 'run'; run: Run } | { kind: 'image'; src: string; alt: string; width: number }
function collectInline(node: Node, marks: Mark[], link: string | null, out: Piece[]) {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = (node.textContent ?? '').replace(/ /g, ' ')
    if (text) out.push({ kind: 'run', run: { text, marks: [...marks], link } })
    return
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return
  const el = node as HTMLElement
  if (el.tagName === 'BR') {
    out.push({ kind: 'run', run: { text: '\n', marks: [...marks], link } })
    return
  }
  if (el.tagName === 'IMG') {
    const src = el.getAttribute('src') ?? ''
    const width = parseFloat(el.style.width) || 100
    if (src.startsWith('data:image/'))
      out.push({
        kind: 'image',
        src,
        alt: el.getAttribute('alt') ?? '',
        width: Math.min(100, Math.max(5, width)),
      })
    return
  }
  const next = [...marks]
  const mark = INLINE_MARKS[el.tagName]
  if (mark && !next.includes(mark)) next.push(mark)
  const style = el.style
  if (style) {
    if ((style.fontWeight === 'bold' || Number(style.fontWeight) >= 600) && !next.includes('bold'))
      next.push('bold')
    if (style.fontStyle === 'italic' && !next.includes('italic')) next.push('italic')
    if (style.textDecoration?.includes('underline') && !next.includes('underline'))
      next.push('underline')
    if (style.textDecoration?.includes('line-through') && !next.includes('strike'))
      next.push('strike')
  }
  let nextLink = link
  if (el.tagName === 'A') {
    const href = el.getAttribute('href') ?? ''
    nextLink = safeLink(href) ? href : link
  }
  for (const child of el.childNodes) collectInline(child, next, nextLink, out)
}
const alignOf = (el: HTMLElement): Block['align'] => {
  const a = el.style.textAlign || el.getAttribute('align') || ''
  return a === 'center' || a === 'right' || a === 'justify' ? a : 'left'
}
const idOf = (el: HTMLElement, used: Set<string>) => {
  const id = el.getAttribute('data-id') ?? ''
  if (/^[A-Za-z0-9_-]{1,40}$/.test(id) && !used.has(id)) {
    used.add(id)
    return id
  }
  let fresh = newBlock().id
  while (used.has(fresh)) fresh = newBlock().id
  used.add(fresh)
  if (el.isConnected) el.setAttribute('data-id', fresh)
  return fresh
}
/** Turn inline pieces into text blocks and image blocks. */
function piecesToBlocks(
  pieces: Piece[],
  type: BlockType,
  align: Block['align'],
  indent: number,
  id: string,
  used: Set<string>,
): Block[] {
  const blocks: Block[] = []
  let runs: Run[] = []
  let first = true
  const flushRuns = (force = false) => {
    const normalized = normalizeRuns(runs)
    // Drop the trailing newline browsers keep for an empty last line.
    if (normalized.length && normalized[normalized.length - 1].text.endsWith('\n') && !force) {
      const last = normalized[normalized.length - 1]
      last.text = last.text.replace(/\n$/, '')
      if (!last.text) normalized.pop()
    }
    if (normalized.length || force) {
      const block = newBlock(type, normalized)
      block.id = first ? id : idOf(document.createElement('p'), used)
      block.align = align
      block.indent = indent
      blocks.push(block)
      first = false
    }
    runs = []
  }
  for (const piece of pieces) {
    if (piece.kind === 'run') runs.push(piece.run)
    else {
      flushRuns()
      const image = newBlock('image')
      image.id = first ? id : idOf(document.createElement('p'), used)
      image.src = piece.src
      image.alt = piece.alt
      image.width = piece.width
      image.align = align
      blocks.push(image)
      first = false
    }
  }
  flushRuns(first)
  return blocks
}
function parseElement(el: HTMLElement, blocks: Block[], used: Set<string>, indent: number) {
  const tag = el.tagName
  // An element with no children at all is invisible on the page; browsers leave these behind.
  if (!el.childNodes.length && tag !== 'HR') return
  if (tag === 'HR') {
    const b = newBlock('divider')
    b.id = idOf(el, used)
    blocks.push(b)
    return
  }
  if (tag === 'PRE') {
    const b = newBlock(
      'code',
      normalizeRuns([{ text: (el.textContent ?? '').replace(/\n$/, ''), marks: [], link: null }]),
    )
    b.id = idOf(el, used)
    blocks.push(b)
    return
  }
  if (tag === 'UL' || tag === 'OL') {
    for (const child of el.children) {
      const li = child as HTMLElement
      if (li.tagName !== 'LI') {
        if (li.tagName === 'UL' || li.tagName === 'OL') parseElement(li, blocks, used, indent + 1)
        continue
      }
      const pieces: Piece[] = []
      const nested: HTMLElement[] = []
      for (const node of li.childNodes) {
        const t = (node as HTMLElement).tagName
        if (t === 'UL' || t === 'OL') nested.push(node as HTMLElement)
        else if (t && BLOCK_TAGS.has(t)) {
          for (const inlineNode of node.childNodes) collectInline(inlineNode, [], null, pieces)
        } else collectInline(node, [], null, pieces)
      }
      blocks.push(
        ...piecesToBlocks(
          pieces,
          tag === 'UL' ? 'bullet' : 'numbered',
          alignOf(li),
          indent,
          idOf(li, used),
          used,
        ),
      )
      for (const list of nested) parseElement(list, blocks, used, indent + 1)
    }
    return
  }
  if (tag === 'FIGURE') {
    const img = el.querySelector('img')
    const pieces: Piece[] = []
    if (img) collectInline(img, [], null, pieces)
    if (pieces.length)
      blocks.push(...piecesToBlocks(pieces, 'paragraph', alignOf(el), 0, idOf(el, used), used))
    return
  }
  const type: BlockType = HEADINGS[tag] ?? (tag === 'BLOCKQUOTE' ? 'quote' : 'paragraph')
  const children = [...el.childNodes]
  const hasBlockChildren = children.some((n) => BLOCK_TAGS.has((n as HTMLElement).tagName ?? ''))
  if (hasBlockChildren && type !== 'quote') {
    parseChildren(children, blocks, used, indent)
    return
  }
  if (hasBlockChildren) {
    // A quote containing paragraphs: each becomes a quote block.
    const start = blocks.length
    parseChildren(children, blocks, used, indent)
    for (let i = start; i < blocks.length; i++)
      if (blocks[i].type === 'paragraph') blocks[i] = { ...blocks[i], type: 'quote' }
    return
  }
  const pieces: Piece[] = []
  for (const node of children) collectInline(node, [], null, pieces)
  blocks.push(...piecesToBlocks(pieces, type, alignOf(el), 0, idOf(el, used), used))
}
function parseChildren(nodes: Node[], blocks: Block[], used: Set<string>, indent: number) {
  let pending: Node[] = []
  const flush = () => {
    if (!pending.length) return
    const pieces: Piece[] = []
    for (const n of pending) collectInline(n, [], null, pieces)
    const hasText = pieces.some((p) => p.kind === 'image' || p.run.text.trim())
    if (hasText)
      blocks.push(
        ...piecesToBlocks(
          pieces,
          'paragraph',
          'left',
          0,
          idOf(document.createElement('p'), used),
          used,
        ),
      )
    pending = []
  }
  for (const node of nodes) {
    const tag = (node as HTMLElement).tagName ?? ''
    if (node.nodeType === Node.ELEMENT_NODE && BLOCK_TAGS.has(tag)) {
      flush()
      if (
        tag === 'TABLE' ||
        tag === 'SECTION' ||
        tag === 'ARTICLE' ||
        tag === 'HEADER' ||
        tag === 'FOOTER' ||
        tag === 'MAIN'
      )
        parseChildren([...node.childNodes], blocks, used, indent)
      else parseElement(node as HTMLElement, blocks, used, indent)
    } else if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE)
      pending.push(node)
  }
  flush()
}
/** Blocks from an edited page (or any pasted/imported HTML fragment). */
export function parseRoot(root: HTMLElement): Block[] {
  const blocks: Block[] = []
  parseChildren([...root.childNodes], blocks, new Set(), 0)
  return blocks.length ? blocks : [newBlock('paragraph')]
}
export function parseHtml(html: string): Block[] {
  const parsed = new DOMParser().parseFromString(html, 'text/html')
  return parseRoot(parsed.body)
}
