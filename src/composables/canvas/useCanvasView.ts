import { computed, ref, watch, type Ref } from 'vue'
import { beadBounds, type Frame } from '../../domain/canvas'
import { clampZoom, stepZoom, type GridPosition } from '../../domain/grid'
import type { Project } from '../../domain/project'
import { OPEN_SPACE } from '../../rendering/space'
import { surfaceView, type Scroll, type Size, type SurfaceView } from '../../rendering/surfaceView'

/** Room left clear round the Project at the fit level: the ruler gutter (28px) and a little air (CanvasStrip and BeadBoard cards). */
export const FIT_MARGIN_PX: Size = { width: 64, height: 46 }

/** The block of beads a view fits to and centres on: the Frame when there is one, otherwise the box round every bead, otherwise nothing. */
export function fitBox(project: Pick<Project, 'frame' | 'beads'>): Frame | undefined {
  return project.frame ?? beadBounds(project.beads)
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
  currentProject: () => Project | undefined,
  viewport: Ref<Size>,
) {
  const zoom = ref(1)
  const scroll = ref<Scroll>({ x: 0, y: 0 })
  /** Whether the view still tracks the fit rather than a place the person chose. */
  const isAtFit = ref(true)

  /** The open canvas as the view stands, or at another zoom. */
  function surfaceOf(project: Pick<Project, 'technique' | 'rotation'>): SurfaceView {
    return surfaceView({ space: OPEN_SPACE, technique: project.technique, rotation: project.rotation, zoom: zoom.value, scroll: scroll.value, viewport: viewport.value })
  }

  function measured(): boolean {
    return viewport.value.width > 0 && viewport.value.height > 0
  }

  /** Puts the view at the fit: the Frame or the drawing whole, or the origin in the middle for an empty canvas. */
  function fit(): void {
    const project = currentProject()
    if (!project) {
      return
    }
    const box = fitBox(project)
    if (!measured()) {
      // Nothing to fit to until the drawing area has a size: look at the origin at 100% and fit when it is measured.
      zoom.value = clampZoom(1)
      scroll.value = { x: 0, y: 0 }
    } else if (!box) {
      zoom.value = clampZoom(1)
      scroll.value = surfaceOf(project).scrollToCentre()
    } else {
      zoom.value = clampZoom(surfaceOf(project).zoomToFit(box, FIT_MARGIN_PX))
      scroll.value = surfaceOf(project).scrollToCentre(box)
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
    const project = currentProject()
    if (!project) {
      return
    }
    scroll.value = surfaceOf(project).scrollToCentre(box)
    isAtFit.value = false
  }

  /** Scrolls only as far as it takes to bring a bead into view, `margin` px clear of the viewport's edges: what moving the keyboard cursor does. */
  function reveal(position: GridPosition, margin = 24): void {
    const project = currentProject()
    if (!project || !measured()) {
      return
    }
    const bead = surfaceOf(project).beadBox({ ...position, rows: 1, columns: 1 })
    const { width, height } = viewport.value
    let dx = 0
    let dy = 0
    if (bead.x - margin < 0) dx = bead.x - margin
    else if (bead.x + bead.width + margin > width) dx = bead.x + bead.width + margin - width
    if (bead.y - margin < 0) dy = bead.y - margin
    else if (bead.y + bead.height + margin > height) dy = bead.y + bead.height + margin - height
    if (dx !== 0 || dy !== 0) {
      scroll.value = { x: scroll.value.x + dx, y: scroll.value.y + dy }
      isAtFit.value = false
    }
  }

  function setZoom(value: number, anchor?: Scroll): void {
    const next = clampZoom(value)
    if (next === zoom.value) {
      return
    }
    const at = anchor ?? { x: viewport.value.width / 2, y: viewport.value.height / 2 }
    // Keeping a point still under a zoom does not depend on what is drawn, so a Project is not needed.
    scroll.value = surfaceOf(currentProject() ?? { technique: 'loom', rotation: 0 }).scrollAfterZoom(at, next)
    zoom.value = next
    isAtFit.value = false
  }

  watch(
    // Two sources, not one getter returning an array: a fresh array is "changed" on every edit, which refit the view on every bead drawn.
    [() => currentProject()?.id, () => currentProject()?.rotation],
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
      zoom.value = clampZoom(zoom.value)
    }
  })

  return {
    zoom,
    scroll,
    zoomPercent: computed(() => Math.round(zoom.value * 100)),
    zoomIn: (anchor?: Scroll) => setZoom(stepZoom(zoom.value, 1), anchor),
    zoomOut: (anchor?: Scroll) => setZoom(stepZoom(zoom.value, -1), anchor),
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
