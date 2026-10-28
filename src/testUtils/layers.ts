import { layerAt, onLayer } from '../domain/layers'
import type { GridPosition } from '../domain/grid'
import { fillArea } from '../domain/fill'
import { paintCells } from '../domain/drawing'
import type { Project } from '../domain/project'

/** Paints Canvas positions the way a press does: on the layer the first position is on (the Frame's inside the Frame, the
 * Canvas's elsewhere). */
export function paintAt(project: Project, positions: GridPosition[], color: string | null): Project {
  const layer = layerAt(project, positions[0] ?? { row: 0, column: 0 })
  return onLayer(project, layer, (view, local) => paintCells(view, positions.map(local), color))
}

/** Bucket-fills from a Canvas position the way a press does: on the layer it is on. */
export function fillAt(project: Project, row: number, column: number, color: string | null): Project {
  return onLayer(project, layerAt(project, { row, column }), (view, local) => {
    const at = local({ row, column })
    return fillArea(view, at.row, at.column, color)
  })
}
