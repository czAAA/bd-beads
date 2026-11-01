import { channelsOf, colorDistance, toOklab } from './color'
import type { ReducedColors } from './imageColors'
import { describeWeave, type Weave } from './weave'

// Clean up stray beads (ticket 0766, spec 0761): single odd beads merged into the color round them, so a converted
// photo is pleasant to weave. It works on the reduced grid, before the match, so the found colors and counts follow.

/** The slider's steps after Off: each allows one more pass. */
export const MAX_CLEAN_UP = 3

/** The Frame's sampled colors, row by row: a picture hex, or undefined for no bead (imageConversion's frameColors). */
type RawGrid = readonly (readonly (string | undefined)[])[]

/** The color most of a bead's colored neighbours have, and one of their picture hexes; a tie goes to the color nearest
 * the bead's own, so a stray takes the look closest to it. */
function majority(neighbours: readonly { kept: string; raw: string }[], own: string): string {
  const tally = new Map<string, { count: number; raw: string }>()
  for (const { kept, raw } of neighbours) {
    const known = tally.get(kept)
    if (known) known.count += 1
    else tally.set(kept, { count: 1, raw })
  }
  const target = toOklab(channelsOf(own))
  let best: { count: number; raw: string; distance: number } | undefined
  for (const [kept, entry] of tally) {
    const distance = colorDistance(target, toOklab(channelsOf(kept)))
    if (!best || entry.count > best.count || (entry.count === best.count && distance < best.distance)) best = { ...entry, distance }
  }
  return best!.raw
}

/** One pass over the grid: a bead whose reduced color none of its Technique neighbours share takes the color most of
 * them have. Empty beads stay empty and count for nothing; a bead with no colored neighbour stays as it is. */
function cleanUpPass(raw: RawGrid, keptOf: (hex: string) => string, weave: Weave): { raw: (string | undefined)[][]; changed: boolean } {
  const geometry = describeWeave(weave)
  const bounds = { row: 0, column: 0, rows: raw.length, columns: raw[0]?.length ?? 0 }
  let changed = false
  const next = raw.map((cells, row) =>
    cells.map((hex, column) => {
      if (hex === undefined) return hex
      const own = keptOf(hex)
      const neighbours: { kept: string; raw: string }[] = []
      for (const at of geometry.neighbors(bounds, { row, column })) {
        const other = raw[at.row]?.[at.column]
        if (other === undefined) continue
        const kept = keptOf(other)
        if (kept === own) return hex
        neighbours.push({ kept, raw: other })
      }
      if (neighbours.length === 0) return hex
      changed = true
      return majority(neighbours, own)
    }),
  )
  return { raw: next, changed }
}

/** Clean up stray beads over the Frame's sampled colors (spec 0761): up to `passes` passes compared by reduced color,
 * a merged bead taking a neighbour's picture hex so the reduction still reads it; the reduction's counts follow. With
 * no passes, or none changing anything, the input comes back as it was. */
export function cleanUpStrayBeads(raw: RawGrid, reduced: ReducedColors, weave: Weave, passes: number): { raw: RawGrid; reduced: ReducedColors } {
  const keptOf = (hex: string) => reduced.byHex.get(hex) ?? hex
  let cleaned = raw
  let changedAny = false
  for (let pass = 0; pass < passes; pass += 1) {
    const step = cleanUpPass(cleaned, keptOf, weave)
    if (!step.changed) break
    cleaned = step.raw
    changedAny = true
  }
  if (!changedAny) return { raw, reduced }
  const counts = new Map<string, number>()
  for (const cells of cleaned) {
    for (const hex of cells) if (hex !== undefined) counts.set(keptOf(hex), (counts.get(keptOf(hex)) ?? 0) + 1)
  }
  const colors = [...counts]
    .map(([hex, count]) => ({ hex, count }))
    .sort((a, b) => (b.count === a.count ? a.hex.localeCompare(b.hex) : b.count - a.count))
  return { raw: cleaned, reduced: { colors, byHex: reduced.byHex } }
}
