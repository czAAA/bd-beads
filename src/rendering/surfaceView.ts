import { frameContains, type Rect, type FrameSheet } from '../domain/canvas'
import { rotationSwapsAxes, type GridPosition, type Rotation } from '../domain/grid'
import { frameFootprint } from '../domain/footprint'
import { frameGeometry } from '../domain/frameShape'
import { laidRect } from '../domain/frameOrientation'
import { gridGeometry, type LayerGeometry } from '../domain/layerGeometry'
import { describeWeave, type BeadCell, type Technique, type TechniqueSettings, type Weave } from '../domain/weave'
import { beadsBox } from '../domain/weaveGeometry'
import type { DrawingContext } from './beadLook'
import { frameOutsetPx } from './rulerScale'
import type { Space } from './space'
import { CELL_SIZE_PX, cellSizePx, type Size } from './cellSize'
import { unwoven, weaveOf } from '../domain/layerRecord'

// The Surface view (ADR 0010, 0018, 0026): the one place mapping beads and screen points both ways. Rotation is private;
// where a bead is comes from the Weave's description (ticket 0623). Grid space is px at zoom 1; displayed space is
// zoomed and turned about the beads' box (Canvas: the origin); a point is displayed space less the scroll.

export interface Scroll {
  x: number
  y: number
}

export type Extent = Size

export interface Region {
  x: number
  y: number
  width: number
  height: number
}

/** How far one bead's step across and one row's step down go in a layer, in grid px: a bead across and a row pitch
 * down. */
export function beadStepPx(weave: Weave): { across: number; down: number } {
  const description = describeWeave(weave)
  const cell = cellSizePx(weave.technique, weave.cell)
  return {
    across: description.origin({ row: 0, column: 1 }, cell.width, cell.height).x,
    down: description.origin({ row: 1, column: 0 }, cell.width, cell.height).y,
  }
}

/** Where a position's bead is in a space, in grid px: its rectangle from the top-left. */
export function positionBoxPx(weave: Weave, row: number, column: number): Region {
  const cell = cellSizePx(weave.technique, weave.cell)
  return describeWeave(weave).box({ row, column }, cell.width, cell.height)
}

/** The rectangle round beads from (`row`, `column`) down `rows` and across `columns`, in grid px: the union of the
 * corner beads. */
export function positionsBoxPx(weave: Weave, row: number, column: number, rows: number, columns: number): Region {
  const cell = cellSizePx(weave.technique, weave.cell)
  return beadsBox(describeWeave(weave), { row, column, rows, columns }, cell.width, cell.height)
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
  /** The Canvas's Technique settings (ticket 0625): its Drop; one left out is its default. */
  techniqueSettings?: TechniqueSettings
  /** How the Canvas's Bead is drawn (ADR 0068, ticket 0724); nothing for a Bead nobody knows. A Frame given without
   * a cell of its own is drawn in it too. */
  cell?: BeadCell
  /** The Frame on the Canvas with its own Weave (ticket 492): a view that has one lays it out in its own geometry, from
   * its top-left position's corner, `scale` times as wide as the Canvas's beads where its Bead is (ticket 0665; see
   * `placedFrame`). Left out, the view is one layer: the Canvas, or the Frame alone in an own space. */
  frame?: Rect & Weave & Partial<Pick<FrameSheet, 'shape' | 'settings' | 'quarterTurns'>> & { scale?: number }
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
   * there, a rectangle on screen; none off the Frame or on one without a shape. */
  frameCellAt(point: Scroll): (GridPosition & { layer: 'frame' }) | undefined
  /** The bead position nearest a point, gaps and rounded corners included, in a layer's geometry: what dragging a Frame
   * needs. */
  pointToCell(point: Scroll, layer?: ViewLayer): GridPosition
  /** The Frame's line in the viewport: its beads' rectangle with the line's outset, which is what its handles stand
   * on. A Frame given whole is taken as it lies, turned (ticket 0667). */
  frameBox(frame: Rect | FrameSheet): Region
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
  /** A point of the viewport in the Canvas's grid space, the turn and the zoom undone: where a dragged Axis handle is
   * (ticket 0704). */
  pointToGrid(point: Scroll): Scroll
  /** A direction in grid space as it points on screen: turned, not zoomed. */
  gridDirection(x: number, y: number): Scroll
}

/** A box's rectangle in a layer's grid space: its beads, and on rows the half bead a shifted row adds on the right. */
export function gridBox(weave: Weave, box: Rect): Region {
  const cell = cellSizePx(weave.technique, weave.cell)
  return describeWeave(weave).blockBox(box, cell.width, cell.height)
}

/** A box of a Layer geometry, in bead widths, in grid px (ticket 0630). */
export function inGridPx({ x, y, width, height }: Region): Region {
  return { x: x * CELL_SIZE_PX, y: y * CELL_SIZE_PX, width: width * CELL_SIZE_PX, height: height * CELL_SIZE_PX }
}

/** The size in grid px of a block of beads from the first position of a layer: what a Frame covers on the Canvas. */
export function layerExtentPx(weave: Weave, columns: number, rows: number): Extent {
  const cell = cellSizePx(weave.technique, weave.cell)
  return describeWeave(weave).blockExtent(columns, rows, cell.width, cell.height)
}

/** Where a Frame's first position sits on the Canvas, in grid px: the corner its own layout is drawn from (ticket 492). */
export function frameOriginPx(canvas: Weave, frame: Pick<Rect, 'row' | 'column'>): Scroll {
  const cell = cellSizePx(canvas.technique, canvas.cell)
  return describeWeave(canvas).origin(frame, cell.width, cell.height)
}

/** One layer of a view: its Weave and Layer geometry, where its first position sits in grid space, the address of
 * that position, and how many times larger than the Canvas's its beads are drawn (ticket 0665). Its own px, from its
 * first position, are `scale` grid px. */
interface Layer {
  weave: Weave
  geometry: LayerGeometry
  description: ReturnType<typeof describeWeave>
  cell: Size
  origin: Scroll
  offset: GridPosition
  scale: number
}

function layerOf(weave: Weave, geometry: LayerGeometry, origin: Scroll, offset: GridPosition, scale = 1): Layer {
  return { weave, geometry, description: describeWeave(weave), cell: cellSizePx(weave.technique, weave.cell), origin, offset, scale }
}

export function surfaceView({ space, technique, techniqueSettings, cell: canvasCell, frame, rotation, zoom, scroll = { x: 0, y: 0 }, viewport = { width: 0, height: 0 } }: SurfaceViewInput): SurfaceView {
  const canvasWeave: Weave = { technique, techniqueSettings, cell: canvasCell }
  // The Canvas has no edge; a Project drawn on its own is its rows and columns from its first.
  const edge = space.open ? undefined : { row: 0, column: 0, rows: space.rows, columns: space.columns }
  const canvas = layerOf(canvasWeave, gridGeometry(canvasWeave, edge), { x: 0, y: 0 }, { row: 0, column: 0 })
  const held = frame && weaveOf(frame)
  const sheetWeave: Weave | undefined = held && { ...held, cell: frame.cell ?? canvasCell }
  const sheet = frame && sheetWeave && space.open ? layerOf(sheetWeave, frameGeometry({ ...unwoven(frame), ...sheetWeave }), frameOriginPx(canvasWeave, frame), { row: frame.row, column: frame.column }, frame.scale) : undefined
  // The rectangle the Frame lies in, turned with it (ticket 0667).
  const laid = frame && sheetWeave ? laidRect({ ...unwoven(frame), ...sheetWeave }) : undefined
  const layerNamed = (name: ViewLayer | undefined): Layer => (name === 'frame' && sheet ? sheet : canvas)
  // A Custom frame's beads lie where its layout puts them (ADR 0077), not on rows and columns: a point between them is
  // off its shape.
  const laidOut = sheet && !sheet.geometry.grid ? sheet : undefined
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
    const first = displayed(layer.origin.x + grid.x * layer.scale, layer.origin.y + grid.y * layer.scale, at)
    const last = displayed(layer.origin.x + (grid.x + grid.width) * layer.scale, layer.origin.y + (grid.y + grid.height) * layer.scale, at)
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

  /** The bead of a layer under a point of its own px (from its first position), or undefined. */
  const beadIn = (layer: Layer, gridX: number, gridY: number): GridPosition | undefined => layer.geometry.positionAt({ x: gridX / CELL_SIZE_PX, y: gridY / CELL_SIZE_PX })
  const cellIn = ({ description, cell }: Layer, gridX: number, gridY: number): GridPosition => description.nearestPosition(gridX, gridY, cell.width, cell.height)

  /** A point of the viewport on the Frame, in its own px from its first position's corner, or none off it. */
  const onSheet = (point: Scroll): { x: number; y: number } | undefined => {
    if (!sheet || !laid) return undefined
    const [gridX, gridY] = toGrid(point)
    const extent = layerExtentPx(sheet.weave, laid.columns, laid.rows)
    const x = (gridX - sheet.origin.x) / sheet.scale
    const y = (gridY - sheet.origin.y) / sheet.scale
    return x >= 0 && y >= 0 && x < extent.width && y < extent.height ? { x, y } : undefined
  }

  const pointToHit = (point: Scroll): (GridPosition & { layer: ViewLayer }) | undefined => {
    const [gridX, gridY] = toGrid(point)
    const at = onSheet(point)
    // The Frame is opaque: a point on it is the Frame's bead or none, never the Canvas under it.
    if (sheet && at) {
      const found = beadIn(sheet, at.x, at.y)
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
      const local = { row: position.row - layer.offset.row, column: position.column - layer.offset.column }
      // A position the Layer has lies where its geometry places it; one past its edge, as its Weave would put it.
      const place = layer === sheet ? sheet.geometry.place(local) : undefined
      const box = place ? inGridPx(place.box) : positionBoxPx(layer.weave, local.row, local.column)
      const at = displayed(layer.origin.x + (box.x + box.width / 2) * layer.scale, layer.origin.y + (box.y + box.height / 2) * layer.scale, zoom)
      return { x: at.x - scroll.x, y: at.y - scroll.y }
    },
    beadBox: (box, layer) => inViewport(displayedBox(box, zoom, layerNamed(layer))),
    pointToHit,
    offShapeAt: (point) => {
      const at = laidOut && onSheet(point)
      return !!laidOut && !!at && beadIn(laidOut, at.x, at.y) === undefined
    },
    frameCellAt: (point) => {
      const at = laidOut && laid && onSheet(point)
      if (!at) return undefined
      const cell = cellIn(laidOut!, at.x, at.y)
      const within = { row: Math.min(Math.max(cell.row, 0), laid!.rows - 1), column: Math.min(Math.max(cell.column, 0), laid!.columns - 1) }
      return { ...addressOf(laidOut!, within), layer: 'frame' }
    },
    pointToBead: (point) => {
      const hit = pointToHit(point)
      return hit && { row: hit.row, column: hit.column }
    },
    pointToCell: (point, layer) => {
      const [gridX, gridY] = toGrid(point)
      const on = layerNamed(layer)
      return addressOf(on, cellIn(on, (gridX - on.origin.x) / on.scale, (gridY - on.origin.y) / on.scale))
    },
    frameBox: (box) => {
      const lying = 'technique' in box ? laidRect({ ...box, cell: sheetWeave?.cell ?? canvasCell }) : box
      const shown = inViewport(displayedBox(lying, zoom, sheet ?? canvas))
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
      const origin = displayed(0, 0, zoom)
      const { weave, scale } = layerNamed(name)
      const { across, down } = beadStepPx(weave)
      const column = displayed(across * scale, 0, zoom)
      const row = displayed(0, down * scale, zoom)
      return { column: { x: column.x - origin.x, y: column.y - origin.y }, row: { x: row.x - origin.x, y: row.y - origin.y } }
    },
    gridToPoint: (x, y) => {
      const at = displayed(x, y, zoom)
      return { x: at.x - scroll.x, y: at.y - scroll.y }
    },
    pointToGrid: (point) => {
      const [x, y] = toGrid(point)
      return { x, y }
    },
    gridDirection: (x, y) => {
      const origin = displayed(0, 0, 1)
      const at = displayed(x, y, 1)
      return { x: at.x - origin.x, y: at.y - origin.y }
    },
  }
}
