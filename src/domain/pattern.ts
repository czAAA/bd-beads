import { findBead } from './beads'
import { computeGridDimensions, toMillimeters, type SizeUnit } from './grid'

/** The weaving method, which determines a Pattern's grid geometry. Only 'loom' is supported so far. */
export type Technique = 'loom'

export interface Cell {
  color: string | null
}

export interface Pattern {
  id: string
  technique: Technique
  beadId: string
  widthMm: number
  heightMm: number
  columns: number
  rows: number
  grid: Cell[][]
  createdAt: number
  updatedAt: number
}

export interface CreatePatternInput {
  technique: Technique
  beadId: string
  size: { width: number; height: number; unit: SizeUnit }
}

function createEmptyGrid(columns: number, rows: number): Cell[][] {
  return Array.from({ length: rows }, () =>
    Array.from({ length: columns }, () => ({ color: null })),
  )
}

export function createPattern(input: CreatePatternInput): Pattern {
  const bead = findBead(input.beadId)
  if (!bead) {
    throw new Error(`Unknown bead id: ${input.beadId}`)
  }

  const widthMm = toMillimeters(input.size.width, input.size.unit)
  const heightMm = toMillimeters(input.size.height, input.size.unit)
  const { columns, rows } = computeGridDimensions({ widthMm, heightMm }, bead)
  const now = Date.now()

  return {
    id: crypto.randomUUID(),
    technique: input.technique,
    beadId: input.beadId,
    widthMm,
    heightMm,
    columns,
    rows,
    grid: createEmptyGrid(columns, rows),
    createdAt: now,
    updatedAt: now,
  }
}
