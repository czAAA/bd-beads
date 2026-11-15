import { frameOf, type Layered } from '../domain/layerRecord'
import { frameRowOrder, rowProgressOf, rowProgressPosition } from '../domain/rowProgress'
import type { Region, SurfaceView } from './surfaceView'

/** Where the current pass lies in the view, with a row of context either side in the way rows run (ticket 0934): what
 * a row move and Show row bring into view. Past the last pass it is the last, as the counter shows; read from the beads'
 * middles, so a Custom frame's round is found where its layout puts it. None without a Frame. */
export function currentPassRegion(project: Layered, surface: SurfaceView): Region | undefined {
  const frame = frameOf(project)
  if (!frame) return undefined
  const { current, total } = rowProgressPosition(project)
  const positions = frameRowOrder(project).positionsOf(Math.min(current, total - 1))
  if (positions.length === 0) return undefined
  const middles = positions.map((position) => surface.beadToPoint({ row: frame.row + position.row, column: frame.column + position.column }, 'frame'))
  const xs = middles.map((point) => point.x)
  const ys = middles.map((point) => point.y)
  // Half a bead round the middles takes the beads in whole; one step more in the way rows run is the row of context.
  const step = surface.beadStep('frame')
  const context = rowProgressOf(project).direction === 'columns' ? step.column : step.row
  const across = (Math.abs(step.column.x) + Math.abs(step.row.x)) / 2 + Math.abs(context.x)
  const down = (Math.abs(step.column.y) + Math.abs(step.row.y)) / 2 + Math.abs(context.y)
  const left = Math.min(...xs) - across
  const top = Math.min(...ys) - down
  return { x: left, y: top, width: Math.max(...xs) + across - left, height: Math.max(...ys) + down - top }
}
