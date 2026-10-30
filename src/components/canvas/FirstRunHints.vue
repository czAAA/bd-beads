<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AppLogo from '../ui/AppLogo.vue'
import { useI18n } from '../../i18n/useI18n'
import { useMediaQuery } from '../../composables/ui/useMediaQuery'
import { contrastRatio, fromHex } from '../../domain/color'
import type { PillPosition, PillRect } from '../../domain/toolPill'
import type { BarBox } from '../../composables/tools/selectionBarPlacement'
import {
  QUIET_HINTS,
  STEP_HINTS,
  placeFirstRunHints,
  type HintId,
  type PlacedHint,
  type Size,
} from '../../composables/canvas/firstRunHintPlacement'

// The hand-drawn notes over an empty Project (FirstRunHints card, ticket 0725): draw, select, frame, export, each note
// pointing at its control (`data-hint` on it), quiet notes on Menu, Project, Mirror and the colour tile, and a welcome.
// Decoration only: hidden from screen readers and pointers, so the first press on the canvas paints the first bead.
const props = defineProps<{
  /** The canvas box: holds the strip and the Tool pill whose controls the notes point at. */
  scope: HTMLElement | undefined
  pillPosition: PillPosition
  /** The Tool pill's box, so the notes move when it does. */
  pillRect: PillRect | undefined
  /** The Canvas's background color, or undefined in high contrast. */
  background: string | undefined
}>()

const { t } = useI18n()
/** A phone keeps only the four steps, shorter, and the welcome (FirstRunHints card, Phone). */
const phone = useMediaQuery('(max-width: 30rem)')

const shownIds = computed<HintId[]>(() => (phone.value ? [...STEP_HINTS] : [...STEP_HINTS, ...QUIET_HINTS]))
const copy = computed<Record<HintId, string>>(() => ({ ...t.value.canvas.firstRun, ...(phone.value ? t.value.canvas.firstRun.phone : {}) }))
const isStep = (id: HintId) => (STEP_HINTS as readonly HintId[]).includes(id)

const layerEl = ref<HTMLElement>()
const welcomeEl = ref<HTMLElement>()
const noteEls = new Map<HintId, HTMLElement>()
const placed = ref<PlacedHint[]>([])
const placeOf = computed(() => new Map(placed.value.map((hint) => [hint.id, hint])))
/** On a Canvas background where `muted` reads under 4.5:1 the notes take `body` (CanvasBackground card). */
const lowContrast = ref(false)

function noteRef(id: HintId) {
  return (el: unknown) => {
    if (el instanceof HTMLElement) noteEls.set(id, el)
    else noteEls.delete(id)
  }
}

/** Measures the controls, the notes and what they may not cover on the drawing area, then places the notes. */
function measure() {
  const layer = layerEl.value
  const scope = props.scope
  if (!layer || !scope) return
  const origin = layer.getBoundingClientRect()
  const area: Size = { width: origin.width, height: origin.height }
  const boxOf = (el: Element | null): BarBox | undefined => {
    const rect = el?.getBoundingClientRect()
    if (!rect || !rect.width || !rect.height) return undefined
    return { left: rect.left - origin.left, top: rect.top - origin.top, width: rect.width, height: rect.height }
  }
  const targets: Partial<Record<HintId, BarBox>> = {}
  const notes: Partial<Record<HintId, Size>> = {}
  for (const id of shownIds.value) {
    const target = boxOf(scope.querySelector(`[data-hint="${id}"]`))
    // A control scrolled off the strip's end (Export on a phone) is pointed at where the strip ends.
    if (target) targets[id] = { ...target, left: Math.min(Math.max(target.left, 0), area.width - target.width) }
    const note = noteEls.get(id)
    if (note) notes[id] = { width: note.offsetWidth, height: note.offsetHeight }
  }
  const obstacles = [...scope.querySelectorAll('[data-hint-obstacle]'), welcomeEl.value ?? null].map(boxOf).filter((box) => !!box)
  placed.value = placeFirstRunHints({ area, targets, notes, pillPosition: props.pillPosition, obstacles })
  lowContrast.value = mutedIsFaint(layer)
}

function mutedIsFaint(layer: HTMLElement): boolean {
  const muted = fromHex(getComputedStyle(layer).getPropertyValue('--muted').trim())
  const background = props.background ? fromHex(props.background) : undefined
  return !!muted && !!background && contrastRatio(muted, background) < 4.5
}

const remeasure = () => void nextTick(measure)
let observer: ResizeObserver | undefined
onMounted(() => {
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(remeasure)
    if (layerEl.value) observer.observe(layerEl.value)
    if (props.scope) observer.observe(props.scope)
  }
  // The strip scrolls sideways on a phone, moving Export.
  props.scope?.addEventListener('scroll', remeasure, { capture: true, passive: true })
  void document.fonts?.ready.then(remeasure)
  remeasure()
})
onBeforeUnmount(() => {
  observer?.disconnect()
  props.scope?.removeEventListener('scroll', remeasure, { capture: true })
})
watch([() => props.pillPosition, () => props.pillRect, () => props.background, phone, t], remeasure, { deep: true })

function noteStyle(id: HintId) {
  const place = placeOf.value.get(id)
  return place ? { left: `${place.note.left}px`, top: `${place.note.top}px` } : { visibility: 'hidden' as const }
}
</script>

<template>
  <div
    ref="layerEl"
    class="first-run-hints"
    :class="{ 'first-run-hints--body': lowContrast }"
    aria-hidden="true"
    data-testid="first-run-hints"
  >
    <svg
      v-for="hint in placed"
      :key="`arrow-${hint.id}`"
      class="first-run-hints__arrow"
      :class="{ 'first-run-hints__arrow--step': isStep(hint.id) }"
      :data-testid="`first-run-arrow-${hint.id}`"
    >
      <path :d="hint.arrow" />
    </svg>
    <p
      v-for="id in shownIds"
      :key="id"
      :ref="noteRef(id)"
      class="first-run-hints__note"
      :class="{ 'first-run-hints__note--step': isStep(id) }"
      :style="noteStyle(id)"
      :data-testid="`first-run-hint-${id}`"
    >{{ copy[id] }}</p>
    <div ref="welcomeEl" class="first-run-hints__welcome" data-testid="first-run-welcome">
      <AppLogo class="first-run-hints__mark" :size="phone ? 40 : 60" />
      <span class="first-run-hints__wordmark">{{ t.app.title }}</span>
      <p class="first-run-hints__lines">
        {{ t.canvas.firstRun.welcome }}<br><b class="first-run-hints__steps">{{ t.canvas.firstRun.steps }}</b>
      </p>
    </div>
  </div>
</template>

<style scoped>
.first-run-hints {
  --hint-ink: var(--muted);
  position: absolute;
  inset: 0;
  z-index: var(--z-canvas-overlay);
  overflow: hidden;
  pointer-events: none;
  color: var(--hint-ink);
}

.first-run-hints--body {
  --hint-ink: var(--body);
}

/* They go with the first bead over the fast duration, at once under reduced motion (FirstRunHints card). */
@media (prefers-reduced-motion: no-preference) {
  .first-run-hints-leave-active {
    transition: opacity var(--duration-fast) var(--ease-out);
  }
}

.first-run-hints-leave-to {
  opacity: 0;
}

/* Sized by their own lines, not the room left of them, so a note measured at the corner keeps its size where placed. */
.first-run-hints__note {
  position: absolute;
  top: 0;
  left: 0;
  width: max-content;
  max-width: min(22rem, calc(100% - 2 * var(--space-8)));
  margin: 0;
  font: var(--hint-note);
  white-space: pre-line;
  overflow-wrap: anywhere;
}

.first-run-hints__note--step {
  font: var(--hint-step);
}

.first-run-hints__arrow {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  fill: none;
  stroke: currentColor;
  stroke-width: var(--hint-arrow);
  stroke-linecap: round;
  stroke-linejoin: round;
}

.first-run-hints__arrow--step {
  stroke-width: var(--hint-step-arrow);
}

/* Centred on the drawing area, under the CanvasHint line: the mark, the wordmark 14px under it, the two lines 18px under that. */
.first-run-hints__welcome {
  position: absolute;
  top: 50%;
  left: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: max-content;
  max-width: calc(100% - 2 * var(--space-16));
  text-align: center;
  transform: translate(-50%, -50%);
}

.first-run-hints__mark {
  color: var(--accent);
}

.first-run-hints__wordmark {
  margin-top: var(--space-14);
  font: var(--hint-wordmark);
  /* The card's -0.6px, twice the Brand's tracking at more than twice its size. */
  letter-spacing: calc(2 * var(--tracking-brand));
}

.first-run-hints__lines {
  margin: calc(var(--space-16) + var(--space-2)) 0 0;
  font: var(--hint-welcome);
}

.first-run-hints__steps {
  font-weight: 400;
  color: var(--accent-strong);
}

/* The width is controls.css's phone width. */
@media (max-width: 30rem) {
  .first-run-hints__note--step {
    font: var(--hint-step-phone);
  }

  .first-run-hints__wordmark {
    font: var(--hint-wordmark-phone);
  }

  .first-run-hints__lines {
    font: var(--hint-welcome-phone);
  }
}
</style>
