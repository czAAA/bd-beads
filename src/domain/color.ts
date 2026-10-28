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

/** The relative luminance where black and white have the same contrast ratio with a color: sqrt(1.05 * 0.05) - 0.05.
 * Above it a dark mark or letter reads better, below it a light one (`--print-letter-balance`). */
export const BLACK_WHITE_BALANCE = 0.1791

/** A rougher brightness, 0 to 255: the channels as stored weighed as CSS grayscale() does, with no gamma. A bead's
 * grey and whether it is near-black are judged on it, so the canvas matches what the DOM grid showed. */
export function luma({ r, g, b }: Rgb): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Straight-line RGB distance between two colors, what Convert image and the Palette's nearest color both snap by.
 * Not perceptual (a cell is a plain hex), but enough for "same color as far as an eye can tell". */
export function colorDistance(a: Rgb, b: Rgb): number {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2)
}
