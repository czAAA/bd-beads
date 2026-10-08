import type { Technique } from '../domain/grid'
import { beadRoundness, type DrawingContext } from './beadLook'
import { CELL_SIZE_PX, rowPitchPx } from './surfaceView'

/**
 * Position marks (CONTEXT.md): how the open canvas's empty positions outside the Frame are drawn. They are one repeating
 * tile, a bead across and two rows down (so the alternate rows of peyote and brick stitch carry their half-bead shift),
 * filled over the whole view at once, rather than one shape for each of the tens of thousands of positions a zoomed-out
 * canvas shows. The tile is a bitmap at the size it is on the screen, kept like the bead sprites (sprites.ts). Its style
 * is a preference of the device: Dots, or Squares, an outline in the gap round each position.
 */

/** How Position marks look (CONTEXT.md). */
export type PositionMarkStyle = 'dots' | 'squares'

/** The dot that marks an empty position: 1.5px across on screen (BeadBoard card). */
const DOT_DIAMETER_PX = 1.5

/** The gap a bead stands in from its cell on each side (beadLook.ts): where a square's outline sits. */
const GAP_PX = 1

const MAX_TILES = 64
const tiles = new Map<string, CanvasImageSource | null>()

/** What a tile is made from: the Technique's row pitch, how big the grid is on screen, and the mark's color. */
export interface MarkTileInput {
  style: PositionMarkStyle
  technique: Technique
  /** Device pixels per grid px: the zoom times the screen's pixel ratio. */
  deviceScale: number
  pixelRatio: number
  color: string
}

/** A tile's size in grid px: one bead across, two rows down. */
function tileSizePx(technique: Technique): { width: number; height: number } {
  return { width: CELL_SIZE_PX, height: 2 * rowPitchPx(technique) }
}

/** Draws every mark of one tile, and the copies that spill over its edges so that they wrap round. */
function drawDots(context: DrawingContext, input: MarkTileInput, size: { width: number; height: number }): void {
  const pitch = rowPitchPx(input.technique)
  const radius = DOT_DIAMETER_PX / 2 / (input.deviceScale / input.pixelRatio)
  const shifted = input.technique === 'loom' ? 0 : CELL_SIZE_PX / 2
  context.fillStyle = input.color
  context.beginPath()
  for (const [x, y] of [
    [CELL_SIZE_PX / 2, CELL_SIZE_PX / 2],
    [CELL_SIZE_PX / 2 + shifted, pitch + CELL_SIZE_PX / 2],
  ] as const) {
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

/**
 * Draws a square for each position of the tile, and the copies that spill over its edges, from the top row down, as the
 * beads are drawn: each one first clears the bead's own area (so the rows of peyote that overlap leave no outline
 * showing through the bead above), then draws the outline in the 1px gap round it, at most 1 CSS px thick.
 */
function drawSquares(context: DrawingContext, input: MarkTileInput, size: { width: number; height: number }): void {
  const pitch = rowPitchPx(input.technique)
  const radius = beadRoundness(input.technique) * CELL_SIZE_PX
  const shifted = input.technique === 'loom' ? 0 : CELL_SIZE_PX / 2
  const zoom = input.deviceScale / input.pixelRatio
  const squares: { x: number; y: number }[] = []
  for (const [x, y] of [
    [0, 0],
    [shifted, pitch],
  ] as const) {
    for (const dx of [-size.width, 0, size.width]) {
      for (const dy of [-size.height, 0, size.height]) {
        squares.push({ x: x + dx, y: y + dy })
      }
    }
  }
  squares.sort((a, b) => a.y - b.y)
  context.strokeStyle = input.color
  context.lineWidth = Math.min(GAP_PX, 1 / zoom)
  for (const { x, y } of squares) {
    context.save()
    context.globalCompositeOperation = 'destination-out'
    context.beginPath()
    squarePath(context, x + GAP_PX, y + GAP_PX, CELL_SIZE_PX - 2 * GAP_PX, Math.max(0, radius - GAP_PX))
    context.fill()
    context.restore()
    context.beginPath()
    squarePath(context, x + GAP_PX / 2, y + GAP_PX / 2, CELL_SIZE_PX - GAP_PX, Math.max(0, radius - GAP_PX / 2))
    context.stroke()
  }
}

/**
 * The tile for the open canvas's Position marks as a pattern on `context`, scaled so that it repeats every bead across
 * in grid px, or undefined where there is no canvas to make the bitmap on. Fill with it while the context is in grid space.
 */
export function positionMarkPattern(context: DrawingContext, input: MarkTileInput): CanvasPattern | undefined {
  if (typeof document === 'undefined') {
    return undefined
  }
  const size = tileSizePx(input.technique)
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
