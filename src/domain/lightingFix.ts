import { luma, toOklab, type Rgb } from './color'
import { NO_COLOR, pixelPackedAt, unpacked, type PixelData } from './imageConversion'
import type { SubjectMask } from './subjectMask'

// Auto-fix lighting (ticket 0766, spec 0761): the one color correction Convert image makes, for a photo taken under a
// warm or dim light. Measured once from the picture, it is a function the sampler runs on each pixel it reads.

/** How many pixels the measurement reads at most, spread evenly over the picture: enough for its averages. */
const MAX_SAMPLES = 40_000
/** How much a channel may be raised or lowered to balance white: a cast is corrected, a red rose is not made grey. */
const MIN_GAIN = 0.6
const MAX_GAIN = 1.6
/** The share of the brightest pixels whose color is taken as the light's (the white patch). */
const BRIGHT_SHARE = 0.05
/** The share of the most saturated pixels whose chroma is stretched to the target. */
const SATURATED_SHARE = 0.05
/** The OKLab chroma the most saturated few percent are stretched to: a clear, not a garish, color. */
const TARGET_CHROMA = 0.15
/** The most chroma is stretched by, and the least chroma that is stretched at all: a grey picture stays grey. */
const MAX_STRETCH = 2
const MIN_CHROMA = 0.02

/** A color correction on packed 0xRRGGBB colors (imageConversion's pixelPackedAt); NO_COLOR passes through. */
export type PackedAdjust = (packed: number) => number

/** The pixels the light is judged from: the subject's alone while Cut out has a mask, else the whole picture's,
 * transparent ones left out; at most MAX_SAMPLES of them, spread evenly. */
function referencePixels(picture: PixelData, mask: SubjectMask | undefined): number[] {
  const total = picture.width * picture.height
  const step = Math.max(1, Math.floor(total / MAX_SAMPLES))
  const pixels: number[] = []
  for (let at = 0; at < total; at += step) {
    if (mask && !mask.subject[at]) continue
    const packed = pixelPackedAt(picture, at % picture.width, Math.floor(at / picture.width))
    if (packed !== NO_COLOR) pixels.push(packed)
  }
  return pixels
}

const channel = (value: number) => (value <= 0 ? 0 : value >= 255 ? 255 : Math.round(value))

/** The gains that balance white: the light's color is half the picture's average (grey world) and half its brightest
 * few percent (white patch), each channel scaled to that color's brightness, so the light's brightness stays. */
function whiteGains(pixels: readonly number[]): [number, number, number] {
  const colors = pixels.map(unpacked)
  const average = (of: readonly Rgb[]) => {
    const sum = of.reduce((total, { r, g, b }) => ({ r: total.r + r, g: total.g + g, b: total.b + b }), { r: 0, g: 0, b: 0 })
    return { r: sum.r / of.length, g: sum.g / of.length, b: sum.b / of.length }
  }
  const bright = [...colors].sort((a, b) => luma(b) - luma(a)).slice(0, Math.max(1, Math.round(colors.length * BRIGHT_SHARE)))
  const mean = average(colors)
  const patch = average(bright)
  const light = [(mean.r + patch.r) / 2, (mean.g + patch.g) / 2, (mean.b + patch.b) / 2]
  const level = luma({ r: light[0]!, g: light[1]!, b: light[2]! })
  return light.map((value) => Math.min(MAX_GAIN, Math.max(MIN_GAIN, value > 0 ? level / value : 1))) as [number, number, number]
}

/** A correction from gains and a chroma stretch: each channel scaled, then its distance from the pixel's grey. */
function correction([gainR, gainG, gainB]: readonly number[], stretch: number): PackedAdjust {
  return (packed) => {
    if (packed === NO_COLOR) return NO_COLOR
    const color = unpacked(packed)
    const r = color.r * gainR!
    const g = color.g * gainG!
    const b = color.b * gainB!
    const grey = luma({ r, g, b })
    return (channel(grey + (r - grey) * stretch) << 16) | (channel(grey + (g - grey) * stretch) << 8) | channel(grey + (b - grey) * stretch)
  }
}

/** Auto-fix lighting measured from a picture (spec 0761): white balance from the subject's pixels (the whole picture's
 * with no mask), then chroma stretched so the most saturated few percent reach a set target, never lessened. The
 * sampler runs it on every pixel it reads, so the found colors follow. */
export function lightingFix(picture: PixelData, mask?: SubjectMask): PackedAdjust {
  const pixels = referencePixels(picture, mask)
  if (pixels.length === 0) return (packed) => packed
  const gains = whiteGains(pixels)
  const balanced = correction(gains, 1)
  const chromas = pixels.map((packed) => {
    const { a, b } = toOklab(unpacked(balanced(packed)))
    return Math.hypot(a, b)
  })
  chromas.sort((a, b) => b - a)
  const saturated = chromas[Math.min(chromas.length - 1, Math.floor(chromas.length * SATURATED_SHARE))]!
  const stretch = saturated < MIN_CHROMA ? 1 : Math.min(MAX_STRETCH, Math.max(1, TARGET_CHROMA / saturated))
  return correction(gains, stretch)
}
