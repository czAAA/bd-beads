import type { Bead } from './beads'

export type SizeUnit = 'mm' | 'cm'

/** The weaving method, which determines a Pattern's grid geometry. */
export type Technique = 'loom' | 'peyote' | 'brick'

/** Loom rows stack straight; peyote and brick stitch rows step sideways instead, per ticket 06. */
function isOffsetTechnique(technique: Technique): boolean {
  return technique !== 'loom'
}

export interface PhysicalSizeMm {
  widthMm: number
  heightMm: number
}

export interface GridDimensions {
  columns: number
  rows: number
}

export function toMillimeters(value: number, unit: SizeUnit): number {
  return unit === 'cm' ? value * 10 : value
}

export function computeGridDimensions(size: PhysicalSizeMm, bead: Bead): GridDimensions {
  const columns = Math.max(1, Math.round(size.widthMm / bead.widthMm))
  const rows = Math.max(1, Math.round(size.heightMm / bead.heightMm))
  return { columns, rows }
}

/** The pixel size a pattern cell renders at (PatternGrid.vue reads this directly), so fit-zoom math lines up with the real grid. */
export const CELL_SIZE_PX = 20

/**
 * The pattern grid's bold outline in unscaled px — mirrors `--border-width` in style.css. It sits outside the
 * cells, so the canvas box has to make room for it or the right and bottom edges get clipped (ticket 18).
 */
export const GRID_BORDER_PX = 3

/** Width of each ruler gutter (ticket 19). Rendered at a fixed screen size, so it does not scale with the zoom. */
export const RULER_GUTTER_PX = 28

/**
 * The canvas box's largest on-screen size (ticket 16). The box only grows to this: a Pattern that needs less gets a
 * box its own shape rather than empty bands inside a fixed square (ticket 18).
 */
export const CANVAS_MAX_PX = 480

/** Horizontal offset (px) for a row's cells: loom rows never shift; peyote and brick stitch shift every other row by half a cell so beads interlock instead of stacking in a straight grid. */
export function rowOffsetPx(technique: Technique, rowIndex: number, cellSize = CELL_SIZE_PX): number {
  return isOffsetTechnique(technique) && rowIndex % 2 === 1 ? cellSize / 2 : 0
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

/** The cells adjacent to (row, column) given the Pattern's grid geometry: same-row left/right, plus the row above/below's overlapping cell(s) per the Technique's offset (ticket 06). Used by the fill tool so it respects each Technique's real adjacency instead of assuming a straight grid. */
export function neighborsOf(
  technique: Technique,
  dimensions: GridDimensions,
  position: GridPosition,
): GridPosition[] {
  const { row, column } = position
  const candidates: GridPosition[] = [
    { row, column: column - 1 },
    { row, column: column + 1 },
  ]

  if (row > 0) {
    for (const c of overlappingColumns(technique, row, row - 1, column)) {
      candidates.push({ row: row - 1, column: c })
    }
  }
  if (row < dimensions.rows - 1) {
    for (const c of overlappingColumns(technique, row, row + 1, column)) {
      candidates.push({ row: row + 1, column: c })
    }
  }

  return candidates.filter((p) => p.column >= 0 && p.column < dimensions.columns)
}

export const MIN_ZOOM = 0.25
export const MAX_ZOOM = 3
export const ZOOM_STEP = 0.25

/** Keeps a zoom inside the usable range, at whole-percent precision so the displayed level and the applied scale agree. */
export function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(value * 100) / 100))
}

/** Total width of the canvas box's content: the zoomed grid (outline included) flanked by two fixed-size ruler gutters. */
export function canvasContentWidthPx(
  technique: Technique,
  columns: number,
  zoom: number,
  cellSize = CELL_SIZE_PX,
): number {
  return RULER_GUTTER_PX * 2 + (gridWidthPx(technique, columns, cellSize) + GRID_BORDER_PX * 2) * zoom
}

/** Total height of the canvas box's content; see canvasContentWidthPx. */
export function canvasContentHeightPx(
  technique: Technique,
  rows: number,
  zoom: number,
  cellSize = CELL_SIZE_PX,
): number {
  return RULER_GUTTER_PX * 2 + (gridHeightPx(technique, rows, cellSize) + GRID_BORDER_PX * 2) * zoom
}

/** 1, 2, 5, 10, 20, 50, ... — the 1-2-5 sequence a physical ruler thins out along. */
function* labelSteps(): Generator<number> {
  for (let magnitude = 1; ; magnitude *= 10) {
    yield* [magnitude, magnitude * 2, magnitude * 5]
  }
}

/**
 * How many rows (or columns) apart ruler labels have to be so they stay legible instead of colliding: the smallest
 * 1-2-5 step whose on-screen gap clears minLabelPx. Zooming out thins the ruler rather than letting it turn to clutter
 * (ticket 19).
 */
export function rulerLabelStep(spacingPx: number, zoom: number, minLabelPx: number): number {
  for (const step of labelSteps()) {
    if (step * spacingPx * zoom >= minLabelPx) {
      return step
    }
  }
  /* c8 ignore next -- labelSteps() grows without bound, so the loop always returns. */
  return 1
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
