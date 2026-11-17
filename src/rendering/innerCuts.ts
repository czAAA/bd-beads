import type { BeadMap } from '../domain/canvas'
import type { WeaveGeometry } from '../domain/weaveGeometry'

// A Piece's inner cuts (ticket 1035, BeadBoard card, Lifted piece): empty positions its own beads close in on every
// side, not joined to the open Canvas round the Piece. Found when the beads change, from what changed, never on a redraw;
// a cut is a fact about the layer, so the view has no say in it.

/** What a layer is, for its cuts: its beads, how its positions touch, and which positions are its own. */
export interface CutLayer {
  beads: BeadMap
  description: Pick<WeaveGeometry, 'spans' | 'shifted'>
  /** Whether a position is the layer's own: one off it (past a Frame's edge, in the Canvas's keep-out margin) lies
   * outside every Piece. */
  has: (row: number, column: number) => boolean
  /** What `has` is worked out from, as text: the cuts found are kept only while it and `description` stay the same. */
  edge: string
}

/** The positions of a layer's cuts that are part of the lifted Piece: a row's columns, ascending. */
export interface LiftedCuts {
  rows: ReadonlyMap<number, readonly number[]>
  has(row: number, column: number): boolean
  /** The rows whose lifted positions changed since this was last asked, and forgets them: an edit can open or close a
   * cut far from the rows it changed, and a redraw of a band of rows draws those too. */
  takeChanged(): { first: number; last: number } | undefined
}

/** More changed positions than this between two bead maps and the cuts are found again from scratch. */
const MOST_CHANGES = 4000

/** A position as one number: rows and columns of an open Canvas run either side of 0. */
const SPAN = 2 ** 22
const MID = 2 ** 21
const keyOf = (row: number, column: number): number => (row + MID) * SPAN + column + MID
const rowOf = (key: number): number => Math.floor(key / SPAN) - MID
const columnOf = (key: number): number => (key % SPAN) - MID

/** A stored row's first and last column, kept by the row itself: a stroke step changes few rows. */
const extents = new WeakMap<Record<number, string>, readonly [number, number]>()

function extentOf(stored: Record<number, string> | undefined): readonly [number, number] | undefined {
  if (!stored) return undefined
  let extent = extents.get(stored)
  if (!extent) {
    let [first, last] = [Infinity, -Infinity]
    for (const key in stored) {
      const column = Number(key)
      if (column < first) first = column
      if (column > last) last = column
    }
    extent = [first, last]
    extents.set(stored, extent)
  }
  return extent
}

type Visit = (row: number, column: number) => void

/** The positions whose beads touch a position's, corners too: a cut is closed only where no gap leads out of it, so on
 * an upright grid a corner-to-corner gap between two beads joins it to what lies past them. */
function touching({ spans: { along, reach }, shifted }: CutLayer['description']): (row: number, column: number, visit: Visit) => void {
  const widen = shifted ? 0 : 1
  if (along === 'row') {
    return (row, column, visit) => {
      visit(row, column - 1)
      visit(row, column + 1)
      for (const to of [row - 1, row + 1]) {
        const [first, last] = reach(row, to)
        for (let at = column + first - widen; at <= column + last + widen; at += 1) visit(to, at)
      }
    }
  }
  return (row, column, visit) => {
    visit(row - 1, column)
    visit(row + 1, column)
    for (const to of [column - 1, column + 1]) {
      const [first, last] = reach(column, to)
      for (let at = row + first - widen; at <= row + last + widen; at += 1) visit(at, to)
    }
  }
}

/** One layer's inner cuts, kept from one bead map to the next and worked out again only round what changed.
 * @internal Tests make their own to count the work an edit does. */
export class InnerCuts {
  /** Positions looked at so far: a stroke that closes or opens no cut looks only round what it changed. */
  work = 0
  private beads: BeadMap | undefined
  private description: CutLayer['description'] | undefined
  private edge = ''
  private layer!: CutLayer
  private around!: (row: number, column: number, visit: Visit) => void
  private cutOf = new Map<number, number>()
  private members = new Map<number, Set<number>>()
  private lifted = new Map<number, Set<number>>()
  private sorted = new Map<number, readonly number[]>()
  private nextId = 1
  private changed: { first: number; last: number } | undefined
  /** While an update runs: the bead map before it, and the changes applied to it so far. */
  private before: BeadMap = {}
  private applied = new Map<number, boolean>()
  private readonly result: LiftedCuts = {
    rows: this.sorted,
    has: (row, column) => this.lifted.get(row)?.has(column) ?? false,
    takeChanged: () => {
      const { changed } = this
      this.changed = undefined
      return changed
    },
  }

  /** The lifted positions of `layer`'s cuts, from the last bead map's by what changed since, or found afresh. */
  update(layer: CutLayer): LiftedCuts {
    if (layer.beads === this.beads && layer.description === this.description && layer.edge === this.edge) return this.result
    const changes = layer.description === this.description && layer.edge === this.edge && this.beads ? changesBetween(this.beads, layer.beads) : undefined
    this.layer = layer
    this.around = touching(layer.description)
    if (!changes) this.findAll()
    else {
      this.before = this.beads!
      this.applied.clear()
      const dirty = new Set<number>()
      for (const [key, bead] of changes) {
        if (!layer.has(rowOf(key), columnOf(key))) continue
        if (bead) this.filled(key, dirty)
        else this.emptied(key, dirty)
        this.applied.set(key, bead)
      }
      this.before = layer.beads
      this.applied.clear()
      this.relift(dirty)
    }
    this.beads = layer.beads
    this.description = layer.description
    this.edge = layer.edge
    return this.result
  }

  /** Whether a position holds a bead of the layer, as far as the update has gone. */
  private isBead(row: number, column: number): boolean {
    if (!this.layer.has(row, column)) return false
    const key = keyOf(row, column)
    const applied = this.applied.get(key)
    return applied ?? this.before[row]?.[column] !== undefined
  }

  /** Whether a position surely lies outside every Piece: off the layer, or with no bead past it along its row, before
   * the update or after it. */
  private outside(row: number, column: number): boolean {
    if (!this.layer.has(row, column)) return true
    const [was, now] = [extentOf(this.before[row]), extentOf(this.layer.beads[row])]
    if (!was && !now) return true
    const first = Math.min(was?.[0] ?? Infinity, now?.[0] ?? Infinity)
    const last = Math.max(was?.[1] ?? -Infinity, now?.[1] ?? -Infinity)
    return column < first || column > last
  }

  /** Every cut found from scratch: each gap within a row's beads flooded until it leads out or is closed in. */
  private findAll(): void {
    const { beads } = this.layer
    this.before = beads
    this.applied.clear()
    for (const row of this.sorted.keys()) this.changedRow(row)
    this.cutOf.clear()
    this.members.clear()
    this.lifted.clear()
    this.sorted.clear()
    const out = new Set<number>()
    for (const key in beads) {
      const row = Number(key)
      const [first, last] = extentOf(beads[row])!
      for (let column = first + 1; column < last; column += 1) {
        const at = keyOf(row, column)
        if (this.isBead(row, column) || out.has(at) || this.cutOf.has(at) || this.outside(row, column)) continue
        const seen = new Set([at])
        const queue = [at]
        let open = false
        for (let next = 0; next < queue.length && !open; next += 1) {
          const from = queue[next]!
          this.work += 1
          this.around(rowOf(from), columnOf(from), (r, c) => {
            const near = keyOf(r, c)
            if (open || seen.has(near) || this.isBead(r, c)) return
            if (out.has(near) || this.outside(r, c)) open = true
            else {
              seen.add(near)
              queue.push(near)
            }
          })
        }
        if (open) for (const each of seen) out.add(each)
        else this.makeCut(seen)
      }
    }
    this.relift(new Set(this.cutOf.keys()), 0)
  }

  private changedRow(row: number): void {
    this.changed = this.changed ? { first: Math.min(this.changed.first, row), last: Math.max(this.changed.last, row) } : { first: row, last: row }
  }

  private makeCut(keys: Iterable<number>): Set<number> {
    const id = this.nextId++
    const set = new Set(keys)
    for (const key of set) this.cutOf.set(key, id)
    this.members.set(id, set)
    return set
  }

  /** The cuts' positions given up, which now lie outside. */
  private dissolve(id: number, dirty: Set<number>): void {
    for (const key of this.members.get(id)!) {
      this.cutOf.delete(key)
      dirty.add(key)
    }
    this.members.delete(id)
  }

  /** The not-bead positions touching `key`, each with the others it touches among them, grouped: a bead set at `key`
   * can part what lies round it only where there is more than one group. Off-layer and outside positions are one group. */
  private groupsRound(key: number): number[][] {
    const [row, column] = [rowOf(key), columnOf(key)]
    const nodes: number[] = []
    this.around(row, column, (r, c) => {
      if (!this.isBead(r, c)) nodes.push(keyOf(r, c))
    })
    const parent = nodes.map((_, at) => at)
    const find = (at: number): number => (parent[at] === at ? at : (parent[at] = find(parent[at]!)))
    const index = new Map(nodes.map((node, at) => [node, at]))
    let outsider = -1
    nodes.forEach((node, at) => {
      const [r, c] = [rowOf(node), columnOf(node)]
      if (this.outside(r, c)) {
        if (outsider >= 0) parent[find(at)] = find(outsider)
        outsider = at
      }
      this.around(r, c, (nr, nc) => {
        const other = index.get(keyOf(nr, nc))
        if (other !== undefined) parent[find(other)] = find(at)
      })
    })
    const groups = new Map<number, number[]>()
    nodes.forEach((node, at) => {
      const root = find(at)
      const group = groups.get(root)
      if (group) group.push(node)
      else groups.set(root, [node])
    })
    return [...groups.values()]
  }

  /** A bead set on an empty position. */
  private filled(key: number, dirty: Set<number>): void {
    dirty.add(key)
    const id = this.cutOf.get(key)
    this.applied.set(key, true)
    const groups = this.groupsRound(key)
    if (id !== undefined) {
      this.cutOf.delete(key)
      const members = this.members.get(id)!
      members.delete(key)
      if (!members.size) this.members.delete(id)
      else if (groups.length > 1) this.split(id)
      return
    }
    if (groups.length > 1) this.enclosed(groups, dirty)
  }

  /** A cut a bead parted, as the cuts it is now: still closed in, each. */
  private split(id: number): void {
    const members = this.members.get(id)!
    this.members.delete(id)
    const left = new Set(members)
    for (const start of members) {
      if (!left.has(start)) continue
      left.delete(start)
      const part = [start]
      for (let next = 0; next < part.length; next += 1) {
        const from = part[next]!
        this.work += 1
        this.around(rowOf(from), columnOf(from), (r, c) => {
          const near = keyOf(r, c)
          if (left.delete(near)) part.push(near)
        })
      }
      this.makeCut(part)
    }
  }

  /** The groups round a bead set outside every cut, each flooded a step at a time in turn, joined where they meet, until
   * at most one is left undecided: that one leads out, as the space round the bead did. A group closed in is a new cut. */
  private enclosed(groups: number[][], dirty: Set<number>): void {
    const parent = groups.map((_, at) => at)
    const find = (at: number): number => (parent[at] === at ? at : (parent[at] = find(parent[at]!)))
    const open = groups.map((group) => group.some((node) => this.outside(rowOf(node), columnOf(node))))
    const closed = groups.map(() => false)
    const queues = groups.map((group) => [...group])
    const heads = groups.map(() => 0)
    const seen = new Map<number, number>()
    groups.forEach((group, at) => group.forEach((node) => seen.set(node, at)))
    const undecided = () => {
      const roots = new Set(groups.map((_, at) => find(at)).filter((root) => !open[root] && !closed[root]))
      return roots
    }
    const join = (a: number, b: number) => {
      const [ra, rb] = [find(a), find(b)]
      if (ra === rb) return
      parent[rb] = ra
      open[ra] = open[ra]! || open[rb]!
      queues[ra] = [...queues[ra]!.slice(heads[ra]!), ...queues[rb]!.slice(heads[rb]!)]
      heads[ra] = 0
    }
    for (let left = undecided(); left.size > (groups.some((_, at) => open[find(at)]) ? 0 : 1); left = undecided()) {
      for (const root of left) {
        if (find(root) !== root || open[root] || closed[root]) continue
        const queue = queues[root]!
        if (heads[root]! >= queue.length) {
          closed[root] = true
          continue
        }
        const from = queue[heads[root]!]!
        heads[root]! += 1
        this.work += 1
        this.around(rowOf(from), columnOf(from), (r, c) => {
          if (open[find(root)] || this.isBead(r, c)) return
          const near = keyOf(r, c)
          const owner = seen.get(near)
          if (owner !== undefined) join(root, owner)
          else if (this.outside(r, c)) open[find(root)] = true
          else {
            seen.set(near, find(root))
            queues[find(root)]!.push(near)
          }
        })
      }
    }
    const cuts = new Map<number, number[]>()
    for (const [node, at] of seen) {
      const root = find(at)
      if (!closed[root]) continue
      const cut = cuts.get(root)
      if (cut) cut.push(node)
      else cuts.set(root, [node])
    }
    for (const keys of cuts.values()) for (const key of this.makeCut(keys)) dirty.add(key)
  }

  /** A bead taken off a position: it leads out, and opens every cut round it, or joins them as one. */
  private emptied(key: number, dirty: Set<number>): void {
    dirty.add(key)
    this.applied.set(key, false)
    let open = false
    const round = new Set<number>()
    this.around(rowOf(key), columnOf(key), (r, c) => {
      if (this.isBead(r, c)) return
      const id = this.cutOf.get(keyOf(r, c))
      if (id === undefined) open = true
      else round.add(id)
    })
    if (open) {
      for (const id of round) this.dissolve(id, dirty)
      return
    }
    if (!round.size) {
      this.makeCut([key])
      return
    }
    const [into, ...others] = [...round].sort((a, b) => this.members.get(b)!.size - this.members.get(a)!.size)
    const members = this.members.get(into!)!
    for (const id of others) {
      for (const each of this.members.get(id)!) {
        this.work += 1
        members.add(each)
        this.cutOf.set(each, into!)
      }
      this.members.delete(id)
    }
    members.add(key)
    this.cutOf.set(key, into!)
  }

  /** Whether a cut's position lies a bead or more from every bead. */
  private far(row: number, column: number): boolean {
    if (!this.cutOf.has(keyOf(row, column))) return false
    let near = false
    this.around(row, column, (r, c) => {
      near ||= this.isBead(r, c)
    })
    return !near
  }

  /** Whether a cut's position is left open, under its own border: in a block of 2 × 2 positions all a bead or more from
   * every bead. Every other position of a cut is part of the lifted Piece. */
  private keptOpen(row: number, column: number): boolean {
    if (!this.far(row, column)) return false
    for (const top of [row - 1, row]) {
      for (const left of [column - 1, column]) {
        if ([[top, left], [top, left + 1], [top + 1, left], [top + 1, left + 1]].every(([r, c]) => (r === row && c === column) || this.far(r!, c!))) return true
      }
    }
    return false
  }

  /** Each position whose lifting a change can reach, `spread` positions round every one in `dirty` (two: a bead decides
   * which positions are a bead from it, and they which blocks are), looked at again. */
  private relift(dirty: Set<number>, spread = 2): void {
    const rows = new Set<number>()
    const look = new Set<number>()
    for (const key of dirty) {
      const [row, column] = [rowOf(key), columnOf(key)]
      for (let r = row - spread; r <= row + spread; r += 1) for (let c = column - spread; c <= column + spread; c += 1) look.add(keyOf(r, c))
    }
    for (const key of look) {
      const [row, column] = [rowOf(key), columnOf(key)]
      this.work += 1
      const lifted = this.cutOf.has(key) && !this.keptOpen(row, column)
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

/** The positions whose bead came or went between two bead maps (true where one came), or undefined past MOST_CHANGES:
 * a row kept as it was is passed over whole. */
function changesBetween(before: BeadMap, after: BeadMap): Map<number, boolean> | undefined {
  const changes = new Map<number, boolean>()
  for (const key in after) {
    const row = Number(key)
    const [was, now] = [before[row], after[row]!]
    if (was === now) continue
    for (const column in now) if (!was || !(column in was)) changes.set(keyOf(row, Number(column)), true)
    if (was) for (const column in was) if (!(column in now)) changes.set(keyOf(row, Number(column)), false)
    if (changes.size > MOST_CHANGES) return undefined
  }
  for (const key in before) {
    const row = Number(key)
    if (row in after) continue
    for (const column in before[row]) changes.set(keyOf(row, Number(column)), false)
    if (changes.size > MOST_CHANGES) return undefined
  }
  return changes
}

const layers = { canvas: new InnerCuts(), frame: new InnerCuts() }

/** The lifted positions of the inner cuts of the Canvas's or the Frame's beads, worked out again only where they changed. */
export function liftedCutsOf(which: keyof typeof layers, layer: CutLayer): LiftedCuts {
  return layers[which].update(layer)
}
