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
import type { WhatWaits } from '../domain/waitingBuild'
import type { NotesSource } from '../services/notesFile'
import type { AppUpdates } from '../services/offlineShell'
import { shownDay, whatsNewView } from './whatsNew'

/** The coffee screen's What's new (tickets 0824, 0880, 1047, 1049; Homepage card): closed, its name, the maker's Version
 * and its date; open, what waits for Reload in a dashed box on top, the notes file of the language shown as blocks and
 * release lines (none when it can't be read), then Every change, `CHANGELOG.md`. It starts closed each time it is drawn. */
const props = defineProps<{
  /** Reads a language's notes file; none (a test) reads nothing, as a file that can't be read. */
  notes?: NotesSource
  /** Starts open and brought into view once its notes are drawn: "Update ready"'s What's new (ticket 1048). */
  startOpen?: boolean
  /** The Offline copy's update, as "Update ready" hears it (ticket 1049): what waits, and the Reload that takes it. */
  updates?: AppUpdates
}>()

const { t, locale } = useI18n()
const open = ref(props.startOpen === true)
const foldEl = ref<HTMLElement>()
const notesId = useId()
const built = computed(() => shownDay(BUILD_DATE, locale.value))

/** The notes file read for a language, null when it couldn't be (read again at the next open); none yet while read. */
const file = shallowRef<{ locale: Locale; notes: NotesFile | null }>()
watch([open, locale], async ([isOpen, shown]) => {
  if (!isOpen || (file.value?.locale === shown && file.value.notes)) return
  const notes = (await props.notes?.(shown)) ?? null
  if (locale.value === shown) file.value = { locale: shown, notes }
}, { immediate: true })
/** What waits, learned in a language through the toast's port, asked again in a language newly shown. */
const waits = shallowRef<{ locale: Locale; waits: WhatWaits }>()
watch(locale, (shown, _, onCleanup) => {
  const stop = props.updates?.onReady(() => shown, (answer) => (waits.value = { locale: shown, waits: answer }))
  if (stop) onCleanup(stop)
}, { immediate: true })
// No box when what waits can't be learned, or was learned in another language.
const waiting = computed(() => (waits.value && waits.value.waits !== 'unknown' && waits.value.locale === locale.value ? waits.value.waits : null))

// Only the file of the language shown: another's lines never show under this one's words while it is read.
const view = computed(() =>
  file.value?.notes && file.value.locale === locale.value ? whatsNewView(file.value.notes, waiting.value, locale.value) : null,
)
/** The blocks top to bottom, what waits first, so a waiting block is drawn as every other one is. */
const items = computed(() => [...(view.value?.waiting ? [{ block: view.value.waiting, waiting: true }] : []), ...(view.value?.items ?? [])])

/** The fold's top at the top of the room it scrolls in, when the fold doesn't fit in what shows of that room. */
function bringIntoView(fold: HTMLElement) {
  let room = fold.parentElement
  while (room && !/auto|scroll/.test(getComputedStyle(room).overflowY)) room = room.parentElement
  if (!room) return
  const [box, shows] = [fold.getBoundingClientRect(), room.getBoundingClientRect()]
  if (box.top >= shows.top && box.bottom <= shows.bottom) return
  // In the room's own px: the page's zoom and a section's turn scale it on screen.
  const scale = room.offsetHeight ? shows.height / room.offsetHeight : 1
  room.scrollTop += (box.top - shows.top) / scale - parseFloat(getComputedStyle(room).paddingTop || '0')
}

// Opened by the link, the fold is brought into view once, when its notes have made it as tall as it will be.
let broughtIntoView = false
watch(
  view,
  (shown) => {
    if (!shown || !props.startOpen || broughtIntoView || !foldEl.value) return
    broughtIntoView = true
    bringIntoView(foldEl.value)
  },
  { flush: 'post' },
)
</script>

<template>
  <section ref="foldEl" class="whats-new" :class="{ 'whats-new--open': open }" data-testid="homepage-whats-new">
    <button type="button" class="whats-new__head" :aria-expanded="open" :aria-controls="notesId" data-testid="homepage-whats-new-toggle" @click="open = !open">
      <AppIcon class="whats-new__icon" name="bead" :size="18" />
      <span class="whats-new__name">{{ t.homepage.whatsNew.name }}</span>
      <span class="whats-new__latest" data-testid="homepage-whats-new-latest"><span class="whats-new__build">{{ BUILD_VERSION }} ·</span> <time class="whats-new__build" :datetime="built.date">{{ built.when }}</time></span>
      <AppIcon class="whats-new__chevron" name="chevron-down" :size="16" />
    </button>
    <div v-show="open" :id="notesId" class="whats-new__body" data-testid="homepage-whats-new-notes">
      <template v-for="item in items" :key="'waiting' in item ? 'waiting' : 'block' in item ? item.block.version : `release ${item.release.version}`">
        <section
          v-if="'block' in item"
          class="whats-new__block"
          :class="{ 'whats-new__block--waiting': 'waiting' in item }"
          :aria-label="'waiting' in item ? t.homepage.whatsNew.arrives : undefined"
          :data-testid="'waiting' in item ? 'homepage-whats-new-waiting' : 'homepage-whats-new-block'"
        >
          <div class="whats-new__block-head">
            <span class="whats-new__version">{{ item.block.version }}</span>
            <time class="whats-new__date" :datetime="item.block.day.date">{{ item.block.day.when }}</time>
            <template v-if="'waiting' in item">
              <span class="whats-new__arrives">{{ t.homepage.whatsNew.arrives }}</span>
              <AppButton size="sm" class="whats-new__reload" data-testid="homepage-whats-new-reload" @click="updates?.apply()">{{ t.shell.updateReload }}</AppButton>
            </template>
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

/* What waits for Reload: a box of its own on top, its edge dashed as things not here yet are drawn. It reaches 12px
   past the fold's column on each side, so its lines start under the blocks' lines. */
.whats-new__block--waiting {
  margin: 0 calc(-1 * var(--space-12));
  padding: var(--space-10) var(--space-12) var(--space-12);
  background: var(--elevated);
  border: 1px dashed var(--line-strong);
  border-radius: var(--radius-md);
}

.whats-new__arrives {
  padding: var(--space-2) var(--space-8);
  font: var(--type-meta-small);
  color: var(--accent-strong);
  border: 1px solid var(--whats-new-arrives-edge);
  border-radius: var(--radius-full);
}

.whats-new__reload {
  margin-inline-start: auto;
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
