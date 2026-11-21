import { BACKGROUND_POSITIONS } from './background'
import { hasBeads, knownBounds, sortedKeys, type BeadMap, type FrameSheet } from './canvas'
import { knownRowColors } from './layerBeads'
import { knownBeadCount } from './openingLimits'
import { isFrameShape, type QuarterTurns } from './frameShape'
import { framePlacement } from './framePlacement'
import { liftFlatWeave, renamedBrickBlock, renamedBrickBlocks, type FlatProject, type FlatWeave, type SavedProject } from './flatWeave'
import type { FrameLayer, Grid, Project } from './project'
import type { GridProject, LayeredProject, StoredLayer } from './storedProject'
import type { VersionThreeProject } from './versionThree'
import { settingsOffDefault, type Weave } from './weave'

/** The compact form a Project's beads are stored in (ADR 0009, ADR 0026): a per-Project color table plus, per row with
 * a bead, its first column and runs of table indexes. Not indexes into the Palette (a bead may hold any hex): it
 * describes the beads as they stand now. */
export interface EncodedBeads {
  /** Every distinct hex on the canvas, in the order the beads first use it. */
  colors: string[]
  /** Per row with a bead, keyed by row: `"<first column>:<runs>"`, runs as color-table indexes (`"3"`, `"3x40"`; 0
   * is a gap). */
  rows: Record<string, string>
}

/** The Frame as stored (ADR 0066): its place and size, its name, and its own beads in the same compact form, counted
 * from the Frame's first row and column; its Folded beads beside them, where it has any (file version 10, ticket 0638).
 * Its Frame shape is stored as `kind`, the name it had before ADR 0079, so every build reads it alike. */
type EncodedFrame = Omit<FrameSheet, 'beads' | 'folded' | 'shape'> & FlatWeave & { kind?: unknown; encodedBeads: EncodedBeads; encodedFolded?: EncodedBeads }

/** A Project as a file (versions 4 to 11) and the library (version 4) stored it before its layers: the Canvas's beads,
 * and the Frame with its own. Each layer's settings are its map as the app holds it (file version 11, ticket 0636);
 * before, its Brick block was flat. Read only. */
export type EncodedFlatProject = Omit<FlatProject, 'beads' | 'frame'> & FlatWeave & { encodedBeads: EncodedBeads; frame?: EncodedFrame }

/** A layer as a file (version 13) and the library (version 6) store it (ADR 0079, ticket 0664): all it holds, its beads
 * compact, a Frame's shape, settings and Row progress beside them. Since file version 15 (library 7, ticket 1185) a Frame
 * keeps its own angle and centre on the table, not its Canvas position and turn (`orientation`), and its way as seen. */
export type EncodedLayer = Omit<StoredLayer, 'beads' | 'folded' | 'quarterTurns'> & { encodedBeads: EncodedBeads; encodedFolded?: EncodedBeads }

/** A Project as a file (version 13) and the library (version 6) store it (ticket 0664): what is one per file, and its
 * layers in order, the Canvas first; how many backgrounds the list their positions are in held (ticket 1000). */
export type EncodedProject = Omit<Project, 'layers'> & Pick<LayeredProject, 'backgroundPositions' | 'lettersByLayer'> & { layers: EncodedLayer[] }

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

/** A row's beads as runs of one color (undefined for a gap), from its first column: what its stored string is made of
 * once the color table numbers the colors. */
interface RowRuns {
  first: number
  colors: (string | undefined)[]
  lengths: number[]
}

/** Each row's runs, kept for that row object: an edit replaces only the rows it changes, so a save after it reads
 * those rows alone and not every bead of a huge layer (ticket 0716). */
const rowRunsCache = new WeakMap<Record<number, string>, RowRuns>()

function rowRunsOf(cells: Record<number, string>): RowRuns {
  const known = rowRunsCache.get(cells)
  if (known) return known
  const colors: (string | undefined)[] = []
  const lengths: number[] = []
  const columns = sortedKeys(cells)
  let next = columns[0] ?? 0
  for (const column of columns) {
    if (column > next) {
      colors.push(undefined)
      lengths.push(column - next)
    }
    const color = cells[column]!
    if (lengths.length > 0 && colors[colors.length - 1] === color) lengths[lengths.length - 1]! += 1
    else {
      colors.push(color)
      lengths.push(1)
    }
    next = column + 1
  }
  const runs = { first: columns[0] ?? 0, colors, lengths }
  rowRunsCache.set(cells, runs)
  return runs
}

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

  for (const row of sortedKeys(beads)) {
    const cells = beads[row]!
    const runs = rowRunsOf(cells)
    if (runs.lengths.length === 0) continue
    const parts: string[] = []
    runs.colors.forEach((color, at) => {
      const index = color === undefined ? EMPTY_INDEX : slotFor(color)
      const length = runs.lengths[at]!
      parts.push(length === 1 ? String(index) : `${index}${LENGTH_MARKER}${length}`)
    })
    rows[String(row)] = `${runs.first}${START_SEPARATOR}${parts.join(RUN_SEPARATOR)}`
  }

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

/** One stored row read back: its beads by column, the runs a save writes them from again, and the colors in the order
 * `Object.values` lists them (columns from 0 up first, then the negative ones). */
function decodeRow(entry: string, colors: readonly string[]): { cells: Record<number, string>; runs: RowRuns; inOrder: string[] } | undefined {
  const split = entry.indexOf(START_SEPARATOR)
  let column = Number(entry.slice(0, split))
  const text = entry.slice(split + 1)
  const cells: Record<number, string> = {}
  const runs: RowRuns = { first: 0, colors: [], lengths: [] }
  const ahead: string[] = []
  const behind: string[] = []
  let gap = 0
  let found = false
  for (const run of text === '' ? [] : text.split(RUN_SEPARATOR)) {
    const marker = run.indexOf(LENGTH_MARKER)
    const index = Number(marker === -1 ? run : run.slice(0, marker))
    const length = marker === -1 ? 1 : Number(run.slice(marker + 1))
    // As expandRuns reads it: a run covers as many positions as a loop up to its length makes.
    const covers = length > 0 ? Math.ceil(length) : 0
    const color = Number.isFinite(index) && index !== EMPTY_INDEX ? colors[index - 1] : undefined
    if (color === undefined || covers === 0) {
      if (found) gap += covers
      column += covers
      continue
    }
    if (!found) runs.first = column
    if (gap > 0) {
      runs.colors.push(undefined)
      runs.lengths.push(gap)
      gap = 0
    }
    if (runs.colors.length > 0 && runs.colors[runs.colors.length - 1] === color) runs.lengths[runs.lengths.length - 1]! += covers
    else {
      runs.colors.push(color)
      runs.lengths.push(covers)
    }
    for (let at = column; at < column + covers; at += 1) cells[at] = color
    if (column + covers > 0 && !ahead.includes(color)) ahead.push(color)
    if (column < 0 && !behind.includes(color)) behind.push(color)
    found = true
    column += covers
  }
  if (!found) return undefined
  return { cells, runs, inOrder: [...new Set([...ahead, ...behind])] }
}

/** The beads a compact encoding holds, by position: a layer's, or a Starter's design (ticket 0636). What it reads on
 * the way (each row's runs and colors, the count and the box round them) is kept, so a huge layer just opened is not
 * walked again for them (ticket 0716). */
export function decodeBeads({ colors, rows }: EncodedBeads): BeadMap {
  const beads: BeadMap = {}
  let count = 0
  let box: { top: number; bottom: number; left: number; right: number } | undefined
  for (const [rowKey, entry] of Object.entries(rows)) {
    const decoded = decodeRow(entry, colors)
    if (!decoded) continue
    const row = Number(rowKey)
    beads[row] = decoded.cells
    rowRunsCache.set(decoded.cells, decoded.runs)
    knownRowColors(decoded.cells, decoded.inOrder)
    const width = decoded.runs.lengths.reduce((sum, length) => sum + length, 0)
    count += decoded.runs.lengths.reduce((sum, length, at) => sum + (decoded.runs.colors[at] === undefined ? 0 : length), 0)
    const [left, right] = [decoded.runs.first, decoded.runs.first + width - 1]
    box = box ? { top: Math.min(box.top, row), bottom: Math.max(box.bottom, row), left: Math.min(box.left, left), right: Math.max(box.right, right) } : { top: row, bottom: row, left, right }
  }
  knownBeadCount(beads, count)
  knownBounds(beads, box && { row: box.top, column: box.left, rows: box.bottom - box.top + 1, columns: box.right - box.left + 1 })
  return beads
}

/** Expands the original compact cells to `rows` × `columns`; runs that don't add up still yield a usable grid. */
function decodeCells({ colors, runs }: EncodedCells, columns: number, rows: number): Grid {
  const flat = expandRuns(runs).map((index) => (index === EMPTY_INDEX ? null : (colors[index - 1] ?? null)))
  return Array.from({ length: rows }, (_row, row) =>
    Array.from({ length: columns }, (_cell, column) => ({ color: flat[row * columns + column] ?? null })),
  )
}

/** A layer as a file stores its Weave (ticket 0636): its settings map as the app holds it, a setting at its default left
 * out and the map with it when nothing is left. */
function savedWeave<T extends Weave>({ techniqueSettings, ...layer }: T): Omit<T, 'techniqueSettings'> & Pick<Weave, 'techniqueSettings'> {
  const changed = settingsOffDefault(techniqueSettings)
  return { ...layer, ...(Object.keys(changed).length > 0 ? { techniqueSettings: changed } : {}) }
}

/** A stored Frame as the app holds it: a `kind` naming a Frame shape this build knows is its shape; any other (an
 * older file's "rectangular", or a shape added since) is a Frame without one. */
function decodeFrame({ encodedBeads, encodedFolded, kind, ...place }: EncodedFrame): FrameSheet & FlatWeave {
  const folded = encodedFolded && decodeBeads(encodedFolded)
  return { ...place, ...(isFrameShape(kind) ? { shape: kind } : {}), beads: decodeBeads(encodedBeads), ...(folded && hasBeads(folded) ? { folded } : {}) }
}

/** A Project as a file and the library store it (ticket 0664): each layer's settings at their defaults left out, its
 * beads compact, a Frame's placement on the table for its Canvas position (ticket 1185), its Background positions marked
 * as in the list of three (ticket 1000), and each layer's Letters switch as its own (ticket 1092). */
export function encodeProject(project: Project): EncodedProject {
  const [{ origin, ...canvas }, ...frames] = project.layers
  // Each Frame's own centre, worked out as if it were the Frame laid on this Canvas, from the Canvas's origin: a file's
  // table has its origin there (ticket 1188).
  const centreOf = (frame: FrameLayer) => {
    const at = framePlacement({ layers: [{ ...canvas, ...(origin ? { origin } : {}) }, frame] })?.at
    return at && { x: at.x - (origin?.x ?? 0), y: at.y - (origin?.y ?? 0) }
  }
  return { ...project, backgroundPositions: BACKGROUND_POSITIONS, lettersByLayer: true, layers: [encodeLayer(canvas), ...frames.map((frame) => encodeFrame(frame, centreOf(frame)))] }
}

function encodeLayer(layer: Project['layers'][number]): EncodedLayer {
  const { beads, folded, ...rest } = layer as Partial<FrameLayer> & Project['layers'][number]
  return {
    ...savedWeave(rest),
    encodedBeads: encodeBeads(beads),
    ...(folded ? { encodedFolded: encodeBeads(folded) } : {}),
  }
}

/** A Frame as file version 15 stores it: its own angle and its centre on the table (kept to a millionth of a bead), not
 * its Canvas position; `quarterTurns` is read from the angle, so it is not kept. */
function encodeFrame(frame: FrameLayer, centre: { x: number; y: number } | undefined): EncodedLayer {
  const { row: _row, column: _column, quarterTurns: _turns, centre: _centre, ...rest } = frame
  const rounded = (value: number) => Math.round(value * 1e6) / 1e6 || 0
  // One off the Canvas's grid says so (ticket 1188): optional, so it adds no format; without it the centre is a position's.
  return { ...encodeLayer(rest as FrameLayer), ...(centre ? { centre: { x: rounded(centre.x), y: rounded(centre.y) } } : {}), ...(frame.centre ? { offGrid: true } : {}) }
}

/** The Project a file version 13 to 15 or library version 6 or 7 value holds (ticket 0664); it still goes through
 * normalizeProject. A Frame stored before version 15 has its orientation read back as its quarter turns on the Canvas. */
export function decodeProject(encoded: EncodedProject): LayeredProject {
  const [canvas, ...frames] = encoded.layers.map(decodeLayer)
  const earlier = ({ orientation, ...frame }: StoredLayer): StoredLayer => ({ ...frame, ...(typeof orientation === 'number' ? { quarterTurns: (orientation / 90) as QuarterTurns } : {}) })
  return { ...encoded, layers: [canvas!, ...frames.map((frame) => (typeof frame.angle === 'number' ? frame : earlier(frame)))] }
}

function decodeLayer({ encodedBeads, encodedFolded, ...layer }: EncodedLayer): StoredLayer {
  const folded = encodedFolded && decodeBeads(encodedFolded)
  return { ...layer, beads: decodeBeads(encodedBeads), ...(folded && hasBeads(folded) ? { folded } : {}) }
}

/** The Project a file version 12 or library version 5 value holds: as version 13's, each layer's Brick block read as
 * brick stitch's Drop (ticket 0691). */
export function decodeVersionTwelveProject(encoded: EncodedProject): LayeredProject {
  const project = decodeProject(encoded)
  return { ...project, layers: project.layers.map(renamedBrickBlock) }
}

/** The Project a file version 11 value holds, flat as before its layers (ticket 0664), each Weave's settings a map
 * whose Brick block is read as brick stitch's Drop (ticket 0691); it still goes through normalizeProject. */
export function decodeVersionElevenProject(encoded: EncodedFlatProject): SavedProject {
  return renamedBrickBlocks(decodedFlat(encoded))
}

/** The Project a value of file version 4 to 10, or of the library, holds: each layer's flat Brick block read into its
 * settings map (ticket 0636) as brick stitch's Drop (ticket 0691). */
export function decodeFlatProject(encoded: EncodedFlatProject): SavedProject {
  return liftFlatWeave(decodedFlat(encoded))
}

function decodedFlat({ encodedBeads, frame, ...rest }: EncodedFlatProject): SavedProject {
  return { ...rest, beads: decodeBeads(encodedBeads), ...(frame ? { frame: decodeFrame(frame) } : {}) }
}

/** The Project a stored value of version 1 to 3 holds, whichever shape wrote it (temporary, see versionThree.ts), its
 * flat Brick block in its settings map; a grid-shaped one and a version 3 one still go through normalizeProject. */
export function decodeEarlierProject(encoded: EncodedVersionThreeProject | EncodedGridProject): VersionThreeProject | GridProject {
  if ('encodedBeads' in encoded) {
    const { encodedBeads, encodedCoveredBeads, ...rest } = encoded
    return liftFlatWeave({ ...rest, beads: decodeBeads(encodedBeads), ...(encodedCoveredBeads ? { coveredBeads: decodeBeads(encodedCoveredBeads) } : {}) })
  }
  const { cells, ...rest } = encoded
  return liftFlatWeave({ ...rest, grid: decodeCells(cells, rest.columns, rest.rows) })
}

