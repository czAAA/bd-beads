import { colorAt } from './canvas'
import type { Rotation } from './grid'
import { frameRowOrder } from './rowProgress'
import { frameWeave } from './layerWeave'
import type { Project } from './project'
import { describeWeave, type PassDirection, type Technique } from './weave'
import type { OrderStep, RowOrder } from './rowOrder'

/** The Word chart (ticket 0574; CONTEXT.md's Word chart): the written pattern a weaver follows beside the picture, one
 * line per row in the order Row progress counts them. Pure data here; the words and the drawing are the export's. */

/** Whether a Technique has a Word chart (the Letters toggle says so when it has none): Right-angle weave and Netting
 * have none yet. */
export function hasWordChart(technique: Technique): boolean {
  return describeWeave({ technique }).wordChart !== undefined
}

/** A run of beads of one color in a row; no letter for empty cells. */
interface WordRun {
  count: number
  letter: string | undefined
}

interface WordRow {
  /** The row's number; the first row of a peyote chart holds rows 1 and 2 and is numbered 1. */
  number: number
  /** Peyote's first line, `Rows 1&2`. */
  both: boolean
  /** Which end the row starts from, for peyote and brick stitch: L reads left to right, R right to left. */
  marker?: 'L' | 'R'
  /** A Custom frame's pass (ticket 0594): the round, row, part's round or join it is. A join lists no runs. */
  step?: OrderStep
  runs: WordRun[]
}

type Edge = 'top' | 'right' | 'bottom' | 'left'

export interface WordChart {
  /** Whether rows carry an (L) or (R): the Technique's own; the others all read left to right. */
  marked: boolean
  /** Where on the picture Row 1 is, as it is displayed (rotation included). */
  firstEdge: Edge
  /** Where a Technique takes two passes a line (peyote): whether a row holds an even or an odd number of beads. */
  count?: 'even' | 'odd'
  rows: WordRow[]
  /** The last row number, so the header can say "1–24". */
  lastNumber: number
  /** Whether any cell is empty, so the legend explains `*`. */
  hasEmpty: boolean
  /** A Custom frame's start in place of the edge Row 1 is at (ticket 0594): rounds from the centre, rows from a Kite's
   * point, a Fringe earring's top from its base and then its strands (ticket 0597), or parts in making order and then
   * their joins. */
  start?: 'centre' | 'point' | 'base' | 'parts'
}

// Where grid line 0 lies on the displayed picture: the grid never turns, only its presentation does (rotation), so a
// turn moves the first row around the picture's edges (printPages' acrossReversed and downReversed say the same).
const FIRST_EDGE: Record<PassDirection, Record<Rotation, Edge>> = {
  rows: { 0: 'top', 90: 'right', 180: 'bottom', 270: 'left' },
  columns: { 0: 'left', 90: 'top', 180: 'right', 270: 'bottom' },
}

const OPPOSITE: Record<Edge, Edge> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' }

// Whether a line's positions count up from left to right (top to bottom for a line that runs down the picture).
const ASCENDS: Record<PassDirection, Record<Rotation, boolean>> = {
  rows: { 0: true, 90: true, 180: false, 270: false },
  columns: { 0: true, 90: false, 180: false, 270: true },
}

/** The Word chart of a Project's Frame, or undefined with Letters off, no Frame, or a Technique or Frame kind without
 * one. */
export function wordChartOf(project: Project): WordChart | undefined {
  const { frame } = project
  const weave = frameWeave(project)
  const { wordChart, twoPasses } = describeWeave(weave)
  if (!project.letters || !frame || !wordChart) {
    return undefined
  }
  const order = frameRowOrder(project)
  if (order.stepOf) {
    return customWordChart(project, order)
  }
  const { direction, reversed } = project.rowProgress
  const along = direction === 'rows' ? frame.columns : frame.rows
  const ascends = ASCENDS[direction][project.rotation]
  let hasEmpty = false

  const rows: WordRow[] = []
  for (let pass = 0; pass < order.count; pass += 1) {
    const colors = order.positionsOf(pass).map(({ row, column }) => {
      const hex = colorAt(frame.beads, row, column)
      return hex === null ? undefined : (project.paletteLetters?.[hex] ?? '?')
    })
    const marker = wordChart.marked ? (pass % 2 === 0 ? 'L' : 'R') : undefined
    // A loom row, and an L row, read left to right; an R row right to left.
    const leftToRight = marker !== 'R'
    if (leftToRight !== ascends) colors.reverse()
    hasEmpty ||= colors.includes(undefined)
    const first = twoPasses && pass === 0
    rows.push({ number: twoPasses && pass > 0 ? pass + 2 : pass + 1, both: first, ...(marker ? { marker } : {}), runs: runsOf(colors) })
  }

  return {
    marked: wordChart.marked,
    firstEdge: reversed ? OPPOSITE[FIRST_EDGE[direction][project.rotation]] : FIRST_EDGE[direction][project.rotation],
    ...(twoPasses ? { count: along % 2 === 0 ? 'even' : 'odd' } : {}),
    rows,
    lastNumber: rows[rows.length - 1]?.number ?? 0,
    hasEmpty,
  }
}

/** A pass's letters in order as runs of one letter: `undefined` for an empty position. */
function runsOf(letters: readonly (string | undefined)[]): WordRun[] {
  const runs: WordRun[] = []
  for (const letter of letters) {
    const last = runs[runs.length - 1]
    if (last && last.letter === letter) last.count += 1
    else runs.push({ count: 1, letter })
  }
  return runs
}

/** A Custom frame's Word chart (ticket 0594): one line per pass of its Row order, numbered from 1, each round read round
 * the shape and each Kite row left to right; a join is a line of its own with no runs. */
function customWordChart(project: Project, order: RowOrder): WordChart {
  const frame = project.frame!
  let hasEmpty = false
  let parts = false
  let strands = false
  const rows: WordRow[] = []
  for (let pass = 0; pass < order.count; pass += 1) {
    const step = order.stepOf!(pass)!
    parts ||= step.kind === 'join' || (step.kind !== 'strand' && step.part !== undefined)
    strands ||= step.kind === 'strand'
    const letters = step.kind === 'join'
      ? []
      : order.positionsOf(pass).map(({ row, column }) => {
          const hex = colorAt(frame.beads, row, column)
          return hex === null ? undefined : (project.paletteLetters?.[hex] ?? '?')
        })
    hasEmpty ||= letters.includes(undefined)
    rows.push({ number: pass + 1, both: false, step, runs: runsOf(letters) })
  }
  const first = order.stepOf!(0)
  return {
    marked: false,
    firstEdge: 'top',
    rows,
    lastNumber: rows.length,
    hasEmpty,
    start: parts ? 'parts' : strands ? 'base' : first?.kind === 'row' ? 'point' : 'centre',
  }
}
