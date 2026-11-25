import type { Rect, FrameSheet } from '../domain/canvas'
import { isFrameLayer, rotationSwapsAxes, type FrameRef, type GridPosition, type Layer as LayerRef, type Rotation } from '../domain/grid'
import { frameGeometry } from '../domain/frameShape'
import { laidRect } from '../domain/frameOrientation'
import { gridGeometry, type LayerGeometry } from '../domain/layerGeometry'
import { columnCycle, describeWeave, rowCycle, wholeCycles, type BeadCell, type Technique, type TechniqueSettings, type Weave } from '../domain/weave'
import { beadsBox } from '../domain/weaveGeometry'
import type { DrawingContext } from './beadLook'
import { frameOutsetPx } from './rulerScale'
import type { Space } from './space'
import { CELL_SIZE_PX, cellSizePx, type Size } from './cellSize'
import { NO_FRAME, unwoven, weaveOf } from '../domain/layerRecord'
import type { Affine } from './gestureView'

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
  /** How the Canvas's Bead is drawn (ADR 0068): its real cell; nothing is the Technique's own cell. A Frame given without
   * a cell of its own is drawn in it too. */
  cell?: BeadCell
  /** The Frame with its own Weave (ticket 492): a view that has one lays it out in its own geometry, from its top-left
   * position's corner, `scale` times as wide as the Canvas's beads where its Bead is (ticket 0665; see `placedFrame`). Left
   * out, the view is one layer: the Canvas, or the Frame alone in an own space. */
  frame?: Pick<Rect, 'rows' | 'columns'> & Weave & Partial<Pick<FrameSheet, 'shape' | 'settings' | 'quarterTurns'>> & { scale?: number }
  /** Which Frame `frame` is (ticket 1216): what a hit on it names. */
  frameLayer?: FrameRef
  rotation: Rotation
  zoom: number
  /** Where the viewport's top-left corner is in displayed space; nothing when left out. */
  scroll?: Scroll
  /** The viewport's size, for centring; nothing when left out. */
  viewport?: Size
  /** How the Frame's own surface is drawn, where it is not drawn as this view is (ticket 1187): the Frame layer then
   * lies in this view by its own transform, never through the Canvas's rotation. Left out, the Frame is drawn as the
   * Canvas is, as while the Canvas carries it. */
  frameDrawing?: FrameDrawing
  /** The Project's other Frames (ticket 1219), each laid out and hit as `frame` is, with its own drawing where it has
   * one. */
  others?: readonly ViewFrame[]
}

/** One more Frame of a view (ticket 1219): as `frame`, `frameLayer` and `frameDrawing` give the first. */
interface ViewFrame {
  frame: NonNullable<SurfaceViewInput['frame']>
  frameLayer: FrameRef
  frameDrawing?: FrameDrawing
}

/** One Frame as a view holds it: its layer, the rectangle it lies in, and its own transform and margin sheet where its
 * surface is drawn. A Frame without a drawing is no more than its layer's measures: nothing lies on it. */
interface Sheet {
  ref: FrameRef
  layer: Layer
  laid: Rect
  own: ((at: number) => Affine) | undefined
  margin: Region | undefined
}

/** The Frame's own drawing (ticket 1187): the quarter turn and scroll its surface is drawn at, and how a point of that
 * drawing lies among this view's points (its lean against this view's, `seamOf`). */
interface FrameDrawing {
  rotation: Rotation
  scroll: Scroll
  seam: Affine
  /** Its margin sheet in that drawing's grid px (ticket 1188): opaque, taking no press, whatever lies under it. */
  sheet?: Region
}

/** A point carried by a plane transform. */
function applied({ a, b, c, d, e, f }: Affine, x: number, y: number): Scroll {
  return { x: a * x + c * y + e, y: b * x + d * y + f }
}

/** How far `to` lies from `from`. */
function difference(to: Scroll, from: Scroll): Scroll {
  return { x: to.x - from.x, y: to.y - from.y }
}

/** A plane transform undone. */
function inverted({ a, b, c, d, e, f }: Affine): Affine {
  const det = a * d - b * c
  return { a: d / det, b: -b / det, c: -c / det, d: a / det, e: (c * f - d * e) / det, f: (b * e - a * f) / det }
}

/** `outer` after `inner`: a point carried by `inner`, then by `outer`. */
function composed(outer: Affine, inner: Affine): Affine {
  return {
    a: outer.a * inner.a + outer.c * inner.b,
    b: outer.b * inner.a + outer.d * inner.b,
    c: outer.a * inner.c + outer.c * inner.d,
    d: outer.b * inner.c + outer.d * inner.d,
    e: outer.a * inner.e + outer.c * inner.f + outer.e,
    f: outer.b * inner.e + outer.d * inner.f + outer.f,
  }
}

/** Which layer a block of beads is measured in: the Canvas (the default) or the Frame laid over it, by reference
 * (ticket 1216; ticket 1217 has the UI name the layer itself). */
export type ViewLayer = LayerRef

export interface SurfaceView {
  /** The zoom this view is at. */
  zoom: number
  /** The viewport's size; 0 by 0 until the surface is measured. */
  viewport: Size
  /** Where a bead's centre is in the viewport. With a `layer` the position is that layer's own (a Frame's cell by its
   * own row and column, ADR 0066); without, a Canvas position. */
  beadToPoint(position: GridPosition, layer?: ViewLayer): Scroll
  // The rectangle a block of beads covers in the viewport, with the half bead an offset technique's shifted rows add on
  // the right.
  beadBox(box: Rect, layer?: ViewLayer): Region
  /** The bead under a point of the viewport, or undefined between beads (ADR 0018). A point on the Frame is its bead, by
   * its own row and column; a point on the Canvas beside it, whose position the Frame's own count would claim, is none. */
  pointToBead(point: Scroll): GridPosition | undefined
  /** The bead under a point and the layer it is on (ADR 0066): where the Frame draws shorter than the rows it names, a
   * Frame bead and a Canvas bead share a position, and only the layer tells them apart. */
  pointToHit(point: Scroll): (GridPosition & { layer: ViewLayer }) | undefined
  /** Whether a point is on the margin sheet of a Frame drawn on its own surface (ticket 1188), beside the Frame: where
   * the keep-out margin refuses a press at any angle. Where the Frame is drawn as the Canvas is, its margin is the
   * Canvas positions round it (`inMargin`). */
  onMarginSheet(point: Scroll): boolean
  /** Whether a point is on a Frame where it has no bead (tickets 0592, 1196): a Custom frame's Seam or Off-shape, a
   * staggered Frame's empty half bead; where a press is refused as on the keep-out margin. */
  offShapeAt(point: Scroll): boolean
  /** The Frame's cell under a point on a Custom frame, on a bead or not (ticket 0594): what the Select tool marks out
   * there, a rectangle on screen; none off the Frame or on one without a shape. */
  frameCellAt(point: Scroll): (GridPosition & { layer: FrameRef }) | undefined
  /** The bead position nearest a point, gaps and rounded corners included, in a layer's geometry and its own count: what
   * dragging a Selection needs. */
  pointToCell(point: Scroll, layer?: ViewLayer): GridPosition
  /** The bead position a drag pressed at `pressed` (grid space, `pointToGrid`) has carried `from` to, the pointer now
   * at `point`: as far as the pointer went, in whole beads, or in whole stagger cycles of the layer's Weave, which is
   * how a Piece moves (ticket 1150). Not the position under the pointer: on a staggered Weave that one zigzags. */
  carriedCell(from: GridPosition, pressed: Scroll, point: Scroll, layer?: ViewLayer, byCycles?: boolean): GridPosition
  /** The Frame's line in the viewport: its beads' rectangle with the line's outset, which is what its handles stand
   * on. A Frame given whole is taken as it lies, turned (ticket 0667). */
  frameBox(frame: Rect | FrameSheet): Region
  // The scroll that puts the middle of a block of beads, or the origin when there is none, in the middle of the
  // viewport.
  scrollToCentre(box?: Rect, layer?: ViewLayer): Scroll
  // The scroll after the zoom changes to `to`, keeping the displayed point under `anchor` (a position in the viewport)
  // where it was.
  scrollAfterZoom(anchor: Scroll, to: number): Scroll
  // The largest zoom, never past `most` (100% unless said), at which a block of beads leaves `margin` px clear on
  // every side of the viewport; whole percent, rounded down.
  zoomToFit(box: Rect, margin: Size, layer?: ViewLayer, most?: number): number
  /** How far one step along a row (`column`) and one step down (`row`) go on screen, in a layer's Weave. */
  beadStep(layer?: ViewLayer): { column: Scroll; row: Scroll }
  /** A point in grid space, in the viewport. For the layouts that hang things off a bead's edge (the rulers). */
  gridToPoint(x: number, y: number, layer?: ViewLayer): Scroll
  /** A point of the viewport, in grid space: where it stays while the view is moved or zoomed. */
  pointToGrid(point: Scroll): Scroll
  /** A direction in grid space as it points on screen: turned, not zoomed. */
  gridDirection(x: number, y: number, layer?: ViewLayer): Scroll
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

/** Where the middle of a Frame lies in its own drawing, in grid px from its first position's corner: half what it covers as
 * it lies (spec 1234), its Bead's size over the Canvas's making its px larger or smaller. */
export function frameMiddlePx(placed: Pick<Rect, 'rows' | 'columns'> & Weave & Partial<Pick<FrameSheet, 'shape' | 'quarterTurns'>> & { scale: number }, canvasCell: BeadCell | undefined): Scroll {
  const weave: Weave = { ...weaveOf(placed), cell: placed.cell ?? canvasCell }
  const laid = laidRect({ ...unwoven(placed), ...weave })
  const extent = layerExtentPx(weave, laid.columns, laid.rows)
  return { x: (extent.width * placed.scale) / 2, y: (extent.height * placed.scale) / 2 }
}

/** One layer of a view: its Weave and Layer geometry, where its first position sits in grid space, and how many times
 * larger than the Canvas's its beads are drawn (ticket 0665). Its own px, from its first position, are `scale` grid px. */
interface Layer {
  weave: Weave
  geometry: LayerGeometry
  description: ReturnType<typeof describeWeave>
  cell: Size
  origin: Scroll
  scale: number
}

function layerOf(weave: Weave, geometry: LayerGeometry, origin: Scroll, scale = 1): Layer {
  return { weave, geometry, description: describeWeave(weave), cell: cellSizePx(weave.technique, weave.cell), origin, scale }
}

export function surfaceView({ space, technique, techniqueSettings, cell: canvasCell, frame, frameLayer = NO_FRAME, rotation, zoom, scroll = { x: 0, y: 0 }, viewport = { width: 0, height: 0 }, frameDrawing, others = [] }: SurfaceViewInput): SurfaceView {
  const canvasWeave: Weave = { technique, techniqueSettings, cell: canvasCell }
  // The Canvas has no edge; a Project drawn on its own is its rows and columns from its first.
  const edge = space.open ? undefined : { row: 0, column: 0, rows: space.rows, columns: space.columns }
  const canvas = layerOf(canvasWeave, gridGeometry(canvasWeave, edge), { x: 0, y: 0 })
  /** Grid space to displayed space, at a zoom: the matrix gridToRegion gives for a region at the origin. */
  const matrix = (at: number) => gridToRegion(space.extent, { x: 0, y: 0, width: 0, height: 0 }, at, rotation)
  const displayed = (x: number, y: number, at: number): Scroll => {
    const [a, b, c, d, e, f] = matrix(at)
    return { x: a * x + c * y + e, y: b * x + d * y + f }
  }
  /** One Frame of the view (ticket 1219): the first as `frame`, the rest from `others`, each with its own drawing. */
  const sheetOf = (placed: ViewFrame['frame'], ref: FrameRef, drawing: FrameDrawing | undefined): Sheet | undefined => {
    const held = weaveOf(placed)
    const sheetWeave: Weave = { ...held, cell: placed.cell ?? canvasCell }
    if (!space.open) return undefined
    const layer = layerOf(sheetWeave, frameGeometry({ ...unwoven(placed), ...sheetWeave }), { x: 0, y: 0 }, placed.scale)
    return {
      ref,
      layer,
      // The rectangle the Frame lies in, turned with it (ticket 0667).
      laid: laidRect({ ...unwoven(placed), ...sheetWeave }),
      own: drawing ? frameTransform(layer, drawing, zoom, scroll) : undefined,
      margin: drawing?.sheet,
    }
  }
  const first = frame && sheetOf(frame, frameLayer, frameDrawing)
  const sheets: Sheet[] = [...(first ? [first] : []), ...others.flatMap((other) => sheetOf(other.frame, other.frameLayer, other.frameDrawing) ?? [])]
  const sheet = first?.layer
  const sheetWeave = frame && { ...weaveOf(frame), cell: frame.cell ?? canvasCell }
  const sheetNamed = (layer: Layer): Sheet | undefined => sheets.find((each) => each.layer === layer)
  const layerNamed = (name: ViewLayer | undefined): Layer => (isFrameLayer(name) && sheet ? (sheets.find((each) => each.ref === name) ?? first!).layer : canvas)
  /** A point of a layer's own px (from its first position, `scale` grid px each) in displayed space at a zoom. */
  const placed = (layer: Layer, x: number, y: number, at: number): Scroll => {
    const own = sheetNamed(layer)?.own
    return own ? applied(own(at), x, y) : displayed(layer.origin.x + x * layer.scale, layer.origin.y + y * layer.scale, at)
  }
  const displayedBox = (box: Rect, at: number, layer: Layer): Region => {
    const grid = gridBox(layer.weave, box)
    // Four corners, as a layer with its own transform may lie at an angle to the view.
    const corners = [placed(layer, grid.x, grid.y, at), placed(layer, grid.x + grid.width, grid.y + grid.height, at), placed(layer, grid.x + grid.width, grid.y, at), placed(layer, grid.x, grid.y + grid.height, at)]
    const xs = corners.map((corner) => corner.x)
    const ys = corners.map((corner) => corner.y)
    return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) }
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
  const gridPoint = (x: number, y: number): Scroll => {
    const at = displayed(x, y, zoom)
    return { x: at.x - scroll.x, y: at.y - scroll.y }
  }
  const centre = (box: Region): Scroll => ({ x: box.x + box.width / 2 - viewport.width / 2, y: box.y + box.height / 2 - viewport.height / 2 })

  /** The bead of a layer under a point of its own px (from its first position), or undefined. */
  const beadIn = (layer: Layer, gridX: number, gridY: number): GridPosition | undefined => layer.geometry.positionAt({ x: gridX / CELL_SIZE_PX, y: gridY / CELL_SIZE_PX })
  const cellIn = ({ description, cell }: Layer, gridX: number, gridY: number): GridPosition => description.nearestPosition(gridX, gridY, cell.width, cell.height)

  /** A point of the viewport in a layer's own px, from its first position's corner: through the Frame's own transform
   * where it has one. */
  const ownPoint = (layer: Layer, point: Scroll): Scroll => {
    const own = sheetNamed(layer)?.own
    if (own) return applied(inverted(own(zoom)), point.x + scroll.x, point.y + scroll.y)
    const [gridX, gridY] = toGrid(point)
    return { x: (gridX - layer.origin.x) / layer.scale, y: (gridY - layer.origin.y) / layer.scale }
  }

  /** A point of the viewport on a Frame, in its own px from its first position's corner, or none off it. */
  const onSheetOf = (each: Sheet, point: Scroll): { x: number; y: number } | undefined => {
    const extent = layerExtentPx(each.layer.weave, each.laid.columns, each.laid.rows)
    const { x, y } = ownPoint(each.layer, point)
    return x >= 0 && y >= 0 && x < extent.width && y < extent.height ? { x, y } : undefined
  }
  /** The Frame under a point of the viewport, and the point in its own px; none off every Frame. */
  const sheetAt = (point: Scroll): { on: Sheet; at: Scroll } | undefined => {
    for (const each of sheets) {
      // A Frame with no drawing of its own lies nowhere in this view.
      if (!each.own) continue
      const at = onSheetOf(each, point)
      if (at) return { on: each, at }
    }
    return undefined
  }

  /** Whether a point of the viewport is on the margin sheet round a Frame drawn on its own (ticket 1188), off the Frame. */
  const onMarginSheet = (point: Scroll): boolean => {
    if (sheetAt(point)) return false
    return sheets.some(({ layer, own, margin }) => {
      if (!own || !margin) return false
      const at = ownPoint(layer, point)
      const [x, y] = [layer.origin.x + at.x * layer.scale, layer.origin.y + at.y * layer.scale]
      return x >= margin.x && y >= margin.y && x < margin.x + margin.width && y < margin.y + margin.height
    })
  }

  const pointToHit = (point: Scroll): (GridPosition & { layer: ViewLayer }) | undefined => {
    const [gridX, gridY] = toGrid(point)
    const hit = sheetAt(point)
    // The Frame is opaque: a point on it is the Frame's bead or none, never the Canvas under it.
    if (hit) {
      const found = beadIn(hit.on.layer, hit.at.x, hit.at.y)
      return found && { ...found, layer: hit.on.ref }
    }
    if (onMarginSheet(point)) return undefined
    const found = beadIn(canvas, gridX, gridY)
    return found && { ...found, layer: 'canvas' }
  }

  return {
    zoom,
    viewport,
    beadToPoint: (position, named) => {
      // A position that names its layer is that layer's own; one that does not is a Canvas position.
      const layer = named ? layerNamed(named) : canvas
      const local = position
      // A position the Layer has lies where its geometry places it; one past its edge, as its Weave would put it.
      const place = layer !== canvas ? layer.geometry.place(local) : undefined
      const box = place ? inGridPx(place.box) : positionBoxPx(layer.weave, local.row, local.column)
      const at = placed(layer, box.x + box.width / 2, box.y + box.height / 2, zoom)
      return { x: at.x - scroll.x, y: at.y - scroll.y }
    },
    beadBox: (box, layer) => inViewport(displayedBox(box, zoom, layerNamed(layer))),
    pointToHit,
    onMarginSheet,
    offShapeAt: (point) => {
      const hit = sheetAt(point)
      if (!hit) return false
      const { layer: on } = hit.on
      const { x: ownX, y: ownY } = hit.at
      // A Custom frame's beads lie where its layout puts them (ADR 0077), not on rows and columns: a point between them
      // is off its shape.
      if (!on.geometry.grid) return beadIn(on, ownX, ownY) === undefined
      // A staggered Frame's empty half bead at the short end of a line holds no cell (ticket 1196); a gap between beads is in one.
      if (on.description.shift === 0) return false
      const [x, y] = [ownX / CELL_SIZE_PX, ownY / CELL_SIZE_PX]
      const cells = on.geometry.positionsIn({ x: x - 1, y: y - 1, width: 2, height: 2 })
      return !cells.some((position) => {
        const box = on.geometry.place(position)!.box
        return x >= box.x && x < box.x + box.width && y >= box.y && y < box.y + box.height
      })
    },
    frameCellAt: (point) => {
      const hit = sheetAt(point)
      if (!hit || hit.on.layer.geometry.grid) return undefined
      const { layer: laidOut, laid: rect, ref } = hit.on
      const cell = cellIn(laidOut, hit.at.x, hit.at.y)
      const within = { row: Math.min(Math.max(cell.row, 0), rect.rows - 1), column: Math.min(Math.max(cell.column, 0), rect.columns - 1) }
      return { ...within, layer: ref }
    },
    pointToBead: (point) => {
      const hit = pointToHit(point)
      return hit && { row: hit.row, column: hit.column }
    },
    pointToCell: (point, layer) => {
      const on = layerNamed(layer)
      const own = ownPoint(on, point)
      return cellIn(on, own.x, own.y)
    },
    carriedCell: (from, pressed, point, layer, byCycles = false) => {
      const on = layerNamed(layer)
      const { weave } = on
      const { across, down } = beadStepPx(weave)
      // How far the pointer went in the layer's own px: the Frame's through its own transform where it has one.
      const [gridX, gridY] = toGrid(point)
      const went = sheetNamed(on)?.own ? difference(ownPoint(on, point), ownPoint(on, gridPoint(pressed.x, pressed.y))) : { x: (gridX - pressed.x) / on.scale, y: (gridY - pressed.y) / on.scale }
      const rows = wholeCycles(went.y / down, byCycles ? rowCycle(weave) : 1)
      const columns = wholeCycles(went.x / across, byCycles ? columnCycle(weave) : 1)
      return { row: from.row + rows, column: from.column + columns }
    },
    frameBox: (box) => {
      // The Frame's rectangle as it lies on the Canvas: its own cells from its first row and column.
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
    zoomToFit: (box, margin, layer, most = 1) => {
      const shown = displayedBox(box, 1, layerNamed(layer))
      const across = shown.width > 0 ? (viewport.width - margin.width * 2) / shown.width : Infinity
      const down = shown.height > 0 ? (viewport.height - margin.height * 2) / shown.height : Infinity
      return Math.floor(Math.min(most, across, down) * 100) / 100
    },
    beadStep: (name) => {
      const layer = layerNamed(name)
      const { weave, scale } = layer
      const { across, down } = beadStepPx(weave)
      const own = !!sheetNamed(layer)?.own
      const origin = own ? placed(layer, 0, 0, zoom) : displayed(0, 0, zoom)
      const column = own ? placed(layer, across, 0, zoom) : displayed(across * scale, 0, zoom)
      const row = own ? placed(layer, 0, down, zoom) : displayed(0, down * scale, zoom)
      return { column: { x: column.x - origin.x, y: column.y - origin.y }, row: { x: row.x - origin.x, y: row.y - origin.y } }
    },
    gridToPoint: (x, y, named) => {
      // A Frame's own px (its scale in grid px) lie where its own surface puts them (spec 1234).
      const on = named ? layerNamed(named) : canvas
      if (!sheetNamed(on)?.own) return gridPoint(x, y)
      const at = placed(on, x / on.scale, y / on.scale, zoom)
      return { x: at.x - scroll.x, y: at.y - scroll.y }
    },
    pointToGrid: (point) => {
      const [x, y] = toGrid(point)
      return { x, y }
    },
    gridDirection: (x, y, named) => {
      // A Frame's own steps are as its surface turns them, not as the Canvas does (spec 1234): a unit step either way.
      const on = named ? layerNamed(named) : canvas
      const own = sheetNamed(on)?.own
      if (!own) {
        const origin = displayed(0, 0, 1)
        const at = displayed(x, y, 1)
        return { x: at.x - origin.x, y: at.y - origin.y }
      }
      const origin = applied(own(1), 0, 0)
      const at = applied(own(1), x, y)
      const length = Math.hypot(at.x - origin.x, at.y - origin.y) || 1
      return { x: (at.x - origin.x) / length, y: (at.y - origin.y) / length }
    },
  }
}

/** The Frame layer's own transform (ticket 1187): its px from its first position's corner, through the quarter turn its
 * surface is drawn at, its drawing's scroll and the seam, to a view's displayed space at a zoom. The view is at
 * `zoom` and `scroll`; at another zoom the whole scales about the displayed origin. */
function frameTransform(sheet: Layer, { rotation, scroll: drawnScroll, seam }: FrameDrawing, zoom: number, scroll: Scroll): (at: number) => Affine {
  const [a, b, c, d] = gridToRegion(OPEN_EXTENT, { x: 0, y: 0, width: 0, height: 0 }, zoom, rotation)
  // Own px to the Frame drawing's displayed space, then to its points, through the seam, and back to displayed space.
  const own: Affine = { a: a * sheet.scale, b: b * sheet.scale, c: c * sheet.scale, d: d * sheet.scale, e: a * sheet.origin.x + c * sheet.origin.y, f: b * sheet.origin.x + d * sheet.origin.y }
  const toPoints: Affine = { a: 1, b: 0, c: 0, d: 1, e: -drawnScroll.x, f: -drawnScroll.y }
  const toDisplayed: Affine = { a: 1, b: 0, c: 0, d: 1, e: scroll.x, f: scroll.y }
  const atZoom = composed(toDisplayed, composed(seam, composed(toPoints, own)))
  return (at) => {
    const by = at / zoom
    return { a: atZoom.a * by, b: atZoom.b * by, c: atZoom.c * by, d: atZoom.d * by, e: atZoom.e * by, f: atZoom.f * by }
  }
}
