import { forEachBead, hasBeads, type BeadMap } from './canvas'
import type { GridPosition } from './grid'
import { sameWeave } from './layerWeave'
import type { Weave } from './weave'

// Folded beads (ADR 0066, ticket 0638): a sheet laid over a layer (the Frame over the Canvas) keeps the beads it gives
// up when it is made smaller and shows them again when it grows back, where the two are woven unlike. The rule asks
// each side for its Weave only, so it holds for any sheet over any layer.

/** A sheet's beads in its own rows and columns: those it shows, and its Folded beads beyond its edge. */
export interface SheetBeads {
  beads: BeadMap
  /** The beads it gave up and keeps out of sight; absent when there are none. */
  folded?: BeadMap
}

/** A sheet's beads after its edges moved, and what it gives up to the layer under it. */
export interface RefitSheet extends SheetBeads {
  /** The beads it no longer holds that go to the layer under it, in the sheet's new own rows and columns; empty where
   * it folds them. */
  given: BeadMap
  /** The layer's beads it took in, in its new own rows and columns; empty where it folds. */
  taken: BeadMap
}

/** Whether a sheet over a layer folds what it gives up rather than giving it to the layer: when the two are woven
 * unlike (Technique or Brick block), as their positions then do not match one to one. */
export function foldsOver(under: Weave, sheet: Weave): boolean {
  return !sameWeave(under, sheet)
}

/** A sheet's beads once its corner moves by `shift` and it holds only the positions `holds` names (from its new corner):
 * a Folded bead held again shows, one no longer held folds or goes to the layer under it, and, not folding, the sheet
 * takes in that layer's beads `offered` where it holds a position with none of its own (ticket 0639). */
export function refitSheet(sheet: SheetBeads & Weave, under: Weave, shift: GridPosition, holds: (position: GridPosition) => boolean, offered: BeadMap = {}): RefitSheet {
  return refit(sheet, shift, holds, foldsOver(under, sheet), offered)
}

/** A sheet's beads once it holds only the positions `holds` names, every bead keeping its name: what it no longer holds
 * folds, a Folded bead it holds again shows. How a sheet that always folds refits: a Custom frame, its positions named
 * by its layout, when its settings change (ADR 0066, ticket 0640). */
export function refoldSheet(sheet: SheetBeads, holds: (position: GridPosition) => boolean): SheetBeads {
  const { beads, folded } = refit(sheet, IN_PLACE, holds, true)
  return { beads, ...(folded ? { folded } : {}) }
}

/** No shift: a sheet whose beads keep their names whatever its size. */
const IN_PLACE: GridPosition = { row: 0, column: 0 }

/** The one pass behind both refits: each bead, shown or folded, lands where its sheet now holds it, else folds (always,
 * where `folds`) or is given; not folding, it takes in the `offered` beads where it has none. */
function refit(sheet: SheetBeads, shift: GridPosition, holds: (position: GridPosition) => boolean, folds: boolean, offered: BeadMap = {}): RefitSheet {
  const beads: BeadMap = {}
  const folded: BeadMap = {}
  const given: BeadMap = {}
  const place = (map: BeadMap, row: number, column: number, color: string) => {
    map[row] ??= {}
    map[row]![column] = color
  }
  const sort = (row: number, column: number, color: string, wasFolded: boolean) => {
    const at = { row: row - shift.row, column: column - shift.column }
    if (holds(at)) place(beads, at.row, at.column, color)
    else place(wasFolded || folds ? folded : given, at.row, at.column, color)
  }
  forEachBead(sheet.folded ?? {}, (row, column, color) => sort(row, column, color, true))
  forEachBead(sheet.beads, (row, column, color) => sort(row, column, color, false))
  const taken: BeadMap = {}
  if (!folds) {
    forEachBead(offered, (row, column, color) => {
      if (!holds({ row, column }) || beads[row]?.[column] !== undefined) return
      place(beads, row, column, color)
      place(taken, row, column, color)
    })
  }
  return { beads, ...(hasBeads(folded) ? { folded } : {}), given, taken }
}

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
