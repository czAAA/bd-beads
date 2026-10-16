import { fromHex } from './color'

/** A color as hue in degrees (0 up to 360), saturation and brightness (value) from 0 to 1: what the Custom color picker's wheel and slider edit (ticket 449). */
export interface Hsv {
  h: number
  s: number
  v: number
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** A hue taken into 0 up to 360, wrapping round the wheel. */
export function wrapHue(hue: number): number {
  return ((hue % 360) + 360) % 360
}

/** The hex (`#rrggbb`, lowercase) of a color given as hue, saturation and brightness. */
export function hsvToHex({ h, s, v }: Hsv): string {
  const hue = wrapHue(h) / 60
  const channel = (n: number) => {
    const k = (n + hue) % 6
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1))
  }
  const byte = (value: number) => Math.round(clamp(value, 0, 1) * 255).toString(16).padStart(2, '0')
  return `#${byte(channel(5))}${byte(channel(3))}${byte(channel(1))}`
}

/** A hex as hue, saturation and brightness, or undefined when it is not `#rgb` or `#rrggbb`. A grey has hue 0. */
export function hexToHsv(hex: string): Hsv | undefined {
  const rgb = fromHex(hex)
  if (!rgb) return undefined
  const [r, g, b] = [rgb.r / 255, rgb.g / 255, rgb.b / 255]
  const max = Math.max(r, g, b)
  const delta = max - Math.min(r, g, b)
  let hue = 0
  if (delta > 0) {
    if (max === r) hue = ((g - b) / delta) % 6
    else if (max === g) hue = (b - r) / delta + 2
    else hue = (r - g) / delta + 4
  }
  return { h: wrapHue(hue * 60), s: max === 0 ? 0 : delta / max, v: max }
}

/** What a person typed in the hex field as `#rrggbb`: `#rgb` or `#rrggbb`, with or without the `#`, any case, around spaces; undefined if it is not a color. */
export function parseHexInput(text: string): string | undefined {
  const trimmed = text.trim()
  const rgb = fromHex(trimmed.startsWith('#') ? trimmed : `#${trimmed}`)
  if (!rgb) return undefined
  const byte = (value: number) => value.toString(16).padStart(2, '0')
  return `#${byte(rgb.r)}${byte(rgb.g)}${byte(rgb.b)}`
}

/** The hue and saturation under a point of the wheel, `dx` and `dy` from its centre (y down) and `radius` its edge: hue is the angle from the top, clockwise; saturation the distance, held at the edge beyond it. */
export function wheelPointToHs(dx: number, dy: number, radius: number): { h: number; s: number } {
  return { h: wrapHue((Math.atan2(dx, -dy) * 180) / Math.PI), s: radius > 0 ? clamp(Math.hypot(dx, dy) / radius, 0, 1) : 0 }
}

/** Where a hue and saturation sit on the wheel: the inverse of `wheelPointToHs`. */
export function hsToWheelPoint(h: number, s: number, radius: number): { dx: number; dy: number } {
  const angle = (wrapHue(h) * Math.PI) / 180
  return { dx: Math.sin(angle) * s * radius, dy: -Math.cos(angle) * s * radius }
}
