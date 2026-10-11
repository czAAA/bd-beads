<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * A wait (ticket 158; Loading card, forms-and-states.md): nothing for the first `loading-delay` (300ms), so fast work
 * never flashes, then three accent beads swelling in turn (standing still with reduced motion), or the 4px progress
 * track when the share done is known, with a line saying what is happening ("Making the PDF · Fox"). Mount it for as
 * long as the wait lasts.
 */
defineProps<{ text: string; share?: number; compact?: boolean }>()

/** `--loading-delay` (tokens.json): read from the page when it has one, since a timer can't take a CSS value. */
function loadingDelayMs(): number {
  const value = getComputedStyle(document.documentElement).getPropertyValue('--loading-delay').trim()
  const ms = Number.parseFloat(value)
  return Number.isFinite(ms) ? ms : 300
}

const shown = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

onMounted(() => {
  timer = setTimeout(() => (shown.value = true), loadingDelayMs())
})
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <div v-if="shown" class="loading" :class="{ 'loading--compact': compact }" role="status" data-testid="loading">
    <span v-if="share === undefined" class="loading__beads" aria-hidden="true">
      <i class="loading__bead" /><i class="loading__bead" /><i class="loading__bead" />
    </span>
    <span v-else class="loading__track" aria-hidden="true">
      <i class="loading__fill" :style="{ width: `${Math.round(share * 100)}%` }" />
    </span>
    <span class="loading__text">{{ text }}</span>
  </div>
</template>

<style scoped>
.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-12);
  padding: var(--space-24);
  font: var(--type-meta);
  font-family: var(--font-sans);
  color: var(--body);
  text-align: center;
}

.loading--compact {
  flex-direction: row;
  gap: var(--space-8);
  padding: 0;
  text-align: left;
}

.loading__beads {
  display: inline-flex;
  flex: none;
  gap: var(--space-8);
}

.loading--compact .loading__beads {
  gap: var(--space-4);
}

.loading__bead {
  width: var(--swatch-dot);
  height: var(--swatch-dot);
  background: var(--accent);
  border-radius: var(--radius-full);
  animation: loading-swell 1.2s infinite ease-in-out;
}

.loading--compact .loading__bead {
  width: var(--space-8);
  height: var(--space-8);
}

.loading__bead:nth-child(2) {
  animation-delay: 0.15s;
}

.loading__bead:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes loading-swell {
  0%,
  80%,
  100% {
    opacity: 0.45;
    transform: scale(0.55);
  }

  40% {
    opacity: 1;
    transform: scale(1);
  }
}

/* Reduced motion: the beads stand still. */
@media (prefers-reduced-motion: reduce) {
  .loading__bead {
    opacity: 0.8;
    animation: none;
  }
}

.loading__track {
  display: block;
  width: calc(var(--tooltip-wide) - var(--space-24));
  height: var(--track-height);
  overflow: hidden;
  background: var(--track);
  border-radius: var(--radius-full);
}

.loading__fill {
  display: block;
  height: 100%;
  background: var(--track-fill);
}
</style>
