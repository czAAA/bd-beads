<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { GhostState } from './hand'
import { keepAboveMenus } from './ghostLayer'

// The ghost (Homepage card, What's inside, ticket 0797): a pointer that is not the beader's, the system arrow, moving
// where a beader's hand would and leaving a ripple where it presses. Decoration only: hidden from screen readers and
// never in the way of a press.
defineProps<{ ghost: GhostState }>()

const layerEl = ref<HTMLElement>()
let stop: (() => void) | undefined
// Above the editor's menus and pickers while one is open (ticket 0820), over the box it is drawn in.
onMounted(() => (stop = keepAboveMenus(layerEl.value!, layerEl.value!.parentElement!)))
onBeforeUnmount(() => stop?.())
</script>

<template>
  <div ref="layerEl" class="ghost-layer" popover="manual" aria-hidden="true" data-testid="inside-ghost">
    <span v-for="ripple in ghost.ripples" :key="ripple.id" class="ghost-ripple" :style="{ left: `${ripple.x}px`, top: `${ripple.y}px` }" />
    <svg
      class="ghost"
      :class="{ 'ghost--shown': ghost.shown }"
      :style="{ transform: `translate(${ghost.x - 4}px, ${ghost.y - 2}px)`, transitionDuration: `${ghost.moveMs}ms, var(--duration-fast)` }"
      width="28"
      height="32"
      viewBox="0 0 28 32"
    >
      <path d="M4 2l18 14-8 1 5 10-4 2-5-10-6 6z" />
    </svg>
  </div>
</template>

<style scoped>
.ghost-layer {
  position: absolute;
  inset: 0;
  z-index: var(--z-tooltip);
  display: block;
  width: auto;
  height: auto;
  margin: 0;
  padding: 0;
  overflow: hidden;
  background: none;
  border: 0;
  pointer-events: none;
}

/* In the top layer over the demo's box, placed from the screen's corner, while a menu or picker is open (ticket 0820). */
.ghost-layer:popover-open {
  position: fixed;
  inset: auto;
}

/* The system arrow, white with a 1.5px dark edge and a soft shadow, 28 × 32, moving over `--ghost-move`. */
.ghost {
  position: absolute;
  top: 0;
  left: 0;
  width: 1.75rem;
  height: 2rem;
  opacity: 0;
  filter: drop-shadow(0 1px 2px color-mix(in srgb, var(--ghost-edge) 60%, transparent));
  transition-property: transform, opacity;
  transition-timing-function: var(--ease-standard);
  will-change: transform;
}

.ghost--shown {
  opacity: 1;
}

.ghost path {
  fill: var(--ghost-fill);
  stroke: var(--ghost-edge);
  stroke-width: 1.5;
  stroke-linejoin: round;
}

/* A press's ripple: a 30px ring, white at 30% over white at 5%, growing from 30% to 130% and fading. */
.ghost-ripple {
  position: absolute;
  width: 1.875rem;
  height: 1.875rem;
  margin: -0.9375rem 0 0 -0.9375rem;
  background: color-mix(in srgb, var(--ghost-fill) 5%, transparent);
  border: 1.5px solid color-mix(in srgb, var(--ghost-fill) 30%, transparent);
  border-radius: var(--radius-full);
  animation: ghost-ripple var(--ghost-ripple) var(--ease-out) forwards;
}

@keyframes ghost-ripple {
  from {
    opacity: 1;
    transform: scale(0.3);
  }

  to {
    opacity: 0;
    transform: scale(1.3);
  }
}
</style>
