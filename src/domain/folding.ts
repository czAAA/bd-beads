import { forEachBead, hasBeads, type BeadMap } from './canvas'
import type { GridPosition } from './grid'

// Folded beads (ADR 0066, ticket 1215): a sheet laid over a layer (the Frame over the Canvas) always keeps the beads it
// gives up when it is made smaller and shows them again when it grows back. No bead passes between the two layers.

/** A sheet's beads in its own rows and columns: those it shows, and its Folded beads beyond its edge. */
export interface SheetBeads {
  beads: BeadMap
  /** The beads it gave up and keeps out of sight; absent when there are none. */
  folded?: BeadMap
}

/** A sheet's beads once its corner moves by `shift` and it holds only the positions `holds` names (from its new corner):
 * a Folded bead held again shows, one no longer held folds. Nothing is ever given to the layer under it, and nothing
 * taken from it (ticket 1215). */
export function refitSheet(sheet: SheetBeads, shift: GridPosition, holds: (position: GridPosition) => boolean): SheetBeads {
  const beads: BeadMap = {}
  const folded: BeadMap = {}
  const place = (map: BeadMap, row: number, column: number, color: string) => {
    map[row] ??= {}
    map[row]![column] = color
  }
  const sort = (row: number, column: number, color: string) => {
    const at = { row: row - shift.row, column: column - shift.column }
    place(holds(at) ? beads : folded, at.row, at.column, color)
  }
  forEachBead(sheet.folded ?? {}, sort)
  forEachBead(sheet.beads, sort)
  return { beads, ...(hasBeads(folded) ? { folded } : {}) }
}

/** A sheet's beads once it holds only the positions `holds` names, every bead keeping its name: what it no longer holds
 * folds, a Folded bead it holds again shows. How a sheet whose positions are named by its layout refits: a Custom frame
 * when its settings change (ADR 0066, ticket 0640). */
export function refoldSheet(sheet: SheetBeads, holds: (position: GridPosition) => boolean): SheetBeads {
  return refitSheet(sheet, IN_PLACE, holds)
}

/** No shift: a sheet whose beads keep their names whatever its size. */
const IN_PLACE: GridPosition = { row: 0, column: 0 }

/** A sheet's beads, those it shows and its Folded ones, each sent where `move` says (told which kind it is), or gone
 * where it says undefined: how a Frame command (Rotate Frame, a Technique change, Remove row/column) carries the
 * Folded beads with the rest. */
export function withEachBead(sheet: SheetBeads, move: (position: GridPosition, folded: boolean) => GridPosition | undefined): SheetBeads {
  const map = (from: BeadMap, folded: boolean): BeadMap => {
    const to: BeadMap = {}
    forEachBead(from, (row, column, color) => {
      const at = move({ row, column }, folded)
      if (!at) return
      to[at.row] ??= {}
      to[at.row]![at.column] = color
    })
    return to
  }
  const folded = sheet.folded && map(sheet.folded, true)
  return { beads: map(sheet.beads, false), ...(folded && hasBeads(folded) ? { folded } : {}) }
}
