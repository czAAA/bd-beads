import { layerAt, onLayer } from '../domain/layers'
import { cellUnder } from '../domain/footprint'
import type { GridPosition } from '../domain/grid'
import { fillArea, isFillRefusal, type FillReach } from '../domain/fill'
import { paintCells } from '../domain/drawing'
import type { Project } from '../domain/project'

/** Paints Canvas positions (a Frame's cells under them) the way a press does: on the layer the first position is on (the Frame's inside the Frame, the
 * Canvas's elsewhere). */
export function paintAt(project: Project, positions: GridPosition[], color: string | null): Project {
  const layer = layerAt(project, positions[0] ?? { row: 0, column: 0 })
  return onLayer(project, layer, (view) => paintCells(view, positions.map((position) => (layer === 'canvas' ? position : cellUnder(project, layer, position))), color))
}

/** Bucket-fills from a Canvas position the way a press does: on the layer it is on, within Fill reach. A refused Fill
 * leaves the Project as it was. */
export function fillAt(project: Project, row: number, column: number, color: string | null, reach?: FillReach): Project {
  const layer = layerAt(project, { row, column })
  return onLayer(project, layer, (view) => {
    const at = layer === 'canvas' ? { row, column } : cellUnder(project, layer, { row, column })
    const filled = fillArea(view, at.row, at.column, color, reach)
    return isFillRefusal(filled) ? view.beads : filled
  })
}
