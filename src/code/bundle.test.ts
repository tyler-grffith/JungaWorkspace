import { describe, expect, it } from 'vitest'
import { MODULE_ORIGIN, buildRunDocument, dataUrl, rewriteCss, rewriteModule } from './bundle'
import { emptyCode } from './model'

const known = new Set(['main.js', 'lib/util.js', 'data.json'])

describe('module rewriting', () => {
  it('points the project’s own specifiers at the module origin', () => {
    const source = [
      "import { a } from './lib/util.js'",
      "export { b } from '/data.json'",
      "const c = await import('./lib/util.js')",
      "import './main.js'",
    ].join('\n')
    const { code, missing } = rewriteModule('main.js', source, known)
    expect(missing).toEqual([])
    expect(code).toContain(`from '${MODULE_ORIGIN}/lib/util.js'`)
    expect(code).toContain(`from '${MODULE_ORIGIN}/data.json'`)
    expect(code).toContain(`import('${MODULE_ORIGIN}/lib/util.js')`)
    expect(code).toContain(`import '${MODULE_ORIGIN}/main.js'`)
  })
  it('leaves bare names and absolute URLs alone and reports unknown files', () => {
    const source =
      "import p5 from 'p5'\nimport x from 'https://cdn.example/x.js'\nimport y from './gone.js'"
    const { code, missing } = rewriteModule('main.js', source, known)
    expect(code).toContain("from 'p5'")
    expect(code).toContain("from 'https://cdn.example/x.js'")
    expect(code).toContain("from './gone.js'")
    expect(missing).toEqual(['./gone.js'])
  })
  it('resolves relative to the importing file', () => {
    const { code } = rewriteModule('lib/util.js', "import '../main.js'", known)
    expect(code).toContain(`'${MODULE_ORIGIN}/main.js'`)
  })
})

describe('stylesheet rewriting', () => {
  it('swaps project url() and @import targets for their data URLs', () => {
    const urls = new Map([['art/logo.svg', dataUrl('art/logo.svg', '<svg/>')]])
    const { code, missing } = rewriteCss(
      'styles.css',
      "@import './theme.css';\nbody { background: url('./art/logo.svg'); }",
      urls,
    )
    expect(code).toContain(urls.get('art/logo.svg'))
    expect(missing).toEqual(['./theme.css'])
  })
})

describe('run document', () => {
  const built = buildRunDocument(emptyCode().files, 'index.html')
  it('keeps the entry markup and injects an import map before the modules run', () => {
    expect(built.missing).toEqual([])
    expect(built.html).toContain('Hello from your code project')
    expect(built.html.indexOf('importmap')).toBeLessThan(built.html.indexOf('<body>'))
    expect(built.html).toContain(`"${MODULE_ORIGIN}/main.js"`)
    expect(built.html).toContain(`"${MODULE_ORIGIN}/lib/format.js"`)
  })
  it('replaces entry references with data URLs so nothing is fetched from a server', () => {
    expect(built.html).not.toContain('href="styles.css"')
    expect(built.html).not.toContain('src="main.js"')
    expect(built.html).toContain('data:text/css')
    expect(built.html).toContain('data:text/javascript')
  })
  it('names each module by its project path for stack traces', () => {
    const files = [
      { path: 'index.html', content: '<html><head></head><body></body></html>' },
      { path: 'main.js', content: 'export const x = 1' },
    ]
    const map = buildRunDocument(files, 'index.html').html
    expect(decodeURIComponent(map)).toContain(`//# sourceURL=${MODULE_ORIGIN}/main.js`)
  })
  it('rewrites an inline module script against the entry file', () => {
    const files = [
      {
        path: 'index.html',
        content:
          '<html><head></head><body>\n<script type="module">import "./main.js"</script></body></html>',
      },
      { path: 'main.js', content: 'export const x = 1' },
    ]
    const result = buildRunDocument(files, 'index.html')
    expect(result.html).toContain(`import "${MODULE_ORIGIN}/main.js"`)
    expect(result.missing).toEqual([])
  })
  it('reports references with no matching file instead of dropping them', () => {
    const files = [{ path: 'index.html', content: '<img src="./art/missing.png">' }]
    expect(buildRunDocument(files, 'index.html').missing).toEqual(['./art/missing.png'])
  })
  it('escapes the import map so a project string cannot end the script element', () => {
    const files = [
      { path: 'index.html', content: '<html><head></head><body></body></html>' },
      { path: 'main.js', content: 'export const tag = "</script>"' },
    ]
    expect(buildRunDocument(files, 'index.html').html).not.toContain('"</script>"')
  })
})
