import { beadRoundness, describeWeave, type BeadCell, type Technique, type TechniqueSettings } from '../domain/weave'
import { BEAD_GAP_PX, type DrawingContext } from './beadLook'
import { cellSizePx, CELL_SIZE_PX } from './cellSize'
import type { Region } from './surfaceView'

// Position marks (CONTEXT.md): the Canvas's empty positions outside the Frame, as one repeating tile (a bead across, a cycle of
// rows down: 2N for peyote and brick stitch with a Drop of N) filled over the view, not a shape per position. A screen-size bitmap
// kept like the bead sprites (sprites.ts). Each mark is a square with one shared outline.

const MAX_TILES = 64
const tiles = new Map<string, CanvasImageSource | null>()

/** What a tile is made from: the Technique's row pitch, how big the grid is on screen, and the mark's color. */
export interface MarkTileInput {
  technique: Technique
  /** Its settings (ticket 0625): peyote's or brick stitch's Drop; one left out is its default. */
  techniqueSettings?: TechniqueSettings
  /** How the Bead is drawn (ADR 0068, ticket 0724); nothing for a layer with no known Bead. */
  cell?: BeadCell
  /** Device pixels per grid px: the zoom times the screen's pixel ratio. */
  deviceScale: number
  pixelRatio: number
  color: string
}

interface Tile {
  /** The tile's size in grid px. */
  size: { width: number; height: number }
  /** The bead of each position the tile holds, in the order they are drawn. */
  beads: Region[]
}

/** What one tile holds, as the Weave's description gives it: a bead across and a cycle of rows down. */
function tileOf(input: Pick<MarkTileInput, 'technique' | 'techniqueSettings' | 'cell'>): Tile {
  const cell = cellSizePx(input.technique, input.cell)
  return describeWeave(input).tile(cell.width, cell.height)
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

/** The tile as a bitmap, kept by its key, with its size in grid px; null without a canvas. */
function tileBitmap(input: MarkTileInput): { tile: CanvasImageSource | null; key: string; size: Tile['size']; width: number; height: number } | undefined {
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
  return { tile, key, size, width, height }
}

// The tile for the Canvas's Position marks as a pattern on `context`, scaled to repeat every bead across in grid px, or
// undefined without a canvas. Fill with it while the context is in grid space.
export function positionMarkPattern(context: DrawingContext, input: MarkTileInput): CanvasPattern | undefined {
  const bitmap = tileBitmap(input)
  if (!bitmap) {
    return undefined
  }
  const { tile, size, width, height } = bitmap
  const pattern = tile ? (context as unknown as CanvasRenderingContext2D).createPattern(tile, 'repeat') : null
  pattern?.setTransform({ a: size.width / width, d: size.height / height })
  return pattern ?? undefined
}

/** The same tile as a CSS background: an image URL and the size it repeats at in CSS px, for a page that is not a
 * canvas (the Homepage). Undefined without a canvas to draw it on. */
export function positionMarkBackground(input: MarkTileInput): { url: string; width: number; height: number } | undefined {
  const bitmap = tileBitmap(input)
  const tile = bitmap?.tile
  if (!bitmap || !(tile instanceof HTMLCanvasElement)) {
    return undefined
  }
  const url = tile.toDataURL()
  return url === 'data:,' ? undefined : { url, width: bitmap.size.width * (input.deviceScale / input.pixelRatio), height: bitmap.size.height * (input.deviceScale / input.pixelRatio) }
}

/** The part of a map from grid px to the screen that turns it, a quarter turn: each entry -1, 0 or 1. */
export interface QuarterTurn {
  a: number
  b: number
  c: number
  d: number
}

const turnedUrls = new Map<string, string | undefined>()

/** The same tile turned as the screen shows the grid, as an image URL for a CSS background (ticket 0717): the empty
 * Canvas laid under the editor's drawing. Kept by key, as a pinch asks again and again; undefined without a canvas. */
export function positionMarkImage(input: MarkTileInput, turn: QuarterTurn): string | undefined {
  const bitmap = tileBitmap(input)
  const tile = bitmap?.tile
  if (!bitmap || !(tile instanceof HTMLCanvasElement)) return undefined
  const key = [bitmap.key, turn.a, turn.b, turn.c, turn.d].join('|')
  if (turnedUrls.has(key)) return turnedUrls.get(key)
  if (turnedUrls.size >= MAX_TILES) turnedUrls.clear()
  const { width, height } = bitmap
  const turned = document.createElement('canvas')
  turned.width = Math.abs(turn.a) * width + Math.abs(turn.c) * height
  turned.height = Math.abs(turn.b) * width + Math.abs(turn.d) * height
  const own = turned.getContext('2d')
  let url: string | undefined
  if (own) {
    // Turned about its corner, then moved back so the turned tile starts at the canvas's.
    own.setTransform(turn.a, turn.b, turn.c, turn.d, -Math.min(0, turn.a * width, turn.c * height, turn.a * width + turn.c * height), -Math.min(0, turn.b * width, turn.d * height, turn.b * width + turn.d * height))
    own.drawImage(tile, 0, 0)
    url = turned.toDataURL()
  }
  url = url === 'data:,' ? undefined : url
  turnedUrls.set(key, url)
  return url
}
