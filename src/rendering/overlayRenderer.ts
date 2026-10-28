import { type GridPosition, type PreviewCell } from '../domain/grid'
import { type Technique, type Weave } from '../domain/weave'
import { footprintOf } from '../domain/footprint'
import { MARGIN, withMargin } from '../domain/margin'
import { beadRoundness, describeWeave, type BeadCell } from '../domain/weave'
import { frameLayoutOf, rowOrderOf } from '../domain/frameKind'
import { centredBead, layoutBeadPx, placedLayout, type PlacedLayout } from './customFrameView'
import { frameContains, type Rect, type FrameSheet } from '../domain/canvas'
import { canvasWeave, frameWeave } from '../domain/layerWeave'
import { currentPass, rowProgressOn } from '../domain/rowProgress'
import { cellKey, selectionFrame, selectionHasHandles, selectionLayer as selectionLayerOf, type Selection } from '../domain/selection'
import { brighten, CURRENT_ROW_BRIGHTNESS, DEFAULT_THEME, drawBeadLetter, drawFlatBead, type DrawingContext, type ProjectTheme } from './beadLook'
import { beadInSpace, inSpace, spaceOf, type Space } from './space'
import { drawBoxHandles, drawFrameEditing, drawRulers } from './rulerRenderer'
import type { DrawnProject } from './projectRenderer'
import type { RulerLayout } from './rulers'
import { CELL_SIZE_PX } from './cellSize'
import { frameOriginPx, gridBox, positionBoxPx, positionsBoxPx, setGridTransform, type Region, type SurfaceView } from './surfaceView'
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
  /** The beads it is on: the hovered one, or every bead of a block about to be pasted. */
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
  /** The layer the pointer is over (ticket 492): the marker is shaped like that layer's beads. The Canvas's when none. */
  layer?: 'canvas' | 'frame'
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
  // Where positions live, from `spaceOf`, as the base layer was drawn. On the Canvas (ADR 0026) any position can carry
  // a preview or Selection; in Frame-only space (default) the Project is the Frame alone, drawn from its first
  // bead.
  space?: Space
  /** The rulers and their lines (Canvas only): the Frame's line or each piece's rectangle; `surface` is the view the
   * layout was made for. */
  rulers?: { layout: RulerLayout; surface: SurfaceView }
  /** While the Frame is being set (Canvas only): its handles and the size tooltip's text. `touch` gives four larger
   * corner handles. */
  frameEditing?: { touch: boolean; tooltip: string }
  /** How visible the Frame's margin outline is, 0 to 1 (ticket 276): it fades in while the Frame is set, moved or
   * resized, and after a refused press. */
  marginOutline?: number
  /** How many positions wide the margin outline stands out from the Frame (ticket 459): wider when zoomed out.
   * Defaults to `MARGIN`. */
  margin?: number
  /** The Swatch letters by hex when Letters is on (ticket 0573): the current row's lifted beads carry theirs, as the
   * base layer's do. */
  letters?: Readonly<Record<string, string>>
}

/** A bead the current pass weaves: its cell, top left, and its color; on a Custom frame (ticket 0594) its box is centred
 * on 0, 0 and drawn turned to `angle` at `centre`. */
interface PassBead {
  x: number
  y: number
  width: number
  height: number
  color: string
  turned?: { centre: { x: number; y: number }; angle: number; radius: number }
}

/** Draws a pass bead where it lies: in place, or on a Custom frame turned about its centre. */
function inPlace(context: DrawingContext, bead: PassBead, draw: () => void): void {
  if (!bead.turned) {
    draw()
    return
  }
  context.save()
  context.translate(bead.turned.centre.x, bead.turned.centre.y)
  context.rotate(bead.turned.angle)
  draw()
  context.restore()
}

/** The beads the current pass weaves, in order along the line (on peyote's later lines only half the line is); none
 * when the Frame has no such pass. */
function beadsInPass(project: DrawnProject, space: Space): PassBead[] {
  if (!space.hasFrame) {
    return []
  }
  const weave = frameWeave(project)
  const frame = project.frame
  // The Frame's Row order, or one over the Project drawn alone, measured as its space is.
  const order = rowOrderOf({ ...weave, kind: frame?.kind, settings: frame?.settings, quarterTurns: frame?.quarterTurns, rows: space.rows, columns: space.columns }, project.rowProgress)
  const placed = frame && placedLayout(frame, weave)
  if (placed) {
    // A Custom frame's pass is its layout's beads, named by round and place, each at its panel's angle (ticket 0594).
    const box = centredBead(placed)
    const radius = beadRoundness(weave.technique, weave.cell) * placed.scale
    return order.positionsOf(currentPass(project.rowProgress)).flatMap((position) => {
      const color = frame.beads[position.row]?.[position.column] ?? null
      const at = layoutBeadPx(placed, position)
      return color === null || !at ? [] : [{ ...box, color, turned: { centre: { x: at.x, y: at.y }, angle: at.angle, radius } }]
    })
  }
  return order.positionsOf(currentPass(project.rowProgress)).flatMap((position) => {
    const row = space.origin.row + position.row
    const column = space.origin.column + position.column
    // Only a cell that holds a bead is marked: an empty one gets no ring or lift (ticket 411).
    const color = beadInSpace(project, space, row, column)
    return color === null ? [] : [{ ...positionBoxPx(weave, row, column), color }]
  })
}

// The beads of the current pass lifted above their neighbours (ticket 375): drawn again over the cells so on peyote and
// brick stitch, where the next row nests into the gaps, their corners aren't covered.
/** A bead's width and height, where they aren't a square of the drawn size (Right-angle weave). */
function sizedLike(box: { width: number; height: number }): { width?: number; height?: number } {
  return box.width === CELL_SIZE_PX && box.height === CELL_SIZE_PX ? {} : { width: box.width, height: box.height }
}

function drawLiftedBeads(context: DrawingContext, beads: readonly PassBead[], weave: Weave, zoom: number, pixelRatio: number, theme: ProjectTheme, letters?: Readonly<Record<string, string>>): void {
  const cornerRadius = beadRoundness(weave.technique, weave.cell) * CELL_SIZE_PX
  for (const bead of beads) {
    const size = bead.turned ? { size: bead.width, width: bead.width, height: bead.height } : { size: CELL_SIZE_PX, ...sizedLike(bead) }
    const radius = bead.turned?.radius ?? cornerRadius
    inPlace(context, bead, () => {
      drawFlatBead(context, { x: bead.x, y: bead.y, ...size, cornerRadius: radius, color: brighten(bead.color, CURRENT_ROW_BRIGHTNESS), dimmed: false, deviceScale: zoom * pixelRatio, theme })
      const letter = letters?.[bead.color]
      if (letter) {
        drawBeadLetter(context, { x: bead.x, y: bead.y, ...size, color: brighten(bead.color, CURRENT_ROW_BRIGHTNESS), letter, dimmed: false, theme })
      }
    })
  }
}

// The Row progress marker (tickets 352, 375, 376): a ring, MARKER_RING_PX thick, round each bead in the current pass,
// inside its cell so it never reaches a neighbour and two rings side by side stay two. No line joins them; one path,
// one stroke.
function drawBeadRings(context: DrawingContext, beads: readonly PassBead[], weave: Weave, theme: ProjectTheme): void {
  const corner = beadRoundness(weave.technique, weave.cell) * CELL_SIZE_PX
  const half = MARKER_RING_PX / 2
  context.strokeStyle = theme.marker
  context.lineWidth = MARKER_RING_PX
  context.beginPath()
  for (const bead of beads.filter(({ turned }) => !turned)) {
    roundedRect(context, bead.x + half, bead.y + half, bead.width - MARKER_RING_PX, bead.height - MARKER_RING_PX, Math.max(0, corner - half))
  }
  context.stroke()
  // A Custom frame's beads each lie at their panel's angle (ticket 0594): a ring apiece, turned with it.
  for (const bead of beads.filter(({ turned }) => turned)) {
    inPlace(context, bead, () => {
      context.beginPath()
      roundedRect(context, bead.x + half, bead.y + half, bead.width - MARKER_RING_PX, bead.height - MARKER_RING_PX, Math.max(0, bead.turned!.radius - half))
      context.stroke()
    })
  }
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
function drawPreview(context: DrawingContext, weave: Weave, bounds: Rect | undefined, space: Space, cells: readonly PreviewCell[], preview: HoverPreview, theme: ProjectTheme): void {
  const { technique } = weave
  const inset = BEAD_GAP_PX / 2
  const roundness = beadRoundness(technique, weave.cell) * CELL_SIZE_PX - inset

  for (const cell of cells) {
    if (!inSpace(space, cell.row, cell.column) || !describeWeave(weave).hasPosition(cell, bounds)) {
      continue
    }
    const box = positionBoxPx(weave, cell.row, cell.column)
    const x = box.x + inset
    const y = box.y + inset
    const width = box.width - BEAD_GAP_PX
    const height = box.height - BEAD_GAP_PX
    const color = cell.color ?? preview.color

    if (color) {
      const bead = { x, y, width, height, radius: Math.max(0, roundness) }
      fillFaintly(context, bead, color, nextRowBeads(weave, space, cell, bead))
    } else {
      outlineBead(context, { x, y, width, height, radius: roundness }, theme)
    }
  }
}

/** The hover preview on a Custom frame's beads (ticket 0592): the same look, each bead turned to its panel's angle at
 * the place its layout gives it. */
function drawLayoutPreview(context: DrawingContext, placed: PlacedLayout, roundness: number, cells: readonly PreviewCell[], preview: HoverPreview, theme: ProjectTheme): void {
  const box = centredBead(placed)
  const bead = { x: box.x + BEAD_GAP_PX / 2, y: box.y + BEAD_GAP_PX / 2, width: box.width - BEAD_GAP_PX, height: box.height - BEAD_GAP_PX, radius: Math.max(0, roundness * placed.scale - BEAD_GAP_PX / 2) }
  for (const cell of cells) {
    const at = layoutBeadPx(placed, cell)
    if (!at) {
      continue
    }
    const color = cell.color ?? preview.color
    context.save()
    context.translate(at.x, at.y)
    context.rotate(at.angle)
    if (color) {
      fillFaintly(context, bead, color)
    } else {
      outlineBead(context, bead, theme)
    }
    context.restore()
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

// The beads of the next row that lie over this one as drawn (peyote's rows nest): none where rows stack. Each is drawn
// in as far from its box as this bead is.
function nextRowBeads(weave: Weave, space: Space, cell: GridPosition, bead: BeadRect): BeadRect[] {
  const own = positionBoxPx(weave, cell.row, cell.column)
  const description = describeWeave(weave)
  const beads: BeadRect[] = []
  for (const column of [cell.column - 1, cell.column, cell.column + 1]) {
    const next = positionBoxPx(weave, cell.row + 1, column)
    const overlaps = next.x < own.x + own.width && next.x + next.width > own.x && next.y < own.y + own.height && next.y + next.height > own.y
    // One the Project does not have is not drawn, so it covers nothing.
    if (overlaps && inSpace(space, cell.row + 1, column) && description.hasPosition({ row: cell.row + 1, column })) {
      beads.push({ ...bead, x: bead.x + next.x - own.x, y: bead.y + next.y - own.y })
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
function drawPointer(context: DrawingContext, technique: Technique, cell: BeadCell | undefined, zoom: number, pixelRatio: number, pointer: BeadPointer, theme: ProjectTheme): void {
  const size = Math.max(0, CELL_SIZE_PX * zoom * POINTER_SCALE - POINTER_TRIM_PX)
  const x = pointer.x - size / 2
  const y = pointer.y - size / 2
  const radius = Math.max(0, beadRoundness(technique, cell) * size)

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
function drawSelection(context: DrawingContext, weave: Weave, space: Space, selection: Selection, theme: ProjectTheme): void {
  if (selection.cells) {
    drawShapeOutline(context, weave, selection.cells, theme)
    return
  }
  const bottom = space.open ? selection.top + selection.rows - 1 : Math.min(selection.top + selection.rows - 1, space.rows - 1)
  const right = space.open ? selection.left + selection.columns - 1 : Math.min(selection.left + selection.columns - 1, space.columns - 1)
  const { x, y, width, height } = positionsBoxPx(weave, selection.top, selection.left, bottom - selection.top + 1, right - selection.left + 1)

  context.fillStyle = theme.marker
  context.fillRect(x, y, width, OUTLINE_PX)
  context.fillRect(x, y + height - OUTLINE_PX, width, OUTLINE_PX)
  context.fillRect(x, y, OUTLINE_PX, height)
  context.fillRect(x + width - OUTLINE_PX, y, OUTLINE_PX, height)
}

// A shaped Selection (ticket 547): each cell's side that no other cell of the shape lies across is part of the outline,
// so it runs round the outside and round each hole.
function drawShapeOutline(context: DrawingContext, weave: Weave, cells: readonly GridPosition[], theme: ProjectTheme): void {
  const has = new Set(cells.map((cell) => cellKey(cell.row, cell.column)))
  const next = (cell: GridPosition, rows: number, columns: number) => has.has(cellKey(cell.row + rows, cell.column + columns))
  context.fillStyle = theme.marker
  for (const cell of cells) {
    const { x, y, width, height } = positionsBoxPx(weave, cell.row, cell.column, 1, 1)
    if (!next(cell, -1, 0)) context.fillRect(x, y, width, OUTLINE_PX)
    if (!next(cell, 1, 0)) context.fillRect(x, y + height - OUTLINE_PX, width, OUTLINE_PX)
    if (!next(cell, 0, -1)) context.fillRect(x, y, OUTLINE_PX, height)
    if (!next(cell, 0, 1)) context.fillRect(x + width - OUTLINE_PX, y, OUTLINE_PX, height)
  }
}

/** The Frame margin's outline (ticket 276, Frame card): 1px dashed `line-strong` round its outer edge, radius 12,
 * faded by `opacity`. Drawn in grid space, so its widths are divided by the zoom to stay screen px. */
const MARGIN_OUTLINE_DASH_PX = [4, 3]
const MARGIN_OUTLINE_RADIUS_PX = 12

/** Strokes the box round the margin's drawn extent on the Canvas (ticket 372): peyote rows nest closer than a bead is
 * tall, and offset techniques add half a bead across, so it is not `rows * CELL_SIZE_PX`. */
function drawMarginOutline(context: DrawingContext, weave: Weave, frame: Rect, zoom: number, opacity: number, theme: ProjectTheme, margin: number): void {
  const { x, y, width, height } = gridBox(weave, withMargin(frame, margin))
  context.save()
  context.globalAlpha = opacity
  context.strokeStyle = theme.pieceLine
  context.lineWidth = 1 / zoom
  context.setLineDash(MARGIN_OUTLINE_DASH_PX.map((length) => length / zoom))
  context.beginPath()
  roundedRect(context, x, y, width, height, MARGIN_OUTLINE_RADIUS_PX / zoom)
  context.stroke()
  context.restore()
}

/** Whether a position of the Canvas is on the Frame (ticket 492): the layer it names, or else whether it lies under what
 * the Frame draws (ADR 0066). */
function onFrame(frame: FrameSheet | undefined, covered: Rect | undefined, position: GridPosition): boolean {
  if (frame === undefined) return false
  // A Custom frame's positions are named by round and place, which its rectangle does not bound (ticket 0592).
  return position.layer ? position.layer === 'frame' && (frameLayoutOf(frame) !== undefined || frameContains(frame, position)) : covered !== undefined && frameContains(covered, position)
}

/** The Frame's positions counted from its own first (ticket 492): a position of the Canvas that lies on it, or the cell
 * as it is. */
function inFrameTerms<T extends GridPosition>(frame: FrameSheet, cell: T): T {
  return { ...cell, row: cell.row - frame.row, column: cell.column - frame.column }
}

/** Draws the overlay for the part of the Project in the region, clearing what was there first. Transparent wherever
 * nothing is drawn. On the Canvas it goes a layer at a time (ticket 492): the Canvas's in its Weave, then the Frame's
 * in its own from its first position's corner, its items counted from its first position. */
export function renderOverlay(context: DrawingContext, input: OverlayInput): void {
  const { project, region, zoom, pixelRatio = 1, theme = DEFAULT_THEME, space = spaceOf(project, false), preview, selection, rulers, frameEditing, selectionHandles, marginOutline = 0, margin = MARGIN, pointer, rowMarks, letters } = input

  context.setTransform(1, 0, 0, 1, 0, 0)
  context.clearRect(0, 0, region.width * pixelRatio, region.height * pixelRatio)

  const showRows = rowMarks ?? rowProgressOn(project)
  const ruled = space.open && rulers !== undefined && (project.frame !== undefined || Object.keys(project.beads).length > 0)
  if (!showRows && !preview && !selection && !ruled && !frameEditing && !pointer && !(marginOutline > 0)) {
    return
  }

  setGridTransform(context, space.extent, region, zoom, project.rotation, pixelRatio)
  // Bitmaps of beads are made at the size they are on the screen, so they are blitted as they are, not resampled.
  context.imageSmoothingEnabled = false

  const frame = space.open ? project.frame : undefined
  const covered = footprintOf(project)
  const canvasWeaveOf = canvasWeave(project)
  const frameSpace = frame ? spaceOf(project, false) : undefined

  // The Canvas's items: all of them when it is the only layer, else those not on the Frame.
  const offFrame = <T extends GridPosition>(cells: readonly T[]): T[] => cells.filter((cell) => !onFrame(frame, covered, cell))
  const ownLayer: 'canvas' | 'frame' = space.open ? (selection ? selectionLayerOf(project, selection) : 'canvas') : 'frame'
  const canvasSelection = selection && ownLayer === 'canvas' ? selection : undefined
  const canvasPreview = preview && { ...preview, cells: offFrame(preview.cells) }

  if (space.open && marginOutline > 0 && project.frame) {
    drawMarginOutline(context, canvasWeaveOf, covered!, zoom, marginOutline, theme, margin)
  }

  // From the bottom up, in the order the DOM grid stacked them: a bead faded, the Selection on it, the hover preview
  // over that, and the marker lifted above its row.
  if (space.open) {
    if (canvasSelection) drawSelection(context, canvasWeaveOf, space, canvasSelection, theme)
    if (canvasPreview?.cells.length) drawPreview(context, canvasWeaveOf, project.frame, space, canvasPreview.cells, canvasPreview, theme)
  }

  // The Frame's layer, or the Project drawn alone.
  const sheetSpace = space.open ? frameSpace : space
  if (sheetSpace && (frame || !space.open)) {
    const sheetWeave = frameWeave(project)
    const origin = frame ? frameOriginPx(canvasWeaveOf, frame) : { x: 0, y: 0 }
    const local = <T extends GridPosition>(cell: T): T => (frame ? inFrameTerms(frame, cell) : cell)
    const onSheet = <T extends GridPosition>(cells: readonly T[]): T[] => (frame ? cells.filter((cell) => onFrame(frame, covered, cell)).map(local) : [...cells])
    const sheetBounds = space.open ? { row: 0, column: 0, rows: sheetSpace.rows, columns: sheetSpace.columns } : project.frame
    const sheetSelection = selection && ownLayer === 'frame' ? (frame ? { ...selection, top: selection.top - frame.row, left: selection.left - frame.column, ...(selection.cells ? { cells: selection.cells.map(local) } : {}) } : selection) : undefined
    context.save()
    context.translate(origin.x, origin.y)
    const inPass = showRows ? beadsInPass(project, sheetSpace) : []
    if (showRows) {
      drawLiftedBeads(context, inPass, sheetWeave, zoom, pixelRatio, theme, letters)
    }
    if (sheetSelection) drawSelection(context, sheetWeave, sheetSpace, sheetSelection, theme)
    const sheetCells = preview && onSheet(preview.cells)
    const placed = project.frame && placedLayout(project.frame, sheetWeave)
    if (preview && sheetCells?.length) {
      if (placed) drawLayoutPreview(context, placed, beadRoundness(sheetWeave.technique, sheetWeave.cell), sheetCells, preview, theme)
      else drawPreview(context, sheetWeave, sheetBounds, sheetSpace, sheetCells, preview, theme)
    }
    if (inPass.length > 0) {
      drawBeadRings(context, inPass, sheetWeave, theme)
    }
    context.restore()
  }

  // The rulers are laid out in the viewport's own px, over everything the grid-space drawing above made.
  if (ruled && rulers) {
    drawRulers(context, {
      project,
      surface: rulers.surface,
      layout: rulers.layout,
      pixelRatio,
      theme,
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
  if (selection && selectionHandles && space.open && selectionHasHandles(selection)) {
    drawBoxHandles(context, selectionHandles.surface.beadBox(selectionFrame(selection), ownLayer), pixelRatio, theme, selectionHandles.touch)
  }
  if (pointer) {
    const pointerWeave = pointer.layer === 'frame' ? frameWeave(project) : canvasWeaveOf
    drawPointer(context, pointerWeave.technique, pointerWeave.cell, zoom, pixelRatio, pointer, theme)
  }
}
