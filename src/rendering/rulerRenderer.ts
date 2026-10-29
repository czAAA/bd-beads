import { frameContains, type Rect } from '../domain/canvas'
import { laidFrame } from '../domain/frameOrientation'
import { currentPass, frameRowOrder, rowProgressOf, rowProgressOn } from '../domain/rowProgress'
import type { DrawingContext } from './beadLook'
import type { RulerScale } from './rulerScale'
import type { RuledBox, RulerDot, RulerLabel, RulerLayout } from './rulers'
import type { SurfaceView } from './surfaceView'
import type { ProjectTheme } from './beadLook'
import type { DrawnProject } from './projectRenderer'
import { frameHandles, type Handle, type HandleId } from './frameHandles'
import { frameOf } from '../domain/layerRecord'

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
  const { direction } = rowProgressOf(project)
  const frame = frameOf(project)
  const relative = frame ? (label.axis === 'row' ? label.position - frame.row : label.position - frame.column) : -1
  const currentLine = frameRowOrder(project).lineOf(currentPass(rowProgressOf(project)))
  // A turned Frame's rulers count the cells it covers, not its own rows (ticket 0667): no line of them is the current one.
  const current = rowMarks && frame && !frame.quarterTurns && ((label.axis === 'row' && direction === 'rows' && relative === currentLine) || (label.axis === 'column' && direction === 'columns' && relative === currentLine))

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
  const { project, surface, layout, pixelRatio, rowMarks = rowProgressOn(project) } = input
  // Once there is a Frame its rulers are the only ones, and they sit on its margin sheet (ticket 0656).
  const theme = frameOf(project) ? { ...input.theme, ruler: input.theme.margin.ruler, rulerStrong: input.theme.margin.rulerStrong } : input.theme
  const { fontPx } = layout.scale
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)

  for (const box of layout.boxes) {
    strokeBoxLine(context, box, surface, theme)
  }
  for (const dot of layout.dots) {
    drawDot(context, dot, layout.scale, theme)
  }
  for (const label of layout.labels) {
    drawLabel(context, label, fontPx, project, theme, rowMarks)
  }
  if (rowMarks && layout.rowPointer) drawRowPointer(context, input, theme)
  drawPieceNames(context, input)
}

/** The row pointer's size and its gap to the row numbers (MarginSheet card). */
const POINTER_LENGTH_PX = 9
const POINTER_WIDTH_PX = 12
const POINTER_GAP_PX = 4

// The current pass's pointer (MarginSheet card, ticket 0657): a `marker` triangle on the margin sheet, 4px outside the
// numbers, pointing at the pass: in the left band for a pass running across the screen, in the top band for one
// running down it. None for a Custom frame, whose passes are no line, nor once every pass is done.
function drawRowPointer(context: DrawingContext, { project, surface, layout }: RulerDrawInput, theme: ProjectTheme): void {
  const frame = frameOf(project)
  const box = layout.boxes.find((ruled) => ruled.kind === 'frame')
  const order = frameRowOrder(project)
  const pass = currentPass(rowProgressOf(project))
  const line = pass < order.count ? order.lineOf(pass) : undefined
  if (!frame || !box || line === undefined) return
  const columns = rowProgressOf(project).direction === 'columns'
  const first = surface.beadToPoint(columns ? { row: frame.row, column: frame.column + line } : { row: frame.row + line, column: frame.column }, 'frame')
  const along = surface.beadStep('frame')[columns ? 'row' : 'column']
  // A Frame lying a quarter round runs its own rows the other way on screen (ticket 0667).
  const across = Math.abs(along.x) >= Math.abs(along.y) !== ((frame.quarterTurns ?? 0) % 2 === 1)
  const shown = surface.beadBox(box, 'frame')
  context.fillStyle = theme.marker
  context.beginPath()
  if (across) {
    const lineLeft = shown.x - box.outset
    const edges = layout.labels.filter((label) => label.x < lineLeft).map((label) => label.x - label.width / 2)
    const tip = Math.min(lineLeft, ...edges) - POINTER_GAP_PX
    context.moveTo(tip, first.y)
    context.lineTo(tip - POINTER_LENGTH_PX, first.y - POINTER_WIDTH_PX / 2)
    context.lineTo(tip - POINTER_LENGTH_PX, first.y + POINTER_WIDTH_PX / 2)
  } else {
    const lineTop = shown.y - box.outset
    const edges = layout.labels.filter((label) => label.y < lineTop).map((label) => label.y - label.height / 2)
    const tip = Math.min(lineTop, ...edges) - POINTER_GAP_PX
    context.moveTo(first.x, tip)
    context.lineTo(first.x - POINTER_WIDTH_PX / 2, tip - POINTER_LENGTH_PX)
    context.lineTo(first.x + POINTER_WIDTH_PX / 2, tip - POINTER_LENGTH_PX)
  }
  context.closePath()
  context.fill()
}

/** The gap between a named Piece's rectangle and its name below it. */
const NAME_GAP_PX = 4

// The name of each unframed Schema (a named Piece, ADR 0050), under its beads at the left edge, in the Frame's line
// color; read at any zoom.
function drawPieceNames(context: DrawingContext, { project, surface, layout, theme }: RulerDrawInput): void {
  // The Frame's name, when it was made from a named Piece (ticket 489), stands under the Frame as a Piece's does.
  // A turned Frame's name stands under it as it lies (ticket 0667).
  const frame = laidFrame(project)
  const covered = (piece: Rect) =>
    frame !== undefined && frameContains(frame, piece) && frameContains(frame, { row: piece.row + piece.rows - 1, column: piece.column + piece.columns - 1 })
  const pieces: (Rect & { name: string; layer: 'canvas' | 'frame' })[] = layout.named
    .filter((piece) => !covered(piece))
    .map((piece) => ({ ...piece, layer: 'canvas' as const }))
  const name = frameOf(project)?.name
  if (frame && name) {
    pieces.push({ ...frame, name, layer: 'frame' })
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

// Edit Frame's hot corners (MarginSheet card, ticket 0657), in screen px: an `accent` bracket at each corner of the
// Frame's line, a bar at each edge's middle, and the corner under the pointer grown on a faint disc.
const BRACKET_ARM_PX = 14
const BRACKET_LINE_PX = 3
const HOT_ARM_PX = 18
const HOT_LINE_PX = 4
const HOT_DISC_RADIUS_PX = 16
const HOT_DISC_ALPHA = 0.18
const BRACKET_RADIUS_PX = 4
/** How far outside the line a bracket's stroke starts. */
const BRACKET_OFFSET_PX = 3
const EDGE_BAR_LENGTH_PX = 12
const EDGE_BAR_THICKNESS_PX = 4

/** Which way a handle's corner opens, toward the Frame's inside: +1 or -1 on each axis, 0 along an edge. */
function inward(id: HandleId): { x: number; y: number } {
  return { x: id.includes('left') ? 1 : id.includes('right') ? -1 : 0, y: id.startsWith('top') ? 1 : id.startsWith('bottom') ? -1 : 0 }
}

/** One handle: a bracket round a corner, a bar along an edge's middle; `hot`, grown on its disc. */
function drawHotHandle(context: DrawingContext, handle: Handle, hot: boolean, theme: ProjectTheme): void {
  const into = inward(handle.id)
  context.fillStyle = theme.accent
  context.strokeStyle = theme.accent
  if (into.x === 0 || into.y === 0) {
    // An edge's bar, just outside the line, along it.
    const along = into.x === 0
    const width = along ? EDGE_BAR_LENGTH_PX : EDGE_BAR_THICKNESS_PX
    const height = along ? EDGE_BAR_THICKNESS_PX : EDGE_BAR_LENGTH_PX
    const x = handle.x - width / 2 - into.x * EDGE_BAR_THICKNESS_PX / 2
    const y = handle.y - height / 2 - into.y * EDGE_BAR_THICKNESS_PX / 2
    context.beginPath()
    context.roundRect(x, y, width, height, EDGE_BAR_THICKNESS_PX / 2)
    context.fill()
    return
  }
  if (hot) {
    context.save()
    context.globalAlpha = HOT_DISC_ALPHA
    context.beginPath()
    context.arc(handle.x, handle.y, HOT_DISC_RADIUS_PX, 0, Math.PI * 2)
    context.fill()
    context.restore()
  }
  const line = hot ? HOT_LINE_PX : BRACKET_LINE_PX
  const arm = hot ? HOT_ARM_PX : BRACKET_ARM_PX
  const off = BRACKET_OFFSET_PX + line / 2
  const corner = { x: handle.x - into.x * off, y: handle.y - into.y * off }
  context.setLineDash([])
  context.lineWidth = line
  context.lineCap = 'butt'
  context.beginPath()
  context.moveTo(corner.x + into.x * arm, corner.y)
  context.arcTo(corner.x, corner.y, corner.x, corner.y + into.y * arm, BRACKET_RADIUS_PX)
  context.lineTo(corner.x, corner.y + into.y * arm)
  context.stroke()
}

// What the Frame carries while being set (Frame and MarginSheet cards): its hot corners on its line, and the size
// Tooltip beside the corner under the pointer, else at the bottom-right, in viewport px over all else.
export function drawFrameEditing(context: DrawingContext, input: { frame: Rect; surface: SurfaceView; pixelRatio: number; theme: ProjectTheme; touch: boolean; tooltip: string; hot?: HandleId }): void {
  const { frame, surface, pixelRatio, theme, touch, tooltip, hot } = input
  const { viewport } = surface
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
  const box = surface.frameBox(frame)
  const handles = frameHandles(box, touch)
  for (const handle of handles) {
    drawHotHandle(context, handle, handle.id === hot, theme)
  }

  if (tooltip === '') {
    return
  }
  context.font = `500 12px ${MONO_FONT}`
  const width = tooltip.length * 12 * 0.6 + TOOLTIP_PAD_X * 2
  const corner = handles.find((handle) => handle.id === hot && inward(handle.id).x !== 0 && inward(handle.id).y !== 0)
  // Beside the hot corner, out from the Frame; with none, under its bottom-right corner.
  const into = corner ? inward(corner.id) : { x: -1, y: -1 }
  const at = corner ?? { x: box.x + box.width, y: box.y + box.height }
  const wantedX = corner ? (into.x > 0 ? at.x - HOT_DISC_RADIUS_PX - width : at.x + HOT_DISC_RADIUS_PX) : at.x - width
  const wantedY = corner ? (into.y > 0 ? at.y - HOT_DISC_RADIUS_PX - TOOLTIP_HEIGHT : at.y + HOT_DISC_RADIUS_PX) : at.y + TOOLTIP_GAP
  const x = Math.max(4, Math.min(wantedX, viewport.width - width - 4))
  const y = Math.max(4, Math.min(wantedY, viewport.height - TOOLTIP_HEIGHT - 4))
  context.fillStyle = theme.frameLine
  context.beginPath()
  context.roundRect(x, y, width, TOOLTIP_HEIGHT, 6)
  context.fill()
  context.fillStyle = theme.canvas
  context.textAlign = 'left'
  context.textBaseline = 'middle'
  context.fillText(tooltip, x + TOOLTIP_PAD_X, y + TOOLTIP_HEIGHT / 2)
}
