<script setup lang="ts">
import { firstFrameId } from '../domain/layerRecord'
import { computed, onMounted, ref, watch } from 'vue'
import RowProgressControls from '../components/canvas/RowProgressControls.vue'
import { sizeCanvas } from '../components/canvas/surface/useSurfaceDrawing'
import { reducedMotion } from '../components/canvas/surface/useSurfaceOverlay'
import { useRowMotion } from '../components/canvas/surface/useRowMotion'
import { useFittingForm } from '../composables/canvas/useFittingForm'
import { STRIP_FITS, STRIP_FIT_PROPS, stripWidth } from '../components/canvas/rowProgressFit'
import { useA11yAnnouncer } from '../composables/ui/useA11yAnnouncer'
import { useElementSize } from '../composables/ui/useElementSize'
import { withLaidTurn } from '../domain/framePlacement'
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
// and stepped by the editor's Row progress, with the editor's strip (Back a row, counter, track, Row done) under it.
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
/** The cuff as it is drawn: by its Frame's own turn (ticket 1186), as every preview is. */
const project = computed(() => withLaidTurn(woven.project.value, undefined, firstFrameId(woven.project.value)))

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
  frame: () => firstFrameId(project.value),
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

/** The strip's forms, best first (the editor's, MarginSheet card): the counter's words; short, "7/95 · column 4"; no
 * track; Back a row as its arrow alone. Row done stays. */
const stripEl = ref<HTMLElement>()
const { width: cuffRoom } = useElementSize(rootEl)
const stripFit = useFittingForm({
  forms: () => STRIP_FITS,
  // Read off the page until the observer first reports, so the form is chosen before the first paint and the Welcome
  // holds still as it arrives (ticket 1170).
  room: () => cuffRoom.value || rootEl.value?.clientWidth || 0,
  measure: () => stripWidth(stripEl.value?.firstElementChild as HTMLElement | null | undefined),
  observed: () => [stripEl.value?.firstElementChild],
  labels: () => locale.value,
})
const stripProps = computed(() => STRIP_FIT_PROPS[stripFit.value ?? STRIP_FITS.at(-1)!])
</script>

<template>
  <div ref="rootEl" class="welcome-cuff" :style="{ '--welcome-cuff-shape': shape }" data-testid="welcome-cuff">
    <div ref="drawingEl" class="welcome-cuff__drawing" role="img" :aria-label="name" data-testid="welcome-cuff-drawing">
      <canvas ref="beadsEl" class="welcome-cuff__layer" aria-hidden="true" />
      <canvas ref="overlayEl" class="welcome-cuff__layer" aria-hidden="true" />
    </div>
    <!-- The editor's Row progress strip, as under a Frame's sheet (Homepage card, ticket 1223): the app's own component. -->
    <div ref="stripEl" class="welcome-cuff__strip">
      <RowProgressControls
        :project="project"
        :frame="firstFrameId(project)"
        :row-press="woven.rowPress.value"
        form="woven"
        v-bind="stripProps"
        testid="welcome-cuff"
        @move-row="woven.moveRow"
      />
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
  position: relative;
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

/* The strip, as wide as the cuff: Back a row, the counter, the track and Row done. */
.welcome-cuff__strip {
  display: flex;
  text-align: start;
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
