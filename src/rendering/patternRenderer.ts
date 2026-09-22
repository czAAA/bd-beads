import { CELL_SIZE_PX, isOffsetTechnique, type Technique } from '../domain/grid'
import { isInFinishedRow, type Pattern } from '../domain/pattern'
import {
  DEFAULT_THEME,
  DIMMED_OPACITY,
  drawFlatBead,
  greyscale,
  type BeadDrawer,
  type DrawingContext,
  type PatternTheme,
} from './beadLook'

/**
 * The Pattern renderer (CONTEXT.md, ADR 0018): the one thing that draws a Pattern's beads onto a drawing surface, for
 * any Technique, so a bead looks the same in the editor, the Convert image preview and the exports.
 *
 * It draws the cells only (what the Drawing surface calls its base layer). Everything that comes and goes with the
 * pointer, and the Row progress marker, is drawn over this by the overlay layer.
 *
 * Coordinates. A Pattern has its own space, "grid space": px at zoom 1 with the origin at the top-left of the beads,
 * a bead being CELL_SIZE_PX square. What a person sees is that space scaled by the zoom and, when the Pattern is
 * rotated, turned 90° clockwise. The region asked for is in that displayed space, measured from the displayed Pattern's
 * top-left, so a surface that follows the scroll asks for whatever part is in view and the cost follows what is drawn
 * rather than how big the Pattern is.
 */

/** Brick stitch's seam between rows, in grid px: a rule the full width of the row that takes 1px of height of its own. */
export const SEAM_PX = 1

/** How much of a bead's width its corners are rounded by, per Technique: peyote's 30%, as the grid of elements had them; loom and brick stitch are square. The one place the look is decided: the hit-test and the overlay read it too. */
export function beadRoundness(technique: Technique): number {
  return technique === 'peyote' ? 0.3 : 0
}

/**
 * The distance from one row's top to the next, in grid px. Peyote rows nest into each other, so they sit closer than a
 * bead is tall; brick stitch rows are a full bead apart plus their seam; loom rows stack.
 *
 * Deliberately not `rowHeightPx` in domain/grid: that is the height the layout maths (the rulers, the box around the
 * Pattern) has always used, and it leaves out the seam's pixel, so for brick stitch the DOM grid has always been a
 * pixel per row taller than that maths says. This is what was actually drawn, and the renderer keeps to it.
 */
export function rowPitchPx(technique: Technique): number {
  if (technique === 'peyote') {
    return CELL_SIZE_PX * 0.75
  }
  return technique === 'brick' ? CELL_SIZE_PX + SEAM_PX : CELL_SIZE_PX
}

/** Where a row's beads start from the top of the Pattern, in grid px. */
export function rowTopPx(technique: Technique, row: number): number {
  return row * rowPitchPx(technique)
}

/** How far a row's beads are shifted sideways, in grid px: every other row in peyote and brick stitch, by half a bead. */
export function rowShiftPx(technique: Technique, row: number): number {
  return isOffsetTechnique(technique) && row % 2 === 1 ? CELL_SIZE_PX / 2 : 0
}

export interface Extent {
  width: number
  height: number
}

/** The size of the drawn Pattern in grid px, before zoom and rotation. */
export function patternExtentPx(technique: Technique, columns: number, rows: number): Extent {
  return {
    width: columns * CELL_SIZE_PX + (isOffsetTechnique(technique) ? CELL_SIZE_PX / 2 : 0),
    height: rows === 0 ? 0 : rowTopPx(technique, rows - 1) + CELL_SIZE_PX,
  }
}

/** The size of the drawn Pattern as displayed: scaled by the zoom, and swapped when it is turned on its side. */
export function displayedExtentPx(technique: Technique, columns: number, rows: number, zoom: number, rotated: boolean): Extent {
  const { width, height } = patternExtentPx(technique, columns, rows)
  return rotated ? { width: height * zoom, height: width * zoom } : { width: width * zoom, height: height * zoom }
}

export interface Region {
  x: number
  y: number
  width: number
  height: number
}

/** The transform from grid space to the displayed region's own coordinates (see the note at the top): zoom, then rotation, then moving the region to the origin. */
export function gridToRegion(extent: Extent, region: Region, zoom: number, rotated: boolean): [number, number, number, number, number, number] {
  // Rotating 90° clockwise carries the grid point (x, y) to (height − y, x).
  return rotated
    ? [0, zoom, -zoom, 0, extent.height * zoom - region.x, -region.y]
    : [zoom, 0, 0, zoom, -region.x, -region.y]
}

/** Sets the context's transform to draw in grid space, on a surface showing `region` of the displayed Pattern, on a screen of the given pixel density. */
export function setGridTransform(
  context: DrawingContext,
  extent: Extent,
  region: Region,
  zoom: number,
  rotated: boolean,
  pixelRatio: number,
): void {
  const [a, b, c, d, e, f] = gridToRegion(extent, region, zoom, rotated)
  context.setTransform(a * pixelRatio, b * pixelRatio, c * pixelRatio, d * pixelRatio, e * pixelRatio, f * pixelRatio)
}

/** The part of grid space a displayed region covers. */
function regionInGridSpace(extent: Extent, region: Region, zoom: number, rotated: boolean): { left: number; right: number; top: number; bottom: number } {
  if (rotated) {
    return {
      left: region.y / zoom,
      right: (region.y + region.height) / zoom,
      top: extent.height - (region.x + region.width) / zoom,
      bottom: extent.height - region.x / zoom,
    }
  }
  return {
    left: region.x / zoom,
    right: (region.x + region.width) / zoom,
    top: region.y / zoom,
    bottom: (region.y + region.height) / zoom,
  }
}

/** The beads that touch the region of the displayed Pattern, for whatever else is drawn only where it can be seen (the overlay's Selection and dimming). */
export function visibleBeadsIn(
  pattern: Pick<DrawnPattern, 'technique' | 'columns' | 'rows' | 'rotated'>,
  region: Region,
  zoom: number,
): ReturnType<typeof visibleBeads> {
  const extent = patternExtentPx(pattern.technique, pattern.columns, pattern.rows)
  return visibleBeads(pattern.technique, pattern.columns, pattern.rows, regionInGridSpace(extent, region, zoom, pattern.rotated))
}

/** The rows and, for each, the columns of beads that touch a stretch of grid space. Exported for the tests; the renderer's own way of skipping what is off screen. */
export function visibleBeads(
  technique: Technique,
  columns: number,
  rows: number,
  area: { left: number; right: number; top: number; bottom: number },
): { firstRow: number; lastRow: number; columnsOf: (row: number) => { first: number; last: number } } {
  const pitch = rowPitchPx(technique)
  // A bead reaches CELL_SIZE_PX below its row's top, and a seam a pixel above it, so ask for a little more either side.
  const firstRow = Math.max(0, Math.ceil((area.top - CELL_SIZE_PX) / pitch))
  const lastRow = Math.min(rows - 1, Math.floor((area.bottom + SEAM_PX) / pitch))

  return {
    firstRow,
    lastRow,
    columnsOf: (row) => {
      const shift = rowShiftPx(technique, row)
      return {
        first: Math.max(0, Math.ceil((area.left - shift - CELL_SIZE_PX) / CELL_SIZE_PX)),
        last: Math.min(columns - 1, Math.floor((area.right - shift) / CELL_SIZE_PX)),
      }
    },
  }
}

/** The parts of a Pattern the renderer reads. */
export type DrawnPattern = Pick<Pattern, 'technique' | 'columns' | 'rows' | 'grid' | 'rowProgress' | 'rotated'>

export interface RenderInput {
  /** The Pattern to draw: its grid, Technique, rotation and Row progress (finished rows are drawn faded). Anything shaped like one will do: the Convert image preview draws a block of beads that is not a saved Pattern. */
  pattern: DrawnPattern
  /** The part of the displayed Pattern to draw, in displayed px from its top-left corner. The surface is this big. */
  region: Region
  /** How much the Pattern is enlarged by; 1 is a bead 20px across. */
  zoom: number
  /** Device pixels per CSS pixel of the surface, so beads stay crisp on a high-density screen. Defaults to 1. */
  pixelRatio?: number
  theme?: PatternTheme
  /**
   * Draw only these rows again, and what they touch, leaving the rest of the surface as it is: what an edit that changed
   * a few beads needs, in place of drawing every bead on screen. Everything in the band the rows occupy is cleared and
   * drawn afresh, so the result is what drawing the whole surface would have made, and repeated edits do not pile up the
   * anti-aliasing at the edges of rounded beads.
   */
  rows?: { first: number; last: number }
  /** How one bead is drawn. Defaults to today's look; a richer one is handed in here, and never has to know about rows, zoom, rotation or what is on screen. */
  drawBead?: BeadDrawer
}

/** Whether a whole row is faded, so its brick seam is: the row-wise Row progress fades rows, the column-wise one fades beads down a column and leaves seams alone. */
function isRowFinished(pattern: DrawnPattern, row: number): boolean {
  return pattern.rowProgress.direction === 'rows' && isInFinishedRow(pattern, { row, column: 0 })
}

/**
 * The band of the surface, in its device pixels and on whole pixels, that rows `first` to `last` of the Pattern occupy:
 * from a brick seam above the first to the bottom of the last, across the whole Pattern.
 */
function bandOnSurface(
  extent: Extent,
  region: Region,
  zoom: number,
  rotated: boolean,
  pixelRatio: number,
  technique: Technique,
  rows: { first: number; last: number },
): Region {
  const top = rowTopPx(technique, rows.first) - (technique === 'brick' && rows.first > 0 ? SEAM_PX : 0)
  const bottom = rowTopPx(technique, rows.last) + CELL_SIZE_PX
  const [a, b, c, d, e, f] = gridToRegion(extent, region, zoom, rotated)

  const corners = [
    [0, top],
    [extent.width, top],
    [0, bottom],
    [extent.width, bottom],
  ].map(([x, y]) => [(a * x! + c * y! + e) * pixelRatio, (b * x! + d * y! + f) * pixelRatio] as const)

  const left = Math.max(0, Math.floor(Math.min(...corners.map(([x]) => x))))
  const upper = Math.max(0, Math.floor(Math.min(...corners.map(([, y]) => y))))
  const right = Math.min(region.width * pixelRatio, Math.ceil(Math.max(...corners.map(([x]) => x))))
  const lower = Math.min(region.height * pixelRatio, Math.ceil(Math.max(...corners.map(([, y]) => y))))
  return { x: left, y: upper, width: Math.max(0, right - left), height: Math.max(0, lower - upper) }
}

/** Draws the part of the Pattern in the region. Clears what was there first; the surface can be redrawn in place. */
export function renderPattern(context: DrawingContext, input: RenderInput): void {
  const { pattern, region, zoom, pixelRatio = 1, theme = DEFAULT_THEME, drawBead = drawFlatBead, rows: band } = input
  const { technique, grid, columns, rows } = pattern
  const rotated = pattern.rotated
  const extent = patternExtentPx(technique, columns, rows)

  // The backing store is in device px: clear and paint the background there (the whole surface, or just the band being
  // drawn again, which the rest of the drawing is then cut to), then draw in CSS px scaled up to it.
  context.setTransform(1, 0, 0, 1, 0, 0)
  const cleared = band ? bandOnSurface(extent, region, zoom, rotated, pixelRatio, technique, band) : { x: 0, y: 0, width: region.width * pixelRatio, height: region.height * pixelRatio }
  if (band) {
    context.save()
    context.beginPath()
    context.rect(cleared.x, cleared.y, cleared.width, cleared.height)
    context.clip()
  }
  context.clearRect(cleared.x, cleared.y, cleared.width, cleared.height)
  context.fillStyle = theme.background
  context.fillRect(cleared.x, cleared.y, cleared.width, cleared.height)

  setGridTransform(context, extent, region, zoom, rotated, pixelRatio)
  // Bitmaps of beads are made at the size they are on the screen, so they are blitted as they are, not resampled.
  context.imageSmoothingEnabled = false

  const visible = visibleBeads(technique, columns, rows, regionInGridSpace(extent, region, zoom, rotated))
  const cornerRadius = beadRoundness(technique) * CELL_SIZE_PX
  // A band's rows, and the row either side: the one above has its bottom under the band's first row, and the one below
  // is drawn over the band's last.
  const firstRow = band ? Math.max(visible.firstRow, band.first - 1) : visible.firstRow
  const lastRow = band ? Math.min(visible.lastRow, band.last + 1) : visible.lastRow

  for (let row = firstRow; row <= lastRow; row += 1) {
    const top = rowTopPx(technique, row)
    const shift = rowShiftPx(technique, row)

    if (technique === 'brick' && row > 0) {
      drawSeam(context, shift, top - SEAM_PX, columns * CELL_SIZE_PX, isRowFinished(pattern, row), theme)
    }

    const { first, last } = visible.columnsOf(row)
    for (let column = first; column <= last; column += 1) {
      drawBead(context, {
        x: shift + column * CELL_SIZE_PX,
        y: top,
        size: CELL_SIZE_PX,
        cornerRadius,
        color: grid[row]?.[column]?.color ?? null,
        dimmed: isInFinishedRow(pattern, { row, column }),
        deviceScale: zoom * pixelRatio,
        theme,
      })
    }
  }

  if (band) {
    context.restore()
  }
}

function drawSeam(context: DrawingContext, x: number, y: number, width: number, dimmed: boolean, theme: PatternTheme): void {
  context.save()
  context.globalAlpha = dimmed ? DIMMED_OPACITY : 1
  context.fillStyle = dimmed ? greyscale(theme.seam) : theme.seam
  context.fillRect(x, y, width, SEAM_PX)
  context.restore()
}
