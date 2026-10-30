import type { Rect } from '../domain/canvas'
import { currentPass, frameRowOrder, rowProgressOf, rowProgressOn } from '../domain/rowProgress'
import type { DrawingContext } from './beadLook'
import type { RulerScale } from './rulerScale'
import type { RuledBox, RulerDot, RulerLabel, RulerLayout } from './rulers'
import { MARGIN_PX } from './marginSizes'
import type { SurfaceView } from './surfaceView'
import type { ProjectTheme } from './beadLook'
import type { DrawnProject } from './projectRenderer'
import { frameHandles, type Handle, type HandleId } from './frameHandles'
import { frameOf } from '../domain/layerRecord'
import { ROW_MOTION, easeIn, easeStandard } from './rowMotion'

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
  /** Whether the current pass is marked, on its number or by a tick. Defaults to `rowProgressOn(project)` (tickets 434, 0685). */
  rowMarks?: boolean
  /** Row done or Row not done just pressed (ticket 0730): the pass the marker left and the ms since, so the pill and the
   * tick glide on from it, or fade out once every pass is done. */
  glide?: { from: number; elapsed: number }
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

/** The current pass's `marker` pill (ticket 0685): fully rounded round a box centred at `x`, `y`. */
function drawPill(context: DrawingContext, { x, y, width, height }: { x: number; y: number; width: number; height: number }, theme: ProjectTheme): void {
  context.fillStyle = theme.marker
  context.beginPath()
  context.roundRect(x - width / 2, y - height / 2, width, height, Math.min(width, height) / 2)
  context.fill()
}

/** A ruler number's box grown by `pad` all round: the pill it sits on. */
const pillOf = (label: RulerLabel, pad: number) => ({ x: label.x, y: label.y, width: label.width + pad * 2, height: label.height + pad * 2 })

/** One ruler number, in the style its role asks for (Rulers card); the current pass's on its `marker` pill, `pad` round
 * the number (ticket 0685), or `false` for any other. */
function drawLabel(context: DrawingContext, label: RulerLabel, fontPx: number, theme: ProjectTheme, pad: number | false): void {
  if (pad !== false) drawPill(context, pillOf(label, pad), theme)
  drawNumber(context, label, fontPx, theme, pad !== false)
}

/** A ruler number's text alone: bold in `canvas` where it is on the pill. */
function drawNumber(context: DrawingContext, label: RulerLabel, fontPx: number, theme: ProjectTheme, current: boolean): void {
  const weight = current || label.fifth ? 700 : 400
  context.font = `${weight} ${fontPx}px ${MONO_FONT}`
  context.fillStyle = current ? theme.canvas : label.fifth ? theme.rulerStrong : theme.ruler
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

/** The current pass of a Frame with lines, as it lies on screen: which line of the Frame it is, and where its first
 * bead is. None for a Custom frame, nor once every pass is done. */
interface PassOnScreen {
  line: number
  /** Whether the pass runs across the screen, so its marks stand on the Frame's left and right sides, not its top. */
  across: boolean
  first: { x: number; y: number }
  box: RuledBox
}

function passOnScreen({ project, surface, layout }: RulerDrawInput, pass = currentPass(rowProgressOf(project))): PassOnScreen | undefined {
  const frame = frameOf(project)
  const box = layout.boxes.find((ruled) => ruled.kind === 'frame')
  const order = frameRowOrder(project)
  const line = pass < order.count ? order.lineOf(pass) : undefined
  if (!frame || !box || line === undefined) return undefined
  const columns = rowProgressOf(project).direction === 'columns'
  const first = surface.beadToPoint(columns ? { row: frame.row, column: frame.column + line } : { row: frame.row + line, column: frame.column }, 'frame')
  const along = surface.beadStep('frame')[columns ? 'row' : 'column']
  // A Frame lying a quarter round runs its own rows the other way on screen (ticket 0667).
  const across = Math.abs(along.x) >= Math.abs(along.y) !== ((frame.quarterTurns ?? 0) % 2 === 1)
  return { line, across, first, box }
}

/** Whether a ruler number is the current pass's own. A turned Frame's rulers count the cells it covers, not its own
 * rows (ticket 0667): none of its numbers is. */
function numbersPass(label: RulerLabel, pass: PassOnScreen, project: DrawnProject): boolean {
  const frame = frameOf(project)
  if (!frame || frame.quarterTurns) return false
  const columns = rowProgressOf(project).direction === 'columns'
  return label.axis === (columns ? 'column' : 'row') && label.position - (columns ? frame.column : frame.row) === pass.line
}

// Where the current pass has no number drawn (the compact and folded forms, Rulers off, a turned Frame, a Ruler step
// past it), a `marker` tick from the Frame's line in to the beads (ticket 0685): inside the line, so never under a tool.
function drawPassTicks(context: DrawingContext, { surface }: RulerDrawInput, { across, first, box }: Pick<PassOnScreen, 'across' | 'first' | 'box'>, theme: ProjectTheme): void {
  const shown = surface.beadBox(box, 'frame')
  const thick = MARGIN_PX.pass.tick
  const reach = box.outset + FRAME_LINE_PX / 2
  const ticks = across
    ? [{ x: shown.x - reach, y: first.y - thick / 2, width: reach, height: thick }, { x: shown.x + shown.width, y: first.y - thick / 2, width: reach, height: thick }]
    : [{ x: first.x - thick / 2, y: shown.y - reach, width: thick, height: reach }]
  context.fillStyle = theme.marker
  for (const tick of ticks) {
    context.beginPath()
    context.roundRect(tick.x, tick.y, tick.width, tick.height, thick / 2)
    context.fill()
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
    if (box.outlined !== false) strokeBoxLine(context, box, surface, theme)
  }
  for (const dot of layout.dots) {
    drawDot(context, dot, layout.scale, theme)
  }
  // The current pass is marked on its number, or by a tick where it has none (MarginSheet card, ticket 0685).
  const marked = rowMarks && layout.passMark
  const pass = marked ? passOnScreen(input) : undefined
  const pad = MARGIN_PX.pass.pillPad * layout.sheetScale
  const { glide } = input
  const left = marked && glide && glide.elapsed < ROW_MOTION.glide ? passOnScreen(input, glide.from) : undefined
  if (glide && left && glide.from !== currentPass(rowProgressOf(project))) {
    drawGliding(context, input, { left, reached: pass, elapsed: glide.elapsed }, theme, fontPx, pad)
    return
  }
  let numbered = false
  for (const label of layout.labels) {
    const current = pass !== undefined && numbersPass(label, pass, project)
    numbered ||= current
    drawLabel(context, label, fontPx, theme, current && pad)
  }
  if (pass && !numbered) drawPassTicks(context, input, pass, theme)
}

/** Draws `draw` at an opacity, as the canvas's motion does: opacity and position only (ADR 0018). */
function faded(context: DrawingContext, alpha: number, draw: () => void): void {
  if (alpha <= 0) return
  context.save()
  context.globalAlpha *= Math.min(1, alpha)
  draw()
  context.restore()
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t

// Row done's marker (ticket 0730, Rulers card): the pill glides from the number of the pass it left to the next one's
// in every band that numbers both, the two numbers crossfading, and the tick glides along the Frame's line. Once every
// pass is done there is no next one: the pill and the tick fade out where they were.
function drawGliding(context: DrawingContext, input: RulerDrawInput, motion: { left: PassOnScreen; reached?: PassOnScreen; elapsed: number }, theme: ProjectTheme, fontPx: number, pad: number): void {
  const { project, layout } = input
  const { left, reached, elapsed } = motion
  const t = easeStandard(elapsed / ROW_MOTION.glide)
  const fade = 1 - easeIn(Math.min(1, elapsed / ROW_MOTION.markFade))
  const fromLabels = layout.labels.filter((label) => numbersPass(label, left, project))
  const toLabels = reached ? layout.labels.filter((label) => numbersPass(label, reached, project)) : []
  // A band is the run of numbers on one side: its pass's numbers share an x or a y with each other.
  const sameBand = (a: RulerLabel, b: RulerLabel) => Math.abs(a.x - b.x) < 1 || Math.abs(a.y - b.y) < 1
  for (const label of layout.labels) {
    if (!fromLabels.includes(label) && !toLabels.includes(label)) drawNumber(context, label, fontPx, theme, false)
  }
  for (const from of fromLabels) {
    const to = toLabels.find((label) => sameBand(from, label))
    if (!reached) {
      faded(context, fade, () => drawPill(context, pillOf(from, pad), theme))
      faded(context, fade, () => drawNumber(context, from, fontPx, theme, true))
      faded(context, 1 - fade, () => drawNumber(context, from, fontPx, theme, false))
      continue
    }
    if (!to) {
      drawNumber(context, from, fontPx, theme, false)
      continue
    }
    const [a, b] = [pillOf(from, pad), pillOf(to, pad)]
    drawPill(context, { x: mix(a.x, b.x, t), y: mix(a.y, b.y, t), width: mix(a.width, b.width, t), height: mix(a.height, b.height, t) }, theme)
    faded(context, 1 - t, () => drawNumber(context, from, fontPx, theme, true))
    faded(context, t, () => drawNumber(context, from, fontPx, theme, false))
    faded(context, 1 - t, () => drawNumber(context, to, fontPx, theme, false))
    faded(context, t, () => drawNumber(context, to, fontPx, theme, true))
  }
  // A number of the pass reached with no number of the one left beside it: at rest on its pill.
  for (const to of toLabels.filter((label) => !fromLabels.some((from) => sameBand(from, label)))) drawLabel(context, to, fontPx, theme, pad)
  // The tick, where a pass has no number drawn: gliding on from the one left where that had a tick too.
  if (!reached) {
    if (fromLabels.length === 0) faded(context, fade, () => drawPassTicks(context, input, left, theme))
    return
  }
  if (toLabels.length > 0) return
  const glides = fromLabels.length === 0 && reached.across === left.across
  drawPassTicks(context, input, glides ? { ...reached, first: { x: mix(left.first.x, reached.first.x, t), y: mix(left.first.y, reached.first.y, t) } } : reached, theme)
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
