<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import AppButton from '../../components/ui/AppButton.vue'
import AppIcon from '../../components/ui/AppIcon.vue'
import { useMediaQuery } from '../../composables/ui/useMediaQuery'
import { fillBlanks } from '../../domain/fillBlanks'
import { useI18n } from '../../i18n/useI18n'
import type { DemoSnapshot } from '../demoCopy'
import GroupedList from '../GroupedList.vue'
import InsideEditor from './InsideEditor.vue'
import { TourStopped } from './hand'
import { INSIDE_ROWS, insideChapters, type InsideChapter } from './insideCopy'
import { scrollToShow } from './tabScroll'
import { TOUR_SCRIPTS } from './tourScripts'
import { useInsideTour } from './useInsideTour'

// What's inside (Homepage card, tickets 0797, 0825, 0830, 0879): the heading, chapters, caption, Pause and Open editor
// from here, in a list beside the framed demo editor from 1000px and in a band over it under that or while expanded. The
// editor plays the 13 rows in turn, only to watch. On a phone there is no editor: the rows are one list.
const props = defineProps<{
  /** Whether there is room for the editor: none on a phone. */
  withEditor: boolean
  /** Whether What's inside is the section shown: the tour plays only then. */
  shown: boolean
  /** Whether the box is 1000px wide or more: the list stands beside the demo, which offers Expand. */
  wide: boolean
}>()
const emit = defineEmits<{
  /** Open editor from here (ticket 0879): what the demo shows at the press, for the page to keep and open; none before
   * the demo has a Project. */
  openFromHere: [snapshot: DemoSnapshot | undefined]
}>()

const { t, locale } = useI18n()
const chapters = computed(() => insideChapters(t.value, locale.value))
const rows = computed(() => chapters.value.flatMap((chapter) => chapter.rows))
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

/** The chapter whose row is playing: the one lit. */
const lit = computed(() => chapters.value.find((chapter) => chapter.rows.some((row) => row.id === tour.playing.value))?.id)

/** The demo has the section's whole width for this visit (Expand): the list's parts sit in the band over it. */
const expanded = ref(false)
const layout = computed(() => (props.wide && !expanded.value ? 'beside' : 'band'))
/** Which word the demo strip's button reads; none under 1000px, where the demo has the width already. */
const expand = computed(() => (props.wide ? (expanded.value ? 'collapse' : 'expand') : undefined))

/** In the band the chapters scroll sideways to keep the lit one in view, `scroll-padding` clear of the edge; only they
 * scroll, never the section, which the beader may have scrolled to see the editor whole. */
const chaptersEl = ref<HTMLElement>()
watch(lit, (id) => {
  const list = chaptersEl.value
  const chapter = id ? list?.querySelector<HTMLElement>(`[data-testid="inside-chapter-${id}"]`) : undefined
  if (!list || !chapter) return
  const room = Number.parseFloat(getComputedStyle(list).scrollPaddingInlineStart) || 0
  const left = scrollToShow({ left: list.scrollLeft, width: list.clientWidth }, { left: chapter.offsetLeft, width: chapter.offsetWidth }, room)
  if (left !== list.scrollLeft) list.scrollTo?.({ left, behavior: reducedMotion.value ? 'instant' : 'smooth' })
})

/** A chapter pressed plays from its first row, even paused. Under reduced motion, where nothing plays on, a press on the
 * lit chapter shows its next row, round to its first. */
function choose(chapter: InsideChapter) {
  const ids = chapter.rows.map((row) => row.id)
  const shown = tour.playing.value ? ids.indexOf(tour.playing.value) : -1
  tour.choose(reducedMotion.value && shown >= 0 ? ids[(shown + 1) % ids.length]! : ids[0]!)
}

/** Pause, or Play while paused. */
function onPause() {
  if (tour.paused.value) tour.resume()
  else tour.pause()
}

/** Open editor from here (ticket 0879): what the demo shows is taken at the press, then the tour stops, the ghost hidden.
 * Once only: the page is leaving, and a second press would keep a second copy. */
let leaving = false
async function openFromHere() {
  if (leaving) return
  leaving = true
  const taken = editor.value?.snapshot()
  tour.pause()
  emit('openFromHere', await taken)
}

/** Expand or Collapse: the demo's size changes at once. */
function toggleExpand() {
  expanded.value = !expanded.value
}

/** The demo's size changed (Expand, Collapse, or the page crossing 1000px). A playing row starts again in the new size; a
 * paused tour only has its view set again. */
watch(layout, async () => {
  await nextTick()
  if (tour.playing.value && !tour.paused.value) tour.choose(tour.playing.value)
  else await editor.value?.refit()
})
</script>

<template>
  <!-- Named by its own heading, which sits in the list or the band (ticket 0825), as the plans name theirs. -->
  <section
    class="inside"
    :class="withEditor ? [`inside--${layout}`, { 'inside--wide': wide }] : undefined"
    aria-labelledby="homepage-inside"
    data-testid="whats-inside"
    :data-layout="withEditor ? layout : undefined"
  >
    <template v-if="withEditor">
      <div class="inside__guide" data-testid="inside-guide">
        <h2 id="homepage-inside" class="inside__heading">{{ t.homepage.whatsInside }}</h2>
        <ul ref="chaptersEl" class="inside__chapters" data-testid="inside-chapters">
          <li v-for="chapter in chapters" :key="chapter.id">
            <button
              type="button"
              class="inside__chapter"
              :class="{ 'inside__chapter--lit': chapter.id === lit }"
              :aria-current="chapter.id === lit ? 'step' : undefined"
              :aria-describedby="`inside-rows-${chapter.id}`"
              :data-testid="`inside-chapter-${chapter.id}`"
              @click="choose(chapter)"
            >
              <AppIcon class="inside__chapter-icon" :name="chapter.icon" :size="18" />
              <span>{{ chapter.name }}</span>
            </button>
            <span :id="`inside-rows-${chapter.id}`" hidden>{{ chapter.describes }}</span>
          </li>
        </ul>
        <!-- Each button keeps the width of the wider word it reads, which its `data-other` holds. -->
        <div class="inside__controls">
          <AppButton v-if="!reducedMotion" class="inside__control" size="sm" data-testid="inside-pause" @click="onPause">
            <span class="inside__word" :data-other="tour.paused.value ? t.homepage.inside.pause : t.homepage.inside.play">{{
              tour.paused.value ? t.homepage.inside.play : t.homepage.inside.pause
            }}</span>
          </AppButton>
          <AppButton class="inside__control" size="sm" data-testid="inside-open-from-here" @click="openFromHere">{{ t.homepage.inside.openFromHere }}</AppButton>
        </div>
        <!-- Every row's caption in one cell, the one shown on top: it keeps the tallest's height, so nothing moves and
             the editor never changes size as the tour plays. Not a live region: it would speak every few seconds. -->
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
              <span class="inside__caption-line">{{ row.text }}</span>
            </span>
            <span class="inside__caption-place">{{ fillBlanks(t.homepage.inside.place, { at: index + 1, count: rows.length }) }}</span>
          </p>
        </div>
      </div>
      <InsideEditor ref="editor" class="inside__editor" :expand="expand" @toggle-expand="toggleExpand" />
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

/* From 1000px, collapsed: the list on the demo's left, as tall as it. The row is as tall as the section's room and never
 * shorter than the list's parts or the demo's least height: on a shorter screen the section scrolls inside itself. */
.inside--beside {
  display: grid;
  grid-template-rows: minmax(min-content, 1fr);
  grid-template-columns: var(--inside-list-width) minmax(0, 1fr);
}

.inside__heading {
  flex: none;
  margin: 0;
  font: var(--type-serif-heading);
  letter-spacing: var(--tracking-serif-heading);
  color: var(--ink);
}

/* The list or the band: its own background, never the canvas grid. As a band under 1000px: the heading over the
 * chapters, Pause and Open editor from here at the end of their line or under it, the caption under them. */
.inside__guide {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-12);
  align-items: center;
  min-width: 0;
  padding: var(--space-10) var(--space-12);
  background: var(--box);
  border: 1px solid var(--panel-rule);
  border-radius: var(--radius-lg);
}

.inside--band .inside__heading {
  flex: 0 0 100%;
  margin-bottom: var(--space-6);
}

/* The chapters in one line, taking what is left and scrolling sideways with no scroll bar. */
.inside__chapters {
  position: relative;
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
  padding: 0;
  overflow: auto hidden;
  list-style: none;
  scroll-padding-inline: var(--space-24);
  scrollbar-width: none;
}

.inside__chapters::-webkit-scrollbar {
  display: none;
}

.inside__chapters > li {
  flex: none;
}

.inside__controls {
  display: flex;
  flex: none;
  gap: var(--space-8);
  margin-left: auto;
}

/* `--control-height-small`, 28px, under AppButton's own small height. */
.inside .inside__control {
  height: var(--control-height-small);
}

/* Pause and Play in one cell, the one not read hidden: the button keeps the wider word's width. */
.inside__word {
  display: inline-grid;
}

.inside__word::after {
  content: attr(data-other);
  grid-area: 1 / 1;
  height: 0;
  visibility: hidden;
}

.inside__caption {
  display: grid;
  flex: 0 0 100%;
  min-width: 0;
}

/* The band from 1000px (the demo expanded): padding 8 10 8 16, the heading, the chapters and the buttons on one line. */
.inside--band.inside--wide .inside__guide {
  column-gap: var(--space-16);
  padding: var(--space-8) var(--space-10) var(--space-8) var(--space-16);
}

.inside--band.inside--wide .inside__heading {
  flex: none;
  margin-bottom: 0;
}

.inside--band.inside--wide .inside__chapters {
  flex: 1 1 0;
}

/* The list: padding 12 16 16; the heading, 8px under it the chapters one under another, a hairline with 12px over and
 * under it, the caption, and at its foot Pause and Open editor from here, the second under the first where the words
 * don't fit beside it. */
.inside--beside .inside__guide {
  flex-flow: column nowrap;
  gap: 0;
  align-items: stretch;
  padding: var(--space-12) var(--space-16) var(--space-16);
}

.inside--beside .inside__chapters {
  flex: none;
  flex-direction: column;
  margin-top: var(--space-8);
  overflow: visible;
}

.inside--beside .inside__caption {
  flex: none;
  margin-top: var(--space-12);
  padding-top: var(--space-12);
  border-top: 1px solid var(--panel-rule);
}

.inside--beside .inside__controls {
  order: 1;
  flex-wrap: wrap;
  margin: auto 0 0;
  padding-top: var(--space-12);
}

.inside__chapter {
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

/* In the list a chapter is `--inside-row-height` tall and the list's width. */
.inside--beside .inside__chapter {
  box-sizing: border-box;
  width: 100%;
  height: var(--inside-row-height);
  padding: 0 var(--space-10);
}

.inside__chapter:hover {
  color: var(--ink);
  background: var(--hover-fill);
}

.inside__chapter:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: -2px;
}

/* The chapter whose row is playing: its icon `accent-strong`, its name `ink`, and a 2px `accent` bar, along its foot in
 * the band and down its left edge in the list. */
.inside__chapter--lit {
  color: var(--ink);
}

.inside__chapter--lit::after {
  content: '';
  position: absolute;
  right: var(--space-10);
  bottom: 0;
  left: var(--space-10);
  height: 2px;
  background: var(--accent);
  border-radius: var(--radius-full);
}

.inside--beside .inside__chapter--lit::after {
  top: var(--space-6);
  right: auto;
  bottom: var(--space-6);
  left: 0;
  width: 2px;
  height: auto;
}

.inside__chapter--lit .inside__chapter-icon,
.inside__caption-icon {
  color: var(--accent-strong);
}

/* The caption: the playing row's icon, name, line and place. In the band on one line where there is room, the line
 * wrapping beside or under the name on a narrower one. */
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

/* In the list: the icon, the name and on the right the place on one line, the row's line 6px under them. */
.inside--beside .inside__caption-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  row-gap: var(--space-6);
  align-content: start;
  padding: 0;
}

.inside--beside .inside__caption-words {
  display: contents;
}

/* A long name wraps beside its place, never cut short. */
.inside--beside .inside__caption-name {
  white-space: normal;
}

.inside--beside .inside__caption-line {
  grid-row: 2;
  grid-column: 1 / -1;
}

.inside--beside .inside__caption-place {
  grid-row: 1;
  grid-column: 3;
}

/* The demo framed as a window onto the editor, not the page's canvas; it fills the rest of the section's room. */
.inside__editor {
  flex: 1 1 auto;
  min-height: var(--inside-main-least-height);
  border: 1px solid var(--inside-frame-edge);
  box-shadow: var(--inside-frame-shadow);
}
</style>
