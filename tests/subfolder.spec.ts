import { test, expect } from '@playwright/test'
import { createServer, type Server } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'

// Serve the actual production build, with no SPA fallback and no files at the site root.
// Vite's preview fallback could otherwise hide broken absolute resource references.
const mount = '/personal/tools/junga/'
const root = resolve('dist')
const types: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.json': 'application/json',
  '.geojson': 'application/geo+json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.md': 'text/plain',
  '.txt': 'text/plain',
}
let server: Server
let origin: string

test.beforeAll(async () => {
  server = createServer(async (request, response) => {
    const path = new URL(request.url!, 'http://localhost').pathname
    if (path === mount.slice(0, -1)) {
      response.writeHead(308, { Location: mount }).end()
      return
    }
    if (!path.startsWith(mount)) {
      response.writeHead(404).end()
      return
    }
    const file = resolve(root, decodeURIComponent(path.slice(mount.length)) || 'index.html')
    if (!file.startsWith(root + sep)) {
      response.writeHead(404).end()
      return
    }
    try {
      const data = await readFile(file)
      response
        .writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' })
        .end(data)
    } catch {
      response.writeHead(404).end()
    }
  })
  await new Promise<void>((ready) => server.listen(0, '127.0.0.1', ready))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Missing test server address')
  origin = `http://127.0.0.1:${address.port}`
})
test.afterAll(async () => {
  server.closeAllConnections()
  await new Promise<void>((done) => server.close(() => done()))
})

for (const entry of ['directory', 'index.html'] as const) {
  test(`production assets, scene and hash routes work from a nested ${entry} URL`, async ({
    page,
  }) => {
    const failed: string[] = [],
      escaped: string[] = [],
      requested = new Set<string>(),
      errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('request', (request) => {
      const url = new URL(request.url())
      if (url.protocol !== 'http:' || url.origin !== origin) return
      requested.add(url.pathname)
      if (!url.pathname.startsWith(mount) && url.pathname !== mount.slice(0, -1))
        escaped.push(url.pathname)
    })
    page.on('response', (response) => {
      if (response.status() >= 400) failed.push(response.url())
    })
    page.on('requestfailed', (request) => failed.push(request.url()))
    await page.goto(origin + (entry === 'directory' ? mount.slice(0, -1) : mount + 'index.html'))
    const documentPath = entry === 'directory' ? mount : mount + 'index.html'
    await expect(page.getByRole('heading', { name: 'Your library', exact: true })).toBeVisible()
    expect(new URL(page.url()).pathname).toBe(documentPath)
    await expect
      .poll(() =>
        page.locator('.brand img').evaluate((image) => (image as HTMLImageElement).naturalWidth),
      )
      .toBeGreaterThan(0)
    await page
      .getByRole('navigation', { name: 'Shortcuts', exact: true })
      .getByRole('link', { name: 'Cosmic Clock', exact: true })
      .click()
    const sourceRoute = page.url()
    const creditLink = page.getByRole('link', {
      name: 'Asset attribution, licenses & original sources ↗',
    })
    const creditUrl = new URL((await creditLink.getAttribute('href'))!, page.url())
    expect(creditUrl.pathname).toBe(mount + 'assets/cosmic-clock/CREDITS.md')
    const credits = await page.request.get(creditUrl.href)
    expect(credits.ok()).toBe(true)
    expect(await credits.text()).toContain('NASA Blue Marble')
    await page.getByRole('link', { name: 'Open scene', exact: true }).click()
    await expect(
      page.getByRole('img', { name: 'Interactive three-dimensional Earth' }),
    ).toHaveAttribute('data-ready', 'true', { timeout: 30000 })
    expect(new URL(page.url()).pathname).toBe(documentPath)
    await page.reload()
    await expect(
      page.getByRole('img', { name: 'Interactive three-dimensional Earth' }),
    ).toHaveAttribute('data-ready', 'true', { timeout: 30000 })
    await page.getByRole('button', { name: 'Pause time' }).click()
    await page.getByLabel('Find a time zone').fill('Asia/Kathmandu')
    await expect(page.getByRole('heading', { name: 'Kathmandu', exact: true })).toBeVisible()
    for (const file of ['earth-day.jpg', 'earth-night.jpg', 'timezones.geojson'])
      expect(requested.has(mount + 'assets/cosmic-clock/' + file)).toBe(true)
    expect([...requested].some((path) => path.endsWith('.woff2'))).toBe(true)
    await page.getByRole('link', { name: 'Back to Cosmic Clock', exact: true }).click()
    await expect(page).toHaveURL(sourceRoute)
    expect(failed).toEqual([])
    expect(escaped).toEqual([])
    expect(errors).toEqual([])
  })
}
