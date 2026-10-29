import { colorAt } from '../domain/canvas'
import { fromHex } from '../domain/color'
import { rotationSwapsAxes, type GridPosition } from '../domain/grid'
import type { LayoutPoint } from '../domain/frameLayout'
import { projectFrame } from '../domain/projectExtent'
import type { DrawnProject } from './projectRenderer'
import { geometryDrawnAlone } from './space'
import { gridToRegion } from './surfaceView'
import { beadsOfLayer, orientationOf } from '../domain/layerRecord'

export interface ThumbnailImage {
  width: number
  height: number
  /** RGBA, row by row, as ImageData takes it. */
  data: Uint8ClampedArray
}

/** What a thumbnail reads of a Project: its beads, Frame, Weaves, Bead shape and rotation. */
type Thumbnailed = DrawnProject

/** A pixel is sampled at its centre. */
const PIXEL_CENTRE = 0.5

/** A hex as [r, g, b]; anything else is left clear. */
function rgb(hex: string): [number, number, number] | undefined {
  const channels = fromHex(hex)
  return channels && [channels.r, channels.g, channels.b]
}

/** A Saved Project's thumbnail (tickets 147, 0631): the Project drawn on its own, fitted to `size` px, its beads where
 * its Layer geometry lays them (shifted rows, a Custom frame's shape), turned as the editor turns it. A grid is sampled
 * a pixel at a time, so cost is at most size × size (ADR 0019); a Custom frame, which is small, bead by bead. */
export function thumbnailPixels(project: Thumbnailed, size: number): ThumbnailImage {
  const geometry = geometryDrawnAlone(project)
  const extent = geometry.extent()
  if (!extent || extent.width <= 0 || extent.height <= 0) {
    return { width: 1, height: 1, data: new Uint8ClampedArray(4) }
  }
  const [across, down] = rotationSwapsAxes(orientationOf(project)) ? [extent.height, extent.width] : [extent.width, extent.height]
  const scale = size / Math.max(across, down)
  const width = Math.max(1, Math.round(across * scale))
  const height = Math.max(1, Math.round(down * scale))
  const data = new Uint8ClampedArray(width * height * 4)
  const colors = new Map<string, [number, number, number] | undefined>()
  const drawnBox = projectFrame(project)
  const [canvas, framed] = [beadsOfLayer(project, 'canvas'), beadsOfLayer(project, 'frame')]
  const colorOf = ({ row, column }: GridPosition) => (framed ? colorAt(framed, row, column) : colorAt(canvas, drawnBox.row + row, drawnBox.column + column))

  // The editor's own turn (gridToRegion), from the Layer to the picture's pixels, and its inverse.
  const [a, b, c, d, e, f] = gridToRegion(extent, { x: 0, y: 0, width: 0, height: 0 }, scale, orientationOf(project))
  const det = a * d - b * c
  const toPixel = ({ x, y }: LayoutPoint): [number, number] => [a * (x - extent.x) + c * (y - extent.y) + e, b * (x - extent.x) + d * (y - extent.y) + f]
  const pixelOnLayer = (px: number, py: number): LayoutPoint => {
    const [dx, dy] = [px + PIXEL_CENTRE - e, py + PIXEL_CENTRE - f]
    return { x: extent.x + (d * dx - c * dy) / det, y: extent.y + (a * dy - b * dx) / det }
  }
  const paint = (x: number, y: number, hex: string) => {
    if (!colors.has(hex)) colors.set(hex, rgb(hex))
    const color = colors.get(hex)
    if (!color) return
    const at = (y * width + x) * 4
    data[at] = color[0]
    data[at + 1] = color[1]
    data[at + 2] = color[2]
    data[at + 3] = 255
  }

  if (geometry.grid) {
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const position = geometry.positionAt(pixelOnLayer(x, y))
        const hex = position && colorOf(position)
        if (hex) paint(x, y, hex)
      }
    }
    return { width, height, data }
  }

  for (const position of geometry.positions()) {
    const hex = colorOf(position)
    const place = hex && geometry.place(position)
    if (!hex || !place) continue
    const { box, angle } = place
    const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    const [cos, sin] = [Math.cos(angle), Math.sin(angle)]
    // The pixels round the bead whichever way it is turned, then those whose centre it covers.
    const reach = (Math.hypot(box.width, box.height) / 2) * scale
    const span = (at: number, last: number): [number, number] => [Math.max(0, Math.ceil(at - reach - PIXEL_CENTRE)), Math.min(last, Math.floor(at + reach - PIXEL_CENTRE))]
    const [u, v] = toPixel(centre)
    const [left, right] = span(u, width - 1)
    const [top, bottom] = span(v, height - 1)
    for (let y = top; y <= bottom; y += 1) {
      for (let x = left; x <= right; x += 1) {
        const point = pixelOnLayer(x, y)
        const [dx, dy] = [point.x - centre.x, point.y - centre.y]
        if (Math.abs(dx * cos + dy * sin) <= box.width / 2 && Math.abs(dy * cos - dx * sin) <= box.height / 2) paint(x, y, hex)
      }
    }
  }
  return { width, height, data }
}
