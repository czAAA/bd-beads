import { channelsOf, colorDistance, toOklab } from './color'
import type { ReducedColors } from './imageColors'
import { describeWeave, type Weave } from './weave'

// Clean up stray beads (ticket 0906, spec 0761, decision D-2; first built by ticket 0766 and rolled back): a bead no
// Technique neighbour shares a color with takes the color most of them have, so a converted photo has no bead that is
// a thread change by itself. It runs on the Frame's sampled grid, so the found colors and counts follow.

/** Clean up's three steps (ConvertImage card DS-3): one, two and three passes of the rule. */
export type CleanUpStrength = 'light' | 'medium' | 'strong'

export const CLEAN_UP_STRENGTHS: readonly CleanUpStrength[] = ['light', 'medium', 'strong']

/** The step a picture opens on. */
export const DEFAULT_CLEAN_UP_STRENGTH: CleanUpStrength = 'medium'

/** How many passes a step allows. */
export function passesOf(strength: CleanUpStrength): number {
  return CLEAN_UP_STRENGTHS.indexOf(strength) + 1
}

/** The Frame's sampled colors, row by row: a picture hex, or undefined for no bead (imageConversion's frameColors). */
type RawGrid = readonly (readonly (string | undefined)[])[]

/** What a picture hex becomes for the rule: the color a bead of it shows, or undefined for a color made empty, which
 * neither changes nor votes. */
type ColorOf = (hex: string) => string | undefined

/** The grid as color ids (-1 for no bead or a color made empty) with every bead's Technique neighbours, worked out once
 * for all the passes. */
function prepare(raw: RawGrid, colorOf: ColorOf, weave: Weave) {
  const rows = raw.length
  const columns = raw[0]?.length ?? 0
  const keys: string[] = []
  const idOf = new Map<string, number>()
  const ids = new Int32Array(rows * columns).fill(-1)
  const geometry = describeWeave(weave)
  const bounds = { row: 0, column: 0, rows, columns }
  const starts = new Int32Array(rows * columns + 1)
  const around: number[] = []
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const at = row * columns + column
      const hex = raw[row]![column]
      const key = hex === undefined ? undefined : colorOf(hex)
      if (key !== undefined) {
        let id = idOf.get(key)
        if (id === undefined) {
          id = keys.length
          keys.push(key)
          idOf.set(key, id)
        }
        ids[at] = id
      }
      starts[at] = around.length
      for (const next of geometry.neighbors(bounds, { row, column })) around.push(next.row * columns + next.column)
    }
  }
  starts[rows * columns] = around.length
  return { columns, keys, ids, starts, around: Int32Array.from(around) }
}

/** Whether a bead stands alone: it has a color, a colored neighbour, and none of its own color. */
function alone(ids: Int32Array, starts: Int32Array, around: Int32Array, at: number): boolean {
  const own = ids[at]!
  if (own < 0) return false
  let colored = false
  for (let index = starts[at]!; index < starts[at + 1]!; index += 1) {
    const other = ids[around[index]!]!
    if (other === own) return false
    if (other >= 0) colored = true
  }
  return colored
}

/** How many beads stand alone: those a cleanup would change, or the speckles it leaves while off ("118 stray beads
 * left") and keeps for flat art ("28 single beads kept"). */
export function loneBeadCount(raw: RawGrid, colorOf: ColorOf, weave: Weave): number {
  const { ids, starts, around } = prepare(raw, colorOf, weave)
  let lone = 0
  for (let at = 0; at < ids.length; at += 1) if (alone(ids, starts, around, at)) lone += 1
  return lone
}

/** What a cleanup did: the grid it leaves, which beads of the Frame now show another color (1 marks one, row by row,
 * for the preview's rings), and how many. */
export interface CleanedBeads {
  raw: RawGrid
  changed: Uint8Array
  cleaned: number
}

/** Clean up stray beads (spec 0761): up to `passes` passes, each giving a lone bead the color most of its colored
 * neighbours have, a tie to the color nearest its own (`hexOf`), and a neighbour's picture hex so the reduction reads it.
 * Empty places stay empty and do not vote; a bead with no colored neighbour stays as it is. */
export function cleanUpStrayBeads(raw: RawGrid, colorOf: ColorOf, weave: Weave, passes: number, hexOf: (color: string) => string = (color) => color): CleanedBeads {
  const { columns, keys, ids: start, starts, around } = prepare(raw, colorOf, weave)
  const labs = keys.map((key) => toOklab(channelsOf(hexOf(key))))
  let ids = start
  // Where each bead's picture hex now comes from: its own place, or the neighbour whose color it took.
  let source = Int32Array.from({ length: ids.length }, (_, at) => at)
  const tally = new Map<number, { count: number; from: number }>()
  for (let pass = 0; pass < passes; pass += 1) {
    const next = ids.slice()
    const nextSource = source.slice()
    let changedAny = false
    for (let at = 0; at < ids.length; at += 1) {
      if (!alone(ids, starts, around, at)) continue
      tally.clear()
      for (let index = starts[at]!; index < starts[at + 1]!; index += 1) {
        const neighbour = around[index]!
        const other = ids[neighbour]!
        if (other < 0) continue
        const known = tally.get(other)
        if (known) known.count += 1
        else tally.set(other, { count: 1, from: neighbour })
      }
      const own = labs[ids[at]!]!
      let best: { id: number; count: number; from: number; distance: number } | undefined
      for (const [id, { count, from }] of tally) {
        const distance = colorDistance(own, labs[id]!)
        if (!best || count > best.count || (count === best.count && distance < best.distance)) best = { id, count, from, distance }
      }
      next[at] = best!.id
      nextSource[at] = source[best!.from]!
      changedAny = true
    }
    ids = next
    source = nextSource
    if (!changedAny) break
  }
  const changed = new Uint8Array(ids.length)
  let cleaned = 0
  for (let at = 0; at < ids.length; at += 1) {
    if (ids[at] === start[at]) continue
    changed[at] = 1
    cleaned += 1
  }
  if (cleaned === 0) return { raw, changed, cleaned }
  const cleanedRaw = raw.map((cells, row) => cells.map((hex, column) => (changed[row * columns + column] ? raw[Math.floor(source[row * columns + column]! / columns)]![source[row * columns + column]! % columns] : hex)))
  return { raw: cleanedRaw, changed, cleaned }
}

/** The reduction's colors counted again over a cleaned grid, most beads first, so the found colors and their counts
 * follow the cleanup; the reduction's own map is kept. */
export function recountReduced(raw: RawGrid, reduced: ReducedColors): ReducedColors {
  const counts = new Map<string, number>()
  for (const cells of raw) {
    for (const hex of cells) {
      if (hex === undefined) continue
      const kept = reduced.byHex.get(hex) ?? hex
      counts.set(kept, (counts.get(kept) ?? 0) + 1)
    }
  }
  const colors = [...counts]
    .map(([hex, count]) => ({ hex, count }))
    .sort((a, b) => (b.count === a.count ? a.hex.localeCompare(b.hex) : b.count - a.count))
  return { ...reduced, colors }
}
