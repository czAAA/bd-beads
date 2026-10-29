import { forEachBead, frameContains, withColors, type BeadChange, type BeadMap, type Rect } from './canvas'
import { type GridPosition } from './grid'
import { rowCycle, type Weave } from './weave'
import { MAX_MAKER_NAME, normalizeMakerName } from './makerName'
import { numericKey, pieceBeadsAt } from './pieces'
import { carryPieceIndex, joinsNamedPieces, piecesStayWhole, presenceChanges, type BeadPresence } from './pieceIndex'
import type { Project } from './project'
import type { Selection } from './selection'

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

/** The last answer of `namedPieces` per set of beads: the canvas asks on every repaint of the rulers, and the answer
 * only changes when the beads or the names do. */
const namedCache = new WeakMap<BeadMap, { names: PieceName[]; cycle: number; found: NamedPiece[] }>()

/** The Piece names that still have a Piece under them, and which Piece each is on. Unresolved names are skipped. */
export function namedPieces(project: Pick<Project, 'beads' | 'technique' | 'techniqueSettings' | 'pieceNames'>): NamedPiece[] {
  const names = project.pieceNames
  if (!names?.length) {
    return []
  }
  const known = namedCache.get(project.beads)
  if (known && known.names === names && known.cycle === rowCycle(project)) {
    return known.found
  }
  const found: NamedPiece[] = []
  for (const { name, row, column } of names) {
    const members = pieceBeadsAt(project.beads, project, { row, column })
    if (members.length === 0) {
      continue
    }
    const rows = members.map((at) => at.row)
    const columns = members.map((at) => at.column)
    const top = Math.min(...rows)
    const left = Math.min(...columns)
    found.push({ name, row: top, column: left, rows: Math.max(...rows) - top + 1, columns: Math.max(...columns) - left + 1, beads: members.length })
  }
  namedCache.set(project.beads, { names, cycle: rowCycle(project), found })
  return found
}

/** The name of the first named Piece (an unframed Schema) that `frame` would cut, some beads in, some out (ticket 407).
 * A Frame frames a Schema whole or not at all. */
export function namedPieceCutBy(project: Pick<Project, 'beads' | 'technique' | 'techniqueSettings' | 'pieceNames'>, frame: Rect): string | undefined {
  for (const { name, row, column } of project.pieceNames ?? []) {
    const members = pieceBeadsAt(project.beads, project, { row, column })
    const inside = members.filter((at) => frameContains(frame, at)).length
    if (inside > 0 && inside < members.length) {
      return name
    }
  }
  return undefined
}

/** The name of the Piece that holds the bead at `position`, if it has one. */
export function pieceNameAt(project: Pick<Project, 'beads' | 'technique' | 'techniqueSettings' | 'pieceNames'>, position: GridPosition): string | undefined {
  const names = project.pieceNames
  if (!names?.length) {
    return undefined
  }
  const piece = new Set(pieceBeadsAt(project.beads, project, position).map(numericKey))
  return names.find((entry) => piece.has(numericKey(entry)))?.name
}

/** The Project with the Piece holding the bead at `position` named `name` (unnamed when empty). The same Project
 * when nothing changes or there is no bead there. */
export function withPieceName(project: Project, position: GridPosition, name: string): Project {
  const piece = new Set(pieceBeadsAt(project.beads, project, position).map(numericKey))
  if (piece.size === 0) {
    return project
  }
  const kept = normalizePieceName(name)
  const others = (project.pieceNames ?? []).filter((entry) => !piece.has(numericKey(entry)))
  const current = pieceNameAt(project, position)
  if ((current ?? '') === kept) {
    return project
  }
  const next = kept ? [...others, { row: position.row, column: position.column, name: kept }] : others
  const { pieceNames: _previous, ...rest } = project
  return { ...rest, ...(next.length > 0 ? { pieceNames: next } : {}), updatedAt: Date.now() }
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
  after: Pick<Project, 'beads' | 'technique' | 'techniqueSettings'>,
  labeller: ReturnType<typeof pieceLabeller>,
  moved?: (position: GridPosition) => GridPosition | undefined,
): Landing[] {
  const where = (at: GridPosition) => (moved ? moved(at) : at)
  const landings: Landing[] = []
  for (const entry of before.pieceNames ?? []) {
    const survivors = pieceBeadsAt(before.beads, before, entry)
      .map(where)
      .filter((at): at is GridPosition => !!at && after.beads[at.row]?.[at.column] !== undefined)
    if (survivors.length === 0) {
      continue
    }
    const target = where(entry)
    const groups = new Map<number, GridPosition[]>()
    for (const at of survivors) {
      const id = labeller.idOf(at)!
      const group = groups.get(id)
      if (group) group.push(at)
      else groups.set(id, [at])
    }
    const anchorId = target ? labeller.idOf(target) : undefined
    const [id, members] = [...groups].sort(
      ([a], [b]) => labeller.sizeOf(b) - labeller.sizeOf(a) || Number(b === anchorId) - Number(a === anchorId),
    )[0]
    landings.push({ entry, id, survivors: members.length, anchor: id === anchorId && target ? target : members[0] })
  }
  return landings
}

/** Whether two states of a Project join their beads into Pieces alike: the same Technique and settings. */
function sameWeave(before: Project, after: Project): boolean {
  return before.technique === after.technique && before.techniqueSettings === after.techniqueSettings
}

/** Whether every name of the Project stands on a bead (one that does not is dropped by the next edit). */
function anchored(project: Project): boolean {
  return (project.pieceNames ?? []).every((entry) => project.beads[entry.row]?.[entry.column] !== undefined)
}

/** What a drawing edit did to where beads are, when it is plain from the beads it changed that every Piece name stays
 * on its bead (ticket 0674): only colors changed, beads were added that join no two named Pieces, or beads other than
 * a name's were emptied and split no Piece. Undefined when only following every named Piece can tell. */
function namesStay(before: Project, after: Project): BeadPresence | undefined {
  if (!sameWeave(before, after) || !anchored(before)) return undefined
  const change = presenceChanges(before.beads, after.beads)
  const { added, removed } = change
  if (added.length > 0 && removed.length > 0) return undefined
  if (removed.length > 0) {
    const anchors = new Set(before.pieceNames!.map(numericKey))
    return removed.some((at) => anchors.has(numericKey(at))) || !piecesStayWhole(after.beads, after, removed) ? undefined : change
  }
  return added.length > 0 && before.pieceNames!.length > 1 && joinsNamedPieces(before.beads, after, before.pieceNames!, added) ? undefined : change
}

/** The Project `after` with Piece names carried over from `before`; `moved` says where a `before` bead went
 * (undefined if gone). If two names land on one Piece (only a move or Technique change; painting is refused first),
 * the one with more old beads keeps its name. */
export function carryNames(before: Project, after: Project, moved?: (position: GridPosition) => GridPosition | undefined): Project {
  if (!before.pieceNames?.length) {
    return after
  }
  const change = moved ? undefined : namesStay(before, after)
  if (change) {
    carryPieceIndex(before.beads, after.beads, after, change)
    return after.pieceNames === before.pieceNames ? after : { ...after, pieceNames: before.pieceNames }
  }
  const kept: Landing[] = []
  for (const landing of landNames(before, after, pieceLabeller(after.beads, after), moved)) {
    const clash = kept.findIndex((other) => other.id === landing.id)
    if (clash === -1) {
      kept.push(landing)
    } else if (landing.survivors > kept[clash].survivors) {
      kept[clash] = landing
    }
  }
  const next = (before.pieceNames ?? [])
    .map((entry) => kept.find((landing) => landing.entry === entry))
    .filter((landing): landing is Landing => !!landing)
    .map(({ entry, anchor }) => ({ name: entry.name, row: anchor.row, column: anchor.column }))
  const { pieceNames: _previous, ...rest } = after
  return { ...rest, ...(next.length > 0 ? { pieceNames: next } : {}) }
}

/** What a drawing edit did, with every bead that would join two named Pieces taken back (so a name is never dropped). `after` itself when it joins none. */
export function keepNamesApart(before: Project, after: Project): Project {
  if ((before.pieceNames?.length ?? 0) < 2 || after.beads === before.beads) {
    return after
  }
  // Only a new bead joins Pieces; whether it joins named ones is read from the beads the edit changed (ticket 0674).
  const { added, removed } = presenceChanges(before.beads, after.beads)
  if (added.length === 0 || (removed.length === 0 && sameWeave(before, after) && anchored(before) && !joinsNamedPieces(before.beads, after, before.pieceNames!, added))) {
    return after
  }
  const labeller = pieceLabeller(after.beads, after)
  const counts = new Map<number, number>()
  for (const { id } of landNames(before, after, labeller)) {
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  const joined = new Set([...counts].filter(([, count]) => count > 1).map(([id]) => id))
  if (joined.size === 0) {
    return after
  }
  const reverts: BeadChange[] = []
  forEachBead(after.beads, (row, column) => {
    const id = labeller.idOf({ row, column })
    if (id !== undefined && joined.has(id) && before.beads[row]?.[column] === undefined) {
      reverts.push({ row, column, color: null })
    }
  })
  return { ...after, beads: withColors(after.beads, reverts) }
}

/** The bead standing for the one Piece a Selection covers (ticket 406): a Piece may be named only when the Selection
 * holds beads of exactly one. Undefined for no bead, or beads of two or more Pieces. */
export function pieceInSelection(
  project: Pick<Project, 'beads' | 'technique' | 'techniqueSettings'>,
  selection: Selection,
): GridPosition | undefined {
  const labeller = pieceLabeller(project.beads, project)
  const shape = selection.cells && new Set(selection.cells.map((cell) => `${cell.row},${cell.column}`))
  let found: { id: number; at: GridPosition } | undefined
  for (const [rowKey, columns] of Object.entries(project.beads)) {
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
