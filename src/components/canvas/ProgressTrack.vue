<script setup lang="ts">
import { computed, ref, watch } from 'vue'

// The Progress bar's track (ProgressBar card, tickets 0729, 0730): a groove with the fill and the spark riding its edge.
// Row progress draws its rows on it, in the bar and on the margin; the Homepage its sections (ticket 0739). What plays at
// the track's end (the Homepage's Pattern done) is its slot.
const props = withDefaults(defineProps<{
  /** The share done, 0 to 1. */
  share: number
  /** Counts the steps forward: each one flares the spark; none until the first, so a track shown afresh doesn't flare. */
  flares?: number
  /** The margin's smaller spark (MarginSheet card). */
  compact?: boolean
  /** Only the spark's tail is drawn: the Homepage's current step is its dot (ticket 0744). */
  ringed?: boolean
  label: string
  min: number
  max: number
  now: number
  testid: string
}>(), { flares: 0, compact: false, ringed: false })

/** The fill and the spark at its edge are the track's width moved left by the share still to go: they grow by
 * `transform`. */
const fillShift = computed(() => ({ transform: `translateX(${(props.share - 1) * 100}%)` }))

const sparkLook = computed(() => ({ 'progress-track__spark--compact': props.compact, 'progress-track__spark--ringed': props.ringed }))

/** Two names for one animation, swapped on each step forward so the next one restarts it; a step back moves the spark
 * with none. */
const flare = ref<'' | 'progress-track__spark--flaring' | 'progress-track__spark--flaring-alt'>('')
watch(
  () => props.flares,
  (count, before) => {
    if (count > before) flare.value = flare.value === 'progress-track__spark--flaring' ? 'progress-track__spark--flaring-alt' : 'progress-track__spark--flaring'
  },
)
</script>

<template>
  <div class="progress-track" role="progressbar" :aria-label="label" :aria-valuemin="min" :aria-valuemax="max" :aria-valuenow="now" :data-testid="`${testid}-track`">
    <!-- Its tail inside the clipped groove, its dot outside so its flare and halo show (ticket 0730). -->
    <span class="progress-track__groove">
      <span class="progress-track__fill" :style="fillShift" />
      <span class="progress-track__spark" :class="[flare, sparkLook]" :style="fillShift" :hidden="share === 0" aria-hidden="true"><b /></span>
    </span>
    <span
      class="progress-track__spark"
      :class="[flare, sparkLook]"
      :style="fillShift"
      :hidden="share === 0"
      aria-hidden="true"
      :data-testid="`${testid}-spark`"
    ><i /></span>
    <slot />
  </div>
</template>

<style scoped>
.progress-track {
  position: relative;
  flex: 1 1 auto;
  min-width: var(--space-32);
  height: var(--track-height);
}

.progress-track__groove {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--track);
  border-radius: var(--radius-full);
}

.progress-track__fill {
  display: block;
  height: 100%;
  background: var(--track-fill);
  border-radius: inherit;
  transition: transform var(--duration-base) var(--ease-standard);
}

/* The spark (`.bb-spark` in bundle.css, whose halo and tail stretch it copies): a dot with a halo and a tail fading back
 * along the fill; hidden, not removed, before the first step. */
.progress-track__spark {
  position: absolute;
  inset: 0;
  pointer-events: none;
  transition: transform var(--duration-base) var(--ease-standard);
}

.progress-track__spark[hidden] {
  display: block;
  opacity: 0;
}

.progress-track__spark > b {
  position: absolute;
  top: 0;
  right: 0;
  width: var(--spark-tail);
  height: 100%;
  background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--spark-core) 85%, transparent));
  border-radius: var(--radius-full);
  transform-origin: right center;
}

.progress-track__spark > i {
  position: absolute;
  top: 50%;
  right: calc(var(--spark-size) / -2);
  width: var(--spark-size);
  height: var(--spark-size);
  margin-top: calc(var(--spark-size) / -2);
  background: var(--spark-core);
  border-radius: 50%;
  box-shadow: 0 0 8px 3px var(--spark-glow);
}

.progress-track__spark--compact {
  --spark-size: var(--spark-size-compact);
  --spark-tail: var(--spark-tail-compact);
}

.progress-track__spark--ringed > i {
  display: none;
}

.progress-track__spark--flaring > i {
  animation: progress-track-flare var(--spark-flare-duration) var(--ease-out) both;
}

.progress-track__spark--flaring-alt > i {
  animation: progress-track-flare-alt var(--spark-flare-duration) var(--ease-out) both;
}

.progress-track__spark--flaring > b {
  animation: progress-track-tail var(--spark-flare-duration) var(--ease-out) both;
}

.progress-track__spark--flaring-alt > b {
  animation: progress-track-tail-alt var(--spark-flare-duration) var(--ease-out) both;
}

@keyframes progress-track-flare {
  30% {
    transform: scale(var(--spark-flare));
  }
}

@keyframes progress-track-flare-alt {
  30% {
    transform: scale(var(--spark-flare));
  }
}

@keyframes progress-track-tail {
  0% {
    transform: scaleX(1.8);
  }

  100% {
    transform: none;
    opacity: 0.7;
  }
}

@keyframes progress-track-tail-alt {
  0% {
    transform: scaleX(1.8);
  }

  100% {
    transform: none;
    opacity: 0.7;
  }
}

/* Reduced motion: the fill steps, and the spark neither flares nor trails (ticket 0730). */
@media (prefers-reduced-motion: reduce) {
  .progress-track__fill,
  .progress-track__spark {
    transition: none;
  }

  .progress-track__spark > i {
    animation: none !important;
  }

  .progress-track__spark > b {
    display: none;
  }
}
</style>
