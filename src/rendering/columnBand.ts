import type { Weave } from '../domain/weave'
import { cellSizePx } from './cellSize'
import { gridBox } from './surfaceView'

type Across = { left: number; right: number }

/** A strip of columns drawn again (ticket 1038), where the rows run down the grid, in grid px: `cut` is cleared and
 * drawn again, the columns' beads wherever their row shifts them; `drawn` is where beads are drawn into it from, as far again past it, as
 * theirs reach into it. */
export function columnStrip(weave: Weave, columns: { first: number; last: number }): { cut: Across; drawn: Across } {
  const cell = cellSizePx(weave.technique, weave.cell)
  // Two rows hold a shifted row's beads and an unshifted one's (brick stitch).
  const box = gridBox(weave, { row: 0, column: columns.first, rows: 2, columns: columns.last - columns.first + 1 })
  const cut = { left: box.x, right: box.x + box.width }
  return { cut, drawn: { left: cut.left - cell.width, right: cut.right + cell.width } }
}
