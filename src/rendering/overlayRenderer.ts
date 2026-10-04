import { colorAt, type Frame } from '../domain/canvas'
import { patternDimensions, patternFrame } from '../domain/pattern'
import { CELL_SIZE_PX, type GridPosition, type PreviewCell } from '../domain/grid'
import { axisLinePositions, type MirrorAxisCounts } from '../domain/mirror'
import type { Selection } from '../domain/selection'
import { DEFAULT_THEME, drawFlatBead, type DrawingContext, type PatternTheme } from './beadLook'
import { OPEN_EXTENT, viewArea } from './canvasRenderer'
import { drawFrameEditing, drawRulers } from './rulerRenderer'
import { cachedSprite } from './sprites'
import {
  patternExtentPx,
  rowShiftPx,
  rowTopPx,
  beadRoundness,
  setGridTransform,
  visibleBeadsIn,
  visibleBeadsOpen,
  type DrawnPattern,
  type Region,
} from './patternRenderer'

/**
 * The overlay layer of a Drawing surface (CONTEXT.md, ADR 0018): everything that comes and goes with the pointer or a
 * tool, drawn over the cells, so that it changes without the cells being drawn again. Today that is the Row progress
 * marker; the hover preview, Selection, paste preview, Mirror axes and the "Mirror current" dimming join it as they
 * move over from the grid that was one element per bead.
 *
 * Coordinates are the base layer's (see patternRenderer): a Pattern's own px, drawn through the same transform, so an
 * overlay lands on the bead it belongs to at every zoom and rotation.
 */

/** The marker's thickness in the Pattern's own px (BeadBoard card: a 2px `marker` outline). */
const MARKER_PX = 2

/** How far outside its row the current-row outline sits, and its corner radius (BeadBoard card). */
const ROW_OUTLINE_OUTSET_PX = 3
const ROW_OUTLINE_RADIUS_PX = 5

/** What a hover preview shows a bead in (BeadHover card): the chosen color at 60%, over whatever the bead holds. */
const PREVIEW_OPACITY = 0.6

/** The hover preview (ticket 23): where paint would land, or a pasted block under the cursor. */
export interface HoverPreview {
  /** The beads it is on: the hovered one and its live-mirror counterparts, or every bead of a block about to be pasted. */
  cells: readonly PreviewCell[]
  /** The color to show on beads that carry none of their own; none for a neutral outline (no color selected). */
  color: string | null
}

export interface OverlayInput {
  /** The Pattern whose overlay this is: its Row progress decides the marker. */
  pattern: DrawnPattern
  /** The part of the displayed Pattern the surface shows, as for renderPattern. */
  region: Region
  zoom: number
  pixelRatio?: number
  theme?: PatternTheme
  /** The hover preview to draw over the beads. */
  preview?: HoverPreview
  /** The rectangle the Select tool has marked out (ticket 31): a wash over its beads and an outline that reads as one rectangle. */
  selection?: Selection
  /** Mirror's per-direction axis counts (ticket 44): a line for each axis, whenever a direction's count is above 0. */
  mirrorAxisCounts?: MirrorAxisCounts
  /** Beads a hovered "Mirror current" button would overwrite (ticket 47): drawn faded, existing content stepping back. */
  dimmedCells?: readonly GridPosition[]
  /** The keyboard's bead cursor (ticket 159): a ring round one bead, only while the Pattern has keyboard focus. */
  cursor?: GridPosition
  /** What the Tour marks on the Pattern (ticket 80): beads to paint or erase, and frames to select or paste into. */
  tourMarks?: TourMarks
  /**
   * Whether the region is a viewport onto the open canvas (ADR 0026), measured from the bead at row 0, column 0, with no
   * edge: any position can carry a preview, a Selection or the cursor. Otherwise the Pattern is the Frame alone, drawn
   * from its first bead, as an export or a picture shows it.
   */
  open?: boolean
  /**
   * The rulers and the lines they hang from (open canvas only): the Frame's line, or each piece's rectangle, with their
   * numbers while `numbers` is on. `fontPx` is the numbers' size and `viewport` the surface's size in px.
   */
  rulers?: { numbers: boolean; fontPx: number; viewport: { width: number; height: number }; activePiece?: Frame }
  /** While the Frame is being set (open canvas only): its handles and the size tooltip's text. `touch` gives four larger corner handles. */
  frameEditing?: { touch: boolean; tooltip: string }
}

/** The Tour's marks on the Pattern, dashed. */
export interface TourMarks {
  cells: readonly GridPosition[]
  boxes: readonly Selection[]
}

/**
 * Where an overlay's positions live. On the open canvas every position is real and the Frame, when there is one, sits
 * where it is; drawn on its own (an export, a picture) the Pattern is the Frame and its first bead is position (0, 0).
 */
interface Space {
  open: boolean
  /** The Frame's first row and column in the coordinates grid space uses, and its size. */
  origin: GridPosition
  columns: number
  rows: number
  hasFrame: boolean
}

function spaceOf(pattern: DrawnPattern, open: boolean): Space {
  const { columns, rows } = patternDimensions(pattern)
  const frame = patternFrame(pattern)
  return { open, origin: open ? { row: frame.row, column: frame.column } : { row: 0, column: 0 }, columns, rows, hasFrame: !open || pattern.frame !== undefined }
}

/** Whether a position can be drawn on: anywhere on the open canvas, inside the Pattern otherwise. */
function inSpace(space: Space, row: number, column: number): boolean {
  return space.open || (row >= 0 && row < space.rows && column >= 0 && column < space.columns)
}

/** The beads in view, with no edge on the open canvas. */
function visibleIn(pattern: DrawnPattern, space: Space, region: Region, zoom: number): ReturnType<typeof visibleBeadsIn> {
  return space.open ? visibleBeadsOpen(pattern.technique, viewArea(region, zoom, pattern.rotation)) : visibleBeadsIn(pattern, region, zoom)
}

/** A rectangle's outline, MARKER_PX thick and inside its edges, as four pieces: cheaper than a path, and exact. */
function outlineRect(context: DrawingContext, x: number, y: number, width: number, height: number): void {
  context.fillRect(x, y, width, MARKER_PX)
  context.fillRect(x, y + height - MARKER_PX, width, MARKER_PX)
  context.fillRect(x, y + MARKER_PX, MARKER_PX, height - MARKER_PX * 2)
  context.fillRect(x + width - MARKER_PX, y + MARKER_PX, MARKER_PX, height - MARKER_PX * 2)
}

/**
 * The outline round the row being woven now, while Row progress is on and rows run along the grid's rows: the row's own
 * rectangle, 3px outside it with rounded corners, so on peyote and brick stitch it follows the row's half-bead shift.
 * It stays inside the Pattern's own extent, so the first and last rows' outlines aren't cut off at the surface's edge.
 */
function drawCurrentRow(context: DrawingContext, pattern: DrawnPattern, space: Space, theme: PatternTheme): void {
  const { technique } = pattern
  const { columns, rows } = space
  const relative = pattern.rowProgress.currentRow
  if (!space.hasFrame || relative < 0 || relative >= rows) {
    return
  }

  const row = space.origin.row + relative
  const first = space.origin.column * CELL_SIZE_PX
  const extent = space.open ? undefined : patternExtentPx(technique, columns, rows)
  const left = rowShiftPx(technique, row) + first - ROW_OUTLINE_OUTSET_PX
  const top = rowTopPx(technique, row) - ROW_OUTLINE_OUTSET_PX
  const right = rowShiftPx(technique, row) + first + columns * CELL_SIZE_PX + ROW_OUTLINE_OUTSET_PX
  const bottom = rowTopPx(technique, row) + CELL_SIZE_PX + ROW_OUTLINE_OUTSET_PX
  // Drawn on its own the Pattern's surface ends at its extent, so the first and last rows' outlines stay inside it.
  const clippedLeft = extent ? Math.max(0, left) : left
  const clippedTop = extent ? Math.max(0, top) : top
  const width = (extent ? Math.min(extent.width, right) : right) - clippedLeft
  const height = (extent ? Math.min(extent.height, bottom) : bottom) - clippedTop

  context.fillStyle = theme.marker
  context.beginPath()
  roundedRect(context, clippedLeft, clippedTop, width, height, ROW_OUTLINE_RADIUS_PX)
  roundedRect(context, clippedLeft + MARKER_PX, clippedTop + MARKER_PX, width - MARKER_PX * 2, height - MARKER_PX * 2, ROW_OUTLINE_RADIUS_PX - MARKER_PX)
  context.fill('evenodd')
}

/**
 * The marker for the column being woven now, when rows run down the grid's columns: drawn bead by bead, since the
 * beads of a column don't line up on peyote and brick stitch. It reaches a pixel past each bead onto its rim, so the
 * sides join between beads instead of breaking at every seam. On loom it is the two long sides of the column, closed
 * at the top of the first bead and the bottom of the last, so it reads as one outlined strip; on peyote and brick stitch
 * every bead is outlined whole, which keeps the zigzag readable as one chain.
 */
function drawCurrentColumn(context: DrawingContext, pattern: DrawnPattern, space: Space, theme: PatternTheme): void {
  const { technique } = pattern
  const { columns, rows } = space
  const relative = pattern.rowProgress.currentColumn
  if (!space.hasFrame || relative < 0 || relative >= columns) {
    return
  }
  const column = space.origin.column + relative

  context.fillStyle = theme.marker
  const size = CELL_SIZE_PX + 2
  for (let offset = 0; offset < rows; offset += 1) {
    const row = space.origin.row + offset
    const x = rowShiftPx(technique, row) + column * CELL_SIZE_PX - 1
    const y = rowTopPx(technique, row) - 1

    if (technique === 'loom') {
      context.fillRect(x, y, MARKER_PX, size)
      context.fillRect(x + size - MARKER_PX, y, MARKER_PX, size)
      if (offset === 0) {
        context.fillRect(x + MARKER_PX, y, size - MARKER_PX * 2, MARKER_PX)
      }
      if (offset === rows - 1) {
        context.fillRect(x + MARKER_PX, y + size - MARKER_PX, size - MARKER_PX * 2, MARKER_PX)
      }
    } else {
      drawRoundedOutline(context, x, y, size, beadRoundness(technique) * size)
    }
  }
}

/** A square's outline, MARKER_PX thick and inside its edges, with the corners rounded by `radius` (0 for square): the outer shape and the inner one, filled even-odd. */
function drawRoundedOutline(context: DrawingContext, x: number, y: number, size: number, radius: number): void {
  if (radius <= 0) {
    outlineRect(context, x, y, size, size)
    return
  }

  const inner = size - MARKER_PX * 2
  const innerRadius = Math.max(0, radius - MARKER_PX)
  context.beginPath()
  roundedRect(context, x, y, size, size, radius)
  roundedRect(context, x + MARKER_PX, y + MARKER_PX, inner, inner, innerRadius)
  context.fill('evenodd')
}

function roundedRect(context: DrawingContext, x: number, y: number, width: number, height: number, radius: number): void {
  if (typeof context.roundRect === 'function') {
    context.roundRect(x, y, width, height, radius)
    return
  }
  context.moveTo(x + radius, y)
  context.arcTo(x + width, y, x + width, y + height, radius)
  context.arcTo(x + width, y + height, x, y + height, radius)
  context.arcTo(x, y + height, x, y, radius)
  context.arcTo(x, y, x + width, y, radius)
}

/**
 * The hover preview on each bead it names, inside the bead's rim: its color at a faint opacity over whatever the bead
 * holds (a pasted block in each bead's own colors), or, with no color to show, a 2px outline in the dark ink. Square
 * inside a peyote bead's rounded corners, as the DOM grid drew it.
 */
function drawPreview(context: DrawingContext, pattern: DrawnPattern, space: Space, preview: HoverPreview, theme: PatternTheme): void {
  const { technique } = pattern
  const size = CELL_SIZE_PX - 2
  const roundness = beadRoundness(technique) * CELL_SIZE_PX - 1

  for (const cell of preview.cells) {
    if (!inSpace(space, cell.row, cell.column)) {
      continue
    }
    const x = rowShiftPx(technique, cell.row) + cell.column * CELL_SIZE_PX + 1
    const y = rowTopPx(technique, cell.row) + 1
    const color = cell.color ?? preview.color

    if (color) {
      context.globalAlpha = PREVIEW_OPACITY
      context.fillStyle = color
      context.fillRect(x, y, size, size)
      context.globalAlpha = 1
      continue
    }

    context.fillStyle = theme.outline
    context.beginPath()
    roundedRect(context, x, y, size, size, Math.max(0, roundness))
    roundedRect(context, x + 2, y + 2, size - 4, size - 4, Math.max(0, roundness - 2))
    context.fill('evenodd')
  }
}

/** How much of a bead the Selection's wash covers: its inside, the rim left as it is. */
const WASH_OPACITY = 0.3
/** How thick, in the Pattern's own px, the Selection's outline is, inside each bead on the rectangle's edge. */
const OUTLINE_PX = 2

/** The Selection's wash on a rounded bead, kept as a bitmap: a big Selection is thousands of these, and it is redrawn as it is dragged. */
function washSprite(cornerRadius: number, deviceScale: number, theme: PatternTheme) {
  const size = CELL_SIZE_PX - 2
  const pixels = Math.max(1, Math.round(size * deviceScale))
  return cachedSprite(['wash', pixels, cornerRadius, theme.marker].join('|'), pixels, size, (context) => {
    context.globalAlpha = WASH_OPACITY
    context.fillStyle = theme.marker
    context.beginPath()
    roundedRect(context, 0, 0, size, size, cornerRadius)
    context.fill()
  })
}

/**
 * The Selection (ticket 31): a wash over each of its beads, inside the rim so it tints whatever color the bead holds
 * without touching the rim, and an outline drawn on the beads at its edge — bead by bead, because peyote and brick
 * stitch shift alternate rows by half a bead, and one rectangle would sit half a bead off on every other row. Only the
 * beads on screen are drawn, however big the Selection is.
 */
function drawSelection(
  context: DrawingContext,
  pattern: DrawnPattern,
  space: Space,
  selection: Selection,
  region: Region,
  zoom: number,
  pixelRatio: number,
  theme: PatternTheme,
): void {
  const { technique } = pattern
  const visible = visibleIn(pattern, space, region, zoom)
  const size = CELL_SIZE_PX - 2
  const rounded = technique === 'peyote'
  const radius = Math.max(0, beadRoundness(technique) * CELL_SIZE_PX - 1)
  const bottom = space.open ? selection.top + selection.rows - 1 : Math.min(selection.top + selection.rows - 1, space.rows - 1)
  const right = space.open ? selection.left + selection.columns - 1 : Math.min(selection.left + selection.columns - 1, space.columns - 1)
  const firstRow = Math.max(selection.top, visible.firstRow)
  const lastRow = Math.min(bottom, visible.lastRow)
  const sprite = rounded ? washSprite(radius, zoom * pixelRatio, theme) : undefined

  context.fillStyle = theme.marker
  for (let row = firstRow; row <= lastRow; row += 1) {
    const { first, last } = visible.columnsOf(row)
    for (let column = Math.max(first, selection.left); column <= Math.min(last, right); column += 1) {
      const x = rowShiftPx(technique, row) + column * CELL_SIZE_PX + 1
      const y = rowTopPx(technique, row) + 1
      if (sprite) {
        context.drawImage(sprite, x, y, size, size)
      } else {
        context.globalAlpha = WASH_OPACITY
        context.fillRect(x, y, size, size)
      }
    }
  }
  context.globalAlpha = 1

  for (let row = firstRow; row <= lastRow; row += 1) {
    const { first, last } = visible.columnsOf(row)
    const onSideRow = row === selection.top || row === bottom
    for (let column = Math.max(first, selection.left); column <= Math.min(last, right); column += 1) {
      // Only the beads on the rectangle's edge carry an outline.
      if (!onSideRow && column !== selection.left && column !== right) {
        continue
      }
      const sides = [
        [row === selection.top, 0, 0, size, OUTLINE_PX],
        [row === bottom, 0, size - OUTLINE_PX, size, OUTLINE_PX],
        [column === selection.left, 0, 0, OUTLINE_PX, size],
        [column === right, size - OUTLINE_PX, 0, OUTLINE_PX, size],
      ] as const

      const x = rowShiftPx(technique, row) + column * CELL_SIZE_PX + 1
      const y = rowTopPx(technique, row) + 1
      if (rounded) {
        // The outline follows the bead's rounded inside, as an inset shadow does.
        context.save()
        context.beginPath()
        roundedRect(context, x, y, size, size, radius)
        context.clip()
      }
      for (const [onEdge, dx, dy, width, height] of sides) {
        if (onEdge) {
          context.fillRect(x + dx, y + dy, width, height)
        }
      }
      if (rounded) {
        context.restore()
      }
    }
  }
}

/**
 * The beads a hovered "Mirror current" button would overwrite, faded (ticket 47): existing content stepping back, not
 * what would be painted. Each is drawn as the bead it is, faded over the paper, which covers the bead under it on the
 * cells layer.
 */
function drawDimmed(
  context: DrawingContext,
  pattern: DrawnPattern,
  space: Space,
  cells: readonly GridPosition[],
  region: Region,
  zoom: number,
  pixelRatio: number,
  theme: PatternTheme,
): void {
  const { technique, beads } = pattern
  const visible = visibleIn(pattern, space, region, zoom)
  const cornerRadius = beadRoundness(technique) * CELL_SIZE_PX

  for (const { row, column } of cells) {
    if (!inSpace(space, row, column) || row < visible.firstRow || row > visible.lastRow) {
      continue
    }
    drawFlatBead(context, {
      x: rowShiftPx(technique, row) + column * CELL_SIZE_PX,
      y: rowTopPx(technique, row),
      size: CELL_SIZE_PX,
      cornerRadius,
      color: colorAt(beads, row, column),
      dimmed: true,
      backdrop: theme.background,
      deviceScale: zoom * pixelRatio,
      theme,
    })
  }
}

/**
 * The bead cursor (ticket 159; BeadCursor card): a ring in the theme's cursor color, 2px outside the bead (3px wide in
 * high contrast), following its corners. Drawn last, over everything, so it is never hidden.
 */
function drawCursor(context: DrawingContext, pattern: DrawnPattern, space: Space, cursor: GridPosition, theme: PatternTheme): void {
  const { technique } = pattern
  if (!inSpace(space, cursor.row, cursor.column)) {
    return
  }
  // The bead stands a pixel in from its cell (its gap); the ring starts 2px outside that.
  const offset = 2 - 1
  const width = theme.cursorWidth
  const x = rowShiftPx(technique, cursor.row) + cursor.column * CELL_SIZE_PX - offset
  const y = rowTopPx(technique, cursor.row) - offset
  const size = CELL_SIZE_PX + offset * 2
  const radius = beadRoundness(technique) * CELL_SIZE_PX + offset

  context.fillStyle = theme.cursor
  context.beginPath()
  roundedRect(context, x - width, y - width, size + width * 2, size + width * 2, radius + width)
  roundedRect(context, x, y, size, size, radius)
  context.fill('evenodd')
}

/** The Tour's dashed marks (ticket 80): dark under gold, so a mark reads on a gold bead as well as on a black one. */
const TOUR_DASH_PX = [4, 3]
const TOUR_MARK_PX = 2
const TOUR_UNDERLAY_PX = 4.5

function strokeTourMark(context: DrawingContext, theme: PatternTheme, draw: () => void): void {
  context.lineCap = 'butt'
  context.setLineDash([])
  context.strokeStyle = theme.outline
  context.lineWidth = TOUR_UNDERLAY_PX
  draw()
  context.setLineDash(TOUR_DASH_PX)
  context.strokeStyle = theme.tourMark
  context.lineWidth = TOUR_MARK_PX
  draw()
  context.setLineDash([])
}

function drawTourMarks(context: DrawingContext, pattern: DrawnPattern, space: Space, marks: TourMarks, theme: PatternTheme): void {
  const { technique } = pattern
  const { columns, rows } = space
  const radius = Math.max(0, beadRoundness(technique) * CELL_SIZE_PX - 1)
  const size = CELL_SIZE_PX - 2

  for (const { row, column } of marks.cells) {
    if (!inSpace(space, row, column)) {
      continue
    }
    const x = rowShiftPx(technique, row) + column * CELL_SIZE_PX + 1
    const y = rowTopPx(technique, row) + 1
    strokeTourMark(context, theme, () => {
      context.beginPath()
      roundedRect(context, x, y, size, size, radius)
      context.stroke()
    })
  }

  for (const box of marks.boxes) {
    const bottom = (space.open ? box.top + box.rows : Math.min(box.top + box.rows, rows)) - 1
    const right = (space.open ? box.left + box.columns : Math.min(box.left + box.columns, columns)) - 1
    const left = rowShiftPx(technique, box.top) + box.left * CELL_SIZE_PX
    const top = rowTopPx(technique, box.top)
    const width = (right - box.left + 1) * CELL_SIZE_PX
    const height = rowTopPx(technique, bottom) + CELL_SIZE_PX - top
    strokeTourMark(context, theme, () => {
      context.beginPath()
      roundedRect(context, left - 1, top - 1, width + 2, height + 2, 4)
      context.stroke()
    })
  }
}

/** Mirror's axis lines (ticket 44): super-thin but clearly visible, drawn over the whole Pattern whatever the tool. */
const AXIS_OPACITY = 0.65
const AXIS_PX = 2

function drawMirrorAxes(context: DrawingContext, pattern: DrawnPattern, space: Space, counts: MirrorAxisCounts, theme: PatternTheme): void {
  if (!space.hasFrame) {
    return
  }
  const { width, height } = patternExtentPx(pattern.technique, space.columns, space.rows)
  const left = space.origin.column * CELL_SIZE_PX
  const top = rowTopPx(pattern.technique, space.origin.row)
  context.globalAlpha = AXIS_OPACITY
  context.fillStyle = theme.marker
  for (const fraction of axisLinePositions(counts.columns)) {
    context.fillRect(left + fraction * width - AXIS_PX / 2, top, AXIS_PX, height)
  }
  for (const fraction of axisLinePositions(counts.rows)) {
    context.fillRect(left, top + fraction * height - AXIS_PX / 2, width, AXIS_PX)
  }
  context.globalAlpha = 1
}

/** Draws the overlay for the part of the Pattern in the region, clearing what was there first. The overlay is transparent wherever nothing is drawn. */
export function renderOverlay(context: DrawingContext, input: OverlayInput): void {
  const { pattern, region, zoom, pixelRatio = 1, theme = DEFAULT_THEME, preview, selection, mirrorAxisCounts, dimmedCells, cursor, tourMarks, open = false, rulers, frameEditing } = input

  context.setTransform(1, 0, 0, 1, 0, 0)
  context.clearRect(0, 0, region.width * pixelRatio, region.height * pixelRatio)

  const { enabled, direction } = pattern.rowProgress
  const axes = mirrorAxisCounts && (mirrorAxisCounts.columns > 0 || mirrorAxisCounts.rows > 0) ? mirrorAxisCounts : undefined
  const dimmed = dimmedCells && dimmedCells.length > 0 ? dimmedCells : undefined
  const marks = tourMarks && (tourMarks.cells.length > 0 || tourMarks.boxes.length > 0) ? tourMarks : undefined
  const ruled = open && rulers !== undefined && (pattern.frame !== undefined || Object.keys(pattern.beads).length > 0)
  if (!enabled && !preview && !selection && !axes && !dimmed && !cursor && !marks && !ruled && !frameEditing) {
    return
  }

  const space = spaceOf(pattern, open)
  const extent = open ? OPEN_EXTENT : patternExtentPx(pattern.technique, space.columns, space.rows)
  setGridTransform(context, extent, region, zoom, pattern.rotation, pixelRatio)
  // Bitmaps of beads are made at the size they are on the screen, so they are blitted as they are, not resampled.
  context.imageSmoothingEnabled = false

  // From the bottom up, in the order the DOM grid stacked them: a bead faded, the Selection on it, the hover preview
  // over that, the marker lifted above its row, and Mirror's axes above everything.
  if (dimmed) {
    drawDimmed(context, pattern, space, dimmed, region, zoom, pixelRatio, theme)
  }
  if (selection) {
    drawSelection(context, pattern, space, selection, region, zoom, pixelRatio, theme)
  }
  if (preview) {
    drawPreview(context, pattern, space, preview, theme)
  }
  if (enabled) {
    if (direction === 'rows') {
      drawCurrentRow(context, pattern, space, theme)
    } else {
      drawCurrentColumn(context, pattern, space, theme)
    }
  }
  if (axes) {
    drawMirrorAxes(context, pattern, space, axes, theme)
  }
  if (marks) {
    drawTourMarks(context, pattern, space, marks, theme)
  }
  if (cursor) {
    drawCursor(context, pattern, space, cursor, theme)
  }

  // The rulers are laid out in the viewport's own px, over everything the grid-space drawing above made.
  if (ruled && rulers) {
    drawRulers(context, {
      pattern,
      view: { technique: pattern.technique, rotation: pattern.rotation, zoom, scroll: { x: region.x, y: region.y }, viewport: rulers.viewport, fontPx: rulers.fontPx },
      pixelRatio,
      theme,
      showNumbers: rulers.numbers,
      cursor,
      activePiece: rulers.activePiece,
    })
  }
  if (open && rulers && frameEditing && pattern.frame) {
    drawFrameEditing(context, {
      frame: pattern.frame,
      view: { technique: pattern.technique, rotation: pattern.rotation, zoom, scroll: { x: region.x, y: region.y }, viewport: rulers.viewport, fontPx: rulers.fontPx },
      pixelRatio,
      theme,
      touch: frameEditing.touch,
      // A size is a number too: the Rulers toggle hides it with the rest.
      tooltip: rulers.numbers ? frameEditing.tooltip : '',
    })
  }
}
