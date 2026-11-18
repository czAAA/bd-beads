<script setup lang="ts">
import { RADIAL_HOLE } from '../../domain/radialToolbox'

/** The hairline a hold on the Canvas draws round the pressed point while it is timed (RadialToolbox card, ticket
 * 1065): once round, clockwise from the top, where the ring's inner edge will be. It says the ring is coming; a tap
 * never shows it, and reduced motion shows none. */
defineProps<{
  /** The pressed point, in client px; none while no hold is timed. */
  at?: { x: number; y: number }
}>()

/** The circle with room for its line's width, in the design system's px. */
const viewBox = `${-RADIAL_HOLE - 2} ${-RADIAL_HOLE - 2} ${2 * RADIAL_HOLE + 4} ${2 * RADIAL_HOLE + 4}`
</script>

<template>
  <svg v-if="at" class="hold-hairline" :style="{ left: `${at.x}px`, top: `${at.y}px` }" :viewBox="viewBox" aria-hidden="true" focusable="false" data-testid="hold-hairline">
    <circle class="hold-hairline__line" :r="RADIAL_HOLE" pathLength="1" transform="rotate(-90)" />
  </svg>
</template>

<style scoped>
/* Centred on the pressed point at the ring's hole (radius 60), in the app shell as the ring is, so nothing clips it. */
.hold-hairline {
  --hold-hairline-size: calc(2 * var(--radial-radius) - var(--pill-thickness) + 2 * var(--space-2));
  position: fixed;
  z-index: var(--z-popover);
  width: var(--hold-hairline-size);
  height: var(--hold-hairline-size);
  margin: calc(-0.5 * var(--hold-hairline-size)) 0 0 calc(-0.5 * var(--hold-hairline-size));
  pointer-events: none;
}

/* Nothing for --hold-quiet, then the line is drawn once and closes as the hold ends (--hold-duration). */
.hold-hairline__line {
  fill: none;
  stroke: var(--ink);
  stroke-width: var(--pill-tile-outline);
  stroke-linecap: round;
  stroke-dasharray: 1;
  opacity: 0;
  animation: hold-hairline-draw calc(var(--hold-duration) - var(--hold-quiet)) linear var(--hold-quiet) forwards;
}

@keyframes hold-hairline-draw {
  from {
    opacity: 1;
    stroke-dashoffset: 1;
  }
  to {
    opacity: 1;
    stroke-dashoffset: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .hold-hairline {
    display: none;
  }
}
</style>
