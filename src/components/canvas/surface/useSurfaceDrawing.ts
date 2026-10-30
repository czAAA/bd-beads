import { onBeforeUnmount, watch, type Ref } from 'vue'
import { changedRows } from '../../../domain/canvas'
import { beadTotal } from '../../../domain/openingLimits'
import { frameOf, layerOf } from '../../../domain/layerRecord'
import { layersAlike } from '../../../domain/layerWeave'
import { draftCost } from '../../../domain/weave'
import { shownLetters } from '../../../domain/paletteEdits'
import type { LayerFields, Project } from '../../../domain/project'
import type { ProjectTheme } from '../../../rendering/beadLook'
import { beadsToDraw, bitmapBox, coversArea, gestureTransform, mayRedrawMidGesture, SETTLE_MS, GESTURE_BEAD_LIMIT, type View } from '../../../rendering/gestureView'
import { draftPixelRatio, drawsDraft } from '../../../rendering/draftRenderer'
import { renderProject } from '../../../rendering/projectRenderer'
import type { Space } from '../../../rendering/space'
import type { Region, Scroll } from '../../../rendering/surfaceView'
import type { Size } from '../../../rendering/cellSize'

/** The Drawing surface's draw scheduler (ticket 0619): a draw asked for any number of times waits for the next
 * animation frame and runs once there (a pinch or wheel burst); without frames it draws at once. Frames still asked
 * for are cancelled with the surface. */
export function useFrameScheduler(): { oncePerFrame: (draw: () => void) => () => void } {
  const pendingFrames = new Set<number>()
  onBeforeUnmount(() => pendingFrames.forEach((frame) => cancelAnimationFrame(frame)))

  function oncePerFrame(draw: () => void): () => void {
    let frame: number | undefined
    return () => {
      if (typeof requestAnimationFrame !== 'function') {
        draw()
        return
      }
      if (frame !== undefined) {
        return
      }
      frame = requestAnimationFrame(() => {
        pendingFrames.delete(frame!)
        frame = undefined
        draw()
      })
      pendingFrames.add(frame)
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
}

/** Whether two Projects differ only in the colors of their beads (`updatedAt` and `savedAt`, which every stroke step
 * stamps, are not drawn, ticket 0674). Any other difference, even one added later, can change how a bead is drawn
 * (shape, size, Technique, weave), so it repaints it all. */
function sameDrawing(a: Project, b: Project): boolean {
  const { layers: layersA, updatedAt: _u, savedAt: _s, ...restA } = a
  const { layers: layersB, updatedAt: _v, savedAt: _t, ...restB } = b
  return sameFields(restA, restB) && layersA.length === layersB.length && layersA.every((layer, index) => sameFields(unpainted(layer), unpainted(layersB[index]!)))
}

/** A layer without its beads (ADR 0079): what is left is what decides how a bead is drawn. */
function unpainted({ beads: _beads, ...layer }: LayerFields): object {
  return layer
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

/** Past this many changed rows, drawing them one band at a time costs more than drawing the lot. */
const MOST_ROWS_WORTH_A_BAND = 40

// Bands of rows an edit changed, to draw just those (rows within two apart share a band; neighbours are drawn anyway).
// Empty when nothing changed; undefined when so much did (Undo, Fill) that drawing all again is
// cheaper.
function changedBands(before: Project, after: Project): { first: number; last: number }[] | undefined {
  // The Frame's rows are not the Canvas's where it is woven otherwise or in a Bead of another size (tickets 492, 0665):
  // draw it all again.
  const frame = layerOf(after, 'frame')
  if (frame && !layersAlike(after) && layerOf(before, 'frame')?.beads !== frame.beads) {
    return undefined
  }
  // The Frame's rows are counted from its first, which is the same in both: the Layout is.
  const framed = (project: Project) => layerOf(project, 'frame')?.beads ?? {}
  const frameTop = frameOf(after)?.row ?? 0
  const changed = [
    ...new Set([
      ...changedRows(layerOf(before, 'canvas').beads, layerOf(after, 'canvas').beads),
      ...changedRows(framed(before), framed(after)).map((row) => row + frameTop),
    ]),
  ].sort((x, y) => x - y)
  if (changed.length > MOST_ROWS_WORTH_A_BAND) {
    return undefined
  }

  const bands: { first: number; last: number }[] = []
  for (const row of changed) {
    const band = bands.at(-1)
    if (band && row - band.last <= 2) {
      band.last = row
    } else {
      bands.push({ first: row, last: row })
    }
  }
  return bands
}

/** How many beads a Project stores: counted once per set of beads, an edit's from the last by the rows it changed, and
 * known from decoding for a layer just opened (ticket 0716). */
function storedBeads(project: Project): number {
  const frame = layerOf(project, 'frame')
  return beadTotal(layerOf(project, 'canvas').beads) + (frame ? beadTotal(frame.beads) : 0)
}

/** What one bead of the Project costs to draw, in square beads: its costlier layer's (a rounded bead is three). */
function beadCost(project: Project): number {
  const frame = layerOf(project, 'frame')
  return Math.max(draftCost(layerOf(project, 'canvas').weave.technique), frame ? draftCost(frame.weave.technique) : 0)
}

/** Keeps the beads' layer drawn (ADR 0018, 0026): once per frame, only the rows an edit changed when nothing else did,
 * and, while a very large piece is panned or zoomed, the drawn bitmap moved instead (ticket 349). */
export function useBeadLayer({ props, canvas: canvasEl, standIn: standInEl, size, space, theme, frameTheme, showFinished, marksShown, oncePerFrame, onDrawn }: BeadLayerDeps): void {
  /** What the cells were last drawn from, to draw only what an edit changed. */
  let drawn: { project: Project; zoom: number; scroll: Scroll; box: Region; width: number; height: number; pixelRatio: number; theme: ProjectTheme; frameTheme: ProjectTheme; showFinished: boolean; rowMarks: boolean } | undefined

  /** Draws the beads: all of them in view, or, when an edit changed only some rows of what is already drawn, just
   * those. */
  function drawCells(): void {
    const canvas = canvasEl.value
    if (!canvas || size.value.width === 0 || size.value.height === 0) {
      return
    }

    const pixelRatio = globalThis.devicePixelRatio || 1
    // In the draft look the bitmap reaches past the drawing area, so a pan or pinch uncovers none of it (ticket 0717).
    const box = bitmapBox(size.value, drawsDraft(props.zoom * pixelRatio), pixelRatio)
    placeCanvas(canvas, box)
    const region = { x: props.scroll.x + box.x, y: props.scroll.y + box.y, width: box.width, height: box.height }
    const project = props.project
    const letters = shownLetters(project)
    const resized = sizeCanvas(canvas, region.width, region.height, pixelRatio)
    const context = canvas.getContext('2d')
    if (!context) {
      return
    }

    const before = drawn
    drawn = { project, zoom: props.zoom, scroll: { ...props.scroll }, box, width: size.value.width, height: size.value.height, pixelRatio, theme: theme.value, frameTheme: frameTheme.value, showFinished: showFinished.value, rowMarks: marksShown.value }
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
      sameDrawing(before.project, project)
        ? changedBands(before.project, project)
        : undefined

    if (bands === undefined) {
      renderProject(context, { project, space: space.value, region, zoom: props.zoom, pixelRatio, theme: theme.value, frameTheme: frameTheme.value, showFinished: showFinished.value, rowMarks: marksShown.value, letters, draftWhenSmall: true, opaque: true })
      onDrawn?.()
      return
    }
    for (const rows of bands) {
      renderProject(context, { project, space: space.value, region, zoom: props.zoom, pixelRatio, rows, theme: theme.value, frameTheme: frameTheme.value, showFinished: showFinished.value, rowMarks: marksShown.value, letters, draftWhenSmall: true, opaque: true })
    }
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
    renderProject(context, { project: props.project, space: space.value, region, zoom: props.zoom, pixelRatio, theme: theme.value, frameTheme: frameTheme.value, showFinished: showFinished.value, rowMarks: marksShown.value, draftWhenSmall: true, positionMarks: false })
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
    const pixelRatio = globalThis.devicePixelRatio || 1
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
      props.zoom > 0 &&
      before.zoom > 0
    // The draft look moves its image too (ticket 0689): a live redraw is sharp but held about 40 fps, a move keeps 60.
    const heavy =
      onlyViewMoved &&
      beadsToDraw(storedBeads(project), (frameOf(project)?.columns ?? 0) * (frameOf(project)?.rows ?? 0), size.value, props.zoom, beadCost(project)) > GESTURE_BEAD_LIMIT
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
  watch([size, () => props.project, () => props.zoom, () => props.scroll, theme, frameTheme, showFinished, marksShown], oncePerFrame(drawCellsOrMove), { flush: 'post' })
  onBeforeUnmount(() => clearTimeout(settleTimer))
}
