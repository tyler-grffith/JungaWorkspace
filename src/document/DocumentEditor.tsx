// The Document editor: a page that is one contenteditable region, edited natively by the
// browser (typing, selection, undo) and parsed back into blocks on every change. The model is
// never written back into the page while it has focus, so the caret and native undo survive;
// the page is re-rendered from the model only when the document changes from outside.
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  Bold,
  BookOpen,
  Code,
  Download,
  Image as ImageIcon,
  Indent,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Outdent,
  Redo2,
  RemoveFormatting,
  Strikethrough,
  Underline,
  Undo2,
} from 'lucide-react'
import { useDesign } from '../design/context'
import { readImageFile } from '../canvas/images'
import {
  BLOCK_LABELS,
  FONTS,
  PAGE_SIZES,
  fromMarkdown,
  outline,
  plainText,
  safeLink,
  toMarkdown,
  wordCount,
  type BlockType,
  type TextDocument,
} from './model'
import { blocksToHtml, documentHtml, parseHtml, parseRoot } from './html'
import {
  blockAt,
  caretAtEnd,
  caretAtStart,
  ensureContent,
  indentItem,
  insertBlocksAfter,
  listItemToBlock,
  listKind,
  outdentItem,
  placeCaret,
  replaceTag,
  setAlign,
  toListItem,
} from './blocks'
import DocumentReader from './DocumentReader'
import './document.css'

const BLOCK_TAG: Partial<Record<BlockType, string>> = {
  paragraph: 'p',
  title: 'h1',
  heading1: 'h2',
  heading2: 'h3',
  heading3: 'h4',
  quote: 'blockquote',
  code: 'pre',
}
const TAG_BLOCK: Record<string, BlockType> = {
  P: 'paragraph',
  DIV: 'paragraph',
  H1: 'title',
  H2: 'heading1',
  H3: 'heading2',
  H4: 'heading3',
  BLOCKQUOTE: 'quote',
  PRE: 'code',
  LI: 'bullet',
  FIGURE: 'image',
}
const SHORTCUTS: Record<string, () => { block?: BlockType; list?: 'ul' | 'ol' }> = {
  '#': () => ({ block: 'title' }),
  '##': () => ({ block: 'heading1' }),
  '###': () => ({ block: 'heading2' }),
  '####': () => ({ block: 'heading3' }),
  '-': () => ({ list: 'ul' }),
  '*': () => ({ list: 'ul' }),
  '1.': () => ({ list: 'ol' }),
  '>': () => ({ block: 'quote' }),
  '```': () => ({ block: 'code' }),
}

function download(text: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
const safeName = (title: string) =>
  title
    .replace(/[^a-z0-9-_ ]/gi, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase() || 'document'

export default function DocumentEditor({
  title,
  document: doc,
  readOnly,
  unsaved,
  onBack,
  onChange,
}: {
  title: string
  document: TextDocument
  readOnly: boolean
  unsaved: boolean
  onBack: () => void
  onChange: (next: TextDocument) => boolean
}) {
  const design = useDesign()
  const root = useRef<HTMLDivElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const importInput = useRef<HTMLInputElement>(null)
  /** JSON of the blocks the page currently shows, whether from a render or from our own parse. */
  const shown = useRef('')
  const [state, setState] = useState({
    block: 'paragraph' as BlockType,
    bold: false,
    italic: false,
    underline: false,
    strike: false,
    align: 'left',
    list: '' as '' | 'ul' | 'ol',
    link: false,
  })
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkValue, setLinkValue] = useState('')
  const [exportMenu, setExportMenu] = useState(false)
  const [pageMenu, setPageMenu] = useState(false)
  const [preview, setPreview] = useState(false)
  const [message, setMessage] = useState('')
  const [pages, setPages] = useState(1)
  const [selectedImage, setSelectedImage] = useState<HTMLElement | null>(null)
  const savedSelection = useRef<Range | null>(null)

  // Render the model into the page only when it differs from what the page already shows.
  useEffect(() => {
    const el = root.current
    if (!el) return
    const json = JSON.stringify(doc.blocks)
    if (json === shown.current) return
    el.innerHTML = blocksToHtml(doc.blocks)
    shown.current = json
  }, [doc.blocks])
  useEffect(() => {
    if (!message) return
    const t = setTimeout(() => setMessage(''), 5000)
    return () => clearTimeout(t)
  }, [message])
  useEffect(() => {
    document.execCommand('styleWithCSS', false, 'false')
  }, [])

  const emit = useCallback(
    (next: TextDocument) => {
      shown.current = JSON.stringify(next.blocks)
      return onChange(next)
    },
    [onChange],
  )
  /** Read the page back into blocks and save. */
  const commitFromPage = useCallback(() => {
    const el = root.current
    if (!el || readOnly) return
    const blocks = parseRoot(el)
    if (!emit({ ...doc, blocks }))
      setMessage('This change could not be saved. Check the workspace save error.')
    const page = PAGE_SIZES[doc.page.size]
    setPages(Math.max(1, Math.ceil(el.scrollHeight / page.height)))
  }, [doc, emit, readOnly])

  // Toolbar state follows the selection.
  useEffect(() => {
    const update = () => {
      const el = root.current
      if (!el) return
      const block = blockAt(el)
      if (!block) return
      const listType = listKind(block)
      const inList = listType !== ''
      const selection = window.getSelection()
      const anchor = selection?.anchorNode
      const inLink = !!(
        anchor &&
        (anchor.nodeType === Node.ELEMENT_NODE
          ? (anchor as Element)
          : anchor.parentElement
        )?.closest('a')
      )
      setState({
        block: inList
          ? listType === 'ol'
            ? 'numbered'
            : 'bullet'
          : (TAG_BLOCK[block.tagName] ?? 'paragraph'),
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        strike: document.queryCommandState('strikeThrough'),
        align: (block.closest('li') ?? block).style.textAlign || 'left',
        list: listType,
        link: inLink,
      })
      const figure = block.tagName === 'FIGURE' ? block : null
      setSelectedImage(figure)
    }
    document.addEventListener('selectionchange', update)
    return () => document.removeEventListener('selectionchange', update)
  }, [])

  function focusPage() {
    const el = root.current
    if (!el) return
    if (document.activeElement !== el) {
      el.focus()
      const saved = savedSelection.current
      if (saved) {
        const selection = window.getSelection()
        selection?.removeAllRanges()
        selection?.addRange(saved)
      }
    }
  }
  function command(name: string, value?: string) {
    if (readOnly) return
    focusPage()
    document.execCommand(name, false, value)
    commitFromPage()
  }
  /** Convert the block under the caret; structural edits are ours, not execCommand's. */
  function convertBlock(block: HTMLElement, type: BlockType) {
    if (type === 'bullet' || type === 'numbered') {
      const tag = type === 'bullet' ? 'ul' : 'ol'
      if (block.tagName === 'LI' && listKind(block) === tag) listItemToBlock(block)
      else toListItem(block, tag)
      return
    }
    const target = block.tagName === 'LI' ? listItemToBlock(block) : block
    if (target.tagName !== 'LI') replaceTag(target, BLOCK_TAG[type] ?? 'p')
  }
  function setBlock(type: BlockType) {
    if (readOnly) return
    focusPage()
    const el = root.current!
    const block = blockAt(el)
    if (type === 'image') {
      fileInput.current?.click()
      return
    }
    if (!block) {
      setMessage('Click into the page first.')
      return
    }
    if (type === 'divider') insertBlocksAfter(block, '<hr>')
    else if (block.tagName === 'FIGURE') return
    else convertBlock(block, type)
    commitFromPage()
  }
  function align(value: 'left' | 'center' | 'right' | 'justify') {
    if (readOnly) return
    focusPage()
    const block = blockAt(root.current!)
    if (!block) return
    setAlign(block, value)
    commitFromPage()
  }
  function indent(direction: 'in' | 'out') {
    if (readOnly) return
    focusPage()
    const block = blockAt(root.current!)
    const li = block?.closest('li')
    if (!li) return
    if (direction === 'in') indentItem(li)
    else outdentItem(li)
    commitFromPage()
  }
  function toggleLink() {
    if (readOnly) return
    const selection = window.getSelection()
    if (state.link) {
      command('unlink')
      return
    }
    if (!selection || selection.isCollapsed) {
      setMessage('Select the text that should become a link first.')
      return
    }
    savedSelection.current = selection.getRangeAt(0).cloneRange()
    setLinkValue('https://')
    setLinkOpen(true)
  }
  function applyLink() {
    const url = linkValue.trim()
    setLinkOpen(false)
    if (!safeLink(url)) {
      setMessage('Links must start with https://, http://, or mailto:.')
      return
    }
    command('createLink', url)
    savedSelection.current = null
  }
  async function addImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) await insertImageFile(file)
  }
  /** Insert an image file as a figure after the current block. */
  async function insertImageFile(file: File) {
    try {
      const { src } = await readImageFile(file, 1400)
      const alt = file.name.replace(/\.[^.]+$/, '')
      focusPage()
      const block = blockAt(root.current!) ?? (root.current!.lastElementChild as HTMLElement)
      insertBlocksAfter(
        block,
        `<figure contenteditable="false"><img src="${src}" alt="${alt.replace(/"/g, '')}" style="width:100%"></figure>`,
      )
      commitFromPage()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'That image could not be added.')
    }
  }
  function setImageWidth(width: number) {
    const img = selectedImage?.querySelector('img')
    if (!img) return
    img.style.width = `${width}%`
    commitFromPage()
  }
  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const text = await file.text()
      const blocks = /\.html?$/i.test(file.name) ? parseHtml(text) : fromMarkdown(text, doc).blocks
      const empty = doc.blocks.length === 1 && !doc.blocks[0].runs.length
      const next = { ...doc, blocks: empty ? blocks : [...doc.blocks, ...blocks] }
      if (emit(next)) {
        shown.current = ''
        setMessage(
          `Imported ${blocks.length} ${blocks.length === 1 ? 'block' : 'blocks'} from ${file.name}.`,
        )
      } else setMessage('The import could not be saved. It may pass the document storage limit.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'That file could not be imported.')
    }
  }
  function exportAs(kind: 'md' | 'html' | 'txt' | 'pdf') {
    setExportMenu(false)
    const name = safeName(title)
    if (kind === 'md') download(toMarkdown(doc), `${name}.md`, 'text/markdown')
    else if (kind === 'html') download(documentHtml(doc, title), `${name}.html`, 'text/html')
    else if (kind === 'txt') download(plainText(doc), `${name}.txt`, 'text/plain')
    else {
      const frame = document.createElement('iframe')
      frame.style.position = 'fixed'
      frame.style.width = '0'
      frame.style.height = '0'
      frame.style.border = '0'
      document.body.appendChild(frame)
      frame.contentDocument!.open()
      frame.contentDocument!.write(documentHtml(doc, title))
      frame.contentDocument!.close()
      frame.contentWindow!.addEventListener('afterprint', () =>
        setTimeout(() => frame.remove(), 500),
      )
      setTimeout(() => {
        frame.contentWindow!.focus()
        frame.contentWindow!.print()
      }, 300)
    }
  }

  function keyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (readOnly) return
    const el = root.current!
    const mod = event.ctrlKey || event.metaKey
    const key = event.key.toLowerCase()
    if (mod && key === 'k') {
      event.preventDefault()
      toggleLink()
      return
    }
    if (mod && event.shiftKey && key === 'x') {
      event.preventDefault()
      command('strikeThrough')
      return
    }
    if (mod && event.altKey && /^[0-4]$/.test(event.key)) {
      event.preventDefault()
      setBlock(
        (['paragraph', 'title', 'heading1', 'heading2', 'heading3'] as BlockType[])[
          Number(event.key)
        ],
      )
      return
    }
    const block = blockAt(el)
    const li = block?.closest('li') ?? null
    if (event.key === 'Tab' && li) {
      event.preventDefault()
      indent(event.shiftKey ? 'out' : 'in')
      return
    }
    if (event.key === 'Enter' && block?.tagName === 'PRE' && !event.shiftKey) {
      event.preventDefault()
      document.execCommand('insertText', false, '\n')
      return
    }
    if (
      event.key === 'Enter' &&
      !event.shiftKey &&
      li &&
      !li.textContent?.trim() &&
      !li.querySelector('ul, ol')
    ) {
      // Enter on an empty item leaves the list, as in Docs.
      event.preventDefault()
      const block = outdentItem(li)
      placeCaret(block)
      commitFromPage()
      return
    }
    if (event.key === 'Backspace' && li && caretAtStart(li) && !li.querySelector('ul, ol')) {
      event.preventDefault()
      const block = outdentItem(li)
      placeCaret(block)
      commitFromPage()
      return
    }
    if (
      event.key === 'Backspace' &&
      block &&
      block.tagName !== 'P' &&
      block.tagName !== 'LI' &&
      block.tagName !== 'FIGURE' &&
      caretAtStart(block)
    ) {
      // Backspace at the start of a heading, quote, or code block makes it a paragraph first.
      event.preventDefault()
      const next = replaceTag(block, 'p')
      placeCaret(next)
      commitFromPage()
      return
    }
    if (
      event.key === 'Enter' &&
      !event.shiftKey &&
      block &&
      /^(H[1-4]|BLOCKQUOTE)$/.test(block.tagName) &&
      caretAtEnd(block)
    ) {
      // A new line after a heading or quote is a paragraph, as in Docs.
      event.preventDefault()
      insertBlocksAfter(block, '')
      commitFromPage()
      return
    }
    if (
      event.key === ' ' &&
      block &&
      (block.tagName === 'P' || block.tagName === 'DIV' || block.tagName === 'LI')
    ) {
      const selection = window.getSelection()
      if (!selection || !selection.isCollapsed) return
      const before = selection.getRangeAt(0).cloneRange()
      before.selectNodeContents(block)
      before.setEnd(selection.anchorNode!, selection.anchorOffset)
      const token = before.toString()
      const shortcut = SHORTCUTS[token]
      if (!shortcut || block.textContent !== token) return
      event.preventDefault()
      before.deleteContents()
      const { block: type, list } = shortcut()
      let next: HTMLElement = block
      if (list) next = toListItem(block, list)
      else if (type)
        next = replaceTag(
          block.tagName === 'LI' ? listItemToBlock(block) : block,
          BLOCK_TAG[type] ?? 'p',
        )
      ensureContent(next)
      placeCaret(next)
      commitFromPage()
    }
  }
  function paste(event: ClipboardEvent<HTMLDivElement>) {
    if (readOnly) return
    const image = [...event.clipboardData.files].find((f) => f.type.startsWith('image/'))
    if (image) {
      event.preventDefault()
      void insertImageFile(image)
      return
    }
    const html = event.clipboardData.getData('text/html')
    const text = event.clipboardData.getData('text/plain')
    if (!html && !text) return
    event.preventDefault()
    if (html) {
      const blocks = parseHtml(html)
      const single = blocks.length === 1 && blocks[0].type === 'paragraph'
      const fragment = single
        ? blocksToHtml(blocks)
            .replace(/^<p[^>]*>/, '')
            .replace(/<\/p>$/, '')
        : blocksToHtml(blocks)
      document.execCommand('insertHTML', false, fragment)
    } else document.execCommand('insertText', false, text)
    commitFromPage()
  }

  const headings = useMemo(() => outline(doc), [doc])
  const count = useMemo(() => wordCount(doc), [doc])
  const page = PAGE_SIZES[doc.page.size]
  const updateSettings = (
    next: Partial<TextDocument['style']>,
    pageNext: Partial<TextDocument['page']> = {},
  ) => emit({ ...doc, style: { ...doc.style, ...next }, page: { ...doc.page, ...pageNext } })

  return (
    <div className="doc-editor">
      {preview && (
        <div className="doc-preview-overlay">
          <DocumentReader document={doc} title={title} onExit={() => setPreview(false)} />
        </div>
      )}
      <div className="doc-heading">
        <div>
          <button className="back-link" onClick={onBack}>
            <ArrowLeft size={15} />
            Back to project
          </button>
          <div className="eyebrow">DOCUMENT</div>
          <h1>{title}</h1>
        </div>
        <div className="doc-heading-actions">
          {unsaved && <span className="unsaved-note">Changes not saved</span>}
          {readOnly && <span className="unsaved-note">Read only</span>}
          <div className="doc-menu-anchor">
            <button
              className="button"
              onClick={() => setExportMenu(!exportMenu)}
              aria-expanded={exportMenu}
            >
              <Download size={15} />
              Export
            </button>
            {exportMenu && (
              <div className="doc-menu" role="menu">
                <button role="menuitem" onClick={() => exportAs('pdf')}>
                  PDF (print)
                </button>
                <button role="menuitem" onClick={() => exportAs('md')}>
                  Markdown (.md)
                </button>
                <button role="menuitem" onClick={() => exportAs('html')}>
                  Web page (.html)
                </button>
                <button role="menuitem" onClick={() => exportAs('txt')}>
                  Plain text (.txt)
                </button>
                <hr />
                <button
                  role="menuitem"
                  disabled={readOnly}
                  onClick={() => {
                    setExportMenu(false)
                    importInput.current?.click()
                  }}
                >
                  Import Markdown, HTML, or text…
                </button>
              </div>
            )}
          </div>
          <button className="button primary" onClick={() => setPreview(true)}>
            <BookOpen size={15} />
            Preview
          </button>
        </div>
      </div>
      <div className="doc-toolbar" role="toolbar" aria-label="Formatting">
        <Tool label="Undo (Ctrl+Z)" onClick={() => command('undo')} disabled={readOnly}>
          <Undo2 size={16} />
        </Tool>
        <Tool label="Redo (Ctrl+Y)" onClick={() => command('redo')} disabled={readOnly}>
          <Redo2 size={16} />
        </Tool>
        <span className="doc-toolbar-gap" />
        <select
          aria-label="Text style"
          value={state.block === 'image' || state.block === 'divider' ? 'paragraph' : state.block}
          disabled={readOnly}
          onMouseDown={() => {
            const selection = window.getSelection()
            if (selection?.rangeCount) savedSelection.current = selection.getRangeAt(0).cloneRange()
          }}
          onChange={(e) => setBlock(e.target.value as BlockType)}
        >
          {(
            [
              'paragraph',
              'title',
              'heading1',
              'heading2',
              'heading3',
              'quote',
              'code',
            ] as BlockType[]
          ).map((type) => (
            <option key={type} value={type}>
              {BLOCK_LABELS[type]}
            </option>
          ))}
        </select>
        <span className="doc-toolbar-gap" />
        <Tool
          label="Bold (Ctrl+B)"
          active={state.bold}
          onClick={() => command('bold')}
          disabled={readOnly}
        >
          <Bold size={16} />
        </Tool>
        <Tool
          label="Italic (Ctrl+I)"
          active={state.italic}
          onClick={() => command('italic')}
          disabled={readOnly}
        >
          <Italic size={16} />
        </Tool>
        <Tool
          label="Underline (Ctrl+U)"
          active={state.underline}
          onClick={() => command('underline')}
          disabled={readOnly}
        >
          <Underline size={16} />
        </Tool>
        <Tool
          label="Strikethrough (Ctrl+Shift+X)"
          active={state.strike}
          onClick={() => command('strikeThrough')}
          disabled={readOnly}
        >
          <Strikethrough size={16} />
        </Tool>
        <Tool
          label="Inline code"
          onClick={() => {
            focusPage()
            const selection = window.getSelection()
            if (!selection || selection.isCollapsed) return
            const range = selection.getRangeAt(0)
            const code = document.createElement('code')
            code.appendChild(range.extractContents())
            range.insertNode(code)
            commitFromPage()
          }}
          disabled={readOnly}
        >
          <Code size={16} />
        </Tool>
        <Tool
          label={state.link ? 'Remove link' : 'Insert link (Ctrl+K)'}
          active={state.link}
          onClick={toggleLink}
          disabled={readOnly}
        >
          <Link2 size={16} />
        </Tool>
        <Tool label="Clear formatting" onClick={() => command('removeFormat')} disabled={readOnly}>
          <RemoveFormatting size={16} />
        </Tool>
        <span className="doc-toolbar-gap" />
        <Tool
          label="Align left"
          active={state.align === 'left'}
          onClick={() => align('left')}
          disabled={readOnly}
        >
          <AlignLeft size={16} />
        </Tool>
        <Tool
          label="Align center"
          active={state.align === 'center'}
          onClick={() => align('center')}
          disabled={readOnly}
        >
          <AlignCenter size={16} />
        </Tool>
        <Tool
          label="Align right"
          active={state.align === 'right'}
          onClick={() => align('right')}
          disabled={readOnly}
        >
          <AlignRight size={16} />
        </Tool>
        <Tool
          label="Justify"
          active={state.align === 'justify'}
          onClick={() => align('justify')}
          disabled={readOnly}
        >
          <AlignJustify size={16} />
        </Tool>
        <span className="doc-toolbar-gap" />
        <Tool
          label="Bulleted list"
          active={state.list === 'ul'}
          onClick={() => setBlock('bullet')}
          disabled={readOnly}
        >
          <List size={16} />
        </Tool>
        <Tool
          label="Numbered list"
          active={state.list === 'ol'}
          onClick={() => setBlock('numbered')}
          disabled={readOnly}
        >
          <ListOrdered size={16} />
        </Tool>
        <Tool
          label="Decrease indent"
          onClick={() => indent('out')}
          disabled={readOnly || !state.list}
        >
          <Outdent size={16} />
        </Tool>
        <Tool
          label="Increase indent"
          onClick={() => indent('in')}
          disabled={readOnly || !state.list}
        >
          <Indent size={16} />
        </Tool>
        <span className="doc-toolbar-gap" />
        <Tool label="Insert image" onClick={() => fileInput.current?.click()} disabled={readOnly}>
          <ImageIcon size={16} />
        </Tool>
        <Tool label="Insert divider" onClick={() => setBlock('divider')} disabled={readOnly}>
          <Minus size={16} />
        </Tool>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          hidden
          onChange={addImage}
          aria-label="Image file"
        />
        <input
          ref={importInput}
          type="file"
          accept=".md,.markdown,.txt,.html,.htm,text/markdown,text/plain,text/html"
          hidden
          onChange={importFile}
          aria-label="Import file"
        />
        <span className="doc-toolbar-gap" />
        <select
          aria-label="Font"
          value={
            FONTS.some((f) => f.value === doc.style.fontFamily) ? doc.style.fontFamily : 'other'
          }
          disabled={readOnly}
          onChange={(e) =>
            e.target.value !== 'other' && updateSettings({ fontFamily: e.target.value })
          }
        >
          {FONTS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
          {!FONTS.some((f) => f.value === doc.style.fontFamily) && (
            <option value="other">Custom</option>
          )}
        </select>
        <input
          type="number"
          aria-label="Text size (pt)"
          min={6}
          max={72}
          value={doc.style.fontSize}
          disabled={readOnly}
          onChange={(e) => {
            const size = Number(e.target.value)
            if (size >= 6 && size <= 72) updateSettings({ fontSize: size })
          }}
        />
        <div className="doc-menu-anchor">
          <button
            className="doc-tool"
            aria-expanded={pageMenu}
            onClick={() => setPageMenu(!pageMenu)}
          >
            Page
          </button>
          {pageMenu && (
            <div className="doc-menu left">
              <label>
                Page size
                <select
                  value={doc.page.size}
                  disabled={readOnly}
                  onChange={(e) =>
                    updateSettings({}, { size: e.target.value as TextDocument['page']['size'] })
                  }
                >
                  {Object.entries(PAGE_SIZES).map(([id, p]) => (
                    <option key={id} value={id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Margin (inches)
                <input
                  type="number"
                  min={0.25}
                  max={2}
                  step={0.25}
                  value={doc.page.margin}
                  disabled={readOnly}
                  onChange={(e) => {
                    const margin = Number(e.target.value)
                    if (margin >= 0.25 && margin <= 2) updateSettings({}, { margin })
                  }}
                />
              </label>
              <label>
                Line spacing
                <input
                  type="number"
                  min={0.8}
                  max={3}
                  step={0.1}
                  value={doc.style.lineHeight}
                  disabled={readOnly}
                  onChange={(e) => {
                    const lineHeight = Number(e.target.value)
                    if (lineHeight >= 0.8 && lineHeight <= 3) updateSettings({ lineHeight })
                  }}
                />
              </label>
            </div>
          )}
        </div>
        {selectedImage && !readOnly && (
          <>
            <span className="doc-toolbar-gap" />
            <select
              aria-label="Image width"
              value={String(
                Math.round(
                  parseFloat(selectedImage.querySelector('img')?.style.width ?? '100') || 100,
                ),
              )}
              onChange={(e) => setImageWidth(Number(e.target.value))}
            >
              {[25, 33, 50, 66, 75, 100].map((w) => (
                <option key={w} value={String(w)}>
                  Image {w}%
                </option>
              ))}
            </select>
          </>
        )}
        {message && (
          <span className="doc-message" role="status">
            {message}
          </span>
        )}
      </div>
      {linkOpen && (
        <form
          className="doc-link-form"
          onSubmit={(e) => {
            e.preventDefault()
            applyLink()
          }}
        >
          <label htmlFor="doc-link-url">Link address</label>
          <input
            id="doc-link-url"
            type="url"
            autoFocus
            value={linkValue}
            onChange={(e) => setLinkValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setLinkOpen(false)
            }}
          />
          <button type="submit" className="button primary">
            Apply link
          </button>
          <button type="button" className="button" onClick={() => setLinkOpen(false)}>
            Cancel
          </button>
        </form>
      )}
      <div className={`doc-body ${headings.length ? '' : 'no-outline'}`}>
        {headings.length > 0 && (
          <nav className="doc-outline" aria-label="Document outline">
            <h2>Outline</h2>
            <ul>
              {headings.map((h) => (
                <li key={h.id} className={`level-${h.level}`}>
                  <button
                    type="button"
                    onClick={() =>
                      root.current
                        ?.querySelector(`[data-id="${h.id}"]`)
                        ?.scrollIntoView({ block: 'start', behavior: 'smooth' })
                    }
                  >
                    {h.text}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        )}
        <div className={`doc-desk ${design.document.pageShadow ? '' : 'flat'}`}>
          <div
            ref={root}
            className="doc-page doc-content"
            role="textbox"
            aria-multiline="true"
            aria-label="Document text"
            contentEditable={!readOnly}
            suppressContentEditableWarning
            spellCheck
            style={{
              width: page.width,
              padding: `min(${doc.page.margin}in, 5vw)`,
              fontFamily: doc.style.fontFamily,
              fontSize: `${doc.style.fontSize}pt`,
              lineHeight: doc.style.lineHeight,
            }}
            onInput={commitFromPage}
            onKeyDown={keyDown}
            onPaste={paste}
            onClick={(e) => {
              const figure = (e.target as HTMLElement).closest('figure')
              if (figure && root.current?.contains(figure)) {
                const range = document.createRange()
                range.selectNode(figure)
                const selection = window.getSelection()
                selection?.removeAllRanges()
                selection?.addRange(range)
                setSelectedImage(figure as HTMLElement)
              }
            }}
          />
          <div className="doc-footer">
            <span>
              {count.words} {count.words === 1 ? 'word' : 'words'} · {count.characters} characters
            </span>
            <span>
              About {pages} {pages === 1 ? 'page' : 'pages'} · {page.label.split(' (')[0]} ·{' '}
              {doc.page.margin}" margins
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function Tool({
  children,
  label,
  onClick,
  active = false,
  disabled = false,
}: {
  children: React.ReactNode
  label: string
  onClick: () => void
  active?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      className={`doc-tool ${active ? 'active' : ''}`}
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
