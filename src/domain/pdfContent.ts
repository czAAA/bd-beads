import { helveticaWidth, type HelveticaFace } from './helvetica'

/** The drawing operators of one PDF page (ticket 0585, ADR 0043): fills, strokes and Helvetica text, written in points
 * from the page's top left corner (a PDF counts from the bottom left, so `y` is flipped here). */

const number = (value: number) => (Math.round(value * 1000) / 1000).toString()

/** `#rrggbb` as the three 0–1 channels of a PDF color. */
function channels(hex: string): string {
  const value = Number.parseInt(hex.slice(1, 7), 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255].map((channel) => number(channel / 255)).join(' ')
}

/** The share of a bezier arc that approximates a quarter circle. */
const KAPPA = 0.5522847498

export interface TextStyle {
  face: HelveticaFace
  /** Font size in points. */
  size: number
  color: string
  /** Horizontal scale in percent (`Tz`): a two-letter Swatch letter is squeezed to fit its bead. */
  scale?: number
}

export class PdfContent {
  private readonly operators: string[] = []
  private fill = ''
  private stroke = ''
  private width = ''

  private readonly height: number

  constructor(height: number) {
    this.height = height
  }

  private y(value: number): string {
    return number(this.height - value)
  }

  private fillColor(hex: string) {
    if (this.fill !== hex) this.operators.push(`${channels(hex)} rg`)
    this.fill = hex
  }

  private strokeColor(hex: string, width: number) {
    if (this.stroke !== hex) this.operators.push(`${channels(hex)} RG`)
    this.stroke = hex
    const set = number(width)
    if (this.width !== set) this.operators.push(`${set} w`)
    this.width = set
  }

  fillRect(x: number, y: number, width: number, height: number, color: string): void {
    this.fillColor(color)
    this.operators.push(`${number(x)} ${this.y(y + height)} ${number(width)} ${number(height)} re f`)
  }

  /** Straight lines `[x1, y1, x2, y2]`, all in one path. */
  lines(segments: readonly (readonly [number, number, number, number])[], width: number, color: string): void {
    if (segments.length === 0) return
    this.strokeColor(color, width)
    this.operators.push(segments.map(([x1, y1, x2, y2]) => `${number(x1)} ${this.y(y1)} m ${number(x2)} ${this.y(y2)} l`).join(' '), 'S')
  }

  /** A rounded rectangle (a circle when `radius` is half its side), filled and/or outlined. */
  roundRect(x: number, y: number, width: number, height: number, radius: number, paint: { fill?: string; stroke?: string; lineWidth?: number }): void {
    const r = Math.min(radius, width / 2, height / 2)
    const k = r * KAPPA
    const right = x + width
    const bottom = y + height
    const point = (px: number, py: number) => `${number(px)} ${this.y(py)}`
    const path = [
      `${point(x + r, y)} m`,
      `${point(right - r, y)} l`,
      `${point(right - r + k, y)} ${point(right, y + r - k)} ${point(right, y + r)} c`,
      `${point(right, bottom - r)} l`,
      `${point(right, bottom - r + k)} ${point(right - r + k, bottom)} ${point(right - r, bottom)} c`,
      `${point(x + r, bottom)} l`,
      `${point(x + r - k, bottom)} ${point(x, bottom - r + k)} ${point(x, bottom - r)} c`,
      `${point(x, y + r)} l`,
      `${point(x, y + r - k)} ${point(x + r - k, y)} ${point(x + r, y)} c h`,
    ].join(' ')
    if (paint.fill) this.fillColor(paint.fill)
    if (paint.stroke) this.strokeColor(paint.stroke, paint.lineWidth ?? 1)
    this.operators.push(`${path} ${paint.fill && paint.stroke ? 'B' : paint.fill ? 'f' : 'S'}`)
  }

  /** A closed polygon through `points` (a turned bead of a Custom frame, ticket 0594), filled and/or outlined. */
  polygon(points: readonly (readonly [number, number])[], paint: { fill?: string; stroke?: string; lineWidth?: number }): void {
    const path = points.map(([x, y], index) => `${number(x)} ${this.y(y)} ${index === 0 ? 'm' : 'l'}`).join(' ')
    if (paint.fill) this.fillColor(paint.fill)
    if (paint.stroke) this.strokeColor(paint.stroke, paint.lineWidth ?? 1)
    this.operators.push(`${path} h ${paint.fill && paint.stroke ? 'B' : paint.fill ? 'f' : 'S'}`)
  }

  /** `value` in Helvetica with its baseline at `baseline`, starting at `x` (`align` left), or centred or ending there. */
  text(value: string, x: number, baseline: number, style: TextStyle, align: 'left' | 'center' | 'right' = 'left'): void {
    const scale = style.scale ?? 100
    const wide = (helveticaWidth(value, style.face, style.size) * scale) / 100
    const left = align === 'center' ? x - wide / 2 : align === 'right' ? x - wide : x
    this.fillColor(style.color)
    const escaped = value.replace(/[\\()]/g, (character) => `\\${character}`)
    this.operators.push(`BT /${style.face === 'bold' ? 'F2' : 'F1'} ${number(style.size)} Tf ${number(scale)} Tz ${number(left)} ${this.y(baseline)} Td (${escaped}) Tj ET`)
  }

  toString(): string {
    return this.operators.join('\n')
  }
}
