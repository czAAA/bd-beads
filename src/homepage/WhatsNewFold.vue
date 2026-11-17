<script setup lang="ts">
import { computed, ref, shallowRef, useId, watch } from 'vue'
import AppButton from '../components/ui/AppButton.vue'
import AppIcon from '../components/ui/AppIcon.vue'
import KindLabel from '../components/ui/KindLabel.vue'
import { BUILD_DATE, BUILD_VERSION } from '../data/build'
import { CHANGELOG_URL } from '../data/sourceLink'
import { fillBlanks } from '../domain/fillBlanks'
import type { Locale } from '../domain/locale'
import type { NotesFile } from '../domain/notesFile'
import { useI18n } from '../i18n/useI18n'
import type { NotesSource } from '../services/notesFile'
import { shownDay, whatsNewView } from './whatsNew'

/** The coffee screen's What's new (tickets 0824, 0880, 1047; Homepage card): closed, its name, the maker's Version and its
 * date; open, the notes file of the language shown as blocks and release lines (none when it can't be read), then
 * Every change, `CHANGELOG.md`. It starts closed each time it is drawn. */
const props = defineProps<{
  /** Reads a language's notes file; none (a test) reads nothing, as a file that can't be read. */
  notes?: NotesSource
}>()

const { t, locale } = useI18n()
const open = ref(false)
const notesId = useId()
const built = computed(() => shownDay(BUILD_DATE, locale.value))

/** The notes file read for a language, null when it couldn't be; none yet while it is being read. */
const file = shallowRef<{ locale: Locale; notes: NotesFile | null }>()
watch([open, locale], async ([isOpen, shown]) => {
  if (!isOpen || file.value?.locale === shown) return
  const notes = (await props.notes?.(shown)) ?? null
  if (locale.value === shown) file.value = { locale: shown, notes }
})
const view = computed(() => (file.value?.notes ? whatsNewView(file.value.notes, [], locale.value) : null))
</script>

<template>
  <section class="whats-new" :class="{ 'whats-new--open': open }" data-testid="homepage-whats-new">
    <button type="button" class="whats-new__head" :aria-expanded="open" :aria-controls="notesId" data-testid="homepage-whats-new-toggle" @click="open = !open">
      <AppIcon class="whats-new__icon" name="bead" :size="18" />
      <span class="whats-new__name">{{ t.homepage.whatsNew.name }}</span>
      <span class="whats-new__latest" data-testid="homepage-whats-new-latest"><span class="whats-new__build">{{ BUILD_VERSION }} ·</span> <time class="whats-new__build" :datetime="built.date">{{ built.when }}</time></span>
      <AppIcon class="whats-new__chevron" name="chevron-down" :size="16" />
    </button>
    <div v-show="open" :id="notesId" class="whats-new__body" data-testid="homepage-whats-new-notes">
      <template v-for="item in view?.items ?? []" :key="'block' in item ? item.block.version : `release ${item.release.version}`">
        <section v-if="'block' in item" class="whats-new__block" data-testid="homepage-whats-new-block">
          <div class="whats-new__block-head">
            <span class="whats-new__version">{{ item.block.version }}</span>
            <time class="whats-new__date" :datetime="item.block.day.date">{{ item.block.day.when }}</time>
          </div>
          <ol class="whats-new__notes">
            <li v-for="row in item.block.rows" :key="row.name" class="whats-new__note" :class="{ 'whats-new__note--next-kind': row.nextKind }" data-testid="homepage-release-note">
              <KindLabel class="whats-new__kind" :kind="row.kind" />
              <span class="whats-new__line">{{ row.line }}</span>
            </li>
          </ol>
        </section>
        <div v-else class="whats-new__release" data-testid="homepage-whats-new-release">
          <span class="whats-new__release-name">{{ fillBlanks(t.homepage.whatsNew.release, { version: item.release.version }) }}</span>
          <time :datetime="item.release.day.date">{{ item.release.day.when }}</time>
          <span class="whats-new__rule" aria-hidden="true" />
        </div>
      </template>
      <AppButton variant="link" trailing-icon="external" :href="CHANGELOG_URL" class="whats-new__history" data-testid="homepage-history">
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

/* The whole row is the button: the icon, the name, the Version and its date, and the chevron at the far end. */
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

/* The name keeps its line; on the narrowest phones the date goes under the Version rather than the name wrapping. */
.whats-new__name {
  flex: none;
}

.whats-new__latest {
  min-width: 0;
  font: var(--type-meta-small);
  font-variant-numeric: tabular-nums;
  color: var(--muted);
}

.whats-new__build {
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

/* One grid for the whole fold, so every kind label stands in one column as wide as the widest, each line beside it. */
.whats-new__body {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: var(--space-20) var(--space-10);
  padding: var(--space-4) var(--homepage-tile-inset) var(--space-16);
}

.whats-new__block {
  display: grid;
  grid-template-columns: subgrid;
  grid-column: 1 / -1;
  row-gap: var(--space-8);
}

/* A block's heading: the highest Version in it and the day of its newest note. */
.whats-new__block-head {
  display: flex;
  flex-wrap: wrap;
  grid-column: 1 / -1;
  align-items: center;
  gap: var(--space-4) var(--space-10);
  min-height: var(--control-height-sm);
}

.whats-new__version {
  font: var(--type-inside-name);
  font-variant-numeric: tabular-nums;
  color: var(--ink);
}

.whats-new__date {
  font: var(--type-meta-small);
  font-variant-numeric: tabular-nums;
  color: var(--muted);
  white-space: nowrap;
}

.whats-new__notes {
  display: grid;
  grid-template-columns: subgrid;
  grid-column: 1 / -1;
  row-gap: var(--space-4);
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

.whats-new__kind {
  justify-self: start;
}

/* The first row of a kind after another kind: the gap between kinds. */
.whats-new__note--next-kind {
  margin-top: var(--space-10);
}

/* A Production release: "Release 2.0.0", its day, then a rule to the far edge, above the blocks it released. */
.whats-new__release {
  display: flex;
  grid-column: 1 / -1;
  align-items: center;
  gap: var(--space-10);
  font: var(--type-meta-small);
  font-variant-numeric: tabular-nums;
  color: var(--muted);
  white-space: nowrap;
}

.whats-new__release-name {
  color: var(--ink);
}

.whats-new__rule {
  flex: 1 1 auto;
  height: 1px;
  background: var(--line-strong);
}

/* Underlined in `faint` at rest (Homepage card), where a Link elsewhere underlines only on hover; the row's class
   outweighs the Link's own `text-decoration: none`. */
.whats-new .whats-new__history {
  grid-column: 1 / -1;
  justify-self: start;
  text-decoration: underline;
  text-decoration-color: var(--faint);
}

@media (prefers-reduced-motion: reduce) {
  .whats-new__chevron {
    transition: none;
  }
}
</style>
