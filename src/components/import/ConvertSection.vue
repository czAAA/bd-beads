<script setup lang="ts">
import { useId } from 'vue'
import AppIcon from '../ui/AppIcon.vue'

// A step in the Convert image pane (ConvertImage card, Steps; ticket 0780): its header, pinned to the pane's top while the
// step is in view (the step disc, the title and a summary of what it holds now), then its body. Shut until a picture is set.
defineProps<{
  step: number
  title: string
  /** What the step holds now, at the header's right. */
  summary?: string
  /** Picture & bead's disc is a check once a picture is set. */
  done?: boolean
  /** A step that waits for a picture: its header in `faint`, no body. */
  shut?: boolean
  /** The header is pinned at the pane's top, so it has an edge under it. */
  stuck?: boolean
  testid: string
}>()

const headingId = useId()
</script>

<template>
  <section
    class="convert-section"
    :class="{ 'convert-section--shut': shut }"
    role="region"
    :aria-labelledby="headingId"
    :aria-disabled="shut || undefined"
    :data-step="step"
    :data-testid="testid"
  >
    <div class="convert-section__header" :class="{ 'convert-section__header--stuck': stuck }">
      <h3 :id="headingId" class="convert-section__heading" tabindex="-1" :data-testid="`${testid}-header`">
        <span class="convert-section__disc" :class="{ 'convert-section__disc--done': done }" aria-hidden="true">
          <AppIcon v-if="done" name="check" :size="12" />
          <template v-else>{{ step }}</template>
        </span>
        <span class="convert-section__title">{{ title }}</span>
      </h3>
      <span v-if="summary" class="convert-section__summary" :data-testid="`${testid}-summary`">{{ summary }}</span>
    </div>
    <div v-if="!shut" class="convert-section__body">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.convert-section {
  border-bottom: 1px solid var(--panel-rule);
}

.convert-section:last-child {
  border-bottom: 0;
}

/* Pinned to the pane's top while its step is in view; the next step's header pushes it out. A summary too long for the
 * title's row wraps under it rather than being cut (the build's change to the card). */
.convert-section__header {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2) var(--space-10);
  box-sizing: border-box;
  min-height: var(--convert-step-head);
  padding: var(--space-8) var(--space-24);
  background: var(--canvas);
  border-bottom: 1px solid transparent;
}

.convert-section__header--stuck {
  border-bottom-color: var(--line-soft);
}

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
  color: var(--muted);
  text-align: right;
}

.convert-section--shut .convert-section__heading,
.convert-section--shut .convert-section__disc,
.convert-section--shut .convert-section__summary {
  color: var(--faint);
}

.convert-section__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-16);
  min-width: 0;
  padding: var(--space-4) var(--space-24) var(--convert-step-end);
}

@media (max-width: 63.99rem), (orientation: portrait) {
  .convert-section__header {
    padding-inline: var(--space-16);
  }

  .convert-section__body {
    padding: var(--space-4) var(--space-16) var(--space-24);
  }
}
</style>
