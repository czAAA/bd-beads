// The margin sheet's forms (MarginSheet card, Zoom forms; ticket 0658): its controls keep their size while its band
// grows and shrinks with the beads, so the sheet changes form by the band's height in screen px. The px mirror
// `--margin-band-full`, `--margin-band-compact` and `--margin-band-folded`.

/** The full form, as built at 100%; compact, one row of smaller tools; folded, the Move bar, Row done and a menu;
 * bare, the paper alone, where not even the folded row fits between its edge and the Frame's line. */
export type MarginForm = 'full' | 'compact' | 'folded' | 'bare'

/** From this band the full form fits: its two-row title block, 10px in, clear of the Frame's line (about 85%). */
const FULL_BAND_PX = 68
/** From this band the compact row fits 8px in, clear of the Frame's line; under it the sheet folds (about 50%). */
const COMPACT_BAND_PX = 40
/** From this band the folded row, 24px, fits between the sheet's edge and the Frame's line (about 39%). */
const FOLDED_BAND_PX = 31

/** The form a sheet whose narrowest band is `bandPx` on screen takes. */
export function marginForm(bandPx: number): MarginForm {
  if (bandPx >= FULL_BAND_PX) return 'full'
  if (bandPx >= COMPACT_BAND_PX) return 'compact'
  return bandPx >= FOLDED_BAND_PX ? 'folded' : 'bare'
}
