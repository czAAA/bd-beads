import { changedPositions, frameContains, type BeadMap, type Rect } from '../domain/canvas'
import type { GridPosition } from '../domain/grid'
import { canvasWeave } from '../domain/layerWeave'
import { beadsOfLayer, frameOf } from '../domain/layerRecord'
import { namedPieces, type NamedPiece } from '../domain/pieceNames'
import { pieceAreasOf } from '../domain/pieces'
import { rowCycle } from '../domain/weave'
import type { RuledProject } from './rulers'

/** The Pieces the rulers hang from (ticket 0674): the Piece areas that carry rulers, none while the rulers are hidden
 * or a Frame carries them, and the named Pieces that hang a tag (ticket 0721), with the beads they were counted from. */
export interface RuledPieces {
  beads: BeadMap
  cycle: number
  /** Undefined while no Piece carries rulers: the rulers are hidden, or the Frame carries them. */
  areas: Rect[] | undefined
  named: NamedPiece[]
}

/** How far from an area a painted bead still counts as its: a bead touching it, or one empty bead off (the margin
 * that joins Piece areas). A named Piece takes only a bead touching it. */
const AREA_REACH = 2
const NAMED_REACH = 1

/** The Pieces to rule for `project`. Counted from its beads, except while a stroke is going on (ticket 0674): then
 * the last count is kept and the area or named Piece each changed bead touches grows to hold it (a bead touching none
 * starts an area of its own), so a stroke step costs its changed rows. The stroke's end counts again. */
export function ruledPieces(previous: RuledPieces | undefined, project: RuledProject, { numbers, stroking }: { numbers: boolean; stroking: boolean }): RuledPieces {
  const weave = canvasWeave(project)
  const beads = beadsOfLayer(project, 'canvas')
  const ruled = numbers && !frameOf(project)
  const held = stroking && previous && previous.cycle === rowCycle(weave) && (previous.areas !== undefined) === ruled
  if (!held) {
    return { beads, cycle: rowCycle(weave), areas: ruled ? pieceAreasOf(beads, weave) : undefined, named: namedPieces(project) }
  }
  if (previous.beads === beads) return previous
  const painted = changedPositions(previous.beads, beads).filter(({ row, column }) => beads[row]?.[column] !== undefined)
  const areas = previous.areas && painted.reduce(grownAreas, previous.areas)
  const named = previous.named.map((piece) => painted.reduce((grown: NamedPiece, at) => (reaches(grown, at, NAMED_REACH) && !frameContains(grown, at) ? { ...grown, ...holding(grown, at) } : grown), piece))
  return { beads, cycle: previous.cycle, areas, named }
}

function grownAreas(areas: Rect[], at: GridPosition): Rect[] {
  const index = areas.findIndex((area) => reaches(area, at, AREA_REACH))
  if (index === -1) return [...areas, { row: at.row, column: at.column, rows: 1, columns: 1 }]
  if (frameContains(areas[index], at)) return areas
  return areas.map((area, i) => (i === index ? holding(area, at) : area))
}

function reaches(box: Rect, at: GridPosition, reach: number): boolean {
  return frameContains({ row: box.row - reach, column: box.column - reach, rows: box.rows + 2 * reach, columns: box.columns + 2 * reach }, at)
}

/** The smallest rectangle round `box` and `at`. */
function holding(box: Rect, at: GridPosition): Rect {
  const top = Math.min(box.row, at.row)
  const left = Math.min(box.column, at.column)
  const bottom = Math.max(box.row + box.rows, at.row + 1)
  const right = Math.max(box.column + box.columns, at.column + 1)
  return { row: top, column: left, rows: bottom - top, columns: right - left }
}
