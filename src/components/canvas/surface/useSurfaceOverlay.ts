import { computed, onBeforeUnmount, ref, watch, type Ref } from 'vue'
import type { PreviewCell } from '../../../domain/grid'
import { shownLetters } from '../../../domain/paletteEdits'
import type { Project } from '../../../domain/project'
import type { Selection } from '../../../domain/selection'
import type { ToolCapabilities } from '../../../domain/tool'
import type { ProjectTheme } from '../../../rendering/beadLook'
import { renderOverlay } from '../../../rendering/overlayRenderer'
import type { RulerLayout } from '../../../rendering/rulers'
import type { Space } from '../../../rendering/space'
import type { Scroll, Size, SurfaceView, ViewLayer } from '../../../rendering/surfaceView'
import { sizeCanvas } from './useSurfaceDrawing'

// The Frame margin's outline (ticket 276, Frame card): always shown with a Frame (ticket 452) and 1s after a refused
// margin press, faded over --duration-fast, redrawn on the overlay frame by frame; with reduced motion shown and hidden
// at once.
const MARGIN_FADE_MS = 120
const REFUSED_PRESS_MS = 1000
const SIZE_FLASH_MS = 1200

function reducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** The Frame margin's outline, as the opacity the overlay draws it at, and the refused press that shows it for a
 * moment: a press on the pointer or a Selection refused off it (a Shift+arrow into the margin, a Piece tap there,
 * ticket 433), counted by `selectionRefusals`. */
export function useMarginCue(props: { project: Project; selectionRefusals?: number }): { opacity: Ref<number>; refuse: () => void } {
  const refusedPress = ref(false)
  let refusedTimer: ReturnType<typeof setTimeout> | undefined
  let fadeFrame: number | undefined
  const opacity = ref(props.project.frame ? 1 : 0)
  const wanted = computed(() => props.project.frame !== undefined || refusedPress.value)

  watch(wanted, (shown) => {
    if (fadeFrame !== undefined) cancelAnimationFrame(fadeFrame)
    const target = shown ? 1 : 0
    if (reducedMotion() || typeof requestAnimationFrame !== 'function') {
      opacity.value = target
      return
    }
    const from = opacity.value
    // The fade starts at the first frame's own timestamp: it is not always on performance.now()'s clock.
    let start: number | undefined
    const step = (now: number) => {
      start ??= now
      const done = Math.min(1, (now - start) / MARGIN_FADE_MS)
      opacity.value = from + (target - from) * done
      fadeFrame = done < 1 ? requestAnimationFrame(step) : undefined
    }
    fadeFrame = requestAnimationFrame(step)
  })

  function refuse(): void {
    refusedPress.value = true
    clearTimeout(refusedTimer)
    refusedTimer = setTimeout(() => (refusedPress.value = false), REFUSED_PRESS_MS)
  }

  watch(
    () => props.selectionRefusals,
    (now, before) => {
      if (now !== undefined && now !== before) refuse()
    },
  )

  onBeforeUnmount(() => {
    clearTimeout(refusedTimer)
    if (fadeFrame !== undefined) cancelAnimationFrame(fadeFrame)
  })
  return { opacity, refuse }
}

/** What the overlay draws from: the surface's props, its layout, and what the pointer and the margin cue hold. */
export interface SurfaceOverlayDeps {
  props: {
    project: Project
    zoom: number
    scroll: Scroll
    previewCells?: PreviewCell[]
    previewColor?: string | null
    selection?: Selection
    showRulers?: boolean
    frameTooltip?: string
    tools: ToolCapabilities
  }
  canvas: Ref<HTMLCanvasElement | undefined>
  size: Ref<Size>
  space: Ref<Space>
  surface: Ref<SurfaceView>
  rulers: Ref<RulerLayout>
  theme: Ref<ProjectTheme>
  marksShown: Ref<boolean>
  /** Where the bead-shaped marker stands for the pointer, if anywhere (ticket 353). */
  markerAt: Ref<{ x: number; y: number; layer: ViewLayer } | undefined>
  /** Whether a Frame gesture is in progress: the size tooltip shows meanwhile. */
  framing: Ref<boolean>
  /** Whether the last pointer was a finger: the Frame's and Selection's handles are the larger ones. */
  touchInput: Ref<boolean>
  marginOpacity: Ref<number>
  oncePerFrame: (draw: () => void) => () => void
}

/** Keeps the overlay drawn (overlayRenderer): everything over the beads that comes and goes with a tool or the pointer,
 * redrawn once per frame whenever any of it changes. */
export function useSurfaceOverlay(deps: SurfaceOverlayDeps): void {
  const { props, canvas: canvasEl, size, space, surface, rulers, theme, marksShown, markerAt, framing, touchInput, marginOpacity } = deps

  /** Whether a stepper or a key has just changed the Frame's size: the size tooltip shows then too (ticket 452). */
  const sizeFlash = ref(false)
  let sizeTimer: ReturnType<typeof setTimeout> | undefined
  const sizeShown = computed(() => framing.value || sizeFlash.value)
  /** The Frame's size tooltip follows a size change that did not come from a drag (an edge stepper, a key) for a
   * moment. */
  watch(
    () => [props.project.frame?.columns, props.project.frame?.rows],
    () => {
      if (!props.tools.settingFrame || framing.value) return
      sizeFlash.value = true
      clearTimeout(sizeTimer)
      sizeTimer = setTimeout(() => (sizeFlash.value = false), SIZE_FLASH_MS)
    },
  )

  /** Draws the overlay: everything over the beads that comes and goes with a tool or the pointer. */
  function drawOverlay(): void {
    const canvas = canvasEl.value
    if (!canvas || size.value.width === 0 || size.value.height === 0) {
      return
    }

    const pixelRatio = globalThis.devicePixelRatio || 1
    const region = { x: props.scroll.x, y: props.scroll.y, width: size.value.width, height: size.value.height }
    sizeCanvas(canvas, region.width, region.height, pixelRatio)
    const context = canvas.getContext('2d')
    const { tools } = props
    if (context) {
      renderOverlay(context, {
        project: props.project,
        space: space.value,
        region,
        zoom: props.zoom,
        pixelRatio,
        theme: theme.value,
        rowMarks: marksShown.value,
        letters: shownLetters(props.project),
        pointer: markerAt.value && !tools.tool && !tools.moves && !tools.markerHidden && !tools.picking && !tools.selects ? { ...markerAt.value, color: props.previewColor ?? null } : undefined,
        preview: !tools.picking && props.previewCells && props.previewCells.length > 0 ? { cells: props.previewCells, color: props.previewColor ?? null } : undefined,
        selection: props.selection,
        marginOutline: marginOpacity.value,
        frameEditing: tools.settingFrame ? { touch: touchInput.value, tooltip: sizeShown.value ? (props.frameTooltip ?? '') : '' } : undefined,
        selectionHandles: tools.selects ? { surface: surface.value, touch: touchInput.value } : undefined,
        rulers: { layout: rulers.value, surface: surface.value },
      })
    }
  }

  watch(
    [
      size,
      () => props.project,
      () => props.zoom,
      () => props.scroll,
      () => props.previewCells,
      () => props.previewColor,
      markerAt,
      () => props.selection,
      () => props.showRulers,
      marksShown,
      () => props.tools.settingFrame,
      sizeShown,
      () => props.tools.moves,
      () => props.tools.markerHidden,
      () => props.tools.selects,
      () => props.tools.picking,
      () => props.frameTooltip,
      marginOpacity,
      touchInput,
      theme,
    ],
    deps.oncePerFrame(drawOverlay),
    { flush: 'post' },
  )
  onBeforeUnmount(() => clearTimeout(sizeTimer))
}
