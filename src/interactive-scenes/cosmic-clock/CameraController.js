import { clamp, latLonToVector, transform, normalize, scale } from './math.js'

export class CameraController {
  constructor(element, onSelect) {
    this.element = element
    this.onSelect = onSelect
    this.yaw = 0
    this.pitch = 0.2
    this.distance = 3.7
    this.fov = Math.PI / 4
    this.pointer = null
    this.pointers = new Map()
    this.dragging = false
    this.moved = false
    this.events = new AbortController()
    const listen = (name, fn, options = {}) =>
      element.addEventListener(name, fn, {
        ...options,
        signal: this.events.signal,
      })
    listen('pointerdown', (e) => {
      element.focus({ preventScroll: true })
      this.pointers.set(e.pointerId, [e.clientX, e.clientY])
      this.dragging = true
      this.moved = false
      this.start = [e.clientX, e.clientY]
      element.setPointerCapture(e.pointerId)
    })
    listen('pointermove', (e) => {
      const rect = element.getBoundingClientRect()
      this.pointer = [e.clientX - rect.left, e.clientY - rect.top]
      const old = this.pointers.get(e.pointerId)
      if (!old) return
      const dx = e.clientX - old[0],
        dy = e.clientY - old[1]
      if (Math.hypot(e.clientX - this.start[0], e.clientY - this.start[1]) > 4) this.moved = true
      if (this.pointers.size === 2) {
        const other = [...this.pointers].find(([id]) => id !== e.pointerId)[1]
        const before = Math.hypot(old[0] - other[0], old[1] - other[1])
        const after = Math.hypot(e.clientX - other[0], e.clientY - other[1])
        if (after > 0) this.zoom(before / after)
        this.moved = true
      } else this.orbit(-dx * 0.005, dy * 0.005)
      this.pointers.set(e.pointerId, [e.clientX, e.clientY])
    })
    listen('pointerup', (e) => {
      const rect = element.getBoundingClientRect()
      if (!this.moved && this.pointers.size === 1)
        onSelect(e.clientX - rect.left, e.clientY - rect.top)
      this.pointers.delete(e.pointerId)
      this.dragging = this.pointers.size > 0
      if (e.pointerType === 'touch') this.pointer = null
    })
    listen('pointercancel', (e) => {
      this.pointers.delete(e.pointerId)
      this.dragging = this.pointers.size > 0
      this.pointer = null
    })
    listen('pointerleave', () => {
      if (!this.dragging) this.pointer = null
    })
    listen(
      'wheel',
      (e) => {
        e.preventDefault()
        this.zoom(Math.exp(clamp(e.deltaY, -100, 100) * 0.0015))
      },
      { passive: false },
    )
    listen('keydown', (e) => {
      const actions = {
        ArrowLeft: () => this.orbit(-0.12, 0),
        ArrowRight: () => this.orbit(0.12, 0),
        ArrowUp: () => this.orbit(0, -0.1),
        ArrowDown: () => this.orbit(0, 0.1),
        '+': () => this.zoom(0.9),
        '=': () => this.zoom(0.9),
        '-': () => this.zoom(1.1),
      }
      if (actions[e.key]) {
        e.preventDefault()
        actions[e.key]()
      }
    })
  }
  orbit(yaw, pitch) {
    this.yaw += yaw
    this.pitch = clamp(this.pitch + pitch, -1.4, 1.4)
  }
  zoom(factor) {
    this.distance = clamp(this.distance * factor, 2.05, 6)
  }
  reset(state, aspect = 1.4) {
    const direction = normalize(
      transform(state.earthRotation, latLonToVector(20, state.subsolar.lon + 57)),
    )
    this.yaw = Math.atan2(direction[0], direction[2])
    this.pitch = Math.asin(-direction[1])
    this.distance = aspect < 0.9 ? 4.25 : 3.6
  }
  get eye() {
    return scale(
      [
        Math.cos(this.pitch) * Math.sin(this.yaw),
        -Math.sin(this.pitch),
        Math.cos(this.pitch) * Math.cos(this.yaw),
      ],
      this.distance,
    )
  }
  dispose() {
    this.events.abort()
  }
}
