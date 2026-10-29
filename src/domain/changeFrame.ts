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
import { shownBeads } from './layers'
import type { GridPosition } from './grid'
import { footprintOf } from './footprint'
import { refoldSheet, withEachBead } from './folding'
import { canvasLift, grownFrame, namedPieceTaken } from './frameGrowth'
import { customFrameSize, frameAllows, frameGeometry, frameShapeOf, removedBeadsOf, settingsOf, sizeSettingOf, type FrameShapeId, type FrameSettings, type QuarterTurns } from './frameShape'
import type { LayerGeometry } from './layerGeometry'
import type { Weave } from './weave'
import { carryNames, namedPieceCutBy, namedPieces } from './pieceNames'
import { numericKey, pieceBeadsAt } from './pieces'
import { canvasDistance, canvasWeave, weaveOf } from './layerWeave'
import { firstPasses, progressWithoutLine, rowProgressStarted } from './rowProgress'
import { sameBeads } from './layerBeads'
import { withWeave, type WeaveChange } from './weaveSwitch'
import { beadsOfLayer, heldWeave, withLayer } from './layerRecord'
import type { Project } from './project'
import type { AreaLine } from './removeLine'

// The one operation behind every change of the Frame (ticket 361): make a Frame, resize, move, Fit to drawing, Remove
// Frame and Remove row/column. It owns the rules: Row progress's lock (Remove Frame passes it, clearing the passes;
// moving, naming and Remove row/column keep them), Row progress following the Frame.
export type FrameChange =
  /** Resize the Frame (handles, steppers, typed size), its beads keeping their place. Woven like the Canvas it lays what
   * it gives up there (ticket 513) and lifts what it grows over, a named Piece whole or not at all (ticket 0639); woven
   * unlike it, it folds them (ticket 0638). Growing shows Folded beads again, over the Canvas's. */
  | { set: Rect }
  /** Frame from Selection and Fit to drawing (ADR 0066): the Frame becomes this rectangle and the Canvas's beads inside
   * it move into it. A Frame already there lays its beads back on the Canvas first. */
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
  /** The Frame does not offer it (ADR 0077): a Custom frame's shape comes from its settings, not a rectangle, and a
   * Frame without a Frame shape has no settings. */
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
  const frame = project.frame
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

export function changeFrame(project: Project, change: FrameChange): FrameChangeResult {
  const reason = frameChangeRefusal(project, change)
  if (reason) {
    return { kind: 'refused', reason }
  }

  if ('removeLine' in change) {
    const frame = project.frame!
    const { axis } = change.removeLine
    const smaller = { ...frame, rows: axis === 'row' ? frame.rows - 1 : frame.rows, columns: axis === 'column' ? frame.columns - 1 : frame.columns }
    // The line runs on through the Folded beads beyond the Frame's edge, so they shift with the rest (ticket 0638).
    const { folded: _folded, ...kept } = frame
    const carried = withEachBead(frame, (position) => shiftedAcrossLine(change.removeLine, position))
    const rowProgress = progressWithoutLine(project, change.removeLine)
    return { kind: 'changed', project: withFrame({ ...project, rowProgress, frame: { ...kept, ...carried } }, smaller) }
  }

  if ('move' in change) {
    const frame = project.frame!
    const moved = movedFrame(frame, change.move.rows, change.move.columns)
    if (sameFrame(frame, moved)) {
      return { kind: 'unchanged', project }
    }
    // The Frame carries its beads and the passes; the Canvas under the destination stays as it is, hidden (ADR 0066).
    return { kind: 'changed', project: { ...project, frame: { ...frame, row: moved.row, column: moved.column }, updatedAt: Date.now() } }
  }

  if ('name' in change) {
    const { name: _previous, ...frame } = project.frame!
    if (change.name === (project.frame!.name ?? '')) {
      return { kind: 'unchanged', project }
    }
    return { kind: 'changed', project: { ...project, frame: { ...frame, ...(change.name ? { name: change.name } : {}) }, updatedAt: Date.now() } }
  }

  if ('place' in change) {
    return { kind: 'changed', project: placedFrame(project, change.place) }
  }

  if ('custom' in change) {
    return { kind: 'changed', project: placedCustomFrame(project, change.custom) }
  }

  if ('settings' in change) {
    const frame = project.frame!
    const settings = settingsOf({ shape: frame.shape, settings: { ...frame.settings, ...change.settings } })!
    if (sameSettings(settings, settingsOf(frame)!)) {
      return { kind: 'unchanged', project }
    }
    return { kind: 'changed', project: { ...project, frame: resettled(project, frame, settings, frame.quarterTurns), updatedAt: Date.now() } }
  }

  if ('remove' in change) {
    return project.frame ? { kind: 'changed', project: removedFrame(project) } : { kind: 'unchanged', project }
  }

  if ('technique' in change || 'techniqueSettings' in change) {
    const rewoven = withWeave(project, 'frame', change)
    return rewoven === project ? { kind: 'unchanged', project } : { kind: 'changed', project: rewoven }
  }

  if ('make' in change) {
    const made = madeFrame(project, change.make)
    return sameFrame(project.frame, made.frame) && sameBeads(project, made) && project.frame?.name === made.frame?.name
      ? { kind: 'unchanged', project }
      : { kind: 'changed', project: made }
  }

  const { rectangle } = grownFrame(project, change.set)
  if (sameFrame(project.frame, rectangle)) {
    return { kind: 'unchanged', project }
  }
  return { kind: 'changed', project: resizedFrame(project, rectangle) }
}

/** Whether the Frame refuses this change: what reshapes a rectangle for a Custom frame, settings for a Frame without a
 * Frame shape. */
function frameRefuses(frame: FrameSheet, change: FrameChange): boolean {
  if ('settings' in change) return !frameShapeOf(frame)
  return (
    ('set' in change && !frameAllows(frame, 'resize')) ||
    ('removeLine' in change && !frameAllows(frame, 'remove-line')) ||
    ('make' in change && !frameAllows(frame, 'from-selection')) ||
    (('technique' in change || 'techniqueSettings' in change) && !frameAllows(frame, 'technique'))
  )
}

/** A Custom frame built from its Frame shape and settings round a Canvas position: its bounding rectangle in its own
 * Technique, its first row and column the Canvas positions half that rectangle up and left, snapped as a Frame starts. */
function customSheet(project: Project, shape: FrameShapeId, settings: FrameSettings, centre: GridPosition, quarterTurns?: QuarterTurns): FrameSheet {
  const read = settingsOf({ shape, settings })!
  const { rows, columns } = customFrameSize(shape, read, quarterTurns)
  const weave = weaveOf({ technique: frameShapeOf({ shape })!.techniques[0] })
  const half = canvasDistance(project, weave, Math.floor(rows / 2), Math.floor(columns / 2))
  const canvas = canvasWeave(project)
  return { row: snapRow(canvas, centre.row - half.row), column: centre.column - half.column, rows, columns, beads: {}, ...weave, shape, settings: read, ...(quarterTurns ? { quarterTurns } : {}) }
}

/** A new Custom frame: its Frame shape, its size or all its settings, the Canvas position it goes round, and any beads. */
type CustomPlacement = { shape: FrameShapeId; centre: GridPosition; beads?: BeadMap } & ({ size: number } | { settings: FrameSettings })

/** Whether two Custom frames' settings, as `settingsOf` reads them, are the same. */
function sameSettings(a: FrameSettings, b: FrameSettings): boolean {
  const names = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof FrameSettings>
  return [...names].every((name) => a[name] === b[name])
}

/** The Project with a new Custom frame in place of any Frame there (ticket 0592), holding the beads given that its
 * layout has a position for: Row progress starts at the first pass, and the Canvas keeps every bead. */
function placedCustomFrame(project: Project, placement: CustomPlacement): Project {
  const { shape, centre, beads = {} } = placement
  const settings = 'settings' in placement ? placement.settings : { [sizeSettingOf({ shape })!.id]: placement.size }
  const sheet = customSheet(project, shape, settings, centre)
  return { ...project, frame: { ...sheet, beads: beadsOn(beads, frameGeometry(sheet)) }, rowProgress: firstPasses(project.rowProgress), updatedAt: Date.now() }
}

/** A Custom frame laid out again from new settings round its own centre: each bead whose position is still in the
 * layout shows, the rest fold, kept by their position's name, until a layout has it again (ticket 0640). */
function resettled(project: Project, frame: FrameSheet, settings: FrameSettings, quarterTurns: QuarterTurns | undefined): FrameSheet {
  const centre = canvasDistance(project, heldWeave(project, 'frame')!, Math.floor(frame.rows / 2), Math.floor(frame.columns / 2))
  const sheet = customSheet(project, frame.shape!, settings, { row: frame.row + centre.row, column: frame.column + centre.column }, quarterTurns)
  const { quarterTurns: _turned, folded: _folded, ...rest } = frame
  const geometry = frameGeometry(sheet)
  return { ...rest, ...sheet, ...refoldSheet(frame, (position) => geometry.hasPosition(position)) }
}

/** Rotate Frame on a Custom frame (ticket 0594): its layout a quarter turn further clockwise round its own centre, its
 * rectangle's sides swapped; every bead keeps its name, so it turns with its panel. None for a Frame without a Frame shape. */
export function turnedCustomFrame(project: Project): Project | undefined {
  const frame = project.frame
  if (!frame || !frameShapeOf(frame)) return undefined
  const turns = ((frame.quarterTurns ?? 0) + 1) % 4
  return { ...project, frame: resettled(project, frame, frame.settings ?? {}, turns === 0 ? undefined : (turns as QuarterTurns)), updatedAt: Date.now() }
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
  const name = namedPieceTaken(project, taken) ?? resized.frame!.name
  return name === undefined ? carried : { ...carried, frame: { ...carried.frame!, name } }
}

/** The Project with a Frame at `rectangle` holding the Canvas's beads inside it (ADR 0066). A Frame there before lays
 * its beads on the Canvas where they stand, over what they covered. A named Piece the rectangle takes whole gives the
 * Frame its name. */
function madeFrame(original: Project, rectangle: Rect): Project {
  const project = withFoldedLaid(original)
  const previous = project.frame
  const [under, held] = [beadsOfLayer(project, 'canvas'), beadsOfLayer(project, 'frame')]
  // What shows is lifted. Canvas beads hidden under a Frame there before stay on the Canvas; its own beads outside the
  // new rectangle go back on it.
  const hidden = previous ? beadsInFrame(beadsInFrame(under, rectangle), footprintOf(project)!) : {}
  const left = previous ? beadsWithout(shiftedBeads(held!, previous.row, previous.column), rectangle) : {}
  const canvas = beadsOver(beadsOver(beadsWithout(under, rectangle), hidden), left)
  const lifted = beadsInFrame(shownBeads(project), rectangle)
  const taken = project.pieceNames?.find((entry) => frameContains(rectangle, entry))?.name
  const named = taken ?? previous?.name
  // A Frame that moves to another named Schema leaves the one it held behind, named and unframed.
  const first = previous && taken !== undefined && previous.name ? firstBead(held!) : undefined
  const { frame: _previous, ...rest } = project
  const framed = withFrame(withLayer(rest, 'canvas', { beads: canvas }), rectangle)
  const carried = carryNames(project, withLayer(framed, 'frame', { beads: shiftedBeads(lifted, -rectangle.row, -rectangle.column), ...(named ? { name: named } : {}) }))
  return first && previous?.name ? { ...carried, pieceNames: [...(carried.pieceNames ?? []), { name: previous.name, row: first.row + previous.row, column: first.column + previous.column }] } : carried
}

/** The Project with its Frame's Folded beads laid on the Canvas where they stand, over what is there (ticket 0638), as
 * a Frame made elsewhere lays the beads it shows. */
function withFoldedLaid(project: Project): Project {
  const frame = project.frame
  if (!frame?.folded) return project
  const { folded, ...shown } = frame
  return withLayer({ ...project, frame: shown }, 'canvas', { beads: beadsOver(beadsOfLayer(project, 'canvas'), shiftedBeads(folded, frame.row, frame.column)) })
}

/** The Project with a new empty Frame at `place.frame`, woven as `place.weave`, instead of the one it had (ticket 495):
 * Row progress starts at the first pass, and the Canvas keeps every bead. */
function placedFrame(project: Project, place: { frame: Rect; weave: Weave; beads?: BeadMap }): Project {
  const { frame: _previous, ...rest } = project
  const { row, column, rows, columns } = place.frame
  const sheet = { row, column, rows, columns, ...weaveOf(place.weave) }
  const frame = { ...sheet, beads: place.beads ? beadsOn(place.beads, frameGeometry(sheet)) : {} }
  return { ...rest, frame, rowProgress: firstPasses(project.rowProgress), updatedAt: Date.now() }
}

/** The Project without its Frame (ticket 497): the Frame's footprint on the Canvas is cleared and its beads dropped in,
 * so the picture looks as the Frame did. The Frame's name stays on the Piece its beads form (the larger one if several);
 * the passes go with the Frame. A Frame whose shape removes its beads with it leaves the Canvas as it is (ADR 0077). */
function removedFrame(project: Project): Project {
  const frame = project.frame!
  if (removedBeadsOf(frame) === 'removed') {
    return withFrame(project, undefined)
  }
  const dropped = shiftedBeads(beadsOfLayer(project, 'frame')!, frame.row, frame.column)
  // Its Folded beads land where they stand too, over the Canvas, under the beads it shows (ticket 0638).
  const unfolded = beadsOver(beadsWithout(beadsOfLayer(project, 'canvas'), footprintOf(project)!), shiftedBeads(frame.folded ?? {}, frame.row, frame.column))
  const beads = beadsOver(unfolded, dropped)
  const canvas = carryNames(project, withLayer(withFrame(project, undefined), 'canvas', { beads }))
  const name = frame.name
  const weave = heldWeave(canvas, 'canvas')
  const landed = name ? largestPieceBead(beads, weave, dropped) : undefined
  if (!name || !landed) {
    return canvas
  }
  const piece = new Set(pieceBeadsAt(beads, weave, landed).map(numericKey))
  const names = canvas.pieceNames ?? []
  const rival = namedPieces(canvas).find((named) => names.some((entry) => entry.name === named.name && piece.has(numericKey(entry))))
  if (rival && rival.beads >= piece.size) {
    return canvas
  }
  return { ...canvas, pieceNames: [...names.filter((entry) => !piece.has(numericKey(entry))), { name, ...landed }] }
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
