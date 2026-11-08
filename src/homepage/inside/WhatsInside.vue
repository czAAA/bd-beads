<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import AppIcon from '../../components/ui/AppIcon.vue'
import { useMediaQuery } from '../../composables/ui/useMediaQuery'
import { fillBlanks } from '../../domain/fillBlanks'
import { useI18n } from '../../i18n/useI18n'
import type { InsideRowId } from '../../i18n/translations'
import GroupedList from '../GroupedList.vue'
import InsideEditor from './InsideEditor.vue'
import { TourStopped } from './hand'
import { INSIDE_ROWS, insideRows } from './insideCopy'
import { scrollToShow } from './tabScroll'
import { TOUR_SCRIPTS } from './tourScripts'
import { useInsideTour } from './useInsideTour'

// What's inside (Homepage card, tickets 0797, 0825): a band on top holds the heading, the rows as tabs and the playing
// row's caption; the framed editor under it fills the rest and plays each row in turn. On a phone there is no editor:
// the rows are one grouped list, each with its line (ticket 0827).
const props = defineProps<{
  /** Whether there is room for the editor: none on a phone. */
  withEditor: boolean
  /** Whether What's inside is the section shown: the tour plays only then. */
  shown: boolean
}>()

const { t, locale } = useI18n()
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

/** The tabs scroll sideways to keep the playing one in view, `scroll-padding` clear of the edge; only they scroll, never
 * the section, which the beader may have scrolled to see the editor whole. */
const tabsEl = ref<HTMLElement>()
watch(tour.playing, (row) => {
  const tabs = tabsEl.value
  const tab = row ? tabs?.querySelector<HTMLElement>(`[data-testid="inside-row-${row}"]`) : undefined
  if (!tabs || !tab) return
  const room = Number.parseFloat(getComputedStyle(tabs).scrollPaddingInlineStart) || 0
  const left = scrollToShow({ left: tabs.scrollLeft, width: tabs.clientWidth }, { left: tab.offsetLeft, width: tab.offsetWidth }, room)
  if (left !== tabs.scrollLeft) tabs.scrollTo?.({ left, behavior: reducedMotion.value ? 'instant' : 'smooth' })
})

/** A row pressed plays from there, even after the beader took the editor over. */
function choose(row: InsideRowId) {
  tour.choose(row)
}
</script>

<template>
  <!-- Named by its own heading, which sits in the band (ticket 0825), as the plans name theirs. -->
  <section class="inside" aria-labelledby="homepage-inside" data-testid="whats-inside">
    <template v-if="withEditor">
      <div class="inside__band" data-testid="inside-band">
        <div class="inside__head">
          <h2 id="homepage-inside" class="inside__heading">{{ t.homepage.whatsInside }}</h2>
          <ul ref="tabsEl" class="inside__tabs" data-testid="inside-list">
            <li v-for="row in rows" :key="row.id">
              <button
                type="button"
                class="inside__tab"
                :class="{ 'inside__tab--playing': row.id === tour.playing.value }"
                :aria-current="row.id === tour.playing.value ? 'step' : undefined"
                :aria-describedby="`inside-line-${row.id}`"
                :data-testid="`inside-row-${row.id}`"
                @click="choose(row.id)"
              >
                <AppIcon class="inside__tab-icon" :name="row.icon" :size="18" />
                <span>{{ row.name }}</span>
              </button>
            </li>
          </ul>
        </div>
        <!-- Every row's caption in one cell, the one shown on top: the band keeps the tallest's height, so the editor
             under it never changes size as the tour plays. -->
        <div class="inside__caption" data-testid="inside-caption">
          <p
            v-for="(row, index) in rows"
            :key="row.id"
            class="inside__caption-row"
            :class="{ 'inside__caption-row--shown': row.id === tour.captioned.value }"
            :data-testid="row.id === tour.captioned.value ? 'inside-caption-shown' : undefined"
          >
            <AppIcon class="inside__caption-icon" :name="row.icon" :size="18" />
            <span class="inside__caption-words">
              <span class="inside__caption-name">{{ row.name }}</span>
              <span :id="`inside-line-${row.id}`" class="inside__caption-line">{{ row.text }}</span>
            </span>
            <span class="inside__caption-place">{{ fillBlanks(t.homepage.inside.place, { at: index + 1, count: rows.length }) }}</span>
          </p>
        </div>
      </div>
      <InsideEditor ref="editor" class="inside__editor" :taken-over="tour.takenOver.value" @take-over="tour.takeOver" />
    </template>

    <template v-else>
      <h2 id="homepage-inside" class="inside__heading">{{ t.homepage.whatsInside }}</h2>
      <GroupedList :rows="rows" testid="inside-list" row-testid="inside-row" />
    </template>
  </section>
</template>

<style scoped>
.inside {
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
  min-height: 0;
}

.inside__tabs {
  margin: 0;
  padding: 0;
  list-style: none;
}

.inside__heading {
  flex: none;
  margin: 0;
  font: var(--type-serif-heading);
  letter-spacing: var(--tracking-serif-heading);
  color: var(--ink);
}

/* The band: its own background, never the canvas grid; the heading over the tabs under 1000px, beside them from it. */
.inside__band {
  display: flex;
  flex: none;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
  padding: var(--space-10) var(--space-12);
  background: var(--box);
  border: 1px solid var(--panel-rule);
  border-radius: var(--radius-lg);
}

.inside__head {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  min-width: 0;
}

@container homepage (min-width: 1000px) {
  .inside__band {
    padding: var(--space-8) var(--space-10) var(--space-8) var(--space-16);
  }

  .inside__head {
    flex-direction: row;
    gap: var(--space-16);
    align-items: center;
  }
}

/* The rows in one line, taking what the heading leaves and scrolling sideways with no scroll bar. */
.inside__tabs {
  position: relative;
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  overflow: auto hidden;
  scroll-padding-inline: var(--space-24);
  scrollbar-width: none;
}

.inside__tabs::-webkit-scrollbar {
  display: none;
}

.inside__tabs > li {
  flex: none;
}

.inside__tab {
  position: relative;
  display: flex;
  gap: var(--space-10);
  align-items: center;
  padding: 5px var(--space-10);
  font: var(--type-control);
  color: var(--muted);
  white-space: nowrap;
  background: none;
  border: 0;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition:
    background var(--duration-fast) var(--ease-standard),
    color var(--duration-fast) var(--ease-standard);
}

.inside__tab:hover {
  color: var(--ink);
  background: var(--hover-fill);
}

.inside__tab:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: -2px;
}

/* The row playing: a 2px `accent` bar along its foot, its icon `accent-strong`, its name `ink`. */
.inside__tab--playing {
  color: var(--ink);
}

.inside__tab--playing::after {
  content: '';
  position: absolute;
  right: var(--space-10);
  bottom: 0;
  left: var(--space-10);
  height: 2px;
  background: var(--accent);
  border-radius: var(--radius-full);
}

.inside__tab--playing .inside__tab-icon,
.inside__caption-icon {
  color: var(--accent-strong);
}

/* The caption: the playing row's icon, name, line and place. */
.inside__caption {
  display: grid;
}

.inside__caption-row {
  display: flex;
  grid-area: 1 / 1;
  gap: var(--space-10);
  align-items: center;
  min-width: 0;
  min-height: var(--space-24);
  margin: 0;
  padding: var(--space-2) var(--space-10) var(--space-2) 0;
  visibility: hidden;
}

.inside__caption-row--shown {
  visibility: visible;
}

.inside__caption-icon {
  flex: none;
}

.inside__caption-words {
  display: flex;
  flex: 1 1 auto;
  flex-wrap: wrap;
  column-gap: var(--space-10);
  align-items: baseline;
  min-width: 0;
}

.inside__caption-name {
  font: var(--type-control);
  color: var(--ink);
  white-space: nowrap;
}

.inside__caption-line {
  min-width: 0;
  font: var(--type-inside-line);
  color: var(--body);
}

.inside__caption-place {
  flex: none;
  margin-left: auto;
  font: var(--type-meta-small);
  color: var(--muted);
  white-space: nowrap;
}

/* The demo framed as a window onto the editor, not the page's canvas; it fills the rest of the section's room. */
.inside__editor {
  flex: 1 1 auto;
  min-height: var(--inside-main-least-height);
  border: 1px solid var(--inside-frame-edge);
  box-shadow: var(--inside-frame-shadow);
}
</style>
