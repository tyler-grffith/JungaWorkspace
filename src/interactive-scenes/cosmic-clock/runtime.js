import P5 from 'p5'
import { SimulationClock } from './SimulationClock.js'
import { SolarSystemModel } from './SolarSystemModel.js'
import { CameraController } from './CameraController.js'
import { EarthView } from './EarthView.js'
import { TimeZoneLayer, localTime } from './TimeZoneLayer.js'
import { pickGlobe, dot, transform, latLonToVector, normalize } from './math.js'

const MIN = Date.UTC(1970, 0, 1),
  MAX = Date.UTC(2101, 0, 1) - 1
const assets = `${import.meta.env.BASE_URL}assets/cosmic-clock/`
const nameOf = (zone) =>
  zone.ocean ? 'Nautical time' : zone.tzid.split('/').at(-1).replaceAll('_', ' ')

/** Each mount owns all mutable state. No storage access or project-saving callbacks. */
export function mountScene(element, authoredDefaults, update) {
  const defaults = structuredClone(authoredDefaults)
  const clock = new SimulationClock(),
    model = new SolarSystemModel(),
    events = new AbortController()
  if (defaults.time.mode === 'simulation') {
    clock.setSpeed(defaults.time.speed)
    clock.setDate(Date.parse(defaults.time.date))
    if (defaults.time.paused) clock.togglePause()
  }
  let disposed = false,
    ready = false,
    camera,
    layer,
    view,
    resize,
    state = model.update(clock.now())
  let showZones = defaults.showTimeZones,
    pinned = null,
    hovered = null,
    lastUI = 0,
    lastPick = 0
  let zoneNames = []
  const ownZone = { id: -1, tzid: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' }
  function publish(error = '') {
    if (disposed) return
    const timestamp = clock.now(),
      zone = hovered || pinned || ownZone
    let local
    try {
      local = localTime(timestamp, zone.tzid)
    } catch {
      local = {
        time: '--:--:--',
        date: 'Time zone unavailable in this browser',
        offset: 'Unavailable',
      }
    }
    let daylight = 'Explore the globe',
      hint = 'Hover to discover local time. Click a place to pin it.'
    if (zone.lat !== undefined) {
      const light = dot(
        transform(state.earthRotation, latLonToVector(zone.lat, zone.lon)),
        state.sun,
      )
      daylight = light > 0 ? 'Daylight' : light > -0.105 ? 'Twilight' : 'Nighttime'
      hint = `${Math.abs(zone.lat).toFixed(1)}° ${zone.lat < 0 ? 'S' : 'N'} / ${Math.abs(zone.lon).toFixed(1)}° ${zone.lon < 0 ? 'W' : 'E'}${zone.ocean ? ' · Unmapped / open water' : ''}`
    }
    update({
      ready,
      error,
      timestamp,
      live: clock.live,
      paused: clock.paused,
      speed: clock.speed,
      showZones,
      pinned: !!pinned,
      hovered: !!hovered,
      zoneName: nameOf(zone),
      zoneId: zone.tzid,
      local,
      hint,
      daylight,
      zones: zoneNames,
      pointer: hovered ? camera?.pointer : null,
    })
  }
  function pick(x, y) {
    if (!ready) return null
    const point = pickGlobe(
      x,
      y,
      element.clientWidth,
      element.clientHeight,
      camera.eye,
      camera.fov,
      state.earthRotation,
    )
    return point ? { ...layer.lookup(point.lat, point.lon), ...point } : null
  }
  function reset() {
    if (!camera) return
    state = model.update(clock.now())
    const direction = normalize(
      transform(
        state.earthRotation,
        latLonToVector(
          defaults.camera.latitude,
          state.subsolar.lon + defaults.camera.sunLongitudeOffset,
        ),
      ),
    )
    camera.yaw = Math.atan2(direction[0], direction[2])
    camera.pitch = Math.asin(-direction[1])
    camera.distance = Math.min(
      6,
      defaults.camera.distance * (element.clientWidth / element.clientHeight < 0.9 ? 1.18 : 1),
    )
    camera.pointer = null
    hovered = null
    publish()
  }
  async function get(path) {
    const response = await fetch(assets + path, { signal: events.signal })
    if (!response.ok) throw new Error(`Could not load ${path}`)
    return response
  }
  publish()
  const instance = new P5((p) => {
    async function image(path) {
      const url = URL.createObjectURL(await (await get(path)).blob())
      try {
        return await p.loadImage(url)
      } finally {
        URL.revokeObjectURL(url)
      }
    }
    p.setup = async () => {
      p.noLoop()
      if (disposed) {
        void p.remove()
        return
      }
      try {
        const canvas = p.createCanvas(element.clientWidth, element.clientHeight, p.WEBGL)
        canvas.elt.setAttribute('aria-hidden', 'true')
        p.pixelDensity(Math.min(devicePixelRatio, 1.5))
        p.frameRate(40)
        const [day, night, data] = await Promise.all([
          image('earth-day.jpg'),
          image('earth-night.jpg'),
          get('timezones.geojson').then((r) => r.json()),
        ])
        if (disposed) {
          void p.remove()
          return
        }
        const gl = p.drawingContext
        const maxTexture = Math.min(4096, gl.getParameter(gl.MAX_TEXTURE_SIZE))
        if (day.width > maxTexture) day.resize(maxTexture, 0)
        if (night.width > maxTexture) night.resize(maxTexture, 0)
        layer = new TimeZoneLayer(data)
        zoneNames = layer.zones.map((zone) => zone.tzid)
        view = new EarthView(p, day, night, layer.createTextures(p, maxTexture))
        camera = new CameraController(element, (x, y) => {
          const selected = pick(x, y)
          if (selected) {
            pinned = selected
            hovered = null
            camera.pointer = null
            publish()
          }
        })
        ready = true
        reset()
        resize = new ResizeObserver(() => {
          if (!disposed && (p.width !== element.clientWidth || p.height !== element.clientHeight))
            p.resizeCanvas(element.clientWidth, element.clientHeight)
        })
        resize.observe(element)
        document.addEventListener(
          'visibilitychange',
          () => {
            if (document.hidden) p.noLoop()
            else if (!disposed && ready) p.loop()
          },
          { signal: events.signal },
        )
        canvas.elt.addEventListener(
          'webglcontextlost',
          (event) => {
            event.preventDefault()
            p.noLoop()
            ready = false
            publish('The graphics context was lost. Return to the project and reopen the scene.')
          },
          { signal: events.signal },
        )
        publish()
        if (!document.hidden) p.loop()
      } catch (error) {
        if (!disposed) {
          ready = false
          p.noLoop()
          publish(
            `Earth could not load: ${error.message}. Check WebGL support and reopen the scene.`,
          )
        }
      }
    }
    p.draw = () => {
      if (disposed || !ready) return
      let timestamp = clock.now()
      if (timestamp > MAX || timestamp < MIN) {
        if (!clock.paused) clock.togglePause()
        clock.setDate(Math.max(MIN, Math.min(MAX, timestamp)))
        timestamp = clock.now()
      }
      state = model.update(timestamp)
      p.clear()
      const now = performance.now()
      if (!camera.pointer || camera.dragging) hovered = null
      if (now - lastPick > 45) {
        hovered = camera.pointer && !camera.dragging ? pick(...camera.pointer) : null
        lastPick = now
      }
      view.draw(p, state, camera, { zones: showZones, selected: (hovered || pinned)?.id })
      if (now - lastUI > 100) {
        publish()
        lastUI = now
      }
    }
  }, element)
  return {
    live() {
      clock.goLive()
      publish()
    },
    pause() {
      clock.togglePause()
      publish()
    },
    speed(value) {
      if (value >= 1 && value <= 86400) {
        clock.setSpeed(value)
        publish()
      }
    },
    date(value) {
      if (!Number.isFinite(value) || value < MIN || value > MAX)
        throw new Error('Choose a UTC date from 1970 through 2100.')
      clock.setDate(value)
      publish()
    },
    toggleZones() {
      showZones = !showZones
      publish()
    },
    reset,
    selectZone(value) {
      const zone = layer?.zones.find(
        (z) =>
          z.tzid.toLowerCase() === value.trim().toLowerCase() ||
          nameOf(z).toLowerCase() === value.trim().toLowerCase(),
      )
      if (zone) {
        pinned = zone
        hovered = null
        camera.pointer = null
        publish()
      }
    },
    unpin() {
      pinned = null
      hovered = null
      if (camera) camera.pointer = null
      publish()
    },
    dispose() {
      if (disposed) return
      disposed = true
      ready = false
      events.abort()
      resize?.disconnect()
      camera?.dispose()
      instance.noLoop()
      if (view) instance.freeGeometry(view.geometry)
      const gl = instance.drawingContext
      void instance.remove().then(() => gl?.getExtension?.('WEBGL_lose_context')?.loseContext())
    },
  }
}
