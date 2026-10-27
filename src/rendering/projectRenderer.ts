import type { GridPosition, Rotation } from '../domain/grid'
import { beadRoundness, describeWeave, type Weave } from '../domain/weave'
import { frameContains } from '../domain/canvas'
import { footprintOf } from '../domain/footprint'
import { frameLayoutOf } from '../domain/frameKind'
import { MARGIN, withMargin } from '../domain/margin'
import { canvasWeave, frameWeave, isInCurrentRow, isInFinishedRow, projectCell, rowProgressOn, sameWeave, type Project } from '../domain/project'
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
import { positionMarkPattern } from './positionMarks'
import { beadInSpace, spaceOf, type Space } from './space'
import { centredBead, layoutPointPx, placedLayout, type PlacedLayout } from './customFrameView'
import {
  CELL_SIZE_PX,
  cellSizePx,
  frameOriginPx,
  gridToRegion,
  layerExtentPx,
  positionBoxPx,
  positionsBoxPx,
  projectExtentPx,
  regionInGridSpace,
  rowPitchPx,
  rowShiftPx,
  rowTopPx,
  setGridTransform,
  type Region,
} from './surfaceView'

// The Project renderer (CONTEXT.md, ADR 0018): the one place that draws a Project's cells for any Technique. Grid space
// is px at zoom 1; the region asked for is in displayed space (zoomed, rotated, ticket 171), so cost follows what is in
// view. A `Space` (space.ts, ADR 0026) says whether it draws the Frame alone from the origin or on the Canvas.

// The rows and columns of beads touching a stretch of grid space; a layer's row 0 is an unshifted one. Exported for
// tests.
export function visibleBeads(
  weave: Weave,
  columns: number,
  rows: number,
  area: { left: number; right: number; top: number; bottom: number },
): { firstRow: number; lastRow: number; columnsOf: (row: number) => { first: number; last: number } } {
  if (describeWeave(weave).countsUnits) {
    const range = visibleUnitBeads(weave, area)
    return {
      firstRow: Math.max(0, range.firstRow),
      lastRow: Math.min(rows - 1, range.lastRow),
      columnsOf: () => ({ first: Math.max(0, range.first), last: Math.min(columns - 1, range.last) }),
    }
  }
  const pitch = rowPitchPx(weave.technique, weave.cell)
  // A bead reaches its height below its row's top, so ask for a little more below.
  const topRow = Math.max(0, Math.ceil((area.top - cellSizePx(weave.technique, weave.cell).height) / pitch))
  const bottomRow = Math.min(rows - 1, Math.floor(area.bottom / pitch))

  return {
    firstRow: topRow,
    lastRow: bottomRow,
    columnsOf: (row) => {
      const shift = rowShiftPx(weave, row)
      return {
        first: Math.max(0, Math.ceil((area.left - shift - CELL_SIZE_PX) / CELL_SIZE_PX)),
        last: Math.min(columns - 1, Math.floor((area.right - shift) / CELL_SIZE_PX)),
      }
    },
  }
}

// The positions of a Technique that counts Units touching a stretch of grid space (tickets 482, 485).
function visibleUnitBeads(weave: Weave, area: { left: number; right: number; top: number; bottom: number }) {
  const cell = cellSizePx(weave.technique, weave.cell)
  return describeWeave(weave).visible(area, cell.width, cell.height)
}

// The beads touching a stretch of grid space on a Canvas (ADR 0026): as visibleBeads, but unbounded, so indices may be
// negative.
function visibleBeadsOpen(
  weave: Weave,
  area: { left: number; right: number; top: number; bottom: number },
): ReturnType<typeof visibleBeads> {
  if (describeWeave(weave).countsUnits) {
    const range = visibleUnitBeads(weave, area)
    return { firstRow: range.firstRow, lastRow: range.lastRow, columnsOf: () => ({ first: range.first, last: range.last }) }
  }
  const pitch = rowPitchPx(weave.technique, weave.cell)
  return {
    firstRow: Math.ceil((area.top - cellSizePx(weave.technique, weave.cell).height) / pitch),
    lastRow: Math.floor(area.bottom / pitch),
    columnsOf: (row) => {
      const shift = rowShiftPx(weave, row)
      return {
        first: Math.ceil((area.left - shift - CELL_SIZE_PX) / CELL_SIZE_PX),
        last: Math.floor((area.right - shift) / CELL_SIZE_PX),
      }
    },
  }
}


/** The beads in view of a space: with no edge on the Canvas, and within the Project otherwise. `origin` is where the
 * layer's first position sits in the space's grid px (a Frame laid over the Canvas, ticket 492). */
function visibleBeadsInSpace(weave: Weave, space: Space, region: Region, zoom: number, rotation: Rotation, origin: { x: number; y: number } = { x: 0, y: 0 }): ReturnType<typeof visibleBeads> {
  const seen = regionInGridSpace(space.extent, region, zoom, rotation)
  const area = { left: seen.left - origin.x, right: seen.right - origin.x, top: seen.top - origin.y, bottom: seen.bottom - origin.y }
  return space.open ? visibleBeadsOpen(weave, area) : visibleBeads(weave, space.columns, space.rows, area)
}

/** The parts of a Project the renderer reads. */
export type DrawnProject = Pick<Project, 'technique' | 'brickBlock' | 'netSize' | 'beads' | 'frame' | 'rowProgress' | 'rotation' | 'pieceNames'> & Partial<Pick<Project, 'beadId' | 'beadShape'>>

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
 * take in its drawn extent where it is woven otherwise and so draws larger or smaller than that. */
function frameFootprintPx(project: Pick<DrawnProject, 'technique' | 'brickBlock' | 'netSize' | 'frame' | 'beadId' | 'beadShape'>, margin = 0): Region | undefined {
  const frame = project.frame
  if (!frame) {
    return undefined
  }
  const canvas = canvasWeave(project)
  // With a `margin` the box also takes in the keep-out margin (ticket 501), which the Canvas draws nothing in.
  const grown = withMargin(footprintOf(project)!, margin)
  const claimed = positionsBoxPx(canvas, grown.row, grown.column, grown.rows, grown.columns)
  const own = describeWeave(canvas).countsUnits
    ? claimed
    : {
        x: grown.column * CELL_SIZE_PX,
        y: rowTopPx(canvas.technique, grown.row, canvas.cell),
        width: projectExtentPx(canvas.technique, grown.columns, grown.rows, canvas.cell).width,
        height: projectExtentPx(canvas.technique, grown.columns, grown.rows, canvas.cell).height,
      }
  if (sameWeave(canvas, frame)) {
    return own
  }
  const origin = frameOriginPx(canvas, frame)
  const drawn = layerExtentPx(frame, frame.columns, frame.rows)
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
  const pattern = positionMarkPattern(context, { technique: project.technique, brickBlock: project.brickBlock, netSize: project.netSize, cell: projectCell(project), deviceScale: zoom * pixelRatio, pixelRatio, color: theme.positionMark })
  if (!pattern) {
    return
  }
  const cellHeight = cellSizePx(project.technique, projectCell(project)).height
  const pitch = rowPitchPx(project.technique, projectCell(project))
  const box = project.frame && withMargin(footprintOf(project)!, margin)
  // The margin's box, between the marks just outside it: marks sit at the middle of each bead's cell, a row's shift
  // moves them half a bead right.
  const footprint = frameFootprintPx(project)
  const held = frameFootprintPx(project, margin)
  const units = describeWeave(project).countsUnits
  const alike = project.frame !== undefined && sameWeave(canvasWeave(project), project.frame)
  const hole =
    box && held &&
    (units || !alike
      ? { left: held.x, right: held.x + held.width, top: held.y, bottom: held.y + held.height }
      : {
          left: box.column * CELL_SIZE_PX + CELL_SIZE_PX / 4,
          right: (box.column + box.columns) * CELL_SIZE_PX + CELL_SIZE_PX / 4,
          top: box.row * pitch + cellHeight / 2 - pitch / 2,
          bottom: (box.row + box.rows - 1) * pitch + cellHeight / 2 + pitch / 2,
        })
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
  if (footprint && !(project.frame && frameLayoutOf(project.frame))) {
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

/** The Frame's cells, bead or empty bead, in the Frame's own Weave, from the context's origin (ticket 492). `origin` is
 * where its first position sits in grid px. `space` is the Frame on its own: its positions counted from 0, and
 * `toAbsolute` the address of its first. */
function drawFrameLayer(context: DrawingContext, draw: LayerDraw, space: Space, origin: { x: number; y: number }): void {
  const { project, zoom, pixelRatio, look, drawBead, rowMarks, showFinished, rows: band, letters } = draw
  const weave = frameWeave(project)
  const placed = project.frame && placedLayout(project.frame, weave)
  if (placed) {
    drawCustomFrame(context, draw, placed, origin)
    return
  }
  const description = describeWeave(weave)
  const cornerRadius = beadRoundness(weave.technique, weave.cell) * CELL_SIZE_PX
  const { area } = draw
  const visible = visibleBeads(weave, space.columns, space.rows, { left: area.left - origin.x, right: area.right - origin.x, top: area.top - origin.y, bottom: area.bottom - origin.y })
  const firstRow = band ? Math.max(visible.firstRow, band.first - 1) : visible.firstRow
  const lastRow = band ? Math.min(visible.lastRow, band.last + 1) : visible.lastRow
  const own = { row: 0, column: 0, rows: space.rows, columns: space.columns }
  // The current row's beads are drawn 10% brighter than the todo rows (ticket 352); an empty cell is left as it is
  // (ticket 411).
  const lightenCurrent = (color: string | null, position: GridPosition): string | null =>
    color !== null && rowMarks && isInCurrentRow(project, position) ? brighten(color, CURRENT_ROW_BRIGHTNESS) : color
  for (let row = Math.max(firstRow, 0); row <= Math.min(lastRow, space.rows - 1); row += 1) {
    const { first, last } = visible.columnsOf(row)
    for (let column = Math.max(first, 0); column <= Math.min(last, space.columns - 1); column += 1) {
      // The last column of a Frame's horizontal lines holds no bead (Right-angle weave).
      if (!description.hasPosition({ row, column }, own)) {
        continue
      }
      const position = { row: space.toAbsolute.row + row, column: space.toAbsolute.column + column }
      const box = positionBoxPx(weave, row, column)
      const painted = beadInSpace(project, space, row, column)
      const dimmed = rowMarks && !showFinished && isInFinishedRow(project, position)
      const sized = box.width !== CELL_SIZE_PX || box.height !== CELL_SIZE_PX ? { width: box.width, height: box.height } : {}
      drawBead(context, {
        x: origin.x + box.x,
        y: origin.y + box.y,
        size: CELL_SIZE_PX,
        ...sized,
        cornerRadius,
        color: lightenCurrent(painted, position),
        dimmed,
        deviceScale: zoom * pixelRatio,
        theme: look,
      })
      const letter = painted === null ? undefined : letters?.[painted]
      if (painted !== null && letter) {
        drawBeadLetter(context, { x: origin.x + box.x, y: origin.y + box.y, size: CELL_SIZE_PX, ...sized, color: painted, letter, dimmed, theme: look })
      }
    }
  }
}

/** A Custom frame (ADR 0077, ticket 0592): every position of its layout at its centre, turned to its panel's angle, in
 * the Project's Bead shape, and its Seams as thin lines between panels and parts. What lies round the shape is
 * left as it is: the Canvas's colour, no position marks. It has no Row order yet, so no row is faded or lit. */
function drawCustomFrame(context: DrawingContext, draw: LayerDraw, placed: PlacedLayout, origin: { x: number; y: number }): void {
  const { project, zoom, pixelRatio, look, drawBead, letters } = draw
  const weave = frameWeave(project)
  const beads = project.frame!.beads
  const box = centredBead(placed)
  const cornerRadius = beadRoundness(weave.technique, weave.cell) * placed.scale
  context.save()
  context.translate(origin.x, origin.y)
  // The beads are turned, so their bitmaps are smoothed as they are laid down.
  context.imageSmoothingEnabled = true
  for (const position of placed.layout.positions) {
    const at = layoutPointPx(placed, position)
    const painted = beads[position.row]?.[position.column] ?? null
    context.save()
    context.translate(at.x, at.y)
    context.rotate(position.angle)
    drawBead(context, { ...box, size: placed.scale, cornerRadius, color: painted, dimmed: false, deviceScale: zoom * pixelRatio, theme: look })
    const letter = painted === null ? undefined : letters?.[painted]
    if (painted !== null && letter) {
      drawBeadLetter(context, { ...box, size: placed.scale, color: painted, letter, dimmed: false, theme: look })
    }
    context.restore()
  }
  context.imageSmoothingEnabled = false
  context.beginPath()
  for (const [from, to] of placed.layout.seams) {
    const start = layoutPointPx(placed, from)
    const end = layoutPointPx(placed, to)
    context.moveTo(start.x, start.y)
    context.lineTo(end.x, end.y)
  }
  context.strokeStyle = look.pieceLine
  context.lineWidth = SEAM_WIDTH_PX
  context.stroke()
  context.restore()
}

/** A Seam's width in grid px: a hairline at 100%. */
const SEAM_WIDTH_PX = 1

/** The Canvas's beads, bead by bead, with the Frame's footprint cut out so none shows over it. */
function drawCanvasLayer(context: DrawingContext, draw: LayerDraw, space: Space): void {
  const { project, region, zoom, pixelRatio, look, drawBead, area, rows: band, margin } = draw
  const { beads, frame, rotation } = project
  const covered = footprintOf(project)
  const weave = canvasWeave(project)
  const description = describeWeave(weave)
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
      // The last column of a line's horizontal beads holds no bead (Right-angle weave).
      if (!description.hasPosition({ row, column }, frame)) {
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

// Draws the part of the Project in the region, clearing it first. Differs by space only in the background (Frame-only
// fills it, the Canvas stays transparent and fades finished rows) and in what is drawn: the Canvas's beads with the
// Frame laid over them in its own Weave, or the Frame alone.
export function renderProject(context: DrawingContext, input: RenderInput): void {
  const { project, space, region, zoom, pixelRatio = 1, theme = DEFAULT_THEME, drawBead = drawFlatBead, rows, showFinished = false, rowMarks = rowProgressOn(input.project), margin = MARGIN, letters } = input
  const { frame, rotation } = project
  const { extent } = space
  // A finished row fades toward what is behind it, which on the Canvas is the drawing area, not a board.
  const look: ProjectTheme = space.open ? { ...theme, background: theme.canvas } : theme
  // A band of rows is the same rows of both layers only where they are woven alike.
  const alike = !space.open || !frame || sameWeave(canvasWeave(project), frame)
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
      const origin = frameOriginPx(canvasWeave(project), frame)
      const sheet = spaceOf(project, false)
      // The band's rows are the Canvas's; the Frame's own are counted from its first (alike weaves only).
      drawFrameLayer(context, { ...draw, rows: band && { first: band.first - frame.row, last: band.last - frame.row } }, sheet, origin)
    }
  } else if (space.hasFrame) {
    drawFrameLayer(context, draw, space, { x: 0, y: 0 })
  }

  if (band) {
    context.restore()
  }
}
