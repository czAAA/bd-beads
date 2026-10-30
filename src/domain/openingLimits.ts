import type { BeadMap } from './canvas'

// How big a Project or a layer may be before the editor stops treating it as ordinary (ticket 0716): a whole-map walk
// (the Piece count, the named-Piece index) or decoding the whole Project on open would freeze the page.

/** The size gate: a Project with more beads than this across its layers never opens on its own at load, and is kept in
 * its stored form until it is picked; measured so an open stays under one second at 4× slowdown (ticket 0716). */
export const SIZE_GATE_BEADS = 2_000_000

/** Past this many beads a layer's Pieces are not walked on open or in a press, only in idle time. The same number as
 * the Fill cap of ticket 0715 (250,000 positions per press); whichever lands second may point one at the other. */
export const PIECE_WALK_LIMIT = 250_000

/** Whether a Project of this many beads is over the size gate. */
export function overSizeGate(beads: number): boolean {
  return beads > SIZE_GATE_BEADS
}

/** What is known of how many beads a set holds: all of them counted, or at least this many (the count stopped there). */
interface Count {
  beads: number
  exact: boolean
}

const counts = new WeakMap<BeadMap, Count>()
/** The last set counted: an edit's next set shares every row it did not touch, so its count is carried from this
 * one by the changed rows alone (as `beadBounds` grows its box, ADR 0080). */
let lastCounted: { beads: BeadMap; count: Count } | undefined

/** Past this many changed rows a set is counted afresh rather than carried from the last. */
const MOST_ROWS_TO_CARRY = 64

function counted(beads: BeadMap, limit: number): Count {
  const known = counts.get(beads)
  if (known && (known.exact || known.beads > limit)) return known
  const carried = lastCounted && carriedCount(lastCounted.beads, lastCounted.count, beads)
  const count = carried && (carried.exact || carried.beads > limit) ? carried : countUpTo(beads, limit)
  counts.set(beads, count)
  lastCounted = { beads, count }
  return count
}

/** The count of `now` from that of `was`, reading only the rows the two do not share. */
function carriedCount(was: BeadMap, count: Count, now: BeadMap): Count | undefined {
  if (was === now) return undefined
  const changed: string[] = []
  for (const key of new Set([...Object.keys(was), ...Object.keys(now)])) {
    if (was[Number(key)] === now[Number(key)]) continue
    changed.push(key)
    if (changed.length > MOST_ROWS_TO_CARRY) return undefined
  }
  let beads = count.beads
  for (const key of changed) {
    const [before, after] = [was[Number(key)], now[Number(key)]]
    beads += (after ? Object.keys(after).length : 0) - (before ? Object.keys(before).length : 0)
  }
  return { beads, exact: count.exact }
}

/** Counts row by row, stopping once past `limit`. */
function countUpTo(beads: BeadMap, limit: number): Count {
  let total = 0
  for (const row in beads) {
    total += Object.keys(beads[row]!).length
    if (total > limit) return { beads: total, exact: false }
  }
  return { beads: total, exact: true }
}

/** Whether a layer holds more than `limit` beads. Stops counting once past it, so a huge layer costs a few rows; the
 * answer is kept per set of beads, and an edit's set is counted from the last by the rows it changed. */
export function beadsOver(beads: BeadMap, limit: number): boolean {
  return counted(beads, limit).beads > limit
}

/** Whether a layer's beads are too many to walk whole (more than PIECE_WALK_LIMIT). */
export function tooManyToWalk(beads: BeadMap): boolean {
  return beadsOver(beads, PIECE_WALK_LIMIT)
}
