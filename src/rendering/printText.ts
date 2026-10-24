import { beadLabel } from '../domain/beads'
import { computeColorQuantities } from '../domain/beadQuantities'
import { projectPalette } from '../domain/palette'
import { listedColorName } from '../i18n/colorName'
import { rotationSwapsAxes } from '../domain/grid'
import { countedDimensions, frameWeave, resolveProjectBead, type Project } from '../domain/project'
import { estimatedSizeMm, formatSizeMm } from '../domain/projectSize'
import { beadsPerGram, formatPrintedGrams, printedGrams } from '../domain/printGrams'
import { groupThousands } from '../domain/formatNumber'
import { plural } from '../i18n/plural'
import { techniqueName } from '../i18n/techniqueName'
import type { Locale, Translations } from '../i18n/translations'

/** One color of Beads needed on paper: its swatch, name, beads and grams. */
interface PrintedColor {
  hex: string
  name: string
  beads: string
  grams?: string
}

// Everything the PDF and PNG print, worked out as words before drawing (tickets 162, 164); maker's name omitted when
// empty.
export interface PrintText {
  locale: Locale
  name: string
  techniqueWord: string
  maker: string
  // Background watermark text (ticket 182): the maker's name, plus this Project's own name when it overrides the
  // device-wide one.
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

/** The words an export prints; the maker's name is the Project's own, and empty prints none (ADR 0060). */
export function printText(project: Project, t: Translations, locale: Locale, at: Date): PrintText {
  const bead = resolveProjectBead(project)
  const maker = (project.makerName ?? '').trim()
  const { columns, rows } = countedDimensions(project)
  const [across, down] = rotationSwapsAxes(project.rotation) ? [rows, columns] : [columns, rows]
  const size = `${across}×${down}`
  const estimate = bead ? formatSizeMm(estimatedSizeMm(project, bead), { mm: t.form.unitMm, cm: t.form.unitCm }, locale) : undefined
  const beadName = bead ? beadLabel(bead, t.formFactors) : t.projects.unknownBeadLabel
  const technique = techniqueName(t, frameWeave(project).technique)
  const grams = (count: number) => {
    const weight = printedGrams(count, bead)
    return weight === undefined ? undefined : formatPrintedGrams(weight, locale, t.quantities.gramsUnit)
  }

  const palette = projectPalette(project)
  const quantities = computeColorQuantities(project, palette)
  const total = quantities.reduce((sum, quantity) => sum + quantity.count, 0)
  const perGram = bead && beadsPerGram(bead)
  const date = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(at)
  const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(at)

  return {
    locale,
    name: project.name,
    techniqueWord: technique,
    maker,
    background: maker ? `${project.name} · ${maker}` : '',
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
      name: listedColorName(t, palette.byId(quantity.colorId), quantity.hex),
      beads: groupThousands(quantity.count, locale),
      grams: grams(quantity.count),
    })),
    totalBeads: plural(locale, total, t.print.beadsCount),
    totalGrams: grams(total),
    gramsNote:
      perGram && bead
        ? `${t.print.gramsNote.replace('{count}', groupThousands(perGram, locale)).replace('{bead}', `${t.formFactors[bead.formFactor.nameKey]} ${bead.size}`)} ${t.print.spares}`
        : undefined,
    labels: t.print,
  }
}
