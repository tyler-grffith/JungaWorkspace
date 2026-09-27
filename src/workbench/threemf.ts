// Mesh files beyond STL: Wavefront OBJ (text, one object per body) and 3MF (a zip holding an
// XML model with one object per body and a colour per object), which Bambu Studio, PrusaSlicer,
// and Cura all open directly. The zip is written here without compression, which needs only a
// CRC-32 and a few headers.
import { forEachTriangle, type Mesh } from './geometry'

export type MeshFile = { name: string; mesh: Mesh; color?: string }

/** OBJ text: shared vertex list per object, faces 1-based. */
export function toObj(files: MeshFile[], title = 'junga'): string {
  const lines = [`# ${title} — Junga Workspace`]
  let base = 1
  for (const file of files) {
    lines.push(`o ${file.name.replace(/\s+/g, '_')}`)
    let count = 0
    forEachTriangle(file.mesh, (a, b, c) => {
      for (const p of [a, b, c])
        lines.push(`v ${p.x.toFixed(4)} ${p.y.toFixed(4)} ${p.z.toFixed(4)}`)
      lines.push(`f ${base + count} ${base + count + 1} ${base + count + 2}`)
      count += 3
    })
    base += count
  }
  return lines.join('\n')
}

/** 3MF: a zip with the content types, the relationships, and the model in millimetres. */
export function toThreeMf(files: MeshFile[], title = 'junga'): Blob {
  const materials = files.map((f) => f.color ?? '#9aa7b4')
  const objects = files
    .map((file, index) => {
      const vertices: string[] = []
      const triangles: string[] = []
      // Weld vertices by rounded position so the file describes one surface, not a soup.
      const seen = new Map<string, number>()
      const vertex = (x: number, y: number, z: number) => {
        const key = `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`
        let i = seen.get(key)
        if (i === undefined) {
          i = vertices.length
          seen.set(key, i)
          vertices.push(`<vertex x="${x.toFixed(3)}" y="${y.toFixed(3)}" z="${z.toFixed(3)}"/>`)
        }
        return i
      }
      forEachTriangle(file.mesh, (a, b, c) => {
        const [i, j, k] = [vertex(a.x, a.y, a.z), vertex(b.x, b.y, b.z), vertex(c.x, c.y, c.z)]
        if (i !== j && j !== k && i !== k)
          triangles.push(`<triangle v1="${i}" v2="${j}" v3="${k}"/>`)
      })
      return `<object id="${index + 1}" name="${escapeXml(file.name)}" type="model" pid="${files.length + 1}" pindex="${index}"><mesh><vertices>${vertices.join('')}</vertices><triangles>${triangles.join('')}</triangles></mesh></object>`
    })
    .join('')
  const model = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
<metadata name="Title">${escapeXml(title)}</metadata>
<metadata name="Application">Junga Workspace</metadata>
<resources>
<basematerials id="${files.length + 1}">${materials.map((c, i) => `<base name="${escapeXml(files[i].name)}" displaycolor="${c.toUpperCase()}FF"/>`).join('')}</basematerials>
${objects}
</resources>
<build>${files.map((_, i) => `<item objectid="${i + 1}"/>`).join('')}</build>
</model>`
  const contentTypes = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>`
  const rels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>`
  return new Blob(
    [
      zip([
        ['[Content_Types].xml', contentTypes],
        ['_rels/.rels', rels],
        ['3D/3dmodel.model', model],
      ]),
    ],
    { type: 'model/3mf' },
  )
}
const escapeXml = (s: string) =>
  s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]!)

// --- A stored (uncompressed) zip -------------------------------------------------------------------
const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
/** Zip the given (path, text) entries with the "store" method. */
export function zip(entries: [string, string][]): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder()
  const locals: Uint8Array[] = []
  const centrals: Uint8Array[] = []
  let offset = 0
  for (const [path, text] of entries) {
    const name = encoder.encode(path)
    const data = encoder.encode(text)
    const crc = crc32(data)
    const local = new Uint8Array(30 + name.length + data.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true)
    lv.setUint16(4, 20, true)
    lv.setUint16(8, 0, true)
    lv.setUint32(14, crc, true)
    lv.setUint32(18, data.length, true)
    lv.setUint32(22, data.length, true)
    lv.setUint16(26, name.length, true)
    local.set(name, 30)
    local.set(data, 30 + name.length)
    locals.push(local)
    const central = new Uint8Array(46 + name.length)
    const cv = new DataView(central.buffer)
    cv.setUint32(0, 0x02014b50, true)
    cv.setUint16(4, 20, true)
    cv.setUint16(6, 20, true)
    cv.setUint32(16, crc, true)
    cv.setUint32(20, data.length, true)
    cv.setUint32(24, data.length, true)
    cv.setUint16(28, name.length, true)
    cv.setUint32(42, offset, true)
    central.set(name, 46)
    centrals.push(central)
    offset += local.length
  }
  const centralSize = centrals.reduce((s, c) => s + c.length, 0)
  const end = new Uint8Array(22)
  const ev = new DataView(end.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(8, entries.length, true)
  ev.setUint16(10, entries.length, true)
  ev.setUint32(12, centralSize, true)
  ev.setUint32(16, offset, true)
  const out = new Uint8Array(new ArrayBuffer(offset + centralSize + 22))
  let at = 0
  for (const part of [...locals, ...centrals, end]) {
    out.set(part, at)
    at += part.length
  }
  return out
}
