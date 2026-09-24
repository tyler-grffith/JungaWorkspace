// Export targets for a canvas: pure functions from a document to SVG text, PNG blobs, and a
// printable multi-page view for PDF. The PPTX and GIF targets are later increments; see the
// feature record.
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { CanvasDocument, Page } from './model'
import { elementBounds, union, type Rect } from './geometry'
import { PageView } from './render'

/** The bounds worth exporting: the page, or the content of an unbounded board with a margin. */
export function exportBounds(document: CanvasDocument, page: Page, margin = 40): Rect {
  if (!document.page.infinite || !page.elements.length)
    return { x: 0, y: 0, width: document.page.width, height: document.page.height }
  const b = union(page.elements.map((e) => elementBounds(e, page)))
  return {
    x: b.x - margin,
    y: b.y - margin,
    width: b.width + margin * 2,
    height: b.height + margin * 2,
  }
}

/** Standalone SVG text for one page. */
export function pageSvg(document: CanvasDocument, page: Page): string {
  const bounds = exportBounds(document, page)
  const markup = renderToStaticMarkup(
    createElement(PageView, { page, size: document.page, scope: 'export', bounds }),
  )
  return `<?xml version="1.0" encoding="UTF-8"?>\n${markup
    .replace('<svg ', `<svg width="${bounds.width}" height="${bounds.height}" `)
    .replace(/ class="[^"]*"/, '')}`
}

/** Rasterize one page to PNG at `scale` device pixels per canvas unit. */
export function pagePng(document: CanvasDocument, page: Page, scale = 2): Promise<Blob> {
  const bounds = exportBounds(document, page)
  const svg = pageSvg(document, page)
  return new Promise((resolve, reject) => {
    const image = new Image()
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
    image.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = window.document.createElement('canvas')
      canvas.width = Math.round(bounds.width * scale)
      canvas.height = Math.round(bounds.height * scale)
      const context = canvas.getContext('2d')
      if (!context) return reject(new Error('This browser cannot draw the export.'))
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('The PNG could not be encoded.'))),
        'image/png',
      )
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('The page could not be rendered as an image.'))
    }
    image.src = url
  })
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = window.document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export const safeFilename = (title: string) =>
  title
    .replace(/[^a-z0-9-_ ]/gi, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase() || 'canvas'

/**
 * Open a print view with one page per sheet, sized to the canvas in inches at 96 px/in, so the
 * browser's Save as PDF produces a PDF of the whole document.
 */
export function printPdf(document: CanvasDocument, title: string) {
  const first = exportBounds(document, document.pages[0])
  const widthIn = first.width / 96
  const heightIn = first.height / 96
  const pages = document.pages
    .map((page) => {
      const svg = pageSvg(document, page).replace(/^<\?xml[^>]*>\n/, '')
      return `<section class="sheet">${svg}</section>`
    })
    .join('\n')
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
@page { size: ${widthIn.toFixed(3)}in ${heightIn.toFixed(3)}in; margin: 0; }
html, body { margin: 0; padding: 0; background: #fff; }
.sheet { width: ${widthIn.toFixed(3)}in; height: ${heightIn.toFixed(3)}in; page-break-after: always; break-after: page; overflow: hidden; display: block; }
.sheet svg { width: 100%; height: 100%; display: block; }
</style></head><body>${pages}</body></html>`
  const frame = window.document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.position = 'fixed'
  frame.style.right = '0'
  frame.style.bottom = '0'
  frame.style.width = '0'
  frame.style.height = '0'
  frame.style.border = '0'
  window.document.body.appendChild(frame)
  const doc = frame.contentDocument!
  doc.open()
  doc.write(html)
  doc.close()
  const cleanup = () => setTimeout(() => frame.remove(), 500)
  frame.contentWindow!.addEventListener('afterprint', cleanup)
  setTimeout(() => {
    frame.contentWindow!.focus()
    frame.contentWindow!.print()
  }, 300)
}
const escapeHtml = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
