// Block-level edits on the live contenteditable page. The browser handles typing, selection,
// and undo natively; these functions handle the structural changes (headings, lists, indent,
// inserts) that `execCommand` gets wrong, and keep the caret where the writer expects it.
const LIST = /^(UL|OL)$/
const BLOCK = /^(P|DIV|H1|H2|H3|H4|H5|H6|BLOCKQUOTE|PRE|LI|FIGURE)$/

/** The block element containing the selection, if it is inside `root`. */
export function blockAt(root: HTMLElement): HTMLElement | null {
  const selection = window.getSelection()
  if (!selection?.anchorNode || !root.contains(selection.anchorNode)) return null
  let node: Node | null = selection.anchorNode
  while (node && node !== root) {
    if (node.nodeType === Node.ELEMENT_NODE && BLOCK.test((node as HTMLElement).tagName))
      return node as HTMLElement
    node = node.parentNode
  }
  return null
}
export function placeCaret(el: Node, atEnd = false) {
  const selection = window.getSelection()
  if (!selection) return
  const range = document.createRange()
  if (atEnd) {
    range.selectNodeContents(el)
    range.collapse(false)
  } else {
    const first = el.firstChild
    if (first && first.nodeType === Node.TEXT_NODE) range.setStart(first, 0)
    else range.setStart(el, 0)
    range.collapse(true)
  }
  selection.removeAllRanges()
  selection.addRange(range)
}
/** Whether the caret sits at the very start of `el`'s text. */
export function caretAtStart(el: HTMLElement): boolean {
  const selection = window.getSelection()
  if (!selection || !selection.isCollapsed) return false
  const range = selection.getRangeAt(0).cloneRange()
  range.selectNodeContents(el)
  range.setEnd(selection.anchorNode!, selection.anchorOffset)
  return range.toString().length === 0
}
export function caretAtEnd(el: HTMLElement): boolean {
  const selection = window.getSelection()
  if (!selection || !selection.isCollapsed) return false
  const range = selection.getRangeAt(0).cloneRange()
  range.selectNodeContents(el)
  range.setStart(selection.anchorNode!, selection.anchorOffset)
  return range.toString().trim().length === 0
}
/** Make sure a block can hold a caret: drop empty text nodes and give an empty block a `<br>`. */
export const ensureContent = (el: HTMLElement) => {
  for (const node of [...el.childNodes])
    if (node.nodeType === Node.TEXT_NODE && !node.textContent) node.remove()
  if (!el.childNodes.length) el.appendChild(document.createElement('br'))
}
/** Swap a block's tag, keeping its children (and therefore the caret) in place. */
export function replaceTag(el: HTMLElement, tag: string): HTMLElement {
  if (el.tagName === tag.toUpperCase()) return el
  const selection = window.getSelection()
  const range = selection?.rangeCount ? selection.getRangeAt(0) : null
  const anchored = range && range.startContainer === el ? range.startOffset : null
  const next = document.createElement(tag)
  const align = el.style.textAlign
  if (align) next.style.textAlign = align
  while (el.firstChild) next.appendChild(el.firstChild)
  ensureContent(next)
  el.replaceWith(next)
  if (anchored !== null) {
    const r = document.createRange()
    r.setStart(next, Math.min(anchored, next.childNodes.length))
    r.collapse(true)
    selection!.removeAllRanges()
    selection!.addRange(r)
  }
  return next
}
/** Turn a paragraph-like block into an item of a `ul`/`ol`, joining an adjacent list of that kind. */
export function toListItem(el: HTMLElement, tag: 'ul' | 'ol'): HTMLElement {
  if (el.tagName === 'LI') {
    const list = el.parentElement!
    if (list.tagName !== tag.toUpperCase()) replaceTag(list, tag)
    return el
  }
  const li = replaceTag(el, 'li')
  const prev = li.previousElementSibling
  const next = li.nextElementSibling
  if (prev && prev.tagName === tag.toUpperCase()) prev.appendChild(li)
  else {
    const list = document.createElement(tag)
    li.replaceWith(list)
    list.appendChild(li)
  }
  const list = li.parentElement!
  if (next && next.tagName === tag.toUpperCase() && next !== list) {
    while (next.firstChild) list.appendChild(next.firstChild)
    next.remove()
  }
  return li
}
/** Lift a list item out of its list into a paragraph, splitting the list around it. */
export function listItemToBlock(li: HTMLElement, tag = 'p'): HTMLElement {
  const list = li.parentElement!
  const block = document.createElement(tag)
  while (li.firstChild) block.appendChild(li.firstChild)
  ensureContent(block)
  const after = list.cloneNode(false) as HTMLElement
  let sibling = li.nextSibling
  while (sibling) {
    const node = sibling
    sibling = sibling.nextSibling
    after.appendChild(node)
  }
  li.remove()
  const host = list.parentElement
  if (host && host.tagName === 'LI') {
    // Nested list: the paragraph becomes a sibling item's content instead of escaping the list.
    host.after(block)
    if (after.childNodes.length) block.after(after)
    if (!list.childNodes.length) list.remove()
    return replaceTag(block, 'li')
  }
  list.after(block)
  if (after.childNodes.length) block.after(after)
  if (!list.childNodes.length) list.remove()
  return block
}
export function indentItem(li: HTMLElement) {
  const prev = li.previousElementSibling
  if (!prev || prev.tagName !== 'LI') return
  let nested = prev.lastElementChild
  if (!nested || !LIST.test(nested.tagName)) {
    nested = document.createElement(li.parentElement!.tagName.toLowerCase())
    prev.appendChild(nested)
  }
  nested.appendChild(li)
}
export function outdentItem(li: HTMLElement): HTMLElement {
  const list = li.parentElement!
  const parentLi = list.parentElement
  if (!parentLi || parentLi.tagName !== 'LI') return listItemToBlock(li)
  const following: Node[] = []
  let sibling = li.nextSibling
  while (sibling) {
    following.push(sibling)
    sibling = sibling.nextSibling
  }
  parentLi.after(li)
  if (following.length) {
    const nested = document.createElement(list.tagName.toLowerCase())
    for (const node of following) nested.appendChild(node)
    li.appendChild(nested)
  }
  if (!list.childNodes.length) list.remove()
  return li
}
/** Insert `html` as blocks after the current block and put the caret in a fresh paragraph after it. */
export function insertBlocksAfter(block: HTMLElement, html: string): HTMLElement {
  const template = document.createElement('template')
  template.innerHTML = html
  const paragraph = document.createElement('p')
  paragraph.appendChild(document.createElement('br'))
  const target = block.tagName === 'LI' ? block.closest('ul, ol')! : block
  target.after(...template.content.childNodes, paragraph)
  placeCaret(paragraph)
  return paragraph
}
export function setAlign(block: HTMLElement, align: 'left' | 'center' | 'right' | 'justify') {
  if (align === 'left') block.style.removeProperty('text-align')
  else block.style.textAlign = align
  if (!block.getAttribute('style')) block.removeAttribute('style')
}
/** The list ancestor kind of a block, if any. */
export const listKind = (block: HTMLElement | null): 'ul' | 'ol' | '' => {
  const li = block?.closest('li')
  if (!li) return ''
  return li.parentElement?.tagName === 'OL' ? 'ol' : 'ul'
}
