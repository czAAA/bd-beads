<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  GRID_BORDER_PX,
  RULER_GUTTER_PX,
  canvasContentWidthPx,
  rotationSwapsAxes,
  type GridPosition,
  type PreviewCell,
} from '../../domain/grid'
import { screenSideOf, stickDistances, type Side, type Stick } from '../../domain/rulerStick'
import type { MirrorAxisCounts } from '../../domain/mirror'
import type { Pattern } from '../../domain/pattern'
import type { Selection } from '../../domain/selection'
import { patternExtentPx } from '../../rendering/patternRenderer'
import type { TourMarks } from '../../rendering/overlayRenderer'
import PatternSurface from './PatternSurface.vue'
import PatternRuler from './PatternRuler.vue'

const props = defineProps<{
  pattern: Pattern
  zoom: number
  previewCells?: PreviewCell[]
  previewColor?: string | null
  selection?: Selection
  /** Mirror's per-direction axis counts (ticket 44); undefined, or both 0, draws no axis lines. */
  mirrorAxisCounts?: MirrorAxisCounts
  /** Mirror's "Mirror current" hover preview (ticket 47): cells a hovered button would overwrite. */
  dimmedCells?: GridPosition[]
  /** The keyboard's bead cursor (ticket 159): drawn by the surface, its row and column marked on the rulers. */
  cursor?: GridPosition
  /** The Pattern's accessible name, for the surface. */
  label?: string
  /** What the Tour marks on the Pattern (ticket 80). */
  tourMarks?: TourMarks
}>()
const emit = defineEmits<{
  'cell-primary-down': [row: number, column: number]
  'cell-primary-move': [row: number, column: number]
  'cell-secondary-down': [row: number, column: number]
  'cell-secondary-move': [row: number, column: number]
  'cell-hover': [row: number, column: number]
  'hover-end': []
  'cursor-key': [event: KeyboardEvent]
  'keyboard-focus': [focused: boolean]
  /** A ruler number was clicked (ticket 123): relayed up from whichever of the four PatternRuler instances it came from. */
  'select-line': [selection: Selection]
}>()

/** Relays a ruler's own `select` (see PatternRuler.vue) as this component's `select-line`, shared by all four rulers below rather than each carrying its own copy of the same lambda. */
function onSelectLine(selection: Selection) {
  emit('select-line', selection)
}

/*
 * Sticky rulers (ticket 225): the rulers live inside the transform that zooms and turns them, which CSS `position:
 * sticky` cannot see through, so they are carried along by hand. On every scroll the box is measured against the
 * panel that scrolls it, and each ruler gets the distance its screen edge has scrolled away, converted to its own
 * unzoomed px, so it stays at that edge — at any zoom and any turn.
 */
const boxEl = ref<HTMLElement>()
const stick = ref<Stick>({ top: 0, right: 0, bottom: 0, left: 0 })
let scroller: HTMLElement | undefined
let resizeObserver: ResizeObserver | undefined

function findScroller(from: HTMLElement): HTMLElement | undefined {
  for (let el = from.parentElement; el && el !== document.documentElement; el = el.parentElement) {
    const style = getComputedStyle(el)
    if (style.overflowX !== 'visible' || style.overflowY !== 'visible') return el
  }
  return undefined
}

function measureStick() {
  if (!boxEl.value || !scroller) return
  stick.value = stickDistances(boxEl.value.getBoundingClientRect(), scroller.getBoundingClientRect(), RULER_GUTTER_PX * props.zoom)
}

onMounted(() => {
  if (!boxEl.value) return
  scroller = findScroller(boxEl.value)
  scroller?.addEventListener('scroll', measureStick, { passive: true })
  window.addEventListener('resize', measureStick)
  // The scroll panel can change size without the window doing so (a side panel opening, say).
  if (scroller && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(measureStick)
    resizeObserver.observe(scroller)
  }
  measureStick()
})
onBeforeUnmount(() => {
  scroller?.removeEventListener('scroll', measureStick)
  window.removeEventListener('resize', measureStick)
  resizeObserver?.disconnect()
})
// A zoom, turn or resize of the box moves its edges without a scroll event.
watch(() => [props.zoom, props.pattern.rotation, props.pattern.columns, props.pattern.rows, props.pattern.technique], () => void nextTick(measureStick))

/** How far the ruler on this side of the Pattern is carried: the scrolled-away distance of the screen edge it now faces, in its own px. */
function stickOf(side: Side): number {
  return stick.value[screenSideOf(side, props.pattern.rotation)] / props.zoom
}

/** The space the Pattern takes up in the ruled layout: the rulers are laid out around it, and the surface (which is not inside the transform that scales the rulers) is placed over it. */
const gridSlotStyle = computed(() => {
  const { width, height } = patternExtentPx(props.pattern.technique, props.pattern.columns, props.pattern.rows)
  return { width: `${width + GRID_BORDER_PX * 2}px`, height: `${height + GRID_BORDER_PX * 2}px` }
})

/** Where the surface sits in the box: one ruler gutter in from the corner, whichever way the Pattern is turned (the box and the gutters turn together). */
const surfaceLayerStyle = computed(() => ({
  left: `${RULER_GUTTER_PX * props.zoom}px`,
  top: `${RULER_GUTTER_PX * props.zoom}px`,
}))

/**
 * The Pattern's own footprint (columns × rows, per its technique), before the view-only rotation turns it on
 * screen (see Pattern.rotation) — this never itself swaps, since the grid/technique geometry is unaffected by that
 * setting (tickets 28, 171).
 */
const unrotatedContentWidth = computed(() =>
  canvasContentWidthPx(props.pattern.technique, props.pattern.columns, props.zoom),
)
// The height is the drawn Pattern's (brick stitch's seams included), not the layout maths' canvasContentHeightPx, so the box shows every row.
const unrotatedContentHeight = computed(() => {
  const { height } = patternExtentPx(props.pattern.technique, props.pattern.columns, props.pattern.rows)
  return (RULER_GUTTER_PX * 2 + height + GRID_BORDER_PX * 2) * props.zoom
})

/**
 * The box hugs the Pattern: it's exactly as big as the zoomed Pattern and its rulers (ticket 18), with no cap of its
 * own (ticket 27) — the zoom passed in is already fit to the real canvas area upstream (see usePatternZoom), so at
 * the fit level this is already within the available space. Manually zooming in past that can still outgrow the
 * canvas area; the scrollbar for that lives one level up, on the canvas area itself (ticket 28), not here. At a
 * quarter turn either way, the box's reserved footprint swaps to match the turned picture (tickets 28, 171); the
 * actual grid keeps its own unrotated width/height (see pattern-canvas__rotate below) and is turned to fit inside
 * it. Upside down (180°) the footprint is unchanged.
 */
const contentWidth = computed(() =>
  rotationSwapsAxes(props.pattern.rotation) ? unrotatedContentHeight.value : unrotatedContentWidth.value,
)
const contentHeight = computed(() =>
  rotationSwapsAxes(props.pattern.rotation) ? unrotatedContentWidth.value : unrotatedContentHeight.value,
)

/** The scaled content has no layout size of its own (transforms don't reflow), so the box states it explicitly — both for its own size and so an ancestor that scrolls can tell it's grown past the available space. */
const contentStyle = computed(() => ({
  width: `${contentWidth.value}px`,
  height: `${contentHeight.value}px`,
}))

/**
 * Centers the Pattern at its own natural (unrotated) size inside the box above, then turns it about that center by
 * Pattern.rotation (tickets 28, 171) — a plain view rotation, like turning a photo, that never touches the grid or
 * its technique geometry. Centering (rather than anchoring a corner) is what makes a rotated box's bounding
 * footprint land exactly on the swapped contentWidth/contentHeight above with no manual offset math.
 */
const rotateStyle = computed(() => ({
  width: `${unrotatedContentWidth.value}px`,
  height: `${unrotatedContentHeight.value}px`,
  transform: `translate(-50%, -50%) rotate(${props.pattern.rotation}deg)`,
}))
</script>

<template>
  <div ref="boxEl" class="pattern-canvas" data-testid="pattern-canvas-viewport" :style="contentStyle">
    <div class="pattern-canvas__clip">
      <div class="pattern-canvas__rotate" :style="rotateStyle">
        <div class="pattern-canvas__scaled" :style="{ transform: `scale(${zoom})` }">
          <div class="pattern-canvas__ruled">
            <span />
            <PatternRuler :pattern="pattern" axis="column" edge="start" :stick-px="stickOf('top')" :cursor-index="cursor?.column" @select="onSelectLine" />
            <span />

            <PatternRuler :pattern="pattern" axis="row" edge="start" :stick-px="stickOf('left')" :cursor-index="cursor?.row" @select="onSelectLine" />
            <div class="pattern-canvas__grid-slot" :style="gridSlotStyle" />
            <PatternRuler :pattern="pattern" axis="row" edge="end" :stick-px="stickOf('right')" :cursor-index="cursor?.row" @select="onSelectLine" />

            <span />
            <PatternRuler :pattern="pattern" axis="column" edge="end" :stick-px="stickOf('bottom')" :cursor-index="cursor?.column" @select="onSelectLine" />
            <span />
          </div>
        </div>
      </div>

      <!--
        The Drawing surface (ADR 0018): not inside the CSS transform above, which would stretch a canvas rather than
        draw it sharp at the zoom, but over the space that transform's layout left for the Pattern.
      -->
      <div class="pattern-canvas__surface-layer" :style="surfaceLayerStyle">
        <PatternSurface
          :pattern="pattern"
          :zoom="zoom"
          :preview-cells="previewCells"
          :preview-color="previewColor"
          :selection="selection"
          :mirror-axis-counts="mirrorAxisCounts"
          :dimmed-cells="dimmedCells"
          :cursor="cursor"
          :tour-marks="tourMarks"
          :label="label"
          @cursor-key="(event) => emit('cursor-key', event)"
          @keyboard-focus="(focused) => emit('keyboard-focus', focused)"
          @cell-primary-down="(row, column) => emit('cell-primary-down', row, column)"
          @cell-primary-move="(row, column) => emit('cell-primary-move', row, column)"
          @cell-secondary-down="(row, column) => emit('cell-secondary-down', row, column)"
          @cell-secondary-move="(row, column) => emit('cell-secondary-move', row, column)"
          @cell-hover="(row, column) => emit('cell-hover', row, column)"
          @hover-end="emit('hover-end')"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
/*
 * The box is the bounded notepad page: its size is set to the Pattern by contentStyle, so a wide-and-short or
 * narrow-and-tall Pattern gets a box its own shape rather than sitting in a fixed square (ticket 18). It's no
 * longer a scroll container itself (ticket 28). If a manual zoom-in makes this box bigger than the canvas area
 * around it, that area scrolls horizontally to reach the rest of it (App.vue's .app-shell__canvas); nothing
 * anywhere clips or scrolls vertically — a tall Pattern just grows this box, and the page, taller, and the
 * browser's own scrollbar reaches the rest of it.
 */
.pattern-canvas {
  position: relative;
  margin: 0 auto;
  /* No frame of its own since ticket 143: the canvas box around it is the frame, and the board carries the beads. */
  /*
   * Painting is a mousedown-drag across cells and ruler numbers alike; without this, that drag also selects the
   * ruler's number text, and a later drag starting inside that selection triggers the browser's native "drag the
   * selection" gesture -- which is what makes the whole canvas look like it's being picked up and moved.
   */
  user-select: none;
  -webkit-user-select: none;
}

/*
 * Clips only the rotated/scaled grid's own paint (rounding at odd zoom levels can bleed a fraction of a pixel past
 * its edge) — its own layer rather than overflow:hidden on .pattern-canvas itself (ticket 35).
 */
.pattern-canvas__clip {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: inherit;
}

/* Positioned at the box's center and sized to the Pattern's own (unrotated) footprint, then rotated about that same center — see rotateStyle. */
.pattern-canvas__rotate {
  position: absolute;
  top: 50%;
  left: 50%;
  /* Over the surface, so a ruler carried along with the scroll covers the beads that pass under it (ticket 225); only the numbers take the pointer. */
  z-index: 1;
  pointer-events: none;
}

.pattern-canvas__rotate :deep(.pattern-ruler) {
  pointer-events: auto;
}

.pattern-canvas__scaled {
  display: inline-block;
  transform-origin: top left;
}

/* Keeps the ruled layout's middle cell the Pattern's size while the surface that draws it sits elsewhere (see the surface layer). */
.pattern-canvas__grid-slot {
  flex: none;
}

.pattern-canvas__surface-layer {
  position: absolute;
}

/* Ruler gutter, pattern, ruler gutter — in both directions, so the grid is numbered on all four sides. */
.pattern-canvas__ruled {
  display: grid;
  grid-template-columns: auto auto auto;
  grid-template-rows: auto auto auto;
}
</style>
