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

export interface FitZoomInput extends GridDimensions {
  maxWidth: number
  maxHeight: number
  cellSize?: number
  technique?: Technique
}

/** Largest zoom that fits the whole grid within maxWidth x maxHeight, capped at 100% (never zooms in). */
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
  return Math.min(1, maxWidth / gridWidth, maxHeight / gridHeight)
}
