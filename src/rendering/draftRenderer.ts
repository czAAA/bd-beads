import { describeWeave, draftCost, type Technique, type TechniqueSettings, type Weave } from '../domain/weave'
import type { Rect } from '../domain/canvas'
import type { GridPosition } from '../domain/grid'
import type { PastedCell } from '../domain/selection'
import type { WeaveGeometry } from '../domain/weaveGeometry'
import { parseColor, type DrawingContext, type ProjectTheme } from './beadLook'
import { CELL_SIZE_PX, cellSizePx } from './cellSize'

// A coarse look for a block of beads being moved (ticket 122, ADR 0018): one flat pixel per bead stretched in a single
// blit, instead of a blit per rounded bead, which kept the Convert image framing drag under 30 fps (peyote, 250 x 250).
// Keeps positions and colors, drops rim and rounding; only while moving, at rest the Project renderer draws.

/** How many square beads are worth drawing for real on every move; a Technique's entry says what its bead costs. */
const DRAWING_BUDGET = 15_000

/** Whether a block of this many beads is too many to draw as beads on every move of a drag. */
export function usesDraftLook(technique: Technique, beadCount: number): boolean {
  return beadCount * draftCost(technique) > DRAWING_BUDGET
}

/** How big a bead is on the screen, in device px, below which the editor draws each layer in the draft look (ticket
 * 0676): there its gap and rim are a fraction of a pixel, and a draw a bead cost a stall on a big pattern. */
const DRAFT_BEAD_PX = 5

/** Whether beads `deviceScale` device px to a px of grid space are drawn in the draft look in the editor. */
export function drawsDraft(deviceScale: number): boolean {
  return CELL_SIZE_PX * deviceScale < DRAFT_BEAD_PX
}

interface DraftImage {
  width: number
  height: number
  /** RGBA, row by row. */
  data: Uint8ClampedArray<ArrayBuffer>
}

const rgbOf = new Map<string, readonly [number, number, number]>()

/** A `#rrggbb` (or `#rgb`, or a faded bead's `rgb(r, g, b)`) as its channels, remembered: a picture has few colors and
 * a drag asks for every bead's on every move. Anything else reads as black. */
function channels(color: string): readonly [number, number, number] {
  let known = rgbOf.get(color)
  if (!known) {
    const { r, g, b } = parseColor(color) ?? { r: 0, g: 0, b: 0 }
    known = [r, g, b]
    rgbOf.set(color, known)
  }
  return known
}

/** The most pixels a bead takes across in the draft: a row shift finer than this many parts of a bead is drawn to the
 * nearest of them. */
const MAX_PIXELS_PER_BEAD = 8

/** How close to a whole number of pixels a shift must come to count as one: a third times three is not exactly 1. */
const WHOLE_PIXEL_TOLERANCE = 1e-9

/** How many pixels a bead takes across so its row shift is a whole number of them: 1 where rows don't shift, 2 for half
 * a bead, 3 for a third. */
function pixelsPerBead(shift: number): number {
  for (let wide = 1; wide < MAX_PIXELS_PER_BEAD; wide += 1) {
    if (Math.abs(shift * wide - Math.round(shift * wide)) < WHOLE_PIXEL_TOLERANCE) {
      return wide
    }
  }
  return MAX_PIXELS_PER_BEAD
}

/** The beads as an image at the description's own row shift: as many pixels a bead as put a shifted row a whole number
 * of them in (one for loom, two for peyote). `colors` is one entry per bead, row by row; undefined is empty.
 * @internal Its test reads the pixels on their own. */
export function draftImage(geometry: Pick<WeaveGeometry, 'shift' | 'rowOffset'>, columns: number, rows: number, colors: readonly (string | undefined)[], theme: ProjectTheme): DraftImage {
  const wide = pixelsPerBead(geometry.shift)
  const width = columns * wide + Math.round(geometry.shift * wide)
  const data = new Uint8ClampedArray(width * rows * 4)
  const [backgroundR, backgroundG, backgroundB] = channels(theme.background)
  for (let at = 0; at < data.length; at += 4) {
    data[at] = backgroundR
    data[at + 1] = backgroundG
    data[at + 2] = backgroundB
    data[at + 3] = 255
  }

  for (let row = 0; row < rows; row += 1) {
    const start = Math.round(geometry.rowOffset(row, wide))
    for (let column = 0; column < columns; column += 1) {
      const [r, g, b] = channels(colors[row * columns + column] ?? theme.emptyBead)
      for (let across = 0; across < wide; across += 1) {
        const at = (row * width + start + column * wide + across) * 4
        data[at] = r
        data[at + 1] = g
        data[at + 2] = b
      }
    }
  }
  return { width, height: rows, data }
}

let scratch: HTMLCanvasElement | undefined

/** Draws the beads in the draft look over all of `context`'s canvas, sized to the block's extent (`bitmapWidth` ×
 * `bitmapHeight` device px). */
export function renderDraft(
  context: CanvasRenderingContext2D,
  input: {
    technique: Technique
    techniqueSettings?: TechniqueSettings
    columns: number
    rows: number
    colors: readonly (string | undefined)[]
    theme: ProjectTheme
    bitmapWidth: number
    bitmapHeight: number
  },
): void {
  const { technique, techniqueSettings, columns, rows, colors, theme, bitmapWidth, bitmapHeight } = input
  const image = draftImage(describeWeave({ technique, techniqueSettings }), columns, rows, colors, theme)

  scratch ??= document.createElement('canvas')
  scratch.width = image.width
  scratch.height = image.height
  const scratchContext = scratch.getContext('2d')
  if (!scratchContext) {
    return
  }
  scratchContext.putImageData(new ImageData(image.data, image.width, image.height), 0, 0)

  context.setTransform(1, 0, 0, 1, 0, 0)
  // Every pixel is a bead's worth of color, stretched as it is: smoothing would blur one bead into the next.
  context.imageSmoothingEnabled = false
  context.drawImage(scratch, 0, 0, image.width, image.height, 0, 0, bitmapWidth, bitmapHeight)
}

/** Where a draft image of a block of positions puts each bead (tickets 0675, 0676): `wide` pixels a bead across as in
 * `draftImage`, a row's first pixel at its shift, so the block's first column of an unshifted row is pixel 0. */
function draftLayout(geometry: Pick<WeaveGeometry, 'shift' | 'rowOffset'>, block: Rect): { wide: number; width: number; height: number; pixelOf: (row: number, column: number) => number } {
  const wide = pixelsPerBead(geometry.shift)
  const width = block.columns * wide + Math.round(geometry.shift * wide)
  return { wide, width, height: block.rows, pixelOf: (row, column) => (row - block.row) * width + Math.round(geometry.rowOffset(row, wide)) + (column - block.column) * wide }
}

/** Puts one bead's color into a draft image's pixels, `wide` of them from pixel `start`, opaque. */
function putPixels(data: Uint8ClampedArray, start: number, wide: number, color: string): void {
  const [r, g, b] = channels(color)
  for (let at = start * 4; at < (start + wide) * 4; at += 4) {
    data[at] = r
    data[at + 1] = g
    data[at + 2] = b
    data[at + 3] = 255
  }
}

/** Beads where they lie as a draft image (ticket 0675): `wide` pixels a bead across as in `draftImage`, its first pixel
 * at `firstColumn` of `firstRow`, the first any bead reaches, and clear where there is no bead.
 * @internal Its test reads the pixels on their own. */
export function draftOfBeads(geometry: Pick<WeaveGeometry, 'shift' | 'rowOffset'>, beads: readonly PastedCell[]): DraftImage & { firstRow: number; firstColumn: number; wide: number } {
  const block = blockAround(beads) ?? { row: 0, column: 0, rows: 0, columns: 0 }
  const { wide, width, height, pixelOf } = draftLayout(geometry, block)
  const data = new Uint8ClampedArray(width * height * 4)
  for (const { row, column, color } of beads) putPixels(data, pixelOf(row, column), wide, color)
  return { width, height, data, firstRow: block.row, firstColumn: block.column, wide }
}

/** The rectangle of positions round some beads, or undefined for none. */
export function blockAround(beads: readonly GridPosition[]): Rect | undefined {
  if (beads.length === 0) return undefined
  // Loops, not Math.min(...): a block zoomed out can hold more beads than a call takes arguments.
  let [firstRow, lastRow, firstColumn, lastColumn] = [Infinity, -Infinity, Infinity, -Infinity]
  for (const { row, column } of beads) {
    firstRow = Math.min(firstRow, row)
    lastRow = Math.max(lastRow, row)
    firstColumn = Math.min(firstColumn, column)
    lastColumn = Math.max(lastColumn, column)
  }
  return { row: firstRow, column: firstColumn, rows: lastRow - firstRow + 1, columns: lastColumn - firstColumn + 1 }
}

/** Gives each bead of a draft its color: `put` it at its position, a hex. */
export type DraftPainter = (put: (row: number, column: number, color: string) => void) => void

/** A draft image of a block, on a canvas, and where it goes: what `layDraft` puts down. */
export interface DraftImageOf {
  image: HTMLCanvasElement
  block: Rect
  weave: Weave
}

/** Paints a block's draft image onto `canvas`, sized to it: `paint` puts each bead's color, clear where it puts none.
 * Undefined where the canvas has no 2D context. */
function paintDraft(canvas: HTMLCanvasElement, weave: Weave, block: Rect, paint: DraftPainter): DraftImageOf | undefined {
  const { wide, width, height, pixelOf } = draftLayout(describeWeave(weave), block)
  // Resizing a canvas reallocates it: a pan at one zoom keeps the size.
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }
  const own = canvas.getContext('2d')
  if (!own) return undefined
  const pixels = own.createImageData(width, height)
  paint((row, column, color) => putPixels(pixels.data, pixelOf(row, column), wide, color))
  own.putImageData(pixels, 0, 0)
  return { image: canvas, block, weave }
}

/** How many pixels a draft image kept from draw to draw may hold (16 MB): past it, a layer whose beads lie far apart is
 * drawn from the part in view each time. */
const MOST_KEPT_PIXELS = 4_000_000

/** A block's draft image on a canvas of its own, to keep and lay down again while only the view moves (ticket 0676).
 * Undefined past MOST_KEPT_PIXELS or with no canvas. */
export function keptDraft(weave: Weave, block: Rect, paint: DraftPainter): DraftImageOf | undefined {
  const { width, height } = draftLayout(describeWeave(weave), block)
  if (block.rows <= 0 || block.columns <= 0 || width * height > MOST_KEPT_PIXELS) return undefined
  return paintDraft(document.createElement('canvas'), weave, block, paint)
}

/** Lays a draft image over its beads' boxes through the context's grid transform and at its opacity (tickets 0675,
 * 0676). `origin` is where the layer's row 0, column 0 lies in grid px. Each row is drawn its pitch tall from its top,
 * where a later row nests. */
export function layDraft(context: DrawingContext, { image, block, weave }: DraftImageOf, origin: { x: number; y: number } = { x: 0, y: 0 }): void {
  const description = describeWeave(weave)
  const { wide, width, height } = draftLayout(description, block)
  const cell = cellSizePx(weave.technique, weave.cell)
  const corner = description.box({ row: block.row, column: block.column }, cell.width, cell.height)
  const pitch = description.box({ row: block.row + 1, column: block.column }, cell.width, cell.height).y - corner.y
  const x = origin.x + corner.x - description.rowOffset(block.row, cell.width)
  context.drawImage(image, 0, 0, width, height, x, origin.y + corner.y, (width * cell.width) / wide, height * pitch)
}

let beadsScratch: HTMLCanvasElement | undefined

/** Draws a block of a layer's positions in the draft look, one image through the context's grid transform and at its
 * opacity (tickets 0675, 0676), on a scratch canvas drawn again each time: `paint` puts each bead's color. */
export function drawDraftBlock(context: DrawingContext, weave: Weave, block: Rect, paint: DraftPainter, origin: { x: number; y: number } = { x: 0, y: 0 }): void {
  if (block.rows <= 0 || block.columns <= 0) return
  beadsScratch ??= document.createElement('canvas')
  const painted = paintDraft(beadsScratch, weave, block, paint)
  if (painted) layDraft(context, painted, origin)
}

/** Draws beads where they lie in the draft look, through the context's grid transform and at its opacity (ticket 0675):
 * one image for a big paste preview zoomed out, where a fill a bead would cost more than the screen shows. */
export function drawDraftBeads(context: DrawingContext, weave: Weave, beads: readonly PastedCell[]): void {
  const block = blockAround(beads)
  if (!block) return
  drawDraftBlock(context, weave, block, (put) => {
    for (const { row, column, color } of beads) put(row, column, color)
  })
}
