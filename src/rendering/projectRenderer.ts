import type { Rotation, Technique } from '../domain/grid'
import { colorAt, frameContains } from '../domain/canvas'
import { inMargin } from '../domain/margin'
import { isInFinishedRow, type Project } from '../domain/project'
import {
  beadRoundness,
  DEFAULT_THEME,
  drawFlatBead,
  finishedColor,
  type BeadDrawer,
  type DrawingContext,
  type ProjectTheme,
} from './beadLook'
import type { Space } from './space'
import {
  CELL_SIZE_PX,
  gridToRegion,
  regionInGridSpace,
  rowPitchPx,
  rowShiftPx,
  rowTopPx,
  SEAM_PX,
  setGridTransform,
  shiftOf,
  type Region,
} from './surfaceView'

/**
 * The Project renderer (CONTEXT.md, ADR 0018): the one thing that draws a Project's beads onto a drawing surface, for
 * any Technique, so a bead looks the same in the editor, the Convert image preview and the exports.
 *
 * It draws the cells only (what the Drawing surface calls its base layer). Everything that comes and goes with the
 * pointer, and the Row progress marker, is drawn over this by the overlay layer.
 *
 * Coordinates. A Project has its own space, "grid space": px at zoom 1 with the origin at the top-left of the beads,
 * a bead being CELL_SIZE_PX square. What a person sees is that space scaled by the zoom and turned clockwise by the
 * Project's rotation (0°/90°/180°/270°, ticket 171). The region asked for is in that displayed space, measured from
 * the displayed Project's top-left, so a surface that follows the scroll asks for whatever part is in view and the
 * cost follows what is drawn rather than how big the Project is.
 *
 * One renderer over two spaces (ADR 0018, ADR 0026): a `Space` (space.ts) says whether the Project is drawn on its own,
 * as the Frame alone with its first bead at the origin (the exports, the Convert image preview, the Overview), or on
 * the open canvas, an endless field of positions measured from row 0, column 0 (the editor).
 */

/**
 * The rows and, for each, the columns of beads that touch a stretch of grid space. Exported for the tests; the renderer's
 * own way of skipping what is off screen. `firstRow` is the Project's own number for the first row drawn, which is what
 * decides which rows are shifted.
 */
export function visibleBeads(
  technique: Technique,
  columns: number,
  rows: number,
  area: { left: number; right: number; top: number; bottom: number },
  firstRow = 0,
): { firstRow: number; lastRow: number; columnsOf: (row: number) => { first: number; last: number } } {
  const pitch = rowPitchPx(technique)
  // A bead reaches CELL_SIZE_PX below its row's top, and a seam a pixel above it, so ask for a little more either side.
  const topRow = Math.max(0, Math.ceil((area.top - CELL_SIZE_PX) / pitch))
  const bottomRow = Math.min(rows - 1, Math.floor((area.bottom + SEAM_PX) / pitch))

  return {
    firstRow: topRow,
    lastRow: bottomRow,
    columnsOf: (row) => {
      const shift = rowShiftPx(technique, firstRow + row)
      return {
        first: Math.max(0, Math.ceil((area.left - shift - CELL_SIZE_PX) / CELL_SIZE_PX)),
        last: Math.min(columns - 1, Math.floor((area.right - shift) / CELL_SIZE_PX)),
      }
    },
  }
}

/**
 * The beads that touch a stretch of grid space on an open canvas (ADR 0026): the same maths as visibleBeads with no
 * edge to stop at, so rows and columns may be negative.
 */
function visibleBeadsOpen(
  technique: Technique,
  area: { left: number; right: number; top: number; bottom: number },
): ReturnType<typeof visibleBeads> {
  const pitch = rowPitchPx(technique)
  return {
    firstRow: Math.ceil((area.top - CELL_SIZE_PX) / pitch),
    lastRow: Math.floor((area.bottom + SEAM_PX) / pitch),
    columnsOf: (row) => {
      const shift = rowShiftPx(technique, row)
      return {
        first: Math.ceil((area.left - shift - CELL_SIZE_PX) / CELL_SIZE_PX),
        last: Math.floor((area.right - shift) / CELL_SIZE_PX),
      }
    },
  }
}


/** The beads in view of a space: with no edge on the open canvas, and within the Project otherwise. */
export function visibleBeadsInSpace(technique: Technique, space: Space, region: Region, zoom: number, rotation: Rotation): ReturnType<typeof visibleBeads> {
  const area = regionInGridSpace(space.extent, region, zoom, rotation)
  return space.open ? visibleBeadsOpen(technique, area) : visibleBeads(technique, space.columns, space.rows, area, space.toAbsolute.row)
}

/** The parts of a Project the renderer reads. */
export type DrawnProject = Pick<Project, 'technique' | 'beads' | 'frame' | 'rowProgress' | 'rotation'>

export interface RenderInput {
  /** The Project to draw: its beads, Frame, Technique, rotation and Row progress (finished rows are drawn faded). Anything shaped like one will do: the Convert image preview draws a block of beads that is not a saved Project. */
  project: DrawnProject
  /** Where its positions live, from `spaceOf`: handed to the overlay as well, so both agree where a position is. */
  space: Space
  /** The part of the displayed Project to draw, in displayed px: from its top-left corner in Frame-only space, how far the canvas has been moved on the open canvas. The surface is this big. */
  region: Region
  /** How much the Project is enlarged by; 1 is a bead 20px across. */
  zoom: number
  /** Device pixels per CSS pixel of the surface, so beads stay crisp on a high-density screen. Defaults to 1. */
  pixelRatio?: number
  theme?: ProjectTheme
  /**
   * Draw only these rows (numbered in the space) again, and what they touch, leaving the rest of the surface as it is:
   * what an edit that changed a few beads needs, in place of drawing every bead on screen. Everything in the band the
   * rows occupy is cleared and drawn afresh, so the result is what drawing the whole surface would have made, and
   * repeated edits do not pile up the anti-aliasing at the edges of rounded beads.
   */
  rows?: { first: number; last: number }
  /** How one bead is drawn. Defaults to today's look; a richer one is handed in here, and never has to know about rows, zoom, rotation or what is on screen. */
  drawBead?: BeadDrawer
}

/** The dot that marks an empty position outside a Frame: 1.5px across on screen (BeadBoard card). */
const DOT_DIAMETER_PX = 1.5

/** Whether a brick seam runs above this row of the space: between two rows of the Frame, so never on an open canvas with no Frame. */
function seamAbove(technique: Technique, space: Space, row: number): boolean {
  return technique === 'brick' && space.hasFrame && row > space.origin.row && row < space.origin.row + space.rows
}

/**
 * The band of the surface, in its device pixels and on whole pixels, that rows `first` to `last` occupy: from a brick
 * seam above the first to the bottom of the last, across the whole Project, or the whole viewport on the open canvas.
 */
function bandOnSurface(
  space: Space,
  region: Region,
  zoom: number,
  rotation: Rotation,
  pixelRatio: number,
  technique: Technique,
  rows: { first: number; last: number },
): Region {
  const top = rowTopPx(technique, rows.first) - (seamAbove(technique, space, rows.first) ? SEAM_PX : 0)
  const bottom = rowTopPx(technique, rows.last) + CELL_SIZE_PX
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

/**
 * Draws the part of the Project in the region. Clears what was there first; the surface can be redrawn in place.
 *
 * What differs by space, and only this: the background (Frame-only fills the theme's background; the open canvas stays
 * transparent for the technique word behind it, and finished rows fade toward the drawing area), and empty positions
 * (the open canvas draws the dots outside the Frame, and leaves the Frame's keep-out margin as a gap).
 */
export function renderProject(context: DrawingContext, input: RenderInput): void {
  const { project, space, region, zoom, pixelRatio = 1, theme = DEFAULT_THEME, drawBead = drawFlatBead, rows: band } = input
  const { technique, beads, frame, rotation } = project
  const { extent, origin } = space
  // A finished row fades toward what is behind it, which on the open canvas is the drawing area, not a board.
  const look: ProjectTheme = space.open ? { ...theme, background: theme.canvas } : theme

  // The backing store is in device px: clear (and paint the background, in Frame-only space) there, the whole surface or
  // just the band being drawn again, which the rest of the drawing is then cut to, then draw in CSS px scaled up to it.
  context.setTransform(1, 0, 0, 1, 0, 0)
  const cleared = band
    ? bandOnSurface(space, region, zoom, rotation, pixelRatio, technique, band)
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

  const visible = visibleBeadsInSpace(technique, space, region, zoom, rotation)
  const cornerRadius = beadRoundness(technique) * CELL_SIZE_PX
  // A band's rows, and the row either side: the one above has its bottom under the band's first row, and the one below
  // is drawn over the band's last.
  const firstRow = band ? Math.max(visible.firstRow, band.first - 1) : visible.firstRow
  const lastRow = band ? Math.min(visible.lastRow, band.last + 1) : visible.lastRow

  const dotRadius = DOT_DIAMETER_PX / 2 / zoom
  const dots: [number, number][] = []

  for (let row = firstRow; row <= lastRow; row += 1) {
    const top = rowTopPx(technique, row)
    const shift = shiftOf(space, technique, row)

    if (seamAbove(technique, space, row)) {
      // Whether the seam is faded is asked of a position inside the Frame: the row-wise Row progress fades rows, the column-wise one fades beads down a column and leaves seams alone.
      const inside = { row: space.toAbsolute.row + row, column: space.toAbsolute.column + origin.column }
      drawSeam(context, shift + origin.column * CELL_SIZE_PX, top - SEAM_PX, space.columns * CELL_SIZE_PX, project.rowProgress.direction === 'rows' && isInFinishedRow(project, inside), look)
    }

    const { first, last } = visible.columnsOf(row)
    for (let column = first; column <= last; column += 1) {
      const position = { row: space.toAbsolute.row + row, column: space.toAbsolute.column + column }
      const color = colorAt(beads, position.row, position.column)
      if (space.open && color === null && !(frame && frameContains(frame, position))) {
        // The Frame's keep-out margin is a gap in the dots (ticket 276), flat, with nothing drawn in it.
        if (!inMargin(frame, position)) {
          dots.push([shift + column * CELL_SIZE_PX + CELL_SIZE_PX / 2, top + CELL_SIZE_PX / 2])
        }
        continue
      }
      drawBead(context, {
        x: shift + column * CELL_SIZE_PX,
        y: top,
        size: CELL_SIZE_PX,
        cornerRadius,
        color,
        dimmed: isInFinishedRow(project, position),
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

function drawSeam(context: DrawingContext, x: number, y: number, width: number, dimmed: boolean, theme: ProjectTheme): void {
  context.fillStyle = dimmed ? finishedColor(theme.seam, theme) : theme.seam
  context.fillRect(x, y, width, SEAM_PX)
}
