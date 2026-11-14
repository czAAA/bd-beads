import { beadBounds } from '../domain/canvas'
import { beadsOfLayer } from '../domain/layerRecord'
import { canvasWeave } from '../domain/layerWeave'
import { tooManyToWalk } from '../domain/openingLimits'
import { pieceAreasOf } from '../domain/pieceAreas'
import { MARGIN } from '../domain/margin'
import { marginSheetPx, type DrawnProject } from './projectRenderer'
import { gridBox, type Region } from './surfaceView'

/** The work Grid focus keeps the grid clear round (ticket 1002, BeadBoard card), in grid px: the Frame's margin sheet
 * and each Piece area on the Canvas, so a bead painted far from the rest brings its own. None with no bead and no
 * Frame. A layer too big to walk gives the one box round its beads, as its rulers do (ticket 0716). */
export function workBoxesOf(project: DrawnProject, margin = MARGIN): Region[] {
  const weave = canvasWeave(project)
  const beads = beadsOfLayer(project, 'canvas')
  const whole = tooManyToWalk(beads) ? beadBounds(beads) : undefined
  const areas = whole ? [whole] : pieceAreasOf(beads, weave)
  const sheet = marginSheetPx(project, margin)?.sheet
  return [...(sheet ? [sheet] : []), ...areas.map((area) => gridBox(weave, area))]
}

/** Whether two lists of the work's boxes are the same, so a Project replaced by an edit that leaves them alone keeps
 * its drawing's band redraw. */
export function sameWorkBoxes(a: readonly Region[], b: readonly Region[]): boolean {
  return a.length === b.length && a.every((box, index) => {
    const other = b[index]!
    return box.x === other.x && box.y === other.y && box.width === other.width && box.height === other.height
  })
}
