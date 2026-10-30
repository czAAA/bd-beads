import { describeWeave } from '../domain/weave'
import { cellSizePx } from './cellSize'
import { positionMarkImage, type MarkTileInput, type QuarterTurn } from './positionMarks'
import type { Scroll, SurfaceView } from './surfaceView'

// The empty Canvas under the editor's drawing (ticket 0717): the Position marks' tile as a repeating CSS background on
// the drawing area, so whatever a moved bitmap uncovers during a pan or pinch, or before the first draw, already looks
// like empty Canvas. The drawing covers it wherever it lies (`opaque` in the Project renderer).

/** How the Canvas's Weave and Bead cell draw a Position mark. */
type MarkWeave = Pick<MarkTileInput, 'technique' | 'techniqueSettings' | 'cell'>

/** Where the Position marks' tile repeats on the drawing area: turned by the view's quarter turn, its corner `at` and
 * its `size` in the drawing area's px. */
interface EmptyCanvasPlacement {
  turn: QuarterTurn
  at: Scroll
  size: { width: number; height: number }
}

/** Where the tile of a Weave's Position marks repeats for a view, the same grid px the renderer fills them in from its
 * grid origin (ticket 0717).
 * @internal Its test checks the placement against the grid on its own. */
export function emptyCanvasPlacement(weave: MarkWeave, surface: Pick<SurfaceView, 'gridToPoint'>, zoom: number): EmptyCanvasPlacement {
  const cell = cellSizePx(weave.technique, weave.cell)
  const tile = describeWeave(weave).tile(cell.width, cell.height).size
  const origin = surface.gridToPoint(0, 0)
  const along = surface.gridToPoint(1, 0)
  const down = surface.gridToPoint(0, 1)
  const unit = (value: number) => Math.round(value / zoom)
  const turn = { a: unit(along.x - origin.x), b: unit(along.y - origin.y), c: unit(down.x - origin.x), d: unit(down.y - origin.y) }
  const corners = [surface.gridToPoint(0, 0), surface.gridToPoint(tile.width, 0), surface.gridToPoint(0, tile.height), surface.gridToPoint(tile.width, tile.height)]
  return {
    turn,
    at: { x: Math.min(...corners.map(({ x }) => x)), y: Math.min(...corners.map(({ y }) => y)) },
    size: { width: (Math.abs(turn.a) * tile.width + Math.abs(turn.c) * tile.height) * zoom, height: (Math.abs(turn.b) * tile.width + Math.abs(turn.d) * tile.height) * zoom },
  }
}

/** What the empty Canvas look is drawn from: the Canvas's Weave, its Position mark color and the view. */
export interface EmptyCanvasInput {
  weave: MarkWeave
  color: string
  surface: Pick<SurfaceView, 'gridToPoint'>
  zoom: number
  /** The zoom the tile's image is made at: the last settled one, so a pinch scales one image instead of making many. */
  tileZoom: number
  pixelRatio: number
  /** How far the pattern reaches past the drawing area's box on every side, in px, for a box moved by a twist. */
  reach: number
}

/** The empty Canvas look as the CSS variables the drawing area's pattern reads (ticket 0717), or undefined where there
 * is no canvas to make the tile on. */
export function emptyCanvasLook({ weave, color, surface, zoom, tileZoom, pixelRatio, reach }: EmptyCanvasInput): Record<string, string> | undefined {
  if (zoom <= 0 || tileZoom <= 0) return undefined
  const { turn, at, size } = emptyCanvasPlacement(weave, surface, zoom)
  const url = positionMarkImage({ ...weave, deviceScale: tileZoom * pixelRatio, pixelRatio, color }, turn)
  if (!url) return undefined
  return {
    '--empty-marks': `url(${url})`,
    '--empty-marks-size': `${size.width}px ${size.height}px`,
    '--empty-marks-at': `${at.x + reach}px ${at.y + reach}px`,
    '--empty-reach': `${reach}px`,
  }
}
