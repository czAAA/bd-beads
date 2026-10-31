<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AppLogo from '../ui/AppLogo.vue'
import { useI18n } from '../../i18n/useI18n'
import { useMediaQuery } from '../../composables/ui/useMediaQuery'
import { contrastRatio, fromHex } from '../../domain/color'
import { clamp } from '../../domain/clamp'
import type { PillPosition, PillRect } from '../../domain/toolPill'
import type { BarBox } from '../../composables/tools/selectionBarPlacement'
import {
  KEPT_HINTS,
  QUIET_HINTS,
  captionColumns,
  isStepHint,
  placeFirstRunHints,
  type HintId,
  type PlacedHint,
  type Size,
} from '../../composables/canvas/firstRunHintPlacement'

// The quiet captions over an empty Project (FirstRunHints card, ticket 0738): one beside each control it names
// (`data-hint` on it), no arrows, and a welcome that says where Projects are kept and how to keep a file of one.
// Decoration only: hidden from screen readers and pointers, so the first press on the canvas paints the first bead.
const props = defineProps<{
  /** The canvas box: holds the strip and the Tool pill whose controls the captions sit beside. */
  scope: HTMLElement | undefined
  pillPosition: PillPosition
  /** The Tool pill's box, so the captions move when it does. */
  pillRect: PillRect | undefined
  /** The Canvas's background color, or undefined in high contrast. */
  background: string | undefined
}>()

const { t } = useI18n()
/** A phone keeps only the welcome and the rings (FirstRunHints card, Phone). */
const phone = useMediaQuery('(max-width: 30rem)')

const shownIds = computed<HintId[]>(() => (phone.value ? [] : [...KEPT_HINTS, ...QUIET_HINTS]))
/** The welcome's last line: where in the Project panel a Project file is made. */
const path = computed(() => [t.value.header.projectPanelLabel, t.value.panels.project.exportHeading, t.value.panels.project.exportFile])

const layerEl = ref<HTMLElement>()
const welcomeEl = ref<HTMLElement>()
const noteEls = new Map<HintId, HTMLElement>()
const placed = ref<PlacedHint[]>([])
const placeOf = computed(() => new Map(placed.value.map((hint) => [hint.id, hint])))
/** The width each strip caption wraps in, under its own button. */
const columns = ref<Partial<Record<HintId, number>>>({})
/** On a Canvas background where `muted` reads under 4.5:1 the captions take `body` (CanvasBackground card). */
const lowContrast = ref(false)
const READABLE_CONTRAST = 4.5
const STRIP_IDS: readonly HintId[] = ['menu', 'project', 'frame', 'export']

function noteRef(id: HintId) {
  return (el: unknown) => {
    if (el instanceof HTMLElement) noteEls.set(id, el)
    else noteEls.delete(id)
  }
}

/** Measures the controls, gives the strip captions their columns, then measures the captions and what they may not
 * cover on the drawing area and places them. A strip caption given no column is left out. */
async function measure() {
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
  for (const id of shownIds.value) {
    const target = boxOf(scope.querySelector(`[data-hint="${id}"]`))
    // A control scrolled off the strip's end is placed where the strip ends.
    if (target) targets[id] = { ...target, left: clamp(target.left, 0, area.width - target.width) }
  }
  columns.value = captionColumns(targets)
  await nextTick()
  const notes: Partial<Record<HintId, Size>> = {}
  for (const id of shownIds.value) {
    const note = noteEls.get(id)
    if (note && (!STRIP_IDS.includes(id) || columns.value[id])) notes[id] = { width: note.offsetWidth, height: note.offsetHeight }
  }
  const obstacles = [...scope.querySelectorAll('[data-hint-obstacle]'), welcomeEl.value ?? null].map(boxOf).filter((box) => !!box)
  placed.value = placeFirstRunHints({ area, targets, notes, pillPosition: props.pillPosition, obstacles })
  lowContrast.value = mutedIsFaint(layer)
}

function mutedIsFaint(layer: HTMLElement): boolean {
  const muted = fromHex(getComputedStyle(layer).getPropertyValue('--muted').trim())
  const background = props.background ? fromHex(props.background) : undefined
  return !!muted && !!background && contrastRatio(muted, background) < READABLE_CONTRAST
}

const remeasure = () => void nextTick(measure)
let observer: ResizeObserver | undefined
onMounted(() => {
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(remeasure)
    if (layerEl.value) observer.observe(layerEl.value)
    if (props.scope) observer.observe(props.scope)
  }
  // The strip scrolls sideways when it runs out of room, moving Export.
  props.scope?.addEventListener('scroll', remeasure, { capture: true, passive: true })
  void document.fonts?.ready.then(remeasure)
  remeasure()
})
onBeforeUnmount(() => {
  observer?.disconnect()
  props.scope?.removeEventListener('scroll', remeasure, { capture: true })
})
watch([() => props.pillPosition, () => props.pillRect, () => props.background, phone, t], remeasure)

function noteStyle(id: HintId) {
  const column = columns.value[id]
  const width = column ? { maxWidth: `${column}px` } : {}
  const place = placeOf.value.get(id)
  return place ? { left: `${place.note.left}px`, top: `${place.note.top}px`, ...width } : { visibility: 'hidden' as const, ...width }
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
    <p
      v-for="id in shownIds"
      :key="id"
      :ref="noteRef(id)"
      class="first-run-hints__note"
      :class="{ 'first-run-hints__note--step': isStepHint(id), 'first-run-hints__note--end': id === 'export' }"
      :style="noteStyle(id)"
      :data-testid="`first-run-hint-${id}`"
    >{{ t.canvas.firstRun[id] }}</p>
    <div ref="welcomeEl" class="first-run-hints__welcome" data-testid="first-run-welcome">
      <AppLogo class="first-run-hints__mark" :size="phone ? 36 : 44" />
      <span class="first-run-hints__wordmark">{{ t.app.title }}</span>
      <p class="first-run-hints__steps">{{ t.canvas.firstRun.steps }}</p>
      <p class="first-run-hints__storage" data-testid="first-run-storage">{{ t.canvas.firstRun.storage }}</p>
      <p class="first-run-hints__path" data-testid="first-run-path">
        <template v-for="(step, index) in path" :key="step">
          <span v-if="index">›</span>
          <span class="hint-chip first-run-hints__chip">{{ step }}</span>
        </template>
      </p>
    </div>
  </div>
</template>

<style scoped>
.first-run-hints {
  --hint-ink: var(--muted);
  --hint-step-ink: var(--body);
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

/* Sized by their own lines, not the room left of them, so a caption measured at the corner keeps its size where placed;
 * a strip caption's column comes inline. */
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

/* Select's and Export's captions, on the ringed controls they name: larger, in `body`. */
.first-run-hints__note--step {
  font: var(--hint-step);
  color: var(--hint-step-ink);
}

.first-run-hints__note--end {
  text-align: right;
}

/* Centred on the drawing area, under the CanvasHint line: the mark, the wordmark 12px under it, then the steps line,
 * the storage line and the Project file's path. */
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
  margin-top: var(--space-12);
  font: var(--hint-wordmark);
  /* The card's -0.6px, twice the Brand's tracking at more than twice its size. */
  letter-spacing: calc(2 * var(--tracking-brand));
}

.first-run-hints__steps {
  margin: var(--space-16) 0 0;
  font: var(--hint-welcome);
  color: var(--accent-strong);
}

.first-run-hints__storage {
  max-width: 36rem;
  margin: var(--space-24) 0 0;
  font: var(--hint-storage);
  white-space: pre-line;
}

.first-run-hints__path {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: var(--space-6);
  margin: var(--space-10) 0 0;
  font: var(--hint-storage);
}

/* The CanvasHint's chip (controls.css), holding a label instead of a key. */
.first-run-hints__chip {
  font: var(--type-meta-small);
}

/* The width is controls.css's phone width. */
@media (max-width: 30rem) {
  .first-run-hints__wordmark {
    font: var(--hint-wordmark-phone);
  }

  .first-run-hints__steps {
    font: var(--hint-welcome-phone);
  }

  .first-run-hints__storage {
    margin-top: var(--space-20);
  }
}
</style>
