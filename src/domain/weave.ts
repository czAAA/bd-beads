import { beadPitchMm, type Bead } from './beads'
import type { Frame } from './canvas'
import type { GridBounds, GridDimensions, GridPosition } from './grid'

/** The weaving method, which determines a Project's grid geometry. */
export type Technique = 'loom' | 'peyote' | 'brick' | 'rightAngle'

/** Every Technique, in the order the choices are listed. */
export const TECHNIQUES: readonly Technique[] = ['loom', 'peyote', 'brick', 'rightAngle']

/** The most rows a Brick block may hold straight on top of each other (ticket 477). */
export const MAX_BRICK_BLOCK = 20

/** What decides how a Project is laid out: the Technique and, on brick stitch, the Brick block (ticket 477); absent
 * means 1, every other row. A Project is one. */
export interface Weave {
  technique: Technique
  brickBlock?: number
}

/** Which way a bead lies in its position. */
type Orientation = 'upright' | 'sideways'

/** A Technique's own facts. Geometry is in grid units: a bead is 1 wide and 1 tall, a shifted row sits `shift` across. */
interface TechniqueRules {
  /** Every other row (or block of rows) sits half a bead across. */
  shifted: boolean
  /** Distance from one row's top to the next, in bead heights: peyote rows nest into each other. */
  rowPitch: number
  /** How much of a bead's width its corners are rounded by. */
  roundness: number
  /** Whether the Brick block setting applies. */
  hasBrickBlock: boolean
  /** Whether an open Project can be switched to or from it. */
  switchable: boolean
  /** Whether Rotate and Rotate Frame are offered. */
  quarterTurn: boolean
  /** Whether Turn row direction is offered. */
  rowDirection: boolean
  /** Whether the first line takes one pass and every later one two (peyote: even positions, then odd). */
  twoPasses: boolean
  /** Whether columns and rows count Units (a square of four beads) rather than beads (ticket 482). */
  countsUnits: boolean
  /** A drawn bead's height over its width in px, where the Technique draws beads that aren't square. */
  cellAspect: number
}

const ROUNDED_BEAD_CORNER = 0.22
const SHIFT = 0.5
/** A Right-angle weave bead's diameter over its length as drawn (the Bead's real ratio is in mm). */
const RIGHT_ANGLE_ASPECT = 0.7

const RULES: Record<Technique, TechniqueRules> = {
  loom: {
    shifted: false,
    rowPitch: 1,
    roundness: 0,
    hasBrickBlock: false,
    switchable: true,
    quarterTurn: true,
    rowDirection: true,
    twoPasses: false,
    countsUnits: false,
    cellAspect: 1,
  },
  peyote: {
    shifted: true,
    rowPitch: 0.75,
    roundness: ROUNDED_BEAD_CORNER,
    hasBrickBlock: false,
    switchable: true,
    quarterTurn: true,
    rowDirection: true,
    twoPasses: true,
    countsUnits: false,
    cellAspect: 1,
  },
  brick: {
    shifted: true,
    rowPitch: 1,
    roundness: 0,
    hasBrickBlock: true,
    switchable: true,
    quarterTurn: true,
    rowDirection: true,
    twoPasses: false,
    countsUnits: false,
    cellAspect: 1,
  },
  rightAngle: {
    shifted: false,
    rowPitch: 1,
    roundness: ROUNDED_BEAD_CORNER,
    hasBrickBlock: false,
    switchable: false,
    quarterTurn: false,
    rowDirection: true,
    twoPasses: false,
    countsUnits: true,
    cellAspect: RIGHT_ANGLE_ASPECT,
  },
}

/** Everything the app asks about how a Weave is laid out; the only place that tells Techniques apart. */
export interface WeaveDescription extends TechniqueRules {
  /** After how many rows the shift repeats; Frame starts, edges and moves go by multiples of it. */
  frameStep: number
  /** Whether a position holds a bead: in Right-angle weave the last column of a Frame's horizontal lines is empty. */
  hasPosition(position: GridPosition, frame?: Frame): boolean
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
  /** How many rows of positions one step down a Unit takes: 1, or 2 where lines alternate. */
  rowsPerUnit: number
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
  neighbors(bounds: GridBounds | undefined, position: GridPosition): GridPosition[]
  /** Row progress's passes: how many a number of lines takes, which pass weaves a bead, which line a pass works on. */
  passes: {
    count(lines: number): number
    of(line: number, along: number): number
    lineOf(pass: number): number
  }
  /** Where a quarter turn or a mirror sends a position's bead within its block; undefined when a turn isn't offered. */
  turned(position: GridPosition): GridPosition | undefined
  mirrored(position: GridPosition): GridPosition
  /** The physical size, in mm, of one step across and one step down from a Bead. */
  stepMm(bead: Pick<Bead, 'widthMm' | 'widthCorrectionMm' | 'heightMm'>): { across: number; down: number }
}

/** A rectangle in grid space. */
interface Box {
  x: number
  y: number
  width: number
  height: number
}

/** The Weave's description (ticket 481). */
export function describeWeave(weave: Weave): WeaveDescription {
  const rules = RULES[weave.technique]
  if (weave.technique === 'rightAngle') {
    return rightAngleDescription(rules)
  }
  return {
    ...rules,
    frameStep: rules.shifted ? 2 * (rules.hasBrickBlock ? (weave.brickBlock ?? 1) : 1) : 1,
    hasPosition: () => true,
    orientationAt: () => 'upright',
    box: (position, cellWidth, cellHeight) => {
      const { x, y } = cellCenter(weave, position, cellWidth, cellHeight)
      return { x: x - cellWidth / 2, y: y - cellHeight / 2, width: cellWidth, height: cellHeight }
    },
    blockExtent: (columns, rows, cellWidth, cellHeight) => ({
      width: gridWidth(weave.technique, columns, cellWidth),
      height: gridHeight(weave.technique, rows, cellHeight),
    }),
    positionAt: () => undefined,
    nearestPosition: () => ({ row: 0, column: 0 }),
    rowsPerUnit: 1,
    positionsOf: (units) => units,
    unitsOf: (positions) => positions,
    snapBottom: (_top, bottom) => bottom,
    smallest: { columns: 1, rows: 1 },
    center: (position, cellWidth, cellHeight) => cellCenter(weave, position, cellWidth, cellHeight),
    neighbors: (bounds, position) => neighborsOf(weave, bounds, position),
    passes: {
      count: (lines) => passCount(weave.technique, lines),
      of: (line, along) => passOf(weave.technique, line, along),
      lineOf: (pass) => lineOfPass(weave.technique, pass),
    },
    turned: (position) => (rules.quarterTurn ? position : undefined),
    mirrored: (position) => position,
    stepMm: (bead) => ({ across: beadPitchMm(bead), down: rowPitch(weave.technique, bead.heightMm) }),
  }
}

const unitsOf = ({ columns, rows }: GridDimensions): GridDimensions => ({
  columns: Math.max(0, columns - 1),
  rows: Math.max(0, Math.floor((rows - 1) / 2)),
})

const isHorizontalLine = (row: number): boolean => ((row % 2) + 2) % 2 === 0

/** The positions whose beads touch a Right-angle weave bead at their corners (ticket 482): a horizontal bead meets the
 * vertical beads on the lines above and below at its own column and the next, a vertical one the horizontal beads
 * on the lines above and below at its own and the previous. */
function rightAngleNeighbors(bounds: GridBounds | undefined, { row, column }: GridPosition): GridPosition[] {
  const across = isHorizontalLine(row) ? [column, column + 1] : [column - 1, column]
  const candidates = [row - 1, row + 1].flatMap((next) => across.map((c) => ({ row: next, column: c })))
  if (!bounds) {
    return candidates
  }
  const top = bounds.row ?? 0
  const left = bounds.column ?? 0
  return candidates.filter(
    (p) => p.row >= top && p.row < top + bounds.rows && p.column >= left && p.column < left + bounds.columns,
  )
}

/** Right-angle weave (ticket 482): rows alternate between horizontal beads, lying along their line (one per Unit), and
 * upright vertical ones (one more). A Unit's side is a bead's length plus its width: `cellWidth` the length, `cellHeight`
 * the width. Beads touch at their corners, round a hole one length square. */
function rightAngleDescription(rules: TechniqueRules): WeaveDescription {
  const box = (position: GridPosition, length: number, width: number): Box => {
    const side = length + width
    const line = Math.floor(position.row / 2)
    return isHorizontalLine(position.row)
      ? { x: position.column * side + width, y: line * side, width: length, height: width }
      : { x: position.column * side, y: line * side + width, width, height: length }
  }
  return {
    ...rules,
    frameStep: 2,
    hasPosition: (position, frame) =>
      !(
        frame &&
        isHorizontalLine(position.row) &&
        position.row >= frame.row &&
        position.row < frame.row + frame.rows &&
        position.column === frame.column + frame.columns - 1
      ),
    orientationAt: ({ row }) => (isHorizontalLine(row) ? 'sideways' : 'upright'),
    box,
    blockExtent: (columns, rows, length, width) => {
      const side = length + width
      const units = unitsOf({ columns, rows })
      return { width: columns > 0 ? units.columns * side + width : 0, height: rows > 0 ? units.rows * side + width : 0 }
    },
    positionAt: (x, y, length, width) => {
      const side = length + width
      const line = Math.floor(y / side)
      if (y - line * side < width) {
        const across = x - width
        const unit = Math.floor(across / side)
        return across - unit * side < length ? { row: line * 2, column: unit } : undefined
      }
      const column = Math.floor(x / side)
      return x - column * side < width ? { row: line * 2 + 1, column } : undefined
    },
    nearestPosition: (x, y, length, width) => {
      const side = length + width
      const line = Math.floor(y / side)
      const column = Math.floor(x / side)
      let best: { position: GridPosition; distance: number } | undefined
      for (let row = line * 2 - 1; row <= line * 2 + 2; row += 1) {
        for (let c = column - 1; c <= column + 1; c += 1) {
          const { x: left, y: top, width: w, height: h } = box({ row, column: c }, length, width)
          const distance = (x - left - w / 2) ** 2 + (y - top - h / 2) ** 2
          if (!best || distance < best.distance) best = { position: { row, column: c }, distance }
        }
      }
      return best!.position
    },
    rowsPerUnit: 2,
    positionsOf: ({ columns, rows }) => ({ columns: columns + 1, rows: rows * 2 + 1 }),
    unitsOf,
    snapBottom: (top, bottom) => Math.max(top + 2, bottom + (((bottom - top) % 2) + 2) % 2),
    smallest: { columns: 2, rows: 3 },
    center: (position, length, width) => {
      const { x, y, width: w, height: h } = box(position, length, width)
      return { x: x + w / 2, y: y + h / 2 }
    },
    neighbors: (bounds, position) => rightAngleNeighbors(bounds, position),
    passes: {
      count: (lines) => Math.max(0, lines),
      of: (line) => line,
      lineOf: (pass) => pass,
    },
    turned: () => undefined,
    mirrored: (position) => position,
    stepMm: (bead) => ({ across: beadPitchMm(bead) + bead.heightMm, down: beadPitchMm(bead) + bead.heightMm }),
  }
}

/** After how many rows the shift repeats: 1 for loom (it never shifts), 2 for peyote, 2N for brick stitch with a Brick
 * block of N. Frame starts, edges and moves go by multiples of it. */
export function rowCycle(weave: Weave): number {
  return describeWeave(weave).frameStep
}

/** Loom rows stack straight; peyote and brick stitch rows step sideways instead, per ticket 06 — every other row
 * sits half a bead across. */
export function isOffsetTechnique(technique: Technique): boolean {
  return RULES[technique].shifted
}

/** Whether a row's beads sit half a bead across: the second half of each cycle, whichever side of row 0 it is on. */
export function isShiftedRow(weave: Weave, row: number): boolean {
  const cycle = rowCycle(weave)
  return cycle > 1 && Math.abs(Math.floor((row * 2) / cycle)) % 2 === 1
}

/** How much of a bead's width its corners are rounded by, per Technique. The one place the look is decided: the
 * Surface view's hit test and the overlay read it too. */
export function beadRoundness(technique: Technique): number {
  return RULES[technique].roundness
}

// Physical and px geometry both come from the grid units above, scaled by the cell size in the unit asked for.

/** Horizontal offset for a row's cells: loom rows never shift; peyote and brick stitch shift every other row by half
 * a cell so beads interlock instead of stacking in a straight grid. */
export function rowOffset(weave: Weave, rowIndex: number, cellSize: number): number {
  return isShiftedRow(weave, rowIndex) ? cellSize * SHIFT : 0
}

/** Total grid width, including the extra half-cell an offset technique's shifted rows take up. */
export function gridWidth(technique: Technique, columns: number, cellSize: number): number {
  return columns * cellSize + (RULES[technique].shifted ? cellSize * SHIFT : 0)
}

/** Vertical distance from one row's top to the next. Peyote rows interlock, packing tighter than a full cell (the
 * real stitch's rows nest into each other); brick stitch stacks rows at full height like coursed brickwork, same as
 * loom. */
export function rowPitch(technique: Technique, cellSize: number): number {
  return cellSize * RULES[technique].rowPitch
}

/** Total grid height, accounting for peyote's tighter row packing. */
export function gridHeight(technique: Technique, rows: number, cellSize: number): number {
  if (rows === 0) {
    return 0
  }
  return cellSize + (rows - 1) * rowPitch(technique, cellSize)
}

/** A point inside a grid's own footprint, in whatever unit the cell size was given in. */
export interface CellCenter {
  x: number
  y: number
}

/** Where a cell's centre sits from the grid's top-left, in the unit of the cell size passed (real mm for a Bead's
 * footprint, ticket 58, ADR 0010), using the Technique's real shift and row pitch. */
export function cellCenter(
  weave: Weave,
  { row, column }: GridPosition,
  cellWidth: number,
  cellHeight: number,
): CellCenter {
  return {
    x: column * cellWidth + cellWidth / 2 + rowOffset(weave, row, cellWidth),
    y: cellHeight / 2 + row * rowPitch(weave.technique, cellHeight),
  }
}

/** Columns in `toRow` whose cells visually overlap `column` of `fromRow`, given each row's horizontal offset. Loom
 * rows share one offset, so only the same column overlaps; offset techniques' rows interlock, so a row's cell
 * overlaps two columns of a differently-offset neighbor. */
function overlappingColumns(weave: Weave, fromRow: number, toRow: number, column: number): number[] {
  const fromOffset = rowOffset(weave, fromRow, 1)
  const toOffset = rowOffset(weave, toRow, 1)

  if (toOffset > fromOffset) {
    return [column - 1, column]
  }
  if (toOffset < fromOffset) {
    return [column, column + 1]
  }
  return [column]
}

/** The cells adjacent to (row, column) for the Project's grid geometry: same-row left/right plus overlapping cell(s)
 * above/below per the Technique's offset (ticket 06), so fill respects real adjacency. Only positions inside `bounds`
 * come back; with no bounds the canvas is open. */
export function neighborsOf(weave: Weave, bounds: GridBounds | undefined, position: GridPosition): GridPosition[] {
  if (RULES[weave.technique].countsUnits) {
    return rightAngleNeighbors(bounds, position)
  }
  const { row, column } = position
  const candidates: GridPosition[] = [
    { row, column: column - 1 },
    { row, column: column + 1 },
  ]

  for (const neighborRow of [row - 1, row + 1]) {
    for (const c of overlappingColumns(weave, row, neighborRow, column)) {
      candidates.push({ row: neighborRow, column: c })
    }
  }

  if (!bounds) {
    return candidates
  }
  const top = bounds.row ?? 0
  const left = bounds.column ?? 0
  return candidates.filter(
    (p) => p.row >= top && p.row < top + bounds.rows && p.column >= left && p.column < left + bounds.columns,
  )
}

// Row progress counts passes, not lines (ticket 347); a line is a row or column of the Frame. Loom and brick stitch:
// one pass per line. Peyote: the first line one pass, every later line two (even positions first, then odd).

/** How many passes weaving `lines` lines takes. */
export function passCount(technique: Technique, lines: number): number {
  if (!RULES[technique].twoPasses || lines <= 0) {
    return Math.max(0, lines)
  }
  return 1 + (lines - 1) * 2
}

/** The pass (zero-based) that weaves the bead at `along` (its position along its line) in line `line`; both counted
 * from the Frame's first. */
export function passOf(technique: Technique, line: number, along: number): number {
  if (!RULES[technique].twoPasses || line === 0) {
    return line
  }
  return (line - 1) * 2 + 1 + (along % 2)
}

/** The line a pass works on: what the rulers number and what the current-line marker sits on. */
export function lineOfPass(technique: Technique, pass: number): number {
  return RULES[technique].twoPasses && pass > 0 ? Math.ceil(pass / 2) : pass
}
