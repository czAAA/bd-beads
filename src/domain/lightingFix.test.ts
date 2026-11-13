import { describe, expect, it } from 'vitest'
import { luma, toOklab } from './color'
import type { PixelData } from './imageConversion'
import { litPicture, measureLighting, SLIDERS_AT_REST } from './lightingFix'
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

describe('Brightness, Contrast and Saturation (ticket 0908, ConvertImage card DS-3)', () => {
  const sliders = (moved: Partial<typeof SLIDERS_AT_REST>) => ({ ...SLIDERS_AT_REST, ...moved })
  // A dark corner too: with the switch off its colors are not faded as Auto-fix lighting fades a lifted shadow's.
  const colorful = picture(20, 10, (x, y) => (y === 0 ? [12, 2, 4, 255] : [40 + x * 8, 200 - y * 12, 90 + x * 3, x === 0 ? 0 : 255]))

  it('at rest change nothing, byte for byte, with Auto-fix lighting off or on', () => {
    expect(Array.from(litPicture(colorful, undefined, SLIDERS_AT_REST).data)).toEqual(Array.from(colorful.data))
    const fix = measureLighting(colorful)
    expect(Array.from(litPicture(colorful, fix, SLIDERS_AT_REST).data)).toEqual(Array.from(litPicture(colorful, fix).data))
  })

  it('Brightness lightens and darkens the middle, black staying black and white white', () => {
    const grey = picture(3, 1, (x) => [[0, 0, 0], [128, 128, 128], [255, 255, 255]][x]!.concat(255) as [number, number, number, number])
    const lighter = litPicture(grey, undefined, sliders({ brightness: 25 }))
    const darker = litPicture(grey, undefined, sliders({ brightness: -25 }))
    expect(pixel(lighter, 1, 0).r).toBeGreaterThan(150)
    expect(pixel(darker, 1, 0).r).toBeLessThan(105)
    for (const image of [lighter, darker]) {
      expect(pixel(image, 0, 0).r).toBe(0)
      expect(pixel(image, 2, 0).r).toBe(255)
    }
  })

  it('Contrast pulls the greys apart or together round the middle', () => {
    const greys = picture(2, 1, (x) => (x === 0 ? [96, 96, 96, 255] : [160, 160, 160, 255]))
    const spread = (image: PixelData) => pixel(image, 1, 0).r - pixel(image, 0, 0).r
    expect(spread(litPicture(greys, undefined, sliders({ contrast: 50 })))).toBeGreaterThan(100)
    expect(spread(litPicture(greys, undefined, sliders({ contrast: -50 })))).toBeLessThan(40)
  })

  it('Saturation makes colors greyer down to grey at its end, or brighter, a grey staying grey', () => {
    const rose = picture(2, 1, (x) => (x === 0 ? [180, 110, 120, 255] : [120, 120, 120, 255]))
    const grey = pixel(litPicture(rose, undefined, sliders({ saturation: -50 })), 0, 0)
    expect(grey.r).toBe(grey.g)
    expect(grey.g).toBe(grey.b)
    const brighter = litPicture(rose, undefined, sliders({ saturation: 30 }))
    expect(chroma(pixel(brighter, 0, 0))).toBeGreaterThan(chroma(pixel(rose, 0, 0)) * 1.3)
    expect(pixel(brighter, 1, 0)).toEqual(pixel(rose, 1, 0))
  })

  it('act after Auto-fix lighting: they stack on the lit picture, and keep every pixel’s transparency', () => {
    const fix = measureLighting(colorful)
    const lit = litPicture(colorful, fix)
    const both = litPicture(colorful, fix, sliders({ brightness: 20 }))
    expect(meanLuma(both)).toBeGreaterThan(meanLuma(lit))
    expect(Array.from(litPicture(lit, undefined, sliders({ brightness: 20 })).data)).toEqual(Array.from(both.data))
    expect(pixel(both, 0, 3).a).toBe(0)
  })
})
