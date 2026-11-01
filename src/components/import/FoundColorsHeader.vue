<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '../../i18n/useI18n'

// The found-colors table's heading row (FoundColorRow card, ticket 0758): "From picture | Becomes | Beads | Change |
// Empty", over the rows' own columns, staying in view at the top of the pane as the list scrolls. The rows name
// themselves to a screen reader, so the heading is for the eye.
const { t } = useI18n()
const words = computed(() => t.value.convertImage.wizard)
</script>

<template>
  <div class="found-colors-header" aria-hidden="true" data-testid="found-colors-header">
    <span>{{ words.fromPicture }}</span>
    <span>{{ words.becomes }}</span>
    <span class="found-colors-header__number">{{ words.beadsColumn }}</span>
    <span class="found-colors-header__action">{{ words.change }}</span>
    <span class="found-colors-header__action">{{ words.empty }}</span>
  </div>
</template>

<style scoped>
.found-colors-header {
  position: sticky;
  top: 0;
  z-index: 1;
  display: grid;
  grid-template-columns: var(--found-columns);
  column-gap: var(--space-8);
  align-items: end;
  padding: var(--space-4) var(--space-4) var(--space-4) var(--space-6);
  font: var(--type-meta-small);
  color: var(--muted);
  background: var(--box);
  border-bottom: 1px solid var(--line-soft);
  overflow-wrap: anywhere;
}

.found-colors-header__number {
  text-align: right;
}

.found-colors-header__action {
  text-align: center;
}
</style>
