import type { Weave } from '../domain/weave'
import { cellSizePx } from './cellSize'
import { gridBox } from './surfaceView'

type Across = { left: number; right: number }

/** A strip of columns drawn again (ticket 1038), where the rows run down the grid, in grid px: `cut` is cleared and drawn
 * again, the columns' beads wherever their row shifts them and `reach` more each side for a lifted Frame's outline and
 * shadow (ticket 1177); `drawn` is where beads are drawn into it from, as far again past it. */
export function columnStrip(weave: Weave, columns: { first: number; last: number }, reach = 0): { cut: Across; drawn: Across } {
  const cell = cellSizePx(weave.technique, weave.cell)
  // Two rows hold a shifted row's beads and an unshifted one's (brick stitch).
  const box = gridBox(weave, { row: 0, column: columns.first, rows: 2, columns: columns.last - columns.first + 1 })
  const cut = { left: box.x - reach, right: box.x + box.width + reach }
  return { cut, drawn: { left: cut.left - reach - cell.width, right: cut.right + reach + cell.width } }
}
