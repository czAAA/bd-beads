import type { Frame } from '../domain/canvas'
import { isOffsetTechnique, rotationSwapsAxes, type GridPosition, type Rotation, type Technique } from '../domain/grid'
import { beadRoundness, type DrawingContext } from './beadLook'
import type { Space } from './space'

/**
 * The Surface view: the one place that knows how a bead and a point on screen map onto each other (ADR 0010, ADR 0018,
 * ADR 0026), in both directions. It answers from a `Space` (space.ts), the Technique, the quarter turn, the zoom and, for
 * a viewport, where it is looking. Rotation, the row shift and the row pitch are private to it: what leaves is a point,
 * a box, a bead or a step on screen.
 *
 * Two row geometries exist on purpose (ADR 0010, amended). Physical geometry, in `domain/grid.ts`, is the real piece in
 * millimetres: brick rows sit one bead apart with no gap, and Convert image samples and frames the picture with it.
 * Drawn geometry, here, adds brick stitch's 1px seam between rows, which is a drawing choice only and never reaches
 * the piece. Nothing here knows about millimetres.
 *
 * Coordinates. "Grid space" is px at zoom 1 with a bead CELL_SIZE_PX square. "Displayed space" is grid space zoomed and
 * turned clockwise by the rotation, about the box round the beads in a space of its own (an export, the Convert image
 * preview) or about the origin on the open canvas. A "point" is in the viewport: displayed space less the scroll, which
 * is the displayed position of the viewport's top-left corner.
 */

/** The pixel size a bead is drawn at, at zoom 1 (the Project renderer's own size), so every layer lines up with what is drawn. */
export const CELL_SIZE_PX = 20

/** Brick stitch's seam between rows, in grid px: a rule the full width of the row that takes 1px of height of its own. */
export const SEAM_PX = 1

/** How far a Frame's line sits outside its outermost beads (Frame card). */
export const FRAME_OUTSET_PX = 7

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

/**
 * The distance from one row's top to the next, in grid px (drawn geometry). Peyote rows nest into each other, so they
 * sit closer than a bead is tall; brick stitch rows are a full bead apart plus their seam; loom rows stack.
 */
export function rowPitchPx(technique: Technique): number {
  if (technique === 'peyote') {
    return CELL_SIZE_PX * 0.75
  }
  return technique === 'brick' ? CELL_SIZE_PX + SEAM_PX : CELL_SIZE_PX
}

/** Where a row's beads start from the top of the Project, in grid px. */
export function rowTopPx(technique: Technique, row: number): number {
  return row * rowPitchPx(technique)
}

/** How far a row's beads are shifted sideways, in grid px: every other row in peyote and brick stitch, by half a bead. */
export function rowShiftPx(technique: Technique, row: number): number {
  return isOffsetTechnique(technique) && Math.abs(row % 2) === 1 ? CELL_SIZE_PX / 2 : 0
}

/** How far a space's row has its beads shifted sideways, in grid px: by the bead's own row, whichever space the row is numbered in (a Project with no Frame may start on an odd row). */
export function shiftOf(space: Space, technique: Technique, row: number): number {
  return rowShiftPx(technique, space.toAbsolute.row + row)
}

/** The size of the drawn Project in grid px, before zoom and rotation. */
export function projectExtentPx(technique: Technique, columns: number, rows: number): Extent {
  return {
    width: columns * CELL_SIZE_PX + (isOffsetTechnique(technique) ? CELL_SIZE_PX / 2 : 0),
    height: rows === 0 ? 0 : rowTopPx(technique, rows - 1) + CELL_SIZE_PX,
  }
}

/** The size of the drawn Project as displayed: scaled by the zoom, and swapped at a quarter turn either way. */
export function displayedExtentPx(technique: Technique, columns: number, rows: number, zoom: number, rotation: Rotation): Extent {
  const { width, height } = projectExtentPx(technique, columns, rows)
  return rotationSwapsAxes(rotation) ? { width: height * zoom, height: width * zoom } : { width: width * zoom, height: height * zoom }
}

/**
 * The extent of the open canvas: nothing. It has no first bead to measure from, so displayed space is measured from the
 * bead at row 0, column 0 and a region may reach into the negative; a quarter turn is about the origin instead of a box.
 */
export const OPEN_EXTENT: Extent = { width: 0, height: 0 }

/**
 * The transform from grid space to the displayed region's own coordinates: zoom, then rotation, then moving the region
 * to the origin. Each quarter turn clockwise carries the grid point (x, y) to (height − y, x) — composing that with
 * itself gives 180° and 270° (ticket 171).
 */
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

/** Sets the context's transform to draw in grid space, on a surface showing `region` of the displayed Project, on a screen of the given pixel density. */
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

/** The part of grid space a displayed region covers: the inverse of gridToRegion's own mapping, one case per quarter turn. */
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
  rotation: Rotation
  zoom: number
  /** Where the viewport's top-left corner is in displayed space; nothing when left out. */
  scroll?: Scroll
  /** The viewport's size, for centring; nothing when left out. */
  viewport?: Size
}

export interface SurfaceView {
  /** The zoom this view is at. */
  zoom: number
  /** The viewport's size; 0 by 0 until the surface is measured. */
  viewport: Size
  /** Where a bead's centre is in the viewport. */
  beadToPoint(position: GridPosition): Scroll
  /** The rectangle a block of beads covers in the viewport, with the half bead an offset technique's shifted rows add on the right. */
  beadBox(box: Frame): Region
  /** The bead under a point of the viewport, or undefined between beads (ADR 0018). */
  pointToBead(point: Scroll): GridPosition | undefined
  /** The bead position nearest a point, gaps and rounded corners included: what dragging a Frame needs. */
  pointToCell(point: Scroll): GridPosition
  /** The Frame's line in the viewport: its beads' rectangle with the line's outset, which is what its handles stand on. */
  frameBox(frame: Frame): Region
  /** The scroll that puts the middle of a block of beads, or the origin when there is none, in the middle of the viewport. */
  scrollToCentre(box?: Frame): Scroll
  /** The scroll after the zoom changes to `to`, keeping the displayed point under `anchor` (a position in the viewport) where it was. */
  scrollAfterZoom(anchor: Scroll, to: number): Scroll
  /** The largest zoom, never past 100%, at which a block of beads leaves `margin` px clear on every side of the viewport; whole percent, rounded down. */
  zoomToFit(box: Frame, margin: Size): number
  /** How far one step along a row (`column`) and one step down (`row`) go on screen. */
  beadStep(): { column: Scroll; row: Scroll }
  /** A point in grid space, in the viewport. For the layouts that hang things off a bead's edge (the rulers). */
  gridToPoint(x: number, y: number): Scroll
  /** A direction in grid space as it points on screen: turned, not zoomed. */
  gridDirection(x: number, y: number): Scroll
}

/** The bead position of a point in grid space, in the rows and columns a space has: the row it falls in by the row pitch, and (where rows nest) the one above it. A bound left out is no bound. */
function beadInGrid(
  technique: Technique,
  space: Space,
  gridX: number,
  gridY: number,
  limits: { firstRow?: number; lastRow?: number; columns?: number },
): GridPosition | undefined {
  // Later rows are drawn over earlier ones, so try the lowest first.
  const pitch = rowPitchPx(technique)
  const lowest = Math.min(limits.lastRow ?? Infinity, Math.floor(gridY / pitch))
  const highest = Math.max(limits.firstRow ?? -Infinity, Math.ceil((gridY - CELL_SIZE_PX) / pitch))
  const radius = beadRoundness(technique) * CELL_SIZE_PX

  for (let row = lowest; row >= highest; row -= 1) {
    const offsetY = gridY - rowTopPx(technique, row)
    const offsetX = gridX - shiftOf(space, technique, row)
    if (offsetY < 0 || offsetY >= CELL_SIZE_PX || (limits.columns !== undefined && offsetX < 0)) {
      continue
    }
    const column = Math.floor(offsetX / CELL_SIZE_PX)
    if (limits.columns !== undefined && column >= limits.columns) {
      continue
    }
    if (inRoundedCorner(offsetX - column * CELL_SIZE_PX, offsetY, radius)) {
      continue
    }
    return { row, column }
  }
  return undefined
}

function inRoundedCorner(x: number, y: number, radius: number): boolean {
  if (radius <= 0) {
    return false
  }
  const cornerX = x < radius ? radius : x > CELL_SIZE_PX - radius ? CELL_SIZE_PX - radius : x
  const cornerY = y < radius ? radius : y > CELL_SIZE_PX - radius ? CELL_SIZE_PX - radius : y
  return (x - cornerX) ** 2 + (y - cornerY) ** 2 > radius ** 2
}

/** A box's rectangle in grid space: its beads, and the half bead an offset technique's shifted rows add on the right. */
function gridBox(technique: Technique, box: Frame): Region {
  const top = rowTopPx(technique, box.row)
  return {
    x: box.column * CELL_SIZE_PX,
    y: top,
    width: box.columns * CELL_SIZE_PX + (isOffsetTechnique(technique) ? CELL_SIZE_PX / 2 : 0),
    height: rowTopPx(technique, box.row + box.rows - 1) + CELL_SIZE_PX - top,
  }
}

export function surfaceView({ space, technique, rotation, zoom, scroll = { x: 0, y: 0 }, viewport = { width: 0, height: 0 } }: SurfaceViewInput): SurfaceView {
  /** Grid space to displayed space, at a zoom: the matrix gridToRegion gives for a region at the origin. */
  const matrix = (at: number) => gridToRegion(space.extent, { x: 0, y: 0, width: 0, height: 0 }, at, rotation)
  const displayed = (x: number, y: number, at: number): Scroll => {
    const [a, b, c, d, e, f] = matrix(at)
    return { x: a * x + c * y + e, y: b * x + d * y + f }
  }
  const displayedBox = (box: Frame, at: number): Region => {
    const grid = gridBox(technique, box)
    const first = displayed(grid.x, grid.y, at)
    const last = displayed(grid.x + grid.width, grid.y + grid.height, at)
    return { x: Math.min(first.x, last.x), y: Math.min(first.y, last.y), width: Math.abs(last.x - first.x), height: Math.abs(last.y - first.y) }
  }
  const inViewport = (region: Region): Region => ({ ...region, x: region.x - scroll.x, y: region.y - scroll.y })
  /** A point of the viewport in grid space: the turn and the zoom undone. The matrix is a quarter turn times the zoom, so its inverse is its transpose over the zoom squared. */
  const toGrid = (point: Scroll): [number, number] => {
    const [a, b, c, d, e, f] = matrix(zoom)
    const x = point.x + scroll.x - e
    const y = point.y + scroll.y - f
    return [(a * x + b * y) / zoom ** 2 + 0, (c * x + d * y) / zoom ** 2 + 0]
  }
  const centre = (box: Region): Scroll => ({ x: box.x + box.width / 2 - viewport.width / 2, y: box.y + box.height / 2 - viewport.height / 2 })

  return {
    zoom,
    viewport,
    beadToPoint: ({ row, column }) => {
      const at = displayed(shiftOf(space, technique, row) + column * CELL_SIZE_PX + CELL_SIZE_PX / 2, rowTopPx(technique, row) + CELL_SIZE_PX / 2, zoom)
      return { x: at.x - scroll.x, y: at.y - scroll.y }
    },
    beadBox: (box) => inViewport(displayedBox(box, zoom)),
    pointToBead: (point) => {
      const [gridX, gridY] = toGrid(point)
      if (space.open) {
        return beadInGrid(technique, space, gridX, gridY, {})
      }
      if (gridX < 0 || gridY < 0 || gridY >= space.extent.height) {
        return undefined
      }
      return beadInGrid(technique, space, gridX, gridY, { firstRow: 0, lastRow: space.rows - 1, columns: space.columns })
    },
    pointToCell: (point) => {
      const [gridX, gridY] = toGrid(point)
      const row = Math.round((gridY - CELL_SIZE_PX / 2) / rowPitchPx(technique))
      return { row: row + 0, column: Math.floor((gridX - shiftOf(space, technique, row)) / CELL_SIZE_PX) }
    },
    frameBox: (frame) => {
      const shown = inViewport(displayedBox(frame, zoom))
      return { x: shown.x - FRAME_OUTSET_PX, y: shown.y - FRAME_OUTSET_PX, width: shown.width + FRAME_OUTSET_PX * 2, height: shown.height + FRAME_OUTSET_PX * 2 }
    },
    scrollToCentre: (box) => centre(box ? displayedBox(box, zoom) : { x: 0, y: 0, width: 0, height: 0 }),
    scrollAfterZoom: (anchor, to) => {
      const ratio = to / zoom
      return { x: (scroll.x + anchor.x) * ratio - anchor.x, y: (scroll.y + anchor.y) * ratio - anchor.y }
    },
    zoomToFit: (box, margin) => {
      const shown = displayedBox(box, 1)
      const across = shown.width > 0 ? (viewport.width - margin.width * 2) / shown.width : Infinity
      const down = shown.height > 0 ? (viewport.height - margin.height * 2) / shown.height : Infinity
      return Math.floor(Math.min(1, across, down) * 100) / 100
    },
    beadStep: () => {
      const origin = displayed(0, 0, zoom)
      const column = displayed(CELL_SIZE_PX, 0, zoom)
      const row = displayed(0, rowPitchPx(technique), zoom)
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
