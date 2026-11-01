<script setup lang="ts">
import { useId } from 'vue'
import AppIcon from '../ui/AppIcon.vue'

// The step in hand on the Convert image page (ConvertImage card, Steps): its step disc, title and a summary of what it
// holds, then its body.
defineProps<{
  step: number
  title: string
  /** What the section holds now, at the header's right. */
  summary?: string
  /** Picture's disc is a check once a picture is set. */
  done?: boolean
  testid: string
}>()

const headingId = useId()
</script>

<template>
  <section
    class="convert-section"
    role="region"
    :aria-labelledby="headingId"
    :data-step="step"
    :data-testid="testid"
  >
    <div class="convert-section__header">
      <h3 :id="headingId" class="convert-section__heading" tabindex="-1" :data-testid="`${testid}-header`">
        <span class="convert-section__disc" :class="{ 'convert-section__disc--done': done }" aria-hidden="true">
          <AppIcon v-if="done" name="check" :size="12" />
          <template v-else>{{ step }}</template>
        </span>
        <span class="convert-section__title">{{ title }}</span>
      </h3>
      <span v-if="summary" class="convert-section__summary" :data-testid="`${testid}-summary`">{{ summary }}</span>
    </div>
    <div class="convert-section__body">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.convert-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
  padding: var(--space-14) var(--space-20) var(--space-16);
  border-bottom: 1px solid var(--panel-rule);
}

.convert-section__header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-4) var(--space-10);
  min-height: var(--panel-row);
}

/* The title keeps its line; the summary takes the rest of the row, or a row of its own when it is long. */
.convert-section__heading {
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--space-10);
  margin: 0;
  font: var(--type-control);
  font-weight: 600;
  color: var(--ink);
}

.convert-section__heading:focus {
  outline: none;
}

.convert-section__heading:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: 2px;
}

.convert-section__disc {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: var(--step-disc);
  height: var(--step-disc);
  font: var(--type-meta-small);
  color: var(--ink);
  background: var(--overlay-fill);
  border: 1px solid var(--line-strong);
  border-radius: 50%;
}

.convert-section__disc--done {
  color: var(--canvas);
  background: var(--ink);
  border-color: var(--ink);
}

.convert-section__summary {
  flex: 1 1 auto;
  min-width: 0;
  overflow-wrap: anywhere;
  font: var(--type-meta);
  font-weight: 400;
  color: var(--muted);
  text-align: right;
}

.convert-section__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
  min-width: 0;
}

@media (max-width: 63.99rem), (orientation: portrait) {
  .convert-section {
    padding: var(--space-12) var(--space-16) var(--space-16);
  }
}
</style>
