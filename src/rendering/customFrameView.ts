import type { FrameSheet } from '../domain/canvas'
import { layoutPlacement } from '../domain/frameKind'
import { layoutPosition, layoutPositionAt, type FrameLayout, type LayoutPoint } from '../domain/frameLayout'
import type { GridPosition } from '../domain/grid'
import type { Weave } from '../domain/weave'
import { CELL_SIZE_PX, cellSizePx } from './cellSize'
import type { Region } from './surfaceView'

// Where a Custom frame's layout (ADR 0077) is drawn inside its bounding rectangle, in grid px from the Frame's first
// position: a bead width to a cell's width, smaller only where the Bead shape draws the rectangle shorter than the layout,
// and centred. The renderer, the overlay and the hit test all place it here, so they agree where each bead is.

/** A layout laid in its Frame's rectangle: its bead widths in px, and where its top left falls. */
export interface PlacedLayout {
  layout: FrameLayout
  scale: number
  x: number
  y: number
  /** A bead as drawn, in px: as wide as a cell, as deep as the Bead shape's cell where the rounds leave it room. */
  bead: { width: number; height: number }
}

/** A Frame's layout as placed in its rectangle, or none for a Rectangular Frame: the domain's placement in cell widths
 * (shared with a Selection over it, ticket 0594), in grid px. */
export function placedLayout(frame: Pick<FrameSheet, 'kind' | 'settings' | 'quarterTurns' | 'rows' | 'columns'>, weave: Weave): PlacedLayout | undefined {
  const placement = layoutPlacement(frame, weave)
  if (!placement) return undefined
  const { layout } = placement
  const scale = placement.scale * CELL_SIZE_PX
  const aspect = cellSizePx(weave.technique, weave.cell).height / CELL_SIZE_PX
  return {
    layout,
    scale,
    x: placement.x * CELL_SIZE_PX,
    y: placement.y * CELL_SIZE_PX,
    bead: { width: scale, height: scale * Math.min(aspect, layout.beadDepth) },
  }
}

/** A layout point in grid px from the Frame's first position. */
export function layoutPointPx(placed: PlacedLayout, point: LayoutPoint): LayoutPoint {
  return { x: placed.x + point.x * placed.scale, y: placed.y + point.y * placed.scale }
}

/** A Frame position's centre and angle in grid px, or none where the layout has no such position. */
export function layoutBeadPx(placed: PlacedLayout, position: GridPosition): (LayoutPoint & { angle: number }) | undefined {
  const found = layoutPosition(placed.layout, position)
  return found && { ...layoutPointPx(placed, found), angle: found.angle }
}

/** The Frame position under a point in grid px from the Frame's first position, or none on a Seam or Off-shape. */
export function layoutPositionAtPx(placed: PlacedLayout, x: number, y: number): GridPosition | undefined {
  return layoutPositionAt(placed.layout, (x - placed.x) / placed.scale, (y - placed.y) / placed.scale)
}

/** The bead box to draw at a position, centred on 0, 0: the context is turned to the bead's angle first. */
export function centredBead(placed: PlacedLayout): Region {
  const { width, height } = placed.bead
  return { x: -width / 2, y: -height / 2, width, height }
}
