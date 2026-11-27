import { MAX_FRAMES } from '../domain/frameLimit'
import { isFrameLayer, type FrameRef, type GridPosition, type Rotation } from '../domain/grid'
import { beadRoundness, describeWeave, type Weave } from '../domain/weave'
import type { VisiblePositions } from '../domain/weaveGeometry'
import { beadBounds, colorAt, type BeadMap, type Rect } from '../domain/canvas'
import type { BeadPlace, LayerGeometry } from '../domain/layerGeometry'
import { MARGIN } from '../domain/margin'
import { laidFrame } from '../domain/frameOrientation'
import { canvasWeave, frameScale, frameWeave } from '../domain/layerWeave'
import { rowPassesOf, rowProgressOn } from '../domain/rowProgress'
import { projectDimensions } from '../domain/projectExtent'
import {
  BEAD_GAP_PX,
  beadFill,
  brighten,
  CURRENT_ROW_BRIGHTNESS,
  DEFAULT_THEME,
  drawBeadLetter,
  drawFlatBead,
  drawSeeThroughBead,
  paintedOnly,
  type BeadDrawer,
  type DrawingContext,
  type ProjectTheme,
} from './beadLook'
import type { MarginLook } from './marginLook'
import { marginForm, marginScale } from './marginForm'
import { MARGIN_PX } from './marginSizes'
import { positionMarkPattern } from './positionMarks'
import { beadInSpace, geometryDrawnAlone, spaceOf, type Space } from './space'
import { drawTile, gapColorOf, markLookOf, tileEdgeColorOf } from './tonalTiles'
import { CELL_SIZE_PX, cellSizePx } from './cellSize'
import { columnStrip } from './columnBand'
import {
  beadStepPx,
  gridBox,
  gridToRegion,
  inGridPx,
  layerExtentPx,
  regionInGridSpace,
  setGridTransform,
  type Extent,
  type Region,
  type ViewLayer,
} from './surfaceView'
import { beadsOfLayer, firstFrameId, type Layered, quarterTurnOf, frameById } from '../domain/layerRecord'
import { drawReference, EMPTY_BEAD_OPACITY, type DrawnReference } from './referenceImage'
import { blockAround, drawDraftBlock, drawsDraft, keptDraft, layDraft, type DraftImageOf, type DraftPainter } from './draftRenderer'

// The Project renderer (CONTEXT.md, ADR 0018): the one place that draws a Project's cells for any Technique. Grid space
// is px at zoom 1; the region asked for is in displayed space (zoomed, rotated, ticket 171), so cost follows what is in
// view. A `Space` (space.ts, ADR 0026) says whether it draws the Frame alone from the origin or on the Canvas.

/** The rows and columns of beads touching a stretch of grid space; a layer's row 0 is an unshifted one.
 * @internal Tests check which beads a view draws on its own. */
export function visibleBeads(
  weave: Weave,
  columns: number,
  rows: number,
  area: { left: number; right: number; top: number; bottom: number },
): VisiblePositions {
  const range = visibleBeadsOpen(weave, area)
  return {
    firstRow: Math.max(0, range.firstRow),
    lastRow: Math.min(rows - 1, range.lastRow),
    columnsOf: (row) => {
      const { first, last } = range.columnsOf(row)
      return { first: Math.max(0, first), last: Math.min(columns - 1, last) }
    },
  }
}

// The beads touching a stretch of grid space on a Canvas (ADR 0026): as visibleBeads, but unbounded, so indices may be
// negative.
function visibleBeadsOpen(weave: Weave, area: { left: number; right: number; top: number; bottom: number }): VisiblePositions {
  const cell = cellSizePx(weave.technique, weave.cell)
  return describeWeave(weave).visible(area, cell.width, cell.height)
}

/** The beads in view of a space: with no edge on the Canvas, and within the Project otherwise. `origin` is where the
 * layer's first position sits in the space's grid px (a Frame laid over the Canvas, ticket 492), and `scale` how many
 * grid px one of its own is (its Bead's size, ticket 0665). The overlay culls by it too (ticket 0675). */
export function visibleBeadsInSpace(weave: Weave, space: Space, region: Region, zoom: number, rotation: Rotation, origin: { x: number; y: number } = { x: 0, y: 0 }, scale = 1): VisiblePositions {
  const seen = regionInGridSpace(space.extent, region, zoom, rotation)
  const area = { left: (seen.left - origin.x) / scale, right: (seen.right - origin.x) / scale, top: (seen.top - origin.y) / scale, bottom: (seen.bottom - origin.y) / scale }
  return space.open ? visibleBeadsOpen(weave, area) : visibleBeads(weave, space.columns, space.rows, area)
}

/** The parts of a Project the renderer reads. */
export type DrawnProject = Layered

export interface RenderInput {
  // The Project to draw: its beads, Frame, Technique, rotation and Row progress (finished rows are drawn faded).
  // Anything shaped like one will do: the Convert image preview draws a block of beads that is not a saved Project.
  project: DrawnProject
  /** Where its positions live, from `spaceOf`: handed to the overlay as well, so both agree where a position is. */
  space: Space
  // The part of the displayed Project to draw, in displayed px: from its top-left corner in Frame-only space, how far
  // the canvas has been moved on the Canvas. The surface is this big.
  region: Region
  /** How much the Project is enlarged by; 1 is a bead 20px across. */
  zoom: number
  /** Device pixels per CSS pixel of the surface, so beads stay crisp on a high-density screen. Defaults to 1. */
  pixelRatio?: number
  theme?: ProjectTheme
  /** The look the Frame is drawn in, on its own Background (ticket 0666); defaults to `theme`, as an export's does. */
  frameTheme?: ProjectTheme
  // Draw finished rows at their normal color (ticket 352): while the pointer hovers a finished row, or after a tap on a
  // finished row. Off, they are dimmed.
  showFinished?: boolean
  // Whether Row progress is drawn: finished rows faded, the current one raised. Defaults to `rowProgressOn(project, ref)`;
  // an export, a chart that shows every bead as it is, passes false (ticket 434).
  rowMarks?: boolean
  // Redraw only these rows: their whole band is cleared and redrawn, so edits do not pile up anti-aliasing on rounded
  // beads.
  rows?: { first: number; last: number }
  /** Redraw only these columns (ticket 1038), as `rows` across the other way: the passes of rows run down the grid. */
  columns?: { first: number; last: number }
  // How many positions wide the keep-out margin is drawn (ticket 459): the surface widens it when zoomed out. Defaults
  // to `MARGIN`.
  margin?: number
  /** The expanded Frame's slim sheet (MarginSheet card, Expand the Frame; ticket 1169): its box in grid px and its
   * corners in screen px, drawn at scale 1 with no inner border in place of the 4-position sheet. The keep-out margin
   * is unchanged. */
  slimSheet?: SlimSheet
  // How one bead is drawn. Defaults to today's look; a richer one is handed in here, and never has to know about rows,
  // zoom, rotation or what is on screen.
  drawBead?: BeadDrawer
  /** The Swatch letter of each color by hex (ticket 0573): given, the Frame's beads carry their letter. Absent, none. */
  letters?: Readonly<Record<string, string>>
  /** The same for the Canvas's own beads (ticket 1092), by its own Letters switch; none in the draft look. */
  canvasLetters?: Readonly<Record<string, string>>
  // Draw each layer as one draft image where its beads are too small to show their look (ticket 0676): the editor's
  // surface. An export or a picture keeps every bead's look at any size.
  draftWhenSmall?: boolean
  /** Fill an open Canvas in its Background before drawing, so the drawing hides the empty-canvas look the editor's
   * surface lays under it (ticket 0717). Elsewhere the Canvas stays clear. */
  opaque?: boolean
  /** Draw the empty Canvas's Position marks (the default). The stand-in a pan shows leaves them to the empty-canvas
   * look under it, which draws them sharp (ticket 0732). */
  positionMarks?: boolean
  /** The reference image (ticket 0790): drawn over every layer's Background and tonal tiles and under every bead
   * (ticket 1008); where outlines are drawn instead (high contrast, the draft look) they lie over it and the Frame's
   * empty beads are see-through. Only the editor's surface hands one in, so no export, thumbnail or example prints it. */
  reference?: DrawnReference
  /** Draw a Frame's part over what its surface already holds, clearing only round its sheet (ticket 1219): one of
   * several Frames on one surface, drawn after the first or again on its own. Only with a Frame `layer`, no band. */
  alone?: boolean
  /** Redraw only this rectangle of the surface, in its device px (ticket 1239): it is cleared and every part of the layer
   * is drawn into it alone, whatever the layer's own band, so a rectangle of the shared bitmap is redrawn with every layer
   * under it. */
  within?: Region
  /** The boxes in grid px the Frames' opaque sheets cover on the Canvas (ticket 1239): a Canvas bead lying wholly inside
   * one is not drawn, as nothing shows it. Only the Canvas's own part, in the full look. */
  covered?: readonly Region[]
  /** Draw one layer of the open Canvas alone (ticket 1187), for the editor's two stacked surfaces: the Canvas's part
   * (its Background, marks and beads, the Frame left out), or the Frame's (its margin sheet, ground and beads, clear
   * round them). Absent, both, as an export draws them. */
  layer?: ViewLayer
}

/** The box the Frame draws in its own drawing, in grid px from its first position's corner: what it lies in as it is laid
 * (ticket 0667), with a margin of `margin` of its own bead positions round it (ticket 501). Its Bead's size over the
 * Canvas's makes its px larger or smaller (ticket 0665). */
function frameFootprintPx(project: DrawnProject, margin = 0, ref: FrameRef): Region | undefined {
  const laid = laidFrame(project, ref)
  if (!laid) return undefined
  const weave = frameWeave(project, ref)
  const scale = frameScale(project, ref)
  const extent = layerExtentPx(weave, laid.columns, laid.rows)
  const step = beadStepPx(weave)
  // Turned a quarter, its own rows run across the drawing.
  const sideways = (frameById(project, ref)!.quarterTurns ?? 0) % 2 === 1
  const [across, down] = [margin * (sideways ? step.down : step.across) * scale, margin * (sideways ? step.across : step.down) * scale]
  return { x: -across, y: -down, width: extent.width * scale + 2 * across, height: extent.height * scale + 2 * down }
}

// The Canvas's Position marks (CONTEXT.md): one pattern fill over the view, the Frames' opaque sheets lying over it. Each
// Frame's box has its own (drawFrameGround).
function drawPositionMarks(
  context: DrawingContext,
  { project, area, zoom, pixelRatio, theme, tiles }: { project: DrawnProject; area: { left: number; right: number; top: number; bottom: number }; zoom: number; pixelRatio: number; theme: ProjectTheme; tiles: boolean },
): void {
  const canvas = canvasWeave(project)
  const pattern = positionMarkPattern(context, { ...canvas, deviceScale: zoom * pixelRatio, pixelRatio, ...markLookOf(theme, tiles) })
  if (!pattern) {
    return
  }
  context.fillStyle = pattern
  // The pattern is scaled to the tile's whole pixels, so it is smoothed here; the beads are blitted as they are.
  context.imageSmoothingEnabled = true
  const strip = stripIn(context, area)
  strip(area.left, area.top, area.right, area.bottom)
  context.imageSmoothingEnabled = false
}

/** Fills a rectangle cut to the view, in the fill in force; nothing where it is empty. */
function stripIn(context: DrawingContext, area: { left: number; right: number; top: number; bottom: number }) {
  return (left: number, top: number, right: number, bottom: number) => {
    const [x0, y0, x1, y1] = [Math.max(left, area.left), Math.max(top, area.top), Math.min(right, area.right), Math.min(bottom, area.bottom)]
    if (x1 > x0 && y1 > y0) {
      context.fillRect(x0, y0, x1 - x0, y1 - y0)
    }
  }
}

/** The Frame's box on the Canvas in grid px, half a gap past its outer beads: left, top, right, bottom. */
function frameGroundBox(project: DrawnProject, ref: FrameRef): readonly [number, number, number, number] {
  const footprint = frameFootprintPx(project, 0, ref)!
  const edge = BEAD_GAP_PX / 2
  return [footprint.x - edge, footprint.y - edge, footprint.x + footprint.width + edge, footprint.y + footprint.height + edge]
}

/** The box of the Frame's margin sheet in grid px: left, top, right, bottom. What the Frame's own surface covers
 * (ticket 1187). */
function sheetBoxOf(project: DrawnProject, ref: FrameRef, margin: number, slim?: SlimSheet): readonly [number, number, number, number] {
  const sheet = slim?.sheet ?? marginSheetPx(project, ref, margin)!.sheet
  return [sheet.x, sheet.y, sheet.x + sheet.width, sheet.y + sheet.height]
}

/** The margin sheets a layer's surface lays the reference image round (ticket 1219): a Frame's own, none on the Canvas's, which
 * has no Frame's px. */
function sheetBoxesOf(project: DrawnProject, layer: ViewLayer, margin: number, slim?: SlimSheet): (readonly [number, number, number, number])[] {
  return isFrameLayer(layer) && frameById(project, layer) ? [sheetBoxOf(project, layer, margin, slim)] : []
}

/** Far enough past any Canvas, in grid px, for the clip round the Frame's box to hold the whole picture. */
const HUGE_PX = 1e7

/** Draws the reference image cut to boxes, `inside` them or `outside` them, so the Canvas and each Frame lay it once. */
function drawReferenceCut(context: DrawingContext, reference: DrawnReference, boxes: readonly (readonly [number, number, number, number])[], where: 'inside' | 'outside'): void {
  if (boxes.length === 0) {
    if (where === 'outside') drawReference(context, reference)
    return
  }
  context.save()
  context.beginPath()
  if (where === 'outside') context.rect(-HUGE_PX, -HUGE_PX, 2 * HUGE_PX, 2 * HUGE_PX)
  for (const [left, top, right, bottom] of boxes) context.rect(left, top, right - left, bottom - top)
  context.clip('evenodd')
  drawReference(context, reference)
  context.restore()
}

/** The Frame's box on the Canvas (tickets 458, 0666), `box` from frameGroundBox: always covered in the Frame's own
 * Background (its gap under tonal tiles), so no Canvas mark shows between the Frame's (ticket 1262), then marked round
 * its positions in the Frame's look. Tonal tiles are the Frame's own, drawn with its beads (ticket 1001). */
function drawFrameGround(
  context: DrawingContext,
  { project, box, area, zoom, pixelRatio, frameLook, reference, tiles }: { project: DrawnProject; box: readonly [number, number, number, number]; area: { left: number; right: number; top: number; bottom: number }; zoom: number; pixelRatio: number; frameLook: ProjectTheme; reference?: DrawnReference; tiles: boolean },
  ref: FrameRef,
): void {
  const strip = stripIn(context, area)
  const mark = markLookOf(frameLook, tiles)
  context.fillStyle = mark.tiles ? gapColorOf(frameLook.canvas) : frameLook.canvas
  strip(...box)
  // The reference image lies over the Frame's own Background too (ticket 0790), cut to its box; over its tonal tiles
  // when it has them, so the Frame draws it after them (ticket 1008).
  if (reference && !mark.tiles) drawReferenceCut(context, reference, [box], 'inside')
  // A Custom frame's Off-shape and Seams hold no position, so its box has no marks (ticket 0592).
  const pattern = !mark.tiles && geometryDrawnAlone(project, ref).grid && positionMarkPattern(context, { ...canvasWeave(project), deviceScale: zoom * pixelRatio, pixelRatio, ...mark })
  if (pattern) {
    context.fillStyle = pattern
    context.imageSmoothingEnabled = true
    strip(...box)
    context.imageSmoothingEnabled = false
  }
  drawOffShape(context, { project, box, area, color: frameLook.offShape, skip: frameLook.offShape === frameLook.canvas }, ref)
}

/** The part of the Frame's box where it holds no bead position, in the Frame's Off-shape color, over its Background and
 * marks (ticket 1196): a Custom frame outside its shape, a staggered row's or column's empty half bead. The box with
 * every position's cell cut out of it, so whatever lays the positions out (a turned Frame, a Custom frame) decides. */
function drawOffShape(context: DrawingContext, { project, box, area, color, skip }: { project: DrawnProject; box: readonly [number, number, number, number]; area: { left: number; right: number; top: number; bottom: number }; color: string; skip: boolean }, ref: FrameRef): void {
  const frame = frameById(project, ref)
  if (skip || !frame) return
  const geometry = geometryDrawnAlone(project, ref)
  // Loom's cells fill its box: nothing is off the shape.
  if (geometry.grid && describeWeave(frameWeave(project, ref)).shift === 0) return
  const origin = { x: 0, y: 0 }
  const scale = frameScale(project, ref)
  const seen = { x: (area.left - origin.x) / scale / CELL_SIZE_PX, y: (area.top - origin.y) / scale / CELL_SIZE_PX, width: (area.right - area.left) / scale / CELL_SIZE_PX, height: (area.bottom - area.top) / scale / CELL_SIZE_PX }
  const at = (x: number, y: number) => [origin.x + x * scale, origin.y + y * scale] as const
  const [left, top, right, bottom] = box
  if (geometry.grid) {
    drawStaggerEnds(context, { geometry, frame, area, color, box, at, aspect: describeWeave(frameWeave(project, ref)).cellAspect, seen, staggers: describeWeave(frameWeave(project, ref)).staggers })
    return
  }
  context.save()
  context.beginPath()
  boxPath(context, left, top, right - left, bottom - top)
  for (const position of geometry.positionsIn(seen)) {
    const place = geometry.place(position)
    if (!place) continue
    const cell = inGridPx(place.box)
    const [centreX, centreY] = [cell.x + cell.width / 2, cell.y + cell.height / 2]
    const [cos, sin] = [Math.cos(place.angle), Math.sin(place.angle)]
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => {
      const [dx, dy] = [(sx! * cell.width) / 2, (sy! * cell.height) / 2]
      return at(centreX + dx * cos - dy * sin, centreY + dx * sin + dy * cos)
    })
    context.moveTo(...corners[0]!)
    for (const corner of corners.slice(1)) context.lineTo(...corner)
    context.closePath()
  }
  context.clip('evenodd')
  context.fillStyle = color
  const strip = stripIn(context, area)
  strip(...box)
  context.restore()
}

// The band of the surface, in device pixels, that a cut across the grid takes, in grid px: rows `top` to `bottom` or
// columns `left` to `right` (ticket 1038), across the whole Project the other way, or the viewport on the Canvas.
function bandOnSurface(
  space: Space,
  region: Region,
  zoom: number,
  rotation: Rotation,
  pixelRatio: number,
  cut: { top: number; bottom: number } | { left: number; right: number },
): Region {
  const area = regionInGridSpace(space.extent, region, zoom, rotation)
  const across = space.open ? area : { left: 0, right: space.extent.width, top: 0, bottom: space.extent.height }
  const { left, right, top, bottom } = { ...across, ...cut }
  const [a, b, c, d, e, f] = gridToRegion(space.extent, region, zoom, rotation)

  const corners = [
    [left, top],
    [right, top],
    [left, bottom],
    [right, bottom],
  ].map(([x, y]) => [(a * x! + c * y! + e) * pixelRatio, (b * x! + d * y! + f) * pixelRatio] as const)

  const first = Math.max(0, Math.floor(Math.min(...corners.map(([x]) => x))))
  const upper = Math.max(0, Math.floor(Math.min(...corners.map(([, y]) => y))))
  const last = Math.min(region.width * pixelRatio, Math.ceil(Math.max(...corners.map(([x]) => x))))
  const lower = Math.min(region.height * pixelRatio, Math.ceil(Math.max(...corners.map(([, y]) => y))))
  return { x: first, y: upper, width: Math.max(0, last - first), height: Math.max(0, lower - upper) }
}

/** A box of the Canvas's grid px as it lies on the surface, in its device px (ticket 1239). */
export function canvasBoxOnSurface({ project, space, region, zoom, pixelRatio = 1 }: Pick<RenderInput, 'project' | 'space' | 'region' | 'zoom' | 'pixelRatio'>, box: Region): Region {
  return onSurface([box.x, box.y, box.x + box.width, box.y + box.height], space.extent, region, zoom, quarterTurnOf(project), pixelRatio)
}

/** The rectangle of the surface, in its device px, that rows `first` to `last` of the Canvas take (ticket 1239): what a
 * change on the Canvas redraws, and every layer over it with it. */
export function canvasRowsOnSurface({ project, space, region, zoom, pixelRatio = 1 }: Pick<RenderInput, 'project' | 'space' | 'region' | 'zoom' | 'pixelRatio'>, rows: { first: number; last: number }): Region {
  return bandOnSurface(space, region, zoom, quarterTurnOf(project), pixelRatio, rowsCut(canvasWeave(project), rows))
}

/** The rows `first` to `last` across the grid, in grid px: down to the shift a staggered column hangs below the last
 * row (ticket 0777). */
function rowsCut(weave: Weave, rows: { first: number; last: number }): { top: number; bottom: number } {
  const band = gridBox(weave, { row: rows.first, column: 0, rows: rows.last - rows.first + 1, columns: 1 })
  return { top: band.y, bottom: band.y + band.height }
}

/** Adds a rectangle to the current path as lines, not `rect`, which a band's clip is told by. */
function boxPath(context: DrawingContext, x: number, y: number, width: number, height: number): void {
  context.moveTo(x, y)
  context.lineTo(x + width, y)
  context.lineTo(x + width, y + height)
  context.lineTo(x, y + height)
  context.closePath()
}

/** What drawing a layer's beads needs besides the context: how the whole draw was asked for. */
interface LayerDraw {
  project: DrawnProject
  region: Region
  zoom: number
  pixelRatio: number
  look: ProjectTheme
  drawBead: BeadDrawer
  rowMarks: boolean
  showFinished: boolean
  /** The viewport in grid px, as the base layer sees it. */
  area: { left: number; right: number; top: number; bottom: number }
  rows: { first: number; last: number } | undefined
  margin: number
  letters: Readonly<Record<string, string>> | undefined
  canvasLetters: Readonly<Record<string, string>> | undefined
  /** Whether the layers are drawn in the draft look, a pixel a bead. */
  draft: boolean
  /** Where a Frame bead at a Canvas row and column is in Row progress, its Row order worked out once for the draw
   * (ticket 0676). */
  passes: (row: number, column: number) => 'finished' | 'current' | undefined
  /** A current row's color, lifted once per color for the draw. */
  lit: (color: string) => string
  /** How opaque an empty Frame bead's fill is over the reference image (ticket 0790); undefined with none shown. */
  seeThrough: number | undefined
  /** Whether empty positions may be tonal tiles (ticket 1001): on the open Canvas in the full look, a reference image
   * shown or not (it lies over them, ticket 1008). Elsewhere they keep the outline and the empty bead. */
  tiles: boolean
  /** Sheets in grid px that hide the Canvas beads wholly under them (ticket 1239). */
  covered: readonly Region[]
}

/** The Frame's cells, bead or empty bead, where its Layer geometry places them, from the context's origin (ticket 492).
 * `origin` is where its first position sits in grid px. `space` is the Frame on its own: its positions counted from 0,
 * and `toAbsolute` the address of its first. */
function drawFrameLayer(context: DrawingContext, draw: LayerDraw, space: Space, origin: { x: number; y: number }, ref: FrameRef): void {
  const { project, area, rows: band } = draw
  const geometry = geometryDrawnAlone(project, ref)
  // The color at a position: the Frame's own beads, which a Custom frame names by round and place, beyond its rectangle.
  const framed = beadsOfLayer(project, ref)
  const seen = { x: (area.left - origin.x) / CELL_SIZE_PX, y: (area.top - origin.y) / CELL_SIZE_PX, width: (area.right - area.left) / CELL_SIZE_PX, height: (area.bottom - area.top) / CELL_SIZE_PX }
  // A band of rows is redrawn with the rows either side, into which a shifted column's beads hang; beads that keep no rows are all drawn.
  const inView = () => geometry.positionsIn(seen, band && { first: band.first - 1, last: band.last + 1 })
  const colorAtOwn = (row: number, column: number) => (framed ? colorAt(framed, row, column) : beadInSpace(project, space, row, column, ref))
  const colorOf = ({ row, column }: GridPosition) => colorAtOwn(row, column)
  const placed = () => inView().map((position) => ({ position, place: geometry.place(position)! }))
  if (geometry.grid && draw.draft) drawDraftFrame(context, draw, origin, geometry, inView, colorAtOwn, ref)
  else if (geometry.grid) drawUprightBeads(context, draw, origin, placed(), colorOf, ref)
  else drawTurnedBeads(context, draw, origin, placed(), colorOf, geometry, ref)
}

/** The Frame's beads in the draft look (ticket 0676): a pixel a bead in its Row progress color, empty ones as an empty
 * bead, no letters. A whole draw keeps the whole Frame's image, which a pan or zoom then lays down again. */
function drawDraftFrame(context: DrawingContext, draw: LayerDraw, origin: { x: number; y: number }, geometry: LayerGeometry, inView: () => GridPosition[], colorAtOwn: (row: number, column: number) => string | null, ref: FrameRef): void {
  const { project, look, rowMarks, showFinished, rows: band } = draw
  const weave = frameWeave(project, ref)
  // What progressLook says of a bead, with a color's fill mixed once for the draw, not once a bead: a whole Frame's
  // draft paints every bead (ticket 0677). `each` visits the positions to paint.
  // Over a reference image the empty beads are a second image laid at their opacity (ticket 0790): `only` picks them.
  const paintOf = (each: (visit: (row: number, column: number) => void) => void, only?: 'painted' | 'empty'): DraftPainter => (put) => {
    const { passes, lit } = draw
    const fills = { plain: new Map<string | null, string>(), dimmed: new Map<string | null, string>() }
    each((row, column) => {
      const painted = colorAtOwn(row, column)
      if ((only === 'painted' && painted === null) || (only === 'empty' && painted !== null)) return
      const pass = rowMarks ? passes(row, column) : undefined
      const shown = painted !== null && pass === 'current' ? lit(painted) : painted
      const dimmed = !showFinished && pass === 'finished'
      const known = dimmed ? fills.dimmed : fills.plain
      let fill = known.get(shown)
      if (fill === undefined) {
        fill = beadFill(shown, dimmed, look)
        known.set(shown, fill)
      }
      put(row, column, fill)
    })
  }
  const listed = (positions: readonly GridPosition[]) => (visit: (row: number, column: number) => void) => {
    for (const { row, column } of positions) visit(row, column)
  }
  const parts: readonly ('painted' | 'empty' | undefined)[] = draw.seeThrough === undefined ? [undefined] : ['painted', 'empty']
  for (const only of parts) {
    const alpha = context.globalAlpha
    if (only === 'empty') context.globalAlpha = alpha * draw.seeThrough!
    drawDraftFramePart(only)
    context.globalAlpha = alpha
  }

  function drawDraftFramePart(only: 'painted' | 'empty' | undefined): void {
    const kept: KeptLayer = only === 'empty' ? `frameEmpty:${ref}` : `frame:${ref}`
    const from = [beadsOfLayer(project, ref), frameDraftKey(project, ref), look, rowMarks, showFinished, only]
    const whole = !band && keptLayerDraft(kept, from, () => {
      // A Frame without a shape holds every position of its rectangle: painted row by row, with no position listed.
      const frame = frameById(project, ref)
      if (!frame?.shape) {
        const { rows, columns } = frame ?? projectDimensions(project)
        const block = { row: 0, column: 0, rows, columns }
        return keptDraft(weave, block, paintOf((visit) => {
          for (let row = 0; row < rows; row += 1) for (let column = 0; column < columns; column += 1) visit(row, column)
        }, only))
      }
      const extent = geometry.extent()
      const all = extent ? geometry.positionsIn(extent) : []
      const block = blockAround(all)
      return block && keptDraft(weave, block, paintOf(listed(all), only))
    })
    if (whole) {
      layDraft(context, whole, origin)
      return
    }
    const positions = inView()
    const block = blockAround(positions)
    if (block) drawDraftBlock(context, weave, block, paintOf(listed(positions), only), origin)
  }
}

/** Each layer's last whole draft image and what it was drawn from (ticket 0676), each Frame's its own (ticket 1219):
 * while only the view moves, or another layer is painted, it is laid down again instead of every bead being read.
 * Undefined for one too big to keep. The most recently drawn first out of `KEPT_DRAFTS`. */
const keptDrafts = new Map<KeptLayer, { from: readonly unknown[]; draft: DraftImageOf | undefined }>()

/** How many draft images are kept: the Canvas's, and each Frame's with its empty beads apart. */
const KEPT_DRAFTS = 1 + MAX_FRAMES * 2

/** What a kept draft image is of: the Canvas, a Frame, or a Frame's empty beads laid over a reference image (ticket
 * 0790), by the Frame's id. */
type KeptLayer = 'canvas' | `frame:${string}` | `frameEmpty:${string}`

/** The layer's kept draft image when it was drawn from the same `from`, else the one `make` paints, kept in its place. */
function keptLayerDraft(layer: KeptLayer, from: readonly unknown[], make: () => DraftImageOf | undefined): DraftImageOf | undefined {
  const last = keptDrafts.get(layer)
  if (last && last.from.length === from.length && last.from.every((value, at) => value === from[at])) return last.draft
  const draft = make()
  keptDrafts.delete(layer)
  keptDrafts.set(layer, { from, draft })
  if (keptDrafts.size > KEPT_DRAFTS) keptDrafts.delete(keptDrafts.keys().next().value!)
  return draft
}

/** What a Frame's draft is drawn from besides its beads, as one value (ticket 1219): its layer record less its beads and
 * where it lies, which its drawing does not hold. Painting another layer, or moving the Frame, leaves it as it was. */
function frameDraftKey(project: DrawnProject, ref: FrameRef): string {
  const { beads: _beads, centre: _centre, ...sheet } = frameById(project, ref) ?? {}
  return JSON.stringify(sheet)
}

/** A bead of a Layer and where its geometry places it, in bead widths. */
interface PlacedBead {
  position: GridPosition
  place: BeadPlace
}

/** Beads standing upright in rows and columns, each in its box: the current row's lit (ticket 352), an empty cell left
 * as it is (ticket 411). */
function drawUprightBeads(context: DrawingContext, draw: LayerDraw, origin: { x: number; y: number }, beads: readonly PlacedBead[], colorOf: (position: GridPosition) => string | null, ref: FrameRef): void {
  const { project, zoom, pixelRatio, look, drawBead, letters } = draw
  const weave = frameWeave(project, ref)
  const cornerRadius = beadRoundness(weave.technique, weave.cell) * CELL_SIZE_PX
  // An empty position is a tonal tile where they are drawn (ticket 1001).
  const mark = markLookOf(look, draw.tiles)
  const edge = tileEdgeColorOf(look.canvas)
  for (const { position: own, place } of beads) {
    const box = inGridPx(place.box)
    const painted = colorOf(own)
    const { shown, dimmed } = progressLook(draw, own, painted)
    const sized = box.width !== CELL_SIZE_PX || box.height !== CELL_SIZE_PX ? { width: box.width, height: box.height } : {}
    const bead = { x: origin.x + box.x, y: origin.y + box.y, size: CELL_SIZE_PX, ...sized, cornerRadius, color: shown, dimmed, deviceScale: zoom * pixelRatio, theme: look }
    if (painted === null && mark.tiles) drawTile(context, { x: bead.x, y: bead.y, width: box.width, height: box.height, cornerRadius }, mark.color, edge, bead.deviceScale)
    else if (painted === null && draw.seeThrough !== undefined) drawSeeThroughBead(context, bead, draw.seeThrough)
    else drawBead(context, bead)
    const letter = painted === null ? undefined : letters?.[painted]
    if (painted !== null && letter) {
      drawBeadLetter(context, { x: origin.x + box.x, y: origin.y + box.y, size: CELL_SIZE_PX, ...sized, color: painted, letter, dimmed, theme: look })
    }
  }
}

/** Beads that lie at their panels' angles (ADR 0077, ticket 0592): each at its centre, turned, and the Layer's Seams as
 * thin lines; round the shape the Canvas's colour, no position marks. Finished rounds fade and the current one is lit as
 * a Frame's rows are (ticket 0594). */
function drawTurnedBeads(context: DrawingContext, draw: LayerDraw, origin: { x: number; y: number }, beads: readonly PlacedBead[], colorOf: (position: GridPosition) => string | null, geometry: LayerGeometry, ref: FrameRef): void {
  const { project, zoom, pixelRatio, look, drawBead, letters } = draw
  const weave = frameWeave(project, ref)
  const mark = markLookOf(look, draw.tiles)
  const edge = tileEdgeColorOf(look.canvas)
  context.save()
  context.translate(origin.x, origin.y)
  // The beads are turned, so their bitmaps are smoothed as they are laid down.
  context.imageSmoothingEnabled = true
  // Beads at one angle (all of a turned grid's) are drawn under one rotation about the origin, each moved to where that
  // rotation puts it on its place: a save, a translate and a rotate for every bead cost most of a redraw (ticket 1239).
  // A layout of many angles keeps its bead by bead turn, its order as it was.
  const angles = new Set(beads.map(({ place }) => place.angle))
  const together = angles.size <= 4
  const drawOne = ({ position, place }: PlacedBead, at: { x: number; y: number }): void => {
    const box = inGridPx(place.box)
    const centred = { x: at.x - box.width / 2, y: at.y - box.height / 2, width: box.width, height: box.height }
    const cornerRadius = beadRoundness(weave.technique, weave.cell) * box.width
    const painted = colorOf(position)
    const { shown, dimmed } = progressLook(draw, position, painted)
    const bead = { ...centred, size: box.width, cornerRadius, color: shown, dimmed, deviceScale: zoom * pixelRatio, theme: look }
    if (painted === null && mark.tiles) drawTile(context, { ...centred, cornerRadius }, mark.color, edge, bead.deviceScale)
    else if (painted === null && draw.seeThrough !== undefined) drawSeeThroughBead(context, bead, draw.seeThrough)
    else drawBead(context, bead)
    const letter = painted === null ? undefined : letters?.[painted]
    if (painted !== null && letter) {
      drawBeadLetter(context, { ...centred, size: box.width, color: painted, letter, dimmed, theme: look })
    }
  }
  const centreOf = ({ place }: PlacedBead) => {
    const box = inGridPx(place.box)
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  }
  if (together) {
    for (const angle of angles) {
      context.save()
      context.rotate(angle)
      const [cos, sin] = [Math.cos(angle), Math.sin(angle)]
      for (const bead of beads) {
        if (bead.place.angle !== angle) continue
        const { x, y } = centreOf(bead)
        // The rotation's inverse takes the bead's place to where the turned drawing puts it there.
        drawOne(bead, { x: x * cos + y * sin, y: -x * sin + y * cos })
      }
      context.restore()
    }
  } else {
    for (const bead of beads) {
      const { x, y } = centreOf(bead)
      context.save()
      context.translate(x, y)
      context.rotate(bead.place.angle)
      drawOne(bead, { x: 0, y: 0 })
      context.restore()
    }
  }
  context.imageSmoothingEnabled = false
  context.beginPath()
  for (const [from, to] of geometry.seams()) {
    context.moveTo(from.x * CELL_SIZE_PX, from.y * CELL_SIZE_PX)
    context.lineTo(to.x * CELL_SIZE_PX, to.y * CELL_SIZE_PX)
  }
  // Off-shape's own color on screen; an export has none and keeps its line (ticket 1196).
  context.strokeStyle = look.offShape === look.canvas ? look.pieceLine : look.offShape
  context.lineWidth = SEAM_WIDTH_PX
  context.stroke()
  context.restore()
}

/** A staggered grid's Off-shape: the half bead at each end of a row (brick stitch) or column (peyote), one strip a line, so
 * a big Frame costs its lines and not its positions (ticket 1196). */
function drawStaggerEnds(
  context: DrawingContext,
  { geometry, frame, area, color, box, at, aspect, seen, staggers }: { geometry: LayerGeometry; frame: { rows: number; columns: number }; area: { left: number; right: number; top: number; bottom: number }; color: string; box: readonly [number, number, number, number]; at: (x: number, y: number) => readonly [number, number]; aspect: number; seen: { x: number; y: number; width: number; height: number }; staggers: 'rows' | 'columns' },
): void {
  const strip = stripIn(context, area)
  const [left, top, right, bottom] = box
  const cell = (position: GridPosition) => {
    const own = inGridPx(geometry.place(position)!.box)
    const [x0, y0] = at(own.x, own.y)
    const [x1, y1] = at(own.x + own.width, own.y + own.height)
    return { left: x0, top: y0, right: x1, bottom: y1 }
  }
  context.fillStyle = color
  if (staggers === 'rows') {
    const [from, to] = [Math.max(0, Math.floor(seen.y / aspect) - 1), Math.min(frame.rows - 1, Math.ceil((seen.y + seen.height) / aspect) + 1)]
    for (let row = from; row <= to; row += 1) {
      const [first, last] = [cell({ row, column: 0 }), cell({ row, column: frame.columns - 1 })]
      strip(left, first.top, first.left, first.bottom)
      strip(last.right, last.top, right, last.bottom)
    }
  } else {
    const [from, to] = [Math.max(0, Math.floor(seen.x) - 1), Math.min(frame.columns - 1, Math.ceil(seen.x + seen.width) + 1)]
    for (let column = from; column <= to; column += 1) {
      const [first, last] = [cell({ row: 0, column }), cell({ row: frame.rows - 1, column })]
      strip(first.left, top, first.right, first.top)
      strip(last.left, last.bottom, last.right, bottom)
    }
  }
}

/** How Row progress shows a Frame bead (tickets 352, 434): its color lit in the current row, faded in a finished one
 * unless finished rows are shown. */
function progressLook({ rowMarks, showFinished, passes, lit }: LayerDraw, own: GridPosition, painted: string | null): { shown: string | null; dimmed: boolean } {
  if (!rowMarks) return { shown: painted, dimmed: false }
  const pass = passes(own.row, own.column)
  return { shown: painted !== null && pass === 'current' ? lit(painted) : painted, dimmed: !showFinished && pass === 'finished' }
}

/** A Seam's width in grid px: a hairline at 100%. */
const SEAM_WIDTH_PX = 1

/** The Canvas's beads, bead by bead or as one draft image. What every bead shares (its Weave's description, cell, corners, the margins) is worked out once
 * (ticket 0676). */
function drawCanvasLayer(context: DrawingContext, draw: LayerDraw, space: Space): void {
  const { project, region, zoom, pixelRatio, look, drawBead, rows: band, canvasLetters } = draw
  const rotation = quarterTurnOf(project)
  const beads = beadsOfLayer(project, 'canvas')
  const weave = canvasWeave(project)
  const description = describeWeave(weave)
  const cell = cellSizePx(weave.technique, weave.cell)
  const sized = cell.width !== CELL_SIZE_PX || cell.height !== CELL_SIZE_PX ? { width: cell.width, height: cell.height } : {}
  const cornerRadius = beadRoundness(weave.technique, weave.cell) * CELL_SIZE_PX
  const visible = visibleBeadsInSpace(weave, space, region, zoom, rotation)
  const firstRow = band ? Math.max(visible.firstRow, band.first - 1) : visible.firstRow
  const lastRow = band ? Math.min(visible.lastRow, band.last + 1) : visible.lastRow

  // Only the stored rows in view, and only their stored columns: the cost follows the beads, not the canvas.
  const rowsInView = Object.keys(beads).map(Number).filter((row) => row >= firstRow && row <= lastRow).sort((a, b) => a - b)
  // The beads of a row in view; a row's beads never overlap, so in any order.
  const eachInView = (row: number, first: number, last: number, take: (column: number, color: string) => void) => {
    const stored = beads[row]!
    for (const key in stored) {
      const column = Number(key)
      if (column < first || column > last) continue
      take(column, stored[column]!)
    }
  }
  if (draw.draft && rowsInView.length > 0) {
    // A whole draw keeps the whole layer's image, which a pan or zoom then lays down again.
    const whole = !band && keptLayerDraft('canvas', [beads, JSON.stringify(weave)], () => {
      const bounds = beadBounds(beads)
      return bounds && keptDraft(weave, bounds, (put) => {
        for (const key in beads) eachInView(Number(key), -Infinity, Infinity, (column, color) => put(Number(key), column, color))
      })
    })
    const block = whole ? undefined : draftBlock(beads, visible, rowsInView)
    if (whole) layDraft(context, whole)
    else if (block) {
      drawDraftBlock(context, weave, block, (put) => {
        for (const row of rowsInView) eachInView(row, block.column, block.column + block.columns - 1, (column, color) => put(row, column, color))
      })
    }
  } else if (!draw.draft) {
    const deviceScale = zoom * pixelRatio
    for (const row of rowsInView) {
      const { first, last } = visible.columnsOf(row)
      eachInView(row, first, last, (column, color) => {
        const { x, y } = description.box({ row, column }, cell.width, cell.height)
        // Under a Frame's opaque sheet nothing of it shows: not drawn (spec 1234, Drawing).
        if (draw.covered.some((sheet) => x >= sheet.x && y >= sheet.y && x + cell.width <= sheet.x + sheet.width && y + cell.height <= sheet.y + sheet.height)) return
        drawBead(context, { x, y, size: CELL_SIZE_PX, ...sized, cornerRadius, color, dimmed: false, deviceScale, theme: look })
        const letter = canvasLetters?.[color]
        if (letter) drawBeadLetter(context, { x, y, size: CELL_SIZE_PX, ...sized, color, letter, dimmed: false, theme: look })
      })
    }
  }
}

/** The rectangle of Canvas positions a draft image of the rows in view holds: the columns in view on any of them, cut
 * to the box round the stored beads. Undefined where none is in view. */
function draftBlock(beads: BeadMap, visible: VisiblePositions, rowsInView: readonly number[]): Rect | undefined {
  const bounds = beadBounds(beads)
  if (!bounds || rowsInView.length === 0) return undefined
  let [first, last] = [Infinity, -Infinity]
  for (const row of rowsInView) {
    const columns = visible.columnsOf(row)
    first = Math.min(first, columns.first)
    last = Math.max(last, columns.last)
  }
  first = Math.max(first, bounds.column)
  last = Math.min(last, bounds.column + bounds.columns - 1)
  const top = rowsInView[0]!
  return last < first ? undefined : { row: top, column: first, rows: rowsInView.at(-1)! - top + 1, columns: last - first + 1 }
}

/** The margin's sheet in grid px (MarginSheet card, tickets 0656, 0657): its box, the Frame's footprint it holds, and
 * its band, the narrowest of its four sides. What the sheet is drawn from and what its tools on the page are placed by. */
export function marginSheetPx(project: DrawnProject, ref: FrameRef, margin = MARGIN): { sheet: Region; footprint: Region; band: number } | undefined {
  const sheet = frameFootprintPx(project, margin, ref)
  const footprint = frameFootprintPx(project, 0, ref)
  if (!sheet || !footprint) return undefined
  const narrowest = Math.min(footprint.x - sheet.x, footprint.y - sheet.y, sheet.x + sheet.width - footprint.x - footprint.width, sheet.y + sheet.height - footprint.y - footprint.height)
  // Float noise of a turned Frame's extent (80 as 79.99999999999994) must not tip the sheet into a smaller form.
  return { sheet, footprint, band: Math.round(narrowest * 1e6) / 1e6 }
}

/** The expanded Frame's slim sheet as drawn (ticket 1169): its box in grid px and its outer corners in screen px. */
export interface SlimSheet {
  sheet: Region
  radius: number
}

/** The keep-out margin as drafting paper (MarginSheet card, ticket 0656): its band in the margin color, the Frame's
 * footprint left out, a hairline edge and an inner border; folded, no border; none bare, which keeps only the Move bar and
 * the Frame tools button (tickets 0682, 1164). In grid space: its `MARGIN_PX` at the sheet's scale (ticket 0698), over the zoom. */
function drawMarginSheet(context: DrawingContext, project: DrawnProject, ref: FrameRef, margin: number, zoom: number, look: MarginLook, slim?: SlimSheet): void {
  const kept = marginSheetPx(project, ref, margin)!
  const { footprint } = kept
  const sheet = slim?.sheet ?? kept.sheet
  const gridBand = slim ? Math.min(footprint.x - sheet.x, footprint.y - sheet.y, sheet.x + sheet.width - footprint.x - footprint.width, sheet.y + sheet.height - footprint.y - footprint.height) : kept.band
  const band = gridBand * zoom
  // Expanded, the sheet is full at scale 1 at every zoom, with no inner border.
  const form = slim ? 'slim' : marginForm(band, look.leastScale)
  if (form === 'bare') return
  const px = slim ? 1 / zoom : marginScale(band, look.leastScale) / zoom
  const drawn = form === 'full' ? 'full' : 'compact'
  const edge = BEAD_GAP_PX / 2
  const radius = Math.min(slim ? slim.radius / zoom : MARGIN_PX.sheetRadius[drawn] * px, gridBand)
  context.save()
  context.beginPath()
  context.roundRect(sheet.x, sheet.y, sheet.width, sheet.height, radius)
  boxPath(context, footprint.x - edge, footprint.y - edge, footprint.width + 2 * edge, footprint.height + 2 * edge)
  context.fillStyle = look.fill
  context.fill('evenodd')
  const half = look.edgeWidth / zoom / 2
  context.setLineDash([])
  context.lineWidth = look.edgeWidth / zoom
  context.strokeStyle = look.edge
  context.beginPath()
  context.roundRect(sheet.x + half, sheet.y + half, sheet.width - 2 * half, sheet.height - 2 * half, Math.max(0, radius - half))
  context.stroke()
  if (form === 'full' || form === 'compact') {
    const at = MARGIN_PX.place[form].border * px
    context.lineWidth = 1 / zoom
    context.strokeStyle = look.line
    context.beginPath()
    context.roundRect(sheet.x + at, sheet.y + at, sheet.width - 2 * at, sheet.height - 2 * at, MARGIN_PX.borderRadius * px)
    context.stroke()
  }
  context.restore()
}

const canvasLooks = new WeakMap<ProjectTheme, ProjectTheme>()

/** A theme as the Canvas draws in it: a finished row fades toward the drawing area, not a board. One object per theme,
 * so the colors kept per theme last from draw to draw. */
export function canvasLook(theme: ProjectTheme): ProjectTheme {
  let look = canvasLooks.get(theme)
  if (!look) {
    look = { ...theme, background: theme.canvas }
    canvasLooks.set(theme, look)
  }
  return look
}

// Draws the part of the Project in the region, clearing it first. Differs by space only in the background (Frame-only
// fills it, the Canvas stays transparent and fades finished rows) and in what is drawn: the Canvas's beads with the
// Frame laid over them in its own Weave, or the Frame alone.
export function renderProject(context: DrawingContext, input: RenderInput): void {
  // The Frame drawn: the one this surface is, else the Project's first (ticket 1216).
  const ref: FrameRef = isFrameLayer(input.layer) ? input.layer : firstFrameId(input.project)
  const { project, space, region, zoom, pixelRatio = 1, theme = DEFAULT_THEME, drawBead = drawFlatBead, rows, columns, showFinished = false, rowMarks = rowProgressOn(input.project, ref), margin = MARGIN, letters, canvasLetters, draftWhenSmall = false, opaque = false, positionMarks = true, reference, layer } = input
  const frameTheme = input.frameTheme ?? theme
  const frame = frameById(project, ref)
  const rotation = quarterTurnOf(project)
  const { extent } = space
  // A finished row fades toward what is behind it, which on the Canvas is the drawing area, not a board.
  const look = space.open ? canvasLook(theme) : theme
  const frameLook = space.open ? canvasLook(frameTheme) : frameTheme
  // A band of rows or columns is the Canvas's, or a Frame drawn alone's: a Frame on the open Canvas draws all again.
  const banded = !space.open || !isFrameLayer(layer)
  const bandWeave = space.open ? canvasWeave(project) : frameWeave(project, ref)
  const draft = draftWhenSmall && drawsDraft(zoom * pixelRatio)
  const band = banded ? rows : undefined
  const strip = banded && !band && columns ? columnStrip(bandWeave, columns) : undefined

  // The backing store is in device px: clear (and paint the background, in Frame-only space) there, the whole surface
  // or just the band being drawn again, which the rest of the drawing is then cut to, then draw in CSS px scaled up to
  // it.
  context.setTransform(1, 0, 0, 1, 0, 0)
  const cut = band
    ? bandOnSurface(space, region, zoom, rotation, pixelRatio, rowsCut(bandWeave, band))
    : strip
      ? bandOnSurface(space, region, zoom, rotation, pixelRatio, strip.cut)
      : undefined
  // A Frame's own surface holds every Frame (ticket 1219): a band of one, or one drawn alone, is cut to its sheet, so
  // the others stay as they were drawn.
  const sheetCut = isFrameLayer(layer) && space.open && frame ? onSurface(sheetBoxOf(project, ref, margin, input.slimSheet), extent, region, zoom, rotation, pixelRatio) : undefined
  const wanted = input.alone ? (sheetCut ?? NOTHING) : cut ? (sheetCut ? overlapOf(cut, sheetCut) : cut) : { x: 0, y: 0, width: region.width * pixelRatio, height: region.height * pixelRatio }
  const cleared = input.within ? overlapOf(wanted, input.within) : wanted
  const clipped = band || strip || input.within
  if (clipped) {
    context.save()
    context.beginPath()
    context.rect(cleared.x, cleared.y, cleared.width, cleared.height)
    context.clip()
  }
  context.clearRect(cleared.x, cleared.y, cleared.width, cleared.height)
  // The Frame's own surface is clear round its sheet: the Canvas's shows through (ticket 1187).
  if (!space.open || (opaque && !isFrameLayer(layer))) {
    context.fillStyle = space.open ? theme.canvas : frameTheme.background
    context.fillRect(cleared.x, cleared.y, cleared.width, cleared.height)
  }

  setGridTransform(context, extent, region, zoom, rotation, pixelRatio)
  // Bitmaps of beads are made at the size they are on the screen, so they are blitted as they are, not resampled.
  context.imageSmoothingEnabled = false

  const inView = regionInGridSpace(extent, region, zoom, rotation)
  // A strip's beads are those drawn into it: the rest of the view, cut away, is left out.
  const area = strip ? { ...inView, left: Math.max(inView.left, strip.drawn.left), right: Math.min(inView.right, strip.drawn.right) } : inView
  const lifted = new Map<string, string>()
  const lit = (color: string) => {
    let shown = lifted.get(color)
    if (shown === undefined) {
      shown = brighten(color, CURRENT_ROW_BRIGHTNESS)
      lifted.set(color, shown)
    }
    return shown
  }
  const drawn = space.open ? reference : undefined
  const under = drawn?.over ? undefined : drawn
  const seeThrough = drawn && EMPTY_BEAD_OPACITY[drawn.opacity]
  const tiles = space.open && !draft
  const draw: LayerDraw = { project, region, zoom, pixelRatio, look, drawBead, rowMarks, showFinished, area, rows: band, margin, letters, canvasLetters, draft, passes: rowPassesOf(project, ref), lit, seeThrough, tiles, covered: input.covered ?? [] }

  if (space.open) {
    // The reference image over the Canvas's Background and under every bead (ticket 0790): over its tonal tiles, so
    // showing it leaves the grid as it is (ticket 1008), under the outlines drawn instead. The Frame lays its own.
    const overTiles = positionMarks && markLookOf(theme, tiles).tiles
    const frameBox = frame ? frameGroundBox(project, ref) : undefined
    // The Canvas's own part: what its surface draws (ticket 1187), the Frame's laid over it on its own.
    if (!isFrameLayer(layer)) {
      if (under && !overTiles) drawReferenceCut(context, under, [], 'outside')
      if (positionMarks && tiles && theme.tonalTiles) {
        // The calm gap between tonal tiles, laid flat under them over the whole surface (ticket 1001).
        context.fillStyle = gapColorOf(theme.canvas)
        context.fillRect(area.left, area.top, area.right - area.left, area.bottom - area.top)
      }
      if (positionMarks) drawPositionMarks(context, { project, area, zoom, pixelRatio, theme, tiles })
      if (under && overTiles) drawReferenceCut(context, under, [], 'outside')
      drawCanvasLayer(context, draw, space)
    }
    if (frame && frameBox && layer !== 'canvas') {
      drawMarginSheet(context, project, ref, margin, zoom, theme.margin, input.slimSheet)
      drawFrameGround(context, { project, box: frameBox, area, zoom, pixelRatio, frameLook: frameTheme, reference: under, tiles }, ref)
      const origin = { x: 0, y: 0 }
      const sheet = spaceOf(project, false, ref)
      // The Frame is drawn in its own px, its Bead's size over the Canvas's (ticket 0665), from its first position's
      // corner.
      const scale = frameScale(project, ref)
      const frameDraw = (part: LayerDraw) => {
        if (scale === 1) {
          drawFrameLayer(context, part, sheet, origin, ref)
          return
        }
        const seen = { left: area.left / scale, right: area.right / scale, top: area.top / scale, bottom: area.bottom / scale }
        context.save()
        context.scale(scale, scale)
        drawFrameLayer(context, { ...part, zoom: zoom * scale, area: seen, rows: undefined }, sheet, origin, ref)
        context.restore()
      }
      const frameDrawn: LayerDraw = { ...draw, look: frameLook }
      if (under && markLookOf(frameLook, tiles).tiles) {
        // Its tonal tiles, the reference image over them, then its painted beads (ticket 1008).
        frameDraw({ ...frameDrawn, drawBead: () => {}, letters: undefined })
        drawReferenceCut(context, under, [frameBox], 'inside')
        frameDraw({ ...frameDrawn, drawBead: paintedOnly(draw.drawBead), tiles: false, seeThrough: undefined })
      } else {
        frameDraw(frameDrawn)
      }
    }
  } else if (space.hasFrame) {
    drawFrameLayer(context, { ...draw, look: frameLook }, space, { x: 0, y: 0 }, ref)
  }
  // Laid over the beads it is drawn last, over the Frame too, the beads under it looking as they do under it (ticket 1009).
  // Drawn one layer at a time, each lays it on its own part: the Frame on its sheet's box, the Canvas round it.
  if (drawn?.over) drawReferenceCut(context, drawn, layer ? sheetBoxesOf(project, layer, margin, input.slimSheet) : [], isFrameLayer(layer) ? 'inside' : 'outside')

  if (clipped) {
    context.restore()
  }
}

/** An empty box. */
const NOTHING: Region = { x: 0, y: 0, width: 0, height: 0 }

/** Where two boxes overlap; empty where they don't. */
function overlapOf(a: Region, b: Region): Region {
  const [left, top] = [Math.max(a.x, b.x), Math.max(a.y, b.y)]
  const [right, bottom] = [Math.min(a.x + a.width, b.x + b.width), Math.min(a.y + a.height, b.y + b.height)]
  return right > left && bottom > top ? { x: left, y: top, width: right - left, height: bottom - top } : NOTHING
}

/** A box in grid px as it lies on the surface, in its device px: whole pixels round it and one more each side, so a
 * clear of it takes its anti-aliased edge too. */
function onSurface([left, top, right, bottom]: readonly [number, number, number, number], extent: Extent, region: Region, zoom: number, rotation: Rotation, pixelRatio: number): Region {
  const [a, b, c, d, e, f] = gridToRegion(extent, region, zoom, rotation)
  const corners = [[left, top], [right, bottom]].map(([x, y]) => [(a * x! + c * y! + e) * pixelRatio, (b * x! + d * y! + f) * pixelRatio] as const)
  const [x0, x1] = [Math.floor(Math.min(corners[0]![0], corners[1]![0])) - 1, Math.ceil(Math.max(corners[0]![0], corners[1]![0])) + 1]
  const [y0, y1] = [Math.floor(Math.min(corners[0]![1], corners[1]![1])) - 1, Math.ceil(Math.max(corners[0]![1], corners[1]![1])) + 1]
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }
}
