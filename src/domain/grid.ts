import type { Bead } from './beads'

export type SizeUnit = 'mm' | 'cm'

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

export interface FitZoomInput extends GridDimensions {
  maxWidth: number
  maxHeight: number
  cellSize?: number
}

/** Largest zoom that fits the whole grid within maxWidth x maxHeight, capped at 100% (never zooms in). */
export function computeFitZoom({ columns, rows, maxWidth, maxHeight, cellSize = CELL_SIZE_PX }: FitZoomInput): number {
  const gridWidth = columns * cellSize
  const gridHeight = rows * cellSize
  return Math.min(1, maxWidth / gridWidth, maxHeight / gridHeight)
}
