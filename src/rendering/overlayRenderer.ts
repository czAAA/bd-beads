import { colorAt, type Frame } from '../domain/canvas'
import { type GridPosition, type PreviewCell, type Technique } from '../domain/grid'
import { withMargin } from '../domain/margin'
import { axisLinePositions, type MirrorAxisCounts } from '../domain/mirror'
import { lineOfPass, passCount } from '../domain/passes'
import type { Selection } from '../domain/selection'
import { DEFAULT_THEME, drawFlatBead, type DrawingContext, type ProjectTheme } from './beadLook'
import { inSpace, spaceOf, type Space } from './space'
import { drawFrameEditing, drawRulers } from './rulerRenderer'
import { cachedSprite } from './sprites'
import { visibleBeadsInSpace, type DrawnProject } from './projectRenderer'
import type { RulerLayout } from './rulers'
import { CELL_SIZE_PX, projectExtentPx, rowTopPx, setGridTransform, shiftOf, type Region, type SurfaceView } from './surfaceView'
import { beadRoundness } from './beadLook'

/**
 * The overlay layer of a Drawing surface (CONTEXT.md, ADR 0018): everything that comes and goes with the pointer or a
 * tool, drawn over the cells, so that it changes without the cells being drawn again. Today that is the Row progress
 * marker; the hover preview, Selection, paste preview, Mirror axes and the "Mirror current" dimming join it as they
 * move over from the grid that was one element per bead.
 *
 * Coordinates are the base layer's (see projectRenderer): a Project's own px, drawn through the same transform, so an
 * overlay lands on the bead it belongs to at every zoom and rotation.
 */

/** The Row progress marker's thickness: one edge, a bit thicker than a MARKER_PX outline (ticket 352, BeadBoard card). */
const MARKER_EDGE_PX = 3

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
  /** The Project whose overlay this is: its Row progress decides the marker. */
  project: DrawnProject
  /** The part of the displayed Project the surface shows, as for renderProject. */
  region: Region
  zoom: number
  pixelRatio?: number
  theme?: ProjectTheme
  /** The hover preview to draw over the beads. */
  preview?: HoverPreview
  /** The rectangle the Select tool has marked out (ticket 31): a wash over its beads and an outline that reads as one rectangle. */
  selection?: Selection
  /** Mirror's per-direction axis counts (ticket 44): a line for each axis, whenever a direction's count is above 0. */
  mirrorAxisCounts?: MirrorAxisCounts
  /** Beads a hovered "Mirror current" button would overwrite (ticket 47): drawn faded, existing content stepping back. */
  dimmedCells?: readonly GridPosition[]
  /** The keyboard's bead cursor (ticket 159): a ring round one bead, only while the Project has keyboard focus. */
  cursor?: GridPosition
  /** What the Tour marks on the Project (ticket 80): beads to paint or erase, and frames to select or paste into. */
  tourMarks?: TourMarks
  /**
   * Where positions live, from `spaceOf`, the same value the base layer was drawn with. On the open canvas (ADR 0026)
   * any position can carry a preview, a Selection or the cursor; in Frame-only space, the default, the Project is the
   * Frame alone, drawn from its first bead, as an export or a picture shows it.
   */
  space?: Space
  /**
   * The rulers and the lines they hang from (open canvas only): the Frame's line, or each piece's rectangle, with the
   * numbers of the Ruler layout while it has them. `surface` is the view the layout was made for and `fontPx` the numbers' size.
   */
  rulers?: { layout: RulerLayout; surface: SurfaceView; fontPx: number }
  /** While the Frame is being set (open canvas only): its handles and the size tooltip's text. `touch` gives four larger corner handles. */
  frameEditing?: { touch: boolean; tooltip: string }
  /** How visible the Frame's margin outline is, 0 to 1 (ticket 276): it fades in while the Frame is set, moved or resized, and after a refused press. */
  marginOutline?: number
}

/** The Tour's marks on the Project, dashed. */
export interface TourMarks {
  cells: readonly GridPosition[]
  boxes: readonly Selection[]
}

/** Where across the line the marker's stroke is centred: `v`, kept far enough inside the Project's own extent (`limit`, when drawn on its own) that the whole stroke shows. */
function clampAcross(v: number, limit: number | undefined): number {
  return limit === undefined ? v : Math.min(Math.max(v, MARKER_EDGE_PX / 2), limit - MARKER_EDGE_PX / 2)
}

/** Starts the path the marker is stroked along: the marker color, MARKER_EDGE_PX thick, round where it turns. */
function beginMarkerStroke(context: DrawingContext, theme: ProjectTheme): void {
  context.strokeStyle = theme.marker
  context.lineWidth = MARKER_EDGE_PX
  context.lineJoin = 'round'
  context.beginPath()
}

/** A bead of the current line: the coordinate of the edge that carries the marker across the line, the way that edge faces (+1 toward the next row to weave, -1 away from it), and the bead's cell along the line. */
interface LineBead {
  v: number
  facing: 1 | -1
  from: number
  to: number
}

/** One stretch of the marker: the border at `v` (across the line) from `from` to `to` (along it). */
interface MarkerSegment {
  v: number
  from: number
  to: number
}

/**
 * The Row progress marker (tickets 352, 369): one continuous border, MARKER_EDGE_PX thick, between what is woven once
 * the current pass is done and what is still to weave. Along the current line each bead puts it on the edge facing the
 * next row to weave (the bottom edge when rows run along the grid's rows, the right edge when they run down its
 * columns), and where the beads' edges are not in line -- a brick stitch row or a peyote bead half a bead across, or a
 * peyote bead not in the pass yet, which puts it on its own near edge -- a step along the seam between two beads joins
 * the pieces, so it reads as one line. It is drawn in the grid's own space, so a rotated Project turns it with the
 * beads. Drawn on its own the Project's surface ends at its extent, so the border stays inside it.
 */
function drawCurrentLine(context: DrawingContext, project: DrawnProject, space: Space, theme: ProjectTheme): void {
  const { technique } = project
  const columnWise = project.rowProgress.direction === 'columns'
  const pass = columnWise ? project.rowProgress.currentColumn : project.rowProgress.currentRow
  const lines = columnWise ? space.columns : space.rows
  if (!space.hasFrame || pass < 0 || pass >= passCount(technique, lines)) {
    return
  }
  const line = lineOfPass(technique, pass)
  // Peyote's later lines take two passes: every other bead first (even positions), then the rest.
  const parity = technique === 'peyote' && pass > 0 ? (pass - 1) % 2 : undefined

  const beads: LineBead[] = []
  const length = columnWise ? space.rows : space.columns
  for (let along = 0; along < length; along += 1) {
    const row = space.origin.row + (columnWise ? along : line)
    const column = space.origin.column + (columnWise ? line : along)
    const x = shiftOf(space, technique, row) + column * CELL_SIZE_PX
    const y = rowTopPx(technique, row)
    // A bead still to weave in the line's first peyote pass keeps the border on its near edge: it is not woven yet.
    const todo = parity === 0 && along % 2 !== 0
    const near = columnWise ? x : y
    beads.push({ v: todo ? near : near + CELL_SIZE_PX, facing: todo ? -1 : 1, from: columnWise ? y : x, to: (columnWise ? y : x) + CELL_SIZE_PX })
  }

  if (beads.length === 0) {
    return
  }

  const corner = beadRoundness(technique) * CELL_SIZE_PX
  if (!columnWise && corner > 0) {
    drawRoundedBorder(context, beads, columnWise, corner, space.open ? undefined : space.extent.height, theme)
    return
  }

  const segments: MarkerSegment[] = []
  beads.forEach((bead, index) => {
    const start = index === 0 ? bead.from : (beads[index - 1]!.to + bead.from) / 2
    const end = index === beads.length - 1 ? bead.to : (bead.to + beads[index + 1]!.from) / 2
    const last = segments.at(-1)
    if (last && last.v === bead.v) {
      last.to = end
    } else {
      segments.push({ v: bead.v, from: start, to: end })
    }
  })

  const limit = space.open ? undefined : columnWise ? space.extent.width : space.extent.height
  const point = (v: number, along: number): [number, number] => (columnWise ? [clampAcross(v, limit), along] : [along, clampAcross(v, limit)])
  // The corners of the line: along each stretch, then across the seam to the next one.
  const corners: [number, number][] = [point(segments[0]!.v, segments[0]!.from)]
  segments.forEach((segment, index) => {
    const next = segments[index + 1]
    if (next) {
      corners.push(point(segment.v, segment.to), point(next.v, segment.to))
    } else {
      corners.push(point(segment.v, segment.to))
    }
  })
  const turnRadius = Math.max(3, corner + 1)
  const distance = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1])

  beginMarkerStroke(context, theme)
  context.moveTo(...corners[0]!)
  for (let at = 1; at < corners.length - 1; at += 1) {
    const [before, turn, after] = [corners[at - 1]!, corners[at]!, corners[at + 1]!]
    context.arcTo(...turn, ...after, Math.min(turnRadius, distance(before, turn) / 2, distance(turn, after) / 2))
  }
  context.lineTo(...corners.at(-1)!)
  context.stroke()
}

/**
 * The marker along a row of rounded beads (peyote, ticket 369): each bead's piece follows that bead's own outline, its
 * facing edge with the two corners rounded as the bead's are, so the line repeats the shape of the row. The pieces are
 * joined from one bead's end to the next one's start, which is the step between beads still to weave and woven ones.
 */
function drawRoundedBorder(context: DrawingContext, beads: readonly LineBead[], columnWise: boolean, corner: number, limit: number | undefined, theme: ProjectTheme): void {
  // The border sits on the cell's edge, a pixel out from the bead's, so its curve is a pixel wider than the bead's corner.
  const curve = corner + 1
  const point = (v: number, along: number): [number, number] => (columnWise ? [v, along] : [along, v])
  beginMarkerStroke(context, theme)
  beads.forEach((bead, index) => {
    const v = clampAcross(bead.v, limit)
    const start = point(v - bead.facing * curve, bead.from)
    if (index === 0) {
      context.moveTo(...start)
    } else {
      context.lineTo(...start)
    }
    context.arcTo(...point(v, bead.from), ...point(v, bead.to), curve)
    context.arcTo(...point(v, bead.to), ...point(v - bead.facing * curve, bead.to), curve)
    context.lineTo(...point(v - bead.facing * curve, bead.to))
  })
  context.stroke()
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
function drawPreview(context: DrawingContext, project: DrawnProject, space: Space, preview: HoverPreview, theme: ProjectTheme): void {
  const { technique } = project
  const size = CELL_SIZE_PX - 2
  const roundness = beadRoundness(technique) * CELL_SIZE_PX - 1

  for (const cell of preview.cells) {
    if (!inSpace(space, cell.row, cell.column)) {
      continue
    }
    const x = shiftOf(space, technique, cell.row) + cell.column * CELL_SIZE_PX + 1
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
/** How thick, in the Project's own px, the Selection's outline is, inside each bead on the rectangle's edge. */
const OUTLINE_PX = 2

/** The Selection's wash on a rounded bead, kept as a bitmap: a big Selection is thousands of these, and it is redrawn as it is dragged. */
function washSprite(cornerRadius: number, deviceScale: number, theme: ProjectTheme) {
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
  project: DrawnProject,
  space: Space,
  selection: Selection,
  region: Region,
  zoom: number,
  pixelRatio: number,
  theme: ProjectTheme,
): void {
  const { technique } = project
  const visible = visibleBeadsInSpace(technique, space, region, zoom, project.rotation)
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
      const x = shiftOf(space, technique, row) + column * CELL_SIZE_PX + 1
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

      const x = shiftOf(space, technique, row) + column * CELL_SIZE_PX + 1
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
  project: DrawnProject,
  space: Space,
  cells: readonly GridPosition[],
  region: Region,
  zoom: number,
  pixelRatio: number,
  theme: ProjectTheme,
): void {
  const { technique, beads } = project
  const visible = visibleBeadsInSpace(technique, space, region, zoom, project.rotation)
  const cornerRadius = beadRoundness(technique) * CELL_SIZE_PX

  for (const { row, column } of cells) {
    if (!inSpace(space, row, column) || row < visible.firstRow || row > visible.lastRow) {
      continue
    }
    drawFlatBead(context, {
      x: shiftOf(space, technique, row) + column * CELL_SIZE_PX,
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
function drawCursor(context: DrawingContext, project: DrawnProject, space: Space, cursor: GridPosition, theme: ProjectTheme): void {
  const { technique } = project
  if (!inSpace(space, cursor.row, cursor.column)) {
    return
  }
  // The bead stands a pixel in from its cell (its gap); the ring starts 2px outside that.
  const offset = 2 - 1
  const width = theme.cursorWidth
  const x = shiftOf(space, technique, cursor.row) + cursor.column * CELL_SIZE_PX - offset
  const y = rowTopPx(technique, cursor.row) - offset
  const size = CELL_SIZE_PX + offset * 2
  const radius = beadRoundness(technique) * CELL_SIZE_PX + offset

  context.fillStyle = theme.cursor
  context.beginPath()
  roundedRect(context, x - width, y - width, size + width * 2, size + width * 2, radius + width)
  roundedRect(context, x, y, size, size, radius)
  context.fill('evenodd')
}

/** The Frame margin's outline (ticket 276, Frame card): 1px dashed `line-strong` round its outer edge, radius 12, faded by `opacity`. Drawn in grid space, so its widths are divided by the zoom to stay screen px. */
const MARGIN_OUTLINE_DASH_PX = [4, 3]
const MARGIN_OUTLINE_RADIUS_PX = 12

function drawMarginOutline(context: DrawingContext, frame: Frame, technique: Technique, zoom: number, opacity: number, theme: ProjectTheme): void {
  const outer = withMargin(frame)
  const x = outer.column * CELL_SIZE_PX
  context.save()
  context.globalAlpha = opacity
  context.strokeStyle = theme.pieceLine
  context.lineWidth = 1 / zoom
  context.setLineDash(MARGIN_OUTLINE_DASH_PX.map((length) => length / zoom))
  context.beginPath()
  roundedRect(context, x, rowTopPx(technique, outer.row), outer.columns * CELL_SIZE_PX, outer.rows * CELL_SIZE_PX, MARGIN_OUTLINE_RADIUS_PX / zoom)
  context.stroke()
  context.restore()
}

/** The Tour's dashed marks (ticket 80): dark under gold, so a mark reads on a gold bead as well as on a black one. */
const TOUR_DASH_PX = [4, 3]
const TOUR_MARK_PX = 2
const TOUR_UNDERLAY_PX = 4.5

function strokeTourMark(context: DrawingContext, theme: ProjectTheme, draw: () => void): void {
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

function drawTourMarks(context: DrawingContext, project: DrawnProject, space: Space, marks: TourMarks, theme: ProjectTheme): void {
  const { technique } = project
  const { columns, rows } = space
  const radius = Math.max(0, beadRoundness(technique) * CELL_SIZE_PX - 1)
  const size = CELL_SIZE_PX - 2

  for (const { row, column } of marks.cells) {
    if (!inSpace(space, row, column)) {
      continue
    }
    const x = shiftOf(space, technique, row) + column * CELL_SIZE_PX + 1
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
    const left = shiftOf(space, technique, box.top) + box.left * CELL_SIZE_PX
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

/** Mirror's axis lines (ticket 44): super-thin but clearly visible, drawn over the whole Project whatever the tool. */
const AXIS_OPACITY = 0.65
const AXIS_PX = 2

function drawMirrorAxes(context: DrawingContext, project: DrawnProject, space: Space, counts: MirrorAxisCounts, theme: ProjectTheme): void {
  if (!space.hasFrame) {
    return
  }
  const { width, height } = projectExtentPx(project.technique, space.columns, space.rows)
  const left = space.origin.column * CELL_SIZE_PX
  const top = rowTopPx(project.technique, space.origin.row)
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

/** Draws the overlay for the part of the Project in the region, clearing what was there first. The overlay is transparent wherever nothing is drawn. */
export function renderOverlay(context: DrawingContext, input: OverlayInput): void {
  const { project, region, zoom, pixelRatio = 1, theme = DEFAULT_THEME, space = spaceOf(project, false), preview, selection, mirrorAxisCounts, dimmedCells, cursor, tourMarks, rulers, frameEditing, marginOutline = 0 } = input

  context.setTransform(1, 0, 0, 1, 0, 0)
  context.clearRect(0, 0, region.width * pixelRatio, region.height * pixelRatio)

  const { enabled } = project.rowProgress
  const axes = mirrorAxisCounts && (mirrorAxisCounts.columns > 0 || mirrorAxisCounts.rows > 0) ? mirrorAxisCounts : undefined
  const dimmed = dimmedCells && dimmedCells.length > 0 ? dimmedCells : undefined
  const marks = tourMarks && (tourMarks.cells.length > 0 || tourMarks.boxes.length > 0) ? tourMarks : undefined
  const ruled = space.open && rulers !== undefined && (project.frame !== undefined || Object.keys(project.beads).length > 0)
  if (!enabled && !preview && !selection && !axes && !dimmed && !cursor && !marks && !ruled && !frameEditing && !(marginOutline > 0)) {
    return
  }

  setGridTransform(context, space.extent, region, zoom, project.rotation, pixelRatio)
  // Bitmaps of beads are made at the size they are on the screen, so they are blitted as they are, not resampled.
  context.imageSmoothingEnabled = false

  // From the bottom up, in the order the DOM grid stacked them: a bead faded, the Selection on it, the hover preview
  // over that, the marker lifted above its row, and Mirror's axes above everything.
  if (dimmed) {
    drawDimmed(context, project, space, dimmed, region, zoom, pixelRatio, theme)
  }
  if (selection) {
    drawSelection(context, project, space, selection, region, zoom, pixelRatio, theme)
  }
  if (preview) {
    drawPreview(context, project, space, preview, theme)
  }
  if (enabled) {
    drawCurrentLine(context, project, space, theme)
  }
  if (axes) {
    drawMirrorAxes(context, project, space, axes, theme)
  }
  if (marginOutline > 0 && project.frame) {
    drawMarginOutline(context, project.frame, project.technique, zoom, marginOutline, theme)
  }
  if (marks) {
    drawTourMarks(context, project, space, marks, theme)
  }
  if (cursor) {
    drawCursor(context, project, space, cursor, theme)
  }

  // The rulers are laid out in the viewport's own px, over everything the grid-space drawing above made.
  if (ruled && rulers) {
    drawRulers(context, {
      project,
      surface: rulers.surface,
      layout: rulers.layout,
      fontPx: rulers.fontPx,
      pixelRatio,
      theme,
      cursor,
    })
  }
  if (space.open && rulers && frameEditing && project.frame) {
    drawFrameEditing(context, {
      frame: project.frame,
      surface: rulers.surface,
      pixelRatio,
      theme,
      touch: frameEditing.touch,
      // A size is a number too: the Rulers toggle hides it with the rest.
      tooltip: rulers.layout.numbers ? frameEditing.tooltip : '',
    })
  }
}
