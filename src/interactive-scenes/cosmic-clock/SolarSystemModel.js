import {
  GeoVector,
  HelioVector,
  Observer,
  ObserverVector,
  RotateVector,
  Rotation_EQD_ECL,
  Rotation_EQJ_ECL,
} from 'astronomy-engine'
import { normalize, inverseRotation, vectorToLatLon } from './math.js'

// Astronomical ecliptic XYZ -> p5 XYZ, with north toward screen-up.
const renderVector = (v) => [v.y, -v.z, v.x]
const equatorialToEcliptic = Rotation_EQJ_ECL()

export class SolarSystemModel {
  update(timestamp) {
    const date = new Date(timestamp)
    const rotation = Rotation_EQD_ECL(date)
    const basis = (lat, lon) =>
      normalize(
        renderVector(RotateVector(rotation, ObserverVector(date, new Observer(lat, lon, 0), true))),
      )
    const east = basis(0, 90),
      north = basis(90, 0),
      greenwich = basis(0, 0)
    const earthRotation = [...east, ...north.map((x) => -x), ...greenwich]
    const sun = normalize(
      renderVector(RotateVector(equatorialToEcliptic, GeoVector('Sun', date, true))),
    )
    const subsolar = vectorToLatLon(inverseRotation(earthRotation, sun))
    return { date, earthRotation, sun, subsolar }
  }
  // Other views can use AU positions without inheriting Earth's presentation scale.
  bodyPosition(body, timestamp) {
    return renderVector(RotateVector(equatorialToEcliptic, HelioVector(body, new Date(timestamp))))
  }
}
