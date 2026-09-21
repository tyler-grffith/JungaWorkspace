// Turns a code project's files into one runnable HTML document for a sandboxed iframe.
//
// There is no server and no build step. Every file except the entry document becomes a data:
// URL, and an import map rewrites the project's own relative specifiers onto those URLs.
// data: is used rather than blob: because the iframe runs in an opaque origin (sandbox without
// allow-same-origin), which cannot read blob: URLs minted by this document. The opaque origin is
// what keeps the running code away from the saved library in local storage.
import { extensionOf, resolveFrom, type CodeFile } from './model'

/** Fake origin for the project's own modules. Nothing is ever fetched from it; the import map
 *  redirects each specifier to a data: URL before the network is consulted. */
export const MODULE_ORIGIN = 'https://project.junga.local'

const MIME: Record<string, string> = {
  html: 'text/html',
  htm: 'text/html',
  css: 'text/css',
  js: 'text/javascript',
  mjs: 'text/javascript',
  jsx: 'text/javascript',
  ts: 'text/javascript',
  tsx: 'text/javascript',
  json: 'application/json',
  md: 'text/markdown',
  txt: 'text/plain',
  csv: 'text/csv',
  svg: 'image/svg+xml',
  xml: 'application/xml',
  yml: 'text/plain',
  yaml: 'text/plain',
  frag: 'text/plain',
  vert: 'text/plain',
  glsl: 'text/plain',
}
export const mimeFor = (path: string) => MIME[extensionOf(path)] ?? 'text/plain'

export const dataUrl = (path: string, content: string) =>
  `data:${mimeFor(path)};charset=utf-8,${encodeURIComponent(content)}`

/** Module specifiers only: a bare name such as `p5` is a package, never a file in the project. */
const isProjectSpecifier = (value: string) =>
  value.startsWith('./') || value.startsWith('../') || value.startsWith('/')

/**
 * Markup and stylesheet references, where `styles.css` does mean a file in the project. Anything
 * carrying a scheme (https:, data:, mailto:), a protocol-relative host, or a bare fragment is left
 * for the browser to handle.
 */
const isRelativeReference = (value: string) =>
  value !== '' &&
  !value.startsWith('#') &&
  !value.startsWith('//') &&
  !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)

// `import(` before `import ` so a dynamic import is not read as a bare one.
const SPECIFIER = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(["'])([^"'\n]*)\2/g

export type Rewrite = { code: string; missing: string[] }

/**
 * Point the project's own relative import specifiers at MODULE_ORIGIN, leaving bare names and
 * absolute URLs (a CDN, for instance) untouched. Specifiers are matched textually, so one written
 * inside a string or comment is rewritten too; that is harmless for the fake origin.
 */
export function rewriteModule(fromPath: string, code: string, known: Set<string>): Rewrite {
  const missing: string[] = []
  const next = code.replace(SPECIFIER, (match, lead: string, quote: string, spec: string) => {
    if (!isProjectSpecifier(spec)) return match
    const [bare] = spec.split(/[?#]/)
    const resolved = resolveFrom(fromPath, bare)
    if (!resolved || !known.has(resolved)) {
      missing.push(spec)
      return match
    }
    return `${lead}${quote}${MODULE_ORIGIN}/${resolved}${quote}`
  })
  return { code: next, missing }
}

const CSS_URL = /url\(\s*(["']?)([^"')]+)\1\s*\)/g
const CSS_IMPORT = /@import\s+(["'])([^"']+)\1/g

/** Replace relative url() and @import targets in a stylesheet with their data: URLs. */
export function rewriteCss(fromPath: string, code: string, urlFor: Map<string, string>): Rewrite {
  const missing: string[] = []
  const swap = (raw: string) => {
    if (!isRelativeReference(raw)) return null
    const resolved = resolveFrom(fromPath, raw.split(/[?#]/)[0])
    const url = resolved ? urlFor.get(resolved) : undefined
    if (!url) {
      missing.push(raw)
      return null
    }
    return url
  }
  const next = code
    .replace(CSS_IMPORT, (match, quote: string, raw: string) => {
      const url = swap(raw)
      return url ? `@import ${quote}${url}${quote}` : match
    })
    .replace(CSS_URL, (match, quote: string, raw: string) => {
      const url = swap(raw)
      return url ? `url(${quote}${url}${quote})` : match
    })
  return { code: next, missing }
}

const ATTRIBUTE = /\b(src|href|poster|data)\s*=\s*(["'])([^"']*)\2/g
const MODULE_SCRIPT = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi

/** Runs inside the iframe: forwards failures to the editor so a blank page has an explanation. */
const REPORTER = `<script>
(function () {
  var send = function (kind, text) {
    try { parent.postMessage({ jungaRun: true, kind: kind, text: String(text) }, '*') } catch (e) {}
  }
  window.addEventListener('error', function (event) {
    var file = event.filename && event.filename.indexOf('data:') !== 0 ? event.filename : ''
    send('error', event.message + (file ? ' (' + file + ')' : ''))
  })
  window.addEventListener('unhandledrejection', function (event) {
    send('error', 'Unhandled promise rejection: ' + (event.reason && event.reason.message ? event.reason.message : event.reason))
  })
  var forward = function (level) {
    var original = console[level].bind(console)
    console[level] = function () {
      send(level, Array.prototype.map.call(arguments, function (value) {
        try { return typeof value === 'string' ? value : JSON.stringify(value) } catch (e) { return String(value) }
      }).join(' '))
      return original.apply(null, arguments)
    }
  }
  forward('log'); forward('warn'); forward('error')
})()
</script>`

export type RunDocument = { html: string; missing: string[] }

/**
 * Build the document for the iframe. `entry` must name an HTML file in `files`; the caller
 * reports a missing entry, because that is an authoring problem rather than a build failure.
 */
export function buildRunDocument(files: readonly CodeFile[], entry: string): RunDocument {
  const known = new Set(files.map((file) => file.path))
  const missing: string[] = []
  const urlFor = new Map<string, string>()

  // Assets first: stylesheets and modules may point at them.
  for (const file of files) {
    if (file.path === entry) continue
    const extension = extensionOf(file.path)
    if (['js', 'mjs', 'jsx', 'ts', 'tsx', 'css'].includes(extension)) continue
    urlFor.set(file.path, dataUrl(file.path, file.content))
  }
  for (const file of files) {
    if (file.path === entry || extensionOf(file.path) !== 'css') continue
    const result = rewriteCss(file.path, file.content, urlFor)
    missing.push(...result.missing)
    urlFor.set(file.path, dataUrl(file.path, result.code))
  }
  for (const file of files) {
    if (file.path === entry) continue
    if (!['js', 'mjs', 'jsx', 'ts', 'tsx'].includes(extensionOf(file.path))) continue
    const result = rewriteModule(file.path, file.content, known)
    missing.push(...result.missing)
    // sourceURL gives the module its project path in stack traces and browser dev tools,
    // which a data: URL otherwise replaces with the whole encoded file.
    const named = `${result.code}\n//# sourceURL=${MODULE_ORIGIN}/${file.path}\n`
    urlFor.set(file.path, dataUrl(file.path, named))
  }

  const imports = Object.fromEntries(
    [...urlFor].map(([path, url]) => [`${MODULE_ORIGIN}/${path}`, url]),
  )
  const importMap = `<script type="importmap">${JSON.stringify({ imports }).replace(/</g, '\\u003c')}</script>`

  const source = files.find((file) => file.path === entry)?.content ?? ''
  let html = source.replace(MODULE_SCRIPT, (match, attributes: string, body: string) => {
    if (!body.trim() || /\bsrc\s*=/.test(attributes)) return match
    const result = rewriteModule(entry, body, known)
    missing.push(...result.missing)
    return `<script${attributes}>${result.code}</script>`
  })
  html = html.replace(ATTRIBUTE, (match, attribute: string, quote: string, raw: string) => {
    if (!isRelativeReference(raw)) return match
    const resolved = resolveFrom(entry, raw.split(/[?#]/)[0])
    const url = resolved ? urlFor.get(resolved) : undefined
    if (!url) {
      missing.push(raw)
      return match
    }
    return `${attribute}=${quote}${url}${quote}`
  })

  const head = /<head\b[^>]*>/i.exec(html)
  const injected = `${REPORTER}${importMap}`
  html = head
    ? html.slice(0, head.index + head[0].length) +
      injected +
      html.slice(head.index + head[0].length)
    : injected + html

  return { html, missing: [...new Set(missing)] }
}
