import { wrapLongitude, clamp } from './math.js'

function inRing(lon, lat, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i],
      [xj, yj] = ring[j]
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}
export function contains(lon, lat, polygon) {
  return inRing(lon, lat, polygon[0]) && !polygon.slice(1).some((ring) => inRing(lon, lat, ring))
}
export function oceanZone(lon) {
  const offset = clamp(Math.floor((wrapLongitude(lon) + 7.5) / 15), -12, 12)
  return {
    id: 0,
    tzid: offset === 0 ? 'Etc/GMT' : `Etc/GMT${offset > 0 ? '-' : '+'}${Math.abs(offset)}`,
    ocean: true,
  }
}
export class TimeZoneLayer {
  constructor(data) {
    this.data = data
    this.cells = new Map()
    this.zones = data.features.map((feature, index) => ({
      id: index + 1,
      tzid: feature.properties.tzid,
      feature,
    }))
    for (const zone of this.zones) {
      const polygons =
        zone.feature.geometry.type === 'Polygon'
          ? [zone.feature.geometry.coordinates]
          : zone.feature.geometry.coordinates
      for (const polygon of polygons) {
        const xs = polygon[0].map((p) => p[0]),
          ys = polygon[0].map((p) => p[1])
        const bounds = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
        const entry = { zone, polygon, bounds }
        for (let x = Math.floor(bounds[0] / 5); x <= Math.floor(bounds[2] / 5); x++) {
          for (let y = Math.floor(bounds[1] / 5); y <= Math.floor(bounds[3] / 5); y++) {
            const key = `${x},${y}`
            if (!this.cells.has(key)) this.cells.set(key, [])
            this.cells.get(key).push(entry)
          }
        }
      }
    }
  }
  lookup(lat, longitude) {
    const lon = wrapLongitude(longitude)
    const candidates = this.cells.get(`${Math.floor(lon / 5)},${Math.floor(lat / 5)}`) || []
    // Source features are alphabetically sorted; that order breaks source overlaps consistently.
    for (const { zone, polygon, bounds: b } of candidates) {
      if (lon >= b[0] && lon <= b[2] && lat >= b[1] && lat <= b[3] && contains(lon, lat, polygon))
        return zone
    }
    return oceanZone(lon)
  }
  createTextures(p, width = 4096) {
    const height = width / 2
    this.ids = p.createGraphics(width, height)
    this.lines = p.createGraphics(width, height)
    this.ids.pixelDensity(1)
    this.lines.pixelDensity(1)
    const id = this.ids.drawingContext,
      line = this.lines.drawingContext
    id.fillStyle = '#000'
    id.fillRect(0, 0, width, height)
    line.clearRect(0, 0, width, height)
    line.strokeStyle = 'white'
    line.lineWidth = 0.8
    // Reverse drawing matches first-feature-wins CPU picking at overlapping boundaries.
    for (const zone of [...this.zones].reverse()) {
      const polygons =
        zone.feature.geometry.type === 'Polygon'
          ? [zone.feature.geometry.coordinates]
          : zone.feature.geometry.coordinates
      id.fillStyle = `rgb(${zone.id % 256},${Math.floor(zone.id / 256)},0)`
      for (const polygon of polygons) {
        for (const ctx of [id, line]) {
          ctx.beginPath()
          for (const ring of polygon) {
            ring.forEach(([lon, lat], i) => {
              const x = ((lon + 180) / 360) * width,
                y = ((90 - lat) / 180) * height
              if (i === 0) ctx.moveTo(x, y)
              else ctx.lineTo(x, y)
            })
            ctx.closePath()
          }
        }
        id.fill('evenodd')
        line.stroke()
      }
    }
    // Freeze the canvases as images so p5 uploads them once, rather than every frame.
    const textures = { ids: this.ids.get(), lines: this.lines.get() }
    this.ids.remove()
    this.lines.remove()
    return textures
  }
}

const formatters = new Map()
export function localTime(timestamp, tzid) {
  if (!formatters.has(tzid))
    formatters.set(tzid, {
      time: new Intl.DateTimeFormat('en-GB', {
        timeZone: tzid,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
      }),
      date: new Intl.DateTimeFormat('en-GB', {
        timeZone: tzid,
        weekday: 'short',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
      offset: new Intl.DateTimeFormat('en', {
        timeZone: tzid,
        timeZoneName: 'longOffset',
      }),
    })
  const f = formatters.get(tzid),
    date = new Date(timestamp)
  return {
    time: f.time.format(date),
    date: f.date.format(date),
    offset: f.offset
      .formatToParts(date)
      .find((p) => p.type === 'timeZoneName')
      .value.replace('GMT', 'UTC'),
  }
}
