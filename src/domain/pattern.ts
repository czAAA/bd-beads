import { beadLabel, findBead } from './beads'
import { computeGridDimensions, toMillimeters, type SizeUnit, type Technique } from './grid'

export type { Technique } from './grid'

export interface Cell {
  color: string | null
}

export interface Pattern {
  id: string
  name: string
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
  /** User-chosen name; blank or omitted defaults to the bead's label. */
  name?: string
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
  const name = input.name?.trim() || beadLabel(bead)

  return {
    id: crypto.randomUUID(),
    name,
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

/** A short, language-neutral identifier for a Pattern in UI lists (names are proper nouns, not translated). */
export function summarizePattern(pattern: Pattern): string {
  return `${pattern.name} · ${pattern.columns}×${pattern.rows}`
}

export function mostRecentlyUpdated(patterns: Pattern[]): Pattern | undefined {
  return patterns.reduce<Pattern | undefined>(
    (latest, pattern) => (!latest || pattern.updatedAt > latest.updatedAt ? pattern : latest),
    undefined,
  )
}
