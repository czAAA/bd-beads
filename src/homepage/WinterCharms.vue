<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import AppLogo from '../components/ui/AppLogo.vue'
import { PROJECT_THEMES, drawFlatBead } from '../rendering/beadLook'
import { CELL_SIZE_PX } from '../rendering/cellSize'
import { paintedOnly } from '../rendering/liftedPiece'
import { renderProject } from '../rendering/projectRenderer'
import { spaceOf } from '../rendering/space'
import { useResolvedTheme } from '../theme/useResolvedTheme'
import { afterPaint } from './afterPaint'
import { cssPx } from './cssPx'
import { charmProject, placeWinter, type PlacedCharm, type PlacedMark, type Side } from './winterCharms'

// The Winter charms and their three marks around the Homepage's box (Homepage card, tickets 1102, 1109), placed and
// drawn after the first paint so the page opens no slower, and placed again as the screen is resized. Decoration only.
const props = defineProps<{
  /** The canvas box they lie around. */
  box: HTMLElement | undefined
  /** The box's drawing area, between the Canvas strip and the Progress bar: the small charms keep to its height. */
  drawing: HTMLElement | undefined
  /** The Menu or a dialog is open in the box: the small charms, drawn above it, step away. */
  covered: boolean
  /** `--homepage-scale`: a screen past 1440 × 900 grows them with the box (ticket 1059). */
  scale: number
}>()

const theme = useResolvedTheme()
/** The theme's look with nothing but the beads: no ground, tiles, Lifted piece, piece line or Position marks. */
const BEADS_ONLY = { background: 'transparent', tonalTiles: false, liftedPiece: false, pieceLine: 'transparent', positionMark: 'transparent' }
const rootEl = ref<HTMLElement>()
const charms = shallowRef<PlacedCharm[]>([])
const marks = shallowRef<PlacedMark[]>([])
/** Each charm's canvas by its place in `charms`: a v-for's ref array keeps no order. */
const canvases = new Map<number, HTMLCanvasElement>()

function place() {
  if (!rootEl.value || !props.box || !props.drawing) return
  const page = rootEl.value.getBoundingClientRect()
  const box = props.box.getBoundingClientRect()
  const drawing = props.drawing.getBoundingClientRect()
  const placed = placeWinter({
    width: page.width,
    height: page.height,
    box: { left: box.left - page.left, right: box.right - page.left },
    drawing: { top: drawing.top - page.top, bottom: drawing.bottom - page.top },
    bead: cssPx(rootEl.value, '--winter-charm-bead') * props.scale,
    scale: props.scale,
    clear: cssPx(rootEl.value, '--winter-charm-clear'),
    least: cssPx(rootEl.value, '--winter-charm-room'),
    drift: cssPx(rootEl.value, '--winter-charm-drift'),
    small: {
      clear: cssPx(rootEl.value, '--winter-charm-edge-clear'),
      reach: cssPx(rootEl.value, '--winter-charm-reach'),
      leastBead: cssPx(rootEl.value, '--winter-charm-least-bead'),
    },
  })
  marks.value = placed.marks
  charms.value = placed.charms
  void nextTick(draw)
}

/** A charm's drawn size in CSS px, unturned: its renderer extent at its bead. */
function drawnSize(charm: PlacedCharm): { width: number; height: number; zoom: number } {
  const zoom = charm.bead / CELL_SIZE_PX
  const { extent } = spaceOf(charmProject(charm.id)!, false)
  return { width: extent.width * zoom, height: extent.height * zoom, zoom }
}

/** Each charm's painted beads only, on no ground, in the theme shown. */
function draw() {
  const look = PROJECT_THEMES[theme.value]
  const pixelRatio = window.devicePixelRatio || 1
  charms.value.forEach((charm, index) => {
    const canvas = canvases.get(index)
    const project = charmProject(charm.id)
    const context = canvas?.getContext('2d')
    if (!canvas || !context || !project) return
    const { width, height, zoom } = drawnSize(charm)
    canvas.width = Math.round(width * pixelRatio)
    canvas.height = Math.round(height * pixelRatio)
    const region = { x: 0, y: 0, width, height }
    renderProject(context, {
      project,
      space: spaceOf(project, false),
      region,
      zoom,
      pixelRatio,
      theme: { ...look, ...BEADS_ONLY },
      drawBead: paintedOnly(drawFlatBead),
      rowMarks: false,
      positionMarks: false,
    })
  })
}

/** Where a charm or mark lies: its middle, the side's drift and, for a charm, its size and angle. */
function placeStyle(item: { side: Side; x: number; y: number }, size?: { width: number; height: number }, turn = 0) {
  return {
    left: `${item.x}px`,
    top: `${item.y}px`,
    '--winter-side': item.side === 'left' ? 1 : -1,
    '--winter-turn': `${turn}deg`,
    ...(size ? { width: `${size.width}px`, height: `${size.height}px` } : {}),
  }
}

// Placed again once a resize has laid the page out: the box regrows with the scale only after the resize event.
let resized: ResizeObserver | undefined
onMounted(() =>
  afterPaint(() => {
    if (!rootEl.value) return
    place()
    if (typeof ResizeObserver === 'undefined') return // A test page without one: placed once.
    resized = new ResizeObserver(place)
    resized.observe(rootEl.value)
    if (props.box) resized.observe(props.box)
    if (props.drawing) resized.observe(props.drawing)
  }),
)
onBeforeUnmount(() => resized?.disconnect())
watch(theme, draw)
</script>

<template>
  <span ref="rootEl" class="winter-charms" :class="{ 'winter-charms--covered': covered }" aria-hidden="true" data-testid="winter-charms">
    <AppLogo
      v-for="(mark, index) in marks"
      :key="`mark-${index}`"
      class="winter-charms__item winter-charms__mark"
      :class="mark.large ? 'winter-charms__mark--large' : 'winter-charms__mark--small'"
      :size="mark.size"
      :style="placeStyle(mark)"
      data-testid="winter-mark"
    />
    <canvas
      v-for="(charm, index) in charms"
      :key="`charm-${index}`"
      :ref="(el) => (el ? canvases.set(index, el as HTMLCanvasElement) : canvases.delete(index))"
      class="winter-charms__item"
      :class="{ 'winter-charms__item--over': charm.over }"
      :style="placeStyle(charm, drawnSize(charm), charm.turn)"
      :data-charm="charm.id"
      data-testid="winter-charm"
    />
  </span>
</template>

<style scoped>
/* The charms and marks lie at their middles, each side drifting the other way as the box turns from the first section
 * (`--progress` 0) to the last, by `--winter-charm-drift` each way, which their places already keep clear. */
.winter-charms {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.winter-charms__item {
  position: absolute;
  display: block;
  pointer-events: none;
  --winter-drift: calc(var(--winter-charm-drift) * (1 - 2 * var(--progress, 0)) * var(--winter-side));
  transform: translate(-50%, -50%) translateY(var(--winter-drift)) rotate(var(--winter-turn));
  transition: transform var(--section-turn) var(--ease-standard);
}

.winter-charms__mark {
  color: var(--accent);
}

.winter-charms__mark--large {
  stroke-width: 1.4;
  opacity: 0.07;
}

.winter-charms__mark--small {
  stroke-width: 2.6;
  opacity: 0.16;
}

/* A small charm lies over the box's edge (ticket 1109), so above the box, and steps away while the Menu or a dialog
 * is open in it. The marks and the ten stay under the box. */
.winter-charms__item--over {
  z-index: 2;
  transition:
    transform var(--section-turn) var(--ease-standard),
    opacity var(--duration-fast) var(--ease-standard),
    visibility 0s;
}

.winter-charms--covered .winter-charms__item--over {
  visibility: hidden;
  opacity: 0;
  transition:
    transform var(--section-turn) var(--ease-standard),
    opacity var(--duration-fast) var(--ease-standard),
    visibility 0s linear var(--duration-fast);
}

/* Reduced motion: they stand still at their places. */
@media (prefers-reduced-motion: reduce) {
  .winter-charms__item {
    transform: translate(-50%, -50%) rotate(var(--winter-turn));
    transition: none;
  }
}
</style>
