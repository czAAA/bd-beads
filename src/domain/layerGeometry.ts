import type { Rect } from './canvas'
import type { ShapedSheet } from './frameShape'
import { layoutNeighbors, layoutPosition, layoutPositionAt, turnedLayout, type FrameLayout, type LayoutPoint, type LayoutPosition, type LayoutSymmetry } from './frameLayout'
import type { GridDimensions, GridPosition } from './grid'
import { describeWeave, type Weave } from './weave'
import { insideBounds, type Box, type SpanAxis } from './weaveGeometry'

// The Layer geometry (ADR 0078, ticket 0628): one set of questions every Layer answers, the Canvas and every Frame,
// with a Frame shape or none, alike, in bead widths from the Layer's first position's corner (a cell is 1 wide). A grid answers from its Weave, a
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
  /** Whether its positions are a grid's rows and columns (the Canvas, a Frame without a shape), which a Frame's first row and
   * column put on the Canvas's and Pieces are found on, and its beads stand upright in them, which rulers number and a
   * chart rules lines between; a Custom frame's are named by round and place, its beads turned to their panels (ADR 0077). */
  readonly grid: boolean
  /** Every position that holds a bead, within the Layer's edge; none on an open Canvas, which has no edge. */
  positions(): readonly GridPosition[]
  /** Whether a position holds a bead: inside the edge, and where the layout has one. */
  hasPosition(position: GridPosition): boolean
  /** The positions whose beads touch this one's, each a position the Layer has: where a Fill spreads. */
  neighbors(position: GridPosition): GridPosition[]
  /** On a Layer of rows and columns (any grid, upright or turned): the lines a Fill floods a span at a time (tickets
   * 0677, 0734) and which positions of the line either side a bead of `line` touches, as offsets from its own. None on a
   * Custom frame, whose beads touch by its layout. */
  readonly spans?: { along: SpanAxis; reach: (line: number, toLine: number) => readonly [number, number] }
  /** Where a position's bead lies, or none where the Layer has no such position. */
  place(position: GridPosition): BeadPlace | undefined
  /** The position whose bead a point is on, or none between beads, on a Seam, Off-shape or off the Layer. */
  positionAt(point: LayoutPoint): GridPosition | undefined
  /** The box round the Layer's edge (a Custom frame's is its rectangle), or none on an open Canvas. */
  extent(): Box | undefined
  /** The positions whose beads may lie in or touch a box, a row at a time as a drawing lays them down (a later row's
   * beads over an earlier one's): what a view of part of the Layer draws. On a grid `rows` keeps only those rows, so
   * redrawing a band of a big Frame walks the band alone (ticket 0674); a Custom frame's are all its positions. */
  positionsIn(box: Box, rows?: { first: number; last: number }): GridPosition[]
  /** The lines where its parts are joined (a Custom frame's Seams), from point to point; none on a grid. */
  seams(): readonly (readonly [LayoutPoint, LayoutPoint])[]
  /** A Custom frame's symmetry about its layout's centre, as placed (ticket 0706): what Mirror's overlay draws its
   * lines by. Only a layout with one has it. */
  symmetry?: () => LayoutSymmetry & { centre: LayoutPoint }
}

/** A Layer laid out by its Weave: the Canvas (open, with no `bounds`), a Frame without a shape (its own rows and columns from
 * 0, 0), or any rectangle of a Weave's positions whose edge is the Layer's. Its answers are the Weave description's
 * (ticket 0623), cut to the edge. */
export function gridGeometry(weave: Weave, bounds?: Rect): LayerGeometry {
  const description = describeWeave(weave)
  const height = description.cellAspect
  const has = (position: GridPosition): boolean => insideBounds(bounds, position)
  const box = (position: GridPosition): Box => description.box(position, 1, height)
  const extent = bounds && description.blockBox(bounds, 1, height)
  // A stagger is counted from the first position, so the description takes an edge from it. A rectangle elsewhere is hit
  // as the open Weave is, then cut to its edge.
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
    spans: description.spans,
    place: (position) => (has(position) ? { box: box(position), angle: 0 } : undefined),
    positionAt: ({ x, y }) => {
      const found = description.positionAt(x, y, 1, height, within)
      return found && has(found) ? found : undefined
    },
    extent: () => extent,
    positionsIn: ({ x, y, width, height: deep }, rows) => {
      const seen = description.visible({ left: x, right: x + width, top: y, bottom: y + deep }, 1, height)
      const [visibleFirst, visibleLast] = rows ? [Math.max(seen.firstRow, rows.first), Math.min(seen.lastRow, rows.last)] : [seen.firstRow, seen.lastRow]
      const [firstRow, lastRow] = bounds ? [Math.max(bounds.row, visibleFirst), Math.min(bounds.row + bounds.rows - 1, visibleLast)] : [visibleFirst, visibleLast]
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
 * a cell's width, smaller only where the Bead's cell makes the rectangle shorter than the layout, and centred. The
 * renderer, the hit test and a Selection over it (ticket 0594) all place it here, so they agree where each bead is. */
export interface LayoutPlacement {
  layout: FrameLayout
  scale: number
  x: number
  y: number
}

/** A Custom frame's layout as placed in its rectangle of its Weave's cells. */
export function layoutPlacement(layout: FrameLayout, frame: Pick<ShapedSheet, 'rows' | 'columns'>, weave: Weave): LayoutPlacement {
  const description = describeWeave(weave)
  const extent = description.blockExtent(frame.columns, frame.rows, 1, description.cellAspect)
  const scale = Math.min(1, extent.width / layout.width, extent.height / layout.height)
  return { layout, scale, x: (extent.width - layout.width * scale) / 2, y: (extent.height - layout.height * scale) / 2 }
}

/** A Custom frame laid out by its layout (ADR 0077), placed in its rectangle as `layoutPlacement` puts it: a bead a
 * cell wide, as deep as the Bead's cell where the rounds leave it room, turned to its panel. Its Frame shape's
 * own geometry (`frameGeometry`). */
export function layoutGeometry(layout: FrameLayout, frame: ShapedSheet): LayerGeometry {
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
    ...(layout.symmetry ? { symmetry: () => ({ ...layout.symmetry!, centre: at(layout.centre) }) } : {}),
  }
}

/** What a Frame's turned grid is built from: its own rows and columns, its Weave with the Bead's cell, and
 * how many quarter turns clockwise it lies at. */
type TurnedGrid = Pick<ShapedSheet, 'rows' | 'columns' | 'quarterTurns'> & Weave

/** A point of a block `width` by `height` turned `turns` quarters clockwise with y down, as `turnedLayout` turns one. */
function turnPoint({ x, y }: LayoutPoint, width: number, height: number, turns: number): LayoutPoint {
  if (turns === 1) return { x: height - y, y: x }
  if (turns === 2) return { x: width - x, y: height - y }
  if (turns === 3) return { x: y, y: width - x }
  return { x, y }
}

/** `turnPoint` undone: a point of the turned block back in the block as it was. */
function unturnPoint({ x, y }: LayoutPoint, width: number, height: number, turns: number): LayoutPoint {
  if (turns === 1) return { x: y, y: height - x }
  if (turns === 2) return { x: width - x, y: height - y }
  if (turns === 3) return { x: width - y, y: x }
  return { x, y }
}

/** The fewest rows and columns of a Weave's cells whose block covers a box `width` by `height` in cell widths. */
function coveringSize(description: ReturnType<typeof describeWeave>, width: number, height: number): GridDimensions {
  const aspect = description.cellAspect
  // What the stagger adds to a block, along the line that shifts: the half bead a shifted row adds across, or a column down.
  const extra = description.blockExtent(1, 1, 1, aspect)
  const columns = Math.max(1, Math.ceil(width - (extra.width - 1) - 1e-9))
  const rows = Math.max(1, Math.ceil((height - (extra.height - aspect)) / aspect - 1e-9))
  return { rows, columns }
}

/** A Frame's own grid turned (Rotate Frame, ADR 0079, ticket 0667): its size as it lies, its rectangle on the
 * Canvas in its own Weave's cells, and where the turned grid sits in that rectangle, centred as a Custom frame's layout
 * is (`layoutPlacement`). */
function turnedGridPlacement(sheet: TurnedGrid) {
  const description = describeWeave(sheet)
  const aspect = description.cellAspect
  const turns = (sheet.quarterTurns ?? 0) % 4
  const own = description.blockExtent(sheet.columns, sheet.rows, 1, aspect)
  const lying = turns % 2 === 1 ? { width: own.height, height: own.width } : own
  const laid = coveringSize(description, lying.width, lying.height)
  const extent = description.blockExtent(laid.columns, laid.rows, 1, aspect)
  const scale = Math.min(1, extent.width / lying.width, extent.height / lying.height)
  return { description, aspect, turns, own, laid, scale, x: (extent.width - lying.width * scale) / 2, y: (extent.height - lying.height * scale) / 2 }
}

/** Where a position of a Frame's own grid lies once turned, in the rectangle it covers (ticket 0669): any of its rows and
 * columns, a Folded bead's beyond its edge too, where Remove Frame drops it. */
export function turnedGridCentre(sheet: TurnedGrid, position: GridPosition): LayoutPoint {
  const { description, aspect, turns, own, scale, x, y } = turnedGridPlacement(sheet)
  const turned = turnPoint(description.center(position, 1, aspect), own.width, own.height, turns)
  return { x: x + turned.x * scale, y: y + turned.y * scale }
}

/** The rows and columns of its own Weave's cells a Frame without a shape covers on the Canvas as it lies (ticket 0667): its own
 * where it is upright, else those of its turned grid. Width and Height swap as seen. */
export function turnedGridSize(sheet: TurnedGrid): GridDimensions {
  return sheet.quarterTurns ? turnedGridPlacement(sheet).laid : { rows: sheet.rows, columns: sheet.columns }
}

// A turned grid's layout is built once per Weave, size and turn; a Frame being resized makes a new size at each step,
// so only the last few are kept.
const gridLayouts = new Map<string, FrameLayout>()
const GRID_LAYOUTS_KEPT = 4

/** A Frame's own grid as a layout (ticket 0667): each of its positions upright at its centre, one panel, turned as
 * the Frame lies. What a Selection, Paste and Rotate over a turned Frame land beads by, as on a Custom frame. */
export function turnedGridLayout(sheet: TurnedGrid): FrameLayout {
  const { description, aspect, turns, own } = turnedGridPlacement(sheet)
  const key = `${sheet.technique} ${JSON.stringify(sheet.techniqueSettings ?? {})} ${aspect} ${sheet.rows} ${sheet.columns}`
  let base = gridLayouts.get(key)
  if (!base) {
    const positions: LayoutPosition[] = []
    for (let row = 0; row < sheet.rows; row += 1) {
      for (let column = 0; column < sheet.columns; column += 1) {
        positions.push({ row, column, panel: 0, angle: 0, ...description.center({ row, column }, 1, aspect) })
      }
    }
    const centre = { x: own.width / 2, y: own.height / 2 }
    base = { positions, panels: [{ part: 0, order: 0 }], joins: [], width: own.width, height: own.height, centre, seams: [], beadDepth: aspect }
    gridLayouts.set(key, base)
    if (gridLayouts.size > GRID_LAYOUTS_KEPT) gridLayouts.delete(gridLayouts.keys().next().value!)
  }
  return turnedLayout(base, turns)
}

/** A Frame's Layer geometry once Rotate Frame has turned it (ADR 0079, ticket 0667): its positions and a Fill's
 * neighbours are its own grid's, drawn turned in its rectangle, so they are no longer the Canvas's (not `grid`); where a
 * bead lies and which bead a point is on are the grid's turned. */
export function turnedGridGeometry(sheet: TurnedGrid): LayerGeometry {
  const upright = gridGeometry(sheet, { row: 0, column: 0, rows: sheet.rows, columns: sheet.columns })
  const { description, aspect, turns, own, laid, scale, x, y } = turnedGridPlacement(sheet)
  const rectangle = description.blockBox({ row: 0, column: 0, rows: laid.rows, columns: laid.columns }, 1, aspect)
  const toRectangle = (point: LayoutPoint): LayoutPoint => {
    const turned = turnPoint(point, own.width, own.height, turns)
    return { x: x + turned.x * scale, y: y + turned.y * scale }
  }
  const toOwn = (point: LayoutPoint): LayoutPoint => unturnPoint({ x: (point.x - x) / scale, y: (point.y - y) / scale }, own.width, own.height, turns)
  return {
    grid: false,
    positions: upright.positions,
    hasPosition: upright.hasPosition,
    neighbors: upright.neighbors,
    spans: upright.spans,
    place: (position) => {
      if (!upright.hasPosition(position)) return undefined
      const centre = toRectangle(description.center(position, 1, aspect))
      return { box: { x: centre.x - scale / 2, y: centre.y - (scale * aspect) / 2, width: scale, height: scale * aspect }, angle: (turns * Math.PI) / 2 }
    },
    positionAt: (point) => {
      const off = point.x < 0 || point.y < 0 || point.x >= rectangle.width || point.y >= rectangle.height
      return off ? undefined : upright.positionAt(toOwn(point))
    },
    extent: () => rectangle,
    positionsIn: (box) => {
      const corners = [toOwn({ x: box.x, y: box.y }), toOwn({ x: box.x + box.width, y: box.y + box.height })]
      const left = Math.min(corners[0]!.x, corners[1]!.x)
      const top = Math.min(corners[0]!.y, corners[1]!.y)
      return upright.positionsIn({ x: left, y: top, width: Math.abs(corners[0]!.x - corners[1]!.x), height: Math.abs(corners[0]!.y - corners[1]!.y) })
    },
    seams: () => [],
  }
}
