import { beadPitchMm, type Bead } from './beads'

/** A real-world length unit. */
export type PhysicalUnit = 'mm' | 'cm'

/** What a New Pattern's size can be stated in: a count of beads, or a real-world length converted to beads once (ADR 0017). */
export type SizeUnit = 'beads' | PhysicalUnit

/** The weaving method, which determines a Pattern's grid geometry. */
export type Technique = 'loom' | 'peyote' | 'brick'

/** Loom rows stack straight; peyote and brick stitch rows step sideways instead, per ticket 06 — every other row sits half a bead across. */
export function isOffsetTechnique(technique: Technique): boolean {
  return technique !== 'loom'
}

/**
 * A view-only quarter-turn (ticket 171, extending ticket 28's 0°/90° to all four): clockwise, in degrees. Purely
 * cosmetic, like Pattern.rotation itself — the grid never turns, only its on-screen (and printed/exported)
 * presentation.
 */
export type Rotation = 0 | 90 | 180 | 270

/** The next quarter-turn clockwise, wrapping from 270° back to 0° (Rotate: ticket 171). */
export function nextRotation(rotation: Rotation): Rotation {
  return ((rotation + 90) % 360) as Rotation
}

/**
 * Whether this rotation swaps which grid axis (columns or rows) runs across the screen versus down it: true a quarter
 * turn either way (90°/270°), false upright or upside down (0°/180°) — the rule every "which axis is which on screen"
 * mapping in the app shares (Estimated size, Row direction, Mirror's left-right/top-bottom, the Frame's Columns and Rows).
 */
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

/** A rectangle of positions: dimensions, and — for a Frame on an Open canvas — where its top-left bead sits (0, 0 when left out). */
export interface GridBounds extends GridDimensions {
  row?: number
  column?: number
}

export function toMillimeters(value: number, unit: PhysicalUnit): number {
  return unit === 'cm' ? value * 10 : value
}

export function computeGridDimensions(size: PhysicalSizeMm, bead: Bead): GridDimensions {
  const columns = Math.max(1, Math.round(size.widthMm / beadPitchMm(bead)))
  const rows = Math.max(1, Math.round(size.heightMm / bead.heightMm))
  return { columns, rows }
}

/** The pixel size a bead is drawn at, at zoom 1 (the Pattern renderer's own size), so fit-zoom math lines up with what is drawn. */
export const CELL_SIZE_PX = 20

/**
 * The canvas box's largest on-screen size (ticket 16). The box only grows to this: a Pattern that needs less gets a
 * box its own shape rather than empty bands inside a fixed square (ticket 18). Raised twice from the original 480:
 * once when the editing tools left the left panel (ADR 0005) and the canvas became what reclaims that width, and
 * again here because 640 was still forcing ordinary-sized Patterns (a few dozen columns/rows) to open zoomed below
 * 100% for no reason — the box simply wasn't big enough to show them at their natural 1:1 bead size. 900 covers a
 * Pattern well past 40x40 cells at 100% zoom while staying inside a typical laptop viewport once the header take
 * their share; a Pattern past that still opens fit-to-box and zooms/scrolls from there as designed.
 */
export const CANVAS_MAX_PX = 900

/** Horizontal offset (px) for a row's cells: loom rows never shift; peyote and brick stitch shift every other row by half a cell so beads interlock instead of stacking in a straight grid. */
export function rowOffsetPx(technique: Technique, rowIndex: number, cellSize = CELL_SIZE_PX): number {
  return isOffsetTechnique(technique) && Math.abs(rowIndex % 2) === 1 ? cellSize / 2 : 0
}

/** Total rendered grid width in px, including the extra half-cell an offset technique's shifted rows take up. */
export function gridWidthPx(technique: Technique, columns: number, cellSize = CELL_SIZE_PX): number {
  return columns * cellSize + (isOffsetTechnique(technique) ? cellSize / 2 : 0)
}

/** Vertical distance (px) from one row's top to the next. Peyote rows interlock, packing tighter than a full cell (the real stitch's rows nest into each other); brick stitch stacks rows at full height like coursed brickwork, same as loom. */
export function rowHeightPx(technique: Technique, cellSize = CELL_SIZE_PX): number {
  return technique === 'peyote' ? cellSize * 0.75 : cellSize
}

/** Total rendered grid height in px, accounting for peyote's tighter row packing. */
export function gridHeightPx(technique: Technique, rows: number, cellSize = CELL_SIZE_PX): number {
  if (rows === 0) {
    return 0
  }
  return cellSize + (rows - 1) * rowHeightPx(technique, cellSize)
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

/**
 * Where a cell's centre sits inside the grid's own footprint, measured from its top-left corner in the same unit as
 * the cell size passed in — screen px at CELL_SIZE_PX, or real millimetres when called with a Bead's own footprint
 * (`beadPitchMm(bead)`/`bead.heightMm`), which is what Convert image samples a picture at (ticket 58, ADR 0010).
 *
 * This is the Technique's real geometry rather than a plain rectangle: peyote's and brick stitch's odd rows are
 * shifted half a cell sideways (rowOffsetPx) and peyote's rows are packed tighter than a full cell (rowHeightPx), so
 * a picture sampled through this reproduces the stagger and packing the finished piece will actually have instead of
 * shearing and squashing it invisibly. The two axes take their own cell size, so a non-square footprint like Delica's
 * 1.6 × 1.3mm doesn't distort either.
 *
 * Accumulates exactly the way gridWidthPx/gridHeightPx do: the last row's centre lands half a cell above the height
 * gridHeightPx reports, and a row's last cell half a cell inside gridWidthPx's width — less that row's own stagger,
 * since gridWidthPx's extra half cell is there for the shifted rows.
 */
export function cellCenter(
  technique: Technique,
  { row, column }: GridPosition,
  cellWidth: number,
  cellHeight: number,
): CellCenter {
  return {
    x: column * cellWidth + cellWidth / 2 + rowOffsetPx(technique, row, cellWidth),
    y: cellHeight / 2 + row * rowHeightPx(technique, cellHeight),
  }
}

/**
 * A cell to show a hover preview on (ticket 23). `color` overrides the single preview color for this one cell,
 * which is what turns the preview multi-color for a pasted block (ticket 31); without it the cell takes whatever
 * color the preview as a whole is showing.
 */
export interface PreviewCell extends GridPosition {
  color?: string
}

/** A stable string key for a grid position, for deduping/indexing positions in a Set or Map. */
export function positionKey(position: GridPosition): string {
  return `${position.row},${position.column}`
}

/** Columns in `toRow` whose cells visually overlap `column` of `fromRow`, given each row's horizontal offset. Loom rows share one offset, so only the same column overlaps; offset techniques' rows interlock, so a row's cell overlaps two columns of a differently-offset neighbor. */
function overlappingColumns(technique: Technique, fromRow: number, toRow: number, column: number): number[] {
  const fromOffset = rowOffsetPx(technique, fromRow, 1)
  const toOffset = rowOffsetPx(technique, toRow, 1)

  if (toOffset > fromOffset) {
    return [column - 1, column]
  }
  if (toOffset < fromOffset) {
    return [column, column + 1]
  }
  return [column]
}

/** The cells adjacent to (row, column) given the Pattern's grid geometry: same-row left/right, plus the row above/below's overlapping cell(s) per the Technique's offset (ticket 06). Used by the fill tool so it respects each Technique's real adjacency instead of assuming a straight grid. Only positions inside `bounds` come back; with no bounds the canvas is open and every neighbour does. */
export function neighborsOf(
  technique: Technique,
  bounds: GridBounds | undefined,
  position: GridPosition,
): GridPosition[] {
  const { row, column } = position
  const candidates: GridPosition[] = [
    { row, column: column - 1 },
    { row, column: column + 1 },
  ]

  for (const neighborRow of [row - 1, row + 1]) {
    for (const c of overlappingColumns(technique, row, neighborRow, column)) {
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

export const MIN_ZOOM = 0.5
export const MAX_ZOOM = 3
export const ZOOM_STEP = 0.25

/** The phone tier ends here (responsive.md, `bp-tablet`): under it the smallest bead is `bead-min-phone`, from it up `bead-min-tablet` and wider. */
export const PHONE_MAX_WIDTH_PX = 743

/**
 * The zoom-out floor for a smallest bead width (ticket 223; `bead-min-*` tokens): the zoom at which a bead is drawn
 * that wide. Never below MIN_ZOOM.
 */
export function zoomFloorFor(beadMinPx: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.ceil((beadMinPx / CELL_SIZE_PX) * 100) / 100))
}

/** Keeps a zoom inside the usable range (from `min` up, MIN_ZOOM by default), at whole-percent precision so the displayed level and the applied scale agree. */
export function clampZoom(value: number, min = MIN_ZOOM): number {
  return Math.min(MAX_ZOOM, Math.max(min, Math.round(value * 100) / 100))
}

export interface FitZoomInput extends GridDimensions {
  maxWidth: number
  maxHeight: number
  cellSize?: number
  technique?: Technique
}

/**
 * Largest zoom that fits the whole grid within maxWidth x maxHeight, capped at 100% (never zooms in). Rounded down
 * to a whole percent, so the level shown to the user is the level applied and the grid still fits at it.
 */
export function computeFitZoom({
  columns,
  rows,
  maxWidth,
  maxHeight,
  cellSize = CELL_SIZE_PX,
  technique = 'loom',
}: FitZoomInput): number {
  const gridWidth = gridWidthPx(technique, columns, cellSize)
  const gridHeight = gridHeightPx(technique, rows, cellSize)
  return Math.floor(Math.min(1, maxWidth / gridWidth, maxHeight / gridHeight) * 100) / 100
}
