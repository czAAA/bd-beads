import { describe, expect, it } from 'vitest'
import { luma, toOklab } from './color'
import type { PixelData } from './imageConversion'
import { litPicture, measureLighting } from './lightingFix'
import { drawPicture as picture } from '../testUtils/samplerPictures'

const pixel = (image: PixelData, x: number, y: number) => {
  const at = (y * image.width + x) * 4
  return { r: image.data[at]!, g: image.data[at + 1]!, b: image.data[at + 2]!, a: image.data[at + 3]! }
}
const meanLuma = (image: PixelData) => {
  let sum = 0
  for (let at = 0; at < image.width * image.height; at += 1) sum += luma(pixel(image, at % image.width, Math.floor(at / image.width)))
  return sum / (image.width * image.height)
}
const chroma = (color: { r: number; g: number; b: number }) => Math.hypot(toOklab(color).a, toOklab(color).b)
/** A grey ramp from dark to light, the way a scene's greys run. */
const ramp = (x: number) => 30 + x * 9

describe('Auto-fix lighting (ticket 0907, spec 0761)', () => {
  it('moves a picture with a warm cast toward neutral', () => {
    const warm = picture(20, 10, (x) => [Math.min(255, ramp(x) * 1.3), ramp(x), ramp(x) * 0.7, 255])
    const fixed = litPicture(warm, measureLighting(warm))
    // The mid grey's cast: its red over its blue, before and after.
    const before = pixel(warm, 10, 5)
    const after = pixel(fixed, 10, 5)
    expect(before.r / before.b).toBeGreaterThan(1.8)
    expect(after.r / after.b).toBeLessThan(1.25)
  })

  it('lightens a dark picture, its darkest still the darkest', () => {
    const dark = picture(40, 20, (x, y) => (y < 10 ? [4, 4, 8, 255] : [20 + x, 16 + x, 10 + x, 255]))
    const fixed = litPicture(dark, measureLighting(dark))
    expect(meanLuma(fixed)).toBeGreaterThan(meanLuma(dark) * 2)
    expect(luma(pixel(fixed, 0, 0))).toBeLessThan(luma(pixel(fixed, 39, 19)))
  })

  it('raises a dull picture’s chroma, and leaves a grey one grey', () => {
    // A dull rose beside a dull blue: no cast between them, little color in either.
    const dull = picture(20, 10, (x) => (x < 10 ? [140 + x, 120 + x, 120 + x, 255] : [100 + x, 100 + x, 120 + x, 255]))
    const fixed = litPicture(dull, measureLighting(dull))
    expect(chroma(pixel(fixed, 5, 5))).toBeGreaterThan(chroma(pixel(dull, 5, 5)) * 1.3)
    expect(chroma(pixel(fixed, 15, 5))).toBeGreaterThan(chroma(pixel(dull, 15, 5)) * 1.3)
    const grey = picture(20, 10, (x) => [ramp(x), ramp(x), ramp(x), 255])
    const after = pixel(litPicture(grey, measureLighting(grey)), 10, 5)
    expect(after.r).toBe(after.g)
    expect(after.g).toBe(after.b)
  })

  it('keeps every pixel’s transparency, and is judged on the opaque pixels alone', () => {
    const half = picture(20, 10, (x) => (x < 10 ? [255, 0, 255, 0] : [ramp(x), ramp(x), ramp(x), 255]))
    const fixed = litPicture(half, measureLighting(half))
    expect(pixel(fixed, 2, 2).a).toBe(0)
    expect(pixel(fixed, 15, 2).a).toBe(255)
    // The transparent magenta does not tint the opaque greys.
    const grey = pixel(fixed, 15, 2)
    expect(grey.r).toBe(grey.b)
  })

  it('leaves the picture it was given as it was, so turning it off brings the picture back', () => {
    const dark = picture(4, 4, () => [10, 20, 30, 255])
    const copy = Uint8ClampedArray.from(dark.data)
    litPicture(dark, measureLighting(dark))
    expect(Array.from(dark.data)).toEqual(Array.from(copy))
  })

  it('changes nothing in a picture with no opaque pixel to judge the light from', () => {
    const clear = picture(4, 4, () => [200, 30, 30, 0])
    expect(Array.from(litPicture(clear, measureLighting(clear)).data)).toEqual(Array.from(clear.data))
  })
})
