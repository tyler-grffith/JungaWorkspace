export class SimulationClock {
  constructor(wall = () => Date.now(), monotonic = () => performance.now()) {
    this.wall = wall
    this.monotonic = monotonic
    this.live = true
    this.paused = false
    this.speed = 1
    this.anchor = wall()
    this.tick = monotonic()
  }
  now() {
    return this.live
      ? this.wall()
      : this.anchor + (this.paused ? 0 : (this.monotonic() - this.tick) * this.speed)
  }
  reanchor() {
    this.anchor = this.now()
    this.tick = this.monotonic()
    this.live = false
  }
  setSpeed(speed) {
    if (!Number.isFinite(speed) || speed <= 0) throw new Error('Speed must be positive.')
    this.reanchor()
    this.speed = speed
    this.paused = false
  }
  togglePause() {
    this.reanchor()
    this.paused = !this.paused
  }
  setDate(timestamp) {
    if (!Number.isFinite(timestamp)) throw new Error('Enter a valid UTC date.')
    this.anchor = timestamp
    this.tick = this.monotonic()
    this.live = false
  }
  goLive() {
    this.live = true
    this.paused = false
    this.speed = 1
  }
}
