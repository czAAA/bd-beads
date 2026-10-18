import { layerAt, onLayer } from '../domain/layers'
import { NO_MIRROR_AXES, type MirrorAxisCounts } from '../domain/mirror'
import type { GridPosition } from '../domain/grid'
import { fillArea, mirrorCurrent, paintCells, type Project } from '../domain/project'

/** Paints Canvas positions the way a press does: on the layer the first position is on (the Frame's inside the Frame, the
 * Canvas's elsewhere), live-mirrored on the Frame. */
export function paintAt(project: Project, positions: GridPosition[], color: string | null, axes: MirrorAxisCounts = NO_MIRROR_AXES, copyMode = false): Project {
  const layer = layerAt(project, positions[0] ?? { row: 0, column: 0 })
  return onLayer(project, layer, (view, local) => paintCells(view, positions.map(local), color, axes, copyMode))
}

/** Bucket-fills from a Canvas position the way a press does: on the layer it is on. */
export function fillAt(project: Project, row: number, column: number, color: string | null): Project {
  return onLayer(project, layerAt(project, { row, column }), (view, local) => {
    const at = local({ row, column })
    return fillArea(view, at.row, at.column, color)
  })
}

/** "Mirror current" along one axis, on the Frame. */
export function mirrorFrame(project: Project, axis: 'columns' | 'rows', axisCount: number, copyMode: boolean): Project {
  return onLayer(project, 'frame', (view) => mirrorCurrent(view, axis, axisCount, copyMode))
}
