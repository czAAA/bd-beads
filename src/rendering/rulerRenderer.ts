import type { Frame } from '../domain/canvas'
import type { GridPosition } from '../domain/grid'
import { lineOfPass } from '../domain/passes'
import type { DrawingContext } from './beadLook'
import type { RuledBox, RulerDot, RulerLabel, RulerLayout } from './rulers'
import type { SurfaceView } from './surfaceView'
import type { ProjectTheme } from './beadLook'
import type { DrawnProject } from './projectRenderer'
import { frameHandles } from './frameHandles'

/** The corner radius of a piece's rectangle and of the Frame's line (BeadBoard and Frame cards). */
const PIECE_RADIUS_PX = 6
const FRAME_RADIUS_PX = 7
const PIECE_LINE_PX = 1
const FRAME_LINE_PX = 1.5
/** The line under the number the keyboard cursor is on (BeadCursor card). */
const CURSOR_LINE_PX = 2

export interface RulerDrawInput {
  project: DrawnProject
  /** The view the layout was made for, to place the boxes' lines. */
  surface: SurfaceView
  /** What to draw; with its numbers off, the Pieces' rectangles go too, but the Frame's line is drawn either way. */
  layout: RulerLayout
  /** The numbers' size in px. */
  fontPx: number
  pixelRatio: number
  theme: ProjectTheme
  /** The keyboard's bead cursor: its row and column numbers are marked. */
  cursor?: GridPosition
}

/** The box's line: a rounded rectangle just outside its outermost beads. */
function strokeBoxLine(context: DrawingContext, box: RuledBox, surface: SurfaceView, theme: ProjectTheme): void {
  const shown = surface.beadBox(box)
  const outset = box.outset
  const isFrame = box.kind === 'frame'
  context.setLineDash([])
  context.lineWidth = isFrame ? FRAME_LINE_PX : PIECE_LINE_PX
  context.strokeStyle = isFrame ? theme.frameLine : theme.pieceLine
  context.beginPath()
  context.roundRect(shown.x - outset, shown.y - outset, shown.width + outset * 2, shown.height + outset * 2, isFrame ? FRAME_RADIUS_PX : PIECE_RADIUS_PX)
  context.stroke()
}

/** A Ruler dot's radius, and a 5th one's (Rulers card). */
const DOT_RADIUS_PX = 1
const FIFTH_DOT_RADIUS_PX = 1.75

/** One Ruler dot: the number's colours, every 5th bolder. */
function drawDot(context: DrawingContext, dot: RulerDot, theme: ProjectTheme): void {
  context.fillStyle = dot.fifth ? theme.rulerStrong : theme.ruler
  context.beginPath()
  context.arc(dot.x, dot.y, dot.fifth ? FIFTH_DOT_RADIUS_PX : DOT_RADIUS_PX, 0, Math.PI * 2)
  context.fill()
}

/** One ruler number, in the style its role asks for (Rulers card). */
function drawLabel(context: DrawingContext, label: RulerLabel, fontPx: number, project: DrawnProject, theme: ProjectTheme, cursor: GridPosition | undefined): void {
  const { enabled, direction, currentRow, currentColumn } = project.rowProgress
  const frame = project.frame
  const relative = frame ? (label.axis === 'row' ? label.position - frame.row : label.position - frame.column) : -1
  const currentLine = lineOfPass(project.technique, direction === 'rows' ? currentRow : currentColumn)
  const current = enabled && frame && ((label.axis === 'row' && direction === 'rows' && relative === currentLine) || (label.axis === 'column' && direction === 'columns' && relative === currentLine))
  const onCursor = cursor !== undefined && (label.axis === 'row' ? cursor.row === label.position : cursor.column === label.position)

  const weight = current || onCursor || label.fifth ? 700 : 400
  context.font = `${weight} ${fontPx}px "DM Mono", "JetBrains Mono", ui-monospace, monospace`
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
 * Draws the lines (the Frame's, or each piece's rectangle) and the Ruler layout's numbers and dots, in the
 * viewport's own px over whatever is drawn.
 */
export function drawRulers(context: DrawingContext, input: RulerDrawInput): void {
  const { project, surface, layout, fontPx, pixelRatio, theme, cursor } = input
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)

  for (const box of layout.boxes) {
    // With Rulers off a Piece's rectangle goes with its numbers; the Frame's line never does.
    if (layout.numbers || box.kind === 'frame') {
      strokeBoxLine(context, box, surface, theme)
    }
  }
  for (const dot of layout.dots) {
    drawDot(context, dot, theme)
  }
  for (const label of layout.labels) {
    drawLabel(context, label, fontPx, project, theme, cursor)
  }
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
export function drawFrameEditing(context: DrawingContext, input: { frame: Frame; surface: SurfaceView; pixelRatio: number; theme: ProjectTheme; touch: boolean; tooltip: string }): void {
  const { frame, surface, pixelRatio, theme, touch, tooltip } = input
  const { viewport } = surface
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
  const box = surface.frameBox(frame)

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
