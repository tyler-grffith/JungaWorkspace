// PLA Painter example: a small painted scene (sky, sun, hills) drawn into a PNG when the
// example is created, so the relief, swap plan, and print sheet have something to show without
// shipping a photo. The stack is the classic black → blue → orange → white recipe.
import {
  emptyPainter,
  FILAMENT_PRESETS,
  newFilament,
  spaceSwapsEvenly,
  type PainterDocument,
} from '../painter/model'

const WIDTH = 240
const HEIGHT = 160

/** Draw the scene with the browser's canvas; returns '' where no canvas exists (unit tests). */
export function sunsetImage(): string {
  if (typeof document === 'undefined') return ''
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT)
  sky.addColorStop(0, '#1b2a5c')
  sky.addColorStop(0.55, '#d9643a')
  sky.addColorStop(1, '#f6c56b')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, WIDTH, HEIGHT)
  ctx.fillStyle = '#fff1c2'
  ctx.beginPath()
  ctx.arc(150, 92, 26, 0, Math.PI * 2)
  ctx.fill()
  const hill = (color: string, points: [number, number][]) => {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(0, HEIGHT)
    for (const [x, y] of points) ctx.lineTo(x, y)
    ctx.lineTo(WIDTH, HEIGHT)
    ctx.closePath()
    ctx.fill()
  }
  hill('#6a3a4a', [
    [0, 118],
    [40, 96],
    [85, 112],
    [130, 88],
    [180, 104],
    [240, 90],
  ])
  hill('#3a2238', [
    [0, 140],
    [60, 124],
    [110, 136],
    [170, 120],
    [240, 132],
  ])
  hill('#1a1220', [
    [0, 152],
    [80, 146],
    [160, 152],
    [240, 144],
  ])
  return canvas.toDataURL('image/png')
}

export function sunsetReliefPainting(): PainterDocument {
  const src = sunsetImage()
  const preset = (name: string) => FILAMENT_PRESETS.find((f) => f.name === name)!
  const doc: PainterDocument = {
    ...emptyPainter(120, 0.08),
    image: src ? { src, width: WIDTH, height: HEIGHT, name: 'sunset.png' } : null,
    detail: 2,
    baseLayers: 4,
    maxLayers: 44,
    stack: [preset('Black'), preset('Blue'), preset('Orange'), preset('White')].map((f) =>
      newFilament(f, 1),
    ),
    notes:
      'A sunset over hills, painted in four filaments. Move the swap layers or change a transmission distance and the printed preview repaints; Send to Slicer places the relief on the plate.',
  }
  return spaceSwapsEvenly(doc)
}
