// Saved document for the code module: a flat list of text files whose paths carry the folder
// structure. The tree in the editor is derived from these paths, so renaming a folder is a
// path rewrite rather than a second structure to keep in sync.
export type CodeFile = { path: string; content: string }
export type CodeDocument = { version: 1; files: CodeFile[]; entry: string }

/** Bounds keep a project inside the library's shared local-storage budget. */
export const MAX_FILES = 100
export const MAX_FILE_CHARS = 128 * 1024
export const MAX_TOTAL_CHARS = 512 * 1024
export const MAX_PATH = 200
export const MAX_DEPTH = 8

const SEGMENT = /^[A-Za-z0-9._-]+$/

/** Text extensions the editor can open. Anything else is refused on import. */
export const TEXT_EXTENSIONS = [
  'html',
  'htm',
  'css',
  'js',
  'mjs',
  'jsx',
  'ts',
  'tsx',
  'json',
  'md',
  'txt',
  'csv',
  'svg',
  'frag',
  'vert',
  'glsl',
  'xml',
  'yml',
  'yaml',
] as const

export const extensionOf = (path: string) => {
  const name = path.slice(path.lastIndexOf('/') + 1)
  const dot = name.lastIndexOf('.')
  return dot <= 0 ? '' : name.slice(dot + 1).toLowerCase()
}
export const isTextPath = (path: string) =>
  (TEXT_EXTENSIONS as readonly string[]).includes(extensionOf(path))

/**
 * Reduce a path to the stored form: forward slashes, no leading slash, no `.` or `..`.
 * Returns '' when the path cannot be stored, so callers report one message.
 */
export function normalizePath(raw: string): string {
  const trimmed = raw.trim().replace(/\\/g, '/').replace(/^\/+/, '')
  if (!trimmed || trimmed.length > MAX_PATH) return ''
  const segments = trimmed.split('/').filter((segment) => segment !== '')
  if (!segments.length || segments.length > MAX_DEPTH) return ''
  if (!segments.every((segment) => SEGMENT.test(segment) && segment !== '.' && segment !== '..'))
    return ''
  return segments.join('/')
}

/** Resolve a relative specifier against the file that wrote it. Returns '' when it escapes. */
export function resolveFrom(fromPath: string, specifier: string): string {
  const base = fromPath.split('/').slice(0, -1)
  const absolute = specifier.startsWith('/')
  const parts = specifier.replace(/^\//, '').split('/')
  const out = absolute ? [] : [...base]
  for (const part of parts) {
    if (part === '' || part === '.') continue
    if (part === '..') {
      if (!out.length) return ''
      out.pop()
      continue
    }
    out.push(part)
  }
  return normalizePath(out.join('/'))
}

export const fileAt = (document: CodeDocument, path: string) =>
  document.files.find((file) => file.path === path) ?? null

export const totalChars = (files: readonly CodeFile[]) =>
  files.reduce((sum, file) => sum + file.path.length + file.content.length, 0)

/** Files sorted the way the tree shows them: folders first, then names, case-insensitive. */
export function sortFiles(files: readonly CodeFile[]): CodeFile[] {
  return [...files].sort((a, b) => {
    const left = a.path.split('/')
    const right = b.path.split('/')
    for (let i = 0; i < Math.max(left.length, right.length); i++) {
      const l = left[i]
      const r = right[i]
      if (l === undefined) return -1
      if (r === undefined) return 1
      if (l !== r) {
        const lFolder = i < left.length - 1
        const rFolder = i < right.length - 1
        if (lFolder !== rFolder) return lFolder ? -1 : 1
        return l.localeCompare(r, undefined, { sensitivity: 'base' }) || (l < r ? -1 : 1)
      }
    }
    return 0
  })
}

export function validCode(value: unknown): value is CodeDocument {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const doc = value as Record<string, unknown>
  if (Object.keys(doc).length !== 3) return false
  if (doc.version !== 1 || !Array.isArray(doc.files)) return false
  if (doc.files.length > MAX_FILES) return false
  const seen = new Set<string>()
  for (const file of doc.files) {
    if (typeof file !== 'object' || file === null || Array.isArray(file)) return false
    const entry = file as Record<string, unknown>
    if (Object.keys(entry).length !== 2) return false
    if (typeof entry.path !== 'string' || typeof entry.content !== 'string') return false
    if (normalizePath(entry.path) !== entry.path) return false
    if (!isTextPath(entry.path)) return false
    if (entry.content.length > MAX_FILE_CHARS) return false
    const key = entry.path.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
  }
  if (totalChars(doc.files as CodeFile[]) > MAX_TOTAL_CHARS) return false
  if (typeof doc.entry !== 'string') return false
  if (doc.entry !== '' && !(doc.files as CodeFile[]).some((file) => file.path === doc.entry))
    return false
  return true
}

const STARTER_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>New output</title>
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <main>
      <h1>Hello from your code project</h1>
      <p id="count">Clicked 0 times</p>
      <button id="go">Click me</button>
    </main>
    <script type="module" src="main.js"></script>
  </body>
</html>
`
const STARTER_CSS = `body {
  margin: 0;
  display: grid;
  place-items: center;
  min-height: 100vh;
  font-family: system-ui, sans-serif;
  background: #101410;
  color: #e8efe6;
}
main {
  text-align: center;
}
button {
  font: inherit;
  padding: 0.6rem 1.2rem;
  border: 0;
  border-radius: 999px;
  background: #3f6f43;
  color: #fff;
  cursor: pointer;
}
`
const STARTER_JS = `import { plural } from './lib/format.js'

let clicks = 0
const count = document.getElementById('count')
document.getElementById('go').addEventListener('click', () => {
  clicks += 1
  count.textContent = \`Clicked \${clicks} \${plural(clicks, 'time', 'times')}\`
})
`
const STARTER_LIB = `export function plural(value, one, many) {
  return value === 1 ? one : many
}
`

/** A new code project starts runnable, so Run and an output work before anything is typed. */
export function emptyCode(): CodeDocument {
  return {
    version: 1,
    entry: 'index.html',
    files: [
      { path: 'index.html', content: STARTER_HTML },
      { path: 'styles.css', content: STARTER_CSS },
      { path: 'main.js', content: STARTER_JS },
      { path: 'lib/format.js', content: STARTER_LIB },
    ],
  }
}

/** Entry candidates an output may point at. */
export const entryCandidates = (document: CodeDocument) =>
  sortFiles(document.files.filter((file) => ['html', 'htm'].includes(extensionOf(file.path))))
