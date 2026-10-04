import { colorAt, frameContains, type Frame } from '../domain/canvas'
import { MARGIN, withMargin } from '../domain/margin'
import { CELL_SIZE_PX, type Rotation, type Technique } from '../domain/grid'
import { isInFinishedRow } from '../domain/project'
import { DEFAULT_THEME, drawFlatBead, type BeadDrawer, type DrawingContext, type ProjectTheme } from './beadLook'
import {
  beadRoundness,
  drawSeam,
  gridToRegion,
  regionInGridSpace,
  rowShiftPx,
  rowTopPx,
  setGridTransform,
  SEAM_PX,
  visibleBeadsOpen,
  type DrawnProject,
  type Extent,
  type Region,
} from './projectRenderer'

/**
 * The open canvas renderer (ADR 0026): draws the part of an endless field of bead positions that a viewport shows.
 *
 * It speaks the Project renderer's language of grid space (px at zoom 1, a bead's own row and column) and displayed
 * space (turned by the Project's rotation, then zoomed), with one difference: an open canvas has no first bead to
 * measure from, so displayed space is measured from the bead at row 0, column 0 and its region may reach into the
 * negative. That is the Project renderer's own transform with an extent of nothing, which turns a quarter about the
 * origin instead of about a box.
 */
export const OPEN_EXTENT: Extent = { width: 0, height: 0 }

/** What a viewport onto the open canvas shows, in grid space: the inverse of the transform it is drawn through. */
export function viewArea(region: Region, zoom: number, rotation: Rotation): { left: number; right: number; top: number; bottom: number } {
  return regionInGridSpace(OPEN_EXTENT, region, zoom, rotation)
}

/** Sets the context to draw in grid space on a viewport onto the open canvas. */
export function setViewTransform(context: DrawingContext, region: Region, zoom: number, rotation: Rotation, pixelRatio: number): void {
  setGridTransform(context, OPEN_EXTENT, region, zoom, rotation, pixelRatio)
}

export interface CanvasRenderInput {
  /** The Project whose beads are drawn; its Frame decides where empty positions draw as full beads. */
  project: DrawnProject
  /** The viewport, in displayed px: x and y are how far the canvas has been moved, width and height the size of the surface. */
  region: Region
  zoom: number
  pixelRatio?: number
  theme?: ProjectTheme
  /** Draw only these rows again (an edit that changed a few); everything in their band is cleared and drawn afresh. */
  rows?: { first: number; last: number }
  drawBead?: BeadDrawer
}

/** The dot that marks an empty position outside a Frame: 1.5px across on screen (BeadBoard card). */
const DOT_DIAMETER_PX = 1.5

/**
 * The band of the surface, in device px on whole pixels, that rows `first` to `last` occupy across the whole viewport:
 * the open canvas version of the Project renderer's own band.
 */
function bandOnSurface(
  region: Region,
  zoom: number,
  rotation: Rotation,
  pixelRatio: number,
  technique: Technique,
  rows: { first: number; last: number },
): Region {
  const area = viewArea(region, zoom, rotation)
  const top = rowTopPx(technique, rows.first) - (technique === 'brick' ? SEAM_PX : 0)
  const bottom = rowTopPx(technique, rows.last) + CELL_SIZE_PX
  const [a, b, c, d, e, f] = gridToRegion(OPEN_EXTENT, region, zoom, rotation)

  const corners = [
    [area.left, top],
    [area.right, top],
    [area.left, bottom],
    [area.right, bottom],
  ].map(([x, y]) => [(a * x! + c * y! + e) * pixelRatio, (b * x! + d * y! + f) * pixelRatio] as const)

  const left = Math.max(0, Math.floor(Math.min(...corners.map(([x]) => x))))
  const upper = Math.max(0, Math.floor(Math.min(...corners.map(([, y]) => y))))
  const right = Math.min(region.width * pixelRatio, Math.ceil(Math.max(...corners.map(([x]) => x))))
  const lower = Math.min(region.height * pixelRatio, Math.ceil(Math.max(...corners.map(([, y]) => y))))
  return { x: left, y: upper, width: Math.max(0, right - left), height: Math.max(0, lower - upper) }
}

/** The faint shade over the Frame's keep-out margin (ticket 261): the dot's color at half strength, drawn under the beads and dots, one row at a time so it follows each row's own stagger. */
function drawMarginBand(context: DrawingContext, frame: Frame, row: number, shift: number, top: number, theme: ProjectTheme): void {
  const outer = withMargin(frame)
  if (row < outer.row || row >= outer.row + outer.rows) {
    return
  }
  const across = row >= frame.row && row < frame.row + frame.rows
  const spans = across
    ? [
        [outer.column, MARGIN],
        [frame.column + frame.columns, MARGIN],
      ]
    : [[outer.column, outer.columns]]
  context.save()
  context.globalAlpha = 0.5
  context.fillStyle = theme.dot
  for (const [column, count] of spans) {
    context.fillRect(shift + column! * CELL_SIZE_PX, top, count! * CELL_SIZE_PX, CELL_SIZE_PX)
  }
  context.restore()
}

/** Draws the beads of the open canvas in view, the dots of the empty positions round them, and the Frame's empty beads. Clears what was there first, leaving it transparent for the technique word behind. */
export function renderCanvas(context: DrawingContext, input: CanvasRenderInput): void {
  const { project, region, zoom, pixelRatio = 1, theme = DEFAULT_THEME, drawBead = drawFlatBead, rows: band } = input
  const { technique, beads, frame, rotation } = project
  // A finished row fades toward what is behind it, which on the open canvas is the drawing area, not a board.
  const look: ProjectTheme = { ...theme, background: theme.canvas }

  context.setTransform(1, 0, 0, 1, 0, 0)
  const cleared = band
    ? bandOnSurface(region, zoom, rotation, pixelRatio, technique, band)
    : { x: 0, y: 0, width: region.width * pixelRatio, height: region.height * pixelRatio }
  if (band) {
    context.save()
    context.beginPath()
    context.rect(cleared.x, cleared.y, cleared.width, cleared.height)
    context.clip()
  }
  context.clearRect(cleared.x, cleared.y, cleared.width, cleared.height)

  setViewTransform(context, region, zoom, rotation, pixelRatio)
  context.imageSmoothingEnabled = false

  const visible = visibleBeadsOpen(technique, viewArea(region, zoom, rotation))
  const cornerRadius = beadRoundness(technique) * CELL_SIZE_PX
  const firstRow = band ? Math.max(visible.firstRow, band.first - 1) : visible.firstRow
  const lastRow = band ? Math.min(visible.lastRow, band.last + 1) : visible.lastRow

  const dotRadius = DOT_DIAMETER_PX / 2 / zoom
  const dots: [number, number][] = []

  for (let row = firstRow; row <= lastRow; row += 1) {
    const top = rowTopPx(technique, row)
    const shift = rowShiftPx(technique, row)

    if (technique === 'brick' && frame && row > frame.row && row < frame.row + frame.rows) {
      drawSeam(context, shift + frame.column * CELL_SIZE_PX, top - SEAM_PX, frame.columns * CELL_SIZE_PX, project.rowProgress.direction === 'rows' && isInFinishedRow(project, { row, column: frame.column }), look)
    }

    if (frame) {
      drawMarginBand(context, frame, row, shift, top, look)
    }

    const { first, last } = visible.columnsOf(row)
    for (let column = first; column <= last; column += 1) {
      const color = colorAt(beads, row, column)
      if (color === null && !(frame && frameContains(frame, { row, column }))) {
        dots.push([shift + column * CELL_SIZE_PX + CELL_SIZE_PX / 2, top + CELL_SIZE_PX / 2])
        continue
      }
      drawBead(context, {
        x: shift + column * CELL_SIZE_PX,
        y: top,
        size: CELL_SIZE_PX,
        cornerRadius,
        color,
        dimmed: isInFinishedRow(project, { row, column }),
        deviceScale: zoom * pixelRatio,
        theme: look,
      })
    }
  }

  if (dots.length > 0) {
    context.fillStyle = theme.dot
    context.beginPath()
    for (const [x, y] of dots) {
      context.moveTo(x + dotRadius, y)
      context.arc(x, y, dotRadius, 0, Math.PI * 2)
    }
    context.fill()
  }

  if (band) {
    context.restore()
  }
}
