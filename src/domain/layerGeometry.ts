import type { Rect } from './canvas'
import { layoutPlacement, type KindedSheet, type LayoutPlacement } from './frameKind'
import { layoutNeighbors, layoutPosition, layoutPositionAt, type LayoutPoint } from './frameLayout'
import type { GridPosition } from './grid'
import { beadRoundness, describeWeave, type Weave } from './weave'
import { insideBounds, type Box } from './weaveGeometry'

// The Layer geometry (ADR 0078, ticket 0628): one set of questions every Layer answers, the Canvas and each Frame kind
// alike, in bead widths from the Layer's first position's corner (a cell is 1 wide). A grid answers from its Weave, a
// Custom frame from its layout. Expand step: callers move to it in tickets 0629 (domain) and 0630 (drawing, exports).

/** Where a bead lies: its rectangle as an upright bead, and the angle it is turned by about the rectangle's centre
 * (radians, clockwise on screen). */
interface BeadPlace {
  box: Box
  angle: number
}

/** What a Layer answers about where its beads are, whatever lays them out: its Weave's rows and Units, or a Custom
 * frame's layout (ADR 0077). Positions are the Layer's own (a Frame's from its first row and column, a Custom frame's
 * by round and place); points are in bead widths from the Layer's first position's corner. */
export interface LayerGeometry {
  /** Whether its positions are a grid's rows and columns (the Canvas, a Rectangular Frame), which a Frame's first row and
   * column put on the Canvas's and Pieces are found on; a Custom frame's are named by round and place (ADR 0077). */
  readonly grid: boolean
  /** Every position that holds a bead, within the Layer's edge; none on an open Canvas, which has no edge. */
  positions(): readonly GridPosition[]
  /** Whether a position holds a bead: inside the edge, and where the Weave or the layout has one. */
  hasPosition(position: GridPosition): boolean
  /** The positions whose beads touch this one's, each a position the Layer has: where a Fill spreads. */
  neighbors(position: GridPosition): GridPosition[]
  /** Where a position's bead lies, or none where the Layer has no such position. */
  place(position: GridPosition): BeadPlace | undefined
  /** The position whose bead a point is on, or none between beads, on a Seam, Off-shape or off the Layer. */
  positionAt(point: LayoutPoint): GridPosition | undefined
  /** The box round the Layer's edge (a Custom frame's is its rectangle), or none on an open Canvas. */
  extent(): Box | undefined
}

/** A Layer laid out by its Weave: the Canvas (open, with no `bounds`), a Rectangular Frame (its own rows and columns from
 * 0, 0), or any rectangle of a Weave's positions whose edge is the Layer's (a Right-angle weave line's last bead is
 * missing at the edge). */
export function gridGeometry(weave: Weave, bounds?: Rect): LayerGeometry {
  const description = describeWeave(weave)
  const height = description.cellAspect
  const has = (position: GridPosition): boolean => insideBounds(bounds, position) && description.hasPosition(position, bounds)
  const box = (position: GridPosition): Box => description.box(position, 1, height)
  const extent = bounds && gridExtent(weave, bounds)
  // Beads laid on rows: the row a point falls in by the pitch and, where rows nest, the one above, lowest first as later
  // rows are drawn over earlier ones; not a rounded corner. The Surface view's beadInGrid, gridBox and inRoundedCorner
  // are copied here and in gridExtent until ticket 0630 moves their callers onto this.
  const onRows = ({ x, y }: LayoutPoint): GridPosition | undefined => {
    if (extent && (x < extent.x || y < extent.y || y >= extent.y + extent.height)) return undefined
    const pitch = height * description.rowPitch
    const lowest = Math.min(bounds ? bounds.row + bounds.rows - 1 : Infinity, Math.floor(y / pitch))
    const highest = Math.max(bounds ? bounds.row : -Infinity, Math.ceil((y - height) / pitch))
    const radius = beadRoundness(weave.technique, weave.cell)
    for (let row = lowest; row >= highest; row -= 1) {
      const down = y - row * pitch
      const across = x - box({ row, column: 0 }).x
      if (down < 0 || down >= height) continue
      const column = Math.floor(across)
      if (bounds && (column < bounds.column || column >= bounds.column + bounds.columns)) continue
      if (inRoundedCorner(across - column, down, radius, height)) continue
      return { row, column }
    }
    return undefined
  }
  const inUnits = ({ x, y }: LayoutPoint): GridPosition | undefined => {
    const found = description.positionAt(x, y, 1, height)
    return found && (!bounds || has(found)) ? found : undefined
  }
  return {
    grid: true,
    positions: () => {
      if (!bounds) return []
      const all: GridPosition[] = []
      for (let row = bounds.row; row < bounds.row + bounds.rows; row += 1) {
        for (let column = bounds.column; column < bounds.column + bounds.columns; column += 1) {
          if (has({ row, column })) all.push({ row, column })
        }
      }
      return all
    },
    hasPosition: has,
    neighbors: (position) => description.neighbors(bounds, position).filter(has),
    place: (position) => (has(position) ? { box: box(position), angle: 0 } : undefined),
    positionAt: description.countsUnits ? inUnits : onRows,
    extent: () => extent,
  }
}

/** The box round a rectangle of a Weave's positions: its beads, and the half bead a shifted row adds on the right; where
 * beads aren't laid on rows, the union of its corner beads (a horizontal line's last bead is a column short). */
function gridExtent(weave: Weave, { row, column, rows, columns }: Rect): Box {
  const description = describeWeave(weave)
  const height = description.cellAspect
  if (!description.countsUnits) {
    const pitch = height * description.rowPitch
    return { x: column, y: row * pitch, width: description.blockExtent(columns, 0, 1, height).width, height: (rows - 1) * pitch + height }
  }
  const corners = [row, Math.min(row + 1, row + rows - 1), Math.max(row, row + rows - 2), row + rows - 1].flatMap((r) =>
    [column, column + columns - (description.orientationAt({ row: r, column }) === 'sideways' && columns > 1 ? 2 : 1)].map((c) =>
      description.box({ row: r, column: c }, 1, height),
    ),
  )
  const x = Math.min(...corners.map((box) => box.x))
  const y = Math.min(...corners.map((box) => box.y))
  return { x, y, width: Math.max(...corners.map((box) => box.x + box.width)) - x, height: Math.max(...corners.map((box) => box.y + box.height)) - y }
}

/** Whether a point of a bead's cell, from its top-left, lies in a rounded corner, off the bead. */
function inRoundedCorner(x: number, y: number, wanted: number, height: number): boolean {
  // A corner can't be rounder than half the shorter side (a pill).
  const radius = Math.min(wanted, 1 / 2, height / 2)
  if (radius <= 0) return false
  const cornerX = x < radius ? radius : x > 1 - radius ? 1 - radius : x
  const cornerY = y < radius ? radius : y > height - radius ? height - radius : y
  return (x - cornerX) ** 2 + (y - cornerY) ** 2 > radius ** 2
}

/** A Custom frame laid out by its layout (ADR 0077), placed in its rectangle as `layoutPlacement` puts it: a bead a
 * cell wide, as deep as the Bead shape's cell where the rounds leave it room, turned to its panel. */
function layoutGeometry({ layout, scale, x, y }: LayoutPlacement, frame: KindedSheet): LayerGeometry {
  const width = scale
  const height = scale * Math.min(describeWeave(frame).cellAspect, layout.beadDepth)
  const rectangle = gridExtent(frame, { row: 0, column: 0, rows: frame.rows, columns: frame.columns })
  return {
    grid: false,
    positions: () => layout.positions.map(({ row, column }) => ({ row, column })),
    hasPosition: (position) => layoutPosition(layout, position) !== undefined,
    neighbors: (position) => layoutNeighbors(layout, position),
    place: (position) => {
      const found = layoutPosition(layout, position)
      if (!found) return undefined
      const centre = { x: x + found.x * scale, y: y + found.y * scale }
      return { box: { x: centre.x - width / 2, y: centre.y - height / 2, width, height }, angle: found.angle }
    },
    positionAt: (point) => {
      const off = point.x < 0 || point.y < 0 || point.x >= rectangle.width || point.y >= rectangle.height
      return off ? undefined : layoutPositionAt(layout, (point.x - x) / scale, (point.y - y) / scale)
    },
    extent: () => rectangle,
  }
}

/** A Frame's Layer geometry: its layout's for a Custom frame, its Weave's over its own rows and columns otherwise. The one
 * place the Frame kind picks how its beads are laid out; `frame` carries the Bead shape's cell, as the Frame is drawn. */
export function frameGeometry(frame: KindedSheet): LayerGeometry {
  const placement = layoutPlacement(frame, frame)
  return placement ? layoutGeometry(placement, frame) : gridGeometry(frame, { row: 0, column: 0, rows: frame.rows, columns: frame.columns })
}
