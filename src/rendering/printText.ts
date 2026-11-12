import { beadLabel, formFactorName } from '../domain/beads'
import { computeColorQuantities } from '../domain/beadQuantities'
import { projectPalette } from '../domain/palette'
import { listedColorName } from '../i18n/colorName'
import { rotationSwapsAxes } from '../domain/grid'
import { shownDimensions } from '../domain/projectExtent'
import { frameWeave } from '../domain/layerWeave'
import { resolveProjectBead } from '../domain/projectBead'
import type { Project } from '../domain/project'
import { estimatedSizeMm, formatSizeMm } from '../domain/projectSize'
import { beadsPerGram, formatPrintedGrams, printedGrams, tubesToBuy } from '../domain/printGrams'
import { groupThousands } from '../domain/formatNumber'
import { plural } from '../i18n/plural'
import { techniqueName } from '../i18n/techniqueName'
import type { Locale, Translations } from '../i18n/translations'
import { wordChartOf, type WordChart, type WordRun, type WordSide, type WordSpine } from '../domain/wordChart'
import { orderStepLabel } from '../i18n/orderStep'
import { fillBlanks } from '../domain/fillBlanks'
import { frameOf, lettersOn, quarterTurnOf, projectNameOf } from '../domain/layerRecord'
import { pieceFaceOf } from '../domain/pieceFaces'

/** One color of Beads needed on paper: its swatch, name, beads and grams. */
interface PrintedColor {
  hex: string
  name: string
  beads: string
  grams?: string
  /** The catalog code, which page 1's Beads needed prints in its own column (it is also in `name`). */
  code?: string
  /** "2 × 5 g": tubes to buy; none for an unknown Bead. */
  tubes?: string
  /** The color's Swatch letter, only when Letters is on (ticket 0573): printed on its swatch. */
  letter?: string
}

/** One line of the Word chart: its number (`3`, `1&2`) and the rows it holds, the end it starts from and its runs (`2C, 1A, 3*`). */
export interface PrintedWordRow {
  label: string
  first: number
  last: number
  marker?: 'L' | 'R'
  runs: string
}

/** The Word chart as words (ticket 0574), only when Letters is on and the Technique has one. */
interface PrintedWordChart {
  title: string
  /** The key's last item, "empty", when the Schema has empty positions. */
  empty?: string
  /** The lines on reading the rows: which row is first, even or odd count, (L) and (R), a run, `*`. */
  notes: string[]
  rows: PrintedWordRow[]
}

// Everything the PDF and PNG print, worked out as words before drawing (tickets 162, 164); maker's name omitted when
// empty.
export interface PrintText {
  locale: Locale
  /** The title: the Frame's name, else the Project's (ticket 0720). */
  name: string
  techniqueWord: string
  maker: string
  /** "Sep 26, 2026 · 14:32" */
  exportedAt: string
  metaLine: string
  colors: PrintedColor[]
  /** "22 colors" */
  colorsCount: string
  /** "4 800 beads" and "≈ 24 g": the Total both ways. */
  totalBeads: string
  totalGrams?: string
  /** The Total row's tubes: the colors' tubes added up. */
  totalTubes?: string
  gramsNote?: string
  wordChart?: PrintedWordChart
  labels: Translations['print']
}

/** The maker's name in a header: cut with an ellipsis past 32 characters (printed-output.md, The maker's name). */
export function headerMaker(maker: string): string {
  return maker.length > 32 ? `${maker.slice(0, 31).trimEnd()}…` : maker
}

const FIRST_ROW_KEY = { top: 'firstTop', right: 'firstRight', bottom: 'firstBottom', left: 'firstLeft' } as const

/** Where a Custom frame's Word chart starts, as its note (ticket 0594). */
const START_KEY = { centre: 'firstCentre', point: 'firstPoint', base: 'firstBase', parts: 'partsThenJoins' } as const

/** Runs in the 0574 notation: `2C, 1A, 3*`. */
function runsText(runs: readonly WordRun[]): string {
  return runs.map((run) => `${run.count}${run.letter ?? '*'}`).join(', ')
}

// Kept together when a row wraps at its spaces: a corner pair's two colors, and a side's mark with the side it ends.
const NO_BREAK_SPACE = '\u00a0'

/** A pair's beads in brackets, `(2A)` or `(1A 1B)` (ticket 0873); none for no pair. */
function pairText(runs: readonly WordRun[]): string {
  return runs.length > 0 ? `(${runs.map((run) => runsText([run])).join(NO_BREAK_SPACE)})` : ''
}

/** A round side by side (ticket 0873): each side its corner pair in brackets, `(2A)` or `(1A 1B)`, then its singles'
 * runs, the sides apart at a `|`. */
function sidesText(sides: readonly WordSide[]): string {
  return sides.map(({ corner, singles }) => [pairText(corner), runsText(singles)].filter(Boolean).join(', ')).join(`${NO_BREAK_SPACE}| `)
}

/** A Kite row (ticket 0874): its runs up to the middle pair, the pair in brackets as a corner pair is, then the rest:
 * `1A, (2B), 1A`. */
function spineText({ before, pair, after }: WordSpine): string {
  return [runsText(before), pairText(pair), runsText(after)].filter(Boolean).join(', ')
}

/** The Word chart's words in the app's language; letters and numbers stay as they are. A Custom frame's line names its
 * round, row, part or join before its runs (ticket 0594). */
function wordChartText(chart: WordChart, t: Translations['print']['wordChart'], steps: Translations['rowProgress']): PrintedWordChart {
  const notes = [chart.start ? t[START_KEY[chart.start]] : t[FIRST_ROW_KEY[chart.firstEdge]]]
  if (!chart.marked && !chart.start) notes.push(t.loomRead)
  if (chart.count) notes.push(chart.count === 'even' ? t.evenCount : t.oddCount)
  if (chart.marked) notes.push(t.sides)
  notes.push(t.runNote)
  if (chart.rows.some((row) => row.sides)) notes.push(t.pairNote)
  if (chart.rows.some((row) => row.spine)) notes.push(t.middlePairNote)
  return {
    title: t.title,
    ...(chart.hasEmpty ? { empty: t.empty } : {}),
    notes,
    rows: chart.rows.map((row) => ({
      label: row.both ? '1&2' : String(row.number),
      first: row.number,
      last: row.both ? 2 : row.number,
      ...(row.marker ? { marker: row.marker } : {}),
      runs: [row.step && orderStepLabel(steps, row.step), row.sides ? sidesText(row.sides) : row.spine ? spineText(row.spine) : runsText(row.runs)].filter(Boolean).join(': '),
    })),
  }
}

/** A Kaleidocycle's Word chart says, after where it starts, that it is one face of the piece (ticket 0876). */
function withFaceNote(chart: PrintedWordChart, project: Project, t: Translations['print']['wordChart']): PrintedWordChart {
  const face = pieceFaceOf(frameOf(project)?.shape)
  if (!face) return chart
  const note = fillBlanks(t.faceNote, { parts: face.parts, total: face.total })
  return { ...chart, notes: [...chart.notes.slice(0, 1), note, ...chart.notes.slice(1)] }
}

/** The words an export prints; the maker's name is the Project's own, and empty prints none (ADR 0060). */
export function printText(project: Project, t: Translations, locale: Locale, at: Date): PrintText {
  const bead = resolveProjectBead(project)
  const maker = (project.makerName ?? '').trim()
  const { columns, rows } = shownDimensions(project)
  const [across, down] = rotationSwapsAxes(quarterTurnOf(project)) ? [rows, columns] : [columns, rows]
  const size = `${across}×${down}`
  const estimate = bead ? formatSizeMm(estimatedSizeMm(project, bead), { mm: t.form.unitMm, cm: t.form.unitCm }, locale) : undefined
  const beadName = bead ? beadLabel(bead) : t.projects.unknownBeadLabel
  const technique = techniqueName(t, frameWeave(project).technique)
  const grams = (count: number) => {
    const weight = printedGrams(count, bead)
    return weight === undefined ? undefined : formatPrintedGrams(weight, locale, t.quantities.gramsUnit)
  }

  const tubes = (count: number) => fillBlanks(t.print.tubes, { count: groupThousands(count, locale) })
  const wordChart = wordChartOf(project)
  const palette = projectPalette(project)
  const quantities = computeColorQuantities(project, palette)
  // Tubes come from each color's rounded grams and the Total adds the rows up (ticket 0581).
  const tubeCounts = quantities.map((quantity) => {
    const weight = printedGrams(quantity.count, bead)
    return weight === undefined ? undefined : tubesToBuy(weight)
  })
  const tubeTotal = tubeCounts.some((count) => count === undefined) ? undefined : tubeCounts.reduce((sum, count) => sum! + count!, 0)
  const total = quantities.reduce((sum, quantity) => sum + quantity.count, 0)
  const perGram = bead && beadsPerGram(bead)
  const date = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(at)
  const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(at)

  return {
    locale,
    name: frameOf(project)?.name?.trim() || projectNameOf(project),
    techniqueWord: technique,
    maker,
    exportedAt: `${date} · ${time}`,
    metaLine: estimate
      ? fillBlanks(t.print.metaLine, { size, bead: beadName, estimate })
      : fillBlanks(t.print.metaLineNoEstimate, { size, bead: beadName }),
    colors: quantities.map((quantity, index) => ({
      hex: quantity.hex,
      name: listedColorName(t, palette.byId(quantity.colorId), quantity.hex),
      beads: groupThousands(quantity.count, locale),
      grams: grams(quantity.count),
      ...(palette.byId(quantity.colorId)?.code ? { code: palette.byId(quantity.colorId)!.code } : {}),
      ...(tubeCounts[index] === undefined ? {} : { tubes: tubes(tubeCounts[index]!) }),
      ...(lettersOn(project) && project.paletteLetters?.[quantity.hex] ? { letter: project.paletteLetters[quantity.hex] } : {}),
    })),
    colorsCount: plural(locale, quantities.length, t.a11y.colorsCount),
    totalBeads: plural(locale, total, t.print.beadsCount),
    totalGrams: grams(total),
    ...(tubeTotal === undefined ? {} : { totalTubes: tubes(tubeTotal) }),
    gramsNote:
      perGram && bead
        ? `${fillBlanks(t.print.gramsNote, { count: groupThousands(perGram, locale), bead: `${formFactorName(bead.formFactor)} ${bead.size}` })} ${t.print.spares}`
        : undefined,
    wordChart: wordChart && withFaceNote(wordChartText(wordChart, t.print.wordChart, t.rowProgress), project, t.print.wordChart),
    labels: t.print,
  }
}
