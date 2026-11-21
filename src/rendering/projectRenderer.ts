import type { GridPosition, Rotation } from '../domain/grid'
import { beadRoundness, describeWeave, type Weave } from '../domain/weave'
import type { VisiblePositions } from '../domain/weaveGeometry'
import { beadBounds, colorAt, frameContains, type BeadMap, type Rect } from '../domain/canvas'
import { footprintOf } from '../domain/footprint'
import { frameLifted } from '../domain/frame'
import type { BeadPlace, LayerGeometry } from '../domain/layerGeometry'
import { MARGIN, withMargin } from '../domain/margin'
import { laidFrame } from '../domain/frameOrientation'
import { canvasWeave, frameScale, frameWeave, layersAlike } from '../domain/layerWeave'
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
  emptyOnly,
  isOpenWeave,
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
import { drawTile, gapColorOf, markLookOf } from './tonalTiles'
import { CELL_SIZE_PX, cellSizePx } from './cellSize'
import { columnStrip } from './columnBand'
import { drawLiftedFrame, LIFT_REACH_PX, liftedFrameOf, type LiftedFrame } from './liftedFrame'
import {
  frameOriginPx,
  gridBox,
  gridToRegion,
  inGridPx,
  layerExtentPx,
  regionInGridSpace,
  setGridTransform,
  type Region,
  type ViewLayer,
} from './surfaceView'
import { beadsOfLayer, frameOf, type Layered, quarterTurnOf } from '../domain/layerRecord'
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
  // Whether Row progress is drawn: finished rows faded, the current one brighter. Defaults to `rowProgressOn(project)`;
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
  /** Draw the Frame lifted (ticket 1177, BeadBoard card, Lifted Frame) whatever Row progress shows: an export, which
   * follows the Frame's saved Lift alone. Absent, the editor's rule: lifted while the Frame's Lift and Row highlight
   * are on and the look has it. */
  lift?: boolean
  /** The color the lifted Frame's plate lies on where the theme's own Background is clear, as on the Cover page's board. */
  liftBackground?: string
  /** Draw one layer of the open Canvas alone (ticket 1187), for the editor's two stacked surfaces: the Canvas's part
   * (its Background, marks and beads, the Frame left out), or the Frame's (its margin sheet, ground and beads, clear
   * round them). Absent, both, as an export draws them. */
  layer?: ViewLayer
}

/** The box on the Canvas the Frame hides (ticket 492), in grid px: the rectangle of Canvas positions it claims, grown to
 * take in its drawn extent where it is woven otherwise or in a Bead of another size (ticket 0665) and so draws larger
 * or smaller than that. */
function frameFootprintPx(project: DrawnProject, margin = 0): Region | undefined {
  const frame = frameOf(project)
  const covered = footprintOf(project)
  // A Frame off the Canvas's grid hides no part of it (ticket 1188): its own surface lies over it.
  if (!frame || !covered) {
    return undefined
  }
  const canvas = canvasWeave(project)
  // With a `margin` the box also takes in the keep-out margin (ticket 501), which the Canvas draws nothing in.
  const grown = withMargin(covered, margin)
  const own = gridBox(canvas, grown)
  if (layersAlike(project)) {
    return own
  }
  const origin = frameOriginPx(canvas, frame)
  const laid = laidFrame(project)!
  const scale = frameScale(project)
  const extent = layerExtentPx(frameWeave(project), laid.columns, laid.rows)
  const drawn = { width: extent.width * scale, height: extent.height * scale }
  const left = Math.min(own.x, origin.x)
  const top = Math.min(own.y, origin.y)
  return { x: left, y: top, width: Math.max(own.x + own.width, origin.x + drawn.width) - left, height: Math.max(own.y + own.height, origin.y + drawn.height) - top }
}

// The Canvas's Position marks (CONTEXT.md): one pattern fill in up to four strips round the margin's box, so no
// position is tested. The Frame's box has its own (drawFrameGround).
function drawPositionMarks(
  context: DrawingContext,
  { project, area, zoom, pixelRatio, theme, margin, tiles }: { project: DrawnProject; space: Space; margin: number; area: { left: number; right: number; top: number; bottom: number }; zoom: number; pixelRatio: number; theme: ProjectTheme; tiles: boolean },
): void {
  const canvas = canvasWeave(project)
  const pattern = positionMarkPattern(context, { ...canvas, deviceScale: zoom * pixelRatio, pixelRatio, ...markLookOf(theme, tiles) })
  if (!pattern) {
    return
  }
  const cell = cellSizePx(canvas.technique, canvas.cell)
  const covered = footprintOf(project)
  const box = covered && withMargin(covered, margin)
  // The margin's box, between the marks just inside and just outside it; a Frame woven otherwise holds what it draws.
  const held = frameFootprintPx(project, margin)
  const alike = layersAlike(project)
  const cut = box && held && (alike ? describeWeave(canvas).boundary(box, cell.width, cell.height) : held)
  const hole = cut && { left: cut.x, right: cut.x + cut.width, top: cut.y, bottom: cut.y + cut.height }
  context.fillStyle = pattern
  // The pattern is scaled to the tile's whole pixels, so it is smoothed here; the beads are blitted as they are.
  context.imageSmoothingEnabled = true
  const strip = stripIn(context, area)
  if (!hole) {
    strip(area.left, area.top, area.right, area.bottom)
  } else {
    strip(area.left, area.top, area.right, Math.min(hole.top, area.bottom))
    strip(area.left, Math.max(hole.bottom, area.top), area.right, area.bottom)
    const top = Math.max(hole.top, area.top)
    const bottom = Math.min(hole.bottom, area.bottom)
    strip(area.left, top, Math.min(hole.left, area.right), bottom)
    strip(Math.max(hole.right, area.left), top, area.right, bottom)
  }
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
function frameGroundBox(project: DrawnProject): readonly [number, number, number, number] {
  const footprint = frameFootprintPx(project)!
  const edge = BEAD_GAP_PX / 2
  return [footprint.x - edge, footprint.y - edge, footprint.x + footprint.width + edge, footprint.y + footprint.height + edge]
}

/** The box of the Frame's margin sheet in grid px: left, top, right, bottom. What the Frame's own surface covers
 * (ticket 1187). */
function sheetBoxOf(project: DrawnProject, margin: number, slim?: SlimSheet): readonly [number, number, number, number] {
  const sheet = slim?.sheet ?? marginSheetPx(project, margin)!.sheet
  return [sheet.x, sheet.y, sheet.x + sheet.width, sheet.y + sheet.height]
}

/** Far enough past any Canvas, in grid px, for the clip round the Frame's box to hold the whole picture. */
const HUGE_PX = 1e7

/** Draws the reference image cut to a box, `inside` it or `outside` it, so the Canvas and the Frame each lay it once. */
function drawReferenceCut(context: DrawingContext, reference: DrawnReference, box: readonly [number, number, number, number] | undefined, where: 'inside' | 'outside'): void {
  if (!box) {
    if (where === 'outside') drawReference(context, reference)
    return
  }
  const [left, top, right, bottom] = box
  context.save()
  context.beginPath()
  if (where === 'outside') context.rect(-HUGE_PX, -HUGE_PX, 2 * HUGE_PX, 2 * HUGE_PX)
  context.rect(left, top, right - left, bottom - top)
  context.clip('evenodd')
  drawReference(context, reference)
  context.restore()
}

/** The Frame's box on the Canvas (tickets 458, 0666), `box` from frameGroundBox: filled in the Frame's own Background
 * where it differs from the Canvas's, a Custom frame's Off-shape included, then marked round its positions (ticket 458),
 * in the Frame's look. Tonal tiles are the Frame's own, drawn with its beads (ticket 1001). */
function drawFrameGround(
  context: DrawingContext,
  { project, box, area, zoom, pixelRatio, canvasLook, frameLook, reference, tiles }: { project: DrawnProject; box: readonly [number, number, number, number]; area: { left: number; right: number; top: number; bottom: number }; zoom: number; pixelRatio: number; canvasLook: ProjectTheme; frameLook: ProjectTheme; reference?: DrawnReference; tiles: boolean },
): void {
  const strip = stripIn(context, area)
  if (frameLook.canvas !== canvasLook.canvas) {
    context.fillStyle = frameLook.canvas
    strip(...box)
  }
  // The reference image lies over the Frame's own Background too (ticket 0790), cut to its box; over its tonal tiles
  // when it has them, so the Frame draws it after them (ticket 1008).
  if (reference && !markLookOf(frameLook, tiles).tiles) drawReferenceCut(context, reference, box, 'inside')
  // A Custom frame's Off-shape and Seams hold no position, so its box has no marks (ticket 0592).
  const mark = markLookOf(frameLook, tiles)
  const pattern = !mark.tiles && geometryDrawnAlone(project).grid && positionMarkPattern(context, { ...canvasWeave(project), deviceScale: zoom * pixelRatio, pixelRatio, ...mark })
  if (!pattern) {
    return
  }
  context.fillStyle = pattern
  context.imageSmoothingEnabled = true
  strip(...box)
  context.imageSmoothingEnabled = false
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
  /** The only positions drawn, where not every one in view is (a lifted Frame's passes, ticket 1177): the empty ones, the
   * painted ones, or the empty ones a plate closes in, their tiles over it. */
  only?: 'empty' | 'painted' | ((position: GridPosition) => boolean)
}

/** The Frame's plate when it is lifted (ticket 1177): traced once for its layout of beads, and kept. */
function plateOf(project: DrawnProject): LiftedFrame | undefined {
  const frame = frameOf(project)
  const beads = beadsOfLayer(project, 'frame')
  if (!frame || !beads) return undefined
  const geometry = geometryDrawnAlone(project)
  const weave = frameWeave(project)
  const round = isOpenWeave(beadRoundness(weave.technique, weave.cell) * CELL_SIZE_PX, CELL_SIZE_PX)
  const layout = JSON.stringify([weave, frame.rows, frame.columns, frame.shape, frame.settings, frame.quarterTurns])
  return liftedFrameOf({ beads, layout, round, cellOf: (row, column) => (geometry.hasPosition({ row, column }) ? inGridPx(geometry.place({ row, column })!.box) : undefined) })
}

/** The Frame's cells, bead or empty bead, where its Layer geometry places them, from the context's origin (ticket 492).
 * `origin` is where its first position sits in grid px. `space` is the Frame on its own: its positions counted from 0,
 * and `toAbsolute` the address of its first. */
function drawFrameLayer(context: DrawingContext, draw: LayerDraw, space: Space, origin: { x: number; y: number }): void {
  const { project, area, rows: band } = draw
  const geometry = geometryDrawnAlone(project)
  // The color at a position: the Frame's own beads, which a Custom frame names by round and place, beyond its rectangle.
  const framed = beadsOfLayer(project, 'frame')
  const seen = { x: (area.left - origin.x) / CELL_SIZE_PX, y: (area.top - origin.y) / CELL_SIZE_PX, width: (area.right - area.left) / CELL_SIZE_PX, height: (area.bottom - area.top) / CELL_SIZE_PX }
  // A band of rows is redrawn with the rows either side, into which a shifted column's beads hang; beads that keep no rows are all drawn.
  const inView = () => geometry.positionsIn(seen, band && { first: band.first - 1, last: band.last + 1 })
  const colorAtOwn = (row: number, column: number) => (framed ? colorAt(framed, row, column) : beadInSpace(project, space, row, column))
  const colorOf = ({ row, column }: GridPosition) => colorAtOwn(row, column)
  const { only } = draw
  const wanted = only === 'empty' ? (position: GridPosition) => colorOf(position) === null : only === 'painted' ? (position: GridPosition) => colorOf(position) !== null : only
  const placed = () => (wanted ? inView().filter(wanted) : inView()).map((position) => ({ position, place: geometry.place(position)! }))
  if (geometry.grid && draw.draft) drawDraftFrame(context, draw, space, origin, geometry, inView, colorAtOwn)
  else if (geometry.grid) drawUprightBeads(context, draw, space, origin, placed(), colorOf)
  else drawTurnedBeads(context, draw, space, origin, placed(), colorOf, geometry)
}

/** The Frame's beads in the draft look (ticket 0676): a pixel a bead in its Row progress color, empty ones as an empty
 * bead, no letters. A whole draw keeps the whole Frame's image, which a pan or zoom then lays down again. */
function drawDraftFrame(context: DrawingContext, draw: LayerDraw, space: Space, origin: { x: number; y: number }, geometry: LayerGeometry, inView: () => GridPosition[], colorAtOwn: (row: number, column: number) => string | null): void {
  const { project, look, rowMarks, showFinished, rows: band } = draw
  const weave = frameWeave(project)
  // What progressLook says of a bead, with a color's fill mixed once for the draw, not once a bead: a whole Frame's
  // draft paints every bead (ticket 0677). `each` visits the positions to paint.
  // Over a reference image the empty beads are a second image laid at their opacity (ticket 0790): `only` picks them.
  const paintOf = (each: (visit: (row: number, column: number) => void) => void, only?: 'painted' | 'empty'): DraftPainter => (put) => {
    const { passes, lit } = draw
    const fills = { plain: new Map<string | null, string>(), dimmed: new Map<string | null, string>() }
    each((row, column) => {
      const painted = colorAtOwn(row, column)
      if ((only === 'painted' && painted === null) || (only === 'empty' && painted !== null)) return
      const pass = rowMarks ? passes(space.toAbsolute.row + row, space.toAbsolute.column + column) : undefined
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
    const whole = !band && keptLayerDraft(only === 'empty' ? 'frameEmpty' : 'frame', [project, look, rowMarks, showFinished, space.toAbsolute.row, space.toAbsolute.column, only], () => {
      // A Frame without a shape holds every position of its rectangle: painted row by row, with no position listed.
      const frame = frameOf(project)
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

/** Each layer's last whole draft image and what it was drawn from (ticket 0676): while only the view moves, the same
 * Project at the same look, it is laid down again instead of every bead being read. Undefined for one too big to keep. */
const keptDrafts: Partial<Record<KeptLayer, { from: readonly unknown[]; draft: DraftImageOf | undefined }>> = {}

/** What a kept draft image is of: a layer, or the Frame's empty beads laid over a reference image (ticket 0790). */
type KeptLayer = 'canvas' | 'frame' | 'frameEmpty'

/** The layer's kept draft image when it was drawn from the same `from`, else the one `make` paints, kept in its place. */
function keptLayerDraft(layer: KeptLayer, from: readonly unknown[], make: () => DraftImageOf | undefined): DraftImageOf | undefined {
  const last = keptDrafts[layer]
  if (last && last.from.length === from.length && last.from.every((value, at) => value === from[at])) return last.draft
  const draft = make()
  keptDrafts[layer] = { from, draft }
  return draft
}

/** A bead of a Layer and where its geometry places it, in bead widths. */
interface PlacedBead {
  position: GridPosition
  place: BeadPlace
}

/** Beads standing upright in rows and columns, each in its box: the current row's lit (ticket 352), an empty cell left
 * as it is (ticket 411). */
function drawUprightBeads(context: DrawingContext, draw: LayerDraw, space: Space, origin: { x: number; y: number }, beads: readonly PlacedBead[], colorOf: (position: GridPosition) => string | null): void {
  const { project, zoom, pixelRatio, look, drawBead, letters } = draw
  const weave = frameWeave(project)
  const cornerRadius = beadRoundness(weave.technique, weave.cell) * CELL_SIZE_PX
  // An empty position is a tonal tile where they are drawn (ticket 1001).
  const mark = markLookOf(look, draw.tiles)
  for (const { position: own, place } of beads) {
    const box = inGridPx(place.box)
    const painted = colorOf(own)
    const { shown, dimmed } = progressLook(draw, space, own, painted)
    const sized = box.width !== CELL_SIZE_PX || box.height !== CELL_SIZE_PX ? { width: box.width, height: box.height } : {}
    const bead = { x: origin.x + box.x, y: origin.y + box.y, size: CELL_SIZE_PX, ...sized, cornerRadius, color: shown, dimmed, deviceScale: zoom * pixelRatio, theme: look }
    if (painted === null && mark.tiles) drawTile(context, { x: bead.x, y: bead.y, width: box.width, height: box.height, cornerRadius }, mark.color, bead.deviceScale)
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
function drawTurnedBeads(context: DrawingContext, draw: LayerDraw, space: Space, origin: { x: number; y: number }, beads: readonly PlacedBead[], colorOf: (position: GridPosition) => string | null, geometry: LayerGeometry): void {
  const { project, zoom, pixelRatio, look, drawBead, letters } = draw
  const weave = frameWeave(project)
  const mark = markLookOf(look, draw.tiles)
  context.save()
  context.translate(origin.x, origin.y)
  // The beads are turned, so their bitmaps are smoothed as they are laid down.
  context.imageSmoothingEnabled = true
  for (const { position, place } of beads) {
    const box = inGridPx(place.box)
    const centred = { x: -box.width / 2, y: -box.height / 2, width: box.width, height: box.height }
    const cornerRadius = beadRoundness(weave.technique, weave.cell) * box.width
    const painted = colorOf(position)
    const { shown, dimmed } = progressLook(draw, space, position, painted)
    context.save()
    context.translate(box.x + box.width / 2, box.y + box.height / 2)
    context.rotate(place.angle)
    const bead = { ...centred, size: box.width, cornerRadius, color: shown, dimmed, deviceScale: zoom * pixelRatio, theme: look }
    if (painted === null && mark.tiles) drawTile(context, { ...centred, cornerRadius }, mark.color, bead.deviceScale)
    else if (painted === null && draw.seeThrough !== undefined) drawSeeThroughBead(context, bead, draw.seeThrough)
    else drawBead(context, bead)
    const letter = painted === null ? undefined : letters?.[painted]
    if (painted !== null && letter) {
      drawBeadLetter(context, { ...centred, size: box.width, color: painted, letter, dimmed, theme: look })
    }
    context.restore()
  }
  context.imageSmoothingEnabled = false
  context.beginPath()
  for (const [from, to] of geometry.seams()) {
    context.moveTo(from.x * CELL_SIZE_PX, from.y * CELL_SIZE_PX)
    context.lineTo(to.x * CELL_SIZE_PX, to.y * CELL_SIZE_PX)
  }
  context.strokeStyle = look.pieceLine
  context.lineWidth = SEAM_WIDTH_PX
  context.stroke()
  context.restore()
}

/** How Row progress shows a Frame bead (tickets 352, 434): its color lit in the current row, faded in a finished one
 * unless finished rows are shown. */
function progressLook({ rowMarks, showFinished, passes, lit }: LayerDraw, space: Space, own: GridPosition, painted: string | null): { shown: string | null; dimmed: boolean } {
  if (!rowMarks) return { shown: painted, dimmed: false }
  const pass = passes(space.toAbsolute.row + own.row, space.toAbsolute.column + own.column)
  return { shown: painted !== null && pass === 'current' ? lit(painted) : painted, dimmed: !showFinished && pass === 'finished' }
}

/** A Seam's width in grid px: a hairline at 100%. */
const SEAM_WIDTH_PX = 1

/** The Canvas's beads, bead by bead or as one draft image, with the Frame's footprint cut out so none shows over it.
 * What every bead shares (its Weave's description, cell, corners, the margin) is worked out once (ticket 0676). */
function drawCanvasLayer(context: DrawingContext, draw: LayerDraw, space: Space): void {
  const { project, region, zoom, pixelRatio, look, drawBead, area, rows: band, margin, canvasLetters } = draw
  const rotation = quarterTurnOf(project)
  const beads = beadsOfLayer(project, 'canvas')
  const covered = footprintOf(project)
  const keptOut = covered && withMargin(covered, margin)
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
  // The beads round the margin reach into its edge (a shifted row hangs half a bead across, a shifted column down): cut
  // out its box so none shows inside the outline (the outer rectangle is the view, a cell wider each side).
  const footprint = frameFootprintPx(project, margin)
  const cutOut = footprint !== undefined && rowsInView.length > 0
  if (footprint && cutOut) {
    context.save()
    context.beginPath()
    boxPath(context, area.left - CELL_SIZE_PX, area.top - CELL_SIZE_PX, area.right - area.left + 2 * CELL_SIZE_PX, area.bottom - area.top + 2 * CELL_SIZE_PX)
    boxPath(context, footprint.x, footprint.y, footprint.width, footprint.height)
    context.clip('evenodd')
  }
  // The beads of a row in view; a row's beads never overlap, so in any order. The keep-out margin covers any bead that
  // lies in it (ticket 261): it stays in the Project, undrawn.
  const eachInView = (row: number, first: number, last: number, take: (column: number, color: string) => void) => {
    const stored = beads[row]!
    for (const key in stored) {
      const column = Number(key)
      if (column < first || column > last || (keptOut && frameContains(keptOut, { row, column }))) continue
      take(column, stored[column]!)
    }
  }
  if (draw.draft && rowsInView.length > 0) {
    // A whole draw keeps the whole layer's image, which a pan or zoom then lays down again.
    const whole = !band && keptLayerDraft('canvas', [project, margin], () => {
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
        drawBead(context, { x, y, size: CELL_SIZE_PX, ...sized, cornerRadius, color, dimmed: false, deviceScale, theme: look })
        const letter = canvasLetters?.[color]
        if (letter) drawBeadLetter(context, { x, y, size: CELL_SIZE_PX, ...sized, color, letter, dimmed: false, theme: look })
      })
    }
  }
  if (cutOut) {
    context.restore()
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
export function marginSheetPx(project: DrawnProject, margin = MARGIN): { sheet: Region; footprint: Region; band: number } | undefined {
  const sheet = frameFootprintPx(project, margin)
  const footprint = frameFootprintPx(project)
  if (!sheet || !footprint) return undefined
  const band = Math.min(footprint.x - sheet.x, footprint.y - sheet.y, sheet.x + sheet.width - footprint.x - footprint.width, sheet.y + sheet.height - footprint.y - footprint.height)
  return { sheet, footprint, band }
}

/** The expanded Frame's slim sheet as drawn (ticket 1169): its box in grid px and its outer corners in screen px. */
export interface SlimSheet {
  sheet: Region
  radius: number
}

/** The keep-out margin as drafting paper (MarginSheet card, ticket 0656): its band in the margin color, the Frame's
 * footprint left out, a hairline edge and an inner border; folded, no border; none bare, which keeps only the Move bar and
 * the Frame tools button (tickets 0682, 1164). In grid space: its `MARGIN_PX` at the sheet's scale (ticket 0698), over the zoom. */
function drawMarginSheet(context: DrawingContext, project: DrawnProject, margin: number, zoom: number, look: MarginLook, slim?: SlimSheet): void {
  const kept = marginSheetPx(project, margin)!
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

/** A lifted Frame, in four passes (ticket 1177, BeadBoard card, Lifted Frame): its empty positions, the plate over them,
 * the holes' tiles lying on the plate, then the painted beads over it all. */
function drawLifted(drawPart: (part: LayerDraw) => void, draw: LayerDraw, plate: LiftedFrame, lay: () => void, project: DrawnProject): void {
  const geometry = geometryDrawnAlone(project)
  const beads = beadsOfLayer(project, 'frame')
  const inHole = ({ row, column }: GridPosition) => {
    const box = !(beads && colorAt(beads, row, column)) && geometry.place({ row, column })?.box
    return !!box && plate.covers((box.x + box.width / 2) * CELL_SIZE_PX, (box.y + box.height / 2) * CELL_SIZE_PX)
  }
  const empties = { ...draw, drawBead: emptyOnly(draw.drawBead), letters: undefined }
  drawPart({ ...empties, only: 'empty' })
  lay()
  drawPart({ ...empties, only: inHole })
  drawPart({ ...draw, drawBead: paintedOnly(draw.drawBead), tiles: false, seeThrough: undefined, only: 'painted' })
}

const canvasLooks = new WeakMap<ProjectTheme, ProjectTheme>()

/** A theme as the Canvas draws in it: a finished row fades toward the drawing area, not a board. One object per theme,
 * so the colors kept per theme last from draw to draw. */
function canvasLook(theme: ProjectTheme): ProjectTheme {
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
  const { project, space, region, zoom, pixelRatio = 1, theme = DEFAULT_THEME, drawBead = drawFlatBead, rows, columns, showFinished = false, rowMarks = rowProgressOn(input.project), margin = MARGIN, letters, canvasLetters, draftWhenSmall = false, opaque = false, positionMarks = true, reference, layer } = input
  const frameTheme = input.frameTheme ?? theme
  const frame = frameOf(project)
  const rotation = quarterTurnOf(project)
  const { extent } = space
  // A finished row fades toward what is behind it, which on the Canvas is the drawing area, not a board.
  const look = space.open ? canvasLook(theme) : theme
  const frameLook = space.open ? canvasLook(frameTheme) : frameTheme
  // A band of rows is the same rows of both layers only where they are alike (woven alike, in Beads of one size).
  const alike = !space.open || !frame || layersAlike(project)
  const bandWeave = space.open ? canvasWeave(project) : frameWeave(project)
  const draft = draftWhenSmall && drawsDraft(zoom * pixelRatio)
  // The lifted Frame's outline and shadows reach past its beads (ticket 1177): a band is cleared, cut and redrawn that
  // much wider, else a stale shadow is left round a bead that changed. The editor shows none over a reference image.
  const lifts = frameLifted(project) && !draft && !reference && (input.lift ?? (rowMarks && look.liftedFrame))
  const reach = lifts ? Math.ceil(LIFT_REACH_PX / cellSizePx(bandWeave.technique, bandWeave.cell).height) : 0
  const band = alike ? (rows && reach ? { first: rows.first - reach, last: rows.last + reach } : rows) : undefined
  const strip = alike && !band && columns ? columnStrip(bandWeave, columns, lifts ? LIFT_REACH_PX : 0) : undefined

  // The backing store is in device px: clear (and paint the background, in Frame-only space) there, the whole surface
  // or just the band being drawn again, which the rest of the drawing is then cut to, then draw in CSS px scaled up to
  // it.
  context.setTransform(1, 0, 0, 1, 0, 0)
  const cleared = band
    ? bandOnSurface(space, region, zoom, rotation, pixelRatio, rowsCut(bandWeave, band))
    : strip
      ? bandOnSurface(space, region, zoom, rotation, pixelRatio, strip.cut)
      : { x: 0, y: 0, width: region.width * pixelRatio, height: region.height * pixelRatio }
  if (band || strip) {
    context.save()
    context.beginPath()
    context.rect(cleared.x, cleared.y, cleared.width, cleared.height)
    context.clip()
  }
  context.clearRect(cleared.x, cleared.y, cleared.width, cleared.height)
  // The Frame's own surface is clear round its sheet: the Canvas's shows through (ticket 1187).
  if (!space.open || (opaque && layer !== 'frame')) {
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
  const draw: LayerDraw = { project, region, zoom, pixelRatio, look, drawBead, rowMarks, showFinished, area, rows: band, margin, letters, canvasLetters, draft, passes: rowPassesOf(project), lit, seeThrough, tiles }

  if (space.open) {
    // The reference image over the Canvas's Background and under every bead (ticket 0790): over its tonal tiles, so
    // showing it leaves the grid as it is (ticket 1008), under the outlines drawn instead. The Frame lays its own.
    const overTiles = positionMarks && markLookOf(theme, tiles).tiles
    // A Frame off the Canvas's grid covers none of it (ticket 1188): its own surface draws it, from a Project laid so.
    const frameBox = frame && footprintOf(project) ? frameGroundBox(project) : undefined
    // The Canvas's own part: what its surface draws (ticket 1187), the Frame's laid over it on its own.
    if (layer !== 'frame') {
      if (under && !overTiles) drawReferenceCut(context, under, frameBox, 'outside')
      if (positionMarks && tiles && theme.tonalTiles) {
        // The calm gap between tonal tiles, laid flat under them over the whole surface (ticket 1001).
        context.fillStyle = gapColorOf(theme.canvas)
        context.fillRect(area.left, area.top, area.right - area.left, area.bottom - area.top)
      }
      // Expanded, the slim sheet is the margin on screen (ticket 1176): the marks run up to it, under it, so no bare band of
      // the 4 keep-out positions shows round it. What the margin keeps out is unchanged.
      const marked = input.slimSheet ? 0 : margin
      if (positionMarks) drawPositionMarks(context, { project, space, area, zoom, pixelRatio, theme, margin: marked, tiles })
      if (under && overTiles) drawReferenceCut(context, under, frameBox, 'outside')
      drawCanvasLayer(context, draw, space)
    }
    if (frame && frameBox && layer !== 'canvas') {
      drawMarginSheet(context, project, margin, zoom, theme.margin, input.slimSheet)
      drawFrameGround(context, { project, box: frameBox, area, zoom, pixelRatio, canvasLook: theme, frameLook: frameTheme, reference: under, tiles })
      const origin = frameOriginPx(canvasWeave(project), frame)
      const sheet = spaceOf(project, false)
      // The Frame is drawn in its own px, its Bead's size over the Canvas's (ticket 0665), from its first position's
      // corner. The band's rows are the Canvas's; the Frame's own are counted from its first (alike layers only).
      const scale = frameScale(project)
      const frameDraw = (part: LayerDraw) => {
        if (scale === 1) {
          drawFrameLayer(context, { ...part, rows: band && { first: band.first - frame.row, last: band.last - frame.row } }, sheet, origin)
          return
        }
        const seen = { left: (area.left - origin.x) / scale, right: (area.right - origin.x) / scale, top: (area.top - origin.y) / scale, bottom: (area.bottom - origin.y) / scale }
        context.save()
        context.translate(origin.x, origin.y)
        context.scale(scale, scale)
        drawFrameLayer(context, { ...part, zoom: zoom * scale, area: seen, rows: undefined }, sheet, { x: 0, y: 0 })
        context.restore()
      }
      const frameDrawn: LayerDraw = { ...draw, look: frameLook }
      const plate = lifts ? plateOf(project) : undefined
      if (plate) {
        const lay = () => {
          // The plate is drawn in the Frame's own px; its shadows are in device px, whatever it is scaled by.
          context.save()
          context.translate(origin.x, origin.y)
          context.scale(scale, scale)
          drawLiftedFrame(context, plate, { origin: { x: 0, y: 0 }, background: input.liftBackground ?? frameLook.background, deviceScale: zoom * scale * pixelRatio, surface: { width: region.width * pixelRatio, height: region.height * pixelRatio } })
          context.restore()
        }
        drawLifted(frameDraw, frameDrawn, plate, lay, project)
      } else if (under && markLookOf(frameLook, tiles).tiles) {
        // Its tonal tiles, the reference image over them, then its painted beads (ticket 1008).
        frameDraw({ ...frameDrawn, drawBead: () => {}, letters: undefined })
        drawReferenceCut(context, under, frameBox, 'inside')
        frameDraw({ ...frameDrawn, drawBead: paintedOnly(draw.drawBead), tiles: false, seeThrough: undefined })
      } else {
        frameDraw(frameDrawn)
      }
    }
  } else if (space.hasFrame) {
    const plate = lifts ? plateOf(project) : undefined
    const frameDrawn: LayerDraw = { ...draw, look: frameLook }
    if (plate) {
      const lay = () => drawLiftedFrame(context, plate, { origin: { x: 0, y: 0 }, background: input.liftBackground ?? frameLook.background, deviceScale: zoom * pixelRatio, surface: { width: region.width * pixelRatio, height: region.height * pixelRatio } })
      drawLifted((part) => drawFrameLayer(context, part, space, { x: 0, y: 0 }), frameDrawn, plate, lay, project)
    } else {
      drawFrameLayer(context, frameDrawn, space, { x: 0, y: 0 })
    }
  }
  // Laid over the beads it is drawn last, over the Frame too, the beads under it looking as they do under it (ticket 1009).
  // Drawn one layer at a time, each lays it on its own part: the Frame on its sheet's box, the Canvas round it.
  if (drawn?.over) drawReferenceCut(context, drawn, layer && frame && footprintOf(project) ? sheetBoxOf(project, margin, input.slimSheet) : undefined, layer === 'frame' ? 'inside' : 'outside')

  if (band || strip) {
    context.restore()
  }
}
