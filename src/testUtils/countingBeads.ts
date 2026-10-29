import type { BeadMap } from '../domain/canvas'

/** What was read of a set of beads: each bead looked up or listed, and the rows they are in. */
export interface BeadReads {
  beads: number
  rows: Set<number>
}

/** `beads` behind a counter of what is read of them (ticket 0674): a test counts the work an edit does instead of
 * timing it. A row's identity can be read freely (an edit shares the rows it leaves alone); looking up or listing a
 * bead of a row counts that row as read. An edit made from the map keeps the counting rows it shares. */
export function countingBeads(beads: BeadMap): { beads: BeadMap; reads: BeadReads; reset: () => void } {
  const reads: BeadReads = { beads: 0, rows: new Set() }
  const counted = new Map<number, Record<number, string>>()
  const rowOf = (row: number, cells: Record<number, string>) =>
    new Proxy(cells, {
      get(target, key, receiver) {
        if (typeof key === 'string') {
          reads.beads += 1
          reads.rows.add(row)
        }
        return Reflect.get(target, key, receiver)
      },
      ownKeys(target) {
        const keys = Reflect.ownKeys(target)
        reads.beads += keys.length
        reads.rows.add(row)
        return keys
      },
    })
  const wrapped: BeadMap = {}
  for (const key of Object.keys(beads)) {
    const row = Number(key)
    counted.set(row, rowOf(row, beads[row]!))
    wrapped[row] = counted.get(row)!
  }
  return {
    beads: wrapped,
    reads,
    reset: () => {
      reads.beads = 0
      reads.rows.clear()
    },
  }
}
