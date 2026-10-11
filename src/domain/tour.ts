// The artwork is copied from docs/design/system/components/TourPattern/tour-pattern.json; tour.test.ts keeps the two equal.
import tourProject from './tourProjectData.json'
import { findPaletteColor } from './palette'
import type { Grid, RowProgress } from './project'
import type { Selection } from './selection'
import type { Tool } from './tool'

/**
 * The Tour (CONTEXT.md; ticket 80): eleven steps inside the real editor that build one finished Project, TourProject
 * in the design system. This module is the Tour's rules with no screen in them: the steps, the Project's grid at the end
 * of each step, when a step counts as done, and which control (or which beads) the Tour is pointing at right now.
 */

export const TOUR_COLUMNS = tourProject.size.columns
export const TOUR_ROWS = tourProject.size.rows

export type TourStepId =
  | 'create'
  | 'fill'
  | 'outline'
  | 'rhombus'
  | 'eye'
  | 'copy'
  | 'finish'
  | 'erase'
  | 'remove-line'
  | 'size'
  | 'rows'

/** The steps in order; the card says "n of 11" from this list's length. */
export const TOUR_STEPS: readonly TourStepId[] = [
  'create',
  'fill',
  'outline',
  'rhombus',
  'eye',
  'copy',
  'finish',
  'erase',
  'remove-line',
  'size',
  'rows',
]

/** The controls a step can point at; the screen maps each to the control's place on the current screen size. */
export type TourControl =
  | 'new-project'
  | 'tool-paint'
  | 'tool-fill'
  | 'tool-select'
  | 'tool-erase'
  | 'tool-hand'
  | 'color-black'
  | 'color-yellow'
  | 'copy'
  | 'ruler'
  | 'remove-line'
  | 'undo'
  | 'size'
  | 'progress-switch'
  | 'progress-next'
  | 'progress-previous'
  | 'export'
  /** The Project itself, for a step that marks beads on it. */
  | 'board'

const YELLOW = findPaletteColor('yellow')!.hex
const BLACK = findPaletteColor('black')!.hex

/** A bead's zero-based place in the grid. */
export interface TourCell {
  row: number
  column: number
}

/** Marks from the artwork file, which counts rows and columns from 1. */
function cells(list: readonly (readonly number[])[]): TourCell[] {
  return list.map(([row, column]) => ({ row: row! - 1, column: column! - 1 }))
}

const OUTLINE = cells(tourProject.marks['3'])
const EYE = cells(tourProject.marks['5'])
const STRAY = cells(tourProject.marks['8'])

const [SELECT_TOP, SELECT_LEFT, SELECT_ROWS, SELECT_COLUMNS] = tourProject.marks['6'].select as [number, number, number, number]
/** The rhombus the Copy step selects. */
export const TOUR_SELECTION: Selection = { top: SELECT_TOP - 1, left: SELECT_LEFT - 1, rows: SELECT_ROWS, columns: SELECT_COLUMNS }
/** Where the Copy step pastes it: the top-left bead of each of the four other rhombuses. */
const PASTE_SPOTS = cells(tourProject.marks['6'].pasteAt)

function colorOf(letter: string): string | null {
  return letter === 'Y' ? YELLOW : letter === 'K' ? BLACK : null
}

const FINAL: Grid = tourProject.rows.map((row) => [...row].map((letter) => ({ color: colorOf(letter) })))

function blank(color: string | null): Grid {
  return Array.from({ length: TOUR_ROWS }, () => Array.from({ length: TOUR_COLUMNS }, () => ({ color })))
}

function withCells(grid: Grid, list: readonly TourCell[], color: string | null): Grid {
  const copy = grid.map((row) => row.map((cell) => ({ ...cell })))
  for (const { row, column } of list) {
    copy[row]![column]!.color = color
  }
  return copy
}

function rhombusCells(): TourCell[] {
  const list: TourCell[] = []
  for (let row = TOUR_SELECTION.top; row < TOUR_SELECTION.top + TOUR_SELECTION.rows; row++) {
    for (let column = 0; column < TOUR_COLUMNS; column++) {
      list.push({ row, column })
    }
  }
  return list
}

/** The grid with only the first rhombus drawn, on black. */
function firstRhombusOnly(): Grid {
  const grid = blank(BLACK)
  for (const { row, column } of rhombusCells()) {
    grid[row]![column]!.color = FINAL[row]![column]!.color
  }
  return grid
}

function stamp(grid: Grid, from: Grid, row: number, column: number): Grid {
  const copy = grid.map((line) => line.map((cell) => ({ ...cell })))
  for (let r = 0; r < TOUR_SELECTION.rows; r++) {
    for (let c = 0; c < TOUR_SELECTION.columns; c++) {
      copy[row + r]![column + c]!.color = from[TOUR_SELECTION.top + r]![TOUR_SELECTION.left + c]!.color
    }
  }
  return copy
}

/**
 * The Project's grid once step `n` (1 to 8) is done. Step 1 leaves it empty, 7 leaves one stray yellow bead in the
 * top-left corner for step 8, which erases it.
 */
export function afterStep(n: number): Grid {
  const eyeRhombus = firstRhombusOnly()
  switch (n) {
    case 1:
      return blank(null)
    case 2:
      return blank(BLACK)
    case 3:
      return withCells(blank(BLACK), OUTLINE, YELLOW)
    case 4:
      return withCells(eyeRhombus, EYE, YELLOW)
    case 5:
      return eyeRhombus
    case 6:
      return PASTE_SPOTS.reduce((grid, spot) => stamp(grid, eyeRhombus, spot.row, spot.column), eyeRhombus)
    case 7:
      return withCells(FINAL, STRAY, YELLOW)
    default:
      return FINAL
  }
}

export function gridsEqual(a: Grid, b: Grid): boolean {
  return a.length === b.length && a.every((row, r) => row.length === b[r]!.length && row.every((cell, c) => cell.color === b[r]![c]!.color))
}

/** What the Tour reads off the app to decide where a step stands. */
export interface TourSnapshot {
  /** The open Project's id; none while the New Project form is up. */
  projectId: string | undefined
  columns: number
  rows: number
  grid: Grid
  tool: Tool
  colorId: string | undefined
  selection: Selection | undefined
  /** A copied block is armed to paste (the Select tool's paste projection). */
  pasteArmed: boolean
  rowProgress: RowProgress
}

/** What a step remembers between looks that the app's state doesn't hold on its own. */
export interface TourMemo {
  /** The Tour Project lost a line (Remove line), so coming back to it is the step's Undo. */
  sizeLeft?: boolean
  /** Row progress got to row 4, so three rows were marked done. */
  reachedRow3?: boolean
}

export interface TourEvaluation {
  memo: TourMemo
  done: boolean
}

const GRID_STEP: Partial<Record<TourStepId, number>> = { fill: 2, outline: 3, rhombus: 4, eye: 5, copy: 6, erase: 8 }

function atTourSize(snapshot: TourSnapshot): boolean {
  return snapshot.columns === TOUR_COLUMNS && snapshot.rows === TOUR_ROWS
}

/** Whether a step is done, and what it needs to remember for the next look. The Tour finishing step is done only by Next. */
export function evaluateStep(step: TourStepId, snapshot: TourSnapshot, memo: TourMemo): TourEvaluation {
  const gridStep = GRID_STEP[step]
  if (gridStep !== undefined) {
    return { memo, done: atTourSize(snapshot) && gridsEqual(snapshot.grid, afterStep(gridStep)) }
  }

  switch (step) {
    case 'create':
      // Only a blank Tour-sized Project counts, so a Project of someone's own that happens to be open is never built on.
      return { memo, done: snapshot.projectId !== undefined && atTourSize(snapshot) && gridsEqual(snapshot.grid, afterStep(1)) }
    case 'remove-line':
    case 'size': {
      const sizeLeft = memo.sizeLeft || !atTourSize(snapshot)
      return { memo: { ...memo, sizeLeft }, done: !!sizeLeft && atTourSize(snapshot) && gridsEqual(snapshot.grid, afterStep(8)) }
    }
    case 'rows': {
      const { enabled, currentRow } = snapshot.rowProgress
      const reachedRow3 = memo.reachedRow3 || (enabled && currentRow >= 3)
      return { memo: { ...memo, reachedRow3 }, done: !!reachedRow3 && enabled && currentRow === 2 }
    }
    default:
      return { memo, done: false }
  }
}

/** A rectangle of beads, for a Selection frame or a paste spot. */
export interface TourBox {
  top: number
  left: number
  rows: number
  columns: number
}

/** What the Tour points at right now: one control, and on the Project the beads or boxes to mark. */
export interface TourTargets {
  control: TourControl
  /** Beads still to paint or erase, outlined on the Project. */
  cells?: TourCell[]
  /** The frame to select. */
  box?: TourBox
  /** Paste spots still to fill. */
  pasteBoxes?: TourBox[]
}

function regionMatches(grid: Grid, expected: Grid, spot: TourCell): boolean {
  for (let r = 0; r < TOUR_SELECTION.rows; r++) {
    for (let c = 0; c < TOUR_SELECTION.columns; c++) {
      if (grid[spot.row + r]?.[spot.column + c]?.color !== expected[spot.row + r]![spot.column + c]!.color) {
        return false
      }
    }
  }
  return true
}

function stillToMark(grid: Grid, list: readonly TourCell[], color: string | null): TourCell[] {
  return list.filter(({ row, column }) => grid[row]?.[column]?.color !== color)
}

/** The tool, then the color, then the Project: each is pointed at only until it is the one in use. */
function toolThenColor(snapshot: TourSnapshot, tool: Tool, colorId: 'black' | 'yellow'): TourControl | undefined {
  if (snapshot.tool !== tool) {
    return `tool-${tool}`
  }
  return snapshot.colorId === colorId ? undefined : `color-${colorId}`
}

function isWholeLine(snapshot: TourSnapshot): boolean {
  const { selection } = snapshot
  return !!selection && ((selection.rows === 1 && selection.columns === snapshot.columns) || (selection.columns === 1 && selection.rows === snapshot.rows))
}

export function tourTargets(step: TourStepId, snapshot: TourSnapshot, memo: TourMemo): TourTargets {
  const { grid } = snapshot
  switch (step) {
    case 'create':
      return { control: 'new-project' }
    case 'fill':
      return { control: toolThenColor(snapshot, 'fill', 'black') ?? 'board' }
    case 'outline': {
      const control = toolThenColor(snapshot, 'paint', 'yellow')
      return control ? { control } : { control: 'board', cells: stillToMark(grid, OUTLINE, YELLOW) }
    }
    case 'rhombus':
      return { control: toolThenColor(snapshot, 'fill', 'yellow') ?? 'board' }
    case 'eye': {
      const control = toolThenColor(snapshot, 'paint', 'black')
      return control ? { control } : { control: 'board', cells: stillToMark(grid, EYE, BLACK) }
    }
    case 'copy': {
      if (snapshot.tool !== 'select') {
        return { control: 'tool-select' }
      }
      if (snapshot.pasteArmed) {
        const expected = afterStep(6)
        const pasteBoxes = PASTE_SPOTS.filter((spot) => !regionMatches(grid, expected, spot)).map((spot) => ({
          top: spot.row,
          left: spot.column,
          rows: TOUR_SELECTION.rows,
          columns: TOUR_SELECTION.columns,
        }))
        return { control: 'board', pasteBoxes }
      }
      const s = snapshot.selection
      const selected = !!s && s.top === TOUR_SELECTION.top && s.left === TOUR_SELECTION.left && s.rows === TOUR_SELECTION.rows && s.columns === TOUR_SELECTION.columns
      return selected ? { control: 'copy' } : { control: 'board', box: { ...TOUR_SELECTION } }
    }
    case 'finish':
      return { control: 'board' }
    case 'erase':
      return snapshot.tool === 'erase' ? { control: 'board', cells: stillToMark(grid, STRAY, null) } : { control: 'tool-erase' }
    case 'remove-line':
      if (memo.sizeLeft || !atTourSize(snapshot)) {
        return { control: 'undo' }
      }
      return { control: isWholeLine(snapshot) ? 'remove-line' : 'ruler' }
    case 'size':
      return memo.sizeLeft || !atTourSize(snapshot) ? { control: 'undo' } : { control: 'size' }
    case 'rows': {
      const { enabled, currentRow } = snapshot.rowProgress
      if (!enabled) {
        return { control: 'progress-switch' }
      }
      return { control: memo.reachedRow3 || currentRow >= 3 ? 'progress-previous' : 'progress-next' }
    }
  }
}

/** The finished Tour Project, as the Overview shows it lying across its page (ticket 216). */
export function tourFinishedGrid(): Grid {
  return FINAL
}
