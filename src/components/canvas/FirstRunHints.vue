<script setup lang="ts">
import { useI18n } from '../../i18n/useI18n'
import { useHelpDevice } from '../../composables/ui/useKeyHints'

// What an empty Project says (FirstRunHints card, tickets 0798, 0920): the next step in the Paint tool's Tooltip words
// (mouse words off touch), then one quiet line on where Projects are kept. Decoration only: hidden from screen readers
// and pointers, so the first press on the canvas paints the first bead.
const { t } = useI18n()
const { device } = useHelpDevice()
</script>

<template>
  <div class="first-run-hints" aria-hidden="true" data-testid="first-run-hints">
    <div class="first-run-hints__welcome" data-testid="first-run-welcome">
      <p class="first-run-hints__lead" data-testid="first-run-next-step">
        {{ device === 'touch' ? t.tooltips.paint : t.canvas.firstRun.paintMouse }}
      </p>
      <p class="first-run-hints__storage" data-testid="first-run-storage">{{ t.canvas.firstRun.storage }}</p>
    </div>
  </div>
</template>

<style scoped>
.first-run-hints {
  position: absolute;
  inset: 0;
  z-index: var(--z-canvas-overlay);
  overflow: hidden;
  pointer-events: none;
  color: var(--muted);
}

/* They go with the first bead over the fast duration, at once under reduced motion (FirstRunHints card). */
@media (prefers-reduced-motion: no-preference) {
  .first-run-hints-leave-active {
    transition: opacity var(--duration-fast) var(--ease-out);
  }
}

.first-run-hints-leave-to {
  opacity: 0;
}

/* Centred on the drawing area, under the CanvasHint line: the next step and the storage line 6px under it, nothing
 * else (tickets 0795, 0920). */
.first-run-hints__welcome {
  position: absolute;
  top: 50%;
  left: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: max-content;
  max-width: calc(100% - 2 * var(--space-16));
  text-align: center;
  transform: translate(-50%, -50%);
}

/* What to do first, a size up and in `body`, over the calmer `muted` line. */
.first-run-hints__lead {
  max-width: 36rem;
  margin: 0;
  font: var(--hint-storage-lead);
  color: var(--body);
}

/* A narrow screen balances it. */
.first-run-hints__storage {
  max-width: 36rem;
  margin: var(--space-6) 0 0;
  font: var(--hint-storage);
  text-wrap: balance;
}
</style>
