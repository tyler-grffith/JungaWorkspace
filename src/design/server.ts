import type { Plugin } from 'vite'
import { createHash } from 'node:crypto'
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { DESIGN_ENDPOINT, validDesign, type DesignSnapshot } from './model.ts'

// This route exists only in the loopback development server, and writes one fixed JSON file.
export function designerServer(): Plugin {
  let file = ''
  let original = ''
  let writing = false
  async function snapshot(): Promise<DesignSnapshot> {
    let raw: string
    try {
      raw = await readFile(file, 'utf8')
    } catch (e) {
      if (process.env.JUNGA_DESIGN_TEST === '1' && (e as NodeJS.ErrnoException).code === 'ENOENT')
        raw = await readFile(original, 'utf8')
      else throw e
    }
    const settings: unknown = JSON.parse(raw)
    if (!validDesign(settings))
      throw new Error('The saved design file is invalid. Repair it before saving a new design.')
    return { settings, revision: createHash('sha256').update(raw).digest('hex') }
  }
  return {
    name: 'junga-local-designer',
    apply: 'serve',
    configureServer(server) {
      original = resolve(server.config.root, 'Design/settings.json')
      file = resolve(
        server.config.root,
        process.env.JUNGA_DESIGN_TEST === '1'
          ? 'node_modules/.cache/junga-designer-test.json'
          : 'Design/settings.json',
      )
      server.middlewares.use(async (req, res, next) => {
        if (req.url?.split('?')[0] !== DESIGN_ENDPOINT) return next()
        const reply = (status: number, data: unknown) => {
          res.statusCode = status
          res.setHeader('Content-Type', 'application/json')
          res.setHeader('Cache-Control', 'no-store')
          res.end(JSON.stringify(data))
        }
        const host = req.headers.host ?? ''
        if (!/^(127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/.test(host))
          return reply(403, { error: 'Designer access requires the local development server.' })
        try {
          if (req.method === 'GET') return reply(200, await snapshot())
          if (req.method !== 'POST') return reply(405, { error: 'Use GET or POST.' })
          if (
            req.headers.origin !== `http://${host}` ||
            req.headers['x-junga-designer'] !== '1' ||
            !req.headers['content-type']?.startsWith('application/json')
          )
            return reply(403, { error: 'Save design settings from this app.' })
          let raw = ''
          for await (const chunk of req) {
            raw += chunk.toString()
            if (Buffer.byteLength(raw) > 12000)
              return reply(413, { error: 'Design settings are too large.' })
          }
          let payload: { settings?: unknown; revision?: unknown }
          try {
            payload = JSON.parse(raw)
          } catch {
            return reply(400, { error: 'Design settings must be valid JSON.' })
          }
          if (!payload || !validDesign(payload.settings) || typeof payload.revision !== 'string')
            return reply(400, { error: 'Check the design settings and try again.' })
          if (writing)
            return reply(409, { error: 'Another design save is in progress. Try again.' })
          writing = true
          try {
            const current = await snapshot()
            if (current.revision !== payload.revision)
              return reply(409, {
                error:
                  'The saved design changed. Keep or download your preview, then load the saved design before trying again.',
              })
            await mkdir(dirname(file), { recursive: true })
            await writeFile(`${file}.tmp`, JSON.stringify(payload.settings, null, 2) + '\n', 'utf8')
            await rename(`${file}.tmp`, file)
            reply(200, await snapshot())
            server.ws.send({ type: 'custom', event: 'junga:design-updated', data: {} })
          } finally {
            writing = false
          }
        } catch (error) {
          reply(500, {
            error:
              error instanceof Error
                ? error.message
                : 'Unable to save the design. Your preview is still available.',
          })
        }
      })
    },
    handleHotUpdate(context) {
      if (resolve(context.file) === file) {
        context.server.ws.send({ type: 'custom', event: 'junga:design-updated', data: {} })
        return []
      }
    },
  }
}
