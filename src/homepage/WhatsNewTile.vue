<script setup lang="ts">
import { computed } from 'vue'
import AppButton from '../components/ui/AppButton.vue'
import { HISTORY_URL } from '../data/sourceLink'
import { useI18n } from '../i18n/useI18n'
import CoffeeScreenTile from './CoffeeScreenTile.vue'
import { whatsNew } from './whatsNew'

/** The coffee screen's What's new tile (ticket 0824; Homepage card): the three newest release notes in the language
 * shown, each its short date and its line, then Every change, the source's history in a new tab. */
const { t, locale } = useI18n()
const notes = computed(() => whatsNew(locale.value))
</script>

<template>
  <CoffeeScreenTile icon="bead" :name="t.homepage.whatsNew.name" data-testid="homepage-tile-whats-new">
    <ol class="whats-new__notes">
      <li v-for="note in notes" :key="`${note.date} ${note.line}`" class="whats-new__note" data-testid="homepage-release-note">
        <time class="whats-new__when" :datetime="note.date">{{ note.when }}</time>
        <span class="whats-new__line">{{ note.line }}</span>
      </li>
    </ol>
    <template #foot>
      <AppButton variant="link" trailing-icon="external" :href="HISTORY_URL" class="whats-new__history" data-testid="homepage-history">
        {{ t.homepage.whatsNew.history }}
      </AppButton>
    </template>
  </CoffeeScreenTile>
</template>

<style scoped>
/* The dates in one column as wide as the widest, each line beside its date, wrapping under itself. */
.whats-new__notes {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: var(--space-4) var(--space-8);
  margin: 0;
  padding: 0;
  list-style: none;
  font: var(--type-body);
  color: var(--body);
}

.whats-new__note {
  display: grid;
  grid-template-columns: subgrid;
  grid-column: 1 / -1;
  align-items: baseline;
}

.whats-new__when {
  font: var(--type-meta-small);
  font-variant-numeric: tabular-nums;
  color: var(--muted);
  white-space: nowrap;
}

/* Underlined in `faint` at rest (Homepage card), where a Link elsewhere underlines only on hover; the tile's class
   outweighs the Link's own `text-decoration: none`. */
.coffee-tile .whats-new__history {
  text-decoration: underline;
  text-decoration-color: var(--faint);
}
</style>
