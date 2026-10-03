import { beadLabel } from '../domain/beads'
import { computeColorQuantities } from '../domain/beadQuantities'
import { rotationSwapsAxes } from '../domain/grid'
import { resolvePatternBead, type Pattern, patternDimensions } from '../domain/pattern'
import { estimatedSizeMm, formatSizeMm } from '../domain/patternSize'
import { beadsPerGram, formatPrintedGrams, printedGrams } from '../domain/printGrams'
import { groupThousands } from '../domain/formatNumber'
import { plural } from '../i18n/plural'
import type { Locale, Translations } from '../i18n/translations'

/** One color of Beads needed on paper: its swatch, name, beads and grams. */
export interface PrintedColor {
  hex: string
  name: string
  beads: string
  grams?: string
}

/**
 * Everything the PDF and PNG print, worked out in words before anything is drawn (tickets 162, 164): the drawing only
 * places these strings. In the app's language; the maker's name is left out when empty (printed-output.md).
 */
export interface PrintText {
  locale: Locale
  name: string
  techniqueWord: string
  maker: string
  /**
   * What the background watermark reads (ticket 182): the maker's name alone, same as `maker` — unless this Pattern
   * overrides the device-wide maker's name, in which case its own name joins it, since a name set just for this
   * Pattern is worth telling apart from the rest of the maker's exports.
   */
  background: string
  /** "Sep 26, 2026 · 14:32" */
  exportedAt: string
  metaLine: string
  bead: string
  size: string
  estimatedSize: string
  colors: PrintedColor[]
  /** "4 800 beads" and "≈ 24 g": the Total both ways. */
  totalBeads: string
  totalGrams?: string
  gramsNote?: string
  labels: Translations['print']
}

/** The maker's name in a header: cut with an ellipsis past 32 characters (printed-output.md, The maker's name). */
export function headerMaker(maker: string): string {
  return maker.length > 32 ? `${maker.slice(0, 31).trimEnd()}…` : maker
}

/**
 * `deviceMaker` is the name kept on this device (domain/makerName.ts); a Pattern with its own maker's name (ticket
 * 182) overrides it here, so every caller downstream reads one already-resolved `maker` and need not know which one
 * applied.
 */
export function printText(pattern: Pattern, t: Translations, locale: Locale, deviceMaker: string, at: Date): PrintText {
  const bead = resolvePatternBead(pattern)
  const maker = (pattern.makerName || deviceMaker).trim()
  const { columns, rows } = patternDimensions(pattern)
  const [across, down] = rotationSwapsAxes(pattern.rotation) ? [rows, columns] : [columns, rows]
  const size = `${across}×${down}`
  const estimate = bead ? formatSizeMm(estimatedSizeMm(pattern, bead), { mm: t.form.unitMm, cm: t.form.unitCm }, locale) : undefined
  const beadName = bead ? beadLabel(bead) : t.patterns.unknownBeadLabel
  const technique = { loom: t.form.techniqueLoom, peyote: t.form.techniquePeyote, brick: t.form.techniqueBrick }[pattern.technique]
  const grams = (count: number) => {
    const weight = printedGrams(count, bead)
    return weight === undefined ? undefined : formatPrintedGrams(weight, locale, t.quantities.gramsUnit)
  }

  const quantities = computeColorQuantities(pattern)
  const total = quantities.reduce((sum, quantity) => sum + quantity.count, 0)
  const perGram = bead && beadsPerGram(bead)
  const date = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(at)
  const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(at)

  return {
    locale,
    name: pattern.name,
    techniqueWord: technique,
    maker,
    background: pattern.makerName ? `${pattern.name} · ${maker}` : maker,
    exportedAt: `${date} · ${time}`,
    metaLine: t.print.metaLine
      .replace('{size}', size)
      .replace('{bead}', beadName)
      .replace(' · ≈ {estimate}', estimate ? ` · ≈ ${estimate}` : ''),
    bead: beadName,
    size,
    estimatedSize: estimate ? `≈ ${estimate}` : '',
    colors: quantities.map((quantity) => ({
      hex: quantity.hex,
      name: (quantity.colorId && t.colorNames[quantity.colorId]) || quantity.hex.toUpperCase(),
      beads: groupThousands(quantity.count),
      grams: grams(quantity.count),
    })),
    totalBeads: plural(locale, total, t.print.beadsCount),
    totalGrams: grams(total),
    gramsNote:
      perGram && bead
        ? `${t.print.gramsNote.replace('{count}', groupThousands(perGram)).replace('{bead}', `${bead.name} ${bead.size}`)} ${t.print.spares}`
        : undefined,
    labels: t.print,
  }
}
