import { findBead } from '../../domain/beads'
import { beadIdOfLayer, beadOfLayer, type Layered } from '../../domain/layerRecord'
import { isIconName, type IconName } from '../ui/icons'

/** The Rotate canvas button's icon (ticket 1082; Icons README): the drawing of the woven layer's Form factor, the Frame's
 * Bead when there is one, else the Canvas's (the Bead the Palette's colors come from), whatever its size or Brand. Read
 * from the Project's own copy, else the catalog's; a Form factor with no drawing keeps the plain `rotate-canvas`. */
export function rotateCanvasIcon(project: Layered): IconName {
  const formFactor = (beadOfLayer(project, 'frame').bead ?? findBead(beadIdOfLayer(project, 'frame')))?.formFactor
  const drawn = `rotate-canvas-${formFactor?.id}`
  return formFactor && isIconName(drawn) ? drawn : 'rotate-canvas'
}
