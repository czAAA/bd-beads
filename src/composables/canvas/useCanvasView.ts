import { computed, ref, watch, type Ref } from 'vue'
import { beadBounds, type Frame } from '../../domain/canvas'
import { MIN_ZOOM, ZOOM_STEP, clampZoom, type GridPosition } from '../../domain/grid'
import type { Pattern } from '../../domain/pattern'
import { displayedBox, scrollAfterZoom, scrollToCentre, zoomToFit, type Scroll, type Size } from '../../rendering/canvasView'

/** Room left clear round the Pattern at the fit level: the ruler gutter (28px) and a little air (CanvasStrip and BeadBoard cards). */
export const FIT_MARGIN_PX: Size = { width: 64, height: 46 }

/** The block of beads a view fits to and centres on: the Frame when there is one, otherwise the box round every bead, otherwise nothing. */
export function fitBox(pattern: Pick<Pattern, 'frame' | 'beads'>): Frame | undefined {
  return pattern.frame ?? beadBounds(pattern.beads)
}

/**
 * Where the open canvas is looked at from and how closely (ADR 0026): the zoom, and the scroll that says which part of
 * the endless field the drawing area shows. Moving the canvas is changing the scroll; there is no edge to stop at.
 *
 * A view starts, and `fit` returns it, at the level that shows the Frame (or, with none, everything drawn) whole, and an
 * empty canvas at 100% with its first bead in the middle. Until the person moves or zooms by hand the view follows that
 * fit as the drawing area changes size; after, it keeps the part they chose, and a zoom keeps the point under the
 * pointer (or the middle, for the zoom buttons) where it was.
 */
export function useCanvasView(
  currentPattern: () => Pattern | undefined,
  viewport: Ref<Size>,
  /** The zoom-out floor (ticket 223): the smallest bead of the window's tier, as a zoom. Zooming out and Fit stop here. */
  floor: Ref<number> = ref(MIN_ZOOM),
) {
  const zoom = ref(1)
  const scroll = ref<Scroll>({ x: 0, y: 0 })
  /** Whether the view still tracks the fit rather than a place the person chose. */
  const isAtFit = ref(true)

  function measured(): boolean {
    return viewport.value.width > 0 && viewport.value.height > 0
  }

  /** Puts the view at the fit: the Frame or the drawing whole, or the origin in the middle for an empty canvas. */
  function fit(): void {
    const pattern = currentPattern()
    if (!pattern) {
      return
    }
    const box = fitBox(pattern)
    if (!measured()) {
      // Nothing to fit to until the drawing area has a size: look at the origin at 100% and fit when it is measured.
      zoom.value = clampZoom(1, floor.value)
      scroll.value = { x: 0, y: 0 }
    } else if (!box) {
      zoom.value = clampZoom(1, floor.value)
      scroll.value = scrollToCentre({ x: 0, y: 0, width: 0, height: 0 }, viewport.value)
    } else {
      zoom.value = clampZoom(zoomToFit(pattern.technique, pattern.rotation, box, viewport.value, FIT_MARGIN_PX), floor.value)
      scroll.value = scrollToCentre(displayedBox(pattern.technique, pattern.rotation, box, zoom.value), viewport.value)
    }
    isAtFit.value = true
  }

  /** Moves the canvas under the viewport by a distance on screen (a drag, a wheel): the content follows the pointer, so the scroll goes the other way. */
  function panBy(dx: number, dy: number): void {
    scroll.value = { x: scroll.value.x - dx, y: scroll.value.y - dy }
    isAtFit.value = false
  }

  /** Scrolls by a distance in the direction the content moves away from (the wheel's own sign). */
  function scrollBy(dx: number, dy: number): void {
    panBy(-dx, -dy)
  }

  /** Brings a block of beads into the middle of the view without changing the zoom. */
  function centreOn(box: Frame): void {
    const pattern = currentPattern()
    if (!pattern) {
      return
    }
    scroll.value = scrollToCentre(displayedBox(pattern.technique, pattern.rotation, box, zoom.value), viewport.value)
    isAtFit.value = false
  }

  /** Scrolls only as far as it takes to bring a bead into view, `margin` px clear of the viewport's edges: what moving the keyboard cursor does. */
  function reveal(position: GridPosition, margin = 24): void {
    const pattern = currentPattern()
    if (!pattern || !measured()) {
      return
    }
    const bead = displayedBox(pattern.technique, pattern.rotation, { ...position, rows: 1, columns: 1 }, zoom.value)
    const { x, y } = scroll.value
    const { width, height } = viewport.value
    let dx = 0
    let dy = 0
    if (bead.x - margin < x) dx = bead.x - margin - x
    else if (bead.x + bead.width + margin > x + width) dx = bead.x + bead.width + margin - (x + width)
    if (bead.y - margin < y) dy = bead.y - margin - y
    else if (bead.y + bead.height + margin > y + height) dy = bead.y + bead.height + margin - (y + height)
    if (dx !== 0 || dy !== 0) {
      scroll.value = { x: x + dx, y: y + dy }
      isAtFit.value = false
    }
  }

  function setZoom(value: number, anchor?: Scroll): void {
    const next = clampZoom(value, floor.value)
    if (next === zoom.value) {
      return
    }
    const at = anchor ?? { x: viewport.value.width / 2, y: viewport.value.height / 2 }
    scroll.value = scrollAfterZoom(scroll.value, at, zoom.value, next)
    zoom.value = next
    isAtFit.value = false
  }

  watch(
    // Two sources, not one getter returning an array: a fresh array is "changed" on every edit, which refit the view on every bead drawn.
    [() => currentPattern()?.id, () => currentPattern()?.rotation],
    () => {
      if (measured()) {
        fit()
      } else {
        isAtFit.value = true
      }
    },
  )

  watch(viewport, () => {
    if (!measured()) {
      return
    }
    if (isAtFit.value) {
      fit()
    } else {
      zoom.value = clampZoom(zoom.value, floor.value)
    }
  })

  watch(floor, () => {
    if (isAtFit.value && measured()) {
      fit()
    } else {
      zoom.value = clampZoom(zoom.value, floor.value)
    }
  })

  return {
    zoom,
    scroll,
    zoomPercent: computed(() => Math.round(zoom.value * 100)),
    zoomIn: (anchor?: Scroll) => setZoom(zoom.value + ZOOM_STEP, anchor),
    zoomOut: (anchor?: Scroll) => setZoom(zoom.value - ZOOM_STEP, anchor),
    /** A zoom the wheel or fingers chose: any level in the usable range rather than a step, about the point under them. */
    setZoom,
    resetZoom: fit,
    fit,
    panBy,
    scrollBy,
    centreOn,
    reveal,
    isAtFit,
  }
}
