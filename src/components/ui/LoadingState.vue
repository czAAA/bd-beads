<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

/** A wait (ticket 158): nothing for the first `loading-delay` (300ms) so fast work never flashes, then beads or a
 * progress track. `ai` is the Loading card's AI variant (ticket 0767): in `ai`, the line full width with the text and the
 * default slot's action (Cancel) under it; `spoken` is read in place of a text whose count climbs. */
defineProps<{ text: string; share?: number; compact?: boolean; ai?: boolean; spoken?: string }>()

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
  <div v-if="shown" class="loading" :class="{ 'loading--compact': compact, 'loading--ai': ai }" role="status" data-testid="loading">
    <span v-if="share === undefined" class="loading__beads" aria-hidden="true">
      <i class="loading__bead" /><i class="loading__bead" /><i class="loading__bead" />
    </span>
    <span v-else class="loading__track" aria-hidden="true">
      <i class="loading__fill" :style="{ width: `${Math.round(share * 100)}%` }" />
    </span>
    <span class="loading__text" :aria-hidden="spoken ? 'true' : undefined">{{ text }}</span>
    <span v-if="spoken" class="loading__spoken">{{ spoken }}</span>
    <slot />
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

/* The AI variant (Loading card): the beads and the line in `ai`; the line the full width over its text and action, the
   beads, text and action on one row; the action at the right, wrapping under before it overflows. */
.loading--ai {
  flex-flow: row wrap;
  align-items: center;
  gap: var(--space-6) var(--space-8);
  padding: 0;
  text-align: left;
}

.loading--ai .loading__text {
  flex: 1 1 0;
  min-width: min-content;
}

.loading--ai .loading__beads {
  gap: var(--space-4);
}

.loading--ai .loading__bead {
  width: var(--space-8);
  height: var(--space-8);
  background: var(--ai);
}

.loading--ai .loading__track {
  flex: 1 0 100%;
  width: 100%;
}

.loading--ai .loading__fill {
  background: var(--ai);
}

.loading__spoken {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  white-space: nowrap;
  clip-path: inset(50%);
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
