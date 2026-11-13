import { luma, toOklab, type Rgb } from './color'
import { NO_COLOR, pixelPackedAt, unpacked, type PixelData } from './imageConversion'

// Auto-fix lighting (ticket 0907, spec 0761, decision D-2): the one correction Convert image makes to a picture before
// it becomes beads, for a photo taken under a warm or dim light. Measured once from the picture, applied to all of it.

/** How many pixels the measurement reads at most, spread evenly over the picture: enough for its averages. */
const MAX_SAMPLES = 40_000
/** How much a channel may be raised or lowered to balance white: a cast is corrected, a red rose is not made grey. */
const MIN_GAIN = 0.6
const MAX_GAIN = 1.6
/** The share of the brightest pixels whose color is taken as the light's (the white patch). */
const BRIGHT_SHARE = 0.05
/** The share of the darkest pixels taken as the black point, and the lightest a black point may be (0 to 1). */
const BLACK_SHARE = 0.01
const MAX_BLACK_POINT = 0.1
/** The share of the brightest pixels taken as the white point, and the darkest a white point may be: a dim picture's
 * whites are raised at most twice. */
const WHITE_SHARE = 0.01
const MIN_WHITE_POINT = 0.5
/** The brightness (0 to 1) the middle pixel is lifted to when it is darker, and the strongest lift (the curve's
 * gamma, 1 for none): a dark photo's beads come out of the blacks; a bright one is never darkened. */
const TARGET_MIDDLE = 0.45
/** The middle pixel: half of them darker. */
const MIDDLE_SHARE = 0.5
const MIN_GAMMA = 0.45
/** The share of the most saturated pixels whose chroma is stretched to the target. */
const SATURATED_SHARE = 0.05
/** The OKLab chroma the most saturated few percent are stretched to: a clear, not a garish, color. */
const TARGET_CHROMA = 0.15
/** The most chroma is stretched by, and the least chroma that is stretched at all: a grey picture stays grey. */
const MAX_STRETCH = 2
const MIN_CHROMA = 0.02
/** Below this brightness (0 to 1, after white balance) a pixel's color fades toward grey, all of it at black. */
const SHADOW = 0.08

/** Auto-fix lighting as measured from one picture: each channel's gain (white balance), the tone curve (black and
 * white points, 0 to 255, and the gamma lifting the middle) and the chroma stretch. */
export interface LightingFix {
  gains: readonly [number, number, number]
  black: number
  white: number
  gamma: number
  stretch: number
}

/** The opaque pixels the light is judged from, at most MAX_SAMPLES of them, spread evenly. */
function referencePixels(picture: PixelData): Rgb[] {
  const total = picture.width * picture.height
  const step = Math.max(1, Math.floor(total / MAX_SAMPLES))
  const pixels: Rgb[] = []
  for (let index = 0; index < total; index += step) {
    const packed = pixelPackedAt(picture, index % picture.width, Math.floor(index / picture.width))
    if (packed !== NO_COLOR) pixels.push(unpacked(packed))
  }
  return pixels
}

const channel = (value: number) => (value <= 0 ? 0 : value >= 255 ? 255 : Math.round(value))
const average = (of: readonly Rgb[]) => {
  const sum = of.reduce((total, { r, g, b }) => ({ r: total.r + r, g: total.g + g, b: total.b + b }), { r: 0, g: 0, b: 0 })
  return { r: sum.r / of.length, g: sum.g / of.length, b: sum.b / of.length }
}
/** The value a share of the way up a sorted list. */
const shareOf = (sorted: readonly number[], share: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * share)))]!

/** The gains that balance white: the light's color is half the picture's average (grey world) and half its brightest
 * few percent (white patch), each channel scaled to that color's brightness, so the light's brightness stays. */
function whiteGains(colors: readonly Rgb[]): [number, number, number] {
  const bright = [...colors].sort((a, b) => luma(b) - luma(a)).slice(0, Math.max(1, Math.round(colors.length * BRIGHT_SHARE)))
  const mean = average(colors)
  const patch = average(bright)
  const light = [(mean.r + patch.r) / 2, (mean.g + patch.g) / 2, (mean.b + patch.b) / 2]
  const level = luma({ r: light[0]!, g: light[1]!, b: light[2]! })
  return light.map((value) => Math.min(MAX_GAIN, Math.max(MIN_GAIN, value > 0 ? level / value : 1))) as [number, number, number]
}

/** Each channel's table, 0 to 255 in and out: its gain, then the tone curve. Grey stays grey. */
function channelTables({ gains, black, white, gamma }: LightingFix): Uint8ClampedArray[] {
  return gains.map((gain) => {
    const table = new Uint8ClampedArray(256)
    for (let value = 0; value < 256; value += 1) {
      const level = Math.min(1, Math.max(0, (value * gain - black) / (white - black)))
      table[value] = Math.round(255 * level ** gamma)
    }
    return table
  })
}

/** One color through the tables, then its distance from its own grey stretched; in the deep shadows that distance is
 * eased toward none instead, as a lifted shadow's color is the camera's noise, not the scene's. */
function corrected({ gains, tables, stretch }: Correction, { r, g, b }: Rgb): Rgb {
  const red = tables[0]![r]!
  const green = tables[1]![g]!
  const blue = tables[2]![b]!
  const shade = Math.min(1, luma({ r: r * gains[0], g: g * gains[1], b: b * gains[2] }) / (255 * SHADOW))
  const scale = shade < 1 ? shade : stretch
  if (scale === 1) return { r: red, g: green, b: blue }
  const grey = luma({ r: red, g: green, b: blue })
  return { r: channel(grey + (red - grey) * scale), g: channel(grey + (green - grey) * scale), b: channel(grey + (blue - grey) * scale) }
}

/** A LightingFix ready to run over many pixels: its gains, its channel tables and its stretch. */
interface Correction {
  gains: readonly [number, number, number]
  tables: readonly Uint8ClampedArray[]
  stretch: number
}
const correctionOf = (fix: LightingFix): Correction => ({ gains: fix.gains, tables: channelTables(fix), stretch: fix.stretch })

/** Auto-fix lighting measured from a picture (spec 0761): white balance from its opaque pixels; then a tone curve that
 * sets the black and white points and lifts a dark middle, never darkening; then chroma stretched so the most
 * saturated few percent reach a set target, never lessened (ticket 0907 adds the lift: chroma alone missed a dark photo). */
export function measureLighting(picture: PixelData): LightingFix {
  const colors = referencePixels(picture)
  if (colors.length === 0) return { gains: [1, 1, 1], black: 0, white: 255, gamma: 1, stretch: 1 }
  const gains = whiteGains(colors)
  const lumas = colors.map(({ r, g, b }) => luma({ r: r * gains[0], g: g * gains[1], b: b * gains[2] })).sort((a, b) => a - b)
  const black = Math.min(shareOf(lumas, BLACK_SHARE), 255 * MAX_BLACK_POINT)
  const white = Math.max(shareOf(lumas, 1 - WHITE_SHARE), 255 * MIN_WHITE_POINT, black + 1)
  const middle = Math.min(1, Math.max(0, (shareOf(lumas, MIDDLE_SHARE) - black) / (white - black)))
  const gamma = middle <= 0 ? MIN_GAMMA : middle >= TARGET_MIDDLE ? 1 : Math.max(MIN_GAMMA, Math.log(TARGET_MIDDLE) / Math.log(middle))
  const toned = { gains, black, white, gamma, stretch: 1 }
  const correction = correctionOf(toned)
  const chromas = colors.map((color) => {
    const { a, b } = toOklab(corrected(correction, color))
    return Math.hypot(a, b)
  })
  const saturated = shareOf(chromas.sort((a, b) => b - a), SATURATED_SHARE)
  const stretch = saturated < MIN_CHROMA ? 1 : Math.min(MAX_STRETCH, Math.max(1, TARGET_CHROMA / saturated))
  return { ...toned, stretch }
}

/** The Lighting popover's sliders (ticket 0908, ConvertImage card DS-3): set by hand, after Auto-fix lighting. */
export type LightingSlider = 'brightness' | 'contrast' | 'saturation'
export const LIGHTING_SLIDERS: readonly LightingSlider[] = ['brightness', 'contrast', 'saturation']
export type LightingSliders = Readonly<Record<LightingSlider, number>>
/** Each slider's ends, and its middle, which changes nothing. */
export const LIGHTING_SLIDER_LEAST = -50
export const LIGHTING_SLIDER_MOST = 50
export const SLIDERS_AT_REST: LightingSliders = { brightness: 0, contrast: 0, saturation: 0 }
/** Whether every slider stands at its middle. */
export const slidersAtRest = (sliders: LightingSliders) => LIGHTING_SLIDERS.every((name) => sliders[name] === 0)

/** Brightness and Contrast as one table, 0 to 255 in and out, the same for each channel: Brightness bends the middle
 * (a gamma from 2 to 0.5 over the slider), black and white kept; Contrast then scales the distance from the middle grey,
 * halved to doubled. */
function toneTable({ brightness, contrast }: LightingSliders): Uint8ClampedArray {
  const gamma = 2 ** (-brightness / LIGHTING_SLIDER_MOST)
  const scale = 2 ** (contrast / LIGHTING_SLIDER_MOST)
  const table = new Uint8ClampedArray(256)
  for (let value = 0; value < 256; value += 1) table[value] = Math.round(255 * (0.5 + ((value / 255) ** gamma - 0.5) * scale))
  return table
}

/** The picture with Auto-fix lighting applied (no fix while it is off), then the sliders: a new picture of the
 * same size, each pixel's transparency kept. What the beads are sampled from (and Compare shows), so the found colors
 * and counts follow. Sliders at rest add nothing, so the picture comes out exactly as without them. */
export function litPicture(picture: PixelData, fix: LightingFix | undefined, sliders: LightingSliders = SLIDERS_AT_REST): PixelData {
  const source = picture.data
  const data = fix ? fixedData(source, correctionOf(fix)) : Uint8ClampedArray.from(source)
  if (!slidersAtRest(sliders)) adjust(data, toneTable(sliders), 1 + sliders.saturation / LIGHTING_SLIDER_MOST)
  return { width: picture.width, height: picture.height, data }
}

/** Every pixel through Auto-fix lighting, its transparency kept. */
function fixedData(source: ArrayLike<number>, correction: Correction): Uint8ClampedArray {
  const data = new Uint8ClampedArray(source.length)
  for (let index = 0; index < data.length; index += 4) {
    const color = corrected(correction, { r: source[index]!, g: source[index + 1]!, b: source[index + 2]! })
    data[index] = color.r
    data[index + 1] = color.g
    data[index + 2] = color.b
    data[index + 3] = source[index + 3]!
  }
  return data
}

/** Every pixel through the sliders, in place: the tone table, then its distance from its own grey scaled by Saturation.
 * The grey is `luma`'s, written out with no color object, as it runs on every step of a drag over the whole picture. */
function adjust(data: Uint8ClampedArray, tone: Uint8ClampedArray, saturation: number): void {
  for (let index = 0; index < data.length; index += 4) {
    const red = tone[data[index]!]!
    const green = tone[data[index + 1]!]!
    const blue = tone[data[index + 2]!]!
    if (saturation === 1) {
      data[index] = red
      data[index + 1] = green
      data[index + 2] = blue
      continue
    }
    const grey = 0.2126 * red + 0.7152 * green + 0.0722 * blue
    data[index] = Math.round(grey + (red - grey) * saturation)
    data[index + 1] = Math.round(grey + (green - grey) * saturation)
    data[index + 2] = Math.round(grey + (blue - grey) * saturation)
  }
}
