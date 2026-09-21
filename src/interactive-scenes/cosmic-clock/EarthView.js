import P5 from 'p5'
import vertex from './shaders/earth.vert?raw'
import fragment from './shaders/earth.frag?raw'
import { latLonToVector } from './math.js'

export class EarthView {
  constructor(p, day, night, zoneTextures) {
    this.shader = p.createShader(vertex, fragment)
    this.geometry = new P5.Geometry(144, 96)
    const g = this.geometry,
      w = 144,
      h = 96
    for (let y = 0; y <= h; y++)
      for (let x = 0; x <= w; x++) {
        const v = latLonToVector(90 - (y / h) * 180, (x / w) * 360 - 180)
        g.vertices.push(new P5.Vector(...v))
        g.vertexNormals.push(new P5.Vector(...v))
        g.uvs.push(x / w, y / h)
        if (y < h && x < w) {
          const a = y * (w + 1) + x,
            b = a + 1,
            c = a + w + 1,
            d = c + 1
          g.faces.push([a, c, b], [b, c, d])
        }
      }
    this.shader.setUniform('uDay', day)
    this.shader.setUniform('uNight', night)
    this.shader.setUniform('uZones', zoneTextures.ids)
    this.shader.setUniform('uBorders', zoneTextures.lines)
  }
  draw(p, state, camera, { zones, selected }) {
    const eye = camera.eye
    p.perspective(camera.fov, p.width / p.height, 0.05, 100)
    p.camera(...eye, 0, 0, 0, 0, 1, 0)
    p.noStroke()
    p.fill(255)
    p.shader(this.shader)
    this.shader.setUniform('uEarthRotation', state.earthRotation)
    this.shader.setUniform('uSun', state.sun)
    this.shader.setUniform('uEye', eye)
    this.shader.setUniform('uSelected', selected ?? -1)
    this.shader.setUniform('uShowZones', zones ? 1 : 0)
    this.shader.setUniform('uRadius', 1)
    this.shader.setUniform('uAtmosphere', 0)
    p.model(this.geometry)
    // The atmosphere pass uses premultiplied-alpha output, as p5's blend mode expects.
    p.fill(255, 100)
    this.shader.setUniform('uAtmosphere', 1)
    this.shader.setUniform('uRadius', 1.018)
    p.model(this.geometry)
    p.resetShader()
  }
}
