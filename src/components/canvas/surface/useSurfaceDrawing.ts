import { onBeforeUnmount, watch, type Ref } from 'vue'
import { changedPositions, type BeadMap } from '../../../domain/canvas'
import { frameOf, layerOf } from '../../../domain/layerRecord'
import { sameWeave } from '../../../domain/layerWeave'
import { draftCost } from '../../../domain/weave'
import { shownLetters } from '../../../domain/paletteEdits'
import type { LayerFields, Project } from '../../../domain/project'
import type { ProjectTheme } from '../../../rendering/beadLook'
import { beadsToDraw, gestureTransform, SETTLE_MS, GESTURE_BEAD_LIMIT } from '../../../rendering/gestureView'
import { drawsDraft } from '../../../rendering/draftRenderer'
import { renderProject } from '../../../rendering/projectRenderer'
import type { Space } from '../../../rendering/space'
import type { Scroll } from '../../../rendering/surfaceView'
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

/** What the beads' layer draws from: the surface's props and the view state the component and its pointer hold. */
export interface BeadLayerDeps {
  props: { project: Project; zoom: number; scroll: Scroll }
  canvas: Ref<HTMLCanvasElement | undefined>
  size: Ref<Size>
  space: Ref<Space>
  theme: Ref<ProjectTheme>
  /** Whether finished rows show their normal color (ticket 352). */
  showFinished: Ref<boolean>
  /** Whether the Row progress look is drawn (ticket 474). */
  marksShown: Ref<boolean>
  oncePerFrame: (draw: () => void) => () => void
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
  // The Frame's rows are not the Canvas's where it is woven otherwise (ticket 492): draw it all again.
  const frame = layerOf(after, 'frame')
  if (frame && !sameWeave(layerOf(after, 'canvas').weave, frame.weave) && layerOf(before, 'frame')?.beads !== frame.beads) {
    return undefined
  }
  // The Frame's rows are counted from its first, which is the same in both: the Layout is.
  const framed = (project: Project) => layerOf(project, 'frame')?.beads ?? {}
  const frameTop = frameOf(after)?.row ?? 0
  const changed = [
    ...new Set([
      ...changedPositions(layerOf(before, 'canvas').beads, layerOf(after, 'canvas').beads).map((position) => position.row),
      ...changedPositions(framed(before), framed(after)).map((position) => position.row + frameTop),
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

/** How many beads a Project stores: counted once per set of beads, since an edit replaces it. */
const storedCounts = new WeakMap<object, number>()

function storedBeads(project: Project): number {
  const counted = (beads: BeadMap) => {
    let count = storedCounts.get(beads)
    if (count === undefined) {
      count = Object.values(beads).reduce((sum, row) => sum + Object.keys(row).length, 0)
      storedCounts.set(beads, count)
    }
    return count
  }
  const frame = layerOf(project, 'frame')
  return counted(layerOf(project, 'canvas').beads) + (frame ? counted(frame.beads) : 0)
}

/** What one bead of the Project costs to draw, in square beads: its costlier layer's (a rounded bead is three). */
function beadCost(project: Project): number {
  const frame = layerOf(project, 'frame')
  return Math.max(draftCost(layerOf(project, 'canvas').weave.technique), frame ? draftCost(frame.weave.technique) : 0)
}

/** Keeps the beads' layer drawn (ADR 0018, 0026): once per frame, only the rows an edit changed when nothing else did,
 * and, while a very large piece is panned or zoomed, the drawn bitmap moved instead (ticket 349). */
export function useBeadLayer({ props, canvas: canvasEl, size, space, theme, showFinished, marksShown, oncePerFrame }: BeadLayerDeps): void {
  /** What the cells were last drawn from, to draw only what an edit changed. */
  let drawn: { project: Project; zoom: number; scroll: Scroll; width: number; height: number; pixelRatio: number; theme: ProjectTheme; showFinished: boolean; rowMarks: boolean } | undefined

  /** Draws the beads: all of them in view, or, when an edit changed only some rows of what is already drawn, just
   * those. */
  function drawCells(): void {
    const canvas = canvasEl.value
    if (!canvas || size.value.width === 0 || size.value.height === 0) {
      return
    }

    const pixelRatio = globalThis.devicePixelRatio || 1
    const region = { x: props.scroll.x, y: props.scroll.y, width: size.value.width, height: size.value.height }
    const project = props.project
    const letters = shownLetters(project)
    const resized = sizeCanvas(canvas, region.width, region.height, pixelRatio)
    const context = canvas.getContext('2d')
    if (!context) {
      return
    }

    const before = drawn
    drawn = { project, zoom: props.zoom, scroll: { ...props.scroll }, width: region.width, height: region.height, pixelRatio, theme: theme.value, showFinished: showFinished.value, rowMarks: marksShown.value }
    const bands =
      !resized &&
      before &&
      before.zoom === props.zoom &&
      before.scroll.x === props.scroll.x &&
      before.scroll.y === props.scroll.y &&
      before.width === region.width &&
      before.height === region.height &&
      before.pixelRatio === pixelRatio &&
      before.theme === theme.value &&
      before.showFinished === showFinished.value &&
      before.rowMarks === marksShown.value &&
      sameDrawing(before.project, project)
        ? changedBands(before.project, project)
        : undefined

    if (bands === undefined) {
      renderProject(context, { project, space: space.value, region, zoom: props.zoom, pixelRatio, theme: theme.value, showFinished: showFinished.value, rowMarks: marksShown.value, letters, draftWhenSmall: true })
      return
    }
    for (const rows of bands) {
      renderProject(context, { project, space: space.value, region, zoom: props.zoom, pixelRatio, rows, theme: theme.value, showFinished: showFinished.value, rowMarks: marksShown.value, letters, draftWhenSmall: true })
    }
  }

  let settleTimer: ReturnType<typeof setTimeout> | undefined

  /** Puts the beads' canvas back to showing exactly what was drawn on it. */
  function clearMove(): void {
    clearTimeout(settleTimer)
    settleTimer = undefined
    if (canvasEl.value) canvasEl.value.style.transform = ''
  }

  // Draws the beads, except while a very large piece is panned or zoomed (ticket 349): then the drawn bitmap is moved
  // and scaled to follow, and drawn sharp after SETTLE_MS still, since a redraw per step would freeze the app. Other
  // changes (edit, theme, rotation, resize) draw at once.
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
      before.showFinished === showFinished.value &&
      before.rowMarks === marksShown.value &&
      props.zoom > 0 &&
      before.zoom > 0
    // In the draft look a redraw is one image a layer, whatever the beads (ticket 0676): it keeps up live.
    const heavy =
      onlyViewMoved &&
      !drawsDraft(props.zoom * pixelRatio) &&
      beadsToDraw(storedBeads(project), (frameOf(project)?.columns ?? 0) * (frameOf(project)?.rows ?? 0), size.value, props.zoom, beadCost(project)) > GESTURE_BEAD_LIMIT
    if (!heavy || !before) {
      clearMove()
      drawCells()
      return
    }

    const { scale, x, y } = gestureTransform(before, { zoom: props.zoom, scroll: props.scroll })
    canvas!.style.transformOrigin = '0 0'
    canvas!.style.transform = `translate(${x}px, ${y}px) scale(${scale})`
    clearTimeout(settleTimer)
    settleTimer = setTimeout(() => {
      clearMove()
      drawCells()
    }, SETTLE_MS)
  }

  // The Project is replaced whole by every edit, so its identity is all that needs watching: a deep watch would make
  // the draw depend on every bead's property.
  watch([size, () => props.project, () => props.zoom, () => props.scroll, theme, showFinished, marksShown], oncePerFrame(drawCellsOrMove), { flush: 'post' })
  onBeforeUnmount(() => clearTimeout(settleTimer))
}
