import { colorAt } from './canvas'
import type { Rotation } from './grid'
import { frameWeave, type Project } from './project'
import { describeWeave, lineOfPass, passCount, passOf, type PassDirection, type Technique } from './weave'

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
}

// Where grid line 0 lies on the displayed picture: the grid never turns, only its presentation does (rotation), so a
// turn moves the first row around the picture's edges (printPages' acrossReversed and downReversed say the same).
const FIRST_EDGE: Record<PassDirection, Record<Rotation, Edge>> = {
  rows: { 0: 'top', 90: 'right', 180: 'bottom', 270: 'left' },
  columns: { 0: 'left', 90: 'top', 180: 'right', 270: 'bottom' },
}

// Whether a line's positions count up from left to right (top to bottom for a line that runs down the picture).
const ASCENDS: Record<PassDirection, Record<Rotation, boolean>> = {
  rows: { 0: true, 90: true, 180: false, 270: false },
  columns: { 0: true, 90: false, 180: false, 270: true },
}

/** The Word chart of a Project's Frame, or undefined with Letters off, no Frame or a Technique without one. */
export function wordChartOf(project: Project): WordChart | undefined {
  const { frame } = project
  const weave = frameWeave(project)
  const { wordChart, twoPasses } = describeWeave(weave)
  if (!project.letters || !frame || !wordChart) {
    return undefined
  }
  const direction = project.rowProgress.direction
  const lines = direction === 'rows' ? frame.rows : frame.columns
  const along = direction === 'rows' ? frame.columns : frame.rows
  const ascends = ASCENDS[direction][project.rotation]
  let hasEmpty = false

  const rows: WordRow[] = []
  for (let pass = 0; pass < passCount(weave, lines, direction); pass += 1) {
    const line = lineOfPass(weave, pass, direction)
    const colors: (string | undefined)[] = []
    for (let at = 0; at < along; at += 1) {
      if (passOf(weave, line, at, direction) === pass) {
        const hex = direction === 'rows' ? colorAt(frame.beads, line, at) : colorAt(frame.beads, at, line)
        colors.push(hex === null ? undefined : (project.paletteLetters?.[hex] ?? '?'))
      }
    }
    const marker = wordChart.marked ? (pass % 2 === 0 ? 'L' : 'R') : undefined
    // A loom row, and an L row, read left to right; an R row right to left.
    const leftToRight = marker !== 'R'
    if (leftToRight !== ascends) colors.reverse()
    const runs: WordRun[] = []
    for (const letter of colors) {
      const last = runs[runs.length - 1]
      if (last && last.letter === letter) last.count += 1
      else runs.push({ count: 1, letter })
      hasEmpty ||= letter === undefined
    }
    const first = twoPasses && pass === 0
    rows.push({ number: twoPasses && pass > 0 ? pass + 2 : pass + 1, both: first, ...(marker ? { marker } : {}), runs })
  }

  return {
    marked: wordChart.marked,
    firstEdge: FIRST_EDGE[direction][project.rotation],
    ...(twoPasses ? { count: along % 2 === 0 ? 'even' : 'odd' } : {}),
    rows,
    lastNumber: rows[rows.length - 1]?.number ?? 0,
    hasEmpty,
  }
}
