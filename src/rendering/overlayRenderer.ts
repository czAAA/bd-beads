import { type GridPosition, type PreviewCell } from '../domain/grid'
import { type Technique, type Weave } from '../domain/weave'
import { axisLinePositions, type MirrorAxisCounts } from '../domain/mirror'
import { beadRoundness, describeWeave, passCount, passLines, passOf } from '../domain/weave'
import { rowProgressOn } from '../domain/project'
import { hasGuides, selectionFrame, type Selection } from '../domain/selection'
import { brighten, CURRENT_ROW_BRIGHTNESS, DEFAULT_THEME, drawFlatBead, type DrawingContext, type ProjectTheme } from './beadLook'
import { beadInSpace, inSpace, spaceOf, type Space } from './space'
import { drawBoxHandles, drawFrameEditing, drawRulers } from './rulerRenderer'
import { visibleBeadsInSpace, type DrawnProject } from './projectRenderer'
import type { RulerLayout } from './rulers'
import { CELL_SIZE_PX, positionBoxPx, positionsBoxPx, projectExtentPx, rowPitchPx, rowTopPx, setGridTransform, shiftOf, type Region, type SurfaceView } from './surfaceView'
import { BEAD_GAP_PX } from './beadLook'

// The overlay layer of a Drawing surface (CONTEXT.md, ADR 0018): everything that comes and goes with the pointer or a
// tool, drawn over the cells so it changes without redrawing them. Coordinates are the base layer's (see
// projectRenderer): a Project's own px through the same transform, so an overlay lands on its bead at every zoom.

/** The Row progress marker's thickness: the ring round a bead in the current pass (tickets 375, 376, BeadBoard
 * card). */
const MARKER_RING_PX = 2

/** What a hover preview shows a bead in (BeadHover card): the chosen color at 60%, over whatever the bead holds. */
const PREVIEW_OPACITY = 0.6

/** How thick the hover preview's outline is when there is no color to show (BeadHover card): the pointer's marker
 * shares it. */
const PREVIEW_OUTLINE_PX = 2

/** The hover preview (ticket 23): where paint would land, or a pasted block under the cursor. */
export interface HoverPreview {
  /** The beads it is on: the hovered one and its live-mirror counterparts, or every bead of a block about to be
   * pasted. */
  cells: readonly PreviewCell[]
  /** The color to show on beads that carry none of their own; none for a neutral outline (no color selected). */
  color: string | null
}

/** How much of a bead as drawn the pointer's marker is (ticket 353, BeadHover card). */
const POINTER_SCALE = 0.9

/** How much smaller than that the marker is drawn, in px on the screen at any zoom, so it reads as the bead's own
 * size inside the hover preview. */
const POINTER_TRIM_PX = 1

/** The bead-shaped pointer over the board (ticket 353): where the pointer is, in the surface's own px, and the color
 * it shows. */
interface BeadPointer {
  x: number
  y: number
  /** The chosen color, shown at 60%; none for the dark outline. */
  color: string | null
}

export interface OverlayInput {
  /** Whether Row progress is drawn (the current pass lifted, its row number bold). Defaults to
   * `rowProgressOn(project)` (ticket 434). */
  rowMarks?: boolean
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
  /** The rectangle the Select, Piece or Select all marked out (tickets 31, 414): drawn as its outer border. */
  selection?: Selection
  /** Where the Selection's eight handles stand (ticket 414): the view the box is measured in, and `touch` for four
   * larger ones. Without it the Selection has no handles. */
  selectionHandles?: { surface: SurfaceView; touch: boolean }
  /** Mirror's per-direction axis counts (ticket 44): a line for each axis, whenever a direction's count is above 0. */
  mirrorAxisCounts?: MirrorAxisCounts
  /** Beads a hovered "Mirror current" button would overwrite (ticket 47): drawn faded, existing content stepping
   * back. */
  dimmedCells?: readonly GridPosition[]
  /** The keyboard's bead cursor (ticket 159): a ring round one bead, only while the Project has keyboard focus. */
  cursor?: GridPosition
  /** What the Tour marks on the Project (ticket 80): beads to paint or erase, and frames to select or paste into. */
  tourMarks?: TourMarks
  // Where positions live, from `spaceOf`, as the base layer was drawn. On the Canvas (ADR 0026) any position can carry
  // a preview, Selection or cursor; in Frame-only space (default) the Project is the Frame alone, drawn from its first
  // bead.
  space?: Space
  /** The rulers and their lines (Canvas only): the Frame's line or each piece's rectangle; `surface` is the view the
   * layout was made for. */
  rulers?: { layout: RulerLayout; surface: SurfaceView }
  /** While the Frame is being set (Canvas only): its handles and the size tooltip's text. `touch` gives four larger
   * corner handles. */
  frameEditing?: { touch: boolean; tooltip: string }
}

/** The Tour's marks on the Project, dashed. */
export interface TourMarks {
  cells: readonly GridPosition[]
  boxes: readonly Selection[]
}

/** A bead the current pass weaves: its cell, top left, and its color. */
interface PassBead {
  x: number
  y: number
  width: number
  height: number
  color: string
}

/** The beads the current pass weaves, in order along the line (on peyote's later lines only half the line is); none
 * when the Frame has no such pass. */
function beadsInPass(project: DrawnProject, space: Space): PassBead[] {
  const direction = project.rowProgress.direction
  const columnWise = direction === 'columns'
  const pass = columnWise ? project.rowProgress.currentColumn : project.rowProgress.currentRow
  const lines = columnWise ? space.columns : space.rows
  if (!space.hasFrame || pass < 0 || pass >= passCount(project, lines, direction)) {
    return []
  }
  const length = columnWise ? space.rows : space.columns
  const beads: PassBead[] = []
  for (const line of passLines(project, pass, direction)) {
    for (let along = 0; along < length; along += 1) {
      const row = space.origin.row + (columnWise ? along : line)
      const column = space.origin.column + (columnWise ? line : along)
      if (passOf(project, line, along, direction) === pass) {
        // Only a cell that holds a bead is marked: an empty one gets no ring or lift (ticket 411).
        const color = beadInSpace(project, space, row, column)
        if (color !== null) {
          beads.push({ ...positionBoxPx(space, project, row, column), color })
        }
      }
    }
  }
  return beads
}

// The beads of the current pass lifted above their neighbours (ticket 375): drawn again over the cells so on peyote and
// brick stitch, where the next row nests into the gaps, their corners aren't covered.
/** A bead's width and height, where they aren't a square of the drawn size (Right-angle weave). */
function sizedLike(box: { width: number; height: number }): { width?: number; height?: number } {
  return box.width === CELL_SIZE_PX && box.height === CELL_SIZE_PX ? {} : { width: box.width, height: box.height }
}

function drawLiftedBeads(context: DrawingContext, beads: readonly PassBead[], project: DrawnProject, zoom: number, pixelRatio: number, theme: ProjectTheme): void {
  const cornerRadius = beadRoundness(project.technique) * CELL_SIZE_PX
  for (const bead of beads) {
    drawFlatBead(context, { x: bead.x, y: bead.y, size: CELL_SIZE_PX, ...sizedLike(bead), cornerRadius, color: brighten(bead.color, CURRENT_ROW_BRIGHTNESS), dimmed: false, deviceScale: zoom * pixelRatio, theme })
  }
}

// The Row progress marker (tickets 352, 375, 376): a ring, MARKER_RING_PX thick, round each bead in the current pass,
// inside its cell so it never reaches a neighbour and two rings side by side stay two. No line joins them; one path,
// one stroke.
function drawBeadRings(context: DrawingContext, beads: readonly PassBead[], project: DrawnProject, theme: ProjectTheme): void {
  const corner = beadRoundness(project.technique) * CELL_SIZE_PX
  const half = MARKER_RING_PX / 2
  context.strokeStyle = theme.marker
  context.lineWidth = MARKER_RING_PX
  context.beginPath()
  for (const bead of beads) {
    roundedRect(context, bead.x + half, bead.y + half, bead.width - MARKER_RING_PX, bead.height - MARKER_RING_PX, Math.max(0, corner - half))
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

// The hover preview on each bead it names, inside the rim: its color at a faint opacity over what the bead holds (a
// pasted block in each bead's own colors), or with no color a 2px dark-ink outline. A color fills the bead's own shape,
// less what the next row's beads lie over.
function drawPreview(context: DrawingContext, project: DrawnProject, space: Space, preview: HoverPreview, theme: ProjectTheme): void {
  const { technique } = project
  const inset = BEAD_GAP_PX / 2
  const roundness = beadRoundness(technique) * CELL_SIZE_PX - inset

  for (const cell of preview.cells) {
    if (!inSpace(space, cell.row, cell.column) || !describeWeave(project).hasPosition(cell, project.frame)) {
      continue
    }
    const box = positionBoxPx(space, project, cell.row, cell.column)
    const x = box.x + inset
    const y = box.y + inset
    const width = box.width - BEAD_GAP_PX
    const height = box.height - BEAD_GAP_PX
    const color = cell.color ?? preview.color

    if (color) {
      const bead = { x, y, width, height, radius: Math.max(0, roundness) }
      fillFaintly(context, bead, color, nextRowBeads(project, space, cell, bead))
    } else {
      outlineBead(context, { x, y, width, height, radius: roundness }, theme)
    }
  }
}

/** A bead as drawn: where it sits and how big, with its corner radius. */
interface BeadRect {
  x: number
  y: number
  width: number
  height: number
  radius: number
}

// The beads of the next row that lie over this one as drawn (peyote's rows nest): none where rows stack. The next row
// sits half a bead over, so two of its beads reach this one.
function nextRowBeads(weave: Weave, space: Space, cell: GridPosition, bead: BeadRect): BeadRect[] {
  const pitch = rowPitchPx(weave.technique)
  if (pitch >= CELL_SIZE_PX) {
    return []
  }
  const shiftNow = shiftOf(space, weave, cell.row)
  const shiftNext = shiftOf(space, weave, cell.row + 1)
  const across = (((shiftNext - shiftNow) % CELL_SIZE_PX) + CELL_SIZE_PX) % CELL_SIZE_PX
  const beads: BeadRect[] = []
  for (const dx of [across - CELL_SIZE_PX, across]) {
    // The covering bead's own column in the next row; one the Project does not have is not drawn, so it covers nothing.
    const column = cell.column + (shiftNow + dx - shiftNext) / CELL_SIZE_PX
    if (inSpace(space, cell.row + 1, column)) {
      beads.push({ ...bead, x: bead.x + dx, y: bead.y + pitch })
    }
  }
  return beads
}

/** A bead-sized square (or rounded square, with a radius) in a color at the hover preview's faint opacity, leaving
 * out the beads lying over it. */
function fillFaintly(context: DrawingContext, { x, y, width, height, radius }: BeadRect, color: string, coveredBy: readonly BeadRect[] = []): void {
  context.globalAlpha = PREVIEW_OPACITY
  context.fillStyle = color
  if (coveredBy.length > 0) {
    context.save()
    context.beginPath()
    // The even-odd clip needs an outer rectangle bigger than the bead; the covering beads are holes in it.
    context.rect(x - CELL_SIZE_PX, y - CELL_SIZE_PX, width + 2 * CELL_SIZE_PX, height + 2 * CELL_SIZE_PX)
    for (const over of coveredBy) {
      roundedRect(context, over.x, over.y, over.width, over.height, over.radius)
    }
    context.clip('evenodd')
    context.beginPath()
    roundedRect(context, x, y, width, height, radius)
    context.fill()
    context.restore()
  } else if (radius > 0) {
    context.beginPath()
    roundedRect(context, x, y, width, height, radius)
    context.fill()
  } else {
    context.fillRect(x, y, width, height)
  }
  context.globalAlpha = 1
}

/** The hover preview's neutral look: a ring in the dark ink, as thick as PREVIEW_OUTLINE_PX, inside the bead's
 * rounded corners. */
function outlineBead(context: DrawingContext, { x, y, width, height, radius }: BeadRect, theme: ProjectTheme): void {
  const inset = PREVIEW_OUTLINE_PX
  context.fillStyle = theme.outline
  context.beginPath()
  roundedRect(context, x, y, width, height, Math.max(0, radius))
  roundedRect(context, x + inset, y + inset, width - 2 * inset, height - 2 * inset, Math.max(0, radius - inset))
  context.fill('evenodd')
}

// The pointer's marker (ticket 353): a bead 90% of the drawn size, centred on the pointer and looking like the hover
// preview. In the surface's px, so it follows zoom but not rotation; a pen has no CSS cursor, so one marker serves
// both.
function drawPointer(context: DrawingContext, technique: Technique, zoom: number, pixelRatio: number, pointer: BeadPointer, theme: ProjectTheme): void {
  const size = Math.max(0, CELL_SIZE_PX * zoom * POINTER_SCALE - POINTER_TRIM_PX)
  const x = pointer.x - size / 2
  const y = pointer.y - size / 2
  const radius = Math.max(0, beadRoundness(technique) * size)

  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
  if (pointer.color) {
    fillFaintly(context, { x, y, width: size, height: size, radius }, pointer.color)
  } else {
    outlineBead(context, { x, y, width: size, height: size, radius }, theme)
  }
}

/** How thick, in the Project's own px, the Selection's border is, inside the edge of the rectangle. */
const OUTLINE_PX = 2

// The Selection (ticket 414): the rectangle's outer border in the Selection colour, no wash. One rectangle round the
// beads, so on peyote and brick stitch (alternate rows half a bead over) it spans the furthest any row reaches. Handles
// are drawn later in the viewport's px.
function drawSelection(context: DrawingContext, project: DrawnProject, space: Space, selection: Selection, theme: ProjectTheme): void {
  const bottom = space.open ? selection.top + selection.rows - 1 : Math.min(selection.top + selection.rows - 1, space.rows - 1)
  const right = space.open ? selection.left + selection.columns - 1 : Math.min(selection.left + selection.columns - 1, space.columns - 1)
  const { x, y, width, height } = positionsBoxPx(space, project, selection.top, selection.left, bottom - selection.top + 1, right - selection.left + 1)

  context.fillStyle = theme.marker
  context.fillRect(x, y, width, OUTLINE_PX)
  context.fillRect(x, y + height - OUTLINE_PX, width, OUTLINE_PX)
  context.fillRect(x, y, OUTLINE_PX, height)
  context.fillRect(x + width - OUTLINE_PX, y, OUTLINE_PX, height)
}

// The beads a hovered "Mirror current" button would overwrite, faded (ticket 47): existing content stepping back. Each
// is drawn as the bead it is, faded over the paper, which covers the bead under it on the cells layer.
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
  const { technique } = project
  const visible = visibleBeadsInSpace(project, space, region, zoom, project.rotation)
  const cornerRadius = beadRoundness(technique) * CELL_SIZE_PX

  for (const { row, column } of cells) {
    if (!inSpace(space, row, column) || row < visible.firstRow || row > visible.lastRow) {
      continue
    }
    const box = positionBoxPx(space, project, row, column)
    drawFlatBead(context, {
      x: box.x,
      y: box.y,
      size: CELL_SIZE_PX,
      ...sizedLike(box),
      cornerRadius,
      color: beadInSpace(project, space, row, column),
      dimmed: true,
      backdrop: theme.background,
      deviceScale: zoom * pixelRatio,
      theme,
    })
  }
}

// The bead cursor (ticket 159; BeadCursor card): a ring in the theme's cursor color, 2px outside the bead (3px in high
// contrast), following its corners. Drawn last, over everything, so never hidden.
function drawCursor(context: DrawingContext, project: DrawnProject, space: Space, cursor: GridPosition, theme: ProjectTheme): void {
  const { technique } = project
  if (!inSpace(space, cursor.row, cursor.column)) {
    return
  }
  // The bead stands half the gap in from its cell; the ring starts 2px outside that.
  const offset = 2 - BEAD_GAP_PX / 2
  const width = theme.cursorWidth
  const box = positionBoxPx(space, project, cursor.row, cursor.column)
  const x = box.x - offset
  const y = box.y - offset
  const across = box.width + offset * 2
  const down = box.height + offset * 2
  const radius = beadRoundness(technique) * CELL_SIZE_PX + offset

  context.fillStyle = theme.cursor
  context.beginPath()
  roundedRect(context, x - width, y - width, across + width * 2, down + width * 2, radius + width)
  roundedRect(context, x, y, across, down, radius)
  context.fill('evenodd')
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
  const inset = BEAD_GAP_PX / 2
  const radius = Math.max(0, beadRoundness(technique) * CELL_SIZE_PX - inset)

  for (const { row, column } of marks.cells) {
    if (!inSpace(space, row, column)) {
      continue
    }
    const box = positionBoxPx(space, project, row, column)
    const x = box.x + inset
    const y = box.y + inset
    strokeTourMark(context, theme, () => {
      context.beginPath()
      roundedRect(context, x, y, box.width - BEAD_GAP_PX, box.height - BEAD_GAP_PX, radius)
      context.stroke()
    })
  }

  for (const box of marks.boxes) {
    const bottom = (space.open ? box.top + box.rows : Math.min(box.top + box.rows, rows)) - 1
    const right = (space.open ? box.left + box.columns : Math.min(box.left + box.columns, columns)) - 1
    const { x: left, y: top, height } = positionsBoxPx(space, project, box.top, box.left, bottom - box.top + 1, right - box.left + 1)
    const width = (right - box.left + 1) * CELL_SIZE_PX
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
  const own = describeWeave(project).countsUnits ? positionsBoxPx(space, project, space.origin.row, space.origin.column, space.rows, space.columns) : undefined
  const { width, height } = own ?? projectExtentPx(project.technique, space.columns, space.rows)
  const left = own?.x ?? space.origin.column * CELL_SIZE_PX
  const top = own?.y ?? rowTopPx(project.technique, space.origin.row)
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

/** Draws the overlay for the part of the Project in the region, clearing what was there first. The overlay is
 * transparent wherever nothing is drawn. */
export function renderOverlay(context: DrawingContext, input: OverlayInput): void {
  const { project, region, zoom, pixelRatio = 1, theme = DEFAULT_THEME, space = spaceOf(project, false), preview, selection, mirrorAxisCounts, dimmedCells, cursor, tourMarks, rulers, frameEditing, selectionHandles, pointer, rowMarks } = input

  context.setTransform(1, 0, 0, 1, 0, 0)
  context.clearRect(0, 0, region.width * pixelRatio, region.height * pixelRatio)

  const showRows = rowMarks ?? rowProgressOn(project)
  const axes = mirrorAxisCounts && (mirrorAxisCounts.columns > 0 || mirrorAxisCounts.rows > 0) ? mirrorAxisCounts : undefined
  const dimmed = dimmedCells && dimmedCells.length > 0 ? dimmedCells : undefined
  const marks = tourMarks && (tourMarks.cells.length > 0 || tourMarks.boxes.length > 0) ? tourMarks : undefined
  const ruled = space.open && rulers !== undefined && (project.frame !== undefined || Object.keys(project.beads).length > 0)
  if (!showRows && !preview && !selection && !axes && !dimmed && !cursor && !marks && !ruled && !frameEditing && !pointer) {
    return
  }

  setGridTransform(context, space.extent, region, zoom, project.rotation, pixelRatio)
  // Bitmaps of beads are made at the size they are on the screen, so they are blitted as they are, not resampled.
  context.imageSmoothingEnabled = false

  // From the bottom up, in the order the DOM grid stacked them: a bead faded, the Selection on it, the hover preview
  // over that, the marker lifted above its row, and Mirror's axes above everything.
  const inPass = showRows ? beadsInPass(project, space) : []
  if (showRows) {
    drawLiftedBeads(context, inPass, project, zoom, pixelRatio, theme)
  }
  if (dimmed) {
    drawDimmed(context, project, space, dimmed, region, zoom, pixelRatio, theme)
  }
  if (selection) {
    drawSelection(context, project, space, selection, theme)
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
      pixelRatio,
      theme,
      cursor,
      rowMarks: showRows,
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
  if (selection && selectionHandles && space.open && hasGuides(selection)) {
    drawBoxHandles(context, selectionHandles.surface.beadBox(selectionFrame(selection)), pixelRatio, theme, selectionHandles.touch)
  }
  if (pointer) {
    drawPointer(context, project.technique, zoom, pixelRatio, pointer, theme)
  }
}
