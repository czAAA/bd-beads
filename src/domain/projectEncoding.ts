import { forEachBead, hasBeads, type BeadMap, type FrameSheet } from './canvas'
import type { Grid, GridProject, Project } from './project'
import type { VersionThreeProject } from './versionThree'

// The compact form a Project's beads are stored in (ADR 0009, ADR 0026): a per-Project color table plus, per row with a
// bead, its first column and runs of table indexes. Not indexes into the Palette (a bead may hold any hex): it
// describes the beads as they stand now.
interface EncodedBeads {
  /** Every distinct hex on the canvas, in the order the beads first use it. */
  colors: string[]
  /** Per row with a bead, keyed by row: `"<first column>:<runs>"`, runs as color-table indexes (`"3"`, `"3x40"`; 0
   * is a gap). */
  rows: Record<string, string>
}

/** The Frame as stored (ADR 0066): its place and size, its name, and its own beads in the same compact form, counted
 * from the Frame's first row and column; its Folded beads beside them, where it has any (file version 10, ticket 0638). */
type EncodedFrame = Omit<FrameSheet, 'beads' | 'folded'> & { encodedBeads: EncodedBeads; encodedFolded?: EncodedBeads }

/** A Project as file and library version 4 store it: the Canvas's beads, and the Frame with its own. */
export type EncodedProject = Omit<Project, 'beads' | 'frame'> & { encodedBeads: EncodedBeads; frame?: EncodedFrame }

/** A Project as version 3 stored it (temporary, see versionThree.ts): all the beads together, the Frame a bare
 * rectangle, the beads it covered beside them. */
export type EncodedVersionThreeProject = Omit<VersionThreeProject, 'beads' | 'coveredBeads'> & {
  encodedBeads: EncodedBeads
  encodedCoveredBeads?: EncodedBeads
}

/** A Project as stored before the Canvas (ADR 0009's original shape): `columns` × `rows` cells as row-major runs.
 * Read only. */
interface EncodedCells {
  colors: string[]
  runs: string
}
export type EncodedGridProject = Omit<GridProject, 'grid'> & { cells: EncodedCells }

/** The run index for an empty position. Real colors start at 1, so `colors` holds no placeholder for "nothing". */
const EMPTY_INDEX = 0

const RUN_SEPARATOR = ','
/** Separates a run's index from its length; absent for a run of one bead, which is the common case on a busy row. */
const LENGTH_MARKER = 'x'
const START_SEPARATOR = ':'

function encodeBeads(beads: BeadMap): EncodedBeads {
  const colors: string[] = []
  const slotByColor = new Map<string, number>()
  const rows: Record<string, string> = {}

  /** This color's run index, adding it to the table if it's new. One-based, since EMPTY_INDEX has claimed zero. */
  function slotFor(color: string): number {
    const known = slotByColor.get(color)
    if (known !== undefined) {
      return known
    }
    colors.push(color)
    const slot = colors.length
    slotByColor.set(color, slot)
    return slot
  }

  let currentRow: number | undefined
  let firstColumn = 0
  let nextColumn = 0
  let runs: string[] = []
  let runIndex = EMPTY_INDEX
  let runLength = 0

  function closeRun(): void {
    if (runLength > 0) {
      runs.push(runLength === 1 ? String(runIndex) : `${runIndex}${LENGTH_MARKER}${runLength}`)
    }
    runLength = 0
  }

  function push(index: number, count: number): void {
    if (index === runIndex && runLength > 0) {
      runLength += count
      return
    }
    closeRun()
    runIndex = index
    runLength = count
  }

  function closeRow(): void {
    if (currentRow !== undefined) {
      closeRun()
      rows[String(currentRow)] = `${firstColumn}${START_SEPARATOR}${runs.join(RUN_SEPARATOR)}`
    }
  }

  forEachBead(beads, (row, column, color) => {
    if (row !== currentRow) {
      closeRow()
      currentRow = row
      firstColumn = column
      nextColumn = column
      runs = []
      runLength = 0
    }
    if (column > nextColumn) {
      push(EMPTY_INDEX, column - nextColumn)
    }
    push(slotFor(color), 1)
    nextColumn = column + 1
  })
  closeRow()

  return { colors, rows }
}

/** The color-table index of each position a stored run list covers, in order. A run that is not a number reads as
 * empty. */
function expandRuns(runs: string): number[] {
  const indexes: number[] = []
  if (runs === '') {
    return indexes
  }
  for (const run of runs.split(RUN_SEPARATOR)) {
    const marker = run.indexOf(LENGTH_MARKER)
    const index = Number(marker === -1 ? run : run.slice(0, marker))
    const length = marker === -1 ? 1 : Number(run.slice(marker + 1))
    for (let repeat = 0; repeat < length; repeat += 1) {
      indexes.push(Number.isFinite(index) ? index : EMPTY_INDEX)
    }
  }
  return indexes
}

function decodeBeads({ colors, rows }: EncodedBeads): BeadMap {
  const beads: BeadMap = {}
  for (const [rowKey, entry] of Object.entries(rows)) {
    const split = entry.indexOf(START_SEPARATOR)
    const firstColumn = Number(entry.slice(0, split))
    expandRuns(entry.slice(split + 1)).forEach((index, offset) => {
      const color = index === EMPTY_INDEX ? undefined : colors[index - 1]
      if (color !== undefined) {
        const row = Number(rowKey)
        beads[row] ??= {}
        beads[row][firstColumn + offset] = color
      }
    })
  }
  return beads
}

/** Expands the original compact cells to `rows` × `columns`; runs that don't add up still yield a usable grid. */
function decodeCells({ colors, runs }: EncodedCells, columns: number, rows: number): Grid {
  const flat = expandRuns(runs).map((index) => (index === EMPTY_INDEX ? null : (colors[index - 1] ?? null)))
  return Array.from({ length: rows }, (_row, row) =>
    Array.from({ length: columns }, (_cell, column) => ({ color: flat[row * columns + column] ?? null })),
  )
}

function encodeFrame({ beads, folded, ...place }: FrameSheet): EncodedFrame {
  return { ...place, encodedBeads: encodeBeads(beads), ...(folded ? { encodedFolded: encodeBeads(folded) } : {}) }
}

function decodeFrame({ encodedBeads, encodedFolded, ...place }: EncodedFrame): FrameSheet {
  const folded = encodedFolded && decodeBeads(encodedFolded)
  return { ...place, beads: decodeBeads(encodedBeads), ...(folded && hasBeads(folded) ? { folded } : {}) }
}

export function encodeProject(project: Project): EncodedProject {
  const { beads, frame, ...rest } = project
  return { ...rest, encodedBeads: encodeBeads(beads), ...(frame ? { frame: encodeFrame(frame) } : {}) }
}

/** The Project a version 4 value holds; it still goes through normalizeProject. */
export function decodeProject(encoded: EncodedProject): Project {
  const { encodedBeads, frame, ...rest } = encoded
  return { ...rest, beads: decodeBeads(encodedBeads), ...(frame ? { frame: decodeFrame(frame) } : {}) }
}

/** The Project a stored value of version 1 to 3 holds, whichever shape wrote it (temporary, see versionThree.ts); a
 * grid-shaped one and a version 3 one still go through normalizeProject to become the Project of today. */
export function decodeEarlierProject(encoded: EncodedVersionThreeProject | EncodedGridProject): VersionThreeProject | GridProject {
  if ('encodedBeads' in encoded) {
    const { encodedBeads, encodedCoveredBeads, ...rest } = encoded
    return { ...rest, beads: decodeBeads(encodedBeads), ...(encodedCoveredBeads ? { coveredBeads: decodeBeads(encodedCoveredBeads) } : {}) }
  }
  const { cells, ...rest } = encoded
  return { ...rest, grid: decodeCells(cells, rest.columns, rest.rows) }
}

