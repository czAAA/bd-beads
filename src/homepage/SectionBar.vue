<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import AppButton from '../components/ui/AppButton.vue'
import PatternDone from '../components/canvas/PatternDone.vue'
import ProgressBar from '../components/canvas/ProgressBar.vue'
import ProgressTrack from '../components/canvas/ProgressTrack.vue'
import { fillBlanks } from '../domain/fillBlanks'
import { useI18n } from '../i18n/useI18n'

// The Homepage's Progress bar (tickets 0739, 0744; Homepage and ProgressBar cards): the editor's bar, its sections in
// place of rows. The counter, the track with a named step per section, Back where Row not done sits and Next where Row
// done sits. It knows only the list it is given: its steps, their spacing, the counter and the fill all come from it.
const props = defineProps<{
  /** The section shown, from 0. */
  section: number
  /** The Homepage's sections in order; each one's heading names its step. */
  sections: readonly { id: string; heading: string }[]
}>()
const emit = defineEmits<{ go: [section: number] }>()
const { t } = useI18n()

const last = computed(() => props.sections.length - 1)
/** Where a section's step sits on the track, 0 to 1; the fill reaches the shown one's, so it starts empty. */
const at = (index: number) => (last.value > 0 ? index / last.value : 1)
const current = computed(() => props.sections[props.section]?.heading ?? '')

const flares = ref(0)
/** The current ring's flare, swapped on each step forward so the next one restarts it, as the spark's is. */
const ringFlare = ref<'' | 'is-flaring' | 'is-flaring-alt'>('')
/** Counts the bursts, so each one is drawn afresh; none while it is 0 or over. */
const burst = ref(0)
const bursting = ref(false)
/** The burst's length: its third flash starts 760ms in and its rays take 900ms (Motion section). */
const BURST_MS = 1700
let burstEnd: ReturnType<typeof setTimeout> | undefined

watch(
  () => props.section,
  (now, before) => {
    if (now <= before) return
    flares.value += 1
    ringFlare.value = ringFlare.value === 'is-flaring' ? 'is-flaring-alt' : 'is-flaring'
    if (now !== last.value) return
    burst.value += 1
    bursting.value = true
    clearTimeout(burstEnd)
    burstEnd = setTimeout(() => (bursting.value = false), BURST_MS)
  },
)
onBeforeUnmount(() => clearTimeout(burstEnd))

function stepClass(index: number) {
  return {
    'section-step--first': index === 0,
    'section-step--last': index > 0 && index === last.value,
    'section-step--passed': index < props.section,
    'section-step--current': index === props.section,
    'is-lit': index === props.section && props.section > 0,
    [ringFlare.value]: index === props.section && ringFlare.value !== '',
  }
}

/** Pattern done plays in a square round the track's end; its bursts sit along a short span there, none up. */
const BURST_SHEET = { x: -160, y: -160, width: 320, height: 320 }
const BURST_SPAN = { x: 100, y: 160, width: 120, height: 0 }
</script>

<template>
  <ProgressBar class="section-bar" data-testid="section-bar">
    <p class="section-bar__counter" data-testid="section-counter">{{ section + 1 }}/{{ sections.length }}</p>
    <span class="section-steps">
      <ProgressTrack
        class="section-steps__track"
        :share="at(section)"
        :flares="flares"
        ringed
        :label="t.homepage.sections.label"
        :min="1"
        :max="sections.length"
        :now="section + 1"
        :aria-valuetext="`${section + 1}/${sections.length} · ${current}`"
        testid="section"
      >
        <span v-if="bursting" :key="burst" class="section-bar__burst" data-testid="section-burst">
          <PatternDone :sheet="BURST_SHEET" :frame="BURST_SPAN" :stars="[]" />
        </span>
      </ProgressTrack>
      <!-- A step is the design system's own control (`.bb-section-step`): a dot and its name, no shared button fits. -->
      <button
        v-for="(entry, index) in sections"
        :key="entry.id"
        type="button"
        class="section-step"
        :class="stepClass(index)"
        :style="{ left: `${at(index) * 100}%` }"
        :aria-label="fillBlanks(t.homepage.sections.goTo, { section: entry.heading })"
        :aria-current="index === section ? 'step' : undefined"
        data-testid="section-step"
        @click="emit('go', index)"
      >
        <span>{{ entry.heading }}</span>
      </button>
    </span>
    <span class="section-bar__moves">
      <AppButton
        variant="box"
        size="lg"
        icon="arrow-up"
        :label="t.homepage.sections.back"
        :disabled="section === 0"
        :disabled-body="t.homepage.sections.firstBody"
        data-testid="section-back"
        @click="emit('go', section - 1)"
      >
        {{ t.homepage.sections.back }}
      </AppButton>
      <AppButton
        variant="primary"
        size="lg"
        trailing-icon="arrow-down"
        :label="t.homepage.sections.next"
        :disabled="section === last"
        :disabled-body="t.homepage.sections.lastBody"
        data-testid="section-next"
        @click="emit('go', section + 1)"
      >
        {{ t.homepage.sections.next }}
      </AppButton>
    </span>
  </ProgressBar>
</template>

<style scoped>
/* The counter is Row progress's ("5/30", `control`). */
.section-bar__counter {
  margin: 0 0 0 var(--space-2);
  font: var(--type-control);
  color: var(--ink);
  white-space: nowrap;
}

/* The steps (`.bb-section-steps` in bundle.css): the track 8px down, each step's dot centred on it at its share of the
 * track, its name under it; the first name starts at the track's start, the last ends at its end. */
.section-steps {
  position: relative;
  flex: 1 1 auto;
  min-width: 8rem;
  height: 2.375rem;
  margin-inline: var(--space-8);
}

.section-steps__track {
  position: absolute;
  top: var(--space-8);
  inset-inline: 0;
  min-width: 0;
}

.section-step {
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

.section-step::before {
  content: '';
  box-sizing: border-box;
  width: var(--d);
  height: var(--d);
  background: var(--track);
  border: 2px solid var(--box);
  border-radius: 50%;
}

.section-step::before,
.section-step > span {
  margin-top: calc(var(--space-10) - var(--d) / 2);
}

.section-step > span {
  white-space: nowrap;
}

.section-step--first {
  align-items: flex-start;
  text-align: left;
  transform: none;
}

.section-step--last {
  align-items: flex-end;
  text-align: right;
  transform: translateX(-100%);
}

.section-step--passed {
  color: var(--body);
}

.section-step--passed::before {
  background: var(--accent);
}

/* The current step is a ring the spark's tail runs into: it takes the spark's glow once the fill has started, and its
 * flare on each step forward. */
.section-step--current {
  --d: var(--step-dot-current);
  color: var(--ink);
}

.section-step--current::before {
  background: var(--box);
  border: var(--step-ring) solid var(--accent-strong);
  transition: box-shadow var(--duration-base) var(--ease-standard);
}

.section-step--current.is-lit::before {
  box-shadow: 0 0 8px 3px var(--spark-glow);
}

.section-step--current.is-flaring::before {
  animation: section-step-flare var(--spark-flare-duration) var(--ease-out) both;
}

.section-step--current.is-flaring-alt::before {
  animation: section-step-flare-alt var(--spark-flare-duration) var(--ease-out) both;
}

.section-step:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
  border-radius: var(--radius-xs);
}

@keyframes section-step-flare {
  30% {
    transform: scale(var(--spark-flare));
  }
}

@keyframes section-step-flare-alt {
  30% {
    transform: scale(var(--spark-flare));
  }
}

.section-bar__burst {
  position: absolute;
  top: 50%;
  right: 0;
  width: 0;
  height: 0;
}

.section-bar__moves {
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--space-8);
}

/* Phone widths: the names are `meta-tiny` and wrap to two lines, and Back and Next take the second row, half the bar
 * each, as Row not done and Row done do (ProgressBar card). */
@media (max-width: 30rem) {
  .section-steps {
    height: 3.25rem;
    margin-inline: var(--space-6);
  }

  .section-step {
    font: var(--type-meta-tiny);
  }

  .section-step > span {
    width: max-content;
    max-width: var(--step-name-max);
    white-space: normal;
  }

  .section-bar__moves {
    flex: 1 1 100%;
    min-width: 0;
    gap: var(--space-4);
  }

  .section-bar__moves > .app-button,
  .section-bar__moves :deep(.app-button-wrap) {
    flex: 1 1 0;
    min-width: 0;
  }

  .section-bar__moves :deep(.app-button) {
    width: 100%;
    min-width: 0;
    padding-inline: var(--space-6);
    gap: var(--space-2);
    justify-content: center;
    font: var(--type-small);
  }
}

@media (prefers-reduced-motion: reduce) {
  .section-step--current::before {
    animation: none !important;
    transition: none;
  }
}
</style>
