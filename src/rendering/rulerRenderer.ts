import type { Frame } from '../domain/canvas'
import type { GridPosition } from '../domain/grid'
import type { DrawingContext } from './beadLook'
import { boxOnScreen, visibleRulerLabels, ruledBoxes, type RulerLabel, type RulerView, type RuledBox } from './rulers'
import type { ProjectTheme } from './beadLook'
import type { DrawnProject } from './projectRenderer'
import { frameHandles, frameLineBox } from './frameHandles'

/** The corner radius of a piece's rectangle and of the Frame's line (BeadBoard and Frame cards). */
const PIECE_RADIUS_PX = 6
const FRAME_RADIUS_PX = 7
const PIECE_LINE_PX = 1
const FRAME_LINE_PX = 1.5
/** The line under the number the keyboard cursor is on (BeadCursor card). */
const CURSOR_LINE_PX = 2

export interface RulerDrawInput {
  project: DrawnProject
  view: RulerView
  pixelRatio: number
  theme: ProjectTheme
  /** Whether the numbers are drawn (the Rulers toggle); the lines are drawn either way. */
  showNumbers: boolean
  /** The keyboard's bead cursor: its row and column numbers are marked. */
  cursor?: GridPosition
  /** The piece being drawn now, whose rectangle is `muted` rather than `line-strong`. */
  activePiece?: Frame
}

function sameBox(a: Frame, b: Frame | undefined): boolean {
  return !!b && a.row === b.row && a.column === b.column && a.rows === b.rows && a.columns === b.columns
}

/** The box's line: a rounded rectangle just outside its outermost beads. */
function strokeBoxLine(context: DrawingContext, box: RuledBox, view: RulerView, theme: ProjectTheme, active: boolean): void {
  const shown = boxOnScreen(box, view)
  const outset = box.outset
  const isFrame = box.kind === 'frame'
  context.setLineDash([])
  context.lineWidth = isFrame ? FRAME_LINE_PX : PIECE_LINE_PX
  context.strokeStyle = isFrame ? theme.frameLine : active ? theme.pieceLineActive : theme.pieceLine
  context.beginPath()
  context.roundRect(shown.x - outset, shown.y - outset, shown.width + outset * 2, shown.height + outset * 2, isFrame ? FRAME_RADIUS_PX : PIECE_RADIUS_PX)
  context.stroke()
}

/** One ruler number, in the style its role asks for (Rulers card). */
function drawLabel(context: DrawingContext, label: RulerLabel, view: RulerView, project: DrawnProject, theme: ProjectTheme, cursor: GridPosition | undefined): void {
  const { enabled, direction, currentRow, currentColumn } = project.rowProgress
  const frame = project.frame
  const relative = frame ? (label.axis === 'row' ? label.position - frame.row : label.position - frame.column) : -1
  const current = enabled && frame && ((label.axis === 'row' && direction === 'rows' && relative === currentRow) || (label.axis === 'column' && direction === 'columns' && relative === currentColumn))
  const onCursor = cursor !== undefined && (label.axis === 'row' ? cursor.row === label.position : cursor.column === label.position)

  const weight = current || onCursor || label.fifth ? 700 : 400
  context.font = `${weight} ${view.fontPx}px "DM Mono", "JetBrains Mono", ui-monospace, monospace`
  context.fillStyle = current ? theme.marker : onCursor ? theme.frameLine : label.fifth ? theme.rulerStrong : theme.ruler
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

  if (onCursor) {
    context.fillStyle = theme.cursor
    context.fillRect(label.x - label.width / 2, label.y + label.height / 2 + 1, label.width, CURSOR_LINE_PX)
  }
}

/**
 * Draws the lines (the Frame's, or each piece's rectangle) and, with the Rulers toggle on, their numbers, in the
 * viewport's own px over whatever is drawn, and gives back the numbers it drew so a click can be tested against them.
 */
export function drawRulers(context: DrawingContext, input: RulerDrawInput): RulerLabel[] {
  const { project, view, pixelRatio, theme, showNumbers, cursor, activePiece } = input
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)

  const reach = view.fontPx * 4 + 40
  for (const box of ruledBoxes(project)) {
    const shown = boxOnScreen(box, view)
    if (shown.x + shown.width > -reach && shown.x < view.viewport.width + reach && shown.y + shown.height > -reach && shown.y < view.viewport.height + reach) {
      strokeBoxLine(context, box, view, theme, sameBox(box, activePiece))
    }
  }

  if (!showNumbers) {
    return []
  }
  const labels = visibleRulerLabels(project, view)
  for (const label of labels) {
    drawLabel(context, label, view, project, theme, cursor)
  }
  return labels
}


/** The size tooltip's look (Frame card): `ink` on the canvas, 12px mono, at the Frame's bottom-right corner. */
const TOOLTIP_PAD_X = 8
const TOOLTIP_HEIGHT = 24
const TOOLTIP_GAP = 10

/**
 * What the Frame carries while it is being set (Frame card): its handles, 9px squares (four 16px ones on touch) with a
 * 1.5px `ink` line, filled with the canvas, and the size tooltip hanging off its bottom-right corner (none when the tooltip is empty). In the viewport's
 * own px, over everything else.
 */
export function drawFrameEditing(context: DrawingContext, input: { frame: Frame; view: RulerView; pixelRatio: number; theme: ProjectTheme; touch: boolean; tooltip: string }): void {
  const { frame, view, pixelRatio, theme, touch, tooltip } = input
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
  const box = frameLineBox(frame, view)

  context.setLineDash([])
  context.lineWidth = FRAME_LINE_PX
  context.strokeStyle = theme.frameLine
  context.fillStyle = theme.canvas
  for (const handle of frameHandles(box, touch)) {
    context.beginPath()
    context.roundRect(handle.x - handle.size / 2, handle.y - handle.size / 2, handle.size, handle.size, 2)
    context.fill()
    context.stroke()
  }

  if (tooltip === '') {
    return
  }
  context.font = '500 12px "DM Mono", "JetBrains Mono", ui-monospace, monospace'
  const width = tooltip.length * 12 * 0.6 + TOOLTIP_PAD_X * 2
  const x = Math.min(box.x + box.width - width, view.viewport.width - width - 4)
  const y = Math.min(box.y + box.height + TOOLTIP_GAP, view.viewport.height - TOOLTIP_HEIGHT - 4)
  context.fillStyle = theme.frameLine
  context.beginPath()
  context.roundRect(Math.max(4, x), Math.max(4, y), width, TOOLTIP_HEIGHT, 6)
  context.fill()
  context.fillStyle = theme.canvas
  context.textAlign = 'left'
  context.textBaseline = 'middle'
  context.fillText(tooltip, Math.max(4, x) + TOOLTIP_PAD_X, Math.max(4, y) + TOOLTIP_HEIGHT / 2)
}
