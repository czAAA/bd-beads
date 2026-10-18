import type { GridBounds, GridPosition } from "./grid";

/** The weaving method, which determines a Project's grid geometry. */
export type Technique = "loom" | "peyote" | "brick";

/** Every Technique, in the order the choices are listed. */
export const TECHNIQUES: readonly Technique[] = ["loom", "peyote", "brick"];

/** The most rows a Brick block may hold straight on top of each other (ticket 477). */
export const MAX_BRICK_BLOCK = 20;

/** What decides how a Project is laid out: the Technique and, on brick stitch, the Brick block (ticket 477); absent
 * means 1, every other row. A Project is one. */
export interface Weave {
  technique: Technique;
  brickBlock?: number;
}

/** Which way a bead lies in its position. */
type Orientation = "upright" | "sideways";

/** A Technique's own facts. Geometry is in grid units: a bead is 1 wide and 1 tall, a shifted row sits `shift` across. */
interface TechniqueRules {
  /** Every other row (or block of rows) sits half a bead across. */
  shifted: boolean;
  /** Distance from one row's top to the next, in bead heights: peyote rows nest into each other. */
  rowPitch: number;
  /** How much of a bead's width its corners are rounded by. */
  roundness: number;
  /** Whether the Brick block setting applies. */
  hasBrickBlock: boolean;
  /** Whether an open Project can be switched to or from it. */
  switchable: boolean;
  /** Whether Rotate and Rotate Frame are offered. */
  quarterTurn: boolean;
  /** Whether Turn row direction is offered. */
  rowDirection: boolean;
  /** Whether the first line takes one pass and every later one two (peyote: even positions, then odd). */
  twoPasses: boolean;
}

const ROUNDED_BEAD_CORNER = 0.22;
const SHIFT = 0.5;

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
  },
};

/** Everything the app asks about how a Weave is laid out; the only place that tells Techniques apart. */
export interface WeaveDescription extends TechniqueRules {
  /** After how many rows the shift repeats; Frame starts, edges and moves go by multiples of it. */
  frameStep: number;
  /** Whether a position exists in the block (every position does in these Techniques). */
  hasPosition(position: GridPosition): boolean;
  /** How the bead at a position lies. */
  orientationAt(position: GridPosition): Orientation;
  /** A position's size in grid units. */
  extent: { width: number; height: number };
}

/** The Weave's description (ticket 481). */
export function describeWeave(weave: Weave): WeaveDescription {
  const rules = RULES[weave.technique];
  return {
    ...rules,
    frameStep: rules.shifted
      ? 2 * (rules.hasBrickBlock ? (weave.brickBlock ?? 1) : 1)
      : 1,
    hasPosition: () => true,
    orientationAt: () => "upright",
    extent: { width: 1, height: 1 },
  };
}

/** After how many rows the shift repeats: 1 for loom (it never shifts), 2 for peyote, 2N for brick stitch with a Brick
 * block of N. Frame starts, edges and moves go by multiples of it. */
export function rowCycle(weave: Weave): number {
  return describeWeave(weave).frameStep;
}

/** Loom rows stack straight; peyote and brick stitch rows step sideways instead, per ticket 06 — every other row
 * sits half a bead across. */
export function isOffsetTechnique(technique: Technique): boolean {
  return RULES[technique].shifted;
}

/** Whether a row's beads sit half a bead across: the second half of each cycle, whichever side of row 0 it is on. */
export function isShiftedRow(weave: Weave, row: number): boolean {
  const cycle = rowCycle(weave);
  return cycle > 1 && Math.abs(Math.floor((row * 2) / cycle)) % 2 === 1;
}

/** How much of a bead's width its corners are rounded by, per Technique. The one place the look is decided: the
 * Surface view's hit test and the overlay read it too. */
export function beadRoundness(technique: Technique): number {
  return RULES[technique].roundness;
}

// Physical and px geometry both come from the grid units above, scaled by the cell size in the unit asked for.

/** Horizontal offset for a row's cells: loom rows never shift; peyote and brick stitch shift every other row by half
 * a cell so beads interlock instead of stacking in a straight grid. */
export function rowOffset(
  weave: Weave,
  rowIndex: number,
  cellSize: number,
): number {
  return isShiftedRow(weave, rowIndex) ? cellSize * SHIFT : 0;
}

/** Total grid width, including the extra half-cell an offset technique's shifted rows take up. */
export function gridWidth(
  technique: Technique,
  columns: number,
  cellSize: number,
): number {
  return columns * cellSize + (RULES[technique].shifted ? cellSize * SHIFT : 0);
}

/** Vertical distance from one row's top to the next. Peyote rows interlock, packing tighter than a full cell (the
 * real stitch's rows nest into each other); brick stitch stacks rows at full height like coursed brickwork, same as
 * loom. */
export function rowPitch(technique: Technique, cellSize: number): number {
  return cellSize * RULES[technique].rowPitch;
}

/** Total grid height, accounting for peyote's tighter row packing. */
export function gridHeight(
  technique: Technique,
  rows: number,
  cellSize: number,
): number {
  if (rows === 0) {
    return 0;
  }
  return cellSize + (rows - 1) * rowPitch(technique, cellSize);
}

/** A point inside a grid's own footprint, in whatever unit the cell size was given in. */
export interface CellCenter {
  x: number;
  y: number;
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
  };
}

/** Columns in `toRow` whose cells visually overlap `column` of `fromRow`, given each row's horizontal offset. Loom
 * rows share one offset, so only the same column overlaps; offset techniques' rows interlock, so a row's cell
 * overlaps two columns of a differently-offset neighbor. */
function overlappingColumns(
  weave: Weave,
  fromRow: number,
  toRow: number,
  column: number,
): number[] {
  const fromOffset = rowOffset(weave, fromRow, 1);
  const toOffset = rowOffset(weave, toRow, 1);

  if (toOffset > fromOffset) {
    return [column - 1, column];
  }
  if (toOffset < fromOffset) {
    return [column, column + 1];
  }
  return [column];
}

/** The cells adjacent to (row, column) for the Project's grid geometry: same-row left/right plus overlapping cell(s)
 * above/below per the Technique's offset (ticket 06), so fill respects real adjacency. Only positions inside `bounds`
 * come back; with no bounds the canvas is open. */
export function neighborsOf(
  weave: Weave,
  bounds: GridBounds | undefined,
  position: GridPosition,
): GridPosition[] {
  const { row, column } = position;
  const candidates: GridPosition[] = [
    { row, column: column - 1 },
    { row, column: column + 1 },
  ];

  for (const neighborRow of [row - 1, row + 1]) {
    for (const c of overlappingColumns(weave, row, neighborRow, column)) {
      candidates.push({ row: neighborRow, column: c });
    }
  }

  if (!bounds) {
    return candidates;
  }
  const top = bounds.row ?? 0;
  const left = bounds.column ?? 0;
  return candidates.filter(
    (p) =>
      p.row >= top &&
      p.row < top + bounds.rows &&
      p.column >= left &&
      p.column < left + bounds.columns,
  );
}

// Row progress counts passes, not lines (ticket 347); a line is a row or column of the Frame. Loom and brick stitch:
// one pass per line. Peyote: the first line one pass, every later line two (even positions first, then odd).

/** How many passes weaving `lines` lines takes. */
export function passCount(technique: Technique, lines: number): number {
  if (!RULES[technique].twoPasses || lines <= 0) {
    return Math.max(0, lines);
  }
  return 1 + (lines - 1) * 2;
}

/** The pass (zero-based) that weaves the bead at `along` (its position along its line) in line `line`; both counted
 * from the Frame's first. */
export function passOf(
  technique: Technique,
  line: number,
  along: number,
): number {
  if (!RULES[technique].twoPasses || line === 0) {
    return line;
  }
  return (line - 1) * 2 + 1 + (along % 2);
}

/** The line a pass works on: what the rulers number and what the current-line marker sits on. */
export function lineOfPass(technique: Technique, pass: number): number {
  return RULES[technique].twoPasses && pass > 0 ? Math.ceil(pass / 2) : pass;
}
