<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '../../i18n/useI18n'
import AppIcon from '../ui/AppIcon.vue'

// The found-colors table's heading row (FoundColorRow card, tickets 0758, 0782): "From picture | Becomes | Beads |
// Change | Empty" over the rows' columns, sticky at the top of the pane; under 360px wide "From picture → Becomes |
// Beads", the buttons naming themselves. Decorative: each row names itself to a screen reader.
const { t } = useI18n()
const words = computed(() => t.value.convertImage.wizard)
</script>

<template>
  <div class="found-colors-header" aria-hidden="true" data-testid="found-colors-header">
    <div class="found-colors-header__pair">
      <span>{{ words.fromPicture }}</span>
      <AppIcon class="found-colors-header__arrow" name="arrow-down" :size="12" />
      <span>{{ words.becomes }}</span>
    </div>
    <span class="found-colors-header__number">{{ words.beadsColumn }}</span>
    <span class="found-colors-header__action">{{ words.change }}</span>
    <span class="found-colors-header__action">{{ words.empty }}</span>
  </div>
</template>

<style scoped>
.found-colors-header {
  position: sticky;
  /* Under the Colors step's pinned header (ticket 0780). */
  top: var(--convert-step-head);
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

.found-colors-header__pair {
  display: contents;
}

.found-colors-header__arrow {
  display: none;
}

.found-colors-header__number {
  text-align: right;
}

.found-colors-header__action {
  text-align: center;
}

@container found-colors (width < 360px) {
  .found-colors-header {
    grid-template-columns: var(--found-columns-narrow);
    column-gap: var(--space-4);
  }

  .found-colors-header__pair {
    display: flex;
    flex-wrap: wrap;
    grid-column: 1 / 3;
    align-items: center;
    column-gap: var(--space-4);
  }

  .found-colors-header__arrow {
    display: block;
    flex: none;
    transform: rotate(-90deg);
  }

  .found-colors-header__action {
    display: none;
  }
}
</style>
