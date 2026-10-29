import { forEachBead, frameContains, withColors, type BeadChange, type BeadMap, type Rect } from './canvas'
import { type GridPosition } from './grid'
import { rowCycle, type Weave } from './weave'
import { MAX_MAKER_NAME, normalizeMakerName } from './makerName'
import { numericKey, pieceBeadsAt } from './pieces'
import type { Project } from './project'
import type { Selection } from './selection'
import { beadsOfLayer, heldWeave, type Layered, pieceNamesOf, withLayer, withPieceNames } from './layerRecord'

/** A name for a Piece (ticket 406, ADR 0050): a named Piece is an unframed Schema. Pieces are never stored, so a name
 * is kept at one bead's position (its anchor) and follows the Piece through edits by `carryNames`: joining an unnamed
 * Piece absorbs it, joining two named is refused (`keepNamesApart`), a split keeps the name on the larger part. */
export interface PieceName extends GridPosition {
  name: string
}

/** The longest a name may be: the same 40 characters as the Maker's name. */
export const MAX_PIECE_NAME = MAX_MAKER_NAME

/** A name as it is kept: trimmed and cut to the longest allowed; empty means no name. */
const normalizePieceName = normalizeMakerName

/** The names of a stored Project, keeping only well-formed ones (a hand-edited or newer file may hold anything),
 * each cut to the longest allowed. */
export function readPieceNames(stored: unknown): PieceName[] {
  if (!Array.isArray(stored)) {
    return []
  }
  return stored.flatMap((entry: Partial<PieceName> | null) => {
    const name = typeof entry?.name === 'string' ? normalizePieceName(entry.name) : ''
    return name && Number.isInteger(entry?.row) && Number.isInteger(entry?.column)
      ? [{ name, row: entry!.row!, column: entry!.column! }]
      : []
  })
}

/** A named Piece as drawn and listed: its name, its rectangle and how many beads it holds. */
export interface NamedPiece extends Rect {
  name: string
  beads: number
}

/** The Canvas's beads and its Weave as held, through the Layer accessor (ticket 0662): what a Piece is found in. */
function canvasOf(project: Layered): { beads: BeadMap; weave: Weave } {
  return { beads: beadsOfLayer(project, 'canvas'), weave: heldWeave(project, 'canvas') }
}

/** The last answer of `namedPieces` per set of beads: the canvas asks on every repaint of the rulers, and the answer
 * only changes when the beads or the names do. */
const namedCache = new WeakMap<BeadMap, { names: PieceName[]; cycle: number; found: NamedPiece[] }>()

/** The Piece names that still have a Piece under them, and which Piece each is on. Unresolved names are skipped. */
export function namedPieces(project: Layered): NamedPiece[] {
  const names = pieceNamesOf(project)
  if (!names?.length) {
    return []
  }
  const { beads, weave } = canvasOf(project)
  const known = namedCache.get(beads)
  if (known && known.names === names && known.cycle === rowCycle(weave)) {
    return known.found
  }
  const found: NamedPiece[] = []
  for (const { name, row, column } of names) {
    const members = pieceBeadsAt(beads, weave, { row, column })
    if (members.length === 0) {
      continue
    }
    const rows = members.map((at) => at.row)
    const columns = members.map((at) => at.column)
    const top = Math.min(...rows)
    const left = Math.min(...columns)
    found.push({ name, row: top, column: left, rows: Math.max(...rows) - top + 1, columns: Math.max(...columns) - left + 1, beads: members.length })
  }
  namedCache.set(beads, { names, cycle: rowCycle(weave), found })
  return found
}

/** The name of the first named Piece (an unframed Schema) that `frame` would cut, some beads in, some out (ticket 407).
 * A Frame frames a Schema whole or not at all. */
export function namedPieceCutBy(project: Layered, frame: Rect): string | undefined {
  const { beads, weave } = canvasOf(project)
  for (const { name, row, column } of pieceNamesOf(project) ?? []) {
    const members = pieceBeadsAt(beads, weave, { row, column })
    const inside = members.filter((at) => frameContains(frame, at)).length
    if (inside > 0 && inside < members.length) {
      return name
    }
  }
  return undefined
}

/** The name of the Piece that holds the bead at `position`, if it has one. */
export function pieceNameAt(project: Layered, position: GridPosition): string | undefined {
  const names = pieceNamesOf(project)
  if (!names?.length) {
    return undefined
  }
  const { beads, weave } = canvasOf(project)
  const piece = new Set(pieceBeadsAt(beads, weave, position).map(numericKey))
  return names.find((entry) => piece.has(numericKey(entry)))?.name
}

/** The Project with the Piece holding the bead at `position` named `name` (unnamed when empty). The same Project
 * when nothing changes or there is no bead there. */
export function withPieceName(project: Project, position: GridPosition, name: string): Project {
  const { beads, weave } = canvasOf(project)
  const piece = new Set(pieceBeadsAt(beads, weave, position).map(numericKey))
  if (piece.size === 0) {
    return project
  }
  const kept = normalizePieceName(name)
  const others = (pieceNamesOf(project) ?? []).filter((entry) => !piece.has(numericKey(entry)))
  const current = pieceNameAt(project, position)
  if ((current ?? '') === kept) {
    return project
  }
  const next = kept ? [...others, { row: position.row, column: position.column, name: kept }] : others
  return { ...withPieceNames(project, next), updatedAt: Date.now() }
}

/** Labels the Pieces of one bead set as they are asked about, so two positions of one Piece answer with one id. */
function pieceLabeller(beads: BeadMap, weave: Weave) {
  const ids = new Map<number, number>()
  const sizes: number[] = []
  return {
    idOf(position: GridPosition): number | undefined {
      const known = ids.get(numericKey(position))
      if (known !== undefined) {
        return known
      }
      const members = pieceBeadsAt(beads, weave, position)
      if (members.length === 0) {
        return undefined
      }
      const id = sizes.length
      sizes.push(members.length)
      members.forEach((at) => ids.set(numericKey(at), id))
      return id
    },
    sizeOf: (id: number) => sizes[id],
  }
}

interface Landing {
  entry: PieceName
  /** Which Piece of `after` (by `labeller`) the name lands on. */
  id: number
  /** How many beads of its old Piece are on that Piece now. */
  survivors: number
  anchor: GridPosition
}

/** Where each name of `before` lands among the Pieces of `after`: on the part of its old Piece with the most beads
 * (ties to the part that holds its anchor). Names with no bead left have none. */
function landNames(
  before: Project,
  after: Layered,
  labeller: ReturnType<typeof pieceLabeller>,
  moved?: (position: GridPosition) => GridPosition | undefined,
): Landing[] {
  const where = (at: GridPosition) => (moved ? moved(at) : at)
  const landings: Landing[] = []
  const was = canvasOf(before)
  const now = beadsOfLayer(after, 'canvas')
  for (const entry of pieceNamesOf(before) ?? []) {
    const survivors = pieceBeadsAt(was.beads, was.weave, entry)
      .map(where)
      .filter((at): at is GridPosition => !!at && now[at.row]?.[at.column] !== undefined)
    if (survivors.length === 0) {
      continue
    }
    const target = where(entry)
    const groups = new Map<number, GridPosition[]>()
    for (const at of survivors) {
      const id = labeller.idOf(at)!
      groups.set(id, [...(groups.get(id) ?? []), at])
    }
    const anchorId = target ? labeller.idOf(target) : undefined
    const [id, members] = [...groups].sort(
      ([a], [b]) => labeller.sizeOf(b) - labeller.sizeOf(a) || Number(b === anchorId) - Number(a === anchorId),
    )[0]
    landings.push({ entry, id, survivors: members.length, anchor: id === anchorId && target ? target : members[0] })
  }
  return landings
}

/** The Project `after` with Piece names carried over from `before`; `moved` says where a `before` bead went
 * (undefined if gone). If two names land on one Piece (only a move or Technique change; painting is refused first),
 * the one with more old beads keeps its name. */
export function carryNames(before: Project, after: Project, moved?: (position: GridPosition) => GridPosition | undefined): Project {
  if (!pieceNamesOf(before)?.length) {
    return after
  }
  const kept: Landing[] = []
  const { beads, weave } = canvasOf(after)
  for (const landing of landNames(before, after, pieceLabeller(beads, weave), moved)) {
    const clash = kept.findIndex((other) => other.id === landing.id)
    if (clash === -1) {
      kept.push(landing)
    } else if (landing.survivors > kept[clash].survivors) {
      kept[clash] = landing
    }
  }
  const next = (pieceNamesOf(before) ?? [])
    .map((entry) => kept.find((landing) => landing.entry === entry))
    .filter((landing): landing is Landing => !!landing)
    .map(({ entry, anchor }) => ({ name: entry.name, row: anchor.row, column: anchor.column }))
  return withPieceNames(after, next)
}

/** What a drawing edit did, with every bead that would join two named Pieces taken back (so a name is never dropped). `after` itself when it joins none. */
export function keepNamesApart(before: Project, after: Project): Project {
  const [beads, was] = [beadsOfLayer(after, 'canvas'), beadsOfLayer(before, 'canvas')]
  if ((pieceNamesOf(before)?.length ?? 0) < 2 || beads === was) {
    return after
  }
  const labeller = pieceLabeller(beads, heldWeave(after, 'canvas'))
  const counts = new Map<number, number>()
  for (const { id } of landNames(before, after, labeller)) {
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  const joined = new Set([...counts].filter(([, count]) => count > 1).map(([id]) => id))
  if (joined.size === 0) {
    return after
  }
  const reverts: BeadChange[] = []
  forEachBead(beads, (row, column) => {
    const id = labeller.idOf({ row, column })
    if (id !== undefined && joined.has(id) && was[row]?.[column] === undefined) {
      reverts.push({ row, column, color: null })
    }
  })
  return withLayer(after, 'canvas', { beads: withColors(beads, reverts) })
}

/** The bead standing for the one Piece a Selection covers (ticket 406): a Piece may be named only when the Selection
 * holds beads of exactly one. Undefined for no bead, or beads of two or more Pieces. */
export function pieceInSelection(
  project: Layered,
  selection: Selection,
): GridPosition | undefined {
  const { beads, weave } = canvasOf(project)
  const labeller = pieceLabeller(beads, weave)
  const shape = selection.cells && new Set(selection.cells.map((cell) => `${cell.row},${cell.column}`))
  let found: { id: number; at: GridPosition } | undefined
  for (const [rowKey, columns] of Object.entries(beads)) {
    const row = Number(rowKey)
    if (row < selection.top || row >= selection.top + selection.rows) {
      continue
    }
    for (const columnKey of Object.keys(columns)) {
      const column = Number(columnKey)
      if (column < selection.left || column >= selection.left + selection.columns) {
        continue
      }
      if (shape && !shape.has(`${row},${column}`)) {
        continue
      }
      const id = labeller.idOf({ row, column })!
      if (found && found.id !== id) {
        return undefined
      }
      found = { id, at: { row, column } }
    }
  }
  return found?.at
}
