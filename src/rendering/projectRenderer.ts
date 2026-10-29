import type { GridPosition, Rotation } from '../domain/grid'
import { beadRoundness, describeWeave, type Weave } from '../domain/weave'
import type { VisiblePositions } from '../domain/weaveGeometry'
import { colorAt, frameContains } from '../domain/canvas'
import { footprintOf } from '../domain/footprint'
import type { BeadPlace, LayerGeometry } from '../domain/layerGeometry'
import { MARGIN, withMargin } from '../domain/margin'
import { laidFrame } from '../domain/frameOrientation'
import { canvasWeave, frameScale, frameWeave, layersAlike } from '../domain/layerWeave'
import { isInCurrentRow, isInFinishedRow, rowProgressOn } from '../domain/rowProgress'
import {
  BEAD_GAP_PX,
  brighten,
  CURRENT_ROW_BRIGHTNESS,
  DEFAULT_THEME,
  drawBeadLetter,
  drawFlatBead,
  type BeadDrawer,
  type DrawingContext,
  type ProjectTheme,
} from './beadLook'
import type { MarginLook } from './marginLook'
import { marginForm } from './marginForm'
import { MARGIN_PX } from './marginSizes'
import { positionMarkPattern } from './positionMarks'
import { beadInSpace, geometryDrawnAlone, spaceOf, type Space } from './space'
import { CELL_SIZE_PX, cellSizePx } from './cellSize'
import {
  frameOriginPx,
  gridBox,
  gridToRegion,
  inGridPx,
  layerExtentPx,
  positionBoxPx,
  positionsBoxPx,
  regionInGridSpace,
  setGridTransform,
  type Region,
} from './surfaceView'
import { beadsOfLayer, frameOf, type Layered, quarterTurnOf } from '../domain/layerRecord'

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
  // Draw finished rows at their normal color (ticket 352): while the pointer hovers a finished row, or after a tap on a
  // finished row. Off, they are dimmed.
  showFinished?: boolean
  // Whether Row progress is drawn: finished rows faded, the current one brighter. Defaults to `rowProgressOn(project)`;
  // an export, a chart that shows every bead as it is, passes false (ticket 434).
  rowMarks?: boolean
  // Redraw only these rows: their whole band is cleared and redrawn, so edits do not pile up anti-aliasing on rounded
  // beads.
  rows?: { first: number; last: number }
  // How many positions wide the keep-out margin is drawn (ticket 459): the surface widens it when zoomed out. Defaults
  // to `MARGIN`.
  margin?: number
  // How one bead is drawn. Defaults to today's look; a richer one is handed in here, and never has to know about rows,
  // zoom, rotation or what is on screen.
  drawBead?: BeadDrawer
  /** The Swatch letter of each color by hex (ticket 0573): given, the Frame's beads carry their letter. Absent, none. */
  letters?: Readonly<Record<string, string>>
}

/** The box on the Canvas the Frame hides (ticket 492), in grid px: the rectangle of Canvas positions it claims, grown to
 * take in its drawn extent where it is woven otherwise or in a Bead of another size (ticket 0665) and so draws larger
 * or smaller than that. */
function frameFootprintPx(project: DrawnProject, margin = 0): Region | undefined {
  const frame = frameOf(project)
  if (!frame) {
    return undefined
  }
  const canvas = canvasWeave(project)
  // With a `margin` the box also takes in the keep-out margin (ticket 501), which the Canvas draws nothing in.
  const grown = withMargin(footprintOf(project)!, margin)
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
// position is tested. The marks also fill the Frame's box (ticket 458).
function drawPositionMarks(
  context: DrawingContext,
  { project, area, zoom, pixelRatio, theme, margin }: { project: DrawnProject; space: Space; margin: number; area: { left: number; right: number; top: number; bottom: number }; zoom: number; pixelRatio: number; theme: ProjectTheme },
): void {
  const canvas = canvasWeave(project)
  const pattern = positionMarkPattern(context, { ...canvas, deviceScale: zoom * pixelRatio, pixelRatio, color: theme.positionMark })
  if (!pattern) {
    return
  }
  const cell = cellSizePx(canvas.technique, canvas.cell)
  const box = frameOf(project) && withMargin(footprintOf(project)!, margin)
  // The margin's box, between the marks just inside and just outside it; a Frame woven otherwise holds what it draws.
  const footprint = frameFootprintPx(project)
  const held = frameFootprintPx(project, margin)
  const alike = layersAlike(project)
  const cut = box && held && (alike ? describeWeave(canvas).boundary(box, cell.width, cell.height) : held)
  const hole = cut && { left: cut.x, right: cut.x + cut.width, top: cut.y, bottom: cut.y + cut.height }
  context.fillStyle = pattern
  // The pattern is scaled to the tile's whole pixels, so it is smoothed here; the beads are blitted as they are.
  context.imageSmoothingEnabled = true
  const strip = (left: number, top: number, right: number, bottom: number) => {
    if (right > left && bottom > top) {
      context.fillRect(left, top, right - left, bottom - top)
    }
  }
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
  // A Custom frame's Off-shape and Seams hold no position, so its box has no marks (ticket 0592).
  if (footprint && geometryDrawnAlone(project).grid) {
    // The marks are round every position, the Frame's own included (ticket 458): its cells' outlines show in the gaps
    // between its beads.
    const edge = BEAD_GAP_PX / 2
    strip(
      Math.max(footprint.x - edge, area.left),
      Math.max(footprint.y - edge, area.top),
      Math.min(footprint.x + footprint.width + edge, area.right),
      Math.min(footprint.y + footprint.height + edge, area.bottom),
    )
  }
  context.imageSmoothingEnabled = false
}

// The band of the surface, in device pixels, that rows `first` to `last` occupy: the whole Project width, or the
// viewport on the Canvas.
function bandOnSurface(
  space: Space,
  region: Region,
  zoom: number,
  rotation: Rotation,
  pixelRatio: number,
  weave: Weave,
  rows: { first: number; last: number },
): Region {
  const band = positionsBoxPx(weave, rows.first, 0, rows.last - rows.first + 1, 1)
  const top = band.y
  const bottom = band.y + band.height
  const area = regionInGridSpace(space.extent, region, zoom, rotation)
  const [left, right] = space.open ? [area.left, area.right] : [0, space.extent.width]
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
}

/** The Frame's cells, bead or empty bead, where its Layer geometry places them, from the context's origin (ticket 492).
 * `origin` is where its first position sits in grid px. `space` is the Frame on its own: its positions counted from 0,
 * and `toAbsolute` the address of its first. */
function drawFrameLayer(context: DrawingContext, draw: LayerDraw, space: Space, origin: { x: number; y: number }): void {
  const { project, area, rows: band } = draw
  const geometry = geometryDrawnAlone(project)
  const seen = { x: (area.left - origin.x) / CELL_SIZE_PX, y: (area.top - origin.y) / CELL_SIZE_PX, width: (area.right - area.left) / CELL_SIZE_PX, height: (area.bottom - area.top) / CELL_SIZE_PX }
  // A band of rows is redrawn with the rows either side, whose beads nest into it; beads that keep no rows are all drawn.
  const beads = geometry
    .positionsIn(seen, band && { first: band.first - 1, last: band.last + 1 })
    .map((position) => ({ position, place: geometry.place(position)! }))
  // The color at a position: the Frame's own beads, which a Custom frame names by round and place, beyond its rectangle.
  const framed = beadsOfLayer(project, 'frame')
  const colorOf = ({ row, column }: GridPosition) => (framed ? colorAt(framed, row, column) : beadInSpace(project, space, row, column))
  if (geometry.grid) drawUprightBeads(context, draw, space, origin, beads, colorOf)
  else drawTurnedBeads(context, draw, space, origin, beads, colorOf, geometry)
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
  for (const { position: own, place } of beads) {
    const box = inGridPx(place.box)
    const painted = colorOf(own)
    const { shown, dimmed } = progressLook(draw, space, own, painted)
    const sized = box.width !== CELL_SIZE_PX || box.height !== CELL_SIZE_PX ? { width: box.width, height: box.height } : {}
    drawBead(context, { x: origin.x + box.x, y: origin.y + box.y, size: CELL_SIZE_PX, ...sized, cornerRadius, color: shown, dimmed, deviceScale: zoom * pixelRatio, theme: look })
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
    drawBead(context, { ...centred, size: box.width, cornerRadius, color: shown, dimmed, deviceScale: zoom * pixelRatio, theme: look })
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
function progressLook({ project, rowMarks, showFinished }: LayerDraw, space: Space, own: GridPosition, painted: string | null): { shown: string | null; dimmed: boolean } {
  const address = { row: space.toAbsolute.row + own.row, column: space.toAbsolute.column + own.column, layer: 'frame' as const }
  const dimmed = rowMarks && !showFinished && isInFinishedRow(project, address)
  return { shown: painted !== null && rowMarks && isInCurrentRow(project, address) ? brighten(painted, CURRENT_ROW_BRIGHTNESS) : painted, dimmed }
}

/** A Seam's width in grid px: a hairline at 100%. */
const SEAM_WIDTH_PX = 1

/** The Canvas's beads, bead by bead, with the Frame's footprint cut out so none shows over it. */
function drawCanvasLayer(context: DrawingContext, draw: LayerDraw, space: Space): void {
  const { project, region, zoom, pixelRatio, look, drawBead, area, rows: band, margin } = draw
  const rotation = quarterTurnOf(project)
  const beads = beadsOfLayer(project, 'canvas')
  const covered = footprintOf(project)
  const weave = canvasWeave(project)
  const cornerRadius = beadRoundness(weave.technique, weave.cell) * CELL_SIZE_PX
  const visible = visibleBeadsInSpace(weave, space, region, zoom, rotation)
  const firstRow = band ? Math.max(visible.firstRow, band.first - 1) : visible.firstRow
  const lastRow = band ? Math.min(visible.lastRow, band.last + 1) : visible.lastRow
  const theme = look

  // Only the stored rows in view, and only their stored columns: the cost follows the beads, not the canvas.
  const rowsInView = Object.keys(beads).map(Number).filter((row) => row >= firstRow && row <= lastRow).sort((a, b) => a - b)
  // The beads round the margin nest into its edge (peyote rows sit closer than a bead is tall, offset rows reach half
  // a bead across): cut out its box so none shows inside the outline (the outer rectangle is the view, a cell wider each side so
  // only the cut-out matters).
  const footprint = frameFootprintPx(project, margin)
  const cutOut = footprint !== undefined && rowsInView.length > 0
  if (footprint && cutOut) {
    context.save()
    context.beginPath()
    boxPath(context, area.left - CELL_SIZE_PX, area.top - CELL_SIZE_PX, area.right - area.left + 2 * CELL_SIZE_PX, area.bottom - area.top + 2 * CELL_SIZE_PX)
    boxPath(context, footprint.x, footprint.y, footprint.width, footprint.height)
    context.clip('evenodd')
  }
  for (const row of rowsInView) {
    const { first, last } = visible.columnsOf(row)
    const stored = beads[row]!
    for (const column of Object.keys(stored).map(Number).filter((column) => column >= first && column <= last).sort((a, b) => a - b)) {
      // The keep-out margin covers any bead that lies in it (ticket 261): it stays in the Project, undrawn.
      if (covered && frameContains(withMargin(covered, margin), { row, column })) {
        continue
      }
      const box = positionBoxPx(weave, row, column)
      drawBead(context, {
        x: box.x,
        y: box.y,
        size: CELL_SIZE_PX,
        ...(box.width !== CELL_SIZE_PX || box.height !== CELL_SIZE_PX ? { width: box.width, height: box.height } : {}),
        cornerRadius,
        color: stored[column]!,
        dimmed: false,
        deviceScale: zoom * pixelRatio,
        theme,
      })
    }
  }
  if (cutOut) {
    context.restore()
  }
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

/** The keep-out margin as a sheet of drafting paper (MarginSheet card, ticket 0656): its band in the margin color, the
 * Frame's footprint left out, a hairline edge and an inner border where it fits; folded, no inner border; none bare,
 * which keeps only the Move bar (ticket 0682). In grid space, its `MARGIN_PX` divided by the zoom to stay screen px. */
function drawMarginSheet(context: DrawingContext, project: DrawnProject, margin: number, zoom: number, look: MarginLook): void {
  const { sheet, footprint, band: gridBand } = marginSheetPx(project, margin)!
  const band = gridBand * zoom
  const form = marginForm(band)
  if (form === 'bare') return
  const drawn = form === 'full' ? 'full' : 'compact'
  const edge = BEAD_GAP_PX / 2
  const radius = Math.min(MARGIN_PX.sheetRadius[drawn], band) / zoom
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
    const at = MARGIN_PX.place[form].border / zoom
    context.lineWidth = 1 / zoom
    context.strokeStyle = look.line
    context.beginPath()
    context.roundRect(sheet.x + at, sheet.y + at, sheet.width - 2 * at, sheet.height - 2 * at, MARGIN_PX.borderRadius / zoom)
    context.stroke()
  }
  context.restore()
}

// Draws the part of the Project in the region, clearing it first. Differs by space only in the background (Frame-only
// fills it, the Canvas stays transparent and fades finished rows) and in what is drawn: the Canvas's beads with the
// Frame laid over them in its own Weave, or the Frame alone.
export function renderProject(context: DrawingContext, input: RenderInput): void {
  const { project, space, region, zoom, pixelRatio = 1, theme = DEFAULT_THEME, drawBead = drawFlatBead, rows, showFinished = false, rowMarks = rowProgressOn(input.project), margin = MARGIN, letters } = input
  const frame = frameOf(project)
  const rotation = quarterTurnOf(project)
  const { extent } = space
  // A finished row fades toward what is behind it, which on the Canvas is the drawing area, not a board.
  const look: ProjectTheme = space.open ? { ...theme, background: theme.canvas } : theme
  // A band of rows is the same rows of both layers only where they are alike (woven alike, in Beads of one size).
  const alike = !space.open || !frame || layersAlike(project)
  const band = alike ? rows : undefined
  const bandWeave = space.open ? canvasWeave(project) : frameWeave(project)

  // The backing store is in device px: clear (and paint the background, in Frame-only space) there, the whole surface
  // or just the band being drawn again, which the rest of the drawing is then cut to, then draw in CSS px scaled up to
  // it.
  context.setTransform(1, 0, 0, 1, 0, 0)
  const cleared = band
    ? bandOnSurface(space, region, zoom, rotation, pixelRatio, bandWeave, band)
    : { x: 0, y: 0, width: region.width * pixelRatio, height: region.height * pixelRatio }
  if (band) {
    context.save()
    context.beginPath()
    context.rect(cleared.x, cleared.y, cleared.width, cleared.height)
    context.clip()
  }
  context.clearRect(cleared.x, cleared.y, cleared.width, cleared.height)
  if (!space.open) {
    context.fillStyle = theme.background
    context.fillRect(cleared.x, cleared.y, cleared.width, cleared.height)
  }

  setGridTransform(context, extent, region, zoom, rotation, pixelRatio)
  // Bitmaps of beads are made at the size they are on the screen, so they are blitted as they are, not resampled.
  context.imageSmoothingEnabled = false

  const area = regionInGridSpace(extent, region, zoom, rotation)
  const draw: LayerDraw = { project, region, zoom, pixelRatio, look, drawBead, rowMarks, showFinished, area, rows: band, margin, letters }

  if (space.open) {
    drawPositionMarks(context, { project, space, area, zoom, pixelRatio, theme, margin })
    drawCanvasLayer(context, draw, space)
    if (frame) {
      drawMarginSheet(context, project, margin, zoom, theme.margin)
      const origin = frameOriginPx(canvasWeave(project), frame)
      const sheet = spaceOf(project, false)
      // The Frame is drawn in its own px, its Bead's size over the Canvas's (ticket 0665), from its first position's
      // corner. The band's rows are the Canvas's; the Frame's own are counted from its first (alike layers only).
      const scale = frameScale(project)
      if (scale === 1) {
        drawFrameLayer(context, { ...draw, rows: band && { first: band.first - frame.row, last: band.last - frame.row } }, sheet, origin)
      } else {
        const seen = { left: (area.left - origin.x) / scale, right: (area.right - origin.x) / scale, top: (area.top - origin.y) / scale, bottom: (area.bottom - origin.y) / scale }
        context.save()
        context.translate(origin.x, origin.y)
        context.scale(scale, scale)
        drawFrameLayer(context, { ...draw, zoom: zoom * scale, area: seen, rows: undefined }, sheet, { x: 0, y: 0 })
        context.restore()
      }
    }
  } else if (space.hasFrame) {
    drawFrameLayer(context, draw, space, { x: 0, y: 0 })
  }

  if (band) {
    context.restore()
  }
}
