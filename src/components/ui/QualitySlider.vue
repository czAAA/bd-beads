<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import AppIcon from './AppIcon.vue'
import InfoButton from './InfoButton.vue'

// A discrete slider of a few named stops (QualitySlider card; ticket 576): a native range input, so touch drag, arrows,
// Home and End work, with a tappable button under each stop that mirrors it. `foldable` makes the head a fold row,
// closed every time it mounts (ticket 1121): the slider shows once it is opened.
const props = defineProps<{
  /** The accessible name and the head line. */
  label: string
  stops: readonly {
    id: string
    word: string
    /** Read after the word by a screen reader, e.g. its caption. */
    spoken?: string
    /** The caption under the word ("small file"); with `from` it reads "from → detail" (the stop was reduced for this Frame). */
    detail?: string
    from?: string
  }[]
  /** The info button beside the label: what each stop gives. */
  hint?: { label: string; body: string }
  /** The info button beside the head while any stop is reduced: its accessible name and Tooltip. */
  reduced?: { label: string; body: string }
  /** The id of the chosen stop. */
  modelValue: string
  /** An export is running: the slider keeps its place but takes no input. */
  disabled?: boolean
  /** The head folds the slider, closed every time it mounts and kept nowhere (ticket 1121). */
  foldable?: boolean
}>()

const emit = defineEmits<{ 'update:modelValue': [id: string] }>()

const index = computed(() => Math.max(0, props.stops.findIndex((stop) => stop.id === props.modelValue)))
const chosen = computed(() => props.stops[index.value])
const open = ref(!props.foldable)
const bodyId = useId()
const at = computed(() => (props.stops.length > 1 ? index.value / (props.stops.length - 1) : 0))

function pick(next: number): void {
  const stop = props.stops[next]
  if (stop && stop.id !== props.modelValue && !props.disabled) emit('update:modelValue', stop.id)
}
</script>

<template>
  <div class="qs" :class="{ 'qs--fold': foldable }" :style="{ '--qs-at': at, '--qs-n': stops.length }" data-testid="quality-slider">
    <!-- Folding (ticket 1121): the fold button lies under the head, so presses reach it but the Info buttons', as in a
         PanelSection with an Info button. -->
    <p class="qs-head" :class="{ 'qs-head--fold': foldable, 'qs-head--closed': !open }">
      <button
        v-if="foldable"
        class="ui-control qs-fold"
        type="button"
        :aria-label="chosen ? `${label}, ${chosen.word}` : label"
        :aria-expanded="open"
        :aria-controls="bodyId"
        data-testid="quality-fold"
        @click="open = !open"
      />
      <span class="qs-label">
        <span :aria-hidden="foldable || undefined">{{ label }}</span>
        <InfoButton v-if="hint" class="qs-press" :label="hint.label" :body="hint.body" data-testid="quality-hint" />
      </span>
      <InfoButton v-if="reduced && stops.some((stop) => stop.from)" class="qs-info qs-press" :label="reduced.label" :body="reduced.body" data-testid="quality-reduced-info" />
      <span class="qs-chosen" :aria-hidden="foldable || undefined" data-testid="quality-chosen">{{ chosen?.word }}</span>
      <AppIcon v-if="foldable" :name="open ? 'chevron-down' : 'chevron-left'" :size="14" class="qs-chevron" :class="{ 'qs-chevron--closed': !open }" aria-hidden="true" />
    </p>
    <div v-if="open" :id="bodyId" class="qs-body">
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
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
  /* Type in rem, never px, so the browser's text size reaches it (ticket 0941): calc(12rem / 18) is 12px at the default
     size, where the root is 18px. --qs-small is the slider's 12/16 small print. */
  .qs { --qs-small: 400 calc(12rem / 18) / calc(16rem / 18) var(--font-sans); display: flex; flex-direction: column; gap: var(--space-4); padding: var(--space-8) 0 0; font: var(--qs-small); color: var(--body); }
  .qs-head { display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-8); margin: 0; font: var(--type-control); color: var(--ink); }
  .qs-chosen { font: var(--qs-small); color: var(--muted); }
  /* The folding head (ticket 1121): a panel row, its fold button under it; closed, its name and chevron in accent-2,
     as every folded part of a panel is. */
  .qs--fold { padding: 0; }
  .qs-head--fold { position: relative; align-items: center; min-height: var(--panel-item-height); }
  .qs-head--fold > :not(.qs-fold) { position: relative; pointer-events: none; }
  .qs-head--fold .qs-press { pointer-events: auto; }
  .qs-fold { position: absolute; inset: 0 calc(-1 * var(--space-10)); padding: 0; background: none; border: 0; border-radius: var(--radius-sm); cursor: pointer; }
  .qs-fold:focus-visible { outline: var(--focus-width) solid var(--focus-ring); outline-offset: var(--focus-offset); }
  .qs-chevron { flex: none; color: var(--muted); }
  .qs-chevron--closed { transform: rotate(180deg); }
  .qs-head--closed .qs-label, .qs-head--closed .qs-chevron { color: var(--accent-2); }
  .qs-body { display: contents; }
  @media (hover: hover) { .qs-fold:hover { background: var(--hover-fill); } }
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
  .qs-stop b { font: 500 calc(13rem / 18) / 1rem var(--font-sans); color: var(--body); }
  .qs-stop[aria-checked="true"] b { color: var(--ink); }
  .qs-stop:disabled { cursor: default; background: none; }
  .qs-stop small { font: var(--qs-small); color: var(--muted); }
  .qs-stop .qs-was { color: var(--accent-strong); }
  .qs-label { display: inline-flex; align-items: center; gap: var(--space-4); margin-right: auto; }
  .qs-info { margin-right: 0; }
  .qs-stop:disabled small, .qs-stop:disabled b { color: var(--faint); }
  [data-theme="contrast"] .qs-range::-webkit-slider-runnable-track { box-shadow: inset 0 0 0 1px var(--panel-line); }
</style>
