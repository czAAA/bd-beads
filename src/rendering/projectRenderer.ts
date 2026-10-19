import type { GridPosition, Rotation } from '../domain/grid'
import { beadRoundness, describeWeave, type Weave } from '../domain/weave'
import { frameContains } from '../domain/canvas'
import { MARGIN, withMargin } from '../domain/margin'
import { isInCurrentRow, isInFinishedRow, rowProgressOn, type Project } from '../domain/project'
import {
  BEAD_GAP_PX,
  brighten,
  CURRENT_ROW_BRIGHTNESS,
  DEFAULT_THEME,
  drawFlatBead,
  type BeadDrawer,
  type DrawingContext,
  type ProjectTheme,
} from './beadLook'
import { positionMarkPattern, type PositionMarkStyle } from './positionMarks'
import { beadInSpace, type Space } from './space'
import {
  CELL_SIZE_PX,
  cellSizePx,
  gridToRegion,
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

// The rows and columns of beads touching a stretch of grid space; `firstRow` decides which rows are shifted. Exported
// for tests.
export function visibleBeads(
  weave: Weave,
  columns: number,
  rows: number,
  area: { left: number; right: number; top: number; bottom: number },
  firstRow = 0,
): { firstRow: number; lastRow: number; columnsOf: (row: number) => { first: number; last: number } } {
  if (describeWeave(weave).countsUnits) {
    const range = visibleUnitBeads(weave, area)
    return {
      firstRow: Math.max(0, range.firstRow),
      lastRow: Math.min(rows - 1, range.lastRow),
      columnsOf: () => ({ first: Math.max(0, range.first), last: Math.min(columns - 1, range.last) }),
    }
  }
  const pitch = rowPitchPx(weave.technique)
  // A bead reaches CELL_SIZE_PX below its row's top, so ask for a little more below.
  const topRow = Math.max(0, Math.ceil((area.top - CELL_SIZE_PX) / pitch))
  const bottomRow = Math.min(rows - 1, Math.floor(area.bottom / pitch))

  return {
    firstRow: topRow,
    lastRow: bottomRow,
    columnsOf: (row) => {
      const shift = rowShiftPx(weave, firstRow + row)
      return {
        first: Math.max(0, Math.ceil((area.left - shift - CELL_SIZE_PX) / CELL_SIZE_PX)),
        last: Math.min(columns - 1, Math.floor((area.right - shift) / CELL_SIZE_PX)),
      }
    },
  }
}

// The positions of a Technique that counts Units touching a stretch of grid space (tickets 482, 485).
function visibleUnitBeads(weave: Weave, area: { left: number; right: number; top: number; bottom: number }) {
  const cell = cellSizePx(weave.technique)
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
  const pitch = rowPitchPx(weave.technique)
  return {
    firstRow: Math.ceil((area.top - CELL_SIZE_PX) / pitch),
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


/** The beads in view of a space: with no edge on the Canvas, and within the Project otherwise. */
export function visibleBeadsInSpace(weave: Weave, space: Space, region: Region, zoom: number, rotation: Rotation): ReturnType<typeof visibleBeads> {
  const area = regionInGridSpace(space.extent, region, zoom, rotation)
  return space.open ? visibleBeadsOpen(weave, area) : visibleBeads(weave, space.columns, space.rows, area, space.toAbsolute.row)
}

/** The parts of a Project the renderer reads. */
export type DrawnProject = Pick<Project, 'technique' | 'brickBlock' | 'netSize' | 'beads' | 'frame' | 'rowProgress' | 'rotation' | 'pieceNames'>

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
  /** How the Canvas draws its Position marks: the device's choice. Defaults to Dots. */
  positionMarks?: PositionMarkStyle
  // How many positions wide the keep-out margin is drawn (ticket 459): the surface widens it when zoomed out. Defaults
  // to `MARGIN`.
  margin?: number
  // How one bead is drawn. Defaults to today's look; a richer one is handed in here, and never has to know about rows,
  // zoom, rotation or what is on screen.
  drawBead?: BeadDrawer
}

// The Canvas's Position marks (CONTEXT.md): one pattern fill in up to four strips round the margin's box, so no
// position is tested. Dots mark only empty positions outside it; Squares also fill the Frame's box (ticket 458).
function drawPositionMarks(
  context: DrawingContext,
  { project, space, area, zoom, pixelRatio, theme, style, margin }: { project: DrawnProject; space: Space; style: PositionMarkStyle; margin: number; area: { left: number; right: number; top: number; bottom: number }; zoom: number; pixelRatio: number; theme: ProjectTheme },
): void {
  const pattern = positionMarkPattern(context, { style, technique: project.technique, brickBlock: project.brickBlock, netSize: project.netSize, deviceScale: zoom * pixelRatio, pixelRatio, color: theme.positionMark })
  if (!pattern) {
    return
  }
  const pitch = rowPitchPx(project.technique)
  const box = project.frame && withMargin(project.frame, margin)
  // The margin's box, between the marks just outside it: marks sit at the middle of each bead's cell, a row's shift
  // moves them half a bead right.
  const units = describeWeave(project).countsUnits
  const outer = box && units ? positionsBoxPx(space, project, box.row, box.column, box.rows, box.columns) : undefined
  const hole =
    box &&
    (outer
      ? { left: outer.x, right: outer.x + outer.width, top: outer.y, bottom: outer.y + outer.height }
      : {
          left: box.column * CELL_SIZE_PX + CELL_SIZE_PX / 4,
          right: (box.column + box.columns) * CELL_SIZE_PX + CELL_SIZE_PX / 4,
          top: box.row * pitch + CELL_SIZE_PX / 2 - pitch / 2,
          bottom: (box.row + box.rows - 1) * pitch + CELL_SIZE_PX / 2 + pitch / 2,
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
  if (style === 'squares' && project.frame) {
    // Squares are round every position, the Frame's own included (ticket 458): its cells' outlines show in the gaps
    // between its beads.
    const { column, row, columns, rows } = project.frame
    const edge = BEAD_GAP_PX / 2
    const shift = describeWeave(project).blockExtent(0, 0, CELL_SIZE_PX, CELL_SIZE_PX).width
    const own = units ? positionsBoxPx(space, project, row, column, rows, columns) : undefined
    strip(
      Math.max((own?.x ?? column * CELL_SIZE_PX) - edge, area.left),
      Math.max((own?.y ?? row * pitch) - edge, area.top),
      Math.min(own ? own.x + own.width + edge : (column + columns) * CELL_SIZE_PX + shift + edge, area.right),
      Math.min(own ? own.y + own.height + edge : (row + rows - 1) * pitch + CELL_SIZE_PX + edge, area.bottom),
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
  const band = positionsBoxPx(space, weave, rows.first, 0, rows.last - rows.first + 1, 1)
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

// Draws the part of the Project in the region, clearing it first. Differs by space only in the background (Frame-only
// fills it, the Canvas stays transparent and fades finished rows) and empty positions (the Canvas draws dots outside
// the Frame).
export function renderProject(context: DrawingContext, input: RenderInput): void {
  const { project, space, region, zoom, pixelRatio = 1, theme = DEFAULT_THEME, drawBead = drawFlatBead, rows: band, positionMarks = 'dots', showFinished = false, rowMarks = rowProgressOn(input.project), margin = MARGIN } = input
  const { technique, beads, frame, rotation } = project
  const description = describeWeave(project)
  const { extent, origin } = space
  // A finished row fades toward what is behind it, which on the Canvas is the drawing area, not a board.
  const look: ProjectTheme = space.open ? { ...theme, background: theme.canvas } : theme

  // The backing store is in device px: clear (and paint the background, in Frame-only space) there, the whole surface
  // or just the band being drawn again, which the rest of the drawing is then cut to, then draw in CSS px scaled up to
  // it.
  context.setTransform(1, 0, 0, 1, 0, 0)
  const cleared = band
    ? bandOnSurface(space, region, zoom, rotation, pixelRatio, project, band)
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

  const visible = visibleBeadsInSpace(project, space, region, zoom, rotation)
  const cornerRadius = beadRoundness(technique) * CELL_SIZE_PX
  // A band's rows, and the row either side: the one above has its bottom under the band's first row, and the one below
  // is drawn over the band's last.
  const firstRow = band ? Math.max(visible.firstRow, band.first - 1) : visible.firstRow
  const lastRow = band ? Math.min(visible.lastRow, band.last + 1) : visible.lastRow

  if (space.open) {
    drawPositionMarks(context, { project, space, area: regionInGridSpace(extent, region, zoom, rotation), zoom, pixelRatio, theme, style: positionMarks, margin })
  }

  // The Frame's own cells, bead or empty bead, then the painted beads round it.
  const inFrame = space.hasFrame
  const frameRows = { first: origin.row, last: origin.row + space.rows - 1 }
  const frameColumns = { first: origin.column, last: origin.column + space.columns - 1 }
  // The current row's beads are drawn 10% brighter than the todo rows (ticket 352); an empty cell is left as it is
  // (ticket 411).
  const lightenCurrent = (color: string | null, position: GridPosition): string | null =>
    color !== null && rowMarks && isInCurrentRow(project, position) ? brighten(color, CURRENT_ROW_BRIGHTNESS) : color
  const drawAt = (row: number, column: number, color: string | null) => {
    const position = { row: space.toAbsolute.row + row, column: space.toAbsolute.column + column }
    const box = positionBoxPx(space, project, row, column)
    // The last column of a Frame's horizontal lines holds no bead (Right-angle weave).
    if (!description.hasPosition(position, frame)) {
      return
    }
    drawBead(context, {
      x: box.x,
      y: box.y,
      size: CELL_SIZE_PX,
      ...(box.width !== CELL_SIZE_PX || box.height !== CELL_SIZE_PX ? { width: box.width, height: box.height } : {}),
      cornerRadius,
      color: lightenCurrent(color ?? beadInSpace(project, space, row, column), position),
      dimmed: rowMarks && !showFinished && isInFinishedRow(project, position),
      deviceScale: zoom * pixelRatio,
      theme: look,
    })
  }

  for (let row = Math.max(firstRow, frameRows.first); inFrame && row <= Math.min(lastRow, frameRows.last); row += 1) {
    const { first, last } = visible.columnsOf(row)
    for (let column = Math.max(first, frameColumns.first); column <= Math.min(last, frameColumns.last); column += 1) {
      drawAt(row, column, null)
    }
  }

  if (space.open) {
    // Only the stored rows in view, and only their stored columns: the cost follows the beads, not the canvas.
    const rowsInView = Object.keys(beads).map(Number).filter((row) => row >= firstRow && row <= lastRow).sort((a, b) => a - b)
    // The beads round the margin nest into its edge (peyote rows sit closer than a bead is tall, offset rows reach half
    // a bead across): cut out its box so none shows inside the outline (the outer rectangle is the view, a cell wider
    // each side so only the cut-out matters).
    const cutOut = frame !== undefined && rowsInView.length > 0
    if (frame && cutOut) {
      context.save()
      const outer = withMargin(frame, margin)
      const own = description.countsUnits ? positionsBoxPx(space, project, outer.row, outer.column, outer.rows, outer.columns) : undefined
      const { width, height } = own ?? projectExtentPx(technique, outer.columns, outer.rows)
      const area = regionInGridSpace(extent, region, zoom, rotation)
      context.beginPath()
      boxPath(context, area.left - CELL_SIZE_PX, area.top - CELL_SIZE_PX, area.right - area.left + 2 * CELL_SIZE_PX, area.bottom - area.top + 2 * CELL_SIZE_PX)
      boxPath(context, own?.x ?? outer.column * CELL_SIZE_PX, own?.y ?? rowTopPx(technique, outer.row), width, height)
      context.clip('evenodd')
    }
    for (const row of rowsInView) {
      const { first, last } = visible.columnsOf(row)
      const stored = beads[row]!
      for (const column of Object.keys(stored).map(Number).filter((column) => column >= first && column <= last).sort((a, b) => a - b)) {
        // The keep-out margin covers any bead that lies in it (ticket 261): it stays in the Project, undrawn.
        if (!(frame && frameContains(withMargin(frame, margin), { row, column }))) {
          drawAt(row, column, stored[column]!)
        }
      }
    }
    if (cutOut) {
      context.restore()
    }
  }

  if (band) {
    context.restore()
  }
}
