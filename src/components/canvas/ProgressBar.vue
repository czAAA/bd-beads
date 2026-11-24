<script setup lang="ts">
import { ref } from 'vue'
import { useRovingFocus } from '../../composables/ui/useRovingFocus'

// The Progress bar of a page that goes by steps (CONTEXT.md; tickets 0739, 0744, ProgressBar card): the bar along the
// canvas box's bottom, filled through the slot by StepBar (the Homepage's sections, Convert image's steps). Row progress
// is no longer in it: each Frame's strip holds that (ticket 1223).
const rootEl = ref<HTMLElement>()
// One Tab stop; ←/→ step along the bar's controls and stop at the ends (ADR 0075).
const roving = useRovingFocus(rootEl, { axis: () => 'horizontal', managesTabIndex: true })
</script>

<template>
  <div ref="rootEl" class="progress-bar no-page-pan" data-testid="progress-bar" @keydown="roving.onKeydown" @focusin="roving.onFocusin">
    <slot />
  </div>
</template>

<style scoped>
.progress-bar {
  container-type: inline-size;
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--space-12);
  box-sizing: border-box;
  /* As tall as its tallest item plus 1px above and below (ticket 544); --progress-height is the same rule for the
   * Homepage's empty footer. The bottom corners follow the canvas box's curve; 24 at both ends keeps what it holds off
   * the box's edge (ticket 0780). Where the app shell runs it to the screen's bottom edge over a safe-area inset (the
   * iPad's home indicator, ticket 0788), it grows by the inset and keeps what it holds above it. */
  min-height: calc(var(--progress-height) + var(--bar-bottom-inset, 0px));
  padding: var(--bar-pad) var(--space-24) calc(var(--bar-pad) + var(--bar-bottom-inset, 0px));
  border: 1px solid color-mix(in srgb, var(--box-muted) 22%, transparent);
  border-bottom: 0;
  border-radius: 0 0 var(--canvas-box-radius) var(--canvas-box-radius);
}

/* Phone widths (ticket 411): Back a row and Row done take a second row (RowProgressControls), so the bar wraps and is taller:
 * --progress-height (controls.css), which things above follow. */
@media (max-width: 30rem) {
  .progress-bar {
    flex-wrap: wrap;
    align-content: center;
    /* Remove frame, Edit Frame and Turn row direction share the first row with the counter and the track (ticket
     * 443): 4px between them keeps it one row at 320px, inside the 12px screen edge (ticket 450). */
    gap: var(--space-4);
    padding-inline: var(--space-4);
  }
}
</style>
