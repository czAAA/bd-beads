import { MARGIN_PX } from './marginSizes'
import type { SurfaceView } from './surfaceView'

// The margin sheet's scale and forms (MarginSheet card, Zoom forms; tickets 0658, 0698): the sheet is drawn at the
// drafting sheet's proportion to its band, held between a smallest and a largest scale, and only under the smallest,
// where its controls shrink no further, does it change form by how much of a form its band still holds.

/** The full form, as built at 100%; compact, one row of smaller tools; folded, the Move bar, Row done and a menu;
 * bare, where not even the folded row fits between its edge and the Frame's line: nothing of the sheet is drawn but the
 * Move bar (ticket 0682). */
export type MarginForm = 'full' | 'compact' | 'folded' | 'bare'

/** What every px of the sheet (its controls, insets, corners and ruler numbers) is drawn at, for a band of `bandPx` on
 * screen: 1 where the band is the drafting sheet's 72px (ticket 0698). */
export function marginScale(bandPx: number): number {
  const { band, min, max } = MARGIN_PX.scale
  return Math.min(max, Math.max(min, bandPx / band))
}

/** The form a sheet whose narrowest band is `bandPx` on screen takes: the band's height at scale 1. */
export function marginForm(bandPx: number): MarginForm {
  const { band } = MARGIN_PX
  const designPx = bandPx / marginScale(bandPx)
  if (designPx >= band.full) return 'full'
  if (designPx >= band.compact) return 'compact'
  return designPx >= band.folded ? 'folded' : 'bare'
}

/** A corner of the margin sheet on screen. */
export interface TitleCorner {
  top: boolean
  left: boolean
}

/** The margin sheet's corner on screen that holds its title block (ticket 0728): the Frame's own bottom-right as it lies
 * on the upright Canvas, wherever the Canvas's quarter turn brings it. Read from the drawn view's turn of the grid. */
export function titleBlockCorner(surface: Pick<SurfaceView, 'gridDirection'>): TitleCorner {
  const toward = surface.gridDirection(1, 1)
  return { top: toward.y < 0, left: toward.x < 0 }
}
