<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { PreviewCell } from '../../domain/grid'
import type { Handedness, InputMode } from '../../domain/inputMode'
import { layerOf } from '../../domain/layerRecord'
import { rowProgressOn } from '../../domain/rowProgress'
import type { Project } from '../../domain/project'
import { selectionFrame, selectionLayer, type Selection } from '../../domain/selection'
import { toolCapabilities, type ToolCapabilities } from '../../domain/tool'
import { marginForm } from '../../rendering/marginForm'
import { marginSheetPx } from '../../rendering/projectRenderer'
import { rulerLayout } from '../../rendering/rulers'
import { spaceOf } from '../../rendering/space'
import type { FrameAnchor, SelectionAnchor } from '../../composables/tools/selectionBarPlacement'
import { surfaceView, type Scroll } from '../../rendering/surfaceView'
import { useCanvasBackground } from '../../theme/useCanvasBackground'
import { useBeadLayer, useFrameScheduler } from './surface/useSurfaceDrawing'
import { useMarginCue, useSurfaceOverlay } from './surface/useSurfaceOverlay'
import { useSurfacePointer, type SurfacePointerEvents } from './surface/useSurfacePointer'

// The Canvas drawn by the Project renderer (ADR 0018, ADR 0026), the Drawing surface of CONTEXT.md: two screen-sized
// canvases (beads and dots; overlay: see overlayRenderer), no board; `scroll` and `zoom` decide what shows. Its parts
// (ticket 0619): the draw scheduler and beads' layer, the overlay, and the pointer and cursor, wired here.
const props = withDefaults(defineProps<{
  project: Project
  /** How much the canvas is enlarged by; 1 is a bead 20 px across. */
  zoom: number
  /** Where the viewport's top-left corner is, in displayed px from the bead at row 0, column 0 (see the Surface
   * view). */
  scroll: Scroll
  /** What the tool in hand and the modes on let a press, the pointer and the overlay do (ticket 0619,
   * `toolCapabilities`); absent, no tool is in hand and the bead-shaped marker shows over the beads. */
  tools?: ToolCapabilities
  /** Beads to show a hover preview on (ticket 23): the hovered bead, or a whole
   * copied block under the cursor (ticket 31). */
  previewCells?: PreviewCell[]
  /** The color to preview, faintly, on beads that carry none of their own; null for a neutral outline when no
   * Palette color is selected. */
  previewColor?: string | null
  /** The rectangle the Select tool has marked out, drawn as a marquee over those beads (ticket 31). */
  selection?: Selection
  /** The Project's accessible name: it is one image to a screen reader, summed up (ScreenReaders card). */
  label?: string
  /** Which pointer draws and which one moves the canvas (ticket 325); absent, every pointer draws. */
  inputMode?: InputMode
  /** Which hand holds the pen: its marker stands off the tip away from that hand. Right when not given. */
  handedness?: Handedness
  /** Whether ruler numbers are drawn (the Rulers toggle); the lines they hang from are drawn either way. */
  showRulers?: boolean
  /** Whether the Row progress look is drawn (ticket 474): finished rows dimmed, the current row ringed and lifted. */
  rowMarks?: boolean
  /** The size tooltip's text at the Frame's corner while it is being set ("13×13 ≈ 2.1 × 2.1 cm"). */
  frameTooltip?: string
  /** How many Selections have been refused off the pointer (a Shift+arrow into the margin, a Piece tap there, ticket
   * 433): each one shows the not-allowed cue, the margin outline for 1s. */
  selectionRefusals?: number
}>(), { rowMarks: true, tools: () => toolCapabilities(undefined) })

const emit = defineEmits<SurfacePointerEvents & {
  /** The Selection's rectangle in the surface's pixels (ticket 415), or none: where the Selection bar anchors.
   * Follows pan and zoom. */
  'selection-anchor': [anchor: SelectionAnchor | undefined]
  /** The Frame's and its margin sheet's rectangles in the surface's pixels (tickets 417, 473, 0657), or none once the
   * sheet is out of view: where the sheet's tools and title block sit. */
  'frame-anchor': [anchor: FrameAnchor | undefined]
}>()

/** The colors the beads are drawn in follow the app's theme and the person's Canvas color; a change redraws both
 * layers. */
const canvasBackground = useCanvasBackground()
const theme = canvasBackground.projectTheme

const rootEl = ref<HTMLElement>()
const baseEl = ref<HTMLCanvasElement>()
const overlayEl = ref<HTMLCanvasElement>()

/** How big the surface is on screen, measured: the canvases are exactly this big. */
const size = ref({ width: 0, height: 0 })
let resizeObserver: ResizeObserver | undefined

function measure(): void {
  const root = rootEl.value
  if (!root) return
  const box = root.getBoundingClientRect()
  const width = Math.round(box.width)
  const height = Math.round(box.height)
  if (width !== size.value.width || height !== size.value.height) {
    size.value = { width, height }
  }
}

/** Where the Project's positions live: built once and handed to both layers, so they can't disagree about where a
 * position is. */
const space = computed(() => spaceOf(props.project, true))

/** The Canvas's Weave (ADR 0079), with the cell its Bead and Bead shape draw it in. */
const canvasWeave = computed(() => layerOf(props.project, 'canvas').weave)

/** How a bead and a point of the viewport map onto each other: built once, so the pointer and the Frame's handles
 * agree with what is drawn. */
const surface = computed(() =>
  surfaceView({ space: space.value, technique: canvasWeave.value.technique, techniqueSettings: canvasWeave.value.techniqueSettings, cell: canvasWeave.value.cell, frame: props.project.frame, rotation: props.project.rotation, zoom: props.zoom, scroll: props.scroll, viewport: size.value }),
)

/** The numbers' size: 11px, 12px on a phone (Rulers card). */
function rulerFontPx(): number {
  return window.innerWidth <= 743 ? 12 : 11
}

/** The form the Frame's margin sheet takes at this zoom (ticket 0658): the Frame's numbers hang on it. */
const sheetForm = computed(() => {
  const grid = marginSheetPx(props.project)
  return grid ? marginForm(grid.band * props.zoom) : 'full'
})

/** The rulers of this view, laid out once: the overlay draws them and a press asks them what it selects, so the two
 * cannot disagree. */
const rulers = computed(() => rulerLayout(props.project, surface.value, { fontPx: rulerFontPx(), numbers: props.showRulers ?? true, sheet: sheetForm.value }))

/** Where the Selection is on screen, told to the Selection bar (ticket 415). */
watch(
  [surface, () => props.selection, size],
  () => {
    const selected = props.selection
    if (!selected || size.value.width === 0) {
      emit('selection-anchor', undefined)
      return
    }
    const box = surface.value.beadBox(selectionFrame(selected), selectionLayer(props.project, selected))
    emit('selection-anchor', { box: { left: box.x, top: box.y, width: box.width, height: box.height }, viewport: { ...size.value } })
  },
  { immediate: true, flush: 'post' },
)

/** Where the Frame and its margin sheet are on screen, none once the sheet is out of view (tickets 417, 473, 0657):
 * told to the sheet's tools and title block. */
const frameAnchor = computed<FrameAnchor | undefined>(() => {
  const frame = props.project.frame
  const grid = marginSheetPx(props.project)
  if (!frame || !grid || size.value.width === 0) return undefined
  const box = surface.value.frameBox(frame)
  const corners = [surface.value.gridToPoint(grid.sheet.x, grid.sheet.y), surface.value.gridToPoint(grid.sheet.x + grid.sheet.width, grid.sheet.y + grid.sheet.height)]
  const sheet = {
    left: Math.min(corners[0].x, corners[1].x),
    top: Math.min(corners[0].y, corners[1].y),
    width: Math.abs(corners[1].x - corners[0].x),
    height: Math.abs(corners[1].y - corners[0].y),
  }
  // Scrolled wholly out of view, the sheet has no tools to keep on screen.
  const { width, height } = size.value
  if (sheet.left + sheet.width <= 0 || sheet.top + sheet.height <= 0 || sheet.left >= width || sheet.top >= height) return undefined
  const origin = surface.value.beadBox({ row: 0, column: 0, rows: 1, columns: 1 }, 'canvas')
  return {
    box: { left: box.x, top: box.y, width: box.width, height: box.height },
    sheet,
    band: grid.band * props.zoom,
    viewport: { ...size.value },
    origin: { left: origin.x, top: origin.y, width: origin.width, height: origin.height },
  }
})
watch(frameAnchor, (anchor) => emit('frame-anchor', anchor), { immediate: true, flush: 'post' })

/** Row marks are drawn unless the Row highlight toggle is off; the project's own Row progress decides the rest. */
const marksShown = computed(() => props.rowMarks && rowProgressOn(props.project))

const marginCue = useMarginCue(props)
const pointer = useSurfacePointer({ props, emit, root: rootEl, size, surface, marksShown, refuse: marginCue.refuse })
const { handlers, surfaceClass, cursorStyle, penPointer, pickChip, pressMoveHandle } = pointer
const { oncePerFrame } = useFrameScheduler()
useBeadLayer({ props, canvas: baseEl, size, space, theme, showFinished: pointer.showFinished, marksShown, oncePerFrame })
useSurfaceOverlay({
  props, canvas: overlayEl, size, space, surface, rulers, theme, marksShown, oncePerFrame,
  markerAt: pointer.markerAt, framing: pointer.framing, touchInput: pointer.touchInput, hotHandle: pointer.hotHandle, marginOpacity: marginCue.opacity,
})

// Tests read what was drawn from the layout the surface built.
defineExpose({ rulerLayout: rulers, pressMoveHandle })

onMounted(() => {
  measure()
  if (typeof ResizeObserver !== 'undefined' && rootEl.value) {
    resizeObserver = new ResizeObserver(measure)
    resizeObserver.observe(rootEl.value)
  }
  window.addEventListener('resize', measure, { passive: true })
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  window.removeEventListener('resize', measure)
})
</script>

<template>
  <div
    ref="rootEl"
    class="project-surface"
    data-testid="project-surface"
    :data-technique="canvasWeave.technique"
    :data-technique-settings="JSON.stringify(canvasWeave.techniqueSettings ?? {})"
    :data-rotation="project.rotation"
    :data-zoom="zoom"
    :data-scroll-x="scroll.x"
    :data-scroll-y="scroll.y"
    :class="surfaceClass"
    :style="cursorStyle"
    role="img"
    :aria-label="label"
    @pointerdown.capture="handlers.onPress"
    @pointerdown="handlers.onPointerDown"
    @pointermove="handlers.onPointerMove"
    @pointerup="handlers.onPointerEnd"
    @pointercancel="handlers.onPointerCancel"
    @lostpointercapture="handlers.onPointerEnd"
    @pointerleave="handlers.onPointerLeave"
    @wheel="handlers.onWheel"
    @contextmenu.prevent
  >
    <canvas ref="baseEl" class="project-surface__canvas" data-testid="project-surface-cells" />
    <canvas ref="overlayEl" class="project-surface__canvas" data-testid="project-surface-overlay" />
    <img
      v-if="penPointer"
      class="project-surface__pen-pointer"
      :src="penPointer.url"
      :style="{ left: `${penPointer.x}px`, top: `${penPointer.y}px` }"
      data-testid="pen-pointer"
      alt=""
      aria-hidden="true"
    />
    <span
      v-if="pickChip"
      class="project-surface__pick-chip"
      :class="{ 'project-surface__pick-chip--flip-x': pickChip.flipX, 'project-surface__pick-chip--flip-y': pickChip.flipY }"
      :style="{ left: `${pickChip.x}px`, top: `${pickChip.y}px`, '--pick-color': pickChip.hex }"
      data-testid="pick-chip"
      aria-hidden="true"
    ><span class="project-surface__pick-chip-swatch" />{{ pickChip.hex }}</span>
  </div>
</template>

<style scoped>
.project-surface {
  position: absolute;
  inset: 0;
  overflow: hidden;
  /* Without this (ticket 60), the browser may treat a touch/pen drag as scroll/pan instead of delivering
   * pointermove. */
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
}

/* Over the canvas's beads the OS pointer is hidden: the overlay draws a bead-shaped marker in its place (BeadHover
 * card, ticket 353). */
.project-surface--over-bead {
  cursor: none;
}

/* Over the Frame's margin with a tool that cannot place beads there (Frame card, ticket 276); it wins over the bead
 * marker. */
.project-surface--refused {
  cursor: not-allowed;
}

/* The Hand tool and Space + drag (CanvasHint card): an open hand, closed while the canvas is being moved. */
.project-surface--moving {
  cursor: grab;
}

/* The live color under the eyedropper: a small chip a little below and right of the tip, never in the way of the
 * press. */
.project-surface__pen-pointer {
  position: absolute;
  pointer-events: none;
}

.project-surface__pick-chip {
  position: absolute;
  display: flex;
  align-items: center;
  gap: var(--space-6);
  transform: translate(var(--space-16), var(--space-16));
  padding: var(--space-4) var(--space-8) var(--space-4) var(--space-4);
  color: var(--ink);
  font: var(--text-meta-small);
  background: var(--panel);
  border-radius: var(--radius-sm);
  box-shadow: inset 0 0 0 1px var(--swatch-edge);
  pointer-events: none;
}

.project-surface__pick-chip--flip-x {
  transform: translate(calc(-100% - var(--space-16)), var(--space-16));
}

.project-surface__pick-chip--flip-y {
  transform: translate(var(--space-16), calc(-100% - var(--space-16)));
}

.project-surface__pick-chip--flip-x.project-surface__pick-chip--flip-y {
  transform: translate(calc(-100% - var(--space-16)), calc(-100% - var(--space-16)));
}

.project-surface__pick-chip-swatch {
  width: var(--space-16);
  height: var(--space-16);
  background: var(--pick-color);
  border-radius: var(--radius-sm);
  box-shadow: inset 0 0 0 1px var(--swatch-edge);
}

.project-surface--dragging {
  cursor: grabbing;
}

.project-surface__canvas {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
}
</style>
