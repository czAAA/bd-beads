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
import { wordChartOf, type WordChart } from '../domain/wordChart'

/** One color of Beads needed on paper: its swatch, name, beads and grams. */
interface PrintedColor {
  hex: string
  name: string
  beads: string
  grams?: string
  /** The color's Swatch letter, only when Letters is on (ticket 0573): printed on its swatch. */
  letter?: string
}

/** One line of the Word chart: its words (`Row 3`, `Rows 1&2`), the end it starts from, its runs (`2C, 1A, 3*`) and how many. */
export interface PrintedWordRow {
  label: string
  marker?: 'L' | 'R'
  runs: string
  runCount: number
}

/** The Word chart as words (ticket 0574), only when Letters is on and the Technique has one. */
interface PrintedWordChart {
  title: string
  /** "1–24". */
  range: string
  /** The lines on reading the rows: which row is first, even or odd count, (L) and (R), a run, `*`. */
  notes: string[]
  rows: PrintedWordRow[]
}

// Everything the PDF and PNG print, worked out as words before drawing (tickets 162, 164); maker's name omitted when
// empty.
export interface PrintText {
  locale: Locale
  name: string
  techniqueWord: string
  maker: string
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
  wordChart?: PrintedWordChart
  labels: Translations['print']
}

/** The maker's name in a header: cut with an ellipsis past 32 characters (printed-output.md, The maker's name). */
export function headerMaker(maker: string): string {
  return maker.length > 32 ? `${maker.slice(0, 31).trimEnd()}…` : maker
}

const FIRST_ROW_KEY = { top: 'firstTop', right: 'firstRight', bottom: 'firstBottom', left: 'firstLeft' } as const

/** The Word chart's words in the app's language; letters and numbers stay as they are. */
function wordChartText(chart: WordChart, t: Translations['print']['wordChart']): PrintedWordChart {
  const notes = [t[FIRST_ROW_KEY[chart.firstEdge]]]
  if (!chart.marked) notes.push(t.loomRead)
  if (chart.count) notes.push(chart.count === 'even' ? t.evenCount : t.oddCount)
  if (chart.marked) notes.push(t.sides)
  notes.push(t.runNote)
  if (chart.hasEmpty) notes.push(t.emptyNote)
  return {
    title: t.title,
    range: `1–${chart.lastNumber}`,
    notes,
    rows: chart.rows.map((row) => ({
      label: row.both ? t.both : t.row.replace('{n}', String(row.number)),
      ...(row.marker ? { marker: row.marker } : {}),
      runs: row.runs.map((run) => `${run.count}${run.letter ?? '*'}`).join(', '),
      runCount: row.runs.length,
    })),
  }
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

  const wordChart = wordChartOf(project)
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
      ...(project.letters && project.paletteLetters?.[quantity.hex] ? { letter: project.paletteLetters[quantity.hex] } : {}),
    })),
    totalBeads: plural(locale, total, t.print.beadsCount),
    totalGrams: grams(total),
    gramsNote:
      perGram && bead
        ? `${t.print.gramsNote.replace('{count}', groupThousands(perGram, locale)).replace('{bead}', `${t.formFactors[bead.formFactor.nameKey]} ${bead.size}`)} ${t.print.spares}`
        : undefined,
    wordChart: wordChart && wordChartText(wordChart, t.print.wordChart),
    labels: t.print,
  }
}
