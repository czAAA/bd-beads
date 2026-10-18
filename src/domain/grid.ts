import { beadPitchMm, type Bead } from './beads'

/** A real-world length unit. */
export type PhysicalUnit = 'mm' | 'cm'

/** What a New Project's size can be stated in: a count of beads, or a real-world length converted to beads once (ADR
 * 0026). */
export type SizeUnit = 'beads' | PhysicalUnit

/** The weaving method, which determines a Project's grid geometry. */
export type Technique = 'loom' | 'peyote' | 'brick'

/** Every Technique, in the order the choices are listed. */
export const TECHNIQUES: readonly Technique[] = ['loom', 'peyote', 'brick']

/** Loom rows stack straight; peyote and brick stitch rows step sideways instead, per ticket 06 — every other row
 * sits half a bead across. */
export function isOffsetTechnique(technique: Technique): boolean {
  return technique !== 'loom'
}

/** The most rows a Brick block may hold straight on top of each other (ticket 477). */
export const MAX_BRICK_BLOCK = 20

/** What decides which rows sit shifted: the Technique and, on brick stitch, the Brick block (ticket 477); absent
 * means 1, every other row. A Project is one. */
export interface Weave {
  technique: Technique
  brickBlock?: number
}

/** After how many rows the shift repeats: 1 for loom (it never shifts), 2 for peyote, 2N for brick stitch with a Brick
 * block of N. Frame starts, edges and moves go by multiples of it. */
export function rowCycle({ technique, brickBlock }: Weave): number {
  if (technique === 'loom') {
    return 1
  }
  return technique === 'brick' ? 2 * (brickBlock ?? 1) : 2
}

/** Whether a row's beads sit half a bead across: the second half of each cycle, whichever side of row 0 it is on. */
export function isShiftedRow(weave: Weave, row: number): boolean {
  const cycle = rowCycle(weave)
  return cycle > 1 && Math.abs(Math.floor((row * 2) / cycle)) % 2 === 1
}

// A view-only quarter-turn (ticket 171, extending ticket 28): clockwise degrees. Purely cosmetic, like
// Project.rotation: the grid never turns, only its on-screen (and printed/exported) presentation.
export type Rotation = 0 | 90 | 180 | 270

/** The next quarter-turn clockwise, wrapping from 270° back to 0° (Rotate: ticket 171). */
export function nextRotation(rotation: Rotation): Rotation {
  return ((rotation + 90) % 360) as Rotation
}

// Whether this rotation swaps which grid axis runs across the screen: true for a quarter turn either way (90°/270°),
// false for 0°/180°. The rule every on-screen axis mapping shares (Estimated size, Row direction, Mirror, the Frame's
// Width and Height).
export function rotationSwapsAxes(rotation: Rotation): boolean {
  return rotation === 90 || rotation === 270
}

export interface PhysicalSizeMm {
  widthMm: number
  heightMm: number
}

export interface GridDimensions {
  columns: number
  rows: number
}

/** A rectangle of positions: dimensions, and — for a Frame on a Canvas — where its top-left bead sits (0, 0 when
 * left out). */
export interface GridBounds extends GridDimensions {
  row?: number
  column?: number
}

export function toMillimeters(value: number, unit: PhysicalUnit): number {
  return unit === 'cm' ? value * 10 : value
}

/** Whole beads for a length: always rounded up (ticket 342), so the piece is never smaller than asked; float noise
 * on an exact multiple is not a bead. */
function beadsFor(lengthMm: number, beadMm: number): number {
  return Math.max(1, Math.ceil(lengthMm / beadMm - 1e-9))
}

/** The grid a real-world size needs, a typed mm value always rounding up to the next whole bead (ticket 342). */
export function computeGridDimensions(size: PhysicalSizeMm, bead: Bead): GridDimensions {
  const columns = beadsFor(size.widthMm, beadPitchMm(bead))
  const rows = beadsFor(size.heightMm, bead.heightMm)
  return { columns, rows }
}

// The canvas box's largest on-screen size (ticket 16); it only grows to this, so a smaller Project gets a box its own
// shape (ticket 18). Raised from 480 (editing tools left the left panel, ADR 0021), then from 640, which opened
// ordinary Projects (a few dozen columns/rows) zoomed below 100%. Bigger Projects open fit-to-box.
export const CANVAS_MAX_PX = 900

// Physical geometry (ADR 0010, amended): the real piece, in whatever unit the bead size is given (millimetres for a
// Bead's own footprint). Brick rows sit one bead apart with no gap, as drawn.

/** Horizontal offset for a row's cells: loom rows never shift; peyote and brick stitch shift every other row by half
 * a cell so beads interlock instead of stacking in a straight grid. */
export function rowOffset(weave: Weave, rowIndex: number, cellSize: number): number {
  return isShiftedRow(weave, rowIndex) ? cellSize / 2 : 0
}

/** Total grid width, including the extra half-cell an offset technique's shifted rows take up. */
export function gridWidth(technique: Technique, columns: number, cellSize: number): number {
  return columns * cellSize + (isOffsetTechnique(technique) ? cellSize / 2 : 0)
}

/** Vertical distance from one row's top to the next. Peyote rows interlock, packing tighter than a full cell (the
 * real stitch's rows nest into each other); brick stitch stacks rows at full height like coursed brickwork, same as
 * loom. */
export function rowPitch(technique: Technique, cellSize: number): number {
  return technique === 'peyote' ? cellSize * 0.75 : cellSize
}

/** Total grid height, accounting for peyote's tighter row packing. */
export function gridHeight(technique: Technique, rows: number, cellSize: number): number {
  if (rows === 0) {
    return 0
  }
  return cellSize + (rows - 1) * rowPitch(technique, cellSize)
}

export interface GridPosition {
  row: number
  column: number
}

/** A point inside a grid's own footprint, in whatever unit the cell size was given in. */
export interface CellCenter {
  x: number
  y: number
}

// Where a cell's centre sits from the grid's top-left, in the unit of the cell size passed (real mm for a Bead's
// footprint, ticket 58, ADR 0010). Uses the Technique's real geometry: odd peyote/brick rows shift half a cell
// (rowOffset), peyote rows pack tighter (rowPitch). The last row's centre is half a cell above gridHeight.
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

// A cell to show a hover preview on (ticket 23). `color` overrides the single preview color for this cell, making the
// preview multi-color for a pasted block (ticket 31); without it the cell takes the preview's color.
export interface PreviewCell extends GridPosition {
  color?: string
}

/** A stable string key for a grid position, for deduping/indexing positions in a Set or Map. */
export function positionKey(position: GridPosition): string {
  return `${position.row},${position.column}`
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
export function neighborsOf(
  weave: Weave,
  bounds: GridBounds | undefined,
  position: GridPosition,
): GridPosition[] {
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

/** The Zoom floor (ADR 0033): the same on every screen. */
export const MIN_ZOOM = 0.1
export const MAX_ZOOM = 4
const ZOOM_STEP = 0.1
/** The Zoom range as the whole percents the level label and the buttons' disabled states compare against. */
export const MIN_ZOOM_PERCENT = Math.round(MIN_ZOOM * 100)
export const MAX_ZOOM_PERCENT = Math.round(MAX_ZOOM * 100)

// The next button step from a zoom: the next whole multiple of ZOOM_STEP (10%) above or below, so buttons walk 10, 20,
// 30 ... from wherever a fit, wheel or pinch left the level (43% goes to 50% in, 40% out); a level on a rung moves one
// rung.
export function stepZoom(zoom: number, direction: 1 | -1): number {
  const stepPercent = Math.round(ZOOM_STEP * 100)
  const percent = Math.round(zoom * 100)
  const nextPercent = direction === 1 ? (Math.floor(percent / stepPercent) + 1) * stepPercent : (Math.ceil(percent / stepPercent) - 1) * stepPercent
  return clampZoom(nextPercent / 100)
}

/** Keeps a zoom inside the usable range (MIN_ZOOM to MAX_ZOOM), at whole-percent precision so the displayed level
 * and the applied scale agree. */
export function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(value * 100) / 100))
}
