<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import AppButton from '../components/ui/AppButton.vue'
import AppIcon from '../components/ui/AppIcon.vue'
import { HISTORY_URL } from '../data/sourceLink'
import { useI18n } from '../i18n/useI18n'
import { whatsNew } from './whatsNew'

/** The coffee screen's What's new (tickets 0824, 0880; Homepage card): one row under the band, closed, showing its name
 * and the newest note's date; a click on it opens the three newest release notes in the language shown, each its short
 * date and its line, then Every change, the source's history in a new tab. It starts closed each time it is drawn. */
const { t, locale } = useI18n()
const notes = computed(() => whatsNew(locale.value))
const open = ref(false)
const notesId = useId()
</script>

<template>
  <section class="whats-new" :class="{ 'whats-new--open': open }" data-testid="homepage-whats-new">
    <button type="button" class="whats-new__head" :aria-expanded="open" :aria-controls="notesId" data-testid="homepage-whats-new-toggle" @click="open = !open">
      <AppIcon class="whats-new__icon" name="bead" :size="18" />
      <span class="whats-new__name">{{ t.homepage.whatsNew.name }}</span>
      <time v-if="notes[0]" class="whats-new__latest" :datetime="notes[0].date">{{ notes[0].when }}</time>
      <AppIcon class="whats-new__chevron" name="chevron-down" :size="16" />
    </button>
    <div v-show="open" :id="notesId" class="whats-new__body" data-testid="homepage-whats-new-notes">
      <ol class="whats-new__notes">
        <li v-for="note in notes" :key="`${note.date} ${note.line}`" class="whats-new__note" data-testid="homepage-release-note">
          <time class="whats-new__when" :datetime="note.date">{{ note.when }}</time>
          <span class="whats-new__line">{{ note.line }}</span>
        </li>
      </ol>
      <AppButton variant="link" trailing-icon="external" :href="HISTORY_URL" class="whats-new__history" data-testid="homepage-history">
        {{ t.homepage.whatsNew.history }}
      </AppButton>
    </div>
  </section>
</template>

<style scoped>
/* As wide as the band: `panel` fill, a 1px `panel-line` edge, `radius-lg`. */
.whats-new {
  box-sizing: border-box;
  width: 100%;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: var(--radius-lg);
}

/* The whole row is the button: the icon, the name, the newest date, and the chevron at the far end. */
.whats-new__head {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  box-sizing: border-box;
  width: 100%;
  min-height: var(--touch-target);
  padding: var(--space-8) var(--homepage-tile-inset);
  font: var(--type-inside-name);
  color: var(--ink);
  text-align: start;
  background: transparent;
  border: 0;
  border-radius: inherit;
  cursor: pointer;
}

.whats-new__head:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: var(--focus-offset);
}

.whats-new__icon {
  flex: none;
  color: var(--accent-strong);
}

.whats-new__latest {
  font: var(--type-meta-small);
  font-variant-numeric: tabular-nums;
  color: var(--muted);
  white-space: nowrap;
}

.whats-new__chevron {
  flex: none;
  margin-inline-start: auto;
  color: var(--muted);
  transition: transform var(--duration-fast) var(--ease-standard);
}

.whats-new--open .whats-new__chevron {
  transform: rotate(180deg);
}

.whats-new__body {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-8);
  padding: 0 var(--homepage-tile-inset) var(--space-16);
}

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

/* Underlined in `faint` at rest (Homepage card), where a Link elsewhere underlines only on hover; the row's class
   outweighs the Link's own `text-decoration: none`. */
.whats-new .whats-new__history {
  text-decoration: underline;
  text-decoration-color: var(--faint);
}

@media (prefers-reduced-motion: reduce) {
  .whats-new__chevron {
    transition: none;
  }
}
</style>
