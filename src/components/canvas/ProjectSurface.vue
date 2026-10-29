<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import type { PreviewCell } from '../../domain/grid'
import type { Handedness, InputMode } from '../../domain/inputMode'
import { frameOf, layerOf, orientationOf, quarterTurnOf, withCanvas } from '../../domain/layerRecord'
import { nearestQuarterTurn, tiltOf } from '../../domain/canvasOrientation'
import { placedFrame } from '../../domain/layerWeave'
import { rowProgressOn } from '../../domain/rowProgress'
import type { Project } from '../../domain/project'
import { selectionFrame, selectionLayer, type PasteStamp, type Selection } from '../../domain/selection'
import { toolCapabilities, type ToolCapabilities } from '../../domain/tool'
import type { Size } from '../../rendering/cellSize'
import { SETTLE_MS, twistTransform } from '../../rendering/gestureView'
import { marginForm, marginScale } from '../../rendering/marginForm'
import { marginSheetPx } from '../../rendering/projectRenderer'
import { rulerLayout, type RulerLayout } from '../../rendering/rulers'
import { ruledPieces, type RuledPieces } from '../../rendering/ruledPieces'
import { spaceOf } from '../../rendering/space'
import type { FrameAnchor, SelectionAnchor } from '../../composables/tools/selectionBarPlacement'
import { surfaceView, type Scroll, type SurfaceView } from '../../rendering/surfaceView'
import { tiltedView, type TiltedView } from '../../rendering/tiltedView'
import type { TwistPhase } from '../../composables/canvas/useCanvasView'
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
  /** The Canvas's orientation as shown, in degrees: live while two fingers twist it (ticket 0672); the Project's when
   * left out. */
  orientation?: number
  /** Whether two fingers twist the Canvas, or it eases onto a quarter turn after them (ticket 0709): the drawing is
   * held as it is and turned whole until it is over. */
  twist?: TwistPhase
  /** What the tool in hand and the modes on let a press, the pointer and the overlay do (ticket 0619,
   * `toolCapabilities`); absent, no tool is in hand and the bead-shaped marker shows over the beads. */
  tools?: ToolCapabilities
  /** Beads to show a hover preview on (ticket 23): the hovered bead, or a whole
   * copied block under the cursor (ticket 31). */
  previewCells?: PreviewCell[]
  /** A copied block under the cursor on a grid, aimed where Paste would land it (ticket 0675): drawn only where it
   * shows. */
  previewStamp?: PasteStamp
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
  /** Whether ruler numbers are drawn (the Rulers toggle), and the Pieces' lines with them; the Frame's line is drawn
   * either way. */
  showRulers?: boolean
  /** Whether a Paint or Eraser stroke is going on: the rulers then keep their Pieces until it ends (ticket 0674). */
  stroking?: boolean
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

/** The colors the beads are drawn in follow the app's theme and each layer's own Background (ticket 0666); a change
 * redraws both layers. */
const canvasBackground = useCanvasBackground(() => props.project)
const theme = canvasBackground.projectTheme
const frameTheme = canvasBackground.frameTheme

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

// A Canvas twisted off a quarter turn (ticket 0672) is drawn at that quarter turn on a larger square, which is turned
// the rest about the surface's middle: the drawing, the hit test, the rulers and the Frame's handles keep the quarter
// turn's own mapping, and only a point crossing between the screen and the drawing is turned (`tiltedView`).
const shownOrientation = computed(() => props.orientation ?? orientationOf(props.project))
const quarterTurn = computed(() => nearestQuarterTurn(shownOrientation.value))
const leaning = computed(() => tiltedView(size.value, tiltOf(shownOrientation.value)))
/** The Project at the quarter turn it is drawn at: itself, unless a live twist has passed half way to another. */
const drawnProject = computed(() => (quarterTurnOf(props.project) === quarterTurn.value ? props.project : withCanvas(props.project, { orientation: quarterTurn.value })))
/** Where the drawing's top-left is: the view's scroll, less how far the larger square reaches past the surface. */
const drawnScroll = computed(() => {
  const { offset } = leaning.value
  return offset.x === 0 && offset.y === 0 ? props.scroll : { x: props.scroll.x - offset.x, y: props.scroll.y - offset.y }
})
const drawnSize = computed(() => leaning.value.drawn)
/** The props as a view of the drawing sees them: the Project at its quarter turn and the drawing's scroll. */
function viewProps(view: { project: Project; zoom: number; scroll: Scroll }): typeof props {
  return new Proxy(props, {
    get: (target, key) => (key === 'project' ? view.project : key === 'scroll' ? view.scroll : key === 'zoom' ? view.zoom : Reflect.get(target, key)),
  })
}
const drawnProps = viewProps({ get project() { return drawnProject.value }, get zoom() { return props.zoom }, get scroll() { return drawnScroll.value } })

/** Where the Project's positions live: built once and handed to both layers, so they can't disagree about where a
 * position is. */
const space = computed(() => spaceOf(props.project, true))

/** The Canvas's Weave (ADR 0079), with the cell its Bead and Bead shape draw it in. */
const canvasWeave = computed(() => layerOf(props.project, 'canvas').weave)

/** How a bead and a point of the viewport map onto each other: built once, so the pointer and the Frame's handles
 * agree with what is drawn. */
const surface = computed(() =>
  surfaceView({ space: space.value, technique: canvasWeave.value.technique, techniqueSettings: canvasWeave.value.techniqueSettings, cell: canvasWeave.value.cell, frame: placedFrame(props.project), rotation: quarterTurn.value, zoom: props.zoom, scroll: drawnScroll.value, viewport: drawnSize.value }),
)

/** The Pieces the rulers hang from: counted once per edit, and held through a stroke, growing only where it paints,
 * until it ends (ticket 0674). */
const pieces = computed<RuledPieces>((previous) => ruledPieces(previous, props.project, { numbers: props.showRulers ?? true, stroking: props.stroking ?? false }))

/** The numbers' size: 11px, 12px on a phone (Rulers card). */
function rulerFontPx(): number {
  return window.innerWidth <= 743 ? 12 : 11
}

/** The form and scale the Frame's margin sheet takes at this zoom (tickets 0658, 0698): the Frame's numbers hang on it. */
const sheetLook = computed(() => {
  const band = (marginSheetPx(props.project)?.band ?? 0) * props.zoom
  return band ? { sheet: marginForm(band), sheetScale: marginScale(band) } : {}
})

/** The rulers of this view, laid out once: the overlay draws them and a press asks them what it selects, so the two
 * cannot disagree. */
const rulers = computed(() => rulerLayout(props.project, surface.value, { fontPx: rulerFontPx(), numbers: props.showRulers ?? true, ...sheetLook.value, pieces: pieces.value }))

/** A drawing as the layers made it: the view it was drawn for, and how it maps to the screen. */
interface HeldDrawing {
  project: Project
  zoom: number
  scroll: Scroll
  size: Size
  leaning: TiltedView
  surface: SurfaceView
  rulers: RulerLayout
}
// While two fingers twist the Canvas (ticket 0709) the layers are given the view they last drew and draw nothing more;
// the drawing is laid where the live view shows its beads by one transform. It is drawn afresh when the fingers lift
// (easing onto a quarter turn first) and, so a long hold is sharp, after a pause with them still.
const held = shallowRef<HeldDrawing>()
let holdTimer: ReturnType<typeof setTimeout> | undefined
function hold(): void {
  held.value = { project: drawnProject.value, zoom: props.zoom, scroll: drawnScroll.value, size: drawnSize.value, leaning: leaning.value, surface: surface.value, rulers: rulers.value }
}
watch(() => props.twist, (phase) => {
  clearTimeout(holdTimer)
  if (!phase) held.value = undefined
  else if (!held.value) hold()
})
watch([() => props.orientation, () => props.zoom, () => props.scroll], () => {
  if (props.twist !== 'turning') return
  clearTimeout(holdTimer)
  holdTimer = setTimeout(hold, SETTLE_MS)
})
onBeforeUnmount(() => clearTimeout(holdTimer))
/** The props as the layers draw from them: the held drawing's while the Canvas is twisted, else the view's. */
const layerProps = viewProps({ get project() { return held.value?.project ?? drawnProject.value }, get zoom() { return held.value?.zoom ?? props.zoom }, get scroll() { return held.value?.scroll ?? drawnScroll.value } })
const layerSize = computed(() => held.value?.size ?? drawnSize.value)
const layerSurface = computed(() => held.value?.surface ?? surface.value)
const layerRulers = computed(() => held.value?.rulers ?? rulers.value)

/** The larger square the canvases fill while the Canvas leans, turned about the surface's middle; a held drawing's box
 * as it was made, laid where the view shows it, eased there as the twist settles. */
const drawingStyle = computed(() => {
  const holding = held.value
  if (holding) {
    const { drawn, offset } = holding.leaning
    const { a, b, c, d, e, f } = twistTransform(holding, { surface: surface.value, leaning: leaning.value })
    return {
      left: `${-offset.x}px`, top: `${-offset.y}px`, width: `${drawn.width}px`, height: `${drawn.height}px`,
      transformOrigin: '0 0', transform: `matrix(${a}, ${b}, ${c}, ${d}, ${e}, ${f})`, willChange: 'transform',
      ...(props.twist === 'settling' ? { transition: 'transform var(--duration-base) var(--ease-out)' } : {}),
    }
  }
  const { degrees, drawn, offset } = leaning.value
  if (degrees === 0) return undefined
  return { left: `${-offset.x}px`, top: `${-offset.y}px`, width: `${drawn.width}px`, height: `${drawn.height}px`, transform: `rotate(${degrees}deg)` }
})

/** Where the Selection is on screen, told to the Selection bar (ticket 415). */
watch(
  [surface, () => props.selection, size],
  () => {
    const selected = props.selection
    if (!selected || size.value.width === 0) {
      emit('selection-anchor', undefined)
      return
    }
    // The Selection bar stands upright over the box the Selection covers on screen, leaning or not.
    const box = leaning.value.screenBox(surface.value.beadBox(selectionFrame(selected), selectionLayer(props.project, selected)))
    emit('selection-anchor', { box: { left: box.x, top: box.y, width: box.width, height: box.height }, viewport: { ...size.value } })
  },
  { immediate: true, flush: 'post' },
)

/** Where the Frame and its margin sheet are on screen, none once the sheet is out of view (tickets 417, 473, 0657):
 * told to the sheet's tools and title block. */
const frameAnchor = computed<FrameAnchor | undefined>(() => {
  const frame = frameOf(props.project)
  const grid = marginSheetPx(props.project)
  if (!frame || !grid || size.value.width === 0) return undefined
  const corners = [surface.value.gridToPoint(grid.sheet.x, grid.sheet.y), surface.value.gridToPoint(grid.sheet.x + grid.sheet.width, grid.sheet.y + grid.sheet.height)]
  const drawnSheet = {
    x: Math.min(corners[0].x, corners[1].x),
    y: Math.min(corners[0].y, corners[1].y),
    width: Math.abs(corners[1].x - corners[0].x),
    height: Math.abs(corners[1].y - corners[0].y),
  }
  // Scrolled wholly out of view, the sheet has no tools to keep on screen.
  const seen = leaning.value.screenBox(drawnSheet)
  const { width, height } = size.value
  if (seen.x + seen.width <= 0 || seen.y + seen.height <= 0 || seen.x >= width || seen.y >= height) return undefined
  // The sheet's tools are laid out as the drawing is, before it leans, and lean with it (`tilt`).
  const { offset, degrees } = leaning.value
  const unleaned = ({ x, y, width, height }: { x: number; y: number; width: number; height: number }) => ({ left: x - offset.x, top: y - offset.y, width, height })
  return {
    box: unleaned(surface.value.frameBox(frame)),
    sheet: unleaned(drawnSheet),
    band: grid.band * props.zoom,
    viewport: { ...size.value },
    origin: unleaned(surface.value.beadBox({ row: 0, column: 0, rows: 1, columns: 1 }, 'canvas')),
    ...(degrees === 0 ? {} : { tilt: degrees }),
  }
})
watch(frameAnchor, (anchor) => emit('frame-anchor', anchor), { immediate: true, flush: 'post' })

/** Row marks are drawn unless the Row highlight toggle is off; the project's own Row progress decides the rest. */
const marksShown = computed(() => props.rowMarks && rowProgressOn(props.project))

const marginCue = useMarginCue(props)
const pointer = useSurfacePointer({ props: drawnProps, emit, root: rootEl, size, surface, leaning, marksShown, refuse: marginCue.refuse })
const { handlers, surfaceClass, cursorStyle, penPointer, pickChip, pressMoveHandle } = pointer
const { oncePerFrame } = useFrameScheduler()
useBeadLayer({ props: layerProps, canvas: baseEl, size: layerSize, space, theme, frameTheme, showFinished: pointer.showFinished, marksShown, oncePerFrame })
useSurfaceOverlay({
  props: layerProps, canvas: overlayEl, size: layerSize, space, surface: layerSurface, rulers: layerRulers, theme, marksShown, oncePerFrame,
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
    :data-rotation="quarterTurn"
    :data-tilt="leaning.degrees || undefined"
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
    <div class="project-surface__drawing" :style="drawingStyle">
      <canvas ref="baseEl" class="project-surface__canvas" data-testid="project-surface-cells" />
      <canvas ref="overlayEl" class="project-surface__canvas" data-testid="project-surface-overlay" />
    </div>
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

/* The canvases' box: the surface itself, or, while the Canvas leans off a quarter turn, a larger square turned about
 * its middle (ticket 0672). */
.project-surface__drawing {
  position: absolute;
  inset: 0;
}

.project-surface__canvas {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
}
</style>
