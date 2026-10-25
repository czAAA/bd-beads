import type { GridPosition } from './grid'
import { colorAt, forEachBead, frameContains, shiftedBeads, withColors, type BeadChange, type BeadMap, type Frame } from './canvas'
import { snapRow } from './frame'
import { layerView, onLayer, positionOnCanvas } from './layers'
import { carryNames } from './pieceNames'
import { canvasDistance, frameWeave, type Project } from './project'
import { cellKey, selectionFrame, selectionInLayer, selectionLayer, selectionMask, type Selection } from './selection'
import { describeWeave } from './weave'

// Rotate (CONTEXT.md, ADR 0052): a quarter turn clockwise of the Selection's beads about its centre. Unlike the legacy
// view-only turn it changes the data (peyote/brick contacts change). Frame, rulers and Row progress are untouched;
// beads under the turned footprint are replaced, nothing is pushed away.

export interface RotatedSelection {
  project: Project
  /** The turned rectangle, which becomes the Selection. */
  selection: Selection
}

/** The Selection turned a quarter about its centre: rows and columns swap, and on stitches whose rows alternate it
 * starts on a multiple of the shift's cycle. `inset` is how far inside the Selection the row that must land on one
 * begins (ticket 477). */
export function rotatedSelection(project: Pick<Project, 'technique' | 'brickBlock' | 'netSize'>, selection: Selection, inset = 0): Selection {
  const frame = selectionFrame(selection)
  const weave = describeWeave(project)
  // Whole Units turn: a Technique with none counts beads as its Units.
  const units = weave.unitsOf(frame)
  // Rows and columns swap about the middle. When they differ by an odd number the middle falls between beads, and which
  // way it rounds depends on which side is longer, so that four turns come back to where they began.
  const difference = units.rows - units.columns
  const rowShift = difference >= 0 ? Math.floor(difference / 2) : -Math.floor(-difference / 2)
  const columnShift = difference >= 0 ? -Math.ceil(difference / 2) : Math.ceil(-difference / 2)
  const turned = weave.positionsOf({ columns: units.rows, rows: units.columns })
  return {
    top: snapRow(project, frame.row + rowShift * weave.rowsPerUnit + inset) - inset,
    left: frame.column + columnShift,
    rows: turned.rows,
    columns: turned.columns,
  }
}

/** Every position of a rectangle that holds a bead (of a shape, only its own cells: ticket 547). */
function beadsIn(project: Project, area: Frame, mask?: (row: number, column: number) => boolean): BeadChange[] {
  const found: BeadChange[] = []
  for (let row = area.row; row < area.row + area.rows; row++) {
    for (let column = area.column; column < area.column + area.columns; column++) {
      const color = !mask || mask(row, column) ? colorAt(project.beads, row, column) : null
      if (color) {
        found.push({ row, column, color })
      }
    }
  }
  return found
}

/** The Project with the Selection turned a quarter clockwise, and the turned rectangle; covered beads are replaced. A
 * shape turns its own beads only, and what it lands on is replaced; the result is the turned shape (ticket 547). */
export function rotateSelection(project: Project, selection: Selection, inset = 0): RotatedSelection {
  const area = selectionFrame(selection)
  const turned = rotatedSelection(project, selection, inset)
  const footprint = selectionFrame(turned)

  const weave = describeWeave(project)
  const block = { columns: selection.columns, rows: selection.rows }
  const turn = (row: number, column: number): GridPosition | undefined => {
    const to = weave.turned({ row: row - selection.top, column: column - selection.left }, block)
    return to && { row: turned.top + to.row, column: turned.left + to.column }
  }

  // A bead that belongs to no whole Unit of the Selection (a horizontal bead past its last Unit) stays where it is.
  const mask = selectionMask(selection)
  const lifted = beadsIn(project, area, mask).filter(({ row, column }) => turn(row, column))
  const landed = mask && lifted.map(({ row, column }) => turn(row, column)!)
  const covered = landed ? landed.flatMap((at) => beadsIn(project, { row: at.row, column: at.column, rows: 1, columns: 1 })) : beadsIn(project, footprint)
  const cleared = withColors(project.beads, [...lifted, ...covered].map(({ row, column }) => ({ row, column, color: null })))
  const beads = withColors(cleared, lifted.map(({ row, column, color }) => ({ ...turn(row, column)!, color })))

  const landedKeys = landed && new Set(landed.map(({ row, column }) => cellKey(row, column)))
  const named = carryNames(project, { ...project, beads, updatedAt: Date.now() }, (position) => {
    if (frameContains(area, position) && (!mask || mask(position.row, position.column))) {
      return turn(position.row, position.column)
    }
    if (landedKeys) return landedKeys.has(cellKey(position.row, position.column)) ? undefined : position
    return frameContains(footprint, position) ? undefined : position
  })
  return { project: named, selection: landed ? { ...turned, cells: landed } : turned }
}

/** A Selection turned on its layer (ADR 0066): the Canvas's as `rotateSelection` does it; the Frame's within the Frame,
 * where what falls outside it is dropped. `covered` is how many beads of the layer outside the Selection it replaced. */
export function rotateLayerSelection(project: Project, selection: Selection): RotatedSelection & { covered: number } {
  const layer = selectionLayer(project, selection)
  const local = selectionInLayer(project, layer, selection)
  const before = layerView(project, layer)
  let turned = local
  const rotated = onLayer(project, layer, (view) => {
    const result = rotateSelection(view, local)
    turned = result.selection
    // A Frame holds only its own cells.
    return view.frame ? { ...result.project, beads: shiftedBeads(result.project.beads, 0, 0, view.frame) } : result.project
  })
  const after = layerView(rotated, layer)
  const origin = positionOnCanvas(project, layer, { row: turned.top, column: turned.left })
  const cells = turned.cells
    ?.filter((cell) => !before.frame || frameContains(before.frame, cell))
    .map((cell) => positionOnCanvas(project, layer, cell))
  return {
    project: rotated,
    selection: { ...turned, top: origin.row, left: origin.column, layer, ...(cells ? { cells } : {}) },
    covered: rotated === project ? 0 : coveredByRotation(before, after, local, turned),
  }
}

/** How many beads outside the Selection the turn replaced: under the turned footprint, outside the old rectangle,
 * gone from `after`. */
export function coveredByRotation(before: Project, after: Project, selection: Selection, turned: Selection): number {
  const area = selectionFrame(selection)
  const footprint = selectionFrame(turned)
  const inside = selectionMask(selection)
  const onto = selectionMask(turned)
  let covered = 0
  forEachBead(before.beads, (row, column, color) => {
    if (frameContains(footprint, { row, column }) && (!onto || onto(row, column)) && !(frameContains(area, { row, column }) && (!inside || inside(row, column))) && colorAt(after.beads, row, column) !== color) {
      covered++
    }
  })
  return covered
}

/** Rotate Frame (ticket 471, ADR 0063, 0066): the Frame and its own beads turned a quarter clockwise about their centre,
 * as Rotate does a Selection; Width and Height swap. The Canvas under it is not touched. No Frame: undefined. */
export function rotateFrame(project: Project): Project | undefined {
  const frame = project.frame
  const own = frame && frameWeave(project)
  if (!frame || !own || !describeWeave(own).quarterTurn) {
    return undefined
  }
  // Turned in the Frame's own rows (its first is 0), then placed on the Canvas by as far as its corner moved.
  const turned = rotatedSelection(own, { top: 0, left: 0, rows: frame.rows, columns: frame.columns })
  const weave = describeWeave(own)
  const block = { columns: frame.columns, rows: frame.rows }
  const beads: BeadMap = {}
  forEachBead(frame.beads, (row, column, color) => {
    // A bead that belongs to no whole Unit of the Frame (a horizontal bead past its last Unit) is dropped.
    const to = weave.turned({ row, column }, block)
    if (to) {
      beads[to.row] ??= {}
      beads[to.row]![to.column] = color
    }
  })
  const moved = canvasDistance(project, own, turned.top, turned.left)
  return {
    ...project,
    frame: { ...frame, row: frame.row + moved.row, column: frame.column + moved.column, rows: turned.rows, columns: turned.columns, beads },
    updatedAt: Date.now(),
  }
}
