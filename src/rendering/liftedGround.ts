import type { BeadMap } from '../domain/canvas'

// A layer's lifted ground (Lifted piece): every empty position in no 2 × 2 block of positions that hold no bead, a gap
// less than two beads wide, closed in or not (1050, 1035). No rim: an empty position beside the beads lies flat (1062).
// Found when the beads change, round what changed, never on a redraw: a fact about the layer, not the view.

/** What a layer is, for its ground: its beads and which positions are its own. */
export interface GroundLayer {
  beads: BeadMap
  /** Whether a position is the layer's own: one off it (past a Frame's edge, in the Canvas's keep-out margin) lies
   * outside every Piece, and counts as open space round a gap. */
  has: (row: number, column: number) => boolean
  /** What `has` is worked out from, as text: the positions found are kept only while it stays the same. */
  edge: string
}

/** The empty positions of a layer that are part of the lifted Piece: a row's columns, ascending. */
export interface LiftedPositions {
  rows: ReadonlyMap<number, readonly number[]>
  has(row: number, column: number): boolean
  /** The rows whose lifted positions changed since this was last asked, and forgets them: a redraw of a band of rows
   * draws those too. */
  takeChanged(): { first: number; last: number } | undefined
}

/** More changed positions than this between two bead maps and the ground is found again from scratch. */
const MOST_CHANGES = 4000

/** A position as one number: rows and columns of an open Canvas run either side of 0. */
const SPAN = 2 ** 22
const MID = 2 ** 21
const keyOf = (row: number, column: number): number => (row + MID) * SPAN + column + MID
const rowOf = (key: number): number => Math.floor(key / SPAN) - MID
const columnOf = (key: number): number => (key % SPAN) - MID

/** One layer's lifted ground, kept from one bead map to the next and worked out again only round what changed.
 * @internal Tests make their own to count the work an edit does. */
export class LiftedGround {
  /** Positions looked at so far: a stroke looks only round what it changed. */
  work = 0
  private beads: BeadMap | undefined
  private edge = ''
  private layer!: GroundLayer
  private lifted = new Map<number, Set<number>>()
  private sorted = new Map<number, readonly number[]>()
  private changed: { first: number; last: number } | undefined
  private readonly result: LiftedPositions = {
    rows: this.sorted,
    has: (row, column) => this.lifted.get(row)?.has(column) ?? false,
    takeChanged: () => {
      const { changed } = this
      this.changed = undefined
      return changed
    },
  }

  /** The lifted positions of `layer`, from the last bead map's by what changed since, or found afresh. */
  update(layer: GroundLayer): LiftedPositions {
    if (layer.beads === this.beads && layer.edge === this.edge) return this.result
    const changes = layer.edge === this.edge && this.beads ? changesBetween(this.beads, layer.beads) : undefined
    this.layer = layer
    if (changes) this.relift(changes)
    else this.findAll()
    this.beads = layer.beads
    this.edge = layer.edge
    return this.result
  }

  /** Every lifted position found from scratch, by looking a position round each bead; one closed in by beads all round
   * has nothing to lift near it and is passed over. */
  private findAll(): void {
    const { beads } = this.layer
    for (const row of this.sorted.keys()) this.changedRow(row)
    this.lifted.clear()
    this.sorted.clear()
    const look = new Set<number>()
    for (const key in beads) {
      const row = Number(key)
      for (const stored in beads[row]) {
        const column = Number(stored)
        if (this.closedIn(row, column)) continue
        look.add(keyOf(row, column))
      }
    }
    this.relift(look)
  }

  /** Whether every position round a bead's, corners too, holds a bead. */
  private closedIn(row: number, column: number): boolean {
    for (let r = row - 1; r <= row + 1; r += 1) for (let c = column - 1; c <= column + 1; c += 1) if (!this.isBead(r, c)) return false
    return true
  }

  private changedRow(row: number): void {
    this.changed = this.changed ? { first: Math.min(this.changed.first, row), last: Math.max(this.changed.last, row) } : { first: row, last: row }
  }

  /** Whether a position holds a bead of the layer. */
  private isBead(row: number, column: number): boolean {
    return this.layer.has(row, column) && this.layer.beads[row]?.[column] !== undefined
  }

  /** Whether an empty position of the layer is part of the lifted Piece: in no block of 2 × 2 positions that hold no
   * bead, so in a gap less than two beads wide. */
  private isLifted(row: number, column: number): boolean {
    if (!this.layer.has(row, column) || this.isBead(row, column)) return false
    for (let top = row - 1; top <= row; top += 1) {
      for (let left = column - 1; left <= column; left += 1) if (this.blockOpen(top, left)) return false
    }
    return true
  }

  /** Whether no position of the block of 2 × 2 from `top`, `left` holds a bead: one off the layer is open too. */
  private blockOpen(top: number, left: number): boolean {
    for (let r = top; r <= top + 1; r += 1) for (let c = left; c <= left + 1; c += 1) if (this.isBead(r, c)) return false
    return true
  }

  /** Each position whose lifting a change can reach, a position round every one in `dirty` (a bead set or taken off
   * decides which blocks beside it are open), looked at again. */
  private relift(dirty: Iterable<number>): void {
    const rows = new Set<number>()
    const look = new Set<number>()
    for (const key of dirty) {
      const [row, column] = [rowOf(key), columnOf(key)]
      for (let r = row - 1; r <= row + 1; r += 1) for (let c = column - 1; c <= column + 1; c += 1) look.add(keyOf(r, c))
    }
    for (const key of look) {
      const [row, column] = [rowOf(key), columnOf(key)]
      this.work += 1
      const lifted = this.isLifted(row, column)
      const set = this.lifted.get(row)
      if (lifted === (set?.has(column) ?? false)) continue
      rows.add(row)
      if (lifted) {
        if (set) set.add(column)
        else this.lifted.set(row, new Set([column]))
      } else {
        set!.delete(column)
        if (!set!.size) this.lifted.delete(row)
      }
    }
    for (const row of rows) {
      this.changedRow(row)
      const set = this.lifted.get(row)
      if (set) this.sorted.set(row, [...set].sort((a, b) => a - b))
      else this.sorted.delete(row)
    }
  }
}

/** The positions whose bead came or went between two bead maps, or undefined past MOST_CHANGES: a row kept as it was is
 * passed over whole. */
function changesBetween(before: BeadMap, after: BeadMap): Set<number> | undefined {
  const changes = new Set<number>()
  for (const key in after) {
    const row = Number(key)
    const [was, now] = [before[row], after[row]!]
    if (was === now) continue
    for (const column in now) if (!was || !(column in was)) changes.add(keyOf(row, Number(column)))
    if (was) for (const column in was) if (!(column in now)) changes.add(keyOf(row, Number(column)))
    if (changes.size > MOST_CHANGES) return undefined
  }
  for (const key in before) {
    const row = Number(key)
    if (row in after) continue
    for (const column in before[row]) changes.add(keyOf(row, Number(column)))
    if (changes.size > MOST_CHANGES) return undefined
  }
  return changes
}

const layers = { canvas: new LiftedGround(), frame: new LiftedGround() }

/** The lifted positions of the Canvas's or the Frame's beads, worked out again only where they changed. */
export function liftedPositionsOf(which: keyof typeof layers, layer: GroundLayer): LiftedPositions {
  return layers[which].update(layer)
}
