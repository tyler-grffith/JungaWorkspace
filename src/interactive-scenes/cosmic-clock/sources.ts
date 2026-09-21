// Raw text for the source files the manifest lists, so Working material can show the actual file
// instead of only its path. Each file is its own lazily loaded chunk: nothing is downloaded until
// someone opens it. Test files are excluded because the manifest never lists them.
const bundled = {
  ...import.meta.glob(
    [
      '/src/interactive-scenes/cosmic-clock/**/*.{ts,tsx,js,mjs,css,md,vert,frag}',
      '!/src/interactive-scenes/cosmic-clock/**/*.test.js',
    ],
    { query: '?raw', import: 'default' },
  ),
  ...import.meta.glob('/src/{outputs.ts,CodeProjectOverview.tsx,OutputPage.tsx}', {
    query: '?raw',
    import: 'default',
  }),
} as Record<string, (() => Promise<string>) | undefined>

const PUBLIC = 'public/'
const IMAGE = /\.(jpe?g|png|webp|gif|avif)$/i

/** How one manifest entry can be shown. `null` means the file is not viewable in the browser. */
export type Material =
  | { kind: 'source'; load: () => Promise<string> }
  | { kind: 'text'; url: string }
  | { kind: 'image'; url: string }

/** Text longer than this is shown truncated; timezones.geojson alone is over a megabyte. */
export const MAX_VIEW_CHARS = 120_000

export function materialFor(path: string): Material | null {
  const load = bundled[`/${path}`]
  if (load) return { kind: 'source', load }
  if (!path.startsWith(PUBLIC)) return null
  const url = `${import.meta.env.BASE_URL}${path.slice(PUBLIC.length)}`
  return IMAGE.test(path) ? { kind: 'image', url } : { kind: 'text', url }
}

export const isViewable = (path: string) => materialFor(path) !== null
