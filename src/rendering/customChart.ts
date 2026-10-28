import { colorAt } from '../domain/canvas'
import { frameWeave } from '../domain/layerWeave'
import type { Project } from '../domain/project'
import type { LayoutPoint } from '../domain/frameLayout'
import { CELL_SIZE_PX } from './cellSize'
import { geometryDrawnAlone } from './space'
import { gridToRegion, projectExtentPx, type Region } from './surfaceView'

// A Custom frame on a printed chart (ticket 0594): its beads lie at angles, not on rows and columns, so a chart page
// places each one where its Layer geometry puts it, through the same transform as the rest of the page.

/** One bead of a Custom frame as a page draws it: its centre in px from the region's top left, its angle there (the
 * page's turn included), its size, and its colour or none. */
export interface ChartBead {
  x: number
  y: number
  angle: number
  width: number
  height: number
  color: string | null
}

/** A Custom frame's beads and Seams drawn into a region of the displayed chart at a zoom; none for a Rectangular Frame.
 * Every bead is given, wherever it lies: the caller keeps those of its own part. */
export function customChart(project: Pick<Project, 'frame' | 'beads' | 'rotation' | 'technique' | 'brickBlock' | 'netSize'> & Partial<Pick<Project, 'beadId' | 'beadShape'>>, region: Region, zoom: number): { beads: ChartBead[]; seams: [LayoutPoint, LayoutPoint][] } | undefined {
  const frame = project.frame
  const geometry = geometryDrawnAlone(project)
  if (!frame || geometry.grid) return undefined
  const weave = frameWeave(project)
  // The Frame drawn on its own, as a chart is: its first position at 0, 0.
  const extent = projectExtentPx(weave.technique, frame.columns, frame.rows, weave.cell)
  const [a, b, c, d, e, f] = gridToRegion(extent, region, zoom, project.rotation)
  const at = ({ x, y }: LayoutPoint): LayoutPoint => ({ x: a * x + c * y + e, y: b * x + d * y + f })
  // A point of the Layer geometry, in bead widths, in grid px.
  const inGrid = ({ x, y }: LayoutPoint): LayoutPoint => ({ x: x * CELL_SIZE_PX, y: y * CELL_SIZE_PX })
  // The page's own quarter turn, read off the transform's first column.
  const turn = Math.atan2(b, a)
  return {
    beads: geometry.positions().map((position) => {
      const { box, angle } = geometry.place(position)!
      return {
        ...at(inGrid({ x: box.x + box.width / 2, y: box.y + box.height / 2 })),
        angle: angle + turn,
        width: box.width * CELL_SIZE_PX * zoom,
        height: box.height * CELL_SIZE_PX * zoom,
        color: colorAt(frame.beads, position.row, position.column),
      }
    }),
    seams: geometry.seams().map(([from, to]) => [at(inGrid(from)), at(inGrid(to))]),
  }
}

/** Where a displayed point falls in the chart's cells, across and down, given their steps. */
export function chartCellOf(point: LayoutPoint, stepAcross: number, stepDown: number): { across: number; down: number } {
  return { across: Math.floor(point.x / stepAcross), down: Math.floor(point.y / stepDown) }
}
