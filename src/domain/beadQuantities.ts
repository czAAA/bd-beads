import { gramsPerBead, type Bead } from './beads'
import { decimalSign } from './formatNumber'
import type { Locale } from './locale'
import type { Palette } from './palette'
import type { Project } from './project'
import { frameGeometryOf } from './layers'
import { beadsOfLayer, frameOf } from './layerRecord'
import { backBeadsAt } from './pieceFaces'
import { colorAt } from './canvas'

/** One line of a Project's shopping list: a painted color and how many beads of it the Project needs. */
export interface ColorQuantity {
  /** The Palette color this is, or null for a hex the Project's Palette doesn't hold (e.g. a removed swatch). */
  colorId: string | null
  hex: string
  count: number
}

// How many beads of each color the Project needs, counted off its painted cells, most-needed first. Unpainted cells and
// colors painted nowhere aren't listed. Only the Frame's beads count (ADR 0026): with no Frame there is nothing to
// count.
export function computeColorQuantities(project: Project, palette: Palette): ColorQuantity[] {
  const counts = new Map<string, number>()
  const beads = beadsOfLayer(project, 'frame')
  if (!beads) {
    return []
  }

  // Every real bead counts once: a Custom frame's are its layout's (ticket 0592), twice where its back mirrors it, but
  // its tips (a Star's, ticket 0875). In no order, as a count needs none and it is redone after every edit (0674).
  const geometry = frameGeometryOf(project)
  const back = backBeadsAt(frameOf(project)!)
  for (const rowKey of Object.keys(beads)) {
    const row = Number(rowKey)
    const cells = beads[row]!
    for (const columnKey of Object.keys(cells)) {
      const column = Number(columnKey)
      if (geometry.hasPosition({ row, column })) {
        const color = cells[column]!
        counts.set(color, (counts.get(color) ?? 0) + (back ? back({ row, column }) : 1))
      }
    }
  }

  return [...counts.entries()]
    .map(([hex, count]) => ({ colorId: palette.byHex(hex)?.id ?? null, hex, count }))
    .sort((a, b) => b.count - a.count || a.hex.localeCompare(b.hex))
}

/** Whether the Frame has a position no bead is painted in: what a chart draws under its small cross, and what its key then
 * names "empty" (ticket 0963). None without a Frame. */
export function hasEmptyPositions(project: Project): boolean {
  const beads = beadsOfLayer(project, 'frame')
  if (!beads) return false
  return frameGeometryOf(project).positions().some(({ row, column }) => colorAt(beads, row, column) === null)
}

// A quantity's Estimated weight in grams (CONTEXT.md): bead count times the Bead's average weight. Derived, never
// stored; undefined when the Bead has no weight, so a caller hides weights rather than showing zero.
export function estimatedGrams(count: number, bead: Pick<Bead, 'beadsPerKg'> | undefined): number | undefined {
  const grams = gramsPerBead(bead)
  return grams === undefined ? undefined : count * grams
}

/** Keeps a float like 0.30000000000000004 g from rounding up a whole tenth. */
const FLOAT_NOISE_TENTHS = 1e-9

/** "0.5 g" / "12,3 г": one decimal, rounded up to 0.1 g (BeadsNeeded card), so a color never reads lighter than it
 * weighs and the grams look no more exact than an average weight is. The unit and decimal sign follow the app language
 * (writing.md). */
export function formatGrams(grams: number, unit: string, locale: Locale = 'en'): string {
  const tenths = Math.ceil(grams * 10 - FLOAT_NOISE_TENTHS) / 10
  return `${tenths.toFixed(1).replace('.', decimalSign(locale))} ${unit}`
}
