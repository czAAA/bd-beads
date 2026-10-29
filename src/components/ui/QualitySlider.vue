<script setup lang="ts">
import { computed } from 'vue'
import InfoButton from './InfoButton.vue'

// A discrete slider of a few named stops (QualitySlider card; ticket 576): a native range input, so touch drag, arrows,
// Home and End work, with a tappable button under each stop that mirrors it.
const props = defineProps<{
  /** The accessible name and the head line. */
  label: string
  stops: readonly {
    id: string
    word: string
    /** Read after the word by a screen reader, e.g. the bead size and the estimates. */
    spoken?: string
    /** The size under the word; with `from` it reads "from → detail" (the stop was reduced for this Frame). */
    detail?: string
    from?: string
    /** The estimates under the size, one per format. */
    lines?: readonly string[]
  }[]
  /** The info button beside the label: what the lowest stop is for ("Low saves memory"). */
  hint?: { label: string; body: string }
  /** The info button beside the head while any stop is reduced: its accessible name and Tooltip. */
  reduced?: { label: string; body: string }
  /** The id of the chosen stop. */
  modelValue: string
  /** An export is running: the slider keeps its place but takes no input. */
  disabled?: boolean
}>()

const emit = defineEmits<{ 'update:modelValue': [id: string] }>()

const index = computed(() => Math.max(0, props.stops.findIndex((stop) => stop.id === props.modelValue)))
const chosen = computed(() => props.stops[index.value])
const at = computed(() => (props.stops.length > 1 ? index.value / (props.stops.length - 1) : 0))

function pick(next: number): void {
  const stop = props.stops[next]
  if (stop && stop.id !== props.modelValue && !props.disabled) emit('update:modelValue', stop.id)
}
</script>

<template>
  <div class="qs" :style="{ '--qs-at': at, '--qs-n': stops.length }" data-testid="quality-slider">
    <p class="qs-head">
      <span class="qs-label">
        {{ label }}
        <InfoButton v-if="hint" :label="hint.label" :body="hint.body" data-testid="quality-hint" />
      </span>
      <InfoButton v-if="reduced && stops.some((stop) => stop.from)" class="qs-info" :label="reduced.label" :body="reduced.body" data-testid="quality-reduced-info" />
      <span data-testid="quality-chosen">{{ chosen?.word }}</span>
    </p>
    <input
      class="qs-range"
      type="range"
      min="0"
      :max="stops.length - 1"
      step="1"
      :value="index"
      :disabled="disabled"
      :aria-label="label"
      :aria-valuetext="chosen?.spoken ?? chosen?.word"
      data-testid="quality-range"
      @input="pick(Number(($event.target as HTMLInputElement).value))"
    />
    <div class="qs-stops" role="radiogroup" :aria-label="label">
      <button
        v-for="(stop, position) in stops"
        :key="stop.id"
        type="button"
        class="qs-stop"
        role="radio"
        tabindex="-1"
        :aria-checked="stop.id === modelValue"
        :disabled="disabled"
        :data-testid="`quality-stop-${stop.id}`"
        @click="pick(position)"
      >
        <b>{{ stop.word }}</b>
        <small v-if="stop.detail" :data-testid="`quality-detail-${stop.id}`">
          <template v-if="stop.from">{{ stop.from }} → <span class="qs-was">{{ stop.detail }}</span></template>
          <template v-else>{{ stop.detail }}</template>
        </small>
        <small v-for="line in stop.lines" :key="line">{{ line }}</small>
      </button>
    </div>
  </div>
</template>

<style scoped>
  .qs { display: flex; flex-direction: column; gap: var(--space-4); padding: var(--space-8) 0 0; font: 400 12px/16px var(--font-sans); color: var(--body); }
  .qs-head { display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-8); margin: 0; font: 500 13px/18px var(--font-sans); color: var(--ink); }
  .qs-head span { font: 400 12px/16px var(--font-sans); color: var(--muted); }
  .qs-range { -webkit-appearance: none; appearance: none; display: block; box-sizing: border-box; height: var(--touch-target); margin: 0 calc(100% / (2 * var(--qs-n)) - var(--slider-thumb) / 2); width: calc(100% - 100% / var(--qs-n) + var(--slider-thumb)); background: transparent; cursor: pointer; --qs-line: calc(var(--slider-thumb) / 2 + (100% - var(--slider-thumb)) * var(--qs-at)); }
  .qs-range::-webkit-slider-runnable-track { height: var(--slider-track); border-radius: var(--radius-full); background: linear-gradient(var(--accent), var(--accent)) 0 / var(--qs-line) 100% no-repeat, var(--track); }
  .qs-range::-moz-range-track { height: var(--slider-track); border-radius: var(--radius-full); background: var(--track); }
  .qs-range::-moz-range-progress { height: var(--slider-track); border-radius: var(--radius-full); background: var(--accent); }
  .qs-range::-webkit-slider-thumb { -webkit-appearance: none; box-sizing: border-box; width: var(--slider-thumb); height: var(--slider-thumb); margin-top: calc((var(--slider-track) - var(--slider-thumb)) / 2); border-radius: var(--radius-full); background: var(--ink); border: 2px solid var(--canvas); transition: transform var(--duration-fast, 120ms) var(--ease-standard, ease); }
  .qs-range::-moz-range-thumb { box-sizing: border-box; width: var(--slider-thumb); height: var(--slider-thumb); border-radius: var(--radius-full); background: var(--ink); border: 2px solid var(--canvas); }
  .qs-range:hover::-webkit-slider-thumb { background: var(--accent-strong); }
  .qs-range:hover::-moz-range-thumb { background: var(--accent-strong); }
  .qs-range:active::-webkit-slider-thumb { background: var(--accent-strong); transform: scale(var(--slider-thumb-scale)); }
  .qs-range:active::-moz-range-thumb { background: var(--accent-strong); transform: scale(var(--slider-thumb-scale)); }
  .qs-range:focus-visible { outline: none; }
  .qs-range:focus-visible::-webkit-slider-thumb { outline: var(--focus-width) solid var(--focus-ring); outline-offset: 2px; }
  .qs-range:focus-visible::-moz-range-thumb { outline: var(--focus-width) solid var(--focus-ring); outline-offset: 2px; }
  .qs-range:disabled { cursor: default; }
  .qs-range:disabled::-webkit-slider-runnable-track { background: linear-gradient(var(--accent-disabled-bg), var(--accent-disabled-bg)) 0 / var(--qs-line) 100% no-repeat, var(--track); }
  .qs-range:disabled::-webkit-slider-thumb { background: var(--faint); }
  .qs-range:disabled::-moz-range-progress { background: var(--accent-disabled-bg); }
  .qs-range:disabled::-moz-range-thumb { background: var(--faint); }
  .qs-stops { display: grid; grid-template-columns: repeat(var(--qs-n), minmax(0, 1fr)); margin-top: calc(-1 * var(--space-8)); }
  .qs-stop { box-sizing: border-box; min-height: var(--touch-target); padding: var(--space-4) var(--space-2); border: 0; border-radius: var(--radius-sm); background: none; color: var(--muted); font: inherit; text-align: center; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 0; overflow-wrap: break-word; hyphens: manual; }
  .qs-stop:hover { background: var(--hover-fill); }
  .qs-stop:focus-visible { outline: var(--focus-width) solid var(--focus-ring); outline-offset: var(--focus-offset); }
  .qs-stop b { font: 500 13px/18px var(--font-sans); color: var(--body); }
  .qs-stop[aria-checked="true"] b { color: var(--ink); }
  .qs-stop:disabled { cursor: default; background: none; }
  .qs-stop small { font: 400 12px/16px var(--font-mono); color: var(--muted); white-space: nowrap; }
  .qs-stop .qs-was { color: var(--accent-strong); }
  .qs-label { display: inline-flex; align-items: center; gap: var(--space-4); margin-right: auto; }
  .qs-info { margin-right: 0; }
  .qs-stop:disabled small, .qs-stop:disabled b { color: var(--faint); }
  [data-theme="contrast"] .qs-range::-webkit-slider-runnable-track { box-shadow: inset 0 0 0 1px var(--panel-line); }
</style>
