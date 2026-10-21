import { beadsInFrame, beadsOver, beadsWithout, forEachBead, frameContains, shiftedBeads, withColors, type BeadChange, type BeadMap, type Frame } from './canvas'
import { movedFrame, sameFrame, snappedMove } from './frame'
import { shownBeads } from './layers'
import type { GridPosition } from './grid'
import { describeWeave, type Technique, type Weave } from './weave'
import { carryNames, namedPieceCutBy, namedPieces } from './pieceNames'
import { numericKey, pieceBeadsAt } from './pieces'
import { canvasWeave, clampBrickBlock, frameWeave, rowProgressStarted, sameBeads, withBrickBlock, withFrame, withFrameBrickBlock, withFrameTechnique, withTechnique, weaveOf, type Project } from './project'
import type { AreaLine } from './removeLine'

// The one operation behind every change of the Frame (ticket 361): make a Frame, resize, move, Fit to drawing, Remove
// Frame and Remove row/column. It owns the rules: Row progress's lock (only Remove Frame passes it, clearing the
// passes), Row progress following the Frame.
export type FrameChange =
  /** Resize the Frame (the handles, the steppers, the typed size): its beads keep their place on the Canvas, those the
   * Frame no longer holds are dropped onto the Canvas where they stand (ticket 513), over what is there. */
  | { set: Frame }
  /** Frame from Selection and Fit to drawing (ADR 0066): the Frame becomes this rectangle and the Canvas's beads inside
   * it move into it. A Frame already there lays its beads back on the Canvas first. */
  | { make: Frame }
  | { remove: true }
  /** One whole row or column of the Frame, counted from its first. */
  | { removeLine: AreaLine }
  /** Move the Frame with its beads by whole rows and columns (ticket 452, ADR 0062); allowed after Row progress has
   * started, which then travels with the Frame. */
  | { move: { rows: number; columns: number } }
  /** Change the Frame's Technique (tickets 351, 492, 507): the geometry changes, every bead keeps its row and column where
   * the Technique has a position there and the rest are dropped. Netting takes its Net size here. */
  | { technique: Technique; netSize?: number }
  /** Change the Frame's Brick block (ticket 477): the same, only the shift's rhythm changes. */
  | { brickBlock: number }
  /** Put a new empty Frame in its own weave in place of any Frame there (ticket 495): the old Frame's beads and passes go,
   * the Canvas under the new one is hidden, not changed. */
  | { place: { frame: Frame; weave: Weave } }

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
  /** A line of a Technique counted in Units isn't a Unit (ADR 0038), so it can't be removed alone. */
  | 'fixed-weave'

export type FrameChangeResult =
  | { kind: 'refused'; reason: FrameChangeRefusal }
  /** Nothing differs; `project` is the same instance that came in. */
  | { kind: 'unchanged'; project: Project }
  | { kind: 'changed'; project: Project }

// Whether the change throws away finished passes: only Remove Frame once a pass is done, as the passes go with the
// Frame (ticket 434, ADR 0055). The one place that rule lives; the Remove frame flow asks it before confirming.
export function frameChangeDiscardsProgress(project: Project, change: FrameChange): boolean {
  return 'remove' in change && rowProgressStarted(project)
}

/** Why the change would be refused on this Project, or undefined when it would be allowed. Cheap: it builds nothing. */
export function frameChangeRefusal(project: Project, change: FrameChange): FrameChangeRefusal | undefined {
  // Remove Frame is how the weaver lets go of finished passes: it clears them with the Frame (ticket 426, ADR 0055).
  if (rowProgressStarted(project) && !frameChangeDiscardsProgress(project, change) && !('move' in change)) {
    return 'locked'
  }
  const frame = project.frame
  if (('technique' in change || 'brickBlock' in change) && !frame) {
    return 'no-frame'
  }
  if ('removeLine' in change && describeWeave(frameWeave(project)).countsUnits) {
    return 'fixed-weave'
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
  if ('move' in change && !frame) {
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
    const beads = beadsWithoutLine(frame.beads, { row: 0, column: 0, rows: frame.rows, columns: frame.columns }, change.removeLine)
    return { kind: 'changed', project: withFrame({ ...project, frame: { ...frame, beads } }, smaller) }
  }

  if ('move' in change) {
    const frame = project.frame!
    const by = snappedMove(canvasWeave(project), change.move.rows, change.move.columns)
    const moved = movedFrame(frame, by.rows, by.columns)
    if (sameFrame(frame, moved)) {
      return { kind: 'unchanged', project }
    }
    // The Frame carries its beads and the passes; the Canvas under the destination stays as it is, hidden (ADR 0066).
    return { kind: 'changed', project: { ...project, frame: { ...frame, row: moved.row, column: moved.column }, updatedAt: Date.now() } }
  }

  if ('place' in change) {
    return { kind: 'changed', project: placedFrame(project, change.place) }
  }

  if ('remove' in change) {
    return project.frame ? { kind: 'changed', project: removedFrame(project) } : { kind: 'unchanged', project }
  }

  if ('technique' in change) {
    if (change.technique === project.frame?.technique) {
      return { kind: 'unchanged', project }
    }
    return { kind: 'changed', project: withFrameTechnique(project, change.technique, change.netSize) }
  }

  if ('brickBlock' in change) {
    if (clampBrickBlock(change.brickBlock) === (project.frame?.brickBlock ?? 1)) {
      return { kind: 'unchanged', project }
    }
    return { kind: 'changed', project: withFrameBrickBlock(project, change.brickBlock) }
  }

  if ('make' in change) {
    const made = madeFrame(project, change.make)
    return sameFrame(project.frame, made.frame) && sameBeads(project, made) && project.frame?.name === made.frame?.name
      ? { kind: 'unchanged', project }
      : { kind: 'changed', project: made }
  }

  const next = 'set' in change ? change.set : undefined
  if (sameFrame(project.frame, next)) {
    return { kind: 'unchanged', project }
  }
  return { kind: 'changed', project: resizedFrame(project, next) }
}

/** The Project with its Frame set to `rectangle` (ticket 513): the strip the Frame gives up is laid on the Canvas as
 * Remove Frame lays the whole Frame (ticket 497), the Canvas under it cleared first, empty positions included.
 * Growing leaves the Canvas alone. */
function resizedFrame(project: Project, rectangle: Frame | undefined): Project {
  const resized = withFrame(project, rectangle)
  const before = project.frame
  const after = resized.frame
  if (!before || !after) {
    return resized
  }
  const given = (position: GridPosition) => frameContains(before, position) && !frameContains(after, position)
  const dropped: BeadMap = {}
  forEachBead(shiftedBeads(before.beads, before.row, before.column), (row, column, color) => {
    if (given({ row, column })) {
      dropped[row] ??= {}
      dropped[row]![column] = color
    }
  })
  const cleared: BeadChange[] = []
  forEachBead(project.beads, (row, column) => {
    if (given({ row, column })) {
      cleared.push({ row, column, color: null })
    }
  })
  if (!cleared.length && !Object.keys(dropped).length) {
    return resized
  }
  return carryNames(project, { ...resized, beads: beadsOver(withColors(project.beads, cleared), dropped) })
}

/** The Project with a Frame at `rectangle` holding the Canvas's beads inside it (ADR 0066). A Frame there before lays
 * its beads on the Canvas where they stand, over what they covered. A named Piece the rectangle takes whole gives the
 * Frame its name. */
function madeFrame(project: Project, rectangle: Frame): Project {
  const previous = project.frame
  // What shows is lifted. Canvas beads hidden under a Frame there before stay on the Canvas; its own beads outside the
  // new rectangle go back on it.
  const hidden = previous ? beadsInFrame(beadsInFrame(project.beads, rectangle), previous) : {}
  const left = previous ? beadsWithout(shiftedBeads(previous.beads, previous.row, previous.column), rectangle) : {}
  const canvas = beadsOver(beadsOver(beadsWithout(project.beads, rectangle), hidden), left)
  const lifted = beadsInFrame(shownBeads(project), rectangle)
  const taken = project.pieceNames?.find((entry) => frameContains(rectangle, entry))?.name
  const named = taken ?? previous?.name
  // A Frame that moves to another named Schema leaves the one it held behind, named and unframed.
  const first = previous && taken !== undefined && previous.name ? firstBead(previous.beads) : undefined
  const { frame: _previous, ...rest } = project
  const framed = withFrame({ ...rest, beads: canvas }, rectangle)
  const frame = { ...framed.frame!, beads: shiftedBeads(lifted, -rectangle.row, -rectangle.column), ...(named ? { name: named } : {}) }
  const carried = carryNames(project, { ...framed, frame })
  return first && previous?.name ? { ...carried, pieceNames: [...(carried.pieceNames ?? []), { name: previous.name, row: first.row + previous.row, column: first.column + previous.column }] } : carried
}

/** The Project with a new empty Frame at `place.frame`, woven as `place.weave`, instead of the one it had (ticket 495):
 * Row progress starts at the first pass, and the Canvas keeps every bead. */
function placedFrame(project: Project, place: { frame: Frame; weave: Weave }): Project {
  const { frame: _previous, ...rest } = project
  const { row, column, rows, columns } = place.frame
  const frame = { row, column, rows, columns, beads: {}, ...weaveOf(place.weave) }
  return { ...rest, frame, rowProgress: { ...project.rowProgress, currentRow: 0, currentColumn: 0 }, updatedAt: Date.now() }
}

/** The Project without its Frame (ticket 497): the Frame's footprint on the Canvas is cleared and its beads dropped in,
 * so the picture looks as the Frame did. The Frame's name stays on the Piece its beads form (the larger one if several);
 * the passes go with the Frame. */
function removedFrame(project: Project): Project {
  const frame = project.frame!
  const dropped = shiftedBeads(frame.beads, frame.row, frame.column)
  const beads = beadsOver(beadsWithout(project.beads, frame), dropped)
  const canvas = carryNames(project, { ...withFrame(project, undefined), beads })
  const name = frame.name
  const landed = name ? largestPieceBead(beads, canvas, dropped) : undefined
  if (!name || !landed) {
    return canvas
  }
  const piece = new Set(pieceBeadsAt(beads, canvas, landed).map(numericKey))
  const names = canvas.pieceNames ?? []
  const rival = namedPieces(canvas).find((named) => names.some((entry) => entry.name === named.name && piece.has(numericKey(entry))))
  if (rival && rival.beads >= piece.size) {
    return canvas
  }
  return { ...canvas, pieceNames: [...names.filter((entry) => !piece.has(numericKey(entry))), { name, ...landed }] }
}

/** A bead of the largest Piece that `among` forms in `beads` (ties to the first read), or undefined when there is none. */
function largestPieceBead(beads: BeadMap, weave: Pick<Project, 'technique' | 'brickBlock' | 'netSize'>, among: BeadMap): GridPosition | undefined {
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
export function shiftedByLine(area: Frame, line: AreaLine, position: GridPosition): GridPosition | undefined {
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

/** The Project's beads with one line of `area` taken out and the area's later beads shifted up or left to close the
 * gap. */
export function beadsWithoutLine(beads: BeadMap, area: Frame, line: AreaLine): BeadMap {
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

/** The Canvas woven in another Technique or Brick block (tickets 351, 492, 507): its beads keep their row and column
 * where the Technique has a position there, the names of Pieces follow them. Row progress belongs to the Frame, so this
 * is allowed at any time. The same Technique gives the same Project back. */
export function changeCanvasWeave(project: Project, change: { technique: Technique; netSize?: number } | { brickBlock: number }): Project {
  if ('technique' in change) {
    if (change.technique === project.technique) {
      return project
    }
    return carryNames(project, withTechnique(project, change.technique, change.netSize))
  }
  return clampBrickBlock(change.brickBlock) === (project.brickBlock ?? 1) ? project : carryNames(project, withBrickBlock(project, change.brickBlock))
}
