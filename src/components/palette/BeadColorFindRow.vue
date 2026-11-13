<script setup lang="ts">
import { computed } from 'vue'
import { fillBlanks } from '../../domain/fillBlanks'
import { useI18n } from '../../i18n/useI18n'
import AppIcon from '../ui/AppIcon.vue'
import TextField from '../ui/form/TextField.vue'

// The Bead colors list's find and filter row (BeadColors card, ticket 0746): the search field and, in the narrow layout,
// the Filters disclosure with its count badge. The Palette popover's list and the converter's My beads view share it
// (ticket 0903); the list hides the disclosure where its filters stand in a column.
defineProps<{ filtersOnCount: number }>()
const query = defineModel<string>('query', { required: true })
const open = defineModel<boolean>('open', { required: true })

const { t } = useI18n()
const words = computed(() => t.value.palette.beadColors)
</script>

<template>
  <div class="bead-color-find">
    <TextField v-model="query" type="search" :aria-label="words.search" :placeholder="words.search" autocomplete="off" data-testid="bead-colors-search" />
    <button
      type="button"
      class="bead-color-find__toggle"
      :aria-expanded="open"
      :aria-label="filtersOnCount > 0 ? fillBlanks(words.filtersOn, { count: filtersOnCount }) : words.filters"
      data-testid="bead-colors-filters-toggle"
      @click="open = !open"
    >
      {{ words.filters }}
      <span v-if="filtersOnCount > 0" class="bead-color-find__badge" aria-hidden="true" data-testid="bead-colors-filters-badge">{{ filtersOnCount }}</span>
      <AppIcon :name="open ? 'chevron-up' : 'chevron-down'" :size="14" aria-hidden="true" />
    </button>
  </div>
</template>

<style scoped>
.bead-color-find {
  display: flex;
  gap: var(--space-8);
}

.bead-color-find :deep(.text-field) {
  flex: 1 1 auto;
  min-width: 0;
}

/* The Filters disclosure of the narrow layout: a field-height button beside the search, a count badge while values are on. */
.bead-color-find__toggle {
  display: inline-flex;
  flex: none;
  gap: var(--space-6);
  align-items: center;
  box-sizing: border-box;
  height: var(--field-height);
  padding: 0 var(--space-10);
  font: var(--type-control);
  color: var(--ink);
  background: var(--elevated);
  border: 1px solid var(--field-line);
  border-radius: var(--radius-md);
  cursor: pointer;
}

.bead-color-find__toggle:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: var(--focus-offset);
}

.bead-color-find__badge {
  box-sizing: border-box;
  min-width: var(--filter-badge);
  height: var(--filter-badge);
  padding: 0 var(--space-6);
  font: var(--type-meta-tiny);
  line-height: var(--filter-badge);
  color: var(--canvas);
  text-align: center;
  background: var(--ink);
  border-radius: var(--radius-full);
}
</style>
