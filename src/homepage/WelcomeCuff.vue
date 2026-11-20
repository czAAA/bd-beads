<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import RowProgressControls from '../components/canvas/RowProgressControls.vue'
import { sizeCanvas } from '../components/canvas/surface/useSurfaceDrawing'
import { reducedMotion } from '../components/canvas/surface/useSurfaceOverlay'
import { useRowMotion } from '../components/canvas/surface/useRowMotion'
import { useFittingForm } from '../composables/canvas/useFittingForm'
import { useA11yAnnouncer } from '../composables/ui/useA11yAnnouncer'
import { useElementSize } from '../composables/ui/useElementSize'
import { useI18n } from '../i18n/useI18n'
import { renderOverlay } from '../rendering/overlayRenderer'
import { renderProject } from '../rendering/projectRenderer'
import { LAST_NUMBER_ONLY_BELOW_ZOOM } from '../rendering/rulers'
import { useCanvasBackground } from '../theme/useCanvasBackground'
import { shownCuffView } from './cuffView'
import { useWovenCuff } from './useWovenCuff'
import { cuffName } from './welcomeCopy'

// The Welcome tile's cuff, being woven (Homepage card, ticket 1157): the peacock cuff with Row progress on, drawn as the
// editor draws its Frame (the Project renderer, its Row progress marks, the Frame's line and rulers, Row done's motion)
// and stepped by the editor's Row progress, with the Progress bar's counter, track and moves under it.
const props = defineProps<{
  /** Whether Welcome is the section shown: the cuff weaves by itself only then. */
  shown: boolean
}>()

const { t, locale } = useI18n()
const { announcement, announce } = useA11yAnnouncer()
const rootEl = ref<HTMLElement>()
const beadsEl = ref<HTMLCanvasElement>()
const overlayEl = ref<HTMLCanvasElement>()
const mounted = ref(false)

/** A design value on the cuff: a time in ms, or a count. */
function cssValue(name: string): number {
  const value = rootEl.value ? getComputedStyle(rootEl.value).getPropertyValue(name).trim() : ''
  const amount = Number.parseFloat(value)
  if (Number.isNaN(amount)) return 0
  return value.endsWith('ms') ? amount : value.endsWith('s') ? amount * 1000 : amount
}

const woven = useWovenCuff({
  // Without its design values (no style sheet) the cuff only steps by a press, and Row done goes as far as the editor's.
  timing: () => ({ stepMs: cssValue('--welcome-cuff-step'), holdMs: cssValue('--welcome-cuff-hold'), passes: cssValue('--welcome-cuff-passes') || Infinity }),
  reducedMotion,
  shown: () => mounted.value && props.shown,
  announce,
  messages: () => t.value,
})
const project = woven.project

/** Drawn at the least zoom at which the editor's rulers number their steps, then shown as wide as the tile gives, its
 * numbers drawn for that width. */
const drawingEl = ref<HTMLElement>()
const { width: shownWidth } = useElementSize(drawingEl)
const view = computed(() => shownCuffView(project.value, LAST_NUMBER_ONLY_BELOW_ZOOM, shownWidth.value))
/** The drawing's box keeps the first view's shape, so measuring it never moves what is under it as the page arrives; a
 * view drawn for another width fits inside it (ticket 0991's "holds still"). */
const shape = (({ width, height }) => width / height)(view.value.size)
const region = computed(() => ({ ...view.value.scroll, ...view.value.size }))
/** Drawn at twice its size, so it stays sharp as wide as `--welcome-cuff-width` on a 2× screen. */
const PIXEL_RATIO = 2

/** The cuff's colors as the editor's Canvas draws them: the theme shown and the Project's own Background. */
const background = useCanvasBackground(() => project.value)

const motion = useRowMotion({
  props: {
    get project() {
      return project.value
    },
    get rowPress() {
      return woven.rowPress.value
    },
  },
  beads: beadsEl,
  fade: ref(),
  view: () => view.value,
})

function drawBeads(): void {
  const canvas = beadsEl.value
  if (!canvas) return
  const { size, space, zoom } = view.value
  sizeCanvas(canvas, size.width, size.height, PIXEL_RATIO)
  const context = canvas.getContext('2d')
  if (!context) return
  const theme = background.projectTheme.value
  renderProject(context, { project: project.value, space, region: region.value, zoom, pixelRatio: PIXEL_RATIO, theme, frameTheme: background.frameTheme.value, rowMarks: true, margin: 0, positionMarks: false })
}

function drawOverlay(): void {
  const canvas = overlayEl.value
  if (!canvas) return
  const { size, space, zoom, rulers, surface } = view.value
  sizeCanvas(canvas, size.width, size.height, PIXEL_RATIO)
  const context = canvas.getContext('2d')
  if (!context) return
  renderOverlay(context, {
    project: project.value,
    space,
    region: region.value,
    zoom,
    pixelRatio: PIXEL_RATIO,
    theme: background.projectTheme.value,
    frameTheme: background.frameTheme.value,
    rowMarks: true,
    margin: 0,
    rulers: { layout: rulers, surface },
    rowMotion: motion.rowMotion.value,
  })
}

watch([project, view, background.projectTheme, background.frameTheme], drawBeads, { flush: 'post' })
watch([project, view, background.projectTheme, background.frameTheme, motion.rowMotion], drawOverlay, { flush: 'post' })
onMounted(() => {
  mounted.value = true
  drawBeads()
  drawOverlay()
})

const name = computed(() => cuffName(t.value, project.value))

/** The bar's forms, best first: the counter's words, "Pass 7 of 95 · row 4"; short, "7/95 · row 4", as the editor's
 * narrow bar has it; shortest, "7/95"; and stacked, short with the moves on a row of their own, as on a phone. */
const COUNTER_FORMS = ['words', 'short', 'shortest', 'stacked'] as const
const barEl = ref<HTMLElement>()
const { width: barRoom } = useElementSize(barEl)
/** What the bar's first row needs: the counter, the track at its least, and the moves where they share the row (on a
 * phone they take a row of their own). */
function firstRowWidth(): number {
  const items = [...(barEl.value?.querySelectorAll<HTMLElement>(':scope > .row-progress > *') ?? [])]
  const counter = items[0]
  const first = counter ? items.filter((item) => item.offsetTop < counter.offsetTop + counter.offsetHeight) : []
  const gap = barEl.value ? Number.parseFloat(getComputedStyle(barEl.value).columnGap) || 0 : 0
  const widths = first.map((item) => (item.classList.contains('progress-track') ? Number.parseFloat(getComputedStyle(item).minWidth) || 0 : item.offsetWidth))
  return widths.reduce((sum, width) => sum + width, 0) + gap * Math.max(0, first.length - 1)
}
const counterFit = useFittingForm({
  forms: () => COUNTER_FORMS,
  room: () => barRoom.value,
  measure: firstRowWidth,
  observed: () => [barEl.value?.querySelector('.row-progress__counter-text')],
  labels: () => locale.value,
})
const counterForm = computed(() => counterFit.value ?? 'stacked')
</script>

<template>
  <div ref="rootEl" class="welcome-cuff" :style="{ '--welcome-cuff-shape': shape }" data-testid="welcome-cuff">
    <div ref="drawingEl" class="welcome-cuff__drawing" role="img" :aria-label="name" data-testid="welcome-cuff-drawing">
      <canvas ref="beadsEl" class="welcome-cuff__layer" aria-hidden="true" />
      <canvas ref="overlayEl" class="welcome-cuff__layer" aria-hidden="true" />
    </div>
    <div ref="barEl" class="welcome-cuff__bar" :class="`welcome-cuff__bar--${counterForm}`">
      <RowProgressControls :project="project" :row-press="woven.rowPress.value" form="woven" testid="welcome-cuff" @move-row="woven.moveRow" />
    </div>
    <!-- A press is said as the editor says it; the weaving by itself is not. -->
    <p class="welcome-cuff__announcer" role="status" aria-live="polite" data-testid="welcome-cuff-announcer">{{ announcement }}</p>
  </div>
</template>

<style scoped>
/* At most `--welcome-cuff-width` wide with its rulers. On a short screen it gives way as the finished piece did, as
 * tall as the screen leaves it and never under `--welcome-piece-least-width` wide (Homepage card); a grown box's screen
 * is measured in its own grown px (ticket 1059), and never as taller than the box at its tallest with its margins. */
.welcome-cuff {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  width: 100%;
  max-width: clamp(
    var(--welcome-piece-least-width),
    (min(100vh / var(--homepage-scale), var(--homepage-box-height) + 2 * var(--homepage-box-margin)) - var(--welcome-beside-piece)) *
      var(--welcome-cuff-shape),
    var(--welcome-cuff-width)
  );
}

.welcome-cuff__drawing {
  position: relative;
  width: 100%;
  aspect-ratio: var(--welcome-cuff-shape);
}

.welcome-cuff__layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

/* The Progress bar's row, as wide as the cuff: the counter, the track, then Back a row and Row done. */
.welcome-cuff__bar {
  display: flex;
  align-items: center;
  gap: var(--space-12);
  min-height: var(--progress-height);
  text-align: start;
}

/* The counter's short form, where its words don't fit beside the track and the moves. */
.welcome-cuff__bar--short :deep(.row-progress__woven-step),
.welcome-cuff__bar--shortest :deep(.row-progress__woven-step),
.welcome-cuff__bar--shortest :deep(.row-progress__woven-line),
.welcome-cuff__bar--stacked :deep(.row-progress__woven-step) {
  display: none;
}

.welcome-cuff__bar--short :deep(.row-progress__woven-short),
.welcome-cuff__bar--shortest :deep(.row-progress__woven-short),
.welcome-cuff__bar--stacked :deep(.row-progress__woven-short) {
  display: inline;
}

/* Stacked, where not even that fits: the moves on a row of their own, half the bar each, as on a phone. */
.welcome-cuff__bar--stacked {
  flex-wrap: wrap;
  gap: var(--space-4) var(--space-12);
}

.welcome-cuff__bar--stacked :deep(.progress-moves) {
  flex: 1 1 100%;
  min-width: 0;
}

.welcome-cuff__bar--stacked :deep(.progress-moves > .app-button),
.welcome-cuff__bar--stacked :deep(.progress-moves .app-button-wrap) {
  flex: 1 1 0;
  min-width: 0;
}

.welcome-cuff__bar--stacked :deep(.progress-moves .app-button) {
  width: 100%;
  justify-content: center;
}

/* Phone widths: Back a row and Row done take a second row, as the editor's Progress bar does (ticket 411). */
@media (max-width: 30rem) {
  .welcome-cuff__bar {
    flex-wrap: wrap;
    align-content: center;
    gap: var(--space-4);
  }
}

.welcome-cuff__announcer {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>
