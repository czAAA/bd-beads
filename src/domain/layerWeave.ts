import type { GridPosition } from './grid'
import type { Project } from './project'
import { projectCell, type ShapedBead } from './projectBead'
import { MAX_BRICK_BLOCK, positionStep, withCell, type Weave } from './weave'

// The Weave each layer is woven in (ticket 492): the Canvas's from the Project's own fields, the Frame's from its own,
// and how a distance in one reads in the other.

/** The Weave of a layer given as its Technique, Brick block and Net size: those and nothing else (a Frame carries more). */
export function weaveOf({ technique, brickBlock, netSize }: Weave): Weave {
  return { technique, ...(brickBlock ? { brickBlock } : {}), ...(netSize ? { netSize } : {}) }
}

/** The Canvas's Weave: the Project's own Technique, Brick block and Net size (ticket 492). */
export function canvasWeave(project: Pick<Project, 'technique' | 'brickBlock' | 'netSize'> & ShapedBead): Weave {
  return withCell(weaveOf(project), projectCell(project))
}

/** The Frame's Weave (ticket 492), which may differ from the Canvas's; a Canvas with no Frame counts its rows in its
 * own. The one place that says which Weave a Frame's rows, rulers, passes and exports are counted in. */
export function frameWeave(project: Pick<Project, 'technique' | 'brickBlock' | 'netSize' | 'frame'> & ShapedBead): Weave {
  return withCell(weaveOf(project.frame ?? project), projectCell(project))
}

/** Whether two Weaves lay positions out alike. */
export function sameWeave(a: Weave, b: Weave): boolean {
  return a.technique === b.technique && (a.brickBlock ?? 1) === (b.brickBlock ?? 1) && (a.netSize ?? 0) === (b.netSize ?? 0)
}

/** A distance counted in the Frame's own rows and columns, as Canvas positions (ticket 492): the nearest whole ones,
 * exactly the same where Frame and Canvas are woven alike. */
export function canvasDistance(project: Pick<Project, 'technique' | 'brickBlock' | 'netSize'>, frame: Weave, rows: number, columns: number): GridPosition {
  const canvas = canvasWeave(project)
  if (sameWeave(canvas, frame)) {
    return { row: rows, column: columns }
  }
  const own = positionStep(frame)
  const target = positionStep(canvas)
  return { row: Math.round((rows * own.down) / target.down), column: Math.round((columns * own.across) / target.across) }
}

/** A Brick block as a whole number from 1 to MAX_BRICK_BLOCK. */
export function clampBrickBlock(value: number): number {
  return Math.min(MAX_BRICK_BLOCK, Math.max(1, Math.round(value) || 1))
}
