import { frameContains, type Rect } from '../domain/canvas'
import { namedPieces } from '../domain/pieceNames'
import { currentPass, frameRowOrder, rowProgressOn } from '../domain/rowProgress'
import type { DrawingContext } from './beadLook'
import type { RulerScale } from './rulerScale'
import type { RuledBox, RulerDot, RulerLabel, RulerLayout } from './rulers'
import type { SurfaceView } from './surfaceView'
import type { ProjectTheme } from './beadLook'
import type { DrawnProject } from './projectRenderer'
import { frameHandles, gutterHandles, type Handle } from './frameHandles'

/** The mono stack every number and label on the canvas is set in. */
const MONO_FONT = '"DM Mono", "JetBrains Mono", ui-monospace, monospace'

/** The corner radius of a piece's rectangle and of the Frame's line (BeadBoard and Frame cards). */
const PIECE_RADIUS_PX = 6
const FRAME_RADIUS_PX = 7
const PIECE_LINE_PX = 1
const FRAME_LINE_PX = 1.5

export interface RulerDrawInput {
  project: DrawnProject
  /** The view the layout was made for, to place the boxes' lines. */
  surface: SurfaceView
  /** What to draw; with its numbers off, the Pieces' rectangles go too, but the Frame's line is drawn either way. */
  layout: RulerLayout
  pixelRatio: number
  theme: ProjectTheme
  /** Whether the current row's number is bold. Defaults to `rowProgressOn(project)` (ticket 434). */
  rowMarks?: boolean
}

/** The box's line: a rounded rectangle just outside its outermost beads. */
function strokeBoxLine(context: DrawingContext, box: RuledBox, surface: SurfaceView, theme: ProjectTheme): void {
  const shown = surface.beadBox(box, box.kind === 'frame' ? 'frame' : 'canvas')
  const outset = box.outset
  const isFrame = box.kind === 'frame'
  context.setLineDash([])
  context.lineWidth = isFrame ? FRAME_LINE_PX : PIECE_LINE_PX
  context.strokeStyle = isFrame ? theme.frameLine : theme.pieceLine
  context.beginPath()
  context.roundRect(shown.x - outset, shown.y - outset, shown.width + outset * 2, shown.height + outset * 2, isFrame ? FRAME_RADIUS_PX : PIECE_RADIUS_PX)
  context.stroke()
}

/** One Ruler dot: the number's colours, every 5th bolder; its radius follows the zoom (ticket 377). */
function drawDot(context: DrawingContext, dot: RulerDot, scale: RulerScale, theme: ProjectTheme): void {
  context.fillStyle = dot.fifth ? theme.rulerStrong : theme.ruler
  context.beginPath()
  context.arc(dot.x, dot.y, dot.fifth ? scale.fifthDotRadius : scale.dotRadius, 0, Math.PI * 2)
  context.fill()
}

/** One ruler number, in the style its role asks for (Rulers card). */
function drawLabel(context: DrawingContext, label: RulerLabel, fontPx: number, project: DrawnProject, theme: ProjectTheme, rowMarks: boolean): void {
  const { direction } = project.rowProgress
  const frame = project.frame
  const relative = frame ? (label.axis === 'row' ? label.position - frame.row : label.position - frame.column) : -1
  const currentLine = frameRowOrder(project).lineOf(currentPass(project.rowProgress))
  const current = rowMarks && frame && ((label.axis === 'row' && direction === 'rows' && relative === currentLine) || (label.axis === 'column' && direction === 'columns' && relative === currentLine))

  const weight = current || label.fifth ? 700 : 400
  context.font = `${weight} ${fontPx}px ${MONO_FONT}`
  context.fillStyle = current ? theme.marker : label.fifth ? theme.rulerStrong : theme.ruler
  context.textAlign = 'center'
  context.textBaseline = 'middle'

  if (label.turned) {
    context.save()
    context.translate(label.x, label.y)
    context.rotate(-Math.PI / 2)
    context.fillText(label.text, 0, 0)
    context.restore()
  } else {
    context.fillText(label.text, label.x, label.y)
  }
}

/** Draws the lines and the Ruler layout's numbers and dots, in the viewport's own px over whatever is drawn. */
export function drawRulers(context: DrawingContext, input: RulerDrawInput): void {
  const { project, surface, layout, pixelRatio, theme, rowMarks = rowProgressOn(project) } = input
  const { fontPx } = layout.scale
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)

  for (const box of layout.boxes) {
    // With Rulers off a Piece's rectangle goes with its numbers; the Frame's line never does.
    if (layout.numbers || box.kind === 'frame') {
      strokeBoxLine(context, box, surface, theme)
    }
  }
  for (const dot of layout.dots) {
    drawDot(context, dot, layout.scale, theme)
  }
  for (const label of layout.labels) {
    drawLabel(context, label, fontPx, project, theme, rowMarks)
  }
  drawPieceNames(context, input)
}

/** The gap between a named Piece's rectangle and its name below it. */
const NAME_GAP_PX = 4

// The name of each unframed Schema (a named Piece, ADR 0050), under its beads at the left edge, in the Frame's line
// color; read at any zoom.
function drawPieceNames(context: DrawingContext, { project, surface, layout, theme }: RulerDrawInput): void {
  // The Frame's name, when it was made from a named Piece (ticket 489), stands under the Frame as a Piece's does.
  const frame = project.frame
  const covered = (piece: Rect) =>
    frame !== undefined && frameContains(frame, piece) && frameContains(frame, { row: piece.row + piece.rows - 1, column: piece.column + piece.columns - 1 })
  const pieces: (Rect & { name: string; layer: 'canvas' | 'frame' })[] = namedPieces(project)
    .filter((piece) => !covered(piece))
    .map((piece) => ({ ...piece, layer: 'canvas' as const }))
  if (project.frame?.name) {
    pieces.push({ ...project.frame, name: project.frame.name, layer: 'frame' })
  }
  if (pieces.length === 0) {
    return
  }
  const fontPx = Math.max(layout.scale.fontPx, 11)
  context.font = `600 ${fontPx}px ${MONO_FONT}`
  context.fillStyle = theme.frameLine
  context.textAlign = 'left'
  context.textBaseline = 'top'
  for (const piece of pieces) {
    const shown = surface.beadBox(piece, piece.layer)
    if (shown.x > surface.viewport.width || shown.y > surface.viewport.height || shown.x + shown.width < 0 || shown.y + shown.height < 0) {
      continue
    }
    context.fillText(piece.name, shown.x, shown.y + shown.height + layout.scale.pieceOutset + NAME_GAP_PX)
  }
}


/** The size tooltip's look (Frame card): `ink` on the canvas, 12px mono, at the Frame's bottom-right corner. */
const TOOLTIP_PAD_X = 8
const TOOLTIP_HEIGHT = 24
const TOOLTIP_GAP = 10

/** The handles given, in the viewport's px: squares with a 1.5px `frameLine` edge, filled with the canvas. */
function drawHandles(context: DrawingContext, handles: readonly Handle[], theme: ProjectTheme): void {
  context.setLineDash([])
  context.lineWidth = FRAME_LINE_PX
  context.strokeStyle = theme.frameLine
  context.fillStyle = theme.canvas
  for (const handle of handles) {
    context.beginPath()
    context.roundRect(handle.x - handle.size / 2, handle.y - handle.size / 2, handle.size, handle.size, 2)
    context.fill()
    context.stroke()
  }
}

/** The Selection's handles (ticket 414): the Frame's own squares, over a Selection's box in the viewport's px. */
export function drawBoxHandles(context: DrawingContext, box: { x: number; y: number; width: number; height: number }, pixelRatio: number, theme: ProjectTheme, touch: boolean): void {
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
  drawHandles(context, frameHandles(box, touch), theme)
}

// What the Frame carries while being set (Frame card): its handles, the size tooltip at the bottom-right, in viewport
// px over all else.
export function drawFrameEditing(context: DrawingContext, input: { frame: Rect; surface: SurfaceView; pixelRatio: number; theme: ProjectTheme; touch: boolean; tooltip: string }): void {
  const { frame, surface, pixelRatio, theme, touch, tooltip } = input
  const { viewport } = surface
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
  const box = surface.frameBox(frame)

  drawHandles(context, gutterHandles(box, touch, viewport), theme)

  if (tooltip === '') {
    return
  }
  context.font = `500 12px ${MONO_FONT}`
  const width = tooltip.length * 12 * 0.6 + TOOLTIP_PAD_X * 2
  const x = Math.min(box.x + box.width - width, viewport.width - width - 4)
  const y = Math.min(box.y + box.height + TOOLTIP_GAP, viewport.height - TOOLTIP_HEIGHT - 4)
  context.fillStyle = theme.frameLine
  context.beginPath()
  context.roundRect(Math.max(4, x), Math.max(4, y), width, TOOLTIP_HEIGHT, 6)
  context.fill()
  context.fillStyle = theme.canvas
  context.textAlign = 'left'
  context.textBaseline = 'middle'
  context.fillText(tooltip, Math.max(4, x) + TOOLTIP_PAD_X, Math.max(4, y) + TOOLTIP_HEIGHT / 2)
}
