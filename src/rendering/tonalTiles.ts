import { BLACK_WHITE_BALANCE, channelsOf, fromCielab, relativeLuminance, toCielab, toHex } from '../domain/color'
import type { DrawingContext, ProjectTheme } from './beadLook'
import { drawsDraft } from './draftRenderer'
import { cachedSprite } from './sprites'

// Tonal tiles (ticket 1001, BeadBoard card, Canvas look): on the screen in light and dark, every empty position is a
// faint filled tile and the grid is the gap between two, where the Background shows. One rule makes the tile from any
// Background, a Custom color included, so the grid is equally quiet on every one.

/** How far a tile steps from its Background toward ink, in CIELAB lightness (L*): about 1.2:1. One constant, so it
 * can be tuned on a real screen (ticket 1005).
 * @internal Exported for that tuning; tests check a tile against it. */
export const TILE_STEP_L = 6.5

/** How far a tile stands in from its position's cell on every side, in grid px: the gap between two is twice it.
 * @internal Tests check the tile's shape against it. */
export const TILE_INSET_PX = 0.75

/** The least a tile's corner is rounded, in grid px, a square Technique's included. */
const TILE_LEAST_CORNER_PX = 1.5

const tileColors = new Map<string, string>()

/** The tile on a Background: the color moved TILE_STEP_L toward ink with its hue kept, lighter on a dark Background
 * and darker on a light one, by the rule that picks the look a Custom color is drawn in (canvasBackgrounds.ts).
 * @internal Tests and the visual check name the tile a Background gives. */
export function tileColorOf(background: string): string {
  let tile = tileColors.get(background)
  if (tile === undefined) {
    const channels = channelsOf(background)
    const lab = toCielab(channels)
    const toward = relativeLuminance(channels) < BLACK_WHITE_BALANCE ? 1 : -1
    tile = toHex(fromCielab({ ...lab, l: lab.l + toward * TILE_STEP_L }))
    tileColors.set(background, tile)
  }
  return tile
}

/** How a layer's empty positions are marked: tonal tiles in `color`, or the Position mark outline. */
export interface MarkLook {
  color: string
  tiles: boolean
}

/** The marks a theme draws its empty positions in: tiles from its own Background where it draws them and `shown`
 * allows (the editor's Canvas in the full look, with no reference image a filled tile would hide), else the outline in
 * `positionMark`, as high contrast, the draft look and every export keep. */
export function markLookOf(theme: ProjectTheme, shown = true): MarkLook {
  const tiles = theme.tonalTiles && shown
  return { color: tiles ? tileColorOf(theme.canvas) : theme.positionMark, tiles }
}

/** The marks a page laid under or beside the drawing repeats (the empty Canvas under it, the Homepage's ground): the
 * ones the renderer draws at `deviceScale`, the outline in the draft look and over a reference image. */
export function markLookAt(theme: ProjectTheme, deviceScale: number, overPicture = false): MarkLook {
  return markLookOf(theme, !drawsDraft(deviceScale) && !overPicture)
}

/** One position's cell and the corner its Technique rounds a bead by, in grid px. */
export interface TileCell {
  x: number
  y: number
  width: number
  height: number
  cornerRadius: number
}

/** Adds the tile of a cell to the current path: the cell TILE_INSET_PX in on every side, its corner the bead's and
 * never under TILE_LEAST_CORNER_PX. */
function addTilePath(context: DrawingContext, { x, y, width, height, cornerRadius }: TileCell): void {
  const [left, top] = [x + TILE_INSET_PX, y + TILE_INSET_PX]
  const [right, bottom] = [x + width - TILE_INSET_PX, y + height - TILE_INSET_PX]
  const radius = Math.min(Math.max(TILE_LEAST_CORNER_PX, cornerRadius), (right - left) / 2, (bottom - top) / 2)
  context.moveTo(left + radius, top)
  context.arcTo(right, top, right, bottom, radius)
  context.arcTo(right, bottom, left, bottom, radius)
  context.arcTo(left, bottom, left, top, radius)
  context.arcTo(left, top, right, top, radius)
  context.closePath()
}

/** Fills the tiles of many cells in one path, in `color`: the few a Position marks tile repeats. */
export function fillTiles(context: DrawingContext, cells: readonly TileCell[], color: string): void {
  if (!cells.length) return
  context.beginPath()
  for (const cell of cells) addTilePath(context, cell)
  context.fillStyle = color
  context.fill()
}

/** One empty position of the Frame as its tile, blitted from a bitmap made once at its size on the screen: a Frame
 * can hold tens of thousands, too many to fill as paths (as beads are, beadLook.ts). */
export function drawTile(context: DrawingContext, cell: TileCell, color: string, deviceScale: number): void {
  const { x, y, width, height, cornerRadius } = cell
  const [across, down] = [Math.max(1, Math.round(width * deviceScale)), Math.max(1, Math.round(height * deviceScale))]
  const key = `tile|${across}|${down}|${width}x${height}|${cornerRadius}|${color}`
  const sprite = cachedSprite(key, across, width, (own) => fillTiles(own, [{ ...cell, x: 0, y: 0 }], color), down)
  if (sprite) context.drawImage(sprite, x, y, width, height)
  else fillTiles(context, [cell], color)
}
