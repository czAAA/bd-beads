<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import AppIcon from '../../components/ui/AppIcon.vue'
import { useMediaQuery } from '../../composables/ui/useMediaQuery'
import { useI18n } from '../../i18n/useI18n'
import type { InsideRowId } from '../../i18n/translations'
import InsideEditor from './InsideEditor.vue'
import { TourStopped } from './hand'
import { INSIDE_ROWS, insideCards, insideRows } from './insideCopy'
import { TOUR_SCRIPTS } from './tourScripts'
import { useInsideTour } from './useInsideTour'

// What's inside (Homepage card, ticket 0797): four quiet cards, then the list of what's inside beside the editor, which
// plays each row in turn. On a tablet the list is a row of tabs above the editor; on a phone there is no editor and the
// list is plain, with every row's line.
const props = defineProps<{
  /** Whether there is room for the editor: none on a phone. */
  withEditor: boolean
  /** Whether What's inside is the section shown: the tour plays only then. */
  shown: boolean
}>()

const { t, locale } = useI18n()
const cards = computed(() => insideCards(t.value))
const rows = computed(() => insideRows(t.value, locale.value))
const editor = shallowRef<InstanceType<typeof InsideEditor>>()
const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

/** Whether the page is in view at all: the tour pauses with it. */
const pageVisible = ref(typeof document === 'undefined' || document.visibilityState !== 'hidden')
const onVisibility = () => (pageVisible.value = document.visibilityState !== 'hidden')
onMounted(() => document.addEventListener('visibilitychange', onVisibility))
onBeforeUnmount(() => document.removeEventListener('visibilitychange', onVisibility))

const tour = useInsideTour({
  rows: INSIDE_ROWS.map((row) => row.id),
  fresh: async () => editor.value?.fresh(),
  hand: (instant, signal) => editor.value!.hand(instant, signal),
  play: async (row, hand) => {
    await TOUR_SCRIPTS[row](hand)
    editor.value?.giveFocusBack()
  },
  hideGhost: () => editor.value?.hideGhost(),
  reducedMotion: () => reducedMotion.value,
  isStop: (error) => error instanceof TourStopped,
})
tour.follow(() => props.withEditor && props.shown && pageVisible.value && !!editor.value)

/** The list keeps the playing row in view where it scrolls. */
const listEl = ref<HTMLElement>()
watch(tour.playing, (row) => {
  if (row) listEl.value?.querySelector(`[data-testid="inside-row-${row}"]`)?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
})

/** A row pressed plays from there, even after the beader took the editor over. */
function choose(row: InsideRowId) {
  tour.choose(row)
}
</script>

<template>
  <div class="inside" :class="{ 'inside--plain': !props.withEditor }" data-testid="whats-inside">
    <ul class="inside__cards" data-testid="inside-cards">
      <li v-for="card in cards" :key="card.id" class="inside__card" :data-testid="`inside-card-${card.id}`">
        <AppIcon class="inside__card-icon" :name="card.icon" :size="18" />
        <strong class="inside__card-name">{{ card.name }}</strong>
        <span class="inside__card-text">{{ card.text }}</span>
      </li>
    </ul>

    <div v-if="withEditor" class="inside__main">
      <ul ref="listEl" class="inside__list" data-testid="inside-list">
        <li v-for="row in rows" :key="row.id">
          <button
            type="button"
            class="inside__row"
            :class="{ 'inside__row--playing': row.id === tour.playing.value }"
            :aria-current="row.id === tour.playing.value ? 'step' : undefined"
            :data-testid="`inside-row-${row.id}`"
            @click="choose(row.id)"
          >
            <AppIcon class="inside__row-icon" :name="row.icon" :size="18" />
            <span class="inside__row-words">
              <span class="inside__row-name">{{ row.name }}</span>
              <span v-if="row.id === tour.playing.value" class="inside__row-text">{{ row.text }}</span>
            </span>
          </button>
        </li>
      </ul>
      <InsideEditor ref="editor" class="inside__editor" :taken-over="tour.takenOver.value" @take-over="tour.takeOver" />
    </div>

    <ul v-else class="inside__plain" data-testid="inside-list">
      <li v-for="row in rows" :key="row.id" class="inside__plain-row" :data-testid="`inside-row-${row.id}`">
        <AppIcon class="inside__row-icon" :name="row.icon" :size="18" />
        <span class="inside__row-words">
          <span class="inside__row-name">{{ row.name }}</span>
          <span class="inside__row-text">{{ row.text }}</span>
        </span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.inside {
  display: flex;
  flex-direction: column;
  gap: var(--space-16);
  min-height: 0;
}

.inside__cards,
.inside__list,
.inside__plain {
  margin: 0;
  padding: 0;
  list-style: none;
}

/* Four quiet tiles that never play and take no press: four in a row from 1024, two by two from 481, one column below. */
.inside__cards {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-12);
}

@container homepage (min-width: 481px) {
  .inside__cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@container homepage (min-width: 1024px) {
  .inside__cards {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

.inside__card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  grid-template-rows: auto 1fr;
  column-gap: var(--space-10);
  row-gap: var(--space-2);
  box-sizing: border-box;
  padding: 11px 14px;
  background: var(--panel);
  border: 1px solid var(--panel-rule);
  border-radius: var(--radius-lg);
}

@container homepage (min-width: 481px) {
  .inside__card {
    height: var(--inside-card-height);
    overflow: hidden;
  }
}

.inside__card-icon {
  grid-row: 1 / span 2;
  color: var(--muted);
}

.inside__card-name {
  overflow: hidden;
  font: var(--type-inside-name);
  color: var(--ink);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.inside__card-text {
  font: var(--type-inside-text);
  color: var(--body);
}

/* From 481 a card is `--inside-card-height` tall: its text up to three lines. On a phone it is as tall as its text. */
@container homepage (min-width: 481px) {
  .inside__card-text {
    display: -webkit-box;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
  }
}

/* The list beside the editor, which fills the section's height. */
.inside__main {
  display: grid;
  flex: 1 1 auto;
  grid-template-columns: var(--inside-list-width) minmax(0, 1fr);
  gap: var(--space-16);
  min-height: var(--inside-main-min-height);
}

.inside__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-height: 0;
  overflow: auto;
}

.inside__row {
  position: relative;
  display: grid;
  grid-template-columns: 1.125rem minmax(0, 1fr);
  column-gap: var(--space-10);
  align-items: center;
  box-sizing: border-box;
  width: 100%;
  padding: 5px var(--space-10);
  font: var(--type-control);
  color: var(--muted);
  text-align: start;
  background: none;
  border: 0;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition:
    background var(--duration-fast) var(--ease-standard),
    color var(--duration-fast) var(--ease-standard);
}

.inside__row:hover {
  color: var(--ink);
  background: var(--hover-fill);
}

.inside__row:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: -2px;
}

/* The row playing: on `panel`, a 2px `accent` bar at its left, its icon `accent-strong`, its line under its name. */
.inside__row--playing {
  color: var(--ink);
  background: var(--panel);
}

.inside__row--playing::before {
  content: '';
  position: absolute;
  top: 7px;
  bottom: 7px;
  left: 0;
  width: 2px;
  background: var(--accent);
  border-radius: var(--radius-full);
}

.inside__row--playing .inside__row-icon {
  color: var(--accent-strong);
}

.inside__row-words {
  display: contents;
}

.inside__row-name {
  min-width: 0;
}

.inside__row-text {
  grid-column: 2;
  margin-top: 2px;
  font: var(--type-inside-line);
  color: var(--body);
}

.inside__editor {
  min-height: 0;
}

/* On a tablet the list is a row of tabs above the editor: the names alone, scrolling sideways. */
@container homepage (max-width: 1023.98px) {
  .inside__main {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr);
    gap: var(--space-8);
  }

  .inside__list {
    flex-direction: row;
    overflow: auto hidden;
    scrollbar-width: none;
  }

  .inside__list::-webkit-scrollbar {
    display: none;
  }

  .inside__list > li {
    flex: none;
  }

  .inside__row {
    white-space: nowrap;
  }

  .inside__row--playing::before {
    top: auto;
    right: var(--space-10);
    bottom: 0;
    left: var(--space-10);
    width: auto;
    height: 2px;
  }

  .inside__row .inside__row-text {
    display: none;
  }
}

/* The phone's plain list: every row with its icon, its name and its line, nothing to press. */
.inside__plain {
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
}

.inside__plain-row {
  display: grid;
  grid-template-columns: 1.125rem minmax(0, 1fr);
  column-gap: var(--space-10);
  align-items: start;
  font: var(--type-control);
  color: var(--ink);
}

.inside__plain-row .inside__row-icon {
  color: var(--muted);
}
</style>
