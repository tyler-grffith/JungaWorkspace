import { test } from 'vitest'
import assert from 'node:assert/strict'
import { GeoVector, Observer, ObserverVector } from 'astronomy-engine'
import {
  latLonToVector,
  vectorToLatLon,
  transform,
  inverseRotation,
  normalize,
  scale,
  dot,
  raySphere,
  pickGlobe,
  cameraBasis,
  RAD,
} from './math.js'
import { SolarSystemModel } from './SolarSystemModel.js'
const close = (a, b, tolerance = 1e-7) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`)
const model = new SolarSystemModel()

test('latitude/longitude round trips across the globe', () => {
  for (const lat of [-89, -45, 0, 45, 89])
    for (const lon of [-179, -80, 0, 90, 179]) {
      const p = vectorToLatLon(latLonToVector(lat, lon))
      close(p.lat, lat)
      close(p.lon, lon)
    }
})
test('astronomical rotation is orthonormal and invertible', () => {
  const m = model.update(Date.parse('2026-06-21T12:00:00Z')).earthRotation
  const v = latLonToVector(40, -74)
  const roundtrip = inverseRotation(m, transform(m, v))
  roundtrip.forEach((x, i) => close(x, v[i]))
  close(dot(m.slice(0, 3), m.slice(3, 6)), 0)
  close(Math.hypot(...m.slice(0, 3)), 1)
})
test('subsolar latitude follows solstices and equinoxes', () => {
  const june = model.update(Date.parse('2026-06-21T12:00:00Z'))
  const dec = model.update(Date.parse('2026-12-21T12:00:00Z'))
  const march = model.update(Date.parse('2026-03-20T12:00:00Z'))
  close(june.subsolar.lat, 23.44, 0.1)
  close(dec.subsolar.lat, -23.44, 0.1)
  close(march.subsolar.lat, 0, 0.3)
  assert.ok(Math.abs(june.subsolar.lon) < 2)
  assert.ok(dot(transform(june.earthRotation, latLonToVector(89, 0)), june.sun) > 0)
  assert.ok(dot(transform(dec.earthRotation, latLonToVector(89, 0)), dec.sun) < 0)
})
test('surface sunlight agrees with independent astronomical observer vectors', () => {
  const date = new Date('2026-09-20T22:00:00Z'),
    state = model.update(+date)
  for (const [lat, lon] of [
    [40, -74],
    [-33, 151],
    [27, 85],
    [70, 15],
  ]) {
    const observer = ObserverVector(date, new Observer(lat, lon, 0), false)
    const sun = GeoVector('Sun', date, true)
    const expected = dot(
      normalize([observer.x, observer.y, observer.z]),
      normalize([sun.x, sun.y, sun.z]),
    )
    const actual = dot(transform(state.earthRotation, latLonToVector(lat, lon)), state.sun)
    // ObserverVector uses an oblate Earth; this project deliberately renders a sphere.
    close(actual, expected, 0.004)
  }
})
test('ray picking follows transformed geography at multiple camera positions and aspect ratios', () => {
  const state = model.update(Date.parse('2026-08-02T18:00:00Z'))
  const point = latLonToVector(35, 140),
    world = transform(state.earthRotation, point)
  for (const distance of [2.2, 3.6, 6])
    for (const [width, height] of [
      [1000, 600],
      [390, 500],
    ]) {
      const eye = scale(world, distance)
      const hit = pickGlobe(
        width / 2,
        height / 2,
        width,
        height,
        eye,
        Math.PI / 4,
        state.earthRotation,
      )
      close(hit.lat, 35)
      close(hit.lon, 140)
      // Also project a visible off-center point and independently pick that pixel.
      const target = transform(state.earthRotation, latLonToVector(30, 148))
      const delta = target.map((v, i) => v - eye[i]),
        basis = cameraBasis(eye),
        depth = -dot(delta, basis.back),
        h = Math.tan(Math.PI / 8)
      const x = ((1 + dot(delta, basis.right) / depth / h / (width / height)) * width) / 2
      const y = ((1 + dot(delta, basis.down) / depth / h) * height) / 2
      const picked = pickGlobe(x, y, width, height, eye, Math.PI / 4, state.earthRotation)
      close(picked.lat, 30)
      close(picked.lon, 148)
    }
})
test('rays miss the globe or choose the nearest visible surface', () => {
  assert.equal(raySphere([0, 0, 4], normalize([2, 0, -1])), null)
  assert.equal(raySphere([0, 0, 4], [0, 0, 1]), null)
  assert.deepEqual(raySphere([0, 0, 4], [0, 0, -1]), [0, 0, 1])
})
