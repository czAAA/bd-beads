import type { Rect } from './canvas'
import type { GridDimensions, GridPosition } from './grid'
import type { BeadCell } from './weave'

// The geometry layer (ADR 0078, ticket 0621): a Technique's entry names its geometry kind with values, and one module
// per kind answers every layout question from them. A new kind is a module and a case in weave.ts's switch.

/** How a Technique's lines are woven, the values both kinds of grid share. */
interface LinesGeometry {
  /** How far a staggered line sits along, in beads. */
  shift: number
  /** A drawn bead's height over its width. */
  cellAspect: number
  /** How much of a bead's width its corners are rounded by. */
  roundness: number
  /** How lines are woven: one pass each, or the first in one and every later one in two (peyote: even beads, then odd). */
  passes: 'one' | 'twoAfterFirst'
  /** How many lines lie straight beside each other before the next block of them shifts, where lines shift: 1, every other. */
  block: number
}

/** Loom and brick stitch: beads on rows, every other row (or block of rows) shifted sideways where `shifted`. */
export interface RowsGeometry extends LinesGeometry {
  kind: 'rows'
  /** Every other row (or block of rows) sits `shift` of a bead across. */
  shifted: boolean
}

/** Peyote (ticket 0734): beads on rows and columns a full bead apart, every other column (or block of columns) sitting
 * `shift` of a bead down. */
export interface ColumnsGeometry extends LinesGeometry {
  kind: 'columns'
}

/** A Technique's geometry: its kind and the values that kind reads. Values and enums only, never expressions. */
export type GeometryRef = RowsGeometry | ColumnsGeometry

/** The lines a flood spans: rows, a bead touching those beside it in its row, or columns (ticket 0734). */
export type SpanAxis = 'row' | 'column'

/** The way a pass runs: along the Frame's rows, or down its columns. */
export type PassDirection = 'rows' | 'columns'

/** A rectangle in grid space. */
export interface Box {
  x: number
  y: number
  width: number
  height: number
}

/** A point inside a grid's own footprint, in whatever unit the cell size was given in. */
export interface CellCenter {
  x: number
  y: number
}

/** The rows of positions in view, and the columns in view on each. */
export interface VisiblePositions {
  firstRow: number
  lastRow: number
  columnsOf(row: number): { first: number; last: number }
}

/** The values of a geometry that are numbers: what a Technique's setting may set in place of its entry's own. */
export type GeometryNumber<G extends GeometryRef = GeometryRef> = G extends unknown ? { [K in keyof G]-?: G[K] extends number ? K : never }[keyof G] : never

/** Everything a geometry answers about a Weave's layout, built once per Weave. */
export interface WeaveGeometry {
  /** Whether every other line (or block of lines) sits `shift` of a bead along. */
  shifted: boolean
  shift: number
  /** Which lines shift: rows sit sideways, columns sit down (ticket 0734). */
  staggers: 'rows' | 'columns'
  /** A drawn bead's height over its width in px: the Bead's own cell's. */
  cellAspect: number
  /** How much of a bead's width its corners are rounded by, in the Technique's own cell. */
  roundness: number
  /** After how many rows the stagger repeats, 1 where rows stand straight; Frame starts, edges and moves go by multiples. */
  rowCycle: number
  /** After how many columns the stagger repeats, 1 where columns stand straight. */
  columnCycle: number
  /** The rectangle a position's bead takes, in the unit of the cell size passed (px, or mm of a Bead). */
  box(position: GridPosition, cellWidth: number, cellHeight: number): Box
  /** How far a row's beads sit across from an unshifted row's: its shift where rows shift, 0 everywhere else. */
  rowOffset(row: number, cellWidth: number): number
  /** How far a column's beads sit down from an unshifted column's: its shift where columns shift, 0 everywhere else. */
  columnOffset(column: number, cellHeight: number): number
  /** The size of a block of positions, rows and columns counted in positions. */
  blockExtent(columns: number, rows: number, cellWidth: number, cellHeight: number): { width: number; height: number }
  /** The rectangle a block of positions takes, from the grid's top-left: its lattice, with the room a shifted line takes
   * on the right (a row) or below (a column), whichever lines it holds. What a Frame's line goes round. */
  blockBox(block: Rect, cellWidth: number, cellHeight: number): Box
  /** The line between a block's positions and the ones round it (ticket 0623): half a bead round its first and last
   * lines' middles across the stagger, and a quarter bead along it, between a shifted line's cells and an unshifted
   * one's. Where Position marks stop round a Frame's margin. */
  boundary(block: Rect, cellWidth: number, cellHeight: number): Box
  /** The position whose bead covers a point of the grid, or undefined between beads, within the rows and columns of
   * `within` when given (a block from row 0, column 0). */
  positionAt(x: number, y: number, cellWidth: number, cellHeight: number, within?: GridDimensions): GridPosition | undefined
  /** The position whose bead is nearest a point of the grid, gaps included. */
  nearestPosition(x: number, y: number, cellWidth: number, cellHeight: number): GridPosition
  /** The rows of positions whose beads can touch a stretch of grid space, and each row's columns. */
  visible(area: { left: number; right: number; top: number; bottom: number }, cellWidth: number, cellHeight: number): VisiblePositions
  /** The repeating tile of the lattice: its size and the bead boxes it holds, from its top-left: a bead across and a
   * cycle of rows down, or a cycle of columns across and a bead down, at least two. */
  tile(cellWidth: number, cellHeight: number): { size: { width: number; height: number }; beads: Box[] }
  /** Where a Frame's top-left position sits from the grid's top-left, in the unit of the cell size passed: its bead's
   * corner. */
  origin(position: GridPosition, cellWidth: number, cellHeight: number): CellCenter
  /** A position's centre from the grid's top-left, in the unit of the cell size passed (px, or mm of a Bead). */
  center(position: GridPosition, cellWidth: number, cellHeight: number): CellCenter
  /** The positions that touch a position, for Fill; only those inside `bounds` when given. */
  neighbors(bounds: Rect | undefined, position: GridPosition): GridPosition[]
  /** The lines a Fill floods a span at a time (ticket 0677): rows where rows are staggered, columns where columns are
   * (ticket 0734), and how far a bead of one touches into the next. */
  spans: {
    along: SpanAxis
    /** Which positions of `toLine`, the line either side of `line`, a bead of `line` touches, as offsets from its own
     * position along the line (the cross-line part of `neighbors`; along a line a bead touches the next one either side). */
    reach(line: number, toLine: number): readonly [number, number]
  }
  /** Whether the first line takes one pass and every later one two (peyote: even positions, then odd). */
  twoPasses: boolean
  /** Row progress's passes (tickets 347, 484, 487), lines counted from the Frame's first in weaving order. */
  passes: {
    /** How many passes weaving `lines` lines takes. */
    count(lines: number, direction: PassDirection): number
    /** The pass (zero-based) that weaves the bead at `along` (its position along its line) in line `line`. */
    of(line: number, along: number, direction: PassDirection): number
    /** The line a pass works on: what the rulers number and what the current-line marker sits on. */
    lineOf(pass: number, direction: PassDirection): number
    /** Every line that holds a bead of a pass. */
    lines(pass: number, direction: PassDirection): number[]
  }
  /** Where a quarter turn clockwise sends the bead at `position`, both counted from the top-left of a block of
   * `block` positions (a Selection, or the Frame with its margin). */
  turned(position: GridPosition, block: GridDimensions): GridPosition
}

/** One geometry module: builds a Weave's answers from its kind's values, with its settings' in place, once. */
export type GeometryStrategy<G extends GeometryRef> = (geometry: G, cell: BeadCell | undefined) => WeaveGeometry

/** The rectangle round a block's corner beads: beads don't overlap, and the stagger shows in a block's first and last
 * two lines, so every bead lies within them. */
export function beadsBox(geometry: Pick<WeaveGeometry, 'box'>, { row, column, rows, columns }: Rect, cellWidth: number, cellHeight: number): Box {
  const ends = (first: number, count: number) => [first, Math.min(first + 1, first + count - 1), Math.max(first, first + count - 2), first + count - 1]
  const corners = ends(row, rows).flatMap((r) => ends(column, columns).map((c) => geometry.box({ row: r, column: c }, cellWidth, cellHeight)))
  const x = Math.min(...corners.map((box) => box.x))
  const y = Math.min(...corners.map((box) => box.y))
  return { x, y, width: Math.max(...corners.map((box) => box.x + box.width)) - x, height: Math.max(...corners.map((box) => box.y + box.height)) - y }
}

/** How lines are woven, shared by both kinds of grid: Row progress's passes (tickets 347, 484, 487), lines counted from the
 * Frame's first in weaving order. `twoPasses` is peyote's: the first line in one pass, every later one in two. */
export function linePasses(twoPasses: boolean): WeaveGeometry['passes'] {
  const lineOf = (pass: number): number => (twoPasses && pass > 0 ? Math.ceil(pass / 2) : pass)
  return {
    count: (lines) => (!twoPasses || lines <= 0 ? Math.max(0, lines) : 1 + (lines - 1) * 2),
    of: (line, along) => (!twoPasses || line === 0 ? line : (line - 1) * 2 + 1 + (along % 2)),
    lineOf,
    lines: (pass) => [lineOf(pass)],
  }
}

/** Whether a position lies inside a rectangle; anywhere when there is none. */
export function insideBounds(bounds: Rect | undefined, position: GridPosition): boolean {
  return !bounds || (position.row >= bounds.row && position.row < bounds.row + bounds.rows && position.column >= bounds.column && position.column < bounds.column + bounds.columns)
}

/** Whether a point of a bead's cell, from its top-left, lies outside its rounded corners. A corner can't be rounder
 * than half the shorter side (a pill). */
export function inRoundedCorner(x: number, y: number, wanted: number, width: number, height: number): boolean {
  const radius = Math.min(wanted, width / 2, height / 2)
  if (radius <= 0) {
    return false
  }
  const cornerX = x < radius ? radius : x > width - radius ? width - radius : x
  const cornerY = y < radius ? radius : y > height - radius ? height - radius : y
  return (x - cornerX) ** 2 + (y - cornerY) ** 2 > radius ** 2
}
