import { isShiftedRow, rowCycle, type Technique } from '../domain/grid'
import { BEAD_GAP_PX, beadRoundness, type DrawingContext } from './beadLook'
import { CELL_SIZE_PX, rowPitchPx } from './surfaceView'

// Position marks (CONTEXT.md): the Canvas's empty positions outside the Frame, as one repeating tile (a bead across, a cycle of
// rows down: two for peyote/brick half-bead shifts, 2N with a Brick block of N) filled over the view, not a shape per position. A screen-size bitmap
// kept like the bead sprites (sprites.ts). Style is a device preference: Dots, or Squares with one shared outline.

/** How Position marks look (CONTEXT.md). */
export type PositionMarkStyle = 'dots' | 'squares'

/** The dot that marks an empty position: 1.5px across on screen (BeadBoard card). */
const DOT_DIAMETER_PX = 1.5

const MAX_TILES = 64
const tiles = new Map<string, CanvasImageSource | null>()

/** What a tile is made from: the Technique's row pitch, how big the grid is on screen, and the mark's color. */
export interface MarkTileInput {
  style: PositionMarkStyle
  technique: Technique
  /** The Brick block (ticket 477); nothing is 1. */
  brickBlock?: number
  /** Device pixels per grid px: the zoom times the screen's pixel ratio. */
  deviceScale: number
  pixelRatio: number
  color: string
}

/** How many rows a tile holds: the shift's cycle, and at least two. */
function tileRows(input: Pick<MarkTileInput, 'technique' | 'brickBlock'>): number {
  return Math.max(2, rowCycle(input))
}

/** The sideways shift of each row of a tile, in grid px. */
function rowShifts(input: Pick<MarkTileInput, 'technique' | 'brickBlock'>): number[] {
  return Array.from({ length: tileRows(input) }, (_row, row) => (isShiftedRow(input, row) ? CELL_SIZE_PX / 2 : 0))
}

/** A tile's size in grid px: one bead across, a cycle of rows down. */
function tileSizePx(input: Pick<MarkTileInput, 'technique' | 'brickBlock'>): { width: number; height: number } {
  return { width: CELL_SIZE_PX, height: tileRows(input) * rowPitchPx(input.technique) }
}

/** Draws every mark of one tile, and the copies that spill over its edges so that they wrap round. */
function drawDots(context: DrawingContext, input: MarkTileInput, size: { width: number; height: number }): void {
  const pitch = rowPitchPx(input.technique)
  const radius = DOT_DIAMETER_PX / 2 / (input.deviceScale / input.pixelRatio)
  context.fillStyle = input.color
  context.beginPath()
  for (const [x, y] of rowShifts(input).map((shift, row) => [CELL_SIZE_PX / 2 + shift, row * pitch + CELL_SIZE_PX / 2] as const)) {
    for (const dx of [-size.width, 0, size.width]) {
      for (const dy of [-size.height, 0, size.height]) {
        context.moveTo(x + dx + radius, y + dy)
        context.arc(x + dx, y + dy, radius, 0, Math.PI * 2)
      }
    }
  }
  context.fill()
}

/** A rounded rectangle as a closed path (the corners cut by `radius`, 0 for square). */
function squarePath(context: DrawingContext, x: number, y: number, size: number, radius: number): void {
  context.moveTo(x + radius, y)
  context.arcTo(x + size, y, x + size, y + size, radius)
  context.arcTo(x + size, y + size, x, y + size, radius)
  context.arcTo(x, y + size, x, y, radius)
  context.arcTo(x, y, x + size, y, radius)
  context.closePath()
}

// Draws a square for each tile position and the copies spilling over its edges, top row down as beads are: each first
// clears the bead's own area (so overlapping peyote rows leave no outline showing through), then outlines the cell's
// edge, centred in the gap it shares with its neighbour, at most 1 CSS px thick.
function drawSquares(context: DrawingContext, input: MarkTileInput, size: { width: number; height: number }): void {
  const pitch = rowPitchPx(input.technique)
  const radius = beadRoundness(input.technique) * CELL_SIZE_PX
  const zoom = input.deviceScale / input.pixelRatio
  const squares: { x: number; y: number }[] = []
  for (const [x, y] of rowShifts(input).map((shift, row) => [shift, row * pitch] as const)) {
    for (const dx of [-size.width, 0, size.width]) {
      for (const dy of [-size.height, 0, size.height]) {
        squares.push({ x: x + dx, y: y + dy })
      }
    }
  }
  squares.sort((a, b) => a.y - b.y)
  context.strokeStyle = input.color
  context.lineWidth = Math.min(BEAD_GAP_PX, 1 / zoom)
  const inset = BEAD_GAP_PX / 2
  for (const { x, y } of squares) {
    context.save()
    context.globalCompositeOperation = 'destination-out'
    context.beginPath()
    squarePath(context, x + inset, y + inset, CELL_SIZE_PX - BEAD_GAP_PX, Math.max(0, radius - inset))
    context.fill()
    context.restore()
    context.beginPath()
    squarePath(context, x, y, CELL_SIZE_PX, radius)
    context.stroke()
  }
}

// The tile for the Canvas's Position marks as a pattern on `context`, scaled to repeat every bead across in grid px, or
// undefined without a canvas. Fill with it while the context is in grid space.
export function positionMarkPattern(context: DrawingContext, input: MarkTileInput): CanvasPattern | undefined {
  if (typeof document === 'undefined') {
    return undefined
  }
  const size = tileSizePx(input)
  const width = Math.max(1, Math.round(size.width * input.deviceScale))
  const height = Math.max(1, Math.round(size.height * input.deviceScale))
  const key = [input.style, input.technique, width, height, input.pixelRatio, input.color].join('|')

  let tile = tiles.get(key)
  if (tile === undefined) {
    if (tiles.size >= MAX_TILES) {
      tiles.clear()
    }
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const own = canvas.getContext('2d')
    if (own) {
      own.setTransform(width / size.width, 0, 0, height / size.height, 0, 0)
      if (input.style === 'squares') {
        drawSquares(own, input, size)
      } else {
        drawDots(own, input, size)
      }
    }
    tile = own ? canvas : null
    tiles.set(key, tile)
  }
  const pattern = tile ? (context as unknown as CanvasRenderingContext2D).createPattern(tile, 'repeat') : null
  pattern?.setTransform({ a: size.width / width, d: size.height / height })
  return pattern ?? undefined
}
