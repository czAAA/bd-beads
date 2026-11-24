import {
  beadsInFrame,
  forEachBead,
  frameContains,
  shiftedBeads,
  withColors,
  type BeadChange,
  type BeadMap,
  type Rect,
  type FrameSheet,
  sameFrame,
} from './canvas'
import { movedFrame, snapColumn, snapRow, withFrame, type FrameEdge } from './frame'
import { layerSheet, shownBeads } from './layers'
import { copiedOntoLayout } from './customSelection'
import type { GridPosition, FrameRef } from './grid'
import { footprintOf } from './footprint'
import { refoldSheet, withEachBead } from './folding'
import {
  changedSettings,
  customFrameSize,
  frameAllows,
  frameGeometry,
  frameShapeOf,
  resizedName,
  sameSettings,
  settingsOf,
  sizedSettings,
  sizeSettingOf,
  techniquesOf,
  type FrameShapeId,
  type FrameSettings,
  type QuarterTurns,
} from './frameShape'
import type { LayerGeometry } from './layerGeometry'
import type { BeadCell, Weave } from './weave'
import { carryNames } from './pieceNames'
import { canvasDistance, canvasWeave, frameWeave, sameBeadSize, weaveOf } from './layerWeave'
import { withWovenPalette } from './projectBead'
import { clampPointer, progressWithoutLine, rowProgressStarted } from './rowProgress'
import { frameQuarterTurnOf } from './table'
import { sameBeads } from './layerBeads'
import { withWeave, type WeaveChange } from './weaveSwitch'
import { linesKeptIn, type WovenChoice } from './wovenLines'
import { frameIdentity, heldWeave, pieceNamesOf, startingRowProgressOf, withFrameFields, withLayer, withStartingRowProgress, FIRST_FRAME, frameById } from './layerRecord'
import { touchFrameSheet, withFrameSheet } from './frameSheet'
import type { FrameLayer, Project } from './project'
import type { AreaLine } from './removeLine'

// The one operation behind every change of the Frame (ticket 361): make a Frame, resize, move, Fit to drawing, Remove
// Frame and Remove row/column. It owns the rules: Row progress's lock (Remove Frame passes it, clearing the passes;
// moving, naming and Remove row/column keep them), Row progress following the Frame.
export type FrameChange =
  /** Resize the Frame (handles, steppers, typed size), its beads keeping their place: what it gives up folds, and growing
   * it back shows them again, whatever the Weaves are; it takes nothing from the Canvas (tickets 0638, 1215). A Custom
   * frame steps its size setting to the step nearest the rectangle instead (ticket 0669). */
  | { set: Rect }
  /** Frame from Selection, Fit to drawing and Set Frame around the picture (ADR 0066, ticket 1215): the Frame becomes this
   * rectangle holding a copy of the beads you see in it, the Canvas keeping every bead, any Frame there replaced. A
   * Custom frame becomes its shape round the rectangle instead (ticket 0669). */
  | { make: Rect }
  /** Remove the Frame with all its beads, Folded ones too, and its Row progress; nothing lands on the Canvas (ticket 1215). */
  | { remove: true }
  /** One whole row or column of the Frame, counted from its first; allowed after Row progress has started, a finished
   * row taking its passes with it (ticket 0647). */
  | { removeLine: AreaLine }
  /** Move the Frame with its beads by whole rows and columns (ticket 452, ADR 0054): the Canvas's, or off its grid the
   * Frame's own (ticket 1188); allowed after Row progress has started, which then travels with the Frame. */
  | { move: { rows: number; columns: number } }
  /** Change the Frame's Technique or its settings (tickets 351, 477, 492, 507, 0625): the geometry changes and every
   * bead keeps its row and column, a Technique taking its settings (a Drop) with it. With a pass done another Technique
   * starts over, or keeps the whole lines with `woven: 'keep'` (ticket 1184, techniqueChangeQuestion). */
  | (WeaveChange & { woven?: WovenChoice })
  /** Put a new Frame in its own weave in place of any Frame there (ticket 495): the old Frame's beads and passes go,
   * the Canvas under the new one is hidden, not changed. Empty, or holding a Starter's design (ticket 0633), and turned
   * where a Starter's strip lies across the Canvas's own lines (ticket 0832). */
  | { place: FramePlacement }
  /** Name the Frame (ticket 555), or clear its name with an empty one; allowed after Row progress has started, as it
   * touches no bead and no pass. */
  | { name: string }
  /** Put a new Custom frame of a Frame shape and size (its Rounds, Part size or Rows) round a Canvas position (tickets
   * 0592, 0593), in place of any Frame there, as `place` does: empty, or holding a Starter's design (ticket 0596). A
   * shape of several settings takes them all (ticket 0597); those not given are its defaults. */
  | { custom: CustomPlacement }
  /** Change a Custom frame's settings (ticket 0592): its layout is built again round the same centre, and every bead
   * whose position is still in it stays; growing adds empty rounds or rows outside. */
  | { settings: FrameSettings }

/** A new Frame without a shape to put in place: its first row and column and its own rows and columns, its Weave, the
 * beads it holds, and the quarters it lies turned at (as Rotate Frame turns one). */
interface FramePlacement {
  frame: Rect
  weave: Weave
  beads?: BeadMap
  quarterTurns?: QuarterTurns
}

/** Why a change did not happen. */
export type FrameChangeRefusal =
  /** Row progress is on and a pass is done: the passes belong to the Frame, which any change would alter (ADR 0026,
   * ticket 411). */
  | 'locked'
  /** Remove line needs a Frame to act on. */
  | 'no-frame'
  /** Remove line's row or column is not one of the Frame's. */
  | 'no-line'
  /** The Frame has only the one row or column asked for, and a Frame is never empty. */
  | 'only-line'
  /** The Frame does not offer it (ADR 0079): a Custom frame has no plain rows to remove and is woven only in its shape's
   * Techniques, and a Frame without a Frame shape has no settings. */
  | 'not-offered'

export type FrameChangeResult =
  | { kind: 'refused'; reason: FrameChangeRefusal }
  /** Nothing differs; `project` is the same instance that came in. */
  | { kind: 'unchanged'; project: Project }
  | { kind: 'changed'; project: Project }

/** Whether the change throws away finished passes: only Remove Frame once a pass is done, as the passes go with the
 * Frame (ticket 434, ADR 0055). The one place that rule lives; the Remove frame flow asks it before confirming.
 * @internal Its test checks the rule on its own. */
export function frameChangeDiscardsProgress(project: Project, change: FrameChange, ref: FrameRef = FIRST_FRAME): boolean {
  return 'remove' in change && rowProgressStarted(project, ref)
}

/** Why the change would be refused on this Project, or undefined when it would be allowed. Cheap: it builds nothing. */
export function frameChangeRefusal(project: Project, change: FrameChange, ref: FrameRef = FIRST_FRAME): FrameChangeRefusal | undefined {
  // Remove Frame is how the weaver lets go of finished passes: it clears them with the Frame (ticket 426, ADR 0055).
  const frame = frameById(project, ref)
  if (rowProgressStarted(project, ref) && !frameChangeDiscardsProgress(project, change, ref) && !('move' in change) && !('name' in change) && !('removeLine' in change) && !asksForTechnique(frame, change)) {
    return 'locked'
  }
  if (frame && frameRefuses(project, frame, change, ref)) {
    return 'not-offered'
  }
  if (('technique' in change || 'techniqueSettings' in change || 'settings' in change) && !frame) {
    return 'no-frame'
  }
  if ('removeLine' in change) {
    if (!frame) {
      return 'no-frame'
    }
    const { axis, index } = change.removeLine
    const length = axis === 'row' ? frame.rows : frame.columns
    if (!Number.isInteger(index) || index < 0 || index >= length) {
      return 'no-line'
    }
    if (length <= 1) {
      return 'only-line'
    }
  }
  if (('move' in change || 'name' in change) && !frame) {
    return 'no-frame'
  }
  return undefined
}

/** Whether the change weaves the Frame in another Technique, which asks once a pass is done rather than waiting (ticket
 * 1184): a Frame with no Frame shape only, as a Custom frame's Technique still waits. Its own settings alone (a Drop)
 * still wait. */
function asksForTechnique(frame: FrameSheet | undefined, change: FrameChange): boolean {
  return !!frame && !frameShapeOf(frame) && 'technique' in change && change.technique !== frame.technique
}

/** The Project with a Frame changed (the one named, ticket 1216), or why not. The Palette follows the woven layer's Bead
 * where the change swaps it, as Remove Frame or Frame from Selection over a Frame in another Bead does (ticket 0665), in
 * the same step. */
export function changeFrame(project: Project, change: FrameChange, ref: FrameRef = FIRST_FRAME): FrameChangeResult {
  const result = frameChanged(project, change, ref)
  return result.kind === 'changed' ? { kind: 'changed', project: withWovenPalette(project, result.project) } : result
}

function frameChanged(project: Project, change: FrameChange, ref: FrameRef): FrameChangeResult {
  const reason = frameChangeRefusal(project, change, ref)
  if (reason) {
    return { kind: 'refused', reason }
  }

  if ('removeLine' in change) {
    const frame = frameById(project, ref)!
    const { axis } = change.removeLine
    const smaller = { ...frame, rows: axis === 'row' ? frame.rows - 1 : frame.rows, columns: axis === 'column' ? frame.columns - 1 : frame.columns }
    // The line runs on through the Folded beads beyond the Frame's edge, so they shift with the rest (ticket 0638).
    const { folded: _folded, ...kept } = frame
    const carried = withEachBead(frame, (position) => shiftedAcrossLine(change.removeLine, position))
    const rowProgress = progressWithoutLine(project, change.removeLine, ref)
    return { kind: 'changed', project: withFrame(withFrameSheet(project, { ...kept, ...carried, rowProgress }, { frame: ref }), smaller, ref) }
  }

  if ('move' in change) {
    const frame = frameById(project, ref)!
    // Off the Canvas's grid it moves by its own rows and columns, along it on screen (ticket 1188), not the Canvas's.
    const by = frame.centre ? canvasDistance(project, frameWeave(project, ref), change.move.rows, change.move.columns, ref) : { row: change.move.rows, column: change.move.columns }
    const moved = movedFrame(frame, by.row, by.column)
    if (sameFrame(frame, moved)) {
      return { kind: 'unchanged', project }
    }
    // The Frame carries its beads and the passes; the Canvas under the destination stays as it is, hidden (ADR 0066).
    return { kind: 'changed', project: touchFrameSheet(project, { ...frame, row: moved.row, column: moved.column }, { frame: ref }) }
  }

  if ('name' in change) {
    const { name: _previous, ...frame } = frameById(project, ref)!
    if (change.name === (frameById(project, ref)!.name ?? '')) {
      return { kind: 'unchanged', project }
    }
    return { kind: 'changed', project: touchFrameSheet(project, { ...frame, ...(change.name ? { name: change.name } : {}) }, { frame: ref }) }
  }

  if ('place' in change) {
    return { kind: 'changed', project: placedFrame(project, change.place, ref) }
  }

  if ('custom' in change) {
    return { kind: 'changed', project: placedCustomFrame(project, change.custom, ref) }
  }

  // A Custom frame's resize handles step its size setting (ADR 0079), or each the setting of its own side (ticket 0814).
  const current = frameById(project, ref)
  const edges = 'set' in change && current ? movedEdges(current, change.set) : undefined
  const sized = 'set' in change && current ? sizedSettings({ ...current, cell: frameWeave(project, ref).cell }, change.set, 'nearest', edges) : undefined
  if ('settings' in change || sized) {
    const frame = frameById(project, ref)!
    const settings = 'settings' in change ? changedSettings(frame, change.settings) : sized!
    if (sameSettings(settings, settingsOf(frame)!)) {
      return { kind: 'unchanged', project }
    }
    if (!edges || !frameShapeOf(frame)!.sides) {
      return { kind: 'changed', project: touchFrameSheet(project, resettled(project, frame, settings, frame.quarterTurns), { frame: ref }) }
    }
    // Each bead, shown or Folded, is named again to stay where it lay as the dragged edges move, so beads come or go on
    // those sides alone; the renamed Folded beads take the place of the old.
    const { folded: _folded, ...shown } = frame
    const renamed = withEachBead(frame, resizedName(frame, settings, heldWeave(project, ref)!, edges))
    const laid = resettled(project, { ...shown, ...renamed }, settings, frame.quarterTurns)
    return { kind: 'changed', project: touchFrameSheet(project, keptEdges(project, frame, laid, edges), { frame: ref }) }
  }

  if ('remove' in change) {
    return frameById(project, ref) ? { kind: 'changed', project: withFrame(project, undefined, ref) } : { kind: 'unchanged', project }
  }

  if ('technique' in change || 'techniqueSettings' in change) {
    const rewoven = withWeave(project, ref, change)
    if (rewoven === project) return { kind: 'unchanged', project }
    // A Custom frame's layout follows its Weave (a Fringe earring's top, ticket 0814): laid out again round its centre,
    // each bead keeping its row and column, those with no place in it folded until a layout has one again.
    const woven = frameById(rewoven, ref)!
    if (frameShapeOf(woven)) return { kind: 'changed', project: withFrameSheet(rewoven, resettled(rewoven, woven, woven.settings ?? {}, woven.quarterTurns, project), { frame: ref }) }
    const keeps = 'woven' in change && change.woven === 'keep' && rowProgressStarted(project, ref) && woven.technique !== frameById(project, ref)!.technique
    return { kind: 'changed', project: keeps ? withFrameFields(rewoven, { rowProgress: linesKeptIn(project, rewoven, ref) }, ref) : withStartingWay(project, rewoven, ref) }
  }

  if ('make' in change) {
    const made = current && sizeSettingOf(current) ? madeCustomFrame(project, change.make, ref) : madeFrame(project, change.make, !!current && !sameBeadSize(project, ref), ref)
    return sameFrame(current, frameById(made, ref)) && sameBeads(project, made) && current?.name === frameById(made, ref)?.name ? { kind: 'unchanged', project } : { kind: 'changed', project: made }
  }

  if (sameFrame(frameById(project, ref), change.set)) {
    return { kind: 'unchanged', project }
  }
  return { kind: 'changed', project: withFrame(project, change.set, ref) }
}

/** A Frame rewoven in another Technique starts its progress afresh, in the new Technique's way as it lies (spec 1182),
 * whatever way it ran before, its passes done too unless kept (ticket 1184); only its settings changed, it keeps its way. */
function withStartingWay(before: Project, after: Project, ref: FrameRef = FIRST_FRAME): Project {
  return frameById(before, ref)?.technique === frameById(after, ref)?.technique ? after : withStartingRowProgress(after, ref)
}

/** Whether the Frame refuses this change: what it does not offer (Remove row/column on a Custom frame), a Technique
 * its shape does not support, settings for a Frame without a Frame shape. */
function frameRefuses(project: Project, frame: FrameSheet, change: FrameChange, ref: FrameRef): boolean {
  if ('settings' in change) return !frameShapeOf(frame)
  return (
    ('set' in change && !frameAllows(project, 'resize', ref)) ||
    ('removeLine' in change && !frameAllows(project, 'remove-line', ref)) ||
    ('make' in change && !frameAllows(project, 'from-selection', ref)) ||
    (('technique' in change || 'techniqueSettings' in change) && !frameAllows(project, 'technique', ref)) ||
    ('technique' in change && !techniquesOf(frame).includes(change.technique))
  )
}

/** A Custom frame built from its Frame shape and settings round a Canvas position: its bounding rectangle in its own
 * Technique and its layer's Bead (by default the Bead a Frame of the Project is made in, ticket 0723), its first row
 * and column the Canvas positions half that rectangle up and left, snapped as a Frame starts. */
function customSheet(project: Project, shape: FrameShapeId, settings: FrameSettings, centre: GridPosition, quarterTurns?: QuarterTurns, woven?: Weave, ref: FrameRef = FIRST_FRAME, cell: BeadCell | undefined = frameWeave(project, ref).cell): FrameSheet {
  const weave = weaveOf(woven ?? { technique: frameShapeOf({ shape })!.techniques[0] })
  const read = settingsOf({ shape, settings, ...weave })!
  const { rows, columns } = customFrameSize(shape, read, quarterTurns, weave, cell)
  const half = canvasDistance(project, weave, Math.floor(rows / 2), Math.floor(columns / 2), ref)
  const canvas = canvasWeave(project)
  return { row: snapRow(canvas, centre.row - half.row), column: snapColumn(canvas, centre.column - half.column), rows, columns, beads: {}, ...weave, shape, settings: read, ...(quarterTurns ? { quarterTurns } : {}) }
}

/** A new Custom frame: its Frame shape, its size or all its settings, the Canvas position it goes round, any beads, its
 * Weave, a Starter's (ticket 0671), or else the first Technique its shape supports, and the quarters it lies turned at
 * (a Starter's shape standing as charted on a turned Canvas, ticket 0872). */
type CustomPlacement = { shape: FrameShapeId; centre: GridPosition; beads?: BeadMap; weave?: Weave; quarterTurns?: QuarterTurns } & ({ size: number } | { settings: FrameSettings })

/** The Project with a new Custom frame in place of any Frame there (ticket 0592), holding the beads given that its
 * layout has a position for: Row progress starts at the first pass, along its rows, and the Canvas keeps every bead. */
function placedCustomFrame(project: Project, placement: CustomPlacement, ref: FrameRef): Project {
  const { shape, centre, beads = {}, weave, quarterTurns } = placement
  const settings = 'settings' in placement ? placement.settings : { [sizeSettingOf({ shape })!.id]: placement.size }
  const sheet = customSheet(project, shape, settings, centre, quarterTurns, weave, ref)
  return touchFrameSheet(project, { ...sheet, beads: beadsOn(beads, frameGeometry(sheet)), rowProgress: startingRowProgressOf(sheet) }, { anew: true, frame: ref })
}

/** A Custom frame laid out again from new settings round its own centre, as it lay in `before` (the Project itself, or
 * the one before its Bead changed): each bead whose position is still in the layout shows, the rest fold, kept by their
 * position's name, until a layout has it again (ticket 0640). */
function resettled<T extends FrameSheet>(project: Project, frame: T, settings: FrameSettings, quarterTurns: QuarterTurns | undefined, before: Project = project, ref: FrameRef = FIRST_FRAME): Omit<T, 'quarterTurns' | 'folded'> & FrameSheet {
  const centre = canvasDistance(before, heldWeave(before, ref)!, Math.floor(frame.rows / 2), Math.floor(frame.columns / 2))
  const sheet = customSheet(project, frame.shape!, settings, { row: frame.row + centre.row, column: frame.column + centre.column }, quarterTurns, heldWeave(project, ref), ref)
  const { quarterTurns: _turned, folded: _folded, ...rest } = frame
  const geometry = frameGeometry(sheet)
  return { ...rest, ...sheet, ...refoldSheet(frame, (position) => geometry.hasPosition(position)) }
}

/** The edges of a Frame's rectangle a resize handle moved to make `asked`: the top or left where its first row or column
 * moved, else the bottom or right where its rows or columns changed. */
function movedEdges(frame: Rect, asked: Rect): FrameEdge[] {
  return [
    ...(asked.row !== frame.row ? (['top'] as const) : asked.rows !== frame.rows ? (['bottom'] as const) : []),
    ...(asked.column !== frame.column ? (['left'] as const) : asked.columns !== frame.columns ? (['right'] as const) : []),
  ]
}

/** A Custom frame laid out again by its resize handles (ticket 0814): on each side of its rectangle a handle moved, only
 * the moved edge goes, the one across from it staying where it was on the Canvas; along the other its centre stays. */
function keptEdges<T extends FrameSheet>(project: Project, before: FrameSheet, sheet: T, edges: readonly FrameEdge[], ref: FrameRef = FIRST_FRAME): T {
  const weave = heldWeave(project, ref)!
  const was = canvasDistance(project, weave, before.rows, before.columns)
  const now = canvasDistance(project, weave, sheet.rows, sheet.columns)
  const canvas = canvasWeave(project)
  const row = edges.includes('top') ? before.row + was.row - now.row : edges.includes('bottom') ? before.row : sheet.row
  const column = edges.includes('left') ? before.column + was.column - now.column : edges.includes('right') ? before.column : sheet.column
  return { ...sheet, row: snapRow(canvas, row), column: snapColumn(canvas, column) }
}

/** A Custom frame laid out again in the Bead its layer now has in `after`, `before` with a Bead replaced (ticket 0723):
 * a round shape packs by its Bead, so its rectangle follows round its own centre, as a size change's does, every bead
 * keeping its name and colour. `after` itself without a Frame shape, or where its rectangle is as it was. */
export function relaidInBead(before: Project, after: Project, ref: FrameRef = FIRST_FRAME): Project {
  const frame = frameById(after, ref)
  if (!frame || !frameShapeOf(frame)) return after
  const sheet = resettled(after, frame, frame.settings ?? {}, frame.quarterTurns, before)
  return sameFrame(frame, sheet) ? after : withFrameSheet(after, sheet, { frame: ref })
}

/** Rotate Frame on a Custom frame (ticket 0594): its layout a quarter turn further clockwise round its own centre, its
 * rectangle's sides swapped; every bead keeps its name, so it turns with its panel. None for a Frame without a Frame shape. */
export function turnedCustomFrame(project: Project, ref: FrameRef = FIRST_FRAME): Project | undefined {
  const frame = frameById(project, ref)
  if (!frame || !frameShapeOf(frame)) return undefined
  const turns = ((frame.quarterTurns ?? 0) + 1) % 4
  return touchFrameSheet(project, resettled(project, frame, frame.settings ?? {}, turns === 0 ? undefined : (turns as QuarterTurns)), { frame: ref })
}

/** The beads of a map that have a position in a Frame's geometry (a Custom frame's layout, or its rectangle). */
function beadsOn(beads: BeadMap, geometry: LayerGeometry): BeadMap {
  const gone: BeadChange[] = []
  forEachBead(beads, (row, column) => {
    if (!geometry.hasPosition({ row, column })) gone.push({ row, column, color: null })
  })
  return withColors(beads, gone)
}

/** The Project with a Frame at `rectangle` holding a copy of the beads you see inside it (ADR 0066, ticket 1215). The
 * Canvas keeps every bead, hidden under the Frame. A Frame there before is replaced but for its id, Letters switch, Row
 * progress and Bead (`inCanvasBead`: the Canvas's, for a Frame in a Bead of another size, ticket 0665). */
function madeFrame(project: Project, rectangle: Rect, inCanvasBead = false, ref: FrameRef = FIRST_FRAME): Project {
  const previous = frameById(project, ref)
  const copied = beadsInFrame(shownBeads(project), rectangle)
  const taken = pieceNamesOf(project)?.find((entry) => frameContains(rectangle, entry))?.name
  const named = taken ?? previous?.name
  const framed = keptLayer(withFrame(withFrameSheet(project, undefined, { frame: ref }), rectangle, ref), previous, inCanvasBead, ref)
  return withLayer(framed, ref, { beads: shiftedBeads(copied, -rectangle.row, -rectangle.column), ...(named ? { name: named } : {}) })
}

/** A Frame made anew in place of `previous` as the same layer (ADR 0079): its id, Bead, Letters switch and Row progress,
 * the pointers kept inside it; the Bead it was made in where `inCanvasBead`. */
function keptLayer(project: Project, previous: FrameLayer | undefined, inCanvasBead: boolean, ref: FrameRef = FIRST_FRAME): Project {
  const made = frameById(project, ref)
  if (!previous || !made) return project
  const { beadId, bead } = made
  const ownBead = inCanvasBead ? { beadId, ...(bead ? { bead } : {}) } : {}
  return withFrameSheet(project, { ...made, ...frameIdentity(previous), ...ownBead, rowProgress: clampPointer(previous.rowProgress, made, frameQuarterTurnOf(project, ref)) }, { frame: ref })
}

/** The Project with a new empty Frame at `place.frame`, woven as `place.weave`, instead of the one it had (ticket 495):
 * Row progress starts at the first pass, and the Canvas keeps every bead. */
function placedFrame(project: Project, place: FramePlacement, ref: FrameRef): Project {
  const { row, column, rows, columns } = place.frame
  const sheet = { row, column, rows, columns, ...weaveOf(place.weave), ...(place.quarterTurns ? { quarterTurns: place.quarterTurns } : {}) }
  const frame = { ...sheet, beads: place.beads ? beadsOn(place.beads, frameGeometry(sheet)) : {} }
  // Its progress starts afresh, in its Technique's way as it lies, whatever way the Frame it replaces ran.
  return touchFrameSheet(project, { ...frame, rowProgress: startingRowProgressOf(sheet) }, { anew: true, frame: ref })
}

/** The Project with its Custom frame become its shape round `rectangle` (ADR 0079, ticket 0669), the smallest that
 * covers it, turned and woven as it was: the beads you see in the rectangle are copied onto its layout, each as a Paste
 * lands it, and the Canvas keeps all of them (ticket 1215). It stays the same layer. */
function madeCustomFrame(project: Project, rectangle: Rect, ref: FrameRef = FIRST_FRAME): Project {
  const frame = frameById(project, ref)!
  const { cell } = frameWeave(project, ref)
  const settings = sizedSettings({ ...frame, cell }, coveringSize(project, frame, rectangle), 'cover')!
  const centre = { row: rectangle.row + Math.floor(rectangle.rows / 2), column: rectangle.column + Math.floor(rectangle.columns / 2) }
  const sheet = customSheet(project, frame.shape!, settings, centre, frame.quarterTurns, heldWeave(project, ref), ref, cell)
  const framed = withFrameSheet(project, { ...sheet, ...frameIdentity(frame) }, { frame: ref })
  const copied: (GridPosition & { color: string })[] = []
  forEachBead(beadsInFrame(shownBeads(project), footprintOf(framed, ref)!), (row, column, color) => copied.push({ row: row - sheet.row, column: column - sheet.column, color }))
  const made = withLayer(framed, ref, { beads: withColors({}, copiedOntoLayout(layerSheet(framed, ref), copied)) })
  return frame.name === undefined ? made : withFrameSheet(made, { ...frameById(made, ref)!, name: frame.name }, { frame: ref })
}

/** The fewest rows and columns of a Weave that reach as far on the Canvas as a rectangle of its positions. */
function coveringSize(project: Project, weave: Weave, rectangle: Rect): { rows: number; columns: number } {
  let rows = 1
  while (canvasDistance(project, weave, rows, 0).row < rectangle.rows) rows += 1
  let columns = 1
  while (canvasDistance(project, weave, 0, columns).column < rectangle.columns) columns += 1
  return { rows, columns }
}

/** Where a position goes when one line of `area` is taken out and the area's later beads shift up or left; undefined
 * for a position on the removed line. */
export function shiftedByLine(area: Rect, line: AreaLine, position: GridPosition): GridPosition | undefined {
  if (!frameContains(area, position)) {
    return position
  }
  const relative = line.axis === 'row' ? position.row - area.row : position.column - area.column
  if (relative === line.index) {
    return undefined
  }
  if (relative > line.index) {
    return {
      row: line.axis === 'row' ? position.row - 1 : position.row,
      column: line.axis === 'column' ? position.column - 1 : position.column,
    }
  }
  return position
}

/** Where a position of a sheet goes when one of its whole lines is taken out, the line running on beyond its edge: past
 * the line it shifts up or left, on it it goes (undefined). */
function shiftedAcrossLine(line: AreaLine, position: GridPosition): GridPosition | undefined {
  const along = line.axis === 'row' ? position.row : position.column
  if (along === line.index) return undefined
  if (along < line.index) return position
  return line.axis === 'row' ? { row: position.row - 1, column: position.column } : { row: position.row, column: position.column - 1 }
}

/** The Project's beads with one line of `area` taken out and the area's later beads shifted up or left to close the
 * gap. */
export function beadsWithoutLine(beads: BeadMap, area: Rect, line: AreaLine): BeadMap {
  const result: BeadMap = {}
  forEachBead(beads, (row, column, color) => {
    const to = shiftedByLine(area, line, { row, column })
    if (!to) {
      return
    }
    result[to.row] ??= {}
    result[to.row]![to.column] = color
  })
  return result
}

/** The Canvas woven in another Technique or with other settings (tickets 351, 477, 492, 507, 0625): its beads keep their
 * row and column where the Weave has a position there, the names of Pieces follow them. Row progress belongs to the
 * Frame, so this is allowed at any time. A Weave that lays positions out as before gives the same Project back. */
export function changeCanvasWeave(project: Project, change: WeaveChange): Project {
  const rewoven = withWeave(project, 'canvas', change)
  return rewoven === project ? project : carryNames(project, rewoven)
}

/** Set Frame around the picture (ticket 0883): the Frame made round `frame` as Frame from Selection makes it; a Custom
 * frame is first taken off as Remove Frame takes it, its beads with it (ticket 1215), so the new one is rectangular. */
export function framedAround(project: Project, frame: Rect, ref: FrameRef = FIRST_FRAME): FrameChangeResult {
  if (!frameById(project, ref)?.shape) return changeFrame(project, { make: frame }, ref)
  const refused = frameChangeRefusal(project, { make: frame }, ref)
  if (refused) return { kind: 'refused', reason: refused }
  const removed = changeFrame(project, { remove: true }, ref)
  if (removed.kind !== 'changed') return removed
  const made = changeFrame(removed.project, { make: frame }, ref)
  return made.kind === 'unchanged' ? removed : made
}
