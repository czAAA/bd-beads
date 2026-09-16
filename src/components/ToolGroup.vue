<script setup lang="ts">
import { useId } from 'vue'

defineProps<{ title: string }>()

/** Unique per instance so several Tool groups on one page never share an id (ticket 40). */
const titleId = useId()
</script>

<template>
  <section class="tool-group" :aria-labelledby="titleId">
    <p :id="titleId" class="tool-group__title">{{ title }}</p>
    <div class="tool-group__grid">
      <slot />
    </div>
  </section>
</template>

<style scoped>
/*
 * One titled box in the Toolbox (CONTEXT.md's Tool group). Sizes to its own content rather than stretching to fill
 * the row — a three-control group like Edit stays narrow, while Colors, with a dozen swatches, is wide — so this
 * neither grows nor shrinks in the Toolbox's flex row (see Toolbox.vue's .toolbox).
 */
.tool-group {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 6px 12px 10px;
  background: var(--color-paper-solid);
  border: var(--border-width) solid var(--color-ink);
  border-radius: var(--radius-md);
}

.tool-group__title {
  margin: 0;
  font-size: 12px;
  font-weight: var(--font-weight-bold);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-ink);
  opacity: 0.55;
}

/*
 * Controls flow left to right, at most 7 per row (ticket 40): a fixed 7-column template, sized to each column's own
 * content, so an under-full group (e.g. 3 controls) collapses the unused columns to nothing rather than stretching.
 * A control marked .tool-group__full-row (a text/numeric readout) spans every column, forcing its own row without
 * counting toward the two-row/14-slot cap — grid auto-placement resumes normal controls on a fresh row after it.
 */
.tool-group__grid {
  display: grid;
  grid-template-columns: repeat(7, min-content);
  gap: 8px;
  align-items: center;
}
</style>
