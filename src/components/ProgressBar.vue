<script setup lang="ts">
import { computed } from 'vue'
import { rowProgressPosition, type Pattern, type PatternShape } from '../domain/pattern'
import { useI18n } from '../i18n/useI18n'

/**
 * Progress bar (CONTEXT.md; ADR 0005's 2026-09-22 amendment): Row progress's moment-to-moment controls, moved off
 * the Toolbox and onto the canvas panel itself — a "row X of Y" readout plus icon-only Previous/Next buttons that
 * move the current-row pointer exactly as the Toolbox's own buttons did before this move. The caller (App.vue) is
 * what decides whether this renders at all (only while Row progress is on) and which `orientation` to mount it
 * with, per the open Pattern's shape.
 */
const props = defineProps<{
  pattern: Pattern
  /** Which way this reflows, per the open Pattern's shape (domain/pattern.ts's patternShape). */
  orientation: PatternShape
}>()

const emit = defineEmits<{
  'move-row': [delta: number]
}>()

const { t } = useI18n()

const position = computed(() => rowProgressPosition(props.pattern))
</script>

<template>
  <div class="progress-bar" :class="`progress-bar--${orientation}`" data-testid="progress-bar">
    <p class="progress-bar__position" data-testid="progress-bar-position">
      {{ t.rowProgress.positionLabel }} {{ position.current + 1 }} / {{ position.total }}
    </p>
    <button
      type="button"
      class="icon-button progress-bar__previous"
      data-testid="progress-bar-previous"
      :title="`${t.rowProgress.previousButton} (Shift+Enter)`"
      :aria-label="t.rowProgress.previousButton"
      :disabled="position.current === 0"
      @click="emit('move-row', -1)"
    >
      <!-- Rows are woven top to bottom, so stepping back up the Pattern is a plain up arrow (same glyph as the Toolbox's own button used to draw). -->
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 20V5" />
        <path d="M5.5 11.5 12 5l6.5 6.5" />
      </svg>
    </button>
    <button
      type="button"
      class="icon-button progress-bar__next"
      data-testid="progress-bar-next"
      :title="`${t.rowProgress.nextButton} (Enter)`"
      :aria-label="t.rowProgress.nextButton"
      :disabled="position.current === position.total - 1"
      @click="emit('move-row', 1)"
    >
      <!-- A tick, not a down arrow: what this button means is "this row is woven", and advancing is the consequence. -->
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M4 13l5.5 5.5L20 6" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
/*
 * Both orientations lay the same three children out with flex; which one the caller picks (App.vue, per Pattern
 * shape) is what decides flex-direction, not a media query — Pattern shape depends on the grid's own geometry, not
 * the viewport. Carries its own card frame, matching the other canvas-attached controls (ZoomControls).
 */
.progress-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  width: fit-content;
  padding: 8px;
  background: var(--color-paper-solid);
  border: var(--border-width) solid var(--color-ink);
  border-radius: var(--radius-lg);
}

.progress-bar__position {
  margin: 0;
  font-weight: var(--font-weight-bold);
  white-space: nowrap;
  /* Same-width digits, so stepping from row 9 to 10 doesn't nudge the box's size. */
  font-variant-numeric: tabular-nums;
}

/*
 * Vertical (CONTEXT.md's Pattern shape): a column, top to bottom exactly in DOM/tab order — readout, then Previous,
 * then Next — so no reordering is needed here.
 */
.progress-bar--vertical {
  flex-direction: column;
}

/*
 * Horizontal: Previous, readout, Next side by side. `order` moves only what is seen, the same trick Toolbox.vue's
 * mirror-axis-counter uses — the markup, and so the reading and Tab order, stays position/previous/next.
 */
.progress-bar--horizontal {
  flex-direction: row;
}

.progress-bar--horizontal .progress-bar__previous {
  order: 1;
}

.progress-bar--horizontal .progress-bar__position {
  order: 2;
}

.progress-bar--horizontal .progress-bar__next {
  order: 3;
}
</style>
