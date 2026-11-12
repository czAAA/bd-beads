import type { PageDrawing, Paint, TextStyle } from '../domain/pdfContent'
import { K } from './chartVector'

// A page's drawing painted on a canvas (ticket 0915): the PNG is page 1 of the PDF as a picture, so the chart the PDF writes
// as operators (`PdfContent`) is painted here from the same calls. The canvas is in the page's layout px (150 dpi, scaled
// to the Export quality by its transform); the calls are in points.

/** Layout px per point. */
const PX = 1 / K

/** The PDF's built-in Helvetica, or the face a device has in its place, as a PDF viewer would take. */
const HELVETICA = "Helvetica, Arial, 'Liberation Sans', 'Nimbus Sans', sans-serif"

export class CanvasDrawing implements PageDrawing {
  private readonly context: CanvasRenderingContext2D
  /** The thinnest line, one device pixel: a hairline under it would fade rather than print. */
  private readonly hairline: number

  /** `scale` is the canvas's device pixels per layout px. */
  constructor(context: CanvasRenderingContext2D, scale: number) {
    this.context = context
    this.hairline = 1 / scale
  }

  private lineWidth(width: number): number {
    return Math.max(width * PX, this.hairline)
  }

  private paint(paint: Paint): void {
    const { context } = this
    if (paint.fill) {
      context.fillStyle = paint.fill
      context.fill()
    }
    if (paint.stroke) {
      context.strokeStyle = paint.stroke
      context.lineWidth = this.lineWidth(paint.lineWidth ?? 1)
      context.stroke()
    }
  }

  fillRect(x: number, y: number, width: number, height: number, color: string): void {
    this.context.fillStyle = color
    this.context.fillRect(x * PX, y * PX, width * PX, height * PX)
  }

  lines(segments: readonly (readonly [number, number, number, number])[], width: number, color: string): void {
    if (segments.length === 0) return
    const { context } = this
    context.beginPath()
    for (const [x1, y1, x2, y2] of segments) {
      context.moveTo(x1 * PX, y1 * PX)
      context.lineTo(x2 * PX, y2 * PX)
    }
    context.strokeStyle = color
    context.lineWidth = this.lineWidth(width)
    context.stroke()
  }

  roundRect(x: number, y: number, width: number, height: number, radius: number, paint: Paint): void {
    const r = Math.min(radius, width / 2, height / 2)
    this.context.beginPath()
    this.context.roundRect(x * PX, y * PX, width * PX, height * PX, r * PX)
    this.paint(paint)
  }

  polygon(points: readonly (readonly [number, number])[], paint: Paint): void {
    const { context } = this
    context.beginPath()
    points.forEach(([x, y], index) => (index === 0 ? context.moveTo(x * PX, y * PX) : context.lineTo(x * PX, y * PX)))
    context.closePath()
    this.paint(paint)
  }

  text(value: string, x: number, baseline: number, style: TextStyle, align: 'left' | 'center' | 'right' = 'left'): void {
    const { context } = this
    context.save()
    context.translate(x * PX, baseline * PX)
    context.scale((style.scale ?? 100) / 100, 1)
    context.font = `${style.face === 'bold' ? '700' : '400'} ${style.size * PX}px ${HELVETICA}`
    context.fillStyle = style.color
    context.textAlign = align
    context.textBaseline = 'alphabetic'
    context.fillText(value, 0, 0)
    context.restore()
  }
}
