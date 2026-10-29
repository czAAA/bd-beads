import type { GridPosition, Rotation } from './grid'
import { colorAt, forEachBead, frameContains, shiftedBeads, withColors, type BeadChange, type BeadMap, type FrameSheet, type Rect } from './canvas'
import type { QuarterTurns } from './frameShape'
import { laidSize } from './frameOrientation'
import { snapRow } from './frame'
import { layerSheet, onLayer, positionOnCanvas, type LayerSheet } from './layers'
import { carryNames } from './pieceNames'
import { canvasDistance, frameWeave } from './layerWeave'
import { beadsOfLayer, canvasOf, frameOf, heldWeave, orientationOf, touchFrameSheet, withCanvas, withLayer } from './layerRecord'
import { touch, type Project } from './project'
import { turnedCustomFrame } from './changeFrame'
import { coveredOnLayout, turnedOnLayout } from './customSelection'
import { cellKey, selectableOn, selectionFrame, selectionInLayer, selectionLayer, selectionMask, type Selection } from './selection'
import { describeWeave, type Weave } from './weave'

// Rotate (CONTEXT.md, ADR 0052): a quarter turn clockwise of the Selection's beads about its centre. Unlike the legacy
// view-only turn it changes the data (peyote/brick contacts change). Frame, rulers and Row progress are untouched;
// beads under the turned footprint are replaced, nothing is pushed away.

export interface RotatedSelection {
  project: Project
  /** The turned rectangle, which becomes the Selection. */
  selection: Selection
}

/** The Selection turned a quarter about its centre: rows and columns swap, and where rows alternate it starts on a
 * multiple of the shift's cycle, `inset` being how far inside it the row that must land on one begins (ticket 477).
 * @internal Its test checks the turned rectangle on its own. */
export function rotatedSelection(weave: Weave, selection: Selection, inset = 0): Selection {
  const frame = selectionFrame(selection)
  // Rows and columns swap about the middle. When they differ by an odd number the middle falls between beads, and which
  // way it rounds depends on which side is longer, so that four turns come back to where they began.
  const difference = frame.rows - frame.columns
  const rowShift = difference >= 0 ? Math.floor(difference / 2) : -Math.floor(-difference / 2)
  const columnShift = difference >= 0 ? -Math.ceil(difference / 2) : Math.ceil(-difference / 2)
  return {
    top: snapRow(weave, frame.row + rowShift + inset) - inset,
    left: frame.column + columnShift,
    rows: frame.columns,
    columns: frame.rows,
  }
}

/** Every position of a rectangle that holds a bead (of a shape, only its own cells: ticket 547). */
function beadsIn(beads: BeadMap, area: Rect, mask?: (row: number, column: number) => boolean): BeadChange[] {
  const found: BeadChange[] = []
  for (let row = area.row; row < area.row + area.rows; row++) {
    for (let column = area.column; column < area.column + area.columns; column++) {
      const color = !mask || mask(row, column) ? colorAt(beads, row, column) : null
      if (color) {
        found.push({ row, column, color })
      }
    }
  }
  return found
}

/** A layer laid on a grid with the Selection turned a quarter clockwise: its beads, covered ones replaced; the turned
 * rectangle; and where each bead went, for the Piece names (undefined: gone). A shape turns its own beads only (ticket
 * 547); beads off `selectable` (`selectableOn`, ticket 0659) neither turn nor are replaced. */
function turnedBeads({ beads, weave }: Pick<LayerSheet, 'beads' | 'weave'>, selection: Selection, inset = 0, selectable: (row: number, column: number) => boolean = () => true): {
  beads: BeadMap
  selection: Selection
  moved: (position: GridPosition) => GridPosition | undefined
} {
  const area = selectionFrame(selection)
  const turned = rotatedSelection(weave, selection, inset)
  const footprint = selectionFrame(turned)

  const description = describeWeave(weave)
  const block = { columns: selection.columns, rows: selection.rows }
  const turn = (row: number, column: number): GridPosition => {
    const to = description.turned({ row: row - selection.top, column: column - selection.left }, block)
    return { row: turned.top + to.row, column: turned.left + to.column }
  }

  const mask = selectionMask(selection)
  const lifted = beadsIn(beads, area, (row, column) => (!mask || mask(row, column)) && selectable(row, column))
  const landed = mask && lifted.map(({ row, column }) => turn(row, column))
  const covered = (landed ? landed.flatMap((at) => beadsIn(beads, { row: at.row, column: at.column, rows: 1, columns: 1 })) : beadsIn(beads, footprint)).filter(
    ({ row, column }) => selectable(row, column),
  )
  const cleared = withColors(beads, [...lifted, ...covered].map(({ row, column }) => ({ row, column, color: null })))

  const landedKeys = landed && new Set(landed.map(({ row, column }) => cellKey(row, column)))
  const moved = (position: GridPosition): GridPosition | undefined => {
    if (!selectable(position.row, position.column)) return position
    if (frameContains(area, position) && (!mask || mask(position.row, position.column))) {
      return turn(position.row, position.column)
    }
    if (landedKeys) return landedKeys.has(cellKey(position.row, position.column)) ? undefined : position
    return frameContains(footprint, position) ? undefined : position
  }
  return {
    beads: withColors(cleared, lifted.map(({ row, column, color }) => ({ ...turn(row, column), color }))),
    selection: landed ? { ...turned, cells: landed } : turned,
    moved,
  }
}

/** The Project with the Selection turned a quarter clockwise on its Canvas, and the turned rectangle (see `turnedBeads`);
 * the Piece names go where their beads went.
 * @internal Tests turn a Selection without the App. */
export function rotateSelection(project: Project, selection: Selection, inset = 0): RotatedSelection {
  const turned = turnedBeads({ beads: beadsOfLayer(project, 'canvas'), weave: heldWeave(project, 'canvas') }, selection, inset)
  return { project: turnedNames(project, turned), selection: turned.selection }
}

/** The Project with its Canvas beads turned, its Piece names going where their beads went. */
function turnedNames(project: Project, turn: ReturnType<typeof turnedBeads>): Project {
  return carryNames(project, { ...withLayer(project, 'canvas', { beads: turn.beads }), updatedAt: Date.now() }, turn.moved)
}

/** A Selection turned on its layer (ADR 0066): the Canvas's as `rotateSelection` does it; the Frame's within the Frame,
 * where what falls outside it is dropped. `covered` is how many beads of the layer outside the Selection it replaced. */
export function rotateLayerSelection(project: Project, selection: Selection): RotatedSelection & { covered: number; dropped: number } {
  const layer = selectionLayer(project, selection)
  const local = selectionInLayer(project, layer, selection)
  const before = layerSheet(project, layer)
  if (!before.geometry.grid) {
    return rotateCustomSelection(project, local, before)
  }
  const { edge } = before
  const result = turnedBeads(before, local, 0, selectableOn(project, before))
  const turned = result.selection
  // A Frame holds only its own cells.
  const rotated = onLayer(project, layer, () => (edge ? shiftedBeads(result.beads, 0, 0, edge) : result.beads))
  const origin = positionOnCanvas(project, layer, { row: turned.top, column: turned.left })
  const cells = turned.cells?.filter((cell) => !edge || frameContains(edge, cell)).map((cell) => positionOnCanvas(project, layer, cell))
  return {
    project: rotated === project || layer === 'frame' ? rotated : withCanvasNames(project, rotated, result),
    selection: { ...turned, top: origin.row, left: origin.column, layer, ...(cells ? { cells } : {}) },
    covered: rotated === project ? 0 : coveredByRotation(before, { beads: beadsOfLayer(rotated, layer)! }, local, turned),
    dropped: 0,
  }
}

/** The Canvas turned, with its Piece names carried as the turn moved their beads, before what fell under the Frame was
 * put back. */
function withCanvasNames(project: Project, rotated: Project, turn: ReturnType<typeof turnedBeads>): Project {
  const names = canvasOf(turnedNames(project, turn)).pieceNames
  const { pieceNames: _names, ...canvas } = canvasOf(rotated)
  return { ...rotated, layers: [{ ...canvas, ...(names ? { pieceNames: names } : {}) }, ...rotated.layers.slice(1)] as Project['layers'] }
}

/** A Selection over a Custom frame turned (ticket 0594): its beads a quarter turn about its middle on screen, each on the
 * nearest free position of the panel under it, those on a Seam or Off-shape dropped; the rectangle turns as on a Frame
 * of its Weave. */
function rotateCustomSelection(project: Project, local: Selection, sheet: LayerSheet): RotatedSelection & { covered: number; dropped: number } {
  const { lifted, landed, dropped } = turnedOnLayout(sheet, local)
  const covered = coveredOnLayout(sheet, landed, lifted)
  const rotated = onLayer(project, 'frame', ({ beads }) => withColors(withColors(beads, lifted.map(({ row, column }) => ({ row, column, color: null }))), landed))
  const turned = rotatedSelection(frameWeave(project), local)
  const origin = positionOnCanvas(project, 'frame', { row: turned.top, column: turned.left })
  return { project: rotated, selection: { ...turned, top: origin.row, left: origin.column, layer: 'frame' }, covered: rotated === project ? 0 : covered, dropped }
}

/** How many beads outside the Selection the turn replaced: under the turned footprint, outside the old rectangle,
 * gone from `after`.
 * @internal Its test checks the count on its own. */
export function coveredByRotation(before: Pick<LayerSheet, 'beads'>, after: Pick<LayerSheet, 'beads'>, selection: Selection, turned: Selection): number {
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

/** Rotate Frame (tickets 471, 0594, 0667, ADR 0052, 0079): the Frame's orientation a quarter clockwise about its centre,
 * like a sheet of A4 turned on an A1. Its beads keep their own rows and columns, so nothing is rewritten and no row snaps,
 * and Row progress keeps its pointers; what it covers turns, the Canvas under it untouched. No Frame: undefined. */
export function rotateFrame(project: Project): Project | undefined {
  const custom = turnedCustomFrame(project)
  if (custom) return custom
  const frame = frameOf(project)
  if (!frame) {
    return undefined
  }
  const own = frameWeave(project)
  const turns = ((frame.quarterTurns ?? 0) + 1) % 4
  const { quarterTurns: _turns, ...upright } = frame
  const turned: FrameSheet = { ...upright, ...(turns ? { quarterTurns: turns as QuarterTurns } : {}) }
  // Its centre stays: the corner moves by half what it covered less half what it covers now, so turns come back to it.
  const half = (sheet: FrameSheet) => {
    const { rows, columns } = laidSize({ ...sheet, ...own })
    return canvasDistance(project, own, Math.floor(rows / 2), Math.floor(columns / 2))
  }
  const [was, now] = [half(frame), half(turned)]
  return touchFrameSheet(project, { ...turned, row: frame.row + was.row - now.row, column: frame.column + was.column - now.column })
}

/** The next quarter turn clockwise: 0, 90, 180, 270 and round again. */
const NEXT_ROTATION: Readonly<Record<Rotation, Rotation>> = { 0: 90, 90: 180, 180: 270, 270: 0 }

/** Rotate canvas (ticket 471): the picture a quarter turn clockwise further; only the view turns, no data changes. */
export function rotateCanvas(project: Project): Project {
  return touch(withCanvas(project, { orientation: NEXT_ROTATION[orientationOf(project)] }), {})
}
