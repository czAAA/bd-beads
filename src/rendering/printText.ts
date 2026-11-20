import { beadLabel, formFactorName } from '../domain/beads'
import { computeColorQuantities, hasEmptyPositions } from '../domain/beadQuantities'
import { projectPalette } from '../domain/palette'
import { listedColorName } from '../i18n/colorName'
import { rotationSwapsAxes } from '../domain/grid'
import { paintedFrameBox, shownDimensions } from '../domain/projectExtent'
import { frameWeave } from '../domain/layerWeave'
import { resolveProjectBead } from '../domain/projectBead'
import type { Project } from '../domain/project'
import { estimatedSizeMm, formatSizeMm } from '../domain/projectSize'
import { beadsPerGram, formatPrintedGrams, printedGrams } from '../domain/printGrams'
import { groupThousands } from '../domain/formatNumber'
import { plural } from '../i18n/plural'
import { techniqueName } from '../i18n/techniqueName'
import type { Locale, Translations } from '../i18n/translations'
import { wordChartOf, type WordChart, type WordRun, type WordSide, type WordSpine } from '../domain/wordChart'
import { orderStepLabel } from '../i18n/orderStep'
import { fillBlanks } from '../domain/fillBlanks'
import { frameOf, quarterTurnOf, projectNameOf, withFrameSheet } from '../domain/layerRecord'
import { pieceFaceOf } from '../domain/pieceFaces'
import { largeBeadsActs } from './pageOneLayout'

/** One color of Beads needed on paper: its swatch, name, beads and grams. */
interface PrintedColor {
  hex: string
  name: string
  beads: string
  grams?: string
  /** The catalog code, which page 1's Beads needed prints in its own column (it is also in `name`). */
  code?: string
  /** The color's Swatch letter (ticket 0573), printed on its swatch: every printed chart is lettered (ticket 0914). */
  letter?: string
}

/** A piece of a written row (ticket 1096; PrintWordChart card): words, or a run, its count printed with its bead's swatch
 * (the Swatch letter's), an empty position's swatch when it has no letter. */
export type PrintedRunPart = { text: string } | { count: number; letter?: string }

/** The parts a row never wraps apart: a run, a corner pair in its brackets, or a side's last run with the bar after it. */
export type PrintedRunUnit = readonly PrintedRunPart[]

/** One line of the Word chart: its number (`3`, `1&2`) and the rows it holds, the end it starts from and its runs. */
export interface PrintedWordRow {
  label: string
  first: number
  last: number
  marker?: 'L' | 'R'
  runs: PrintedRunUnit[]
}

/** The Word chart as words (ticket 0574), only with Row by row on (ticket 0916). */
interface PrintedWordChart {
  title: string
  /** The key's last item, "empty", when the Schema has empty positions. */
  empty?: string
  /** The lines on reading the rows: which row is first, even or odd count, (L) and (R), a run. */
  notes: string[]
  rows: PrintedWordRow[]
}

/** The Export panel's print choices (tickets 0916, 1096), kept on the device: Cover page (on at first) opens the PDF on the
 * Cover page, Large beads keeps every bead of the chart at 3 mm or more, Row by row adds the Word chart's pages. */
export interface PrintChoices {
  cover?: boolean
  largeBeads?: boolean
  rowByRow?: boolean
}

// Everything the PDF and PNG print, worked out as words before drawing (tickets 162, 164); maker's name omitted when
// empty. It carries the print choices too, so the page count, the File size estimate and the export read one plan.
export interface PrintText {
  locale: Locale
  /** The title: the Frame's name, else the Project's (ticket 0720). */
  name: string
  techniqueWord: string
  maker: string
  /** "Sep 26, 2026 · 14:32" */
  exportedAt: string
  metaLine: string
  /** "Miyuki Delica 11/0", after Beads needed's heading (ticket 1096); none for an unknown Bead. */
  beadName?: string
  colors: PrintedColor[]
  /** "22 colors" */
  colorsCount: string
  /** "4 800 beads" and "≈ 24 g": the Total both ways. */
  totalBeads: string
  totalGrams?: string
  gramsNote?: string
  /** Page 1's key's last item, "empty", when the Schema has empty positions (ticket 0963): the chart's cross named. */
  empty?: string
  wordChart?: PrintedWordChart
  /** Large beads (ticket 0916): page 1's layout plans no bead under 3 mm. Only where it acts (ticket 1125): a piece that
   * prints at 3 mm or more without it never carries it. */
  largeBeads?: boolean
  /** Cover page (ticket 1096): the PDF opens on the Cover page, and page 1 is its second page. */
  cover?: boolean
  labels: Translations['print']
}

/** The maker's name in a header: cut with an ellipsis past 32 characters (printed-output.md, The maker's name). */
export function headerMaker(maker: string): string {
  return maker.length > 32 ? `${maker.slice(0, 31).trimEnd()}…` : maker
}

const FIRST_ROW_KEY = { top: 'firstTop', right: 'firstRight', bottom: 'firstBottom', left: 'firstLeft' } as const

/** Where a Custom frame's Word chart starts, as its note (ticket 0594). */
const START_KEY = { centre: 'firstCentre', point: 'firstPoint', base: 'firstBase', parts: 'partsThenJoins' } as const

/** Where the Word chart's line on runs draws a bead (ticket 1096): an outlined swatch with the letter C. */
export const RUN_NOTE_BEAD = '\ufffc'

/** Each run on its own: its count and its bead, `2 ▢` (ticket 1096; it was `2C, 1A, 3×`, ticket 0574). */
function runUnits(runs: readonly WordRun[]): PrintedRunUnit[] {
  return runs.map((run) => [{ count: run.count, ...(run.letter ? { letter: run.letter } : {}) }])
}

/** A pair's beads in brackets, `(2 ▢)` or `(1 ▢ 1 ▢)` (ticket 0873), kept together; none for no pair. */
function pairUnits(runs: readonly WordRun[]): PrintedRunUnit[] {
  return runs.length > 0 ? [[{ text: '(' }, ...runUnits(runs).flat(), { text: ')' }]] : []
}

/** A round side by side (ticket 0873): each side its corner pair in brackets, then its singles' runs, the sides apart at
 * a `|` kept with the side it ends. */
function sidesUnits(sides: readonly WordSide[]): PrintedRunUnit[] {
  return sides.flatMap(({ corner, singles }, index) => {
    const units = [...pairUnits(corner), ...runUnits(singles)]
    if (index === sides.length - 1 || units.length === 0) return units
    return [...units.slice(0, -1), [...units.at(-1)!, { text: '|' }]]
  })
}

/** A Kite row (ticket 0874): its runs up to the middle pair, the pair in brackets as a corner pair is, then the rest. */
function spineUnits({ before, pair, after }: WordSpine): PrintedRunUnit[] {
  return [...runUnits(before), ...pairUnits(pair), ...runUnits(after)]
}

/** A line's runs, led by a Custom frame's pass in words ("Round 3:"), or the pass alone where it lists no beads (a join). */
function rowUnits(step: string | undefined, runs: PrintedRunUnit[]): PrintedRunUnit[] {
  if (!step) return runs
  return runs.length > 0 ? [[{ text: `${step}:` }], ...runs] : [[{ text: step }]]
}

/** The Word chart's words in the app's language; letters and numbers stay as they are. A Custom frame's line names its
 * round, row, part or join before its runs (ticket 0594). */
function wordChartText(chart: WordChart, t: Translations['print']['wordChart'], steps: Translations['rowProgress']): PrintedWordChart {
  const notes = [chart.start ? t[START_KEY[chart.start]] : t[FIRST_ROW_KEY[chart.firstEdge]]]
  if (!chart.marked && !chart.start) notes.push(t.loomRead)
  if (chart.count) notes.push(chart.count === 'even' ? t.evenCount : t.oddCount)
  if (chart.marked) notes.push(t.sides)
  notes.push(fillBlanks(t.runNote, { bead: RUN_NOTE_BEAD }))
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
      runs: rowUnits(row.step && orderStepLabel(steps, row.step), row.sides ? sidesUnits(row.sides) : row.spine ? spineUnits(row.spine) : runUnits(row.runs)),
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

/** The words an export prints; the maker's name is the Project's own, and empty prints none (ADR 0060). The Word chart
 * follows Row by row, never Letters (ticket 0916). */
export function printText(project: Project, t: Translations, locale: Locale, at: Date, choices: PrintChoices = {}): PrintText {
  const bead = resolveProjectBead(project)
  const maker = (project.makerName ?? '').trim()
  // The tech line gives the trimmed size (ticket 1128): the box round the Frame's beads, measured as a Frame of that size.
  const box = paintedFrameBox(project)
  const measured = box ? withFrameSheet(project, { ...frameOf(project)!, columns: box.columns, rows: box.rows }) : project
  const { columns, rows } = shownDimensions(measured)
  const [across, down] = rotationSwapsAxes(quarterTurnOf(project)) ? [rows, columns] : [columns, rows]
  const size = `${across}×${down}`
  const estimate = bead ? formatSizeMm(estimatedSizeMm(measured, bead), { mm: t.form.unitMm, cm: t.form.unitCm }, locale) : undefined
  const beadName = bead ? beadLabel(bead) : t.projects.unknownBeadLabel
  const technique = techniqueName(t, frameWeave(project).technique)
  const grams = (count: number) => {
    const weight = printedGrams(count, bead)
    return weight === undefined ? undefined : formatPrintedGrams(weight, locale, t.quantities.gramsUnit)
  }

  const wordChart = choices.rowByRow ? wordChartOf(project) : undefined
  const palette = projectPalette(project)
  const quantities = computeColorQuantities(project, palette)
  const total = quantities.reduce((sum, quantity) => sum + quantity.count, 0)
  const perGram = bead && beadsPerGram(bead)
  const date = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(at)
  const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(at)

  const text: PrintText = {
    locale,
    name: frameOf(project)?.name?.trim() || projectNameOf(project),
    techniqueWord: technique,
    maker,
    exportedAt: `${date} · ${time}`,
    metaLine: estimate
      ? fillBlanks(t.print.metaLine, { size, bead: beadName, estimate })
      : fillBlanks(t.print.metaLineNoEstimate, { size, bead: beadName }),
    ...(bead ? { beadName } : {}),
    colors: quantities.map((quantity) => ({
      hex: quantity.hex,
      name: listedColorName(t, palette.byId(quantity.colorId), quantity.hex),
      beads: groupThousands(quantity.count, locale),
      grams: grams(quantity.count),
      ...(palette.byId(quantity.colorId)?.code ? { code: palette.byId(quantity.colorId)!.code } : {}),
      ...(project.paletteLetters?.[quantity.hex] ? { letter: project.paletteLetters[quantity.hex] } : {}),
    })),
    colorsCount: plural(locale, quantities.length, t.a11y.colorsCount),
    totalBeads: plural(locale, total, t.print.beadsCount),
    totalGrams: grams(total),
    gramsNote:
      perGram && bead
        ? `${fillBlanks(t.print.gramsNote, { count: groupThousands(perGram, locale), bead: `${formFactorName(bead.formFactor)} ${bead.size}` })} ${t.print.spares}`
        : undefined,
    ...(hasEmptyPositions(project) ? { empty: t.print.wordChart.empty } : {}),
    wordChart: wordChart && withFaceNote(wordChartText(wordChart, t.print.wordChart, t.rowProgress), project, t.print.wordChart),
    ...(choices.cover ? { cover: true } : {}),
    labels: t.print,
  }
  // Large beads only where it makes the beads bigger (ticket 1125): a remembered "on" does nothing on a small piece.
  return choices.largeBeads && largeBeadsActs(project, text) ? { ...text, largeBeads: true } : text
}
