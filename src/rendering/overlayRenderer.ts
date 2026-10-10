import { colorAt, type Frame } from '../domain/canvas'
import { type GridPosition, type PreviewCell, type Technique } from '../domain/grid'
import { withMargin } from '../domain/margin'
import { axisLinePositions, type MirrorAxisCounts } from '../domain/mirror'
import { lineOfPass, passCount, passOf } from '../domain/passes'
import type { Selection } from '../domain/selection'
import { brighten, CURRENT_ROW_BRIGHTNESS, DEFAULT_THEME, drawFlatBead, type DrawingContext, type ProjectTheme } from './beadLook'
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

/** The Row progress marker's thickness: the ring round a bead in the current pass (tickets 375, 376, BeadBoard card). */
const MARKER_RING_PX = 2

/** What a hover preview shows a bead in (BeadHover card): the chosen color at 60%, over whatever the bead holds. */
const PREVIEW_OPACITY = 0.6

/** How thick the hover preview's outline is when there is no color to show (BeadHover card): the pointer's marker shares it. */
const PREVIEW_OUTLINE_PX = 2

/** The hover preview (ticket 23): where paint would land, or a pasted block under the cursor. */
export interface HoverPreview {
  /** The beads it is on: the hovered one and its live-mirror counterparts, or every bead of a block about to be pasted. */
  cells: readonly PreviewCell[]
  /** The color to show on beads that carry none of their own; none for a neutral outline (no color selected). */
  color: string | null
}

/** How much of a bead as drawn the pointer's marker is (ticket 353, BeadHover card). */
const POINTER_SCALE = 0.9

/** The bead-shaped pointer over the board (ticket 353): where the pointer is, in the surface's own px, and the color it shows. */
interface BeadPointer {
  x: number
  y: number
  /** The chosen color, shown at 60%; none for the dark outline. */
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
  /** The marker that stands for the pointer over the beads (ticket 353), with the OS pointer hidden. */
  pointer?: BeadPointer
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

/** A bead the current pass weaves: its cell, top left, and its color (none when empty). */
interface PassBead {
  x: number
  y: number
  color: string | null
}

/** The beads the current pass weaves, in order along the line (on peyote's later lines only half the line is); none when the Frame has no such pass. */
function beadsInPass(project: DrawnProject, space: Space): PassBead[] {
  const { technique } = project
  const columnWise = project.rowProgress.direction === 'columns'
  const pass = columnWise ? project.rowProgress.currentColumn : project.rowProgress.currentRow
  const lines = columnWise ? space.columns : space.rows
  if (!space.hasFrame || pass < 0 || pass >= passCount(technique, lines)) {
    return []
  }
  const line = lineOfPass(technique, pass)

  const beads: PassBead[] = []
  const length = columnWise ? space.rows : space.columns
  for (let along = 0; along < length; along += 1) {
    const row = space.origin.row + (columnWise ? along : line)
    const column = space.origin.column + (columnWise ? line : along)
    const x = shiftOf(space, technique, row) + column * CELL_SIZE_PX
    const y = rowTopPx(technique, row)
    if (passOf(technique, line, along) === pass) {
      beads.push({ x, y, color: colorAt(project.beads, space.toAbsolute.row + row, space.toAbsolute.column + column) })
    }
  }
  return beads
}

/**
 * The beads of the current pass lifted above their neighbours (ticket 375): drawn again over the cells, so on peyote
 * and brick stitch, where the next row nests into the gaps, their corners are not covered while they are the row being woven.
 */
function drawLiftedBeads(context: DrawingContext, beads: readonly PassBead[], project: DrawnProject, zoom: number, pixelRatio: number, theme: ProjectTheme): void {
  const cornerRadius = beadRoundness(project.technique) * CELL_SIZE_PX
  for (const bead of beads) {
    drawFlatBead(context, { x: bead.x, y: bead.y, size: CELL_SIZE_PX, cornerRadius, color: brighten(bead.color ?? theme.emptyBead, CURRENT_ROW_BRIGHTNESS), dimmed: false, deviceScale: zoom * pixelRatio, theme })
  }
}

/**
 * The Row progress marker (tickets 352, 375, 376): a ring, MARKER_RING_PX thick, round each bead woven in the current
 * pass, inside its cell with its outer edge on the cell's edge, so it never reaches a neighbour and two rings side by
 * side stay two. Only the beads in the pass are ringed: no line joins them. One path, one stroke.
 */
function drawBeadRings(context: DrawingContext, beads: readonly PassBead[], project: DrawnProject, theme: ProjectTheme): void {
  const corner = beadRoundness(project.technique) * CELL_SIZE_PX
  const half = MARKER_RING_PX / 2
  context.strokeStyle = theme.marker
  context.lineWidth = MARKER_RING_PX
  context.beginPath()
  for (const bead of beads) {
    roundedRect(context, bead.x + half, bead.y + half, CELL_SIZE_PX - MARKER_RING_PX, CELL_SIZE_PX - MARKER_RING_PX, Math.max(0, corner - half))
  }
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
      fillFaintly(context, x, y, size, 0, color)
    } else {
      outlineBead(context, x, y, size, roundness, theme)
    }
  }
}

/** A bead-sized square (or rounded square, with a radius) in a color at the hover preview's faint opacity. */
function fillFaintly(context: DrawingContext, x: number, y: number, size: number, radius: number, color: string): void {
  context.globalAlpha = PREVIEW_OPACITY
  context.fillStyle = color
  if (radius > 0) {
    context.beginPath()
    roundedRect(context, x, y, size, size, radius)
    context.fill()
  } else {
    context.fillRect(x, y, size, size)
  }
  context.globalAlpha = 1
}

/** The hover preview's neutral look: a ring in the dark ink, as thick as PREVIEW_OUTLINE_PX, inside the bead's rounded corners. */
function outlineBead(context: DrawingContext, x: number, y: number, size: number, radius: number, theme: ProjectTheme): void {
  const inset = PREVIEW_OUTLINE_PX
  context.fillStyle = theme.outline
  context.beginPath()
  roundedRect(context, x, y, size, size, Math.max(0, radius))
  roundedRect(context, x + inset, y + inset, size - 2 * inset, size - 2 * inset, Math.max(0, radius - inset))
  context.fill('evenodd')
}

/**
 * The pointer's marker (ticket 353): a bead 90% of the size one is drawn at, centred on the pointer rather than on the
 * bead under it, looking like the hover preview. Drawn in the surface's own px, so it follows zoom but not rotation; a
 * pen has no CSS cursor, so one drawn marker serves the mouse and the pen alike.
 */
function drawPointer(context: DrawingContext, technique: Technique, zoom: number, pixelRatio: number, pointer: BeadPointer, theme: ProjectTheme): void {
  const size = CELL_SIZE_PX * zoom * POINTER_SCALE
  const x = pointer.x - size / 2
  const y = pointer.y - size / 2
  const radius = Math.max(0, beadRoundness(technique) * size)

  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
  if (pointer.color) {
    fillFaintly(context, x, y, size, radius, pointer.color)
  } else {
    outlineBead(context, x, y, size, radius, theme)
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

/** Strokes the box round the margin's drawn extent (ticket 372): peyote rows nest closer than a bead is tall, and offset techniques add half a bead across, so it is not `rows * CELL_SIZE_PX`. */
function drawMarginOutline(context: DrawingContext, frame: Frame, technique: Technique, zoom: number, opacity: number, theme: ProjectTheme): void {
  const outer = withMargin(frame)
  const x = outer.column * CELL_SIZE_PX
  const { width, height } = projectExtentPx(technique, outer.columns, outer.rows)
  context.save()
  context.globalAlpha = opacity
  context.strokeStyle = theme.pieceLine
  context.lineWidth = 1 / zoom
  context.setLineDash(MARGIN_OUTLINE_DASH_PX.map((length) => length / zoom))
  context.beginPath()
  roundedRect(context, x, rowTopPx(technique, outer.row), width, height, MARGIN_OUTLINE_RADIUS_PX / zoom)
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
  const { project, region, zoom, pixelRatio = 1, theme = DEFAULT_THEME, space = spaceOf(project, false), preview, selection, mirrorAxisCounts, dimmedCells, cursor, tourMarks, rulers, frameEditing, marginOutline = 0, pointer } = input

  context.setTransform(1, 0, 0, 1, 0, 0)
  context.clearRect(0, 0, region.width * pixelRatio, region.height * pixelRatio)

  const { enabled } = project.rowProgress
  const axes = mirrorAxisCounts && (mirrorAxisCounts.columns > 0 || mirrorAxisCounts.rows > 0) ? mirrorAxisCounts : undefined
  const dimmed = dimmedCells && dimmedCells.length > 0 ? dimmedCells : undefined
  const marks = tourMarks && (tourMarks.cells.length > 0 || tourMarks.boxes.length > 0) ? tourMarks : undefined
  const ruled = space.open && rulers !== undefined && (project.frame !== undefined || Object.keys(project.beads).length > 0)
  if (!enabled && !preview && !selection && !axes && !dimmed && !cursor && !marks && !ruled && !frameEditing && !pointer && !(marginOutline > 0)) {
    return
  }

  setGridTransform(context, space.extent, region, zoom, project.rotation, pixelRatio)
  // Bitmaps of beads are made at the size they are on the screen, so they are blitted as they are, not resampled.
  context.imageSmoothingEnabled = false

  // From the bottom up, in the order the DOM grid stacked them: a bead faded, the Selection on it, the hover preview
  // over that, the marker lifted above its row, and Mirror's axes above everything.
  const inPass = enabled ? beadsInPass(project, space) : []
  if (enabled) {
    drawLiftedBeads(context, inPass, project, zoom, pixelRatio, theme)
  }
  if (dimmed) {
    drawDimmed(context, project, space, dimmed, region, zoom, pixelRatio, theme)
  }
  if (selection) {
    drawSelection(context, project, space, selection, region, zoom, pixelRatio, theme)
  }
  if (preview) {
    drawPreview(context, project, space, preview, theme)
  }
  if (inPass.length > 0) {
    drawBeadRings(context, inPass, project, theme)
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
  if (pointer) {
    drawPointer(context, project.technique, zoom, pixelRatio, pointer, theme)
  }
}
