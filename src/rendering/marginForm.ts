import { MARGIN_PX } from './marginSizes'

// The margin sheet's forms (MarginSheet card, Zoom forms; ticket 0658): its controls keep their size while its band
// grows and shrinks with the beads, so the sheet changes form by the band's height in screen px.

/** The full form, as built at 100%; compact, one row of smaller tools; folded, the Move bar, Row done and a menu;
 * bare, where not even the folded row fits between its edge and the Frame's line: nothing of the sheet is drawn but the
 * Move bar (ticket 0682). */
export type MarginForm = 'full' | 'compact' | 'folded' | 'bare'

/** The form a sheet whose narrowest band is `bandPx` on screen takes. */
export function marginForm(bandPx: number): MarginForm {
  const { band } = MARGIN_PX
  if (bandPx >= band.full) return 'full'
  if (bandPx >= band.compact) return 'compact'
  return bandPx >= band.folded ? 'folded' : 'bare'
}
