// Code example: a small vanilla-JavaScript sketch that runs in the code module's sandboxed
// frame. Three files, one runnable output, and a comment in each file saying what to change.
import type { CodeDocument } from '../code/model'

const HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Orbit sketch</title>
    <link rel="stylesheet" href="style.css" />
  </head>
  <body>
    <canvas id="scene" width="640" height="400" aria-label="Planets orbiting a star"></canvas>
    <p class="hint">Move the pointer to pull the planets. Edit sketch.js and re-run.</p>
    <script src="sketch.js"></script>
  </body>
</html>
`
const CSS = `/* The page around the canvas; the drawing itself is in sketch.js. */
body {
  margin: 0;
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: #0d1220;
  color: #b8c4d6;
  font: 13px/1.5 system-ui, sans-serif;
}
canvas {
  max-width: 100%;
  border-radius: 12px;
  box-shadow: 0 20px 60px #00000066;
}
.hint {
  margin: 12px;
}
`
const JS = `// Orbit sketch: planets on circular orbits, nudged toward the pointer.
// Change PLANETS to add worlds; change the numbers to see how the motion responds.
const canvas = document.getElementById('scene')
const ctx = canvas.getContext('2d')
const PLANETS = [
  { radius: 60, size: 6, speed: 1.6, color: '#f2a93b' },
  { radius: 105, size: 9, speed: 1.0, color: '#3b8beb' },
  { radius: 160, size: 7, speed: 0.6, color: '#e0457b' },
]
const center = { x: canvas.width / 2, y: canvas.height / 2 }
let pointer = null
canvas.addEventListener('pointermove', (event) => {
  const box = canvas.getBoundingClientRect()
  pointer = {
    x: ((event.clientX - box.left) / box.width) * canvas.width,
    y: ((event.clientY - box.top) / box.height) * canvas.height,
  }
})
canvas.addEventListener('pointerleave', () => (pointer = null))

function frame(time) {
  const t = time / 1000
  ctx.fillStyle = '#0d1220'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.strokeStyle = '#ffffff18'
  for (const p of PLANETS) {
    ctx.beginPath()
    ctx.arc(center.x, center.y, p.radius, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.fillStyle = '#fff1c2'
  ctx.beginPath()
  ctx.arc(center.x, center.y, 16, 0, Math.PI * 2)
  ctx.fill()
  for (const p of PLANETS) {
    let x = center.x + Math.cos(t * p.speed) * p.radius
    let y = center.y + Math.sin(t * p.speed) * p.radius
    if (pointer) {
      // A gentle pull toward the pointer, stronger for nearer planets.
      const dx = pointer.x - x
      const dy = pointer.y - y
      const pull = 40 / Math.max(1, Math.hypot(dx, dy) / 40)
      x += (dx / Math.hypot(dx, dy)) * pull
      y += (dy / Math.hypot(dx, dy)) * pull
    }
    ctx.fillStyle = p.color
    ctx.beginPath()
    ctx.arc(x, y, p.size, 0, Math.PI * 2)
    ctx.fill()
  }
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
`

export function orbitSketchCode(): CodeDocument {
  return {
    version: 1,
    entry: 'index.html',
    files: [
      { path: 'index.html', content: HTML },
      { path: 'style.css', content: CSS },
      { path: 'sketch.js', content: JS },
    ],
  }
}
