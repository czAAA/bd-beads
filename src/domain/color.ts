export interface Rgb {
  r: number
  g: number
  b: number
}

/** A `#rgb` or `#rrggbb` hex as its channels, or undefined for anything else: the one place a hex is read. A caller that needs a color anyway keeps its own fallback. */
export function fromHex(hex: string): Rgb | undefined {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex)
  if (!match) {
    return undefined
  }
  const digits = match[1]!.length === 3 ? [...match[1]!].map((digit) => digit + digit).join('') : match[1]!
  const value = Number.parseInt(digits, 16)
  return { r: (value >> 16) & 0xff, g: (value >> 8) & 0xff, b: value & 0xff }
}
