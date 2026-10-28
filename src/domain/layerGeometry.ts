import type { Rect } from './canvas'
import type { KindedSheet } from './frameKind'
import { layoutNeighbors, layoutPosition, layoutPositionAt, type FrameLayout, type LayoutPoint } from './frameLayout'
import type { GridPosition } from './grid'
import { describeWeave, type Weave } from './weave'
import { insideBounds, type Box } from './weaveGeometry'

// The Layer geometry (ADR 0078, ticket 0628): one set of questions every Layer answers, the Canvas and each Frame kind
// alike, in bead widths from the Layer's first position's corner (a cell is 1 wide). A grid answers from its Weave, a
// Custom frame from its layout. Editing (ticket 0629), drawing and exports (ticket 0630) ask it.

/** Where a bead lies: its rectangle as an upright bead, and the angle it is turned by about the rectangle's centre
 * (radians, clockwise on screen). */
export interface BeadPlace {
  box: Box
  angle: number
}

/** What a Layer answers about where its beads are, whatever lays them out: its Weave's rows, or a Custom
 * frame's layout (ADR 0077). Positions are the Layer's own (a Frame's from its first row and column, a Custom frame's
 * by round and place); points are in bead widths from the Layer's first position's corner. */
export interface LayerGeometry {
  /** Whether its positions are a grid's rows and columns (the Canvas, a Rectangular Frame), which a Frame's first row and
   * column put on the Canvas's and Pieces are found on, and its beads stand upright in them, which rulers number and a
   * chart rules lines between; a Custom frame's are named by round and place, its beads turned to their panels (ADR 0077). */
  readonly grid: boolean
  /** Every position that holds a bead, within the Layer's edge; none on an open Canvas, which has no edge. */
  positions(): readonly GridPosition[]
  /** Whether a position holds a bead: inside the edge, and where the layout has one. */
  hasPosition(position: GridPosition): boolean
  /** The positions whose beads touch this one's, each a position the Layer has: where a Fill spreads. */
  neighbors(position: GridPosition): GridPosition[]
  /** Where a position's bead lies, or none where the Layer has no such position. */
  place(position: GridPosition): BeadPlace | undefined
  /** The position whose bead a point is on, or none between beads, on a Seam, Off-shape or off the Layer. */
  positionAt(point: LayoutPoint): GridPosition | undefined
  /** The box round the Layer's edge (a Custom frame's is its rectangle), or none on an open Canvas. */
  extent(): Box | undefined
  /** The positions whose beads may lie in or touch a box, a row at a time as a drawing lays them down (a later row's
   * beads over an earlier one's): what a view of part of the Layer draws. */
  positionsIn(box: Box): GridPosition[]
  /** The lines where its parts are joined (a Custom frame's Seams), from point to point; none on a grid. */
  seams(): readonly (readonly [LayoutPoint, LayoutPoint])[]
}

/** A Layer laid out by its Weave: the Canvas (open, with no `bounds`), a Rectangular Frame (its own rows and columns from
 * 0, 0), or any rectangle of a Weave's positions whose edge is the Layer's. Its answers are the Weave description's
 * (ticket 0623), cut to the edge. */
export function gridGeometry(weave: Weave, bounds?: Rect): LayerGeometry {
  const description = describeWeave(weave)
  const height = description.cellAspect
  const has = (position: GridPosition): boolean => insideBounds(bounds, position)
  const box = (position: GridPosition): Box => description.box(position, 1, height)
  const extent = bounds && description.blockBox(bounds, 1, height)
  // Where rows nest, the bead drawn last wins among the edge's own rows: the description takes an edge from the first
  // position. A rectangle elsewhere is hit as the open Weave is, then cut to its edge.
  const within = bounds && bounds.row === 0 && bounds.column === 0 ? bounds : undefined
  return {
    grid: true,
    positions: () => {
      if (!bounds) return []
      const all: GridPosition[] = []
      for (let row = bounds.row; row < bounds.row + bounds.rows; row += 1) {
        for (let column = bounds.column; column < bounds.column + bounds.columns; column += 1) {
          all.push({ row, column })
        }
      }
      return all
    },
    hasPosition: has,
    neighbors: (position) => description.neighbors(bounds, position).filter(has),
    place: (position) => (has(position) ? { box: box(position), angle: 0 } : undefined),
    positionAt: ({ x, y }) => {
      const found = description.positionAt(x, y, 1, height, within)
      return found && has(found) ? found : undefined
    },
    extent: () => extent,
    positionsIn: ({ x, y, width, height: deep }) => {
      const seen = description.visible({ left: x, right: x + width, top: y, bottom: y + deep }, 1, height)
      const [firstRow, lastRow] = bounds ? [Math.max(bounds.row, seen.firstRow), Math.min(bounds.row + bounds.rows - 1, seen.lastRow)] : [seen.firstRow, seen.lastRow]
      const found: GridPosition[] = []
      for (let row = firstRow; row <= lastRow; row += 1) {
        const { first, last } = seen.columnsOf(row)
        const [from, to] = bounds ? [Math.max(bounds.column, first), Math.min(bounds.column + bounds.columns - 1, last)] : [first, last]
        for (let column = from; column <= to; column += 1) if (has({ row, column })) found.push({ row, column })
      }
      return found
    },
    seams: () => [],
  }
}

/** Where a Custom frame's layout lies in its rectangle, in cell widths from its first position's corner: a bead width to
 * a cell's width, smaller only where the Bead shape makes the rectangle shorter than the layout, and centred. The
 * renderer, the hit test and a Selection over it (ticket 0594) all place it here, so they agree where each bead is. */
export interface LayoutPlacement {
  layout: FrameLayout
  scale: number
  x: number
  y: number
}

/** A Custom frame's layout as placed in its rectangle of its Weave's cells. */
export function layoutPlacement(layout: FrameLayout, frame: Pick<KindedSheet, 'rows' | 'columns'>, weave: Weave): LayoutPlacement {
  const description = describeWeave(weave)
  const extent = description.blockExtent(frame.columns, frame.rows, 1, description.cellAspect)
  const scale = Math.min(1, extent.width / layout.width, extent.height / layout.height)
  return { layout, scale, x: (extent.width - layout.width * scale) / 2, y: (extent.height - layout.height * scale) / 2 }
}

/** A Custom frame laid out by its layout (ADR 0077), placed in its rectangle as `layoutPlacement` puts it: a bead a
 * cell wide, as deep as the Bead shape's cell where the rounds leave it room, turned to its panel. Its kind's own
 * geometry (`frameGeometry`). */
export function layoutGeometry(layout: FrameLayout, frame: KindedSheet): LayerGeometry {
  const { scale, x, y } = layoutPlacement(layout, frame, frame)
  const description = describeWeave(frame)
  const width = scale
  const height = scale * Math.min(description.cellAspect, layout.beadDepth)
  const rectangle = description.blockBox({ row: 0, column: 0, rows: frame.rows, columns: frame.columns }, 1, description.cellAspect)
  const at = (point: LayoutPoint): LayoutPoint => ({ x: x + point.x * scale, y: y + point.y * scale })
  const all = (): GridPosition[] => layout.positions.map(({ row, column }) => ({ row, column }))
  return {
    grid: false,
    positions: all,
    hasPosition: (position) => layoutPosition(layout, position) !== undefined,
    neighbors: (position) => layoutNeighbors(layout, position),
    place: (position) => {
      const found = layoutPosition(layout, position)
      if (!found) return undefined
      const centre = at(found)
      return { box: { x: centre.x - width / 2, y: centre.y - height / 2, width, height }, angle: found.angle }
    },
    positionAt: (point) => {
      const off = point.x < 0 || point.y < 0 || point.x >= rectangle.width || point.y >= rectangle.height
      return off ? undefined : layoutPositionAt(layout, (point.x - x) / scale, (point.y - y) / scale)
    },
    extent: () => rectangle,
    // A Custom frame is small: every bead is drawn.
    positionsIn: all,
    seams: () => layout.seams.map(([from, to]) => [at(from), at(to)] as const),
  }
}
