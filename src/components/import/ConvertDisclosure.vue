<script setup lang="ts">
import { ref, useId } from 'vue'
import AppIcon from '../ui/AppIcon.vue'

// A full-width row that opens its content in place, below it (DisclosureRow card, without an icon): the Convert image
// wizard's Color by color, closed every time the popup opens (ConvertImage card, ticket 0747).
defineProps<{
  label: string
  /** The current values at the right, in meta ("8 colors · 1 empty"). */
  summary?: string
  testid?: string
}>()

const open = ref(false)
const contentId = useId()
</script>

<template>
  <div class="convert-disclosure" :class="{ 'convert-disclosure--open': open }">
    <button type="button" class="convert-disclosure__row" :aria-expanded="open" :aria-controls="contentId" :data-testid="testid" @click="open = !open">
      <span class="convert-disclosure__label">{{ label }}</span>
      <span v-if="summary" class="convert-disclosure__summary" :data-testid="testid && `${testid}-summary`">{{ summary }}</span>
      <AppIcon :name="open ? 'chevron-up' : 'chevron-down'" :size="16" class="convert-disclosure__chevron" />
    </button>
    <div v-if="open" :id="contentId" class="convert-disclosure__content" :data-testid="testid && `${testid}-content`">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.convert-disclosure {
  border-top: 1px solid var(--panel-rule);
  border-bottom: 1px solid var(--panel-rule);
}

.convert-disclosure__row {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  width: 100%;
  min-height: var(--panel-row);
  padding: var(--space-10) 0;
  color: var(--ink);
  font: var(--type-control);
  text-align: left;
  background: none;
  border: 0;
  cursor: pointer;
}

.convert-disclosure__row:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: var(--focus-offset);
}

.convert-disclosure__label {
  flex: 1;
  min-width: 0;
}

.convert-disclosure__summary {
  font: var(--type-meta);
  color: var(--muted);
  white-space: nowrap;
}

.convert-disclosure__chevron {
  flex: none;
  color: var(--muted);
}

.convert-disclosure__content {
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
  padding-bottom: var(--space-12);
}
</style>
