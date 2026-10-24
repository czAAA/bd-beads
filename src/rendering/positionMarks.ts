import { beadRoundness, describeWeave, isShiftedRow, rowCycle, type BeadCell, type Technique } from '../domain/weave'
import { BEAD_GAP_PX, type DrawingContext } from './beadLook'
import { cellSizePx, CELL_SIZE_PX, rowPitchPx, type Region } from './surfaceView'

// Position marks (CONTEXT.md): the Canvas's empty positions outside the Frame, as one repeating tile (a bead across, a cycle of
// rows down: two for peyote/brick half-bead shifts, 2N with a Brick block of N) filled over the view, not a shape per position. A screen-size bitmap
// kept like the bead sprites (sprites.ts). Each mark is a square with one shared outline.

const MAX_TILES = 64
const tiles = new Map<string, CanvasImageSource | null>()

/** What a tile is made from: the Technique's row pitch, how big the grid is on screen, and the mark's color. */
export interface MarkTileInput {
  technique: Technique
  /** The Brick block (ticket 477); nothing is 1. */
  brickBlock?: number
  /** The Net size (ticket 485); nothing is the default. */
  netSize?: number
  /** How the Bead is drawn when the Bead shape is Real (ADR 0068); nothing is Symmetric. */
  cell?: BeadCell
  /** Device pixels per grid px: the zoom times the screen's pixel ratio. */
  deviceScale: number
  pixelRatio: number
  color: string
}

/** How many rows a tile holds: the shift's cycle, and at least two. */
function tileRows(input: Pick<MarkTileInput, 'technique' | 'brickBlock' | 'netSize' | 'cell'>): number {
  return Math.max(2, rowCycle(input))
}

interface Tile {
  /** The tile's size in grid px. */
  size: { width: number; height: number }
  /** The bead of each position the tile holds, in the order they are drawn. */
  beads: Region[]
}

/** What one tile holds: a bead across and a cycle of rows down, or the two beads of Right-angle weave that a Unit's
 * pitch repeats (ticket 482), or a net's diamond (ticket 485). */
function tileOf(input: Pick<MarkTileInput, 'technique' | 'brickBlock' | 'netSize' | 'cell'>): Tile {
  const description = describeWeave(input)
  if (description.countsUnits) {
    const cell = cellSizePx(input.technique, input.cell)
    return description.tile(cell.width, cell.height)
  }
  const { height: cellHeight } = cellSizePx(input.technique, input.cell)
  const pitch = rowPitchPx(input.technique, input.cell)
  return {
    size: { width: CELL_SIZE_PX, height: tileRows(input) * pitch },
    beads: Array.from({ length: tileRows(input) }, (_row, row) => ({
      x: isShiftedRow(input, row) ? CELL_SIZE_PX / 2 : 0,
      y: row * pitch,
      width: CELL_SIZE_PX,
      height: cellHeight,
    })),
  }
}

/** A rounded rectangle as a closed path (the corners cut by `radius`, 0 for square). */
function squarePath(context: DrawingContext, x: number, y: number, width: number, height: number, radius: number): void {
  radius = Math.min(radius, width / 2, height / 2)
  context.moveTo(x + radius, y)
  context.arcTo(x + width, y, x + width, y + height, radius)
  context.arcTo(x + width, y + height, x, y + height, radius)
  context.arcTo(x, y + height, x, y, radius)
  context.arcTo(x, y, x + width, y, radius)
  context.closePath()
}

// Draws a square for each tile position and the copies spilling over its edges, top row down as beads are: each first
// clears the bead's own area (so overlapping peyote rows leave no outline showing through), then outlines the cell's
// edge, centred in the gap it shares with its neighbour, at most 1 CSS px thick.
function drawSquares(context: DrawingContext, input: MarkTileInput, tile: Tile): void {
  const { size } = tile
  const radius = beadRoundness(input.technique, input.cell) * CELL_SIZE_PX
  const zoom = input.deviceScale / input.pixelRatio
  const squares: Region[] = []
  for (const bead of tile.beads) {
    for (const dx of [-size.width, 0, size.width]) {
      for (const dy of [-size.height, 0, size.height]) {
        squares.push({ ...bead, x: bead.x + dx, y: bead.y + dy })
      }
    }
  }
  squares.sort((a, b) => a.y - b.y)
  context.strokeStyle = input.color
  context.lineWidth = Math.min(BEAD_GAP_PX, 1 / zoom)
  const inset = BEAD_GAP_PX / 2
  for (const { x, y, width, height } of squares) {
    context.save()
    context.globalCompositeOperation = 'destination-out'
    context.beginPath()
    squarePath(context, x + inset, y + inset, width - BEAD_GAP_PX, height - BEAD_GAP_PX, Math.max(0, radius - inset))
    context.fill()
    context.restore()
    context.beginPath()
    squarePath(context, x, y, width, height, radius)
    context.stroke()
  }
}

// The tile for the Canvas's Position marks as a pattern on `context`, scaled to repeat every bead across in grid px, or
// undefined without a canvas. Fill with it while the context is in grid space.
export function positionMarkPattern(context: DrawingContext, input: MarkTileInput): CanvasPattern | undefined {
  if (typeof document === 'undefined') {
    return undefined
  }
  const tileShape = tileOf(input)
  const size = tileShape.size
  const width = Math.max(1, Math.round(size.width * input.deviceScale))
  const height = Math.max(1, Math.round(size.height * input.deviceScale))
  // The tile's size is in the key too; the roundness is the only part of the cell it doesn't show.
  const key = [input.technique, input.cell?.roundness ?? '', width, height, input.pixelRatio, input.color].join('|')

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
      drawSquares(own, input, tileShape)
    }
    tile = own ? canvas : null
    tiles.set(key, tile)
  }
  const pattern = tile ? (context as unknown as CanvasRenderingContext2D).createPattern(tile, 'repeat') : null
  pattern?.setTransform({ a: size.width / width, d: size.height / height })
  return pattern ?? undefined
}
