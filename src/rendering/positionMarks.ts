import type { Technique } from '../domain/grid'
import type { DrawingContext } from './beadLook'
import { CELL_SIZE_PX, rowPitchPx } from './surfaceView'

/**
 * Position marks (CONTEXT.md): how the open canvas's empty positions outside the Frame are drawn. They are one repeating
 * tile, a bead across and two rows down (so the alternate rows of peyote and brick stitch carry their half-bead shift),
 * filled over the whole view at once, rather than one shape for each of the tens of thousands of positions a zoomed-out
 * canvas shows. The tile is a bitmap at the size it is on the screen, kept like the bead sprites (sprites.ts).
 */

/** The dot that marks an empty position: 1.5px across on screen (BeadBoard card). */
const DOT_DIAMETER_PX = 1.5

const MAX_TILES = 64
const tiles = new Map<string, CanvasImageSource | null>()

/** What a tile is made from: the Technique's row pitch, how big the grid is on screen, and the mark's color. */
export interface MarkTileInput {
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
  const key = ['dots', input.technique, width, height, input.pixelRatio, input.color].join('|')

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
      drawDots(own, input, size)
    }
    tile = own ? canvas : null
    tiles.set(key, tile)
  }
  const pattern = tile ? (context as unknown as CanvasRenderingContext2D).createPattern(tile, 'repeat') : null
  pattern?.setTransform({ a: size.width / width, d: size.height / height })
  return pattern ?? undefined
}
