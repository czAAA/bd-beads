import { BLACK_WHITE_BALANCE, channelsOf, fromCielab, mix, relativeLuminance, toCielab, toHex } from '../domain/color'
import { RIM_PX, type DrawingContext, type ProjectTheme } from './beadLook'
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

/** How far toward the tile's color the gap goes: about 3.8 L* left of the tile's 6.5, 1.11:1, so the grid is calm
 * everywhere on the Canvas. */
const GAP_TOWARD_TILE = 0.42

/** How far the edge just inside a Frame's empty tile steps from the Frame's Background toward ink, in L*: twice the
 * tile's, so the 1.5px gap between two tiles in a row shows (an empty brick row read as one bar without it). */
const TILE_EDGE_STEP_L = 2 * TILE_STEP_L

const steppedColors = new Map<string, string>()

/** A Background moved `step` L* toward ink with its hue kept, lighter on a dark Background and darker on a light one,
 * by the rule that picks the look a Custom color is drawn in (canvasBackgrounds.ts). */
function steppedToInk(background: string, step: number): string {
  const key = `${background}|${step}`
  let stepped = steppedColors.get(key)
  if (stepped === undefined) {
    const channels = channelsOf(background)
    const lab = toCielab(channels)
    const toward = relativeLuminance(channels) < BLACK_WHITE_BALANCE ? 1 : -1
    stepped = toHex(fromCielab({ ...lab, l: lab.l + toward * step }))
    steppedColors.set(key, stepped)
  }
  return stepped
}

const gapColors = new Map<string, string>()

/** The tile on a Background: the color moved TILE_STEP_L toward ink.
 * @internal Tests and the visual check name the tile a Background gives. */
export function tileColorOf(background: string): string {
  return steppedToInk(background, TILE_STEP_L)
}

/** The edge of a Frame's empty tile on the Frame's Background (ticket 1001 follow-up, BeadBoard card, Tonal tiles): the
 * Background moved TILE_EDGE_STEP_L toward ink, so every empty position of the Frame reads as a bead of its own.
 * @internal Tests name the edge a Background gives. */
export function tileEdgeColorOf(background: string): string {
  return steppedToInk(background, TILE_EDGE_STEP_L)
}

/** The gap between tiles on a Background: the Background moved GAP_TOWARD_TILE of the way to its tile (Night `#202020`
 * gives `#262626`, Studio `#fafafa` gives `#f2f2f2`). Never the tile, so the grid shows everywhere. */
export function gapColorOf(background: string): string {
  let gap = gapColors.get(background)
  if (gap === undefined) {
    gap = toHex(mix(channelsOf(background), channelsOf(tileColorOf(background)), GAP_TOWARD_TILE))
    gapColors.set(background, gap)
  }
  return gap
}

/** How a layer's empty positions are marked: tonal tiles in `color`, or the Position mark outline. */
export interface MarkLook {
  color: string
  tiles: boolean
}

/** The marks a theme draws its empty positions in: tiles from its own Background where it draws them and `shown`
 * allows (the editor's Canvas in the full look, a reference image or none: it lies over them, ticket 1008), else the outline in
 * `positionMark`, as high contrast, the draft look and every export keep. */
export function markLookOf(theme: ProjectTheme, shown = true): MarkLook {
  const tiles = theme.tonalTiles && shown
  return { color: tiles ? tileColorOf(theme.canvas) : theme.positionMark, tiles }
}

/** The marks a page laid under or beside the drawing repeats (the empty Canvas under it, the Homepage's ground): the
 * ones the renderer draws at `deviceScale`, the outline in the draft look. */
export function markLookAt(theme: ProjectTheme, deviceScale: number): MarkLook {
  return markLookOf(theme, !drawsDraft(deviceScale))
}

/** One position's cell and the corner its Technique rounds a bead by, in grid px. */
export interface TileCell {
  x: number
  y: number
  width: number
  height: number
  cornerRadius: number
}

/** Adds the tile of a cell to the current path: the cell TILE_INSET_PX in on every side (`further` more for the inside
 * of its edge), its corner the bead's and never under TILE_LEAST_CORNER_PX. */
function addTilePath(context: DrawingContext, { x, y, width, height, cornerRadius }: TileCell, further = 0): void {
  const inset = TILE_INSET_PX + further
  const [left, top] = [x + inset, y + inset]
  const [right, bottom] = [x + width - inset, y + height - inset]
  const corner = Math.max(TILE_LEAST_CORNER_PX, cornerRadius) - further
  const radius = Math.max(0, Math.min(corner, (right - left) / 2, (bottom - top) / 2))
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

/** A tile in `color` with an edge a flat bead's rim wide (RIM_PX) just inside it in `edge`. */
function fillEdgedTile(context: DrawingContext, cell: TileCell, color: string, edge: string): void {
  fillTiles(context, [cell], color)
  context.beginPath()
  addTilePath(context, cell)
  addTilePath(context, cell, RIM_PX)
  context.fillStyle = edge
  context.fill('evenodd')
}

/** One empty position of the Frame as its tile, edged in `edge` (`tileEdgeColorOf` the Frame's Background), blitted
 * from a bitmap made once at its size on the screen: a Frame can hold tens of thousands, too many to fill as paths. */
export function drawTile(context: DrawingContext, cell: TileCell, color: string, edge: string, deviceScale: number): void {
  const { x, y, width, height, cornerRadius } = cell
  const [across, down] = [Math.max(1, Math.round(width * deviceScale)), Math.max(1, Math.round(height * deviceScale))]
  const key = `tile|${across}|${down}|${width}x${height}|${cornerRadius}|${color}|${edge}`
  const sprite = cachedSprite(key, across, width, (own) => fillEdgedTile(own, { ...cell, x: 0, y: 0 }, color, edge), down)
  if (sprite) context.drawImage(sprite, x, y, width, height)
  else fillEdgedTile(context, cell, color, edge)
}
