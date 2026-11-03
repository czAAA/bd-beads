<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AppButton from '../ui/AppButton.vue'
import ProgressBar from './ProgressBar.vue'
import ProgressTrack from './ProgressTrack.vue'

// The Progress bar of a page that goes by steps (tickets 0739, 0744, 0756, 0780; ProgressBar card): a counter, the track
// with a named dot per step, Back where Row not done sits and Next where Row done sits. The Homepage's sections and Convert
// image's steps both fill it, knowing only the list given. A page ending in an act gives `finish`: Next on the last reads so.
const props = defineProps<{
  /** The step shown, from 0. */
  step: number
  /** Where the page's scroll is, in steps (1.4 is four tenths from the second to the third): the fill and the spark
   * follow it between the dots (ticket 0780). The step itself when not given. */
  position?: number
  /** The way Back and Next point: down for a page whose steps turn vertically (the Homepage), across for one whose
   * steps run along the bar (Convert image). */
  arrows?: 'down' | 'across'
  /** In order; each one's `label` names its dot. A `disabled` one cannot be jumped to yet. */
  steps: readonly { id: string; label: string; disabled?: boolean; testid?: string }[]
  /** The track's accessible name. */
  trackLabel: string
  /** A dot's accessible name, from its label. */
  goTo: (label: string) => string
  backLabel: string
  nextLabel: string
  /** Why Back is off on the first step, and Next on the last when the page has no `finish`. */
  firstBody: string
  lastBody?: string
  /** What Next on the last step does, when the page ends in an act (Create Project). */
  finish?: { label: string; disabled?: boolean; disabledBody?: string; testid: string }
  /** Why Next is off while the next step is not open yet. */
  nextDisabledBody?: string
  /** Prefix of the test ids: `<testid>-bar`, `-counter`, `-track`, `-step`, `-back`, `-next`. */
  testid: string
}>()
const emit = defineEmits<{ go: [step: number]; finish: [] }>()

const icons = computed(() => (props.arrows === 'across' ? { back: 'arrow-left', next: 'arrow-right' } as const : { back: 'arrow-up', next: 'arrow-down' } as const))

const last = computed(() => props.steps.length - 1)
/** Where a step's dot sits on the track, 0 to 1; the fill reaches the shown one's, so it starts empty. */
const at = (index: number) => (last.value > 0 ? index / last.value : 1)
const current = computed(() => props.steps[props.step]?.label ?? '')
/** How near a dot, in steps, the scroll counts as on it. */
const ON_DOT = 0.04
/** The scroll's place between the dots, held to the track: the fill's share. */
const shown = computed(() => Math.min(last.value, Math.max(0, props.position ?? props.step)))
const share = computed(() => at(shown.value))
/** The spark's dot shows only between two dots; on one, the current ring is its place (ProgressBar card). */
const onDot = computed(() => Math.abs(shown.value - Math.round(shown.value)) < ON_DOT)
const nextStep = computed(() => props.steps[props.step + 1])
const finishing = computed(() => !!props.finish && props.step === last.value)

const flares = ref(0)
/** The current ring's flare, swapped on each step forward so the next one restarts it, as the spark's is. */
const ringFlare = ref<'' | 'is-flaring' | 'is-flaring-alt'>('')

watch(
  () => props.step,
  (now, before) => {
    if (now <= before) return
    flares.value += 1
    ringFlare.value = ringFlare.value === 'is-flaring' ? 'is-flaring-alt' : 'is-flaring'
  },
)

function stepClass(index: number) {
  return {
    'step-dot--first': index === 0,
    'step-dot--last': index > 0 && index === last.value,
    'step-dot--passed': index < props.step,
    'step-dot--current': index === props.step,
    'step-dot--disabled': props.steps[index]?.disabled,
    'is-lit': index === props.step && props.step > 0,
    [ringFlare.value]: index === props.step && ringFlare.value !== '',
  }
}

function go(index: number) {
  if (!props.steps[index]?.disabled) emit('go', index)
}
</script>

<template>
  <ProgressBar class="step-bar" :data-testid="`${testid}-bar`">
    <p class="step-bar__counter" :data-testid="`${testid}-counter`">{{ step + 1 }}/{{ steps.length }}</p>
    <span class="step-dots">
      <ProgressTrack
        class="step-bar__track"
        :share="share"
        :flares="flares"
        :ringed="onDot"
        :label="trackLabel"
        :min="1"
        :max="steps.length"
        :now="step + 1"
        :aria-valuetext="`${step + 1}/${steps.length} · ${current}`"
        :testid="testid"
      >
        <slot name="track" />
      </ProgressTrack>
      <!-- A step is the design system's own control (`.bb-section-step`): a dot and its name, no shared button fits. -->
      <button
        v-for="(entry, index) in steps"
        :key="entry.id"
        type="button"
        class="step-dot"
        :class="stepClass(index)"
        :style="{ left: `${at(index) * 100}%` }"
        :aria-label="goTo(entry.label)"
        :aria-current="index === step ? 'step' : undefined"
        :aria-disabled="entry.disabled || undefined"
        :data-step="entry.id"
        :data-testid="entry.testid ?? `${testid}-step`"
        @click="go(index)"
      >
        <span>{{ entry.label }}</span>
      </button>
    </span>
    <span class="step-bar__moves">
      <AppButton
        variant="text"
        size="sm"
        :icon="icons.back"
        :label="backLabel"
        :disabled="step === 0"
        :disabled-body="firstBody"
        :data-testid="`${testid}-back`"
        @click="emit('go', step - 1)"
      >
        {{ backLabel }}
      </AppButton>
      <AppButton
        v-if="finishing && finish"
        variant="primary"
        size="sm"
        :label="finish.label"
        :disabled="finish.disabled"
        :disabled-body="finish.disabledBody"
        :data-testid="finish.testid"
        @click="emit('finish')"
      >
        {{ finish.label }}
      </AppButton>
      <AppButton
        v-else
        variant="primary"
        size="sm"
        :trailing-icon="icons.next"
        :label="nextLabel"
        :disabled="step === last || !!nextStep?.disabled"
        :disabled-body="nextStep?.disabled ? nextDisabledBody : lastBody"
        :data-testid="`${testid}-next`"
        @click="emit('go', step + 1)"
      >
        {{ nextLabel }}
      </AppButton>
    </span>
  </ProgressBar>
</template>

<style scoped>
/* A bar of steps has room at both ends and between its parts (ticket 0780): 64 tall, 28 between the counter, the track
 * and the buttons. */
.step-bar {
  min-height: var(--step-bar-height);
  gap: var(--step-bar-gap);
}

/* The counter is Row progress's ("5/30", `control`). */
.step-bar__counter {
  margin: 0 0 0 var(--space-2);
  font: var(--type-control);
  color: var(--ink);
  white-space: nowrap;
}

/* The steps (`.bb-section-steps` in bundle.css): the track 8px down, each step's dot centred on it at its share of the
 * track and its name centred under it; the first and last dots stand in from the ends, so no name runs past them. */
.step-dots {
  position: relative;
  flex: 1 1 auto;
  min-width: 8rem;
  height: 2.375rem;
  margin-inline: var(--step-names-inset);
}

.step-bar__track {
  position: absolute;
  top: var(--space-8);
  inset-inline: 0;
  min-width: 0;
}

.step-dot {
  --d: var(--step-dot);
  position: absolute;
  top: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 0;
  padding: 0;
  font: var(--type-meta-small);
  color: var(--muted);
  text-transform: lowercase;
  background: none;
  border: 0;
  transform: translateX(-50%);
  cursor: pointer;
}

.step-dot::before {
  content: '';
  box-sizing: border-box;
  width: var(--d);
  height: var(--d);
  background: var(--track);
  border: 2px solid var(--box);
  border-radius: 50%;
}

.step-dot::before,
.step-dot > span {
  margin-top: calc(var(--space-10) - var(--d) / 2);
}

.step-dot > span {
  white-space: nowrap;
}

.step-dot--passed {
  color: var(--body);
}

.step-dot--passed::before {
  background: var(--accent);
}

/* The current step is a ring the spark's tail runs into: it takes the spark's glow once the fill has started, and its
 * flare on each step forward. */
.step-dot--current {
  --d: var(--step-dot-current);
  font-weight: 500;
  color: var(--ink);
}

.step-dot--current::before {
  background: var(--box);
  border: var(--step-ring) solid var(--accent-strong);
  transition: box-shadow var(--duration-base) var(--ease-standard);
}

.step-dot--current.is-lit::before {
  box-shadow: 0 0 8px 3px var(--spark-glow);
}

.step-dot--current.is-flaring::before {
  animation: step-dot-flare var(--spark-flare-duration) var(--ease-out) both;
}

.step-dot--current.is-flaring-alt::before {
  animation: step-dot-flare-alt var(--spark-flare-duration) var(--ease-out) both;
}

.step-dot--disabled {
  color: var(--faint);
  cursor: default;
}

.step-dot:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
  border-radius: var(--radius-xs);
}

@keyframes step-dot-flare {
  30% {
    transform: scale(var(--spark-flare));
  }
}

@keyframes step-dot-flare-alt {
  30% {
    transform: scale(var(--spark-flare));
  }
}

.step-bar__moves {
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--space-8);
}

/* Phone widths: the names are `meta-tiny` and wrap to two lines, and Back and Next take the second row, half the bar
 * each, as Row not done and Row done do (ProgressBar card). */
@media (max-width: 30rem) {
  .step-bar {
    gap: var(--space-4);
  }

  .step-dots {
    height: 3.25rem;
    margin-inline: var(--space-6);
  }

  /* No room for the inset here: the first name starts at the track's start and the last ends at its end. */
  .step-dot--first {
    align-items: flex-start;
    text-align: left;
    transform: none;
  }

  .step-dot--last {
    align-items: flex-end;
    text-align: right;
    transform: translateX(-100%);
  }

  .step-dot {
    font: var(--type-meta-tiny);
  }

  .step-dot > span {
    width: max-content;
    max-width: var(--step-name-max);
    white-space: normal;
  }

  .step-bar__moves {
    flex: 1 1 100%;
    min-width: 0;
    gap: var(--space-4);
  }

  .step-bar__moves > .app-button,
  .step-bar__moves :deep(.app-button-wrap) {
    flex: 1 1 0;
    min-width: 0;
  }

  .step-bar__moves :deep(.app-button) {
    width: 100%;
    min-width: 0;
    padding-inline: var(--space-6);
    gap: var(--space-2);
    justify-content: center;
    font: var(--type-small);
  }
}

@media (prefers-reduced-motion: reduce) {
  .step-dot--current::before {
    animation: none !important;
    transition: none;
  }
}
</style>
