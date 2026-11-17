import type { Weave } from '../domain/weave'
import { cellSizePx } from './cellSize'
import { LIFT_REACH_PX } from './liftedPiece'
import { gridBox } from './surfaceView'

type Across = { left: number; right: number }

/** A strip of columns drawn again (ticket 1038), where the rows run down the grid, in grid px: `cut` is cleared and
 * drawn again, the columns' beads wherever their row shifts them and, with a Lifted piece, its contour and shadow;
 * `drawn` is where beads are drawn into it from, as far again past it, as theirs reach into it. */
export function columnStrip(weave: Weave, columns: { first: number; last: number }, lifts: boolean): { cut: Across; drawn: Across } {
  const cell = cellSizePx(weave.technique, weave.cell)
  // Two rows hold a shifted row's beads and an unshifted one's (brick stitch).
  const box = gridBox(weave, { row: 0, column: columns.first, rows: 2, columns: columns.last - columns.first + 1 })
  const reach = lifts ? LIFT_REACH_PX : 0
  const cut = { left: box.x - reach, right: box.x + box.width + reach }
  return { cut, drawn: { left: cut.left - reach - cell.width, right: cut.right + reach + cell.width } }
}
