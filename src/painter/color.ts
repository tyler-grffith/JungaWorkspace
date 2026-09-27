// Colour science for the painter: sRGB to linear light, linear to CIE Lab, and the CIE ΔE2000
// difference, so "nearest colour" means nearest to the eye. Pure functions; everything works
// on 0–255 sRGB triples at the boundary and floats inside.
export type RGB = [number, number, number]
export type Lab = [number, number, number]

const toLinear = (c: number) => {
  const v = c / 255
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}
const toSrgb = (v: number) => {
  const c = v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055
  return Math.max(0, Math.min(255, c * 255))
}
export const linear = (rgb: RGB): RGB => [toLinear(rgb[0]), toLinear(rgb[1]), toLinear(rgb[2])]
export const srgb = (lin: RGB): RGB => [toSrgb(lin[0]), toSrgb(lin[1]), toSrgb(lin[2])]
/** Mix two sRGB colours in linear light, which is how translucent layers actually add up. */
export function mixLinear(a: RGB, b: RGB, t: number): RGB {
  const la = linear(a)
  const lb = linear(b)
  return srgb([
    la[0] + (lb[0] - la[0]) * t,
    la[1] + (lb[1] - la[1]) * t,
    la[2] + (lb[2] - la[2]) * t,
  ])
}
const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
export function rgbToLab(rgb: RGB): Lab {
  const [r, g, b] = linear(rgb)
  // D65 reference white.
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883
  const fx = f(x)
  const fy = f(y)
  const fz = f(z)
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}
const rad = Math.PI / 180
const deg = 180 / Math.PI
/** CIE ΔE2000 (Sharma, Wu, Dalal 2005). Around 2.3 is a just-noticeable difference. */
export function deltaE2000(a: Lab, b: Lab): number {
  const [L1, a1, b1] = a
  const [L2, a2, b2] = b
  const c1 = Math.hypot(a1, b1)
  const c2 = Math.hypot(a2, b2)
  const cm = (c1 + c2) / 2
  const g = 0.5 * (1 - Math.sqrt(cm ** 7 / (cm ** 7 + 25 ** 7)))
  const a1p = a1 * (1 + g)
  const a2p = a2 * (1 + g)
  const c1p = Math.hypot(a1p, b1)
  const c2p = Math.hypot(a2p, b2)
  const h = (x: number, y: number) => {
    if (x === 0 && y === 0) return 0
    const t = Math.atan2(y, x) * deg
    return t < 0 ? t + 360 : t
  }
  const h1p = h(a1p, b1)
  const h2p = h(a2p, b2)
  const dL = L2 - L1
  const dC = c2p - c1p
  let dh = h2p - h1p
  if (c1p * c2p === 0) dh = 0
  else if (dh > 180) dh -= 360
  else if (dh < -180) dh += 360
  const dH = 2 * Math.sqrt(c1p * c2p) * Math.sin((dh / 2) * rad)
  const Lm = (L1 + L2) / 2
  const Cm = (c1p + c2p) / 2
  let Hm = h1p + h2p
  if (c1p * c2p !== 0) {
    if (Math.abs(h1p - h2p) > 180) Hm += Hm < 360 ? 360 : -360
    Hm /= 2
  }
  const T =
    1 -
    0.17 * Math.cos((Hm - 30) * rad) +
    0.24 * Math.cos(2 * Hm * rad) +
    0.32 * Math.cos((3 * Hm + 6) * rad) -
    0.2 * Math.cos((4 * Hm - 63) * rad)
  const sl = 1 + (0.015 * (Lm - 50) ** 2) / Math.sqrt(20 + (Lm - 50) ** 2)
  const sc = 1 + 0.045 * Cm
  const sh = 1 + 0.015 * Cm * T
  const rt =
    -2 *
    Math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)) *
    Math.sin(60 * Math.exp(-(((Hm - 275) / 25) ** 2)) * rad)
  return Math.sqrt((dL / sl) ** 2 + (dC / sc) ** 2 + (dH / sh) ** 2 + rt * (dC / sc) * (dH / sh))
}
export function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
export const rgbToHex = ([r, g, b]: RGB) =>
  `#${((Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b)).toString(16).padStart(6, '0')}`
/** Relative luminance, 0–1. */
export const luminance = (rgb: RGB) => {
  const [r, g, b] = linear(rgb)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
