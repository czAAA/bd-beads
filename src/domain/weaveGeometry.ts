import type { Bead } from './beads'
import type { Rect } from './canvas'
import type { GridDimensions, GridPosition } from './grid'
import type { Selection } from './selection'
import type { BeadCell } from './weave'

// The geometry layer (ADR 0078, ticket 0621): a Technique's entry names its geometry kind with values, and one module
// per kind answers every layout question from them. A new kind is a module and a case in weave.ts's switch.

/** Loom, peyote and brick stitch: beads on rows, every other row (or block of rows) shifted across where `shifted`. */
export interface RowsGeometry {
  kind: 'rows'
  /** Every other row (or block of rows) sits `shift` of a bead across. */
  shifted: boolean
  /** How far a shifted row sits across, in beads. */
  shift: number
  /** Distance from one row's top to the next, in bead heights: peyote rows nest into each other. */
  rowPitch: number
  /** A drawn bead's height over its width. */
  cellAspect: number
  /** How much of a bead's width its corners are rounded by. */
  roundness: number
  /** How lines are woven: one pass each, or the first in one and every later one in two (peyote: even beads, then odd). */
  passes: 'one' | 'twoAfterFirst'
}

/** Right-angle weave (ticket 482): Units of four beads touching at their corners. */
export interface RightAngleGeometry {
  kind: 'rightAngleUnits'
  /** A bead's diameter over its length as drawn (the Bead's real ratio is in mm). */
  aspect: number
  roundness: number
}

/** Netting (ticket 485): beads on the diagonals of a diamond mesh, the diamond's size set by the Net size. */
export interface NetGeometry {
  kind: 'netDiamonds'
  /** How far a strand steps across and down per position, in beads. */
  step: number
  /** A drawn bead's height over its width. */
  cellAspect: number
  roundness: number
}

/** A Technique's geometry: its kind and the values that kind reads. Values and enums only, never expressions. */
export type GeometryRef = RowsGeometry | RightAngleGeometry | NetGeometry

/** The way a pass runs: along the Frame's rows, or down its columns. */
export type PassDirection = 'rows' | 'columns'

/** Which way a bead lies in its position. */
type Orientation = 'upright' | 'sideways'

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

/** The settings a geometry reads, already resolved for the Technique: 1 and the default where they don't apply. */
export interface GeometrySettings {
  brickBlock: number
  netSize: number
}

/** Everything a geometry answers about a Weave's layout, built once per Weave. */
export interface WeaveGeometry {
  /** Every other row (or block of rows) sits `shift` of a bead across. */
  shifted: boolean
  shift: number
  /** Distance from one row's top to the next, in bead heights; a strand's step down in a net. */
  rowPitch: number
  /** A drawn bead's height over its width in px: the Bead's own in a Real cell. */
  cellAspect: number
  /** How much of a bead's width its corners are rounded by, in the Technique's own cell. */
  roundness: number
  /** Whether columns and rows count Units (a square of four beads, a diamond) rather than beads (ticket 482): what a
   * size's unit is called. The domain asks the answers below or the Technique's policy, never this (ticket 0622). */
  countsUnits: boolean
  /** After how many rows the shift repeats; Frame starts, edges and moves go by multiples of it. */
  frameStep: number
  /** Whether a position holds a bead: in Right-angle weave the last column of a Frame's horizontal lines is empty. */
  hasPosition(position: GridPosition, frame?: Rect): boolean
  /** How the bead at a position lies. */
  orientationAt(position: GridPosition): Orientation
  /** The rectangle a position's bead takes, in the unit of the cell size passed (px, or mm of a Bead). */
  box(position: GridPosition, cellWidth: number, cellHeight: number): Box
  /** The size of a block of positions, rows and columns counted in positions. */
  blockExtent(columns: number, rows: number, cellWidth: number, cellHeight: number): { width: number; height: number }
  /** The position whose bead covers a point of the grid, or undefined between beads; only where beads aren't laid on
   * rows (Units). */
  positionAt(x: number, y: number, cellWidth: number, cellHeight: number): GridPosition | undefined
  /** The position whose bead is nearest a point of the grid, gaps included; only where beads aren't laid on rows. */
  nearestPosition(x: number, y: number, cellWidth: number, cellHeight: number): GridPosition
  /** How many rows of positions one step down a Unit takes: 1, 2 where lines alternate, a diamond's half height in a net. */
  rowsPerUnit: number
  /** How many columns of positions one Unit takes across. */
  columnsPerUnit: number
  /** The columns a Frame's left edge and width go by: 1, or a diamond's width in a net, so its edges keep the lattice's phase. */
  columnStep: number
  /** The last column of a Frame that starts on `left` and reaches across to `right`, so it ends on a whole Unit. */
  snapRight(left: number, right: number): number
  /** The rows and columns of positions whose beads can touch a stretch of grid space, a little more than needed; only
   * where beads aren't laid on rows. */
  visible(area: { left: number; right: number; top: number; bottom: number }, cellWidth: number, cellHeight: number): { firstRow: number; lastRow: number; first: number; last: number }
  /** The repeating tile of a Technique that counts Units: its size and the bead boxes it holds, from its top-left. */
  tile(cellWidth: number, cellHeight: number): { size: { width: number; height: number }; beads: Box[] }
  /** Where a Frame's top-left position sits from the grid's top-left, in the unit of the cell size passed. */
  origin(position: GridPosition, cellWidth: number, cellHeight: number): CellCenter
  /** Positions a block of Units takes, and back: the Units a block of positions holds. */
  positionsOf(units: GridDimensions): GridDimensions
  unitsOf(positions: GridDimensions): GridDimensions
  /** The last row of a Frame that starts on `top` and reaches down to `bottom`, so it ends on a whole Unit. */
  snapBottom(top: number, bottom: number): number
  /** The fewest positions a Frame holds across and down: one Unit, or one bead. */
  smallest: GridDimensions
  /** A position's centre from the grid's top-left, in the unit of the cell size passed (px, or mm of a Bead). */
  center(position: GridPosition, cellWidth: number, cellHeight: number): CellCenter
  /** The positions that touch a position, for Fill; only those inside `bounds` when given. */
  neighbors(bounds: Rect | undefined, position: GridPosition): GridPosition[]
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
   * `block` positions (a Selection, or the Frame with its margin); undefined when the bead belongs to no whole Unit of
   * the block (a horizontal bead past its last Unit) or the geometry has no turn. */
  turned(position: GridPosition, block: GridDimensions): GridPosition | undefined
  /** The Selection grown to whole Units (a Technique with none returns it as is): from an even row (a line of
   * horizontal beads) to an even row, at least one Unit each way. `within` keeps a grown Selection that started
   * inside it from leaving it. */
  snapSelection(selection: Selection, within?: Rect): Selection
  /** Where a block of beads, given by its beads' offsets from its top-left, lands when aimed at `topLeft`: nudged so its
   * beads fall on beads of the Weave (a Technique whose positions aren't all beads); as aimed otherwise (ticket 486). */
  fitBlock(topLeft: GridPosition, offsets: GridPosition[]): GridPosition
  /** The physical size, in mm, of one step across and one step down from a Bead. */
  stepMm(bead: Pick<Bead, 'widthMm' | 'widthCorrectionMm' | 'heightMm'>): { across: number; down: number }
}

/** One geometry module: builds a Weave's answers from its kind's values, once. */
export type GeometryStrategy<G extends GeometryRef> = (geometry: G, settings: GeometrySettings, cell: BeadCell | undefined) => WeaveGeometry

/** A value's remainder that is never negative, so lattices repeat the same way above and left of row 0. */
export const modulo = (value: number, by: number): number => ((value % by) + by) % by

/** Whether a position lies inside a rectangle; anywhere when there is none. */
export function insideBounds(bounds: Rect | undefined, position: GridPosition): boolean {
  return !bounds || (position.row >= bounds.row && position.row < bounds.row + bounds.rows && position.column >= bounds.column && position.column < bounds.column + bounds.columns)
}

const inside = (frame: Rect, selection: Selection): boolean =>
  selection.top >= frame.row &&
  selection.left >= frame.column &&
  selection.top + selection.rows <= frame.row + frame.rows &&
  selection.left + selection.columns <= frame.column + frame.columns

/** A grown Selection kept inside `within` when the Selection it grew from started inside it (ticket 483). */
export function keptWithin(box: Selection, from: Selection, within?: Rect): Selection {
  if (!within || !inside(within, from)) {
    return box
  }
  const pastBottom = Math.max(0, box.top + box.rows - (within.row + within.rows))
  const pastRight = Math.max(0, box.left + box.columns - (within.column + within.columns))
  return { ...box, top: box.top - pastBottom, left: box.left - pastRight }
}
