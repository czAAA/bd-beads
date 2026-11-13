<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useElementSize } from '../../../composables/ui/useElementSize'
import { clamp } from '../../../domain/clamp'
import { shownMarkLabels } from '../../../domain/sliderMarkLabels'
import AppTooltip from '../AppTooltip.vue'
import InfoButton from '../InfoButton.vue'

// A slider that picks one whole number over a range and writes the value above it (ValueSlider card, ticket 0747):
// QualitySlider's track and thumb on a native range, so touch drag, arrows, Home and End work, moving through every
// whole number rather than between stops, with optional marks a drag released near lands on.
const props = defineProps<{
  /** The accessible name and the head line. */
  label: string
  modelValue: number
  min: number
  max: number
  /** The head's value, in the chosen unit ("32 beads"), and the other unit after it ("51 mm"). */
  value: string
  secondary?: string
  /** What a screen reader hears for the value: both units, and on a mark what the mark means. */
  valuetext: string
  /** The ends under the track: the min as a reading, the max written as a limit ("max 256"). */
  minLabel: string
  maxLabel: string
  /** Marks across the track, each at a value, with a label under it where there is room. */
  marks?: readonly { value: number; label?: string }[]
  /** One line under the ends. */
  hint?: string
  /** The info button beside the label (ticket 0817): its accessible name ("What Tolerance does") and Tooltip, for help
   * read once rather than a line kept under the slider. */
  info?: { label: string; body: string }
  /** The doubling scale (ValueSlider card, ticket 0895): the thumb at log(value ÷ min) ÷ log(max ÷ min), so marks that
   * each double the last stand evenly. The value, the keys and the value as heard are unchanged. */
  doubling?: boolean
  /** Off, with why (ticket 0896): kept in place in `faint`, `aria-disabled`, still focusable, its reason in a Tooltip. */
  offBody?: string
  testid?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [value: number] }>()

const trackEl = ref<HTMLElement>()
const { width: trackWidth } = useElementSize(trackEl)
const span = computed(() => Math.max(1, props.max - props.min))
/** Whether the doubling scale applies: it needs a range above 0 that has some length. */
const logScale = computed(() => props.doubling === true && props.min > 0 && props.max > props.min)
/** Where a value stands along the track, from 0 to 1. */
function fraction(value: number): number {
  if (!logScale.value) return clamp((value - props.min) / span.value, 0, 1)
  return clamp(Math.log(Math.max(value, props.min) / props.min) / Math.log(props.max / props.min), 0, 1)
}
const at = computed(() => fraction(props.modelValue))
/** On the doubling scale the native range runs in these steps of the track, and each step is read back as a value. */
const TRACK_STEPS = 1000
const rangeValue = computed(() => (logScale.value ? Math.round(at.value * TRACK_STEPS) : props.modelValue))
const valueAt = (position: number) => (logScale.value ? props.min * (props.max / props.min) ** (position / TRACK_STEPS) : position)

function set(next: number) {
  if (props.offBody !== undefined) return
  const kept = Math.round(clamp(next, props.min, props.max))
  if (kept !== props.modelValue) emit('update:modelValue', kept)
}

function onInput(event: Event) {
  const input = event.target as HTMLInputElement
  set(valueAt(Number(input.value)))
  // Off, or between two values on the doubling scale: the thumb goes back to where the value stands.
  input.value = String(rangeValue.value)
}

/** The design's values where no style is loaded (a test): the thumb's width, the snap distance and the least room
 * between two labels (ValueSlider card). */
const THUMB_PX = 20
const SNAP_PX = 6
const LABEL_GAP_PX = 12

/** A pixel length read from the slider's own custom property, so the thumb and snap distance stay the design's. */
function pxValue(name: string, fallback: number): number {
  const track = trackEl.value
  if (!track) return fallback
  const read = Number.parseFloat(getComputedStyle(track).getPropertyValue(name))
  return Number.isFinite(read) ? read : fallback
}

/** Page Up and Page Down move a tenth of the range, at least 1 (ValueSlider card); the browser's own page step is
 * left alone for nothing else. */
function onKeydown(event: KeyboardEvent) {
  const page = Math.max(1, Math.round(span.value / 10))
  // Off, or on the doubling scale, the range's own steps are not the value's: every key is the slider's.
  const own = logScale.value || props.offBody !== undefined
  if (event.key === 'PageUp') set(props.modelValue + page)
  else if (event.key === 'PageDown') set(props.modelValue - page)
  else if (own && (event.key === 'ArrowRight' || event.key === 'ArrowUp')) set(props.modelValue + 1)
  else if (own && (event.key === 'ArrowLeft' || event.key === 'ArrowDown')) set(props.modelValue - 1)
  else if (own && event.key === 'Home') set(props.min)
  else if (own && event.key === 'End') set(props.max)
  else return
  event.preventDefault()
}

/** A pointer drag released within the snap distance of a mark lands on it; keys never snap. */
function onPointerUp() {
  const travel = trackWidth.value - pxValue('--slider-thumb', THUMB_PX)
  if (!props.marks?.length || travel <= 0) return
  const snap = pxValue('--slider-mark-snap', SNAP_PX)
  const away = (value: number) => Math.abs(fraction(value) - at.value) * travel
  const nearest = props.marks.reduce((best, mark) => (away(mark.value) < away(best.value) ? mark : best))
  if (away(nearest.value) <= snap) set(nearest.value)
}

const endsEl = ref<HTMLElement>()
/** The marks whose labels are left out: measured where they stand, so a label never touches an end's label or another. */
const leftOut = ref<ReadonlySet<number>>(new Set())

/** Reads where the ends' and the marks' labels stand and leaves out each label that would touch one kept before it
 * (ValueSlider card, ticket 0862). Left-out labels stay laid out, hidden, so they can be measured again. */
function placeLabels() {
  const ends = endsEl.value
  const box = ends?.getBoundingClientRect()
  if (!ends || !box?.width) return
  const spanOf = (element: Element) => {
    const rect = element.getBoundingClientRect()
    return { from: rect.left - box.left, to: rect.right - box.left }
  }
  const labels = [...ends.querySelectorAll<HTMLElement>('.vs-mark-label')]
  const shown = shownMarkLabels(labels.map(spanOf), [...ends.querySelectorAll('.vs-min, .vs-max')].map(spanOf), pxValue('--slider-label-gap', LABEL_GAP_PX))
  const next = new Set(labels.filter((_, index) => !shown[index]).map((label) => Number(label.dataset.value)))
  if ([...next].join() !== [...leftOut.value].join()) leftOut.value = next
}
watch([trackWidth, () => props.marks, () => props.minLabel, () => props.maxLabel], placeLabels, { flush: 'post' })
onMounted(() => void document.fonts?.ready.then(placeLabels))

const markStyle = (value: number) => ({ left: `calc(var(--slider-thumb) / 2 + (100% - var(--slider-thumb)) * ${fraction(value)})` })
</script>

<template>
  <div class="vs" :class="{ 'vs--off': offBody !== undefined }" :style="{ '--vs-at': at }" :data-testid="testid">
    <div class="vs-head">
      <p class="vs-head-line">
        <span class="vs-label">
          {{ label }}
          <InfoButton v-if="info" :label="info.label" :body="info.body" :data-testid="testid && `${testid}-info`" />
        </span>
        <span class="vs-value" :data-testid="testid && `${testid}-value`">
          <b>{{ value }}</b><template v-if="secondary"> · <span class="vs-secondary">{{ secondary }}</span></template>
        </span>
      </p>
      <!-- A button at the head's right that opens the slider's more (the converter's "More for the size", ticket 0896). -->
      <slot name="action" />
    </div>
    <AppTooltip v-if="offBody !== undefined" :name="label" disabled :disabled-body="offBody" :announce="false" class="vs-off-tip">
      <div class="vs-track">
        <input
          class="vs-range"
          type="range"
          :min="logScale ? 0 : min"
          :max="logScale ? TRACK_STEPS : max"
          step="1"
          :value="rangeValue"
          :aria-label="label"
          :aria-valuetext="valuetext"
          aria-disabled="true"
          :data-testid="testid && `${testid}-range`"
          @input="onInput"
          @keydown="onKeydown"
        />
      </div>
    </AppTooltip>
    <div v-else ref="trackEl" class="vs-track">
      <input
        class="vs-range"
        type="range"
        :min="logScale ? 0 : min"
        :max="logScale ? TRACK_STEPS : max"
        step="1"
        :value="rangeValue"
        :aria-label="label"
        :aria-valuetext="valuetext"
        :aria-valuemin="logScale ? min : undefined"
        :aria-valuemax="logScale ? max : undefined"
        :aria-valuenow="logScale ? modelValue : undefined"
        :data-testid="testid && `${testid}-range`"
        @input="onInput"
        @keydown="onKeydown"
        @pointerup="onPointerUp"
      />
      <span v-for="mark in marks" :key="mark.value" class="vs-mark" :style="markStyle(mark.value)" :data-testid="testid && `${testid}-mark`" :data-value="mark.value" aria-hidden="true" />
    </div>
    <div ref="endsEl" class="vs-ends" aria-hidden="true">
      <span class="vs-min">{{ minLabel }}</span>
      <template v-for="mark in marks" :key="mark.value">
        <span v-if="mark.label" class="vs-mark-label" :class="{ 'vs-mark-label--out': leftOut.has(mark.value) }" :style="markStyle(mark.value)" :data-value="mark.value">{{ mark.label }}</span>
      </template>
      <span class="vs-max">{{ maxLabel }}</span>
    </div>
    <p v-if="hint" class="vs-hint">{{ hint }}</p>
  </div>
</template>

<style scoped>
  .vs { display: flex; flex-direction: column; gap: var(--space-4); color: var(--body); }
  .vs-head { display: flex; align-items: center; gap: var(--space-8); }
  .vs-head-line { display: flex; flex: 1 1 auto; align-items: baseline; justify-content: space-between; gap: var(--space-8); min-width: 0; margin: 0; }
  .vs-off-tip { display: block; }
  /* Off (ticket 0896): the name and value in faint, the filled part line-strong, the thumb faint. */
  .vs--off .vs-label, .vs--off .vs-value, .vs--off .vs-ends, .vs--off .vs-max { color: var(--faint); }
  .vs--off .vs-range { cursor: default; --vs-line: 0%; }
  .vs--off .vs-range::-webkit-slider-runnable-track { background: var(--line-strong); }
  .vs--off .vs-range::-moz-range-track, .vs--off .vs-range::-moz-range-progress { background: var(--line-strong); }
  .vs--off .vs-range::-webkit-slider-thumb, .vs--off .vs-range:hover::-webkit-slider-thumb, .vs--off .vs-range:active::-webkit-slider-thumb { background: var(--faint); transform: none; }
  .vs--off .vs-range::-moz-range-thumb, .vs--off .vs-range:hover::-moz-range-thumb { background: var(--faint); }
  .vs-label { display: inline-flex; align-items: center; gap: var(--space-4); font: var(--type-control); font-weight: 500; color: var(--ink); }
  .vs-value { font: var(--type-meta); color: var(--ink); white-space: nowrap; font-variant-numeric: tabular-nums; }
  .vs-value b { font-weight: 500; }
  .vs-secondary { color: var(--muted); }
  .vs-track { position: relative; }
  .vs-range { -webkit-appearance: none; appearance: none; display: block; box-sizing: border-box; width: 100%; height: var(--touch-target); margin: 0; background: transparent; cursor: pointer; --vs-line: calc(var(--slider-thumb) / 2 + (100% - var(--slider-thumb)) * var(--vs-at)); }
  .vs-range::-webkit-slider-runnable-track { height: var(--slider-track); border-radius: var(--radius-full); background: linear-gradient(var(--accent), var(--accent)) 0 / var(--vs-line) 100% no-repeat, var(--track); }
  .vs-range::-moz-range-track { height: var(--slider-track); border-radius: var(--radius-full); background: var(--track); }
  .vs-range::-moz-range-progress { height: var(--slider-track); border-radius: var(--radius-full); background: var(--accent); }
  .vs-range::-webkit-slider-thumb { -webkit-appearance: none; position: relative; z-index: 1; box-sizing: border-box; width: var(--slider-thumb); height: var(--slider-thumb); margin-top: calc((var(--slider-track) - var(--slider-thumb)) / 2); border-radius: var(--radius-full); background: var(--ink); border: 2px solid var(--canvas); transition: transform var(--duration-fast, 120ms) var(--ease-standard, ease); }
  .vs-range::-moz-range-thumb { box-sizing: border-box; width: var(--slider-thumb); height: var(--slider-thumb); border-radius: var(--radius-full); background: var(--ink); border: 2px solid var(--canvas); }
  .vs-range:hover::-webkit-slider-thumb { background: var(--accent-strong); }
  .vs-range:hover::-moz-range-thumb { background: var(--accent-strong); }
  .vs-range:active::-webkit-slider-thumb { background: var(--accent-strong); transform: scale(var(--slider-thumb-scale)); }
  .vs-range:active::-moz-range-thumb { background: var(--accent-strong); transform: scale(var(--slider-thumb-scale)); }
  .vs-range:focus-visible { outline: none; }
  .vs-range:focus-visible::-webkit-slider-thumb { outline: var(--focus-width) solid var(--focus-ring); outline-offset: 2px; }
  .vs-range:focus-visible::-moz-range-thumb { outline: var(--focus-width) solid var(--focus-ring); outline-offset: 2px; }
  /* A mark stands across the track, taller than it, under the thumb; the pointer goes through it to the range. */
  .vs-mark { position: absolute; top: 50%; width: var(--slider-mark-width); height: var(--slider-mark-height); background: var(--line-strong); border-radius: 1px; transform: translate(-50%, -50%); pointer-events: none; }
  .vs-ends { position: relative; display: flex; justify-content: space-between; min-height: var(--space-16); margin-top: calc(-1 * var(--space-8)); font: var(--type-meta-small); color: var(--muted); white-space: nowrap; }
  .vs-max { color: var(--ink); }
  .vs-mark-label { position: absolute; top: 0; transform: translateX(-50%); }
  .vs-mark-label--out { visibility: hidden; }
  .vs-hint { margin: 0; font: var(--type-small); color: var(--muted); }
  [data-theme="contrast"] .vs-range::-webkit-slider-runnable-track { box-shadow: inset 0 0 0 1px var(--panel-line); }
</style>
