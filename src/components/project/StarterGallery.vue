<script setup lang="ts">
import { computed, inject, ref, useId } from 'vue'
import { DEFAULT_BEAD, findBead } from '../../domain/beads'
import { designSizes, STARTER_BEAD_ID, STARTER_CATEGORIES, type Starter, type StarterCategoryId, type StarterId } from '../../domain/starters'
import { plural } from '../../i18n/plural'
import { starterCountWords, starterCrumb, starterName, starterSizeWords } from '../../i18n/starterWords'
import { useI18n } from '../../i18n/useI18n'
import { PANEL_CONTEXT } from '../shell/panelContext'
import StarterPicture from './StarterPicture.vue'

// The Starter gallery (tickets 0596, 0597; StarterGallery card), a level of the panel's subpanels: step 1 a card per
// category, or with a `category`, step 2 a card per option of it. Two columns, one Tab stop with a roving tabindex; a
// card opens the next level under its name, and Back brings focus back to it.
const props = defineProps<{ category?: StarterCategoryId }>()
const emit = defineEmits<{ 'choose-category': [id: StarterCategoryId]; choose: [id: StarterId] }>()

const { t, locale } = useI18n()
const panel = inject(PANEL_CONTEXT, undefined)
const id = useId()

/** What a card shows: its name, its caption lines and the Starter whose design is its picture, drawn as a pair for the
 * Earrings' category card. */
interface Card {
  testid: string
  name: string
  lines: string[]
  starter: Starter
  pair?: boolean
  open: () => void
}

/** The Bead a card counts with, as its picture is drawn: Delica 11/0 (StarterGallery card). */
const CARD_BEAD = findBead(STARTER_BEAD_ID) ?? DEFAULT_BEAD

const shown = computed(() => STARTER_CATEGORIES.find((category) => category.id === props.category))

const cards = computed<Card[]>(() => {
  const category = shown.value
  if (!category) {
    return STARTER_CATEGORIES.map((each) => {
      const name = t.value.starters.categories[each.id].name
      return {
        testid: `starter-category-${each.id}`,
        name,
        lines: [plural(locale.value, each.starters.length, t.value.starters.categories[each.id].count)],
        starter: each.best,
        pair: each.id === 'earrings',
        open: () => {
          emit('choose-category', each.id)
          panel?.openSub(name, { meta: starterCrumb(t.value, locale.value), opener: `starter-category-${each.id}` })
        },
      }
    })
  }
  return category.starters.map((starter) => {
    const name = starterName(t.value, starter)
    const designed = { sizes: designSizes(starter), useDesign: true }
    return {
      testid: `starter-card-${starter.id}`,
      name,
      lines: [starterSizeWords(t.value, locale.value, starter), starterCountWords(t.value, locale.value, starter, designed, CARD_BEAD)],
      starter,
      open: () => {
        emit('choose', starter.id)
        panel?.openSub(name, { meta: starterCrumb(t.value, locale.value, t.value.starters.categories[category.id].name), opener: `starter-card-${starter.id}` })
      },
    }
  })
})

const lead = computed(() => (shown.value ? t.value.starters.categories[shown.value.id].lead : t.value.starters.lead))

/** The card that takes the grid's one Tab stop: the last one focused. */
const current = ref(0)
const gridEl = ref<HTMLElement>()

/** The arrows move along a row and between rows of two, Home and End to the first and last card. */
function onKeydown(event: KeyboardEvent, index: number) {
  const last = cards.value.length - 1
  const moves: Record<string, number> = { ArrowRight: index + 1, ArrowLeft: index - 1, ArrowDown: index + 2, ArrowUp: index - 2, Home: 0, End: last }
  const next = moves[event.key]
  if (next === undefined) return
  event.preventDefault()
  event.stopPropagation()
  if (next < 0 || next > last) return
  current.value = next
  gridEl.value?.querySelectorAll<HTMLElement>('.starter-card')[next]?.focus()
}
</script>

<template>
  <div class="starter-gallery" data-testid="starter-gallery">
    <p class="starter-gallery__lead" data-testid="starter-lead">{{ lead }}</p>
    <div ref="gridEl" class="starter-gallery__grid" role="group" :aria-label="shown ? t.starters.categories[shown.id].name : t.starters.title">
      <button
        v-for="(card, index) in cards"
        :key="card.testid"
        class="starter-card"
        type="button"
        :tabindex="index === current ? 0 : -1"
        :aria-labelledby="`${id}-${index}-name`"
        :aria-describedby="`${id}-${index}-caption`"
        :data-testid="card.testid"
        data-wrap-ok
        @click="card.open"
        @focus="current = index"
        @keydown="onKeydown($event, index)"
      >
        <span class="starter-card__well">
          <StarterPicture :starter="card.starter" :pair="card.pair" upright />
        </span>
        <span class="starter-card__caption">
          <span :id="`${id}-${index}-name`" class="starter-card__name">{{ card.name }}</span>
          <span :id="`${id}-${index}-caption`" class="starter-card__lines">
            <span v-for="line in card.lines" :key="line" class="starter-card__meta">{{ line }}</span>
          </span>
        </span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.starter-gallery {
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
}

.starter-gallery__lead {
  margin: 0;
  font: var(--type-meta);
  font-family: var(--font-sans);
  color: var(--muted);
}

/* Two columns at every width (StarterGallery card, Grid); a row's cards take its tallest caption's height. */
.starter-gallery__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-12);
}

.starter-card {
  display: flex;
  flex-direction: column;
  padding: 0;
  overflow: hidden;
  font: inherit;
  color: var(--ink);
  text-align: left;
  cursor: pointer;
  background: var(--elevated);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-lg);
}

.starter-card__well {
  display: block;
  aspect-ratio: 1;
  overflow: hidden;
  background: var(--surface);
  border-bottom: 1px solid var(--line);
}

.starter-card__well > * {
  transition: transform var(--duration-base) var(--ease-out);
}

.starter-card__caption {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-10) var(--space-12) var(--space-12);
}

.starter-card__lines {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.starter-card__name {
  font: var(--type-control);
  color: var(--ink);
}

.starter-card__meta {
  font: var(--type-meta);
  color: var(--muted);
}

.starter-card:hover {
  background: var(--hover-fill);
  border-color: var(--body);
  box-shadow: var(--elevation-1);
}

.starter-card:hover .starter-card__well > * {
  transform: scale(var(--starter-hover-scale));
}

.starter-card:active {
  background: var(--press-fill);
  border-color: var(--ink);
}

.starter-card:active .starter-card__well > * {
  transform: scale(var(--starter-press-scale));
}

.starter-card:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: calc(-1 * var(--focus-width));
}

/* High contrast: a 2px edge (its focus ring is already 3px, `focus-width`). */
:root[data-theme='contrast'] .starter-card {
  border-width: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .starter-card:hover .starter-card__well > *,
  .starter-card:active .starter-card__well > * {
    transform: none;
  }
}
</style>
