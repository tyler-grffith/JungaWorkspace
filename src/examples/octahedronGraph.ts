// Graphing example: Octahedron Sections (Parameterized Vertex Based), recreated from Tyler's
// Desmos graph entirely in the calculator: s and h as parameters, t as the slider, the six
// vertices as points, and the section outline as six segments between them. The linked example
// of the same name drives the same vertices from a spreadsheet instead.
import { OCTAHEDRON_URL } from '../linked/model'
import { emptyGraph, type GraphDocument, type GraphEntry } from '../graph/model'

const PURPLE = '#8653a1'
const RED = '#a84832'
const BLUE = '#3e68ae'
const GREEN = '#27664c'
const INK = '#1f1f1f'

const entry = (
  kind: 'expression' | 'point',
  formula: string,
  color: string,
  label = '',
  visible = true,
): GraphEntry => ({ id: crypto.randomUUID(), kind, formula, label, color, visible })
const vertices: [string, string, string, string][] = [
  ['a', 'b', 's/2 * t', '-h/3 * t + h/2'],
  ['c', 'd', '-s/2 * t', '-h/3 * t + h/2'],
  ['f', 'g', '-s/2', '2*h/3 * t - h/2'],
  ['i', 'j', 's/2 * t - s/2', '-h/3 * t - h/2'],
  ['k', 'l', '-s/2 * t + s/2', '-h/3 * t - h/2'],
  ['m', 'n', 's/2', '2*h/3 * t - h/2'],
]
/** The straight segment from (x1, y1) to (x2, y2), drawn only where x lies between its ends. */
const segment = (x1: string, y1: string, x2: string, y2: string) =>
  `${y1} + (${y2} - ${y1}) / (${x2} - ${x1}) * (x - ${x1}) {(x - ${x1}) * (x - ${x2}) < 0}`

export function octahedronGraph(): GraphDocument {
  const colors = [PURPLE, RED, BLUE, GREEN, PURPLE, INK]
  return {
    ...emptyGraph(),
    viewport: { xMin: -6.78, xMax: 9.89, yMin: -5.4, yMax: 6.22 },
    entries: [
      {
        id: crypto.randomUUID(),
        kind: 'note',
        text: 'A plane section through a regular octahedron of edge s, as t moves from 0 to 1. The six vertices are (a,b) … (m,n); the outline joins them in order.',
      },
      {
        id: crypto.randomUUID(),
        kind: 'parameter',
        name: 't',
        value: 0.323,
        min: 0,
        max: 1,
        step: 0.001,
        mode: 'slider',
      },
      {
        id: crypto.randomUUID(),
        kind: 'parameter',
        name: 's',
        value: 5,
        min: 5,
        max: 5,
        step: 1,
        mode: 'constant',
      },
      entry('expression', 'h = sqrt(3) * s / 2', BLUE, 'Height of a face'),
      ...vertices.flatMap(([x, y, fx, fy], i) => [
        entry('expression', `${x} = ${fx}`, colors[i]),
        entry('expression', `${y} = ${fy}`, colors[i]),
      ]),
      ...vertices.map(([x, y], i) =>
        entry('point', `(${x}, ${y})`, colors[i], `P${i + 1} (${x}, ${y})`),
      ),
      ...vertices.map(([x1, y1], i) => {
        const [x2, y2] = vertices[(i + 1) % vertices.length]
        return entry(
          'expression',
          `y = ${segment(x1, y1, x2, y2)}`,
          RED,
          `P${i + 1}–P${((i + 1) % vertices.length) + 1}`,
        )
      }),
    ],
  }
}
export { OCTAHEDRON_URL }
