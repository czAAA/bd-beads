<script setup lang="ts">
import { shallowRef } from 'vue'
import AppButton from '../components/ui/AppButton.vue'
import AppIcon from '../components/ui/AppIcon.vue'
import { fillBlanks } from '../domain/fillBlanks'
import { useI18n } from '../i18n/useI18n'
import FreeList from './FreeList.vue'
import { SCROLLS_TO_UNROLL } from './useFreeRoll'

// The plan tiles (ticket 220; Homepage card): "Three ways to use it". No account opens the editor, like the hero's
// button; Free account and Pro are switched off, one shared reason. No account's list is everything free, in a short
// window scrolled by hand (ticket 0739); the page counts the scrolls and unrolls it. Free account and Pro are placeholders.
defineProps<{
  /** How many of the beads beside the free count are lit: one per scroll of the window. */
  lit: number
  /** Whether the list is unrolled below the tile: the roll then lies over the window. */
  unrolled: boolean
}>()
const emit = defineEmits<{ openEditor: []; freeScroll: [] }>()
const { t } = useI18n()

/** The tiles' ids, in the design system's order; the first is the one that works now. */
const IDS = ['no-account', 'free-account', 'pro'] as const
/** The free list's window, for the page to measure the roll from; a ref inside the tiles' loop would be a list. */
const freeWindow = shallowRef<HTMLElement>()
const setFreeWindow = (el: unknown) => (freeWindow.value = el instanceof HTMLElement ? el : undefined)
defineExpose({ freeWindow })
</script>

<template>
  <section class="plans" aria-labelledby="homepage-plans" data-testid="homepage-plans">
    <header class="plans__head">
      <h2 id="homepage-plans" class="plans__heading">{{ t.homepage.plans.heading }}</h2>
      <p class="plans__why"><AppIcon name="info" :size="16" />{{ t.homepage.plans.why }}</p>
    </header>
    <div class="plans__grid">
      <article
        v-for="(tile, i) in t.homepage.plans.tiles"
        :key="IDS[i]"
        class="plan"
        :class="{ 'plan--current': i === 0 }"
        :aria-current="i === 0 ? 'true' : undefined"
        :data-testid="`plan-${IDS[i]}`"
      >
        <span v-if="i === 0" class="plan__here" aria-hidden="true" data-testid="plan-you-are-here">
          <span class="plan__note">{{ t.homepage.plans.youAreHere }}</span>
          <svg class="plan__arrow" width="36" height="30" viewBox="0 0 36 30"><path d="M4 4 C 10 14, 18 20, 30 22 M20 24 L31 22 L24 13" /></svg>
        </span>
        <span class="plan__strand" aria-hidden="true">
          <template v-for="bead in 3" :key="bead">
            <span v-if="bead > 1" class="plan__thread" />
            <span class="plan__bead" :class="{ 'plan__bead--on': bead <= i + 1 }" />
          </template>
        </span>
        <h3 class="plan__name">{{ tile.name }}</h3>
        <p class="plan__price">
          <b>{{ tile.price }}</b
          ><span>{{ tile.meta }}</span>
        </p>
        <p class="plan__text">{{ tile.text }}</p>
        <AppButton
          class="plan__button"
          :variant="i === 0 ? 'primary' : 'secondary'"
          :disabled="i !== 0"
          @click="i === 0 && emit('openEditor')"
        >
          {{ tile.button }}
        </AppButton>
        <template v-if="i === 0">
          <p class="plan__includes plan__free-head">
            <span>{{ tile.includes }}</span>
            <span class="plan__free-count" data-testid="free-count">
              {{ fillBlanks(t.homepage.plans.free.count, { count: tile.items.length }) }}
              <span class="plan__ticks" aria-hidden="true">
                <i v-for="tick in SCROLLS_TO_UNROLL" :key="tick" :class="{ 'plan__tick--on': tick <= lit }" data-testid="free-tick" />
              </span>
            </span>
          </p>
          <div
            :ref="setFreeWindow"
            class="plan__free-window"
            :class="{ 'plan__free-window--unrolled': unrolled }"
            role="region"
            tabindex="0"
            :aria-label="t.homepage.plans.free.window"
            data-testid="free-window"
            @scroll.passive="emit('freeScroll')"
          >
            <FreeList :items="tile.items" />
          </div>
        </template>
        <ul v-else class="plan__list">
          <li class="plan__includes">{{ tile.includes }}</li>
          <li v-for="item in tile.items" :key="item" class="plan__item">
            <AppIcon name="check" :size="15" class="plan__check" /><span>{{ item }}</span>
          </li>
        </ul>
      </article>
    </div>
  </section>
</template>

<style scoped>
.plans {
  display: flex;
  flex-direction: column;
}

/* The heading on the left and the one reason on the right, wrapping under it where there is no room. */
.plans__head {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-4) var(--space-16);
}

.plans__heading {
  margin: 0;
  font: var(--type-serif-heading);
  letter-spacing: var(--tracking-serif-heading);
  color: var(--ink);
}

.plans__why {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  margin: 0;
  font: var(--type-body);
  font-size: 0.8125rem;
  line-height: 1.125rem;
  color: var(--muted);
}

/* On a phone the tiles scroll sideways, one and a bit in view; from 744 the three side by side. The top padding is the
 * room for "you are here". */
.plans__grid {
  display: grid;
  grid-auto-columns: 84%;
  grid-auto-flow: column;
  align-items: start;
  gap: var(--space-12);
  padding-top: var(--space-32);
  padding-bottom: var(--space-2);
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
}

.plans__grid::-webkit-scrollbar {
  display: none;
}

.plans__grid > * {
  scroll-snap-align: start;
}

@container homepage (min-width: 744px) {
  .plans__grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    grid-auto-columns: auto;
    grid-auto-flow: row;
    gap: var(--space-16);
    overflow: visible;
  }
}

.plan {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--space-10);
  box-sizing: border-box;
  min-width: 0;
  padding: var(--space-16) var(--space-20);
  text-align: left;
  background: var(--canvas);
  border: 1px solid var(--line);
  border-radius: 1rem;
}

@container homepage (min-width: 1024px) {
  .plan {
    padding: var(--space-20) var(--space-24);
  }
}

.plan--current {
  border: 2px solid var(--ink);
  padding: calc(var(--space-16) - 1px) calc(var(--space-20) - 1px);
}

@container homepage (min-width: 1024px) {
  .plan--current {
    padding: calc(var(--space-20) - 1px) calc(var(--space-24) - 1px);
  }
}

/* The hand-written note: decorative, above the tile, only from 744 where there is room for it. */
.plan__here {
  position: absolute;
  top: 0;
  left: 0;
  display: none;
  pointer-events: none;
}

@container homepage (min-width: 744px) {
  .plan__here {
    display: block;
  }
}

.plan__note {
  position: absolute;
  top: -2.125rem;
  left: 1.125rem;
  font: var(--type-note);
  color: var(--accent-strong);
  white-space: nowrap;
  transform: rotate(-4deg);
}

.plan__arrow {
  position: absolute;
  top: -1.5rem;
  left: -1.625rem;
  overflow: visible;
  fill: none;
  stroke: var(--muted);
  stroke-width: 1.25;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.plan__strand {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.plan__bead {
  width: 0.625rem;
  height: 0.625rem;
  background: var(--bead-empty);
  border-radius: 2.5px;
}

.plan__bead--on {
  background: var(--ink);
}

.plan__thread {
  width: 0.5rem;
  height: 1px;
  background: var(--line-strong);
}

.plan__name {
  margin: 0;
  font: var(--type-serif-heading);
  font-size: 1.875rem;
  line-height: 2rem;
  letter-spacing: var(--tracking-serif-heading);
  color: var(--ink);
}

.plan__price {
  display: flex;
  align-items: baseline;
  gap: var(--space-8);
  margin: 0;
}

.plan__price b {
  font: var(--type-body);
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.5rem;
  color: var(--ink);
}

.plan__price span {
  font: var(--type-meta-small);
  color: var(--muted);
  text-transform: lowercase;
}

.plan__text {
  min-height: 2.5rem;
  margin: 0;
  font: var(--type-body);
  color: var(--body);
}

.plan__button {
  width: 100%;
  height: 2.75rem;
  white-space: normal;
}

.plan__list {
  display: grid;
  flex: 1;
  gap: var(--space-8);
  align-content: start;
  margin: 0;
  padding: var(--space-10) 0 0;
  list-style: none;
  border-top: 1px solid var(--line-soft);
}

.plan__includes {
  font: var(--type-meta-small);
  color: var(--muted);
  text-transform: lowercase;
}

/* "what you get" and "23 · free" with the three beads, one lit per scroll of the window below. */
.plan__free-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-8);
  margin: 0;
  padding-top: var(--space-10);
  border-top: 1px solid var(--line-soft);
}

.plan__free-count {
  display: flex;
  align-items: center;
  gap: var(--space-8);
}

/* The beads are the carousel's dots. */
.plan__ticks {
  display: flex;
  gap: var(--space-4);
}

.plan__ticks i {
  width: 0.5rem;
  height: 0.5rem;
  background: var(--bead-empty);
  border-radius: var(--radius-xs);
  transition: background var(--duration-base) var(--ease-standard);
}

.plan__ticks i.plan__tick--on {
  background: var(--accent);
}

/* The window: a few rows, scrolled by hand, fading out at its foot; its scrolling never runs on into the page's. */
.plan__free-window {
  height: var(--free-window);
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  mask-image: linear-gradient(180deg, var(--ink) 72%, transparent);
}

.plan__free-window:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: var(--focus-offset);
}

/* The roll lies over it while unrolled; it scrolls no more, so the rest of a swipe already on it runs on into the page. */
.plan__free-window--unrolled {
  overflow: hidden;
  overscroll-behavior: auto;
  opacity: 0;
}

.plan__item {
  display: flex;
  align-items: flex-start;
  gap: 0.5625rem;
  font: var(--type-body);
  font-size: 0.84375rem;
  line-height: 1.1875rem;
  color: var(--body);
}

.plan__check {
  flex: none;
  margin-top: 2px;
  color: var(--accent-strong);
}
</style>
