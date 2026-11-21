/** A cell in grid px. */
interface Cell {
  x: number
  y: number
  width: number
  height: number
}

/** Cells of one line that touch end to end as one: a row's, where rows are not staggered. */
function joinedAcross<T extends Cell>(cells: T[]): T[] {
  cells.sort((a, b) => a.y - b.y || a.x - b.x)
  const joined: T[] = []
  for (const cell of cells) {
    const last = joined.at(-1)
    if (last && last.y === cell.y && last.height === cell.height && Math.abs(last.x + last.width - cell.x) < 1e-6) last.width += cell.width
    else joined.push({ ...cell })
  }
  return joined
}

/** Cells of one line that touch end to end as one: a column's, where columns are staggered. */
function joinedDown<T extends Cell>(cells: T[]): T[] {
  cells.sort((a, b) => a.x - b.x || a.y - b.y)
  const joined: T[] = []
  for (const cell of cells) {
    const last = joined.at(-1)
    if (last && last.x === cell.x && last.width === cell.width && Math.abs(last.y + last.height - cell.y) < 1e-6) last.height += cell.height
    else joined.push({ ...cell })
  }
  return joined
}

/** Cells that touch end to end as one, a row's and then a column's: the current pass's raised beads, one shape for
 * their shadow whichever way the Row direction runs (ticket 1032). */
export function joinedTouching<T extends Cell>(cells: readonly T[]): T[] {
  return joinedDown(joinedAcross([...cells]))
}
