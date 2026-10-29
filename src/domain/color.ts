import { clamp } from './clamp'

// A cell's color is a hex (ADR 0002), and this is the one module that reads, writes, mixes and compares one
// (ticket 0612). A caller that needs a color anyway keeps its own fallback.

export interface Rgb {
  r: number
  g: number
  b: number
}

/** White as channels: what a tint or a brightened bead moves toward. */
export const WHITE: Readonly<Rgb> = { r: 255, g: 255, b: 255 }
/** Black as channels: what a darkened step moves toward. */
export const BLACK: Readonly<Rgb> = { r: 0, g: 0, b: 0 }

/** A `#rgb` or `#rrggbb` hex as its channels, or undefined for anything else: the one place a hex is read. */
export function fromHex(hex: string): Rgb | undefined {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex)
  if (!match) {
    return undefined
  }
  const digits = match[1]!.length === 3 ? [...match[1]!].map((digit) => digit + digit).join('') : match[1]!
  const value = Number.parseInt(digits, 16)
  return { r: (value >> 16) & 0xff, g: (value >> 8) & 0xff, b: value & 0xff }
}

/** A hex's channels; every hex a Project stores is well formed, and anything else reads as black. */
export function channelsOf(hex: string): Rgb {
  return fromHex(hex) ?? { r: 0, g: 0, b: 0 }
}

/** The `#rrggbb` a grid cell stores, lowercase, the same shape a Palette's own hexes are written in: each channel
 * rounded and held inside 0 to 255, so a mix can be written straight back. */
export function toHex({ r, g, b }: Rgb): string {
  const byte = (channel: number) => clamp(Math.round(channel), 0, 255).toString(16).padStart(2, '0')
  return `#${byte(r)}${byte(g)}${byte(b)}`
}

/** A Custom color as the Palette keeps it: lowercase `#rrggbb`, the shape every grid cell stores; undefined for
 * anything else, the short `#rgb` form included. */
export function normalizeHex(hex: string): string | undefined {
  const lower = hex.trim().toLowerCase()
  return lower.length === 7 && fromHex(lower) ? lower : undefined
}

/** `from` moved `amount` (0 to 1) of the way toward `to`, channel by channel and unrounded: a tint, a shade, or `to`
 * laid over `from` at `amount` opacity. */
export function mix(from: Rgb, to: Rgb, amount: number): Rgb {
  const channel = (a: number, b: number) => a * (1 - amount) + b * amount
  return { r: channel(from.r, to.r), g: channel(from.g, to.g), b: channel(from.b, to.b) }
}

/** WCAG 2's relative luminance, 0 for black to 1 for white: what contrast with a mark or a letter is judged on. */
export function relativeLuminance({ r, g, b }: Rgb): number {
  const linear = (channel: number) => {
    const value = channel / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
}

/** WCAG 2's contrast ratio between two colors, 1 to 21: rulers on the Canvas color want 4.5 (ticket 0653). */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const [high, low] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x)
  return (high + 0.05) / (low + 0.05)
}

/** The relative luminance where black and white have the same contrast ratio with a color: sqrt(1.05 * 0.05) - 0.05.
 * Above it a dark mark or letter reads better, below it a light one (`--print-letter-balance`). */
export const BLACK_WHITE_BALANCE = 0.1791

/** A rougher brightness, 0 to 255: the channels as stored weighed as CSS grayscale() does, with no gamma. A bead's
 * grey and whether it is near-black are judged on it, so the canvas matches what the DOM grid showed. */
export function luma({ r, g, b }: Rgb): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** A color in OKLab (Björn Ottosson's perceptual space): `l` is lightness, 0 for black to 1 for white; `a` runs
 * green to red and `b` blue to yellow. Equal steps in it look about equally different, which RGB's don't. */
export interface Oklab {
  l: number
  a: number
  b: number
}

/** A channel, 0 to 255 as stored, as the linear light it stands for (the sRGB transfer curve undone). */
function linear(channel: number): number {
  const value = channel / 255
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

/** A color's place in OKLab, what colorDistance measures between: convert a color once to compare it with many. */
export function toOklab({ r, g, b }: Rgb): Oklab {
  const red = linear(r)
  const green = linear(g)
  const blue = linear(b)
  const long = Math.cbrt(0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue)
  const medium = Math.cbrt(0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue)
  const short = Math.cbrt(0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue)
  return {
    l: 0.2104542553 * long + 0.793617785 * medium - 0.0040720468 * short,
    a: 1.9779984951 * long - 2.428592205 * medium + 0.4505937099 * short,
    b: 0.0259040371 * long + 0.7827717662 * medium - 0.808675766 * short,
  }
}

/** How different two colors look: straight-line distance in OKLab (ΔEOK, ticket 0634), 1 from black to white. The
 * one distance Convert image and the Palette's nearest color both snap by; plain RGB distance misjudged hue. */
export function colorDistance(a: Oklab, b: Oklab): number {
  return Math.sqrt((a.l - b.l) ** 2 + (a.a - b.a) ** 2 + (a.b - b.b) ** 2)
}
