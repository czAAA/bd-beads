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
  /** How many rows lie straight on each other before the next block of them shifts, where rows shift: 1, every other. */
  block: number
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
  /** The beads in one loop of the mesh, odd: the middle one is shared with the next row. */
  loopBeads: number
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
  /** How far a row's beads sit across from an unshifted row's: its shift where rows shift, 0 everywhere else. */
  rowOffset(row: number, cellWidth: number): number
  /** The size of a block of positions, rows and columns counted in positions. */
  blockExtent(columns: number, rows: number, cellWidth: number, cellHeight: number): { width: number; height: number }
  /** The rectangle a block of positions takes, from the grid's top-left: on rows its rows' lattice, with the room a
   * shifted row takes on the right, whichever rows it holds; elsewhere its beads' box. What a Frame's line goes round. */
  blockBox(block: Rect, cellWidth: number, cellHeight: number): Box
  /** The line between a block's positions and the ones round it (ticket 0623): elsewhere its beads' box; on rows half a
   * row pitch round its first and last rows' middles, its columns a quarter bead right, between a shifted row's cells
   * and an unshifted one's. Where Position marks stop round a Frame's margin. */
  boundary(block: Rect, cellWidth: number, cellHeight: number): Box
  /** The size of what is counted: a bead where beads are counted, a Unit's square or diamond where Units are. */
  unitSize(cellWidth: number, cellHeight: number): { width: number; height: number }
  /** Where a ruler marks a Unit, from its top-left: a bead's centre where beads are counted, the middle of a Unit's
   * step across and down where Units are. */
  unitMiddle(cellWidth: number, cellHeight: number): CellCenter
  /** The position whose bead covers a point of the grid, or undefined between beads. Where beads overlap (rows nest)
   * the one drawn last wins, of the rows and columns of `within` when given (a block from row 0, column 0); where they
   * don't, the bead found is the only one there, and the caller checks it is inside. */
  positionAt(x: number, y: number, cellWidth: number, cellHeight: number, within?: GridDimensions): GridPosition | undefined
  /** The position whose bead is nearest a point of the grid, gaps included. */
  nearestPosition(x: number, y: number, cellWidth: number, cellHeight: number): GridPosition
  /** How many rows of positions one step down a Unit takes: 1, 2 where lines alternate, a diamond's half height in a net. */
  rowsPerUnit: number
  /** How many columns of positions one Unit takes across. */
  columnsPerUnit: number
  /** The columns a Frame's left edge and width go by: 1, or a diamond's width in a net, so its edges keep the lattice's phase. */
  columnStep: number
  /** The last column of a Frame that starts on `left` and reaches across to `right`, so it ends on a whole Unit. */
  snapRight(left: number, right: number): number
  /** The rows of positions whose beads can touch a stretch of grid space, and each row's columns, a little more than
   * needed where beads aren't laid on rows. */
  visible(area: { left: number; right: number; top: number; bottom: number }, cellWidth: number, cellHeight: number): VisiblePositions
  /** The repeating tile of the lattice: its size and the bead boxes it holds, from its top-left. On rows a bead across
   * and a cycle of rows down, at least two. */
  tile(cellWidth: number, cellHeight: number): { size: { width: number; height: number }; beads: Box[] }
  /** Where a Frame's top-left position sits from the grid's top-left, in the unit of the cell size passed: on rows its
   * bead's corner, elsewhere its Unit's. */
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

/** One geometry module: builds a Weave's answers from its kind's values, with its settings' in place, once. */
export type GeometryStrategy<G extends GeometryRef> = (geometry: G, cell: BeadCell | undefined) => WeaveGeometry

/** A value's remainder that is never negative, so lattices repeat the same way above and left of row 0. */
export const modulo = (value: number, by: number): number => ((value % by) + by) % by

/** The rectangle round a block's corner beads (where beads don't nest, every bead lies within them). A line of
 * horizontal beads (Right-angle weave) stops a column short of the block, so its far corner is the one before. */
export function beadsBox(geometry: Pick<WeaveGeometry, 'box' | 'orientationAt'>, { row, column, rows, columns }: Rect, cellWidth: number, cellHeight: number): Box {
  const corners = [row, Math.min(row + 1, row + rows - 1), Math.max(row, row + rows - 2), row + rows - 1].flatMap((r) =>
    [column, column + columns - (geometry.orientationAt({ row: r, column }) === 'sideways' && columns > 1 ? 2 : 1)].map((c) =>
      geometry.box({ row: r, column: c }, cellWidth, cellHeight),
    ),
  )
  const x = Math.min(...corners.map((box) => box.x))
  const y = Math.min(...corners.map((box) => box.y))
  return { x, y, width: Math.max(...corners.map((box) => box.x + box.width)) - x, height: Math.max(...corners.map((box) => box.y + box.height)) - y }
}

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
