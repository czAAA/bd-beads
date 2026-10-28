import { frameContains, type Rect, type FrameSheet } from '../domain/canvas'
import { rotationSwapsAxes, type GridPosition, type Rotation } from '../domain/grid'
import { frameFootprint } from '../domain/footprint'
import { beadRoundness, describeWeave, isShiftedRow, rowPitch, type BeadCell, type Technique, type Weave } from '../domain/weave'
import type { DrawingContext } from './beadLook'
import { frameOutsetPx } from './rulerScale'
import type { Space } from './space'
import { layoutBeadPx, layoutPositionAtPx, placedLayout } from './customFrameView'
import { CELL_SIZE_PX, cellSizePx } from './cellSize'

// The Surface view (ADR 0010, 0018, 0026): the one place mapping beads and screen points both ways. Rotation, row shift
// and pitch are private; geometry follows domain/grid.ts (ticket 0448). Grid space is px at zoom 1; displayed space is
// zoomed and turned about the beads' box (Canvas: the origin); a point is displayed space less the scroll.

export interface Scroll {
  x: number
  y: number
}

export interface Size {
  width: number
  height: number
}

export type Extent = Size

export interface Region {
  x: number
  y: number
  width: number
  height: number
}

// Distance between row tops, in grid px: peyote rows nest closer than a bead is tall; brick stitch and loom rows stack
// a full bead apart.
export function rowPitchPx(technique: Technique, cell?: BeadCell): number {
  return rowPitch(technique, cellSizePx(technique, cell).height)
}

/** Where a row's beads start from the top of the Project, in grid px. */
export function rowTopPx(technique: Technique, row: number, cell?: BeadCell): number {
  return row * rowPitchPx(technique, cell)
}

/** How far a row's beads are shifted sideways, in grid px: by half a bead in every other row of peyote, in every
 * other block of rows of brick stitch (ticket 477). */
export function rowShiftPx(weave: Weave, row: number): number {
  return isShiftedRow(weave, row) ? CELL_SIZE_PX / 2 : 0
}

// How far a row has its beads shifted sideways, in grid px: by its row in its own layer, whose row 0 is unshifted
// (ticket 492).
export function shiftOf(weave: Weave, row: number): number {
  return rowShiftPx(weave, row)
}

/** Where a position's bead is in a space, in grid px: its rectangle from the top-left. Beads of Right-angle weave
 * are longer one way than the other, so every layer asks for the rectangle, not a square from a top-left corner. */
export function positionBoxPx(weave: Weave, row: number, column: number): Region {
  const description = describeWeave(weave)
  if (description.countsUnits) {
    const cell = cellSizePx(weave.technique, weave.cell)
    return description.box({ row, column }, cell.width, cell.height)
  }
  const { width, height } = cellSizePx(weave.technique, weave.cell)
  return { x: shiftOf(weave, row) + column * width, y: rowTopPx(weave.technique, row, weave.cell), width, height }
}

/** The rectangle round beads from (`row`, `column`) down `rows` and across `columns`, in grid px: the union of the
 * corner beads where beads aren't laid on rows. A line of Right-angle weave's horizontal beads stops a column short of
 * the block, so its far corner is the one before. */
export function positionsBoxPx(weave: Weave, row: number, column: number, rows: number, columns: number): Region {
  const units = describeWeave(weave).countsUnits
  const corners = [row, Math.min(row + 1, row + rows - 1), Math.max(row, row + rows - 2), row + rows - 1].flatMap((r) =>
    [column, column + columns - (units && describeWeave(weave).orientationAt({ row: r, column }) === 'sideways' && columns > 1 ? 2 : 1)].map((c) =>
      positionBoxPx(weave, r, c),
    ),
  )
  const x = Math.min(...corners.map((box) => box.x))
  const y = Math.min(...corners.map((box) => box.y))
  return { x, y, width: Math.max(...corners.map((box) => box.x + box.width)) - x, height: Math.max(...corners.map((box) => box.y + box.height)) - y }
}

/** The size of the drawn Project in grid px, before zoom and rotation. */
export function projectExtentPx(technique: Technique, columns: number, rows: number, cell?: BeadCell): Extent {
  const size = cellSizePx(technique, cell)
  return describeWeave({ technique, cell }).blockExtent(columns, rows, size.width, size.height)
}

/** The size of the drawn Project as displayed: scaled by the zoom, and swapped at a quarter turn either way. */
export function displayedExtentPx(technique: Technique, columns: number, rows: number, zoom: number, rotation: Rotation, cell?: BeadCell): Extent {
  const { width, height } = projectExtentPx(technique, columns, rows, cell)
  return rotationSwapsAxes(rotation) ? { width: height * zoom, height: width * zoom } : { width: width * zoom, height: height * zoom }
}

// The Canvas's extent: nothing. Displayed space is measured from the bead at row 0, column 0, may go negative, and
// turns about the origin.
export const OPEN_EXTENT: Extent = { width: 0, height: 0 }

// Grid space to the region's coordinates: zoom, rotate, move to the origin. A quarter turn maps (x, y) to (height − y,
// x) (ticket 171).
export function gridToRegion(extent: Extent, region: Region, zoom: number, rotation: Rotation): [number, number, number, number, number, number] {
  switch (rotation) {
    case 90:
      return [0, zoom, -zoom, 0, extent.height * zoom - region.x, -region.y]
    case 180:
      return [-zoom, 0, 0, -zoom, extent.width * zoom - region.x, extent.height * zoom - region.y]
    case 270:
      return [0, -zoom, zoom, 0, -region.x, extent.width * zoom - region.y]
    default:
      return [zoom, 0, 0, zoom, -region.x, -region.y]
  }
}

// Sets the context's transform to draw in grid space, on a surface showing `region` of the displayed Project, on a
// screen of the given pixel density.
export function setGridTransform(
  context: DrawingContext,
  extent: Extent,
  region: Region,
  zoom: number,
  rotation: Rotation,
  pixelRatio: number,
): void {
  const [a, b, c, d, e, f] = gridToRegion(extent, region, zoom, rotation)
  context.setTransform(a * pixelRatio, b * pixelRatio, c * pixelRatio, d * pixelRatio, e * pixelRatio, f * pixelRatio)
}

// The part of grid space a displayed region covers: the inverse of gridToRegion's own mapping, one case per quarter
// turn.
export function regionInGridSpace(extent: Extent, region: Region, zoom: number, rotation: Rotation): { left: number; right: number; top: number; bottom: number } {
  switch (rotation) {
    case 90:
      return {
        left: region.y / zoom,
        right: (region.y + region.height) / zoom,
        top: extent.height - (region.x + region.width) / zoom,
        bottom: extent.height - region.x / zoom,
      }
    case 180:
      return {
        left: extent.width - (region.x + region.width) / zoom,
        right: extent.width - region.x / zoom,
        top: extent.height - (region.y + region.height) / zoom,
        bottom: extent.height - region.y / zoom,
      }
    case 270:
      return {
        left: extent.width - (region.y + region.height) / zoom,
        right: extent.width - region.y / zoom,
        top: region.x / zoom,
        bottom: (region.x + region.width) / zoom,
      }
    default:
      return {
        left: region.x / zoom,
        right: (region.x + region.width) / zoom,
        top: region.y / zoom,
        bottom: (region.y + region.height) / zoom,
      }
  }
}

export interface SurfaceViewInput {
  space: Space
  technique: Technique
  /** The Brick block (ticket 477); nothing is 1. */
  brickBlock?: number
  /** The Net size (ticket 485); nothing is the default. */
  netSize?: number
  /** How the Bead is drawn when the Bead shape is Real (ADR 0068); nothing is Symmetric. Both layers use it. */
  cell?: BeadCell
  /** The Frame on the Canvas with its own Weave (ticket 492): a view that has one lays it out in its own geometry, from
   * its top-left position's corner. Left out, the view is one layer: the Canvas, or the Frame alone in an own space. */
  frame?: Rect & Weave & Partial<Pick<FrameSheet, 'kind' | 'settings' | 'quarterTurns'>>
  rotation: Rotation
  zoom: number
  /** Where the viewport's top-left corner is in displayed space; nothing when left out. */
  scroll?: Scroll
  /** The viewport's size, for centring; nothing when left out. */
  viewport?: Size
}

/** Which layer a block of beads is measured in: the Canvas (the default) or the Frame laid over it. */
export type ViewLayer = 'canvas' | 'frame'

export interface SurfaceView {
  /** The zoom this view is at. */
  zoom: number
  /** The viewport's size; 0 by 0 until the surface is measured. */
  viewport: Size
  /** Where a bead's centre is in the viewport. A position under the Frame is the Frame's: its own row and column from
   * the Frame's first. With a `layer` the position is read on it, for the rows of a Frame that draws shorter than it
   * names (ADR 0066). */
  beadToPoint(position: GridPosition, layer?: ViewLayer): Scroll
  // The rectangle a block of beads covers in the viewport, with the half bead an offset technique's shifted rows add on
  // the right.
  beadBox(box: Rect, layer?: ViewLayer): Region
  /** The bead under a point of the viewport, or undefined between beads (ADR 0018). A point on the Frame is its bead,
   * as a position of the Frame's rectangle (its first row and column added); a point on the Canvas beside it, whose
   * position the rectangle's own count would claim, is none. */
  pointToBead(point: Scroll): GridPosition | undefined
  /** The bead under a point and the layer it is on (ADR 0066): where the Frame draws shorter than the rows it names, a
   * Frame bead and a Canvas bead share a position, and only the layer tells them apart. */
  pointToHit(point: Scroll): (GridPosition & { layer: ViewLayer }) | undefined
  /** Whether a point is on a Custom frame where it has no bead (ticket 0592): a Seam, its centre or Off-shape, where a
   * press is refused as on the keep-out margin. */
  offShapeAt(point: Scroll): boolean
  /** The Frame's cell under a point on a Custom frame, on a bead or not (ticket 0594): what the Select tool marks out
   * there, a rectangle on screen; none off the Frame or on a Rectangular one. */
  frameCellAt(point: Scroll): (GridPosition & { layer: 'frame' }) | undefined
  /** The bead position nearest a point, gaps and rounded corners included, in a layer's geometry: what dragging a Frame
   * needs. */
  pointToCell(point: Scroll, layer?: ViewLayer): GridPosition
  /** The Frame's line in the viewport: its beads' rectangle with the line's outset, which is what its handles stand
   * on. */
  frameBox(frame: Rect): Region
  // The scroll that puts the middle of a block of beads, or the origin when there is none, in the middle of the
  // viewport.
  scrollToCentre(box?: Rect, layer?: ViewLayer): Scroll
  // The scroll after the zoom changes to `to`, keeping the displayed point under `anchor` (a position in the viewport)
  // where it was.
  scrollAfterZoom(anchor: Scroll, to: number): Scroll
  // The largest zoom, never past 100%, at which a block of beads leaves `margin` px clear on every side of the
  // viewport; whole percent, rounded down.
  zoomToFit(box: Rect, margin: Size, layer?: ViewLayer): number
  /** How far one step along a row (`column`) and one step down (`row`) go on screen, in a layer's Weave. */
  beadStep(layer?: ViewLayer): { column: Scroll; row: Scroll }
  /** A point in grid space, in the viewport. For the layouts that hang things off a bead's edge (the rulers). */
  gridToPoint(x: number, y: number): Scroll
  /** A direction in grid space as it points on screen: turned, not zoomed. */
  gridDirection(x: number, y: number): Scroll
}

// The bead position of a point in grid space, in the rows and columns a layer has: the row it falls in by the row
// pitch, and (where rows nest) the one above it. A bound left out is no bound.
function beadInGrid(
  weave: Weave,
  gridX: number,
  gridY: number,
  limits: { firstRow?: number; lastRow?: number; columns?: number },
): GridPosition | undefined {
  // Later rows are drawn over earlier ones, so try the lowest first.
  const { technique } = weave
  const { cell } = weave
  const { height } = cellSizePx(technique, cell)
  const pitch = rowPitchPx(technique, cell)
  const lowest = Math.min(limits.lastRow ?? Infinity, Math.floor(gridY / pitch))
  const highest = Math.max(limits.firstRow ?? -Infinity, Math.ceil((gridY - height) / pitch))
  const radius = beadRoundness(technique, cell) * CELL_SIZE_PX

  for (let row = lowest; row >= highest; row -= 1) {
    const offsetY = gridY - rowTopPx(technique, row, cell)
    const offsetX = gridX - shiftOf(weave, row)
    if (offsetY < 0 || offsetY >= height || (limits.columns !== undefined && offsetX < 0)) {
      continue
    }
    const column = Math.floor(offsetX / CELL_SIZE_PX)
    if (limits.columns !== undefined && column >= limits.columns) {
      continue
    }
    if (inRoundedCorner(offsetX - column * CELL_SIZE_PX, offsetY, radius, height)) {
      continue
    }
    return { row, column }
  }
  return undefined
}

function inRoundedCorner(x: number, y: number, wanted: number, height: number): boolean {
  // A corner can't be rounder than half the shorter side (a pill).
  const radius = Math.min(wanted, CELL_SIZE_PX / 2, height / 2)
  if (radius <= 0) {
    return false
  }
  const cornerX = x < radius ? radius : x > CELL_SIZE_PX - radius ? CELL_SIZE_PX - radius : x
  const cornerY = y < radius ? radius : y > height - radius ? height - radius : y
  return (x - cornerX) ** 2 + (y - cornerY) ** 2 > radius ** 2
}

/** A box's rectangle in a layer's grid space: its beads, and the half bead an offset technique's shifted rows add on
 * the right. */
export function gridBox(weave: Weave, box: Rect): Region {
  const { technique } = weave
  if (describeWeave(weave).countsUnits) {
    return positionsBoxPx(weave, box.row, box.column, box.rows, box.columns)
  }
  const { height } = cellSizePx(technique, weave.cell)
  const top = rowTopPx(technique, box.row, weave.cell)
  return {
    x: box.column * CELL_SIZE_PX,
    y: top,
    width: describeWeave(weave).blockExtent(box.columns, 0, CELL_SIZE_PX, height).width,
    height: rowTopPx(technique, box.row + box.rows - 1, weave.cell) + height - top,
  }
}

/** The size in grid px of a block of beads from the first position of a layer: what a Frame covers on the Canvas. */
export function layerExtentPx(weave: Weave, columns: number, rows: number): Extent {
  const description = describeWeave(weave)
  if (description.countsUnits) {
    const { width, height } = positionsBoxPx(weave, 0, 0, rows, columns)
    return { width, height }
  }
  return projectExtentPx(weave.technique, columns, rows, weave.cell)
}

/** Where a Frame's first position sits on the Canvas, in grid px: the corner its own layout is drawn from (ticket 492). */
export function frameOriginPx(canvas: Weave, frame: Pick<Rect, 'row' | 'column'>): Scroll {
  const description = describeWeave(canvas)
  if (description.countsUnits) {
    const cell = cellSizePx(canvas.technique, canvas.cell)
    return description.origin(frame, cell.width, cell.height)
  }
  const { x, y } = positionBoxPx(canvas, frame.row, frame.column)
  return { x, y }
}

/** One layer of a view: its Weave, where its first position sits in grid space, and the address of that position. */
interface Layer {
  weave: Weave
  description: ReturnType<typeof describeWeave>
  cell: Size
  origin: Scroll
  offset: GridPosition
  /** The rows and columns it has, where it has an edge (a Frame; a Project drawn on its own). */
  bounds?: { rows: number; columns: number }
}

function layerOf(weave: Weave, origin: Scroll, offset: GridPosition, bounds?: Layer['bounds']): Layer {
  return { weave, description: describeWeave(weave), cell: cellSizePx(weave.technique, weave.cell), origin, offset, ...(bounds ? { bounds } : {}) }
}

export function surfaceView({ space, technique, brickBlock, netSize, cell: beadShapeCell, frame, rotation, zoom, scroll = { x: 0, y: 0 }, viewport = { width: 0, height: 0 } }: SurfaceViewInput): SurfaceView {
  const canvasWeave: Weave = { technique, brickBlock, netSize, cell: beadShapeCell }
  const canvas = layerOf(canvasWeave, { x: 0, y: 0 }, { row: 0, column: 0 }, space.open ? undefined : { rows: space.rows, columns: space.columns })
  const sheet = frame && space.open ? layerOf({ technique: frame.technique, brickBlock: frame.brickBlock, netSize: frame.netSize, cell: beadShapeCell }, frameOriginPx(canvasWeave, frame), { row: frame.row, column: frame.column }, { rows: frame.rows, columns: frame.columns }) : undefined
  const layerNamed = (name: ViewLayer | undefined): Layer => (name === 'frame' && sheet ? sheet : canvas)
  // A Custom frame's beads lie where its layout puts them (ADR 0077), not on its rows and columns.
  const placed = frame && sheet ? placedLayout(frame, sheet.weave) : undefined
  // The Canvas positions the Frame hides (ADR 0066): what it draws, which is not always the rows it names.
  const footprint = frame && sheet ? frameFootprint(canvasWeave, frame) : undefined
  const layerAtAddress = (position: GridPosition): Layer => (footprint && sheet && frameContains(footprint, position) ? sheet : canvas)
  /** Grid space to displayed space, at a zoom: the matrix gridToRegion gives for a region at the origin. */
  const matrix = (at: number) => gridToRegion(space.extent, { x: 0, y: 0, width: 0, height: 0 }, at, rotation)
  const displayed = (x: number, y: number, at: number): Scroll => {
    const [a, b, c, d, e, f] = matrix(at)
    return { x: a * x + c * y + e, y: b * x + d * y + f }
  }
  const displayedBox = (box: Rect, at: number, layer: Layer): Region => {
    const local = { ...box, row: box.row - layer.offset.row, column: box.column - layer.offset.column }
    const grid = gridBox(layer.weave, local)
    const first = displayed(layer.origin.x + grid.x, layer.origin.y + grid.y, at)
    const last = displayed(layer.origin.x + grid.x + grid.width, layer.origin.y + grid.y + grid.height, at)
    return { x: Math.min(first.x, last.x), y: Math.min(first.y, last.y), width: Math.abs(last.x - first.x), height: Math.abs(last.y - first.y) }
  }
  const inViewport = (region: Region): Region => ({ ...region, x: region.x - scroll.x, y: region.y - scroll.y })
  // A point of the viewport in grid space: the turn and the zoom undone. The matrix is a quarter turn times the zoom,
  // so its inverse is its transpose over the zoom squared.
  const toGrid = (point: Scroll): [number, number] => {
    const [a, b, c, d, e, f] = matrix(zoom)
    const x = point.x + scroll.x - e
    const y = point.y + scroll.y - f
    return [(a * x + b * y) / zoom ** 2 + 0, (c * x + d * y) / zoom ** 2 + 0]
  }
  const centre = (box: Region): Scroll => ({ x: box.x + box.width / 2 - viewport.width / 2, y: box.y + box.height / 2 - viewport.height / 2 })
  const addressOf = (layer: Layer, local: GridPosition): GridPosition => ({ row: local.row + layer.offset.row, column: local.column + layer.offset.column })

  /** The bead of a layer under a point of grid space (relative to the layer's first position), or undefined. */
  const beadIn = (layer: Layer, gridX: number, gridY: number): GridPosition | undefined => {
    const { description, cell, bounds, weave } = layer
    if (description.countsUnits) {
      const found = description.positionAt(gridX, gridY, cell.width, cell.height)
      if (!found || !bounds) return found
      const within = found.row >= 0 && found.row < bounds.rows && found.column >= 0 && found.column < bounds.columns
      // The last column of a Frame's horizontal lines holds no bead.
      return within && description.hasPosition(found, { row: 0, column: 0, rows: bounds.rows, columns: bounds.columns }) ? found : undefined
    }
    if (!bounds) {
      return beadInGrid(weave, gridX, gridY, {})
    }
    if (gridX < 0 || gridY < 0 || gridY >= layerExtentPx(weave, bounds.columns, bounds.rows).height) {
      return undefined
    }
    return beadInGrid(weave, gridX, gridY, { firstRow: 0, lastRow: bounds.rows - 1, columns: bounds.columns })
  }
  const cellIn = (layer: Layer, gridX: number, gridY: number): GridPosition => {
    const { description, cell, weave } = layer
    if (description.countsUnits) return description.nearestPosition(gridX, gridY, cell.width, cell.height)
    const row = Math.round((gridY - cell.height / 2) / rowPitchPx(weave.technique, weave.cell))
    return { row: row + 0, column: Math.floor((gridX - shiftOf(weave, row)) / CELL_SIZE_PX) }
  }

  /** A point of the viewport on the Frame, from its first position's corner, or none off it. */
  const onSheet = (point: Scroll): { x: number; y: number } | undefined => {
    if (!sheet || !frame) return undefined
    const [gridX, gridY] = toGrid(point)
    const extent = layerExtentPx(sheet.weave, frame.columns, frame.rows)
    const x = gridX - sheet.origin.x
    const y = gridY - sheet.origin.y
    return x >= 0 && y >= 0 && x < extent.width && y < extent.height ? { x, y } : undefined
  }

  const pointToHit = (point: Scroll): (GridPosition & { layer: ViewLayer }) | undefined => {
    const [gridX, gridY] = toGrid(point)
    const at = onSheet(point)
    // The Frame is opaque: a point on it is the Frame's bead or none, never the Canvas under it.
    if (sheet && at) {
      const found = placed ? layoutPositionAtPx(placed, at.x, at.y) : beadIn(sheet, at.x, at.y)
      return found && { ...addressOf(sheet, found), layer: 'frame' }
    }
    const found = beadIn(canvas, gridX, gridY)
    return found && !(footprint && frameContains(footprint, found)) ? { ...found, layer: 'canvas' } : undefined
  }

  return {
    zoom,
    viewport,
    beadToPoint: (position, named) => {
      const layer = named ? layerNamed(named) : layerAtAddress(position)
      const bead = layer === sheet && placed ? layoutBeadPx(placed, { row: position.row - layer.offset.row, column: position.column - layer.offset.column }) : undefined
      if (bead) {
        const at = displayed(layer.origin.x + bead.x, layer.origin.y + bead.y, zoom)
        return { x: at.x - scroll.x, y: at.y - scroll.y }
      }
      const box = positionBoxPx(layer.weave, position.row - layer.offset.row, position.column - layer.offset.column)
      const at = displayed(layer.origin.x + box.x + box.width / 2, layer.origin.y + box.y + box.height / 2, zoom)
      return { x: at.x - scroll.x, y: at.y - scroll.y }
    },
    beadBox: (box, layer) => inViewport(displayedBox(box, zoom, layerNamed(layer))),
    pointToHit,
    offShapeAt: (point) => {
      const at = placed && onSheet(point)
      return !!placed && !!at && layoutPositionAtPx(placed, at.x, at.y) === undefined
    },
    frameCellAt: (point) => {
      const at = placed && sheet && frame && onSheet(point)
      if (!at) return undefined
      const cell = cellIn(sheet!, at.x, at.y)
      const within = { row: Math.min(Math.max(cell.row, 0), frame!.rows - 1), column: Math.min(Math.max(cell.column, 0), frame!.columns - 1) }
      return { ...addressOf(sheet!, within), layer: 'frame' }
    },
    pointToBead: (point) => {
      const hit = pointToHit(point)
      return hit && { row: hit.row, column: hit.column }
    },
    pointToCell: (point, layer) => {
      const [gridX, gridY] = toGrid(point)
      const on = layerNamed(layer)
      return addressOf(on, cellIn(on, gridX - on.origin.x, gridY - on.origin.y))
    },
    frameBox: (box) => {
      const shown = inViewport(displayedBox(box, zoom, sheet ?? canvas))
      const outset = frameOutsetPx(zoom)
      return { x: shown.x - outset, y: shown.y - outset, width: shown.width + outset * 2, height: shown.height + outset * 2 }
    },
    scrollToCentre: (box, layer) => centre(box ? displayedBox(box, zoom, layerNamed(layer)) : { x: 0, y: 0, width: 0, height: 0 }),
    scrollAfterZoom: (anchor, to) => {
      const ratio = to / zoom
      return { x: (scroll.x + anchor.x) * ratio - anchor.x, y: (scroll.y + anchor.y) * ratio - anchor.y }
    },
    zoomToFit: (box, margin, layer) => {
      const shown = displayedBox(box, 1, layerNamed(layer))
      const across = shown.width > 0 ? (viewport.width - margin.width * 2) / shown.width : Infinity
      const down = shown.height > 0 ? (viewport.height - margin.height * 2) / shown.height : Infinity
      return Math.floor(Math.min(1, across, down) * 100) / 100
    },
    beadStep: (name) => {
      const { description, cell, weave } = layerNamed(name)
      const origin = displayed(0, 0, zoom)
      // Where Units are counted a step is a whole Unit across and down.
      const unit = description.origin({ row: description.rowsPerUnit, column: description.columnsPerUnit }, cell.width, cell.height)
      const across = description.countsUnits ? unit.x : CELL_SIZE_PX
      const down = description.countsUnits ? unit.y : rowPitchPx(weave.technique, weave.cell)
      const column = displayed(across, 0, zoom)
      const row = displayed(0, down, zoom)
      return { column: { x: column.x - origin.x, y: column.y - origin.y }, row: { x: row.x - origin.x, y: row.y - origin.y } }
    },
    gridToPoint: (x, y) => {
      const at = displayed(x, y, zoom)
      return { x: at.x - scroll.x, y: at.y - scroll.y }
    },
    gridDirection: (x, y) => {
      const origin = displayed(0, 0, 1)
      const at = displayed(x, y, 1)
      return { x: at.x - origin.x, y: at.y - origin.y }
    },
  }
}
