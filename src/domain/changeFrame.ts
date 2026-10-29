import {
  beadsInFrame,
  beadsOver,
  beadsWithout,
  forEachBead,
  frameContains,
  hasBeads,
  shiftedBeads,
  withColors,
  type BeadChange,
  type BeadMap,
  type Rect,
  type FrameSheet,
  sameFrame,
} from './canvas'
import { movedFrame, snapRow, withFrame, withFrameGiving } from './frame'
import { frameGeometryOf, layerSheet, shownBeads } from './layers'
import { droppedFromLayout, droppedFromTurnedGrid, liftedOntoLayout } from './customSelection'
import type { GridPosition } from './grid'
import { footprintOf } from './footprint'
import { refoldSheet, withEachBead } from './folding'
import { canvasLift, grownFrame, namedPieceTaken } from './frameGrowth'
import {
  customFrameSize,
  frameAllows,
  frameGeometry,
  frameShapeOf,
  settingsHolding,
  settingsOf,
  sizedSettings,
  sizeSettingOf,
  techniquesOf,
  type FrameShapeId,
  type FrameSettings,
  type QuarterTurns,
} from './frameShape'
import type { LayerGeometry } from './layerGeometry'
import type { Weave } from './weave'
import { carryNames, namedPieceCutBy, namedPieces } from './pieceNames'
import { numericKey, pieceBeadsAt } from './pieces'
import { canvasDistance, canvasWeave, laidOnCanvas, sameBeadSize, weaveOf } from './layerWeave'
import { withWovenPalette } from './projectBead'
import { clampPointer, firstPasses, progressWithoutLine, rowProgressOf, rowProgressStarted } from './rowProgress'
import { sameBeads } from './layerBeads'
import { withWeave, type WeaveChange } from './weaveSwitch'
import { beadsOfLayer, frameIdentity, frameOf, heldWeave, pieceNamesOf, touchFrameSheet, withFrameSheet, withLayer, withPieceNames } from './layerRecord'
import type { FrameLayer, Project } from './project'
import type { AreaLine } from './removeLine'

// The one operation behind every change of the Frame (ticket 361): make a Frame, resize, move, Fit to drawing, Remove
// Frame and Remove row/column. It owns the rules: Row progress's lock (Remove Frame passes it, clearing the passes;
// moving, naming and Remove row/column keep them), Row progress following the Frame.
export type FrameChange =
  /** Resize the Frame (handles, steppers, typed size), its beads keeping their place: woven like the Canvas it lays what
   * it gives up there and lifts what it grows over (tickets 513, 0639), woven unlike it it folds them (ticket 0638). A
   * Custom frame steps its size setting to the step nearest the rectangle instead (ticket 0669). */
  | { set: Rect }
  /** Frame from Selection and Fit to drawing (ADR 0066): the Frame becomes this rectangle and the Canvas's beads inside
   * it move into it. A Frame already there lays its beads back on the Canvas first. A Custom frame there becomes its
   * shape round the rectangle instead, the smallest that covers it (ticket 0669). */
  | { make: Rect }
  | { remove: true }
  /** One whole row or column of the Frame, counted from its first; allowed after Row progress has started, a finished
   * row taking its passes with it (ticket 0647). */
  | { removeLine: AreaLine }
  /** Move the Frame with its beads by whole rows and columns (ticket 452, ADR 0054); allowed after Row progress has
   * started, which then travels with the Frame. */
  | { move: { rows: number; columns: number } }
  /** Change the Frame's Technique or its settings (tickets 351, 477, 492, 507, 0625): the geometry changes and every
   * bead keeps its row and column. A Technique takes its settings with it (brick stitch its Brick block); the same
   * Technique changes just those. */
  | WeaveChange
  /** Put a new Frame in its own weave in place of any Frame there (ticket 495): the old Frame's beads and passes go,
   * the Canvas under the new one is hidden, not changed. Empty, or holding a Starter's design (ticket 0633). */
  | { place: { frame: Rect; weave: Weave; beads?: BeadMap } }
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
  /** The new Frame would cut through a named Piece (an unframed Schema) on the Canvas, which it must take whole or
   * leave whole (ticket 407). */
  | 'cuts-schema'
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
export function frameChangeDiscardsProgress(project: Project, change: FrameChange): boolean {
  return 'remove' in change && rowProgressStarted(project)
}

/** Why the change would be refused on this Project, or undefined when it would be allowed. Cheap: it builds nothing. */
export function frameChangeRefusal(project: Project, change: FrameChange): FrameChangeRefusal | undefined {
  // Remove Frame is how the weaver lets go of finished passes: it clears them with the Frame (ticket 426, ADR 0055).
  if (rowProgressStarted(project) && !frameChangeDiscardsProgress(project, change) && !('move' in change) && !('name' in change) && !('removeLine' in change)) {
    return 'locked'
  }
  const frame = frameOf(project)
  if (frame && frameRefuses(frame, change)) {
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
  if ('make' in change && namedPieceCutBy(project, change.make)) {
    return 'cuts-schema'
  }
  return undefined
}

/** The Project with the Frame changed, or why not. The Palette follows the woven layer's Bead where the change swaps
 * it, as Remove Frame or Frame from Selection over a Frame in another Bead does (ticket 0665), in the same step. */
export function changeFrame(project: Project, change: FrameChange): FrameChangeResult {
  const result = frameChanged(project, change)
  return result.kind === 'changed' ? { kind: 'changed', project: withWovenPalette(project, result.project) } : result
}

function frameChanged(project: Project, change: FrameChange): FrameChangeResult {
  const reason = frameChangeRefusal(project, change)
  if (reason) {
    return { kind: 'refused', reason }
  }

  if ('removeLine' in change) {
    const frame = frameOf(project)!
    const { axis } = change.removeLine
    const smaller = { ...frame, rows: axis === 'row' ? frame.rows - 1 : frame.rows, columns: axis === 'column' ? frame.columns - 1 : frame.columns }
    // The line runs on through the Folded beads beyond the Frame's edge, so they shift with the rest (ticket 0638).
    const { folded: _folded, ...kept } = frame
    const carried = withEachBead(frame, (position) => shiftedAcrossLine(change.removeLine, position))
    const rowProgress = progressWithoutLine(project, change.removeLine)
    return { kind: 'changed', project: withFrame(withFrameSheet(project, { ...kept, ...carried, rowProgress }), smaller) }
  }

  if ('move' in change) {
    const frame = frameOf(project)!
    const moved = movedFrame(frame, change.move.rows, change.move.columns)
    if (sameFrame(frame, moved)) {
      return { kind: 'unchanged', project }
    }
    // The Frame carries its beads and the passes; the Canvas under the destination stays as it is, hidden (ADR 0066).
    return { kind: 'changed', project: touchFrameSheet(project, { ...frame, row: moved.row, column: moved.column }) }
  }

  if ('name' in change) {
    const { name: _previous, ...frame } = frameOf(project)!
    if (change.name === (frameOf(project)!.name ?? '')) {
      return { kind: 'unchanged', project }
    }
    return { kind: 'changed', project: touchFrameSheet(project, { ...frame, ...(change.name ? { name: change.name } : {}) }) }
  }

  if ('place' in change) {
    return { kind: 'changed', project: placedFrame(project, change.place) }
  }

  if ('custom' in change) {
    return { kind: 'changed', project: placedCustomFrame(project, change.custom) }
  }

  // A Custom frame's resize handles step its size setting (ADR 0079).
  const current = frameOf(project)
  const sized = 'set' in change && current ? sizedSettings(current, change.set, 'nearest') : undefined
  if ('settings' in change || sized) {
    const frame = frameOf(project)!
    const asked = 'settings' in change ? change.settings : sized
    const settings = settingsOf({ shape: frame.shape, settings: { ...frame.settings, ...asked } })!
    if (sameSettings(settings, settingsOf(frame)!)) {
      return { kind: 'unchanged', project }
    }
    return { kind: 'changed', project: touchFrameSheet(project, resettled(project, frame, settings, frame.quarterTurns)) }
  }

  if ('remove' in change) {
    return frameOf(project) ? { kind: 'changed', project: removedFrame(project) } : { kind: 'unchanged', project }
  }

  if ('technique' in change || 'techniqueSettings' in change) {
    const rewoven = withWeave(project, 'frame', change)
    return rewoven === project ? { kind: 'unchanged', project } : { kind: 'changed', project: rewoven }
  }

  if ('make' in change) {
    const made = current && sizeSettingOf(current) ? madeCustomFrame(project, change.make) : current && !sameBeadSize(project) ? madeOverOtherBead(project, change.make) : madeFrame(project, change.make)
    return sameFrame(current, frameOf(made)) && sameBeads(project, made) && current?.name === frameOf(made)?.name
      ? { kind: 'unchanged', project }
      : { kind: 'changed', project: made }
  }

  const { rectangle } = grownFrame(project, change.set)
  if (sameFrame(frameOf(project), rectangle)) {
    return { kind: 'unchanged', project }
  }
  return { kind: 'changed', project: resizedFrame(project, rectangle) }
}

/** Whether the Frame refuses this change: what it does not offer (Remove row/column on a Custom frame), a Technique
 * its shape does not support, settings for a Frame without a Frame shape. */
function frameRefuses(frame: FrameSheet, change: FrameChange): boolean {
  if ('settings' in change) return !frameShapeOf(frame)
  return (
    ('set' in change && !frameAllows(frame, 'resize')) ||
    ('removeLine' in change && !frameAllows(frame, 'remove-line')) ||
    ('make' in change && !frameAllows(frame, 'from-selection')) ||
    (('technique' in change || 'techniqueSettings' in change) && !frameAllows(frame, 'technique')) ||
    ('technique' in change && !techniquesOf(frame).includes(change.technique))
  )
}

/** A Custom frame built from its Frame shape and settings round a Canvas position: its bounding rectangle in its own
 * Technique, its first row and column the Canvas positions half that rectangle up and left, snapped as a Frame starts. */
function customSheet(project: Project, shape: FrameShapeId, settings: FrameSettings, centre: GridPosition, quarterTurns?: QuarterTurns, woven?: Weave): FrameSheet {
  const read = settingsOf({ shape, settings })!
  const weave = weaveOf(woven ?? { technique: frameShapeOf({ shape })!.techniques[0] })
  const { rows, columns } = customFrameSize(shape, read, quarterTurns, weave.technique)
  const half = canvasDistance(project, weave, Math.floor(rows / 2), Math.floor(columns / 2))
  const canvas = canvasWeave(project)
  return { row: snapRow(canvas, centre.row - half.row), column: centre.column - half.column, rows, columns, beads: {}, ...weave, shape, settings: read, ...(quarterTurns ? { quarterTurns } : {}) }
}

/** A new Custom frame: its Frame shape, its size or all its settings, the Canvas position it goes round, any beads, and
 * its Weave, a Starter's (ticket 0671), or else the first Technique its shape supports. */
type CustomPlacement = { shape: FrameShapeId; centre: GridPosition; beads?: BeadMap; weave?: Weave } & ({ size: number } | { settings: FrameSettings })

/** Whether two Custom frames' settings, as `settingsOf` reads them, are the same. */
function sameSettings(a: FrameSettings, b: FrameSettings): boolean {
  const names = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof FrameSettings>
  return [...names].every((name) => a[name] === b[name])
}

/** The Project with a new Custom frame in place of any Frame there (ticket 0592), holding the beads given that its
 * layout has a position for: Row progress starts at the first pass, and the Canvas keeps every bead. */
function placedCustomFrame(project: Project, placement: CustomPlacement): Project {
  const { shape, centre, beads = {}, weave } = placement
  const settings = 'settings' in placement ? placement.settings : { [sizeSettingOf({ shape })!.id]: placement.size }
  const sheet = customSheet(project, shape, settings, centre, undefined, weave)
  return touchFrameSheet(project, { ...sheet, beads: beadsOn(beads, frameGeometry(sheet)), rowProgress: firstPasses(rowProgressOf(project)) })
}

/** A Custom frame laid out again from new settings round its own centre: each bead whose position is still in the
 * layout shows, the rest fold, kept by their position's name, until a layout has it again (ticket 0640). */
function resettled<T extends FrameSheet>(project: Project, frame: T, settings: FrameSettings, quarterTurns: QuarterTurns | undefined): Omit<T, 'quarterTurns' | 'folded'> & FrameSheet {
  const centre = canvasDistance(project, heldWeave(project, 'frame')!, Math.floor(frame.rows / 2), Math.floor(frame.columns / 2))
  const sheet = customSheet(project, frame.shape!, settings, { row: frame.row + centre.row, column: frame.column + centre.column }, quarterTurns, heldWeave(project, 'frame'))
  const { quarterTurns: _turned, folded: _folded, ...rest } = frame
  const geometry = frameGeometry(sheet)
  return { ...rest, ...sheet, ...refoldSheet(frame, (position) => geometry.hasPosition(position)) }
}

/** Rotate Frame on a Custom frame (ticket 0594): its layout a quarter turn further clockwise round its own centre, its
 * rectangle's sides swapped; every bead keeps its name, so it turns with its panel. None for a Frame without a Frame shape. */
export function turnedCustomFrame(project: Project): Project | undefined {
  const frame = frameOf(project)
  if (!frame || !frameShapeOf(frame)) return undefined
  const turns = ((frame.quarterTurns ?? 0) + 1) % 4
  return touchFrameSheet(project, resettled(project, frame, frame.settings ?? {}, turns === 0 ? undefined : (turns as QuarterTurns)))
}

/** The beads of a map that have a position in a Frame's geometry (a Custom frame's layout, or its rectangle). */
function beadsOn(beads: BeadMap, geometry: LayerGeometry): BeadMap {
  const gone: BeadChange[] = []
  forEachBead(beads, (row, column) => {
    if (!geometry.hasPosition({ row, column })) gone.push({ row, column, color: null })
  })
  return withColors(beads, gone)
}

/** The Project with its Frame set to `rectangle`. Woven like the Canvas, only the Frame's beads in the strip it gives up
 * land there (ticket 513), so a Canvas bead under an empty position shows again, and what it grows over is lifted
 * (ticket 0639); woven unlike it, it folds what it gives up (ticket 0638) and the Canvas is left alone. */
function resizedFrame(project: Project, rectangle: Rect): Project {
  const { project: resized, given, taken } = withFrameGiving(project, rectangle, canvasLift(project, rectangle))
  if (!hasBeads(given) && !hasBeads(taken)) {
    return resized
  }
  const lifted: BeadChange[] = []
  forEachBead(taken, (row, column) => lifted.push({ row, column, color: null }))
  const carried = carryNames(project, withLayer(resized, 'canvas', { beads: beadsOver(withColors(beadsOfLayer(project, 'canvas'), lifted), given) }))
  // A named Piece taken whole gives the Frame its name, as Frame from Selection does.
  const name = namedPieceTaken(project, taken) ?? frameOf(resized)!.name
  return name === undefined ? carried : withFrameSheet(carried, { ...frameOf(carried)!, name })
}

/** The Project with a Frame at `rectangle` holding the Canvas's beads inside it (ADR 0066). A Frame there before lays
 * its beads on the Canvas where they stand, over what they covered. A named Piece the rectangle takes whole gives the
 * Frame its name. */
function madeFrame(original: Project, rectangle: Rect): Project {
  const project = withFoldedLaid(original)
  const previous = frameOf(project)
  const [under, held] = [beadsOfLayer(project, 'canvas'), beadsOfLayer(project, 'frame')]
  // What shows is lifted. Canvas beads hidden under a Frame there before stay on the Canvas; its own beads outside the
  // new rectangle go back on it.
  const hidden = previous ? beadsInFrame(beadsInFrame(under, rectangle), footprintOf(project)!) : {}
  const left = previous ? beadsWithout(shiftedBeads(held!, previous.row, previous.column), rectangle) : {}
  const canvas = beadsOver(beadsOver(beadsWithout(under, rectangle), hidden), left)
  const lifted = beadsInFrame(shownBeads(project), rectangle)
  const taken = pieceNamesOf(project)?.find((entry) => frameContains(rectangle, entry))?.name
  const named = taken ?? previous?.name
  // A Frame that moves to another named Schema leaves the one it held behind, named and unframed.
  const first = previous && taken !== undefined && previous.name ? firstBead(held!) : undefined
  const framed = keptLayer(withFrame(withLayer(withFrameSheet(project, undefined), 'canvas', { beads: canvas }), rectangle), previous)
  const carried = carryNames(project, withLayer(framed, 'frame', { beads: shiftedBeads(lifted, -rectangle.row, -rectangle.column), ...(named ? { name: named } : {}) }))
  return first && previous?.name ? withPieceNames(carried, [...(pieceNamesOf(carried) ?? []), { name: previous.name, row: first.row + previous.row, column: first.column + previous.column }]) : carried
}

/** Frame from Selection over a Frame in a Bead of another size than the Canvas's (ticket 0665): that Frame lays its
 * beads on the Canvas first, through millimetres, as Remove Frame does, and the new one is made from the Canvas in its
 * Bead, as the same layer. Its name stays with it unless Remove Frame left it on a Piece the new one does not take. */
function madeOverOtherBead(project: Project, rectangle: Rect): Project {
  const frame = frameOf(project)!
  const made = madeFrame(removedFrame(project), rectangle)
  const { beadId, bead } = frameOf(made)!
  const kept = withFrameSheet(made, { ...frameOf(made)!, ...frameIdentity(frame), beadId, ...(bead ? { bead } : {}), rowProgress: clampPointer(frame.rowProgress, frameOf(made)!) })
  const keepsName = frame.name !== undefined && frameOf(kept)!.name === undefined && !pieceNamesOf(kept)?.some((entry) => entry.name === frame.name)
  return keepsName ? withFrameSheet(kept, { ...frameOf(kept)!, name: frame.name }) : kept
}

/** A Frame made anew in place of `previous` as the same layer (ADR 0079): its id, Bead, Letters switch and Row progress,
 * the pointers kept inside it. */
function keptLayer(project: Project, previous: FrameLayer | undefined): Project {
  const made = frameOf(project)
  if (!previous || !made) return project
  return withFrameSheet(project, { ...made, ...frameIdentity(previous), rowProgress: clampPointer(previous.rowProgress, made) })
}

/** The Project with its Frame's Folded beads laid on the Canvas where they stand, over what is there (ticket 0638), as
 * a Frame made elsewhere lays the beads it shows. */
function withFoldedLaid(project: Project): Project {
  const frame = frameOf(project)
  if (!frame?.folded) return project
  const { folded, ...shown } = frame
  return withLayer(withFrameSheet(project, shown), 'canvas', { beads: beadsOver(beadsOfLayer(project, 'canvas'), shiftedBeads(folded, frame.row, frame.column)) })
}

/** The Project with a new empty Frame at `place.frame`, woven as `place.weave`, instead of the one it had (ticket 495):
 * Row progress starts at the first pass, and the Canvas keeps every bead. */
function placedFrame(project: Project, place: { frame: Rect; weave: Weave; beads?: BeadMap }): Project {
  const { row, column, rows, columns } = place.frame
  const sheet = { row, column, rows, columns, ...weaveOf(place.weave) }
  const frame = { ...sheet, beads: place.beads ? beadsOn(place.beads, frameGeometry(sheet)) : {} }
  return touchFrameSheet(project, { ...frame, rowProgress: firstPasses(rowProgressOf(project)) })
}

/** The Project with its Custom frame become its shape round `rectangle` (ADR 0079, ticket 0669), the smallest that
 * covers it, turned and woven as it was: the Frame there lays its beads on the Canvas first, as Remove Frame does, then
 * the Canvas beads the new one hides are lifted in, each as a Paste lands it; one on a Seam or Off-shape stays, hidden. */
function madeCustomFrame(project: Project, rectangle: Rect): Project {
  const frame = frameOf(project)!
  const settings = sizedSettings(frame, coveringSize(project, frame, rectangle), 'cover')!
  const centre = { row: rectangle.row + Math.floor(rectangle.rows / 2), column: rectangle.column + Math.floor(rectangle.columns / 2) }
  const laid = removedFrame(project)
  const sheet = customSheet(laid, frame.shape!, settings, centre, frame.quarterTurns, heldWeave(project, 'frame'))
  // It stays the same layer: its id, Bead, Letters switch and Row progress.
  const framed = withFrameSheet(laid, { ...sheet, ...frameIdentity(frame) })
  const under = beadsOfLayer(laid, 'canvas')
  const hidden: (GridPosition & { color: string })[] = []
  forEachBead(beadsInFrame(under, footprintOf(framed)!), (row, column, color) => hidden.push({ row: row - sheet.row, column: column - sheet.column, color }))
  const { landed, lifted } = liftedOntoLayout(layerSheet(framed, 'frame'), hidden)
  const canvas = withColors(under, lifted.map(({ row, column }) => ({ row: row + sheet.row, column: column + sheet.column, color: null })))
  const made = carryNames(laid, withLayer(withLayer(framed, 'canvas', { beads: canvas }), 'frame', { beads: withColors({}, landed) }))
  // The name stays with the Frame unless Remove Frame left it on a Piece on the Canvas.
  const keepsName = frame.name !== undefined && !pieceNamesOf(made)?.some((entry) => entry.name === frame.name)
  return keepsName ? withFrameSheet(made, { ...frameOf(made)!, name: frame.name }) : made
}

/** The fewest rows and columns of a Weave that reach as far on the Canvas as a rectangle of its positions. */
function coveringSize(project: Project, weave: Weave, rectangle: Rect): { rows: number; columns: number } {
  let rows = 1
  while (canvasDistance(project, weave, rows, 0).row < rectangle.rows) rows += 1
  let columns = 1
  while (canvasDistance(project, weave, 0, columns).column < rectangle.columns) columns += 1
  return { rows, columns }
}

/** The Frame's beads, shown and Folded (ticket 0638), on the Canvas as `laidOnCanvas` lays a grid's (ticket 0665); a
 * Custom frame's or a turned Frame's first each on its own cell nearest its centre (ADR 0077, ticket 0669), a Custom
 * frame's Folded ones where growing it back would show them. */
function droppedBeads(project: Project): { shown: BeadMap; folded: BeadMap } {
  const frame = frameOf(project)!
  const beads = beadsOfLayer(project, 'frame')!
  const folded = frame.folded ?? {}
  // In a Bead of another size each is read on the Canvas through millimetres (ticket 0665).
  if (frameGeometryOf(project).grid) {
    return { shown: laidOnCanvas(project, beads, frame), folded: laidOnCanvas(project, folded, frame) }
  }
  const onCanvas = (sheet: Rect, dropped: BeadChange[]) => laidOnCanvas(project, withColors({}, dropped), sheet)
  const sheet = layerSheet(project, 'frame')
  const shown = onCanvas(frame, droppedFromLayout(sheet))
  if (!hasBeads(folded)) return { shown, folded: {} }
  if (!frameShapeOf(frame)) return { shown, folded: onCanvas(frame, droppedFromTurnedGrid(sheet, folded)) }
  const positions: GridPosition[] = []
  forEachBead(folded, (row, column) => positions.push({ row, column }))
  // The Folded beads as the beads it shows, on the Frame grown to hold them.
  const grown = resettled(project, { ...frame, beads: folded, folded: undefined }, settingsHolding(frame, positions), frame.quarterTurns)
  return { shown, folded: onCanvas(grown, droppedFromLayout(layerSheet(withFrameSheet(project, grown), 'frame'))) }
}

/** The Project without its Frame (ticket 497): the Frame's footprint on the Canvas is cleared and its beads dropped in,
 * so the picture looks as the Frame did, a Custom frame's too (ADR 0079). The Frame's name stays on the Piece its beads
 * form (the larger one if several); the passes go with the Frame. */
function removedFrame(project: Project): Project {
  const frame = frameOf(project)!
  const { shown: dropped, folded } = droppedBeads(project)
  // Its Folded beads land where they stand too, over the Canvas, under the beads it shows (ticket 0638).
  const unfolded = beadsOver(beadsWithout(beadsOfLayer(project, 'canvas'), footprintOf(project)!), folded)
  const beads = beadsOver(unfolded, dropped)
  const canvas = carryNames(project, withLayer(withFrame(project, undefined), 'canvas', { beads }))
  const name = frame.name
  const weave = heldWeave(canvas, 'canvas')
  const landed = name ? largestPieceBead(beads, weave, dropped) : undefined
  if (!name || !landed) {
    return canvas
  }
  const piece = new Set(pieceBeadsAt(beads, weave, landed).map(numericKey))
  const names = pieceNamesOf(canvas) ?? []
  const rival = namedPieces(canvas).find((named) => names.some((entry) => entry.name === named.name && piece.has(numericKey(entry))))
  if (rival && rival.beads >= piece.size) {
    return canvas
  }
  return withPieceNames(canvas, [...names.filter((entry) => !piece.has(numericKey(entry))), { name, ...landed }])
}

/** A bead of the largest Piece that `among` forms in `beads` (ties to the first read), or undefined when there is none. */
function largestPieceBead(beads: BeadMap, weave: Weave, among: BeadMap): GridPosition | undefined {
  const seen = new Set<number>()
  let best: { at: GridPosition; size: number } | undefined
  forEachBead(among, (row, column) => {
    if (seen.has(numericKey({ row, column }))) return
    const members = pieceBeadsAt(beads, weave, { row, column })
    members.forEach((at) => seen.add(numericKey(at)))
    if (!best || members.length > best.size) best = { at: { row, column }, size: members.length }
  })
  return best?.at
}

/** The first bead of a map, reading row by row. */
function firstBead(beads: BeadMap): GridPosition | undefined {
  let found: GridPosition | undefined
  forEachBead(beads, (row, column) => {
    found ??= { row, column }
  })
  return found
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
