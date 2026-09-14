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
