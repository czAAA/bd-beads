import { onBeforeUnmount, watch, type Ref } from 'vue'
import { pixelRatioOf } from '../../../composables/ui/cssZoom'
import { changedRows } from '../../../domain/canvas'
import { beadTotal } from '../../../domain/openingLimits'
import { beadsOfLayer, frameIdOf, framesOf, layerOf } from '../../../domain/layerRecord'
import type { FrameRef } from '../../../domain/grid'
import { draftCost } from '../../../domain/weave'
import { shownLetters } from '../../../domain/paletteEdits'
import type { LayerFields, Project } from '../../../domain/project'
import type { ProjectTheme } from '../../../rendering/beadLook'
import { beadsToDraw, bitmapBox, coversArea, gestureTransform, mayRedrawMidGesture, SETTLE_MS, GESTURE_BEAD_LIMIT, type View } from '../../../rendering/gestureView'
import { draftPixelRatio, drawsDraft } from '../../../rendering/draftRenderer'
import { canvasBoxOnSurface, canvasRowsOnSurface, renderProject, type RenderInput, type SlimSheet } from '../../../rendering/projectRenderer'
import type { DrawnReference } from '../../../rendering/referenceImage'
import type { Space } from '../../../rendering/space'
import type { Region, Scroll, SurfaceView } from '../../../rendering/surfaceView'
import type { RulerLayout } from '../../../rendering/rulers'
import { drawPlaced, placementOf } from '../../../rendering/placedDrawing'
import { spaceOf } from '../../../rendering/space'
import type { Size } from '../../../rendering/cellSize'

/** How long a draw waits for its animation frame before it draws without one, in ms (ticket 1152): far longer than a
 * frame takes to come, short enough that the wait is hardly seen.
 * @internal The tests wait it out. */
export const FRAME_WAIT_MS = 250

interface Wait {
  frame?: number
  timer: ReturnType<typeof setTimeout>
}

/** The Drawing surface's draw scheduler (ticket 0619): a draw asked for any number of times runs once at the next
 * animation frame, or at once without frames. A frame not come after FRAME_WAIT_MS is waited for no longer (ticket
 * 1152): a browser may drop it, and the draw left waiting would hold back every draw after it. */
export function useFrameScheduler(): { oncePerFrame: (draw: () => void) => () => void } {
  const waits = new Set<() => void>()
  onBeforeUnmount(() => waits.forEach((drop) => drop()))

  function oncePerFrame(draw: () => void): () => void {
    /** The draw asked for and not yet run: its frame, once asked for, and the end of the wait for it. */
    let waiting: Wait | undefined
    function drop(): void {
      if (!waiting) return
      if (waiting.frame !== undefined) cancelAnimationFrame(waiting.frame)
      clearTimeout(waiting.timer)
      waiting = undefined
      waits.delete(drop)
    }
    function run(): void {
      if (!waiting) return
      drop()
      draw()
    }
    return () => {
      if (typeof requestAnimationFrame !== 'function') {
        draw()
        return
      }
      if (waiting) {
        return
      }
      // The wait is set before the frame is asked for: a frame given at once finds it and ends it.
      const asked: Wait = { timer: setTimeout(run, FRAME_WAIT_MS) }
      waiting = asked
      waits.add(drop)
      asked.frame = requestAnimationFrame(run)
    }
  }
  return { oncePerFrame }
}

/** Sizes a canvas to the surface and the screen's pixel density, leaving it alone (and its drawing with it) when it
 * already is. Whether it had to change. */
export function sizeCanvas(canvas: HTMLCanvasElement, width: number, height: number, pixelRatio: number): boolean {
  const bitmapWidth = Math.max(1, Math.round(width * pixelRatio))
  const bitmapHeight = Math.max(1, Math.round(height * pixelRatio))
  if (canvas.width === bitmapWidth && canvas.height === bitmapHeight) {
    return false
  }
  canvas.width = bitmapWidth
  canvas.height = bitmapHeight
  return true
}

/** Lays the beads' canvas over `box` of the drawing area (ticket 0717): its whole box, or past it in the draft look. */
function placeCanvas(canvas: HTMLCanvasElement, box: Region): void {
  const whole = box.x === 0 && box.y === 0
  canvas.style.left = whole ? '' : `${box.x}px`
  canvas.style.top = whole ? '' : `${box.y}px`
  canvas.style.width = whole ? '' : `${box.width}px`
  canvas.style.height = whole ? '' : `${box.height}px`
}

/** One Frame the shared surface draws (tickets 1219, 1239): on a drawing of its own, the Project as that drawing draws it,
 * laid onto the surface by a shift, every layer turning with the Table. One surface holds the Canvas and every
 * Frame, in layer order, so the canvases and their memory do not grow with them. */
export interface LaidFrame {
  ref: FrameRef
  project: Project
  /** Its drawing's scroll and size, as the Frame surface's own are for the first Frame. */
  scroll: Scroll
  size: Size
  /** Whether its Row progress look is drawn (ticket 474). */
  marks: boolean
  /** Its look on its own Background (ticket 0666). */
  theme: ProjectTheme
  /** The view its own drawing lays it out in, and its rulers there: what its overlay draws by. */
  surface: SurfaceView
  rulers: RulerLayout
  /** The slim sheet it is drawn with while it is the expanded Frame (ticket 1169). */
  slim?: SlimSheet
  /** Its sheet's box in the Canvas's grid px: what hides the Canvas beads under it (ticket 1239). */
  covered: Region
}

/** What the beads' layer draws from: the surface's props and the view state the component and its pointer hold. */
export interface BeadLayerDeps {
  props: { project: Project; zoom: number; scroll: Scroll }
  canvas: Ref<HTMLCanvasElement | undefined>
  /** The canvas under it a pan in the full look draws what it uncovers on, in the draft look (ticket 0732). */
  standIn: Ref<HTMLCanvasElement | undefined>
  size: Ref<Size>
  space: Ref<Space>
  theme: Ref<ProjectTheme>
  /** The Frame's look on its own Background (ticket 0666). */
  frameTheme: Ref<ProjectTheme>
  /** Whether finished rows show their normal color (ticket 352). */
  showFinished: Ref<boolean>
  /** Whether the Row progress look is drawn (ticket 474). */
  marksShown: Ref<boolean>
  oncePerFrame: (draw: () => void) => () => void
  /** Called after each draw of every bead in view: the safe start's first drawn frame (ticket 0716). */
  onDrawn?: () => void
  /** The reference image to draw under the beads (ticket 0790), none while it is hidden. */
  reference: Ref<DrawnReference | undefined>
  /** Every Frame (tickets 1219, 1239), each drawn over the Canvas in layer order, on its own placement. */
  others?: Ref<readonly LaidFrame[]>
}

/** Whether two reference images draw the same: the same picture in the same place at the same opacity, over the beads
 * or under them (ticket 1009). A new object comes with every edit of the Project, so a stroke still redraws only its
 * rows. */
function sameReference(a: DrawnReference | undefined, b: DrawnReference | undefined): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return a.image === b.image && a.opacity === b.opacity && a.height === b.height && a.over === b.over && sameFields(a.place, b.place)
}

/** Whether two Projects differ only in the colors of their beads (`updatedAt` and `savedAt`, which every stroke step
 * stamps, are not drawn, ticket 0674). Any other difference, even one added later, can change how a bead is drawn
 * (shape, size, Technique, weave), so it repaints it all. */
function sameDrawing(a: Project, b: Project): boolean {
  const { layers: layersA, updatedAt: _u, savedAt: _s, ...restA } = a
  const { layers: layersB, updatedAt: _v, savedAt: _t, ...restB } = b
  return sameFields(restA, restB) && layersA.length === layersB.length && layersA.every((layer, index) => sameFields(unpainted(layer), unpainted(layersB[index]!)))
}

/** A layer without its beads and where it lies (ADR 0079): what is left is what decides how a bead is drawn. */
function unpainted({ beads: _beads, ...layer }: LayerFields & { centre?: unknown }): object {
  const { centre: _centre, ...drawn } = layer
  return drawn
}

/** Whether two records hold the same values, comparing objects one level deep (a row progress is replaced whole). */
function sameFields(a: object, b: object): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  const field = (record: object, key: string) => (record as Record<string, unknown>)[key]
  return [...keys].every((key) => {
    const x = field(a, key)
    const y = field(b, key)
    if (x === y) {
      return true
    }
    return typeof x === 'object' && typeof y === 'object' && x !== null && y !== null && !Array.isArray(x) && !Array.isArray(y) && Object.keys({ ...x, ...y }).every((inner) => field(x, inner) === field(y, inner))
  })
}

/** Whether the other Frames lie as they did (ticket 1219): the same Frames, each at the same place on the surface and
 * drawn alike but for its beads, which a draw then redraws that Frame alone for. */
function sameOthers(before: readonly LaidFrame[], after: readonly LaidFrame[]): boolean {
  return (
    before.length === after.length &&
    before.every((was, at) => {
      const now = after[at]!
      return was.ref === now.ref && was.marks === now.marks && was.theme === now.theme && sameFields(was.scroll, now.scroll) && sameFields(was.size, now.size) && sameFields(was.covered, now.covered) && JSON.stringify(was.slim ?? null) === JSON.stringify(now.slim ?? null) && sameDrawing(was.project, now.project)
    })
  )
}

type Band = { first: number; last: number }
/** What a draw redraws alone: bands of rows of the Canvas. */
type Bands = { rows: Band[] }

/** Past this many changed rows, drawing them one band at a time costs more than drawing the lot. */
const MOST_ROWS_WORTH_A_BAND = 40

// Bands of rows an edit changed on the Canvas, to draw just those (rows within two apart share a band; neighbours are
// drawn anyway). Empty when nothing changed; undefined when so much did (Undo, Fill) that drawing all again is cheaper.
// A Frame's own surface draws all again: its rows are no lines of the Canvas (spec 1234).
function changedBands(before: Project, after: Project): Bands | undefined {
  const changed = changedRows(layerOf(before, 'canvas').beads, layerOf(after, 'canvas').beads).sort((x, y) => x - y)
  const rows = bandsOf(changed)
  return rows && { rows }
}

/** Lines in order grouped into bands (lines within two apart share one; neighbours are drawn anyway), or undefined past
 * as many as bands pay for. */
function bandsOf(lines: readonly number[]): Band[] | undefined {
  if (lines.length > MOST_ROWS_WORTH_A_BAND) {
    return undefined
  }
  const bands: Band[] = []
  for (const line of lines) {
    const band = bands.at(-1)
    if (band && line - band.last <= 2) {
      band.last = line
    } else {
      bands.push({ first: line, last: line })
    }
  }
  return bands
}

/** How many beads a Project stores: counted once per set of beads, an edit's from the last by the rows it changed, and
 * known from decoding for a layer just opened (ticket 0716). */
function storedBeads(project: Project): number {
  return framesOf(project).reduce((total, frame) => total + beadTotal(frame.beads), beadTotal(layerOf(project, 'canvas').beads))
}

/** What one bead of the Project costs to draw, in square beads: its costlier layer's (a rounded bead is three). */
function beadCost(project: Project): number {
  return Math.max(draftCost(layerOf(project, 'canvas').weave.technique), ...framesOf(project).map((frame) => draftCost(layerOf(project, frameIdOf(frame))!.weave.technique)))
}

/** How many positions the Project's Frames hold, every one drawn whether painted or not. */
function framePositions(project: Project): number {
  return framesOf(project).reduce((total, frame) => total + frame.columns * frame.rows, 0)
}

/** Keeps the shared bitmap drawn, the Canvas and every Frame over it in layer order (ADR 0018, 0026; ticket 1239): once per frame, only the rows an edit changed when nothing else did,
 * and, while a very large piece is panned or zoomed, the drawn bitmap moved instead (ticket 349). */
export function useBeadLayer({ props, canvas: canvasEl, standIn: standInEl, size, space, theme, frameTheme, showFinished, marksShown, oncePerFrame, onDrawn, reference, others }: BeadLayerDeps): void {
  /** What the cells were last drawn from, to draw only what an edit changed. */
  let drawn: { project: Project; zoom: number; scroll: Scroll; box: Region; width: number; height: number; pixelRatio: number; theme: ProjectTheme; frameTheme: ProjectTheme; showFinished: boolean; rowMarks: boolean; reference: DrawnReference | undefined; others: readonly LaidFrame[] } | undefined

  /** What of a Frame a draw redraws: all of it, or `within`, a rectangle of the surface in its device px. */
  type Redraw = 'all' | Region

  /** Draws the Frames over the Canvas in layer order (tickets 1219, 1239), each alone on its own placement: all of them,
   * or the part `redraw` names of each. Each clears only round its own sheet, so the rest stay as drawn. */
  function drawFrames(context: CanvasRenderingContext2D, drawing: RenderInput, box: Region, draft: boolean, redraw?: (frame: LaidFrame) => Redraw | undefined): void {
    for (const frame of others?.value ?? []) {
      const part = redraw ? redraw(frame) : 'all'
      if (!part) continue
      const own = bitmapBox(frame.size, draft, drawing.pixelRatio!)
      const region = { x: frame.scroll.x + own.x, y: frame.scroll.y + own.y, width: own.width, height: own.height }
      const placement = placementOf(drawing.pixelRatio!, own, box)
      // A rectangle of the surface, in the Frame's own device px: every layer shares the Table turn, so the placement is a shift.
      const within = part === 'all' ? undefined : { ...part, x: part.x - placement.e, y: part.y - placement.f }
      const laid = { ...drawing, project: frame.project, space: spaceOf(frame.project, true, frame.ref), region, frameTheme: frame.theme, rowMarks: frame.marks, letters: shownLetters(frame.project, frame.ref), canvasLetters: undefined, slimSheet: frame.slim, layer: frame.ref, alone: true, rows: undefined, columns: undefined, covered: undefined, within }
      drawPlaced(context, placement, () => renderProject(context, laid))
    }
  }

  /** Whether two boxes share any area. */
  function overlap(a: Region, b: Region): boolean {
    return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
  }

  /** Draws the beads: all of them in view, or, when an edit changed only some rows of what is already drawn, just
   * those. */
  function drawCells(): void {
    const canvas = canvasEl.value
    if (!canvas || size.value.width === 0 || size.value.height === 0) {
      return
    }

    const pixelRatio = pixelRatioOf(canvasEl.value)
    // In the draft look the bitmap reaches past the drawing area, so a pan or pinch uncovers none of it (ticket 0717).
    const box = bitmapBox(size.value, drawsDraft(props.zoom * pixelRatio), pixelRatio)
    placeCanvas(canvas, box)
    const region = { x: props.scroll.x + box.x, y: props.scroll.y + box.y, width: box.width, height: box.height }
    const project = props.project
    const canvasLetters = shownLetters(project, 'canvas')
    const resized = sizeCanvas(canvas, region.width, region.height, pixelRatio)
    const context = canvas.getContext('2d')
    if (!context) {
      return
    }

    const before = drawn
    drawn = { project, zoom: props.zoom, scroll: { ...props.scroll }, box, width: size.value.width, height: size.value.height, pixelRatio, theme: theme.value, frameTheme: frameTheme.value, showFinished: showFinished.value, rowMarks: marksShown.value, reference: reference.value, others: others?.value ?? [] }
    const bands =
      !resized &&
      before &&
      before.zoom === props.zoom &&
      before.scroll.x === props.scroll.x &&
      before.scroll.y === props.scroll.y &&
      before.width === size.value.width &&
      before.height === size.value.height &&
      before.pixelRatio === pixelRatio &&
      before.theme === theme.value &&
      before.frameTheme === frameTheme.value &&
      before.showFinished === showFinished.value &&
      before.rowMarks === marksShown.value &&
      sameReference(before.reference, reference.value) &&
      sameOthers(before.others, drawn.others)
        ? sameDrawing(before.project, project)
          ? changedBands(before.project, project)
          : undefined
        : undefined
    const drawing = { project, space: space.value, region, zoom: props.zoom, pixelRatio, theme: theme.value, frameTheme: frameTheme.value, showFinished: showFinished.value, rowMarks: marksShown.value, canvasLetters, draftWhenSmall: true, opaque: true, reference: reference.value, layer: 'canvas' as const, covered: (others?.value ?? []).map((frame) => frame.covered) }
    const draft = drawsDraft(props.zoom * pixelRatio)

    if (bands === undefined) {
      renderProject(context, drawing)
      drawFrames(context, drawing, box, draft)
      onDrawn?.()
      return
    }
    // A change on one layer redraws a rectangle of the shared bitmap with every layer over it, in layer order (ticket 1239):
    // the Canvas's bands, then each Frame in them, or where its own rows changed.
    const bandRects = bands.rows.map((rows) => {
      renderProject(context, { ...drawing, rows })
      return canvasRowsOnSurface(drawing, rows)
    })
    const was = new Map(before!.others.map((frame) => [frame.ref, frame]))
    drawFrames(context, drawing, box, draft, (frame) => {
      const sheet = canvasBoxOnSurface(drawing, frame.covered)
      const parts = bandRects.filter((rect) => overlap(rect, sheet))
      // A Frame's own beads changed: that Frame is drawn again whole. Its changed rows' rectangle is not worked out, as it
      // missed the beads of a Frame turned or leaning apart from the Canvas.
      if (beadsOfLayer(frame.project, frame.ref) !== beadsOfLayer(was.get(frame.ref)!.project, frame.ref)) return 'all'
      return parts.length > 0 ? unionOf(parts) : undefined
    })
  }

  /** The smallest box holding all of `boxes`. */
  function unionOf(boxes: readonly Region[]): Region {
    const [left, top] = [Math.min(...boxes.map((box) => box.x)), Math.min(...boxes.map((box) => box.y))]
    const [right, bottom] = [Math.max(...boxes.map((box) => box.x + box.width)), Math.max(...boxes.map((box) => box.y + box.height))]
    return { x: left, y: top, width: right - left, height: bottom - top }
  }

  let settleTimer: ReturnType<typeof setTimeout> | undefined
  /** When each canvas was last drawn and how long it took, in ms: what a moving view may spend drawing (ticket 0732). */
  const lastDraw = { cells: { at: Number.NEGATIVE_INFINITY, ms: 0 }, standIn: { at: Number.NEGATIVE_INFINITY, ms: 0 } }
  /** The view the stand-in was drawn for, while it shows. */
  let standInView: { zoom: number; scroll: Scroll; box: Region } | undefined

  function timed(which: keyof typeof lastDraw, draw: () => void): void {
    const start = performance.now()
    draw()
    const end = performance.now()
    lastDraw[which] = { at: end, ms: end - start }
  }

  /** Draws the beads in view and half a drawing area past it in the draft look, on the stand-in under the beads'
   * canvas, at a density low enough that the draft look is cheap at any zoom: what a pan shows where it uncovers beads
   * the full look has not drawn yet (ticket 0732). */
  function drawStandIn(): void {
    const canvas = standInEl.value
    const context = canvas?.getContext('2d')
    if (!canvas || !context) {
      return
    }
    const pixelRatio = draftPixelRatio(props.zoom)
    const box = bitmapBox(size.value, true, pixelRatio)
    placeCanvas(canvas, box)
    const region = { x: props.scroll.x + box.x, y: props.scroll.y + box.y, width: box.width, height: box.height }
    sizeCanvas(canvas, region.width, region.height, pixelRatio)
    const drawing = { project: props.project, space: space.value, region, zoom: props.zoom, pixelRatio, theme: theme.value, frameTheme: frameTheme.value, showFinished: showFinished.value, rowMarks: marksShown.value, draftWhenSmall: true, positionMarks: !!reference.value, reference: reference.value, layer: 'canvas' as const }
    renderProject(context, drawing)
    drawFrames(context, drawing, box, true)
    canvas.style.transform = ''
    canvas.style.visibility = 'visible'
    standInView = { zoom: props.zoom, scroll: { ...props.scroll }, box }
  }

  /** How a bitmap drawn for one view lies in the view now, and whether it still covers the drawing area. */
  function placed(drawnFor: View & { box: Region }): { move: { scale: number; x: number; y: number }; covers: boolean } {
    const move = gestureTransform(drawnFor, { zoom: props.zoom, scroll: props.scroll }, drawnFor.box)
    return { move, covers: coversArea(drawnFor.box, move, size.value) }
  }

  /** Lays a canvas drawn for one view where the view now shows it. */
  function move(canvas: HTMLCanvasElement, { scale, x, y }: { scale: number; x: number; y: number }): void {
    canvas.style.transformOrigin = '0 0'
    canvas.style.transform = `translate(${x}px, ${y}px) scale(${scale})`
  }

  /** Puts the beads' canvas back to showing exactly what was drawn on it, and hides the stand-in. */
  function clearMove(): void {
    clearTimeout(settleTimer)
    settleTimer = undefined
    if (canvasEl.value) canvasEl.value.style.transform = ''
    if (standInView && standInEl.value) standInEl.value.style.visibility = 'hidden'
    standInView = undefined
  }

  // Draws the beads, except while a very large piece is panned or zoomed (ticket 349): then the bitmap is moved and drawn
  // sharp after SETTLE_MS still. What a move uncovers is drawn as often as its cost allows (ticket 0732): the draft look
  // draws its bitmap again, the full look the stand-in under it. Other changes (edit, theme, resize) draw at once.
  function drawCellsOrMove(): void {
    const before = drawn
    const canvas = canvasEl.value
    const project = props.project
    const pixelRatio = pixelRatioOf(canvasEl.value)
    const onlyViewMoved =
      before &&
      canvas &&
      before.project === project &&
      before.width === size.value.width &&
      before.height === size.value.height &&
      before.pixelRatio === pixelRatio &&
      before.theme === theme.value &&
      before.frameTheme === frameTheme.value &&
      before.showFinished === showFinished.value &&
      before.rowMarks === marksShown.value &&
      sameReference(before.reference, reference.value) &&
      props.zoom > 0 &&
      before.zoom > 0
    // The draft look moves its image too (ticket 0689): a live redraw is sharp but held about 40 fps, a move keeps 60.
    const heavy =
      onlyViewMoved &&
      beadsToDraw(storedBeads(project), framePositions(project), size.value, props.zoom, beadCost(project)) > GESTURE_BEAD_LIMIT
    if (!heavy || !before) {
      clearMove()
      timed('cells', drawCells)
      return
    }

    const cells = placed(before)
    const draft = drawsDraft(props.zoom * pixelRatio)
    if (!cells.covers && draft && mayRedrawMidGesture(performance.now(), lastDraw.cells)) {
      clearMove()
      timed('cells', drawCells)
      return
    }
    if (!cells.covers && !draft && !(standInView && placed(standInView).covers) && mayRedrawMidGesture(performance.now(), lastDraw.standIn)) {
      timed('standIn', drawStandIn)
    }
    move(canvas!, cells.move)
    if (standInView && standInEl.value) move(standInEl.value, placed(standInView).move)
    clearTimeout(settleTimer)
    settleTimer = setTimeout(() => {
      clearMove()
      timed('cells', drawCells)
    }, SETTLE_MS)
  }

  // The Project is replaced whole by every edit, so its identity is all that needs watching: a deep watch would make
  // the draw depend on every bead's property.
  watch([size, () => props.project, () => props.zoom, () => props.scroll, theme, frameTheme, showFinished, marksShown, reference, () => others?.value], oncePerFrame(drawCellsOrMove), { flush: 'post' })
  onBeforeUnmount(() => clearTimeout(settleTimer))
}
