import type { GridPosition } from './grid'
import { lineOfPass, passCount, passLines, passOf, turnsRowDirection, type PassDirection, type Weave } from './weave'

/** The way the weaver works through a Frame (ticket 0589): along its rows or down its columns, from its far end when
 * reversed. Row progress keeps a pointer for each. */
export interface RowWay {
  direction: PassDirection
  reversed?: boolean
}

/** A Row order (spec 0590, ADR 0077): how Row progress steps through a Frame's beads, pass by pass from pass 0, worked
 * one way. Row progress asks it and never the Technique. A Custom frame chains one per panel, each one's passes counted
 * on from the passes before it, so a (panel, step) pointer is still one number. */
export interface RowOrder {
  /** Whether the weaver may turn the way the rows run (Turn row direction). */
  turns: boolean
  /** How many passes the Frame takes; a pointer at `count` means every pass is done (ticket 411). */
  count: number
  /** The pass that weaves the bead at a position counted from the Frame's first row and column. */
  passAt(position: GridPosition): number
  /** The positions a pass weaves, from the Frame's first row and column, in order along each line; none past the
   * last pass. What the current-row marker rings and the Word chart reads. */
  positionsOf(pass: number): GridPosition[]
  /** The Frame line (row or column, the way the rows run) a pass works on, as the rulers mark it; none where a pass is
   * not on one line. */
  lineOf(pass: number): number | undefined
}

/** A line's index counted from the Frame's far end when the way is reversed, so every pass rule keeps working on lines
 * counted in weaving order (ticket 0589). */
function mirrorLine(line: number, lines: number, reversed: boolean | undefined): number {
  return reversed ? lines - 1 - line : line
}

/** The rows Row order (tickets 347, 484, 487): a Rectangular Frame woven line by line in its Weave's passes, loom and
 * brick stitch one pass a line, peyote two after the first, Right-angle weave a line of Units, Netting a row of
 * diamonds. */
export function rowsOrder(weave: Weave & { rows: number; columns: number }, { direction, reversed }: RowWay): RowOrder {
  const columnWise = direction === 'columns'
  const lines = columnWise ? weave.columns : weave.rows
  const length = columnWise ? weave.rows : weave.columns
  const count = passCount(weave, lines, direction)
  return {
    turns: turnsRowDirection(weave.technique),
    count,
    passAt: ({ row, column }) => (columnWise ? passOf(weave, mirrorLine(column, lines, reversed), row, direction) : passOf(weave, mirrorLine(row, lines, reversed), column, direction)),
    positionsOf: (pass) => {
      if (pass < 0 || pass >= count) {
        return []
      }
      const positions: GridPosition[] = []
      for (const line of passLines(weave, pass, direction)) {
        const at = mirrorLine(line, lines, reversed)
        for (let along = 0; along < length; along += 1) {
          if (passOf(weave, line, along, direction) === pass) {
            positions.push(columnWise ? { row: along, column: at } : { row: at, column: along })
          }
        }
      }
      return positions
    },
    lineOf: (pass) => mirrorLine(lineOfPass(weave, pass, direction), lines, reversed),
  }
}
