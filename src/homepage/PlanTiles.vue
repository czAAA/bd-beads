<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import AppButton from '../components/ui/AppButton.vue'
import AppIcon from '../components/ui/AppIcon.vue'
import { useI18n } from '../i18n/useI18n'
import FreeList from './FreeList.vue'
import { freeListRows } from './freeList'

// The plan tiles (ticket 220; Homepage card): "Three ways to use it". No account opens the editor, like the hero's
// button, and lists everything free; the page grows its list as it scrolls (ticket 0742). Free account and Pro are
// greyed out and list nothing, a Coming soon stamp where the list was.
defineProps<{
  /** The free list's height, in the tile's own px, as far as the page has grown it; unset, the whole list. */
  freeHeight?: number
  /** Whether the whole list is out, so its foot no longer fades. */
  freeOpen?: boolean
}>()
const emit = defineEmits<{ openEditor: [] }>()
const { t, locale } = useI18n()
const rows = computed(() => freeListRows(t.value, locale.value))

/** Free account and Pro: their ids, and the noise each stamp's ink is worn by, so the two don't look pasted. */
const OFF = [
  { id: 'free-account', frequency: '0.85 0.6', seed: 4 },
  { id: 'pro', frequency: '0.8 0.65', seed: 11 },
] as const
/** The free list's window and its tile, for the page to measure the growth from. */
const freeWindow = shallowRef<HTMLElement>()
const freeTile = shallowRef<HTMLElement>()
defineExpose({ freeWindow, freeTile })
</script>

<template>
  <section class="plans" aria-labelledby="homepage-plans" data-testid="homepage-plans">
    <header class="plans__head">
      <h2 id="homepage-plans" class="plans__heading">{{ t.homepage.plans.heading }}</h2>
      <p class="plans__why"><AppIcon name="info" :size="16" />{{ t.homepage.plans.why }}</p>
    </header>
    <div class="plans__grid">
      <article ref="freeTile" class="plan plan--current" aria-current="true" data-testid="plan-no-account">
        <span class="plan__here" aria-hidden="true" data-testid="plan-you-are-here">
          <span class="plan__note">{{ t.homepage.plans.youAreHere }}</span>
          <svg class="plan__arrow" width="36" height="30" viewBox="0 0 36 30"><path d="M4 4 C 10 14, 18 20, 30 22 M20 24 L31 22 L24 13" /></svg>
        </span>
        <span class="plan__strand" aria-hidden="true"><span class="plan__bead" /></span>
        <h3 class="plan__name">{{ t.homepage.plans.tiles[0].name }}</h3>
        <p class="plan__price">
          <b>{{ t.homepage.plans.tiles[0].price }}</b
          ><span>{{ t.homepage.plans.tiles[0].meta }}</span>
        </p>
        <p class="plan__text">{{ t.homepage.plans.tiles[0].text }}</p>
        <AppButton class="plan__button" variant="primary" @click="emit('openEditor')">{{ t.homepage.plans.tiles[0].button }}</AppButton>
        <p id="homepage-free" class="plan__free-head">{{ t.homepage.plans.free.heading }}</p>
        <div
          ref="freeWindow"
          class="plan__free"
          :class="{ 'plan__free--fading': !freeOpen }"
          :style="freeHeight === undefined ? undefined : { height: `${freeHeight}px` }"
          data-testid="free-window"
        >
          <FreeList :rows="rows" :more="t.homepage.plans.free.more" labelled-by="homepage-free" />
        </div>
      </article>
      <article v-for="(off, i) in OFF" :key="off.id" class="plan plan--off" aria-disabled="true" :data-testid="`plan-${off.id}`">
        <span class="plan__strand" aria-hidden="true">
          <template v-for="bead in i + 2" :key="bead">
            <span v-if="bead > 1" class="plan__thread" />
            <span class="plan__bead" />
          </template>
        </span>
        <h3 class="plan__name">{{ t.homepage.plans.tiles[i + 1]!.name }}</h3>
        <p class="plan__price"><b>{{ t.homepage.plans.tiles[i + 1]!.price }}</b></p>
        <p class="plan__text">{{ t.homepage.plans.tiles[i + 1]!.text }}</p>
        <AppButton class="plan__button" disabled>{{ t.homepage.plans.tiles[i + 1]!.button }}</AppButton>
        <!-- The stamp: a rubber stamp's two borders and its word, the ink worn by noise where the paper didn't take it. -->
        <svg class="plan__stamp" role="img" :aria-label="t.homepage.plans.comingSoon" viewBox="0 0 236 96">
          <filter :id="`coming-soon-ink-${off.id}`" x="-4%" y="-8%" width="108%" height="116%">
            <feTurbulence type="fractalNoise" :baseFrequency="off.frequency" numOctaves="2" :seed="off.seed" result="noise" />
            <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -3 0 0 0 2.15" result="ink" />
            <feComposite in="SourceGraphic" in2="ink" operator="in" />
          </filter>
          <g :filter="`url(#coming-soon-ink-${off.id})`">
            <rect x="4" y="14" width="228" height="68" rx="8" stroke-width="5" />
            <rect x="12" y="22" width="212" height="52" rx="4" stroke-width="1.5" />
            <text x="118" y="58" text-anchor="middle">{{ t.homepage.plans.comingSoon.toLocaleUpperCase(locale) }}</text>
          </g>
        </svg>
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
  background: var(--elevated);
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
  background: var(--ink);
  border-radius: 2.5px;
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

/* "forever free:" over the list. */
.plan__free-head {
  margin: var(--space-6) 0 0;
  font: var(--type-meta-small);
  color: var(--muted);
  text-transform: lowercase;
}

/* No window of its own and no scroll bar: the page's scroll sets its height, the rest of the list faded at its foot. */
.plan__free {
  overflow: hidden;
}

.plan__free--fading {
  mask-image: linear-gradient(180deg, var(--ink) calc(100% - var(--free-fade)), transparent);
}

/* Switched off (ticket 0742): a quiet fill, a dashed edge, every word in the subtle grey, the strand grey. */
.plan--off {
  background: var(--surface);
  border: 1px dashed var(--line-strong);
}

.plan--off .plan__name,
.plan--off .plan__price b,
.plan--off .plan__text {
  color: var(--subtle);
}

.plan--off .plan__strand {
  opacity: 0.45;
  filter: grayscale(1);
}

/* The Coming soon stamp, in the accent, each tile at its own tilt. */
.plan__stamp {
  display: block;
  width: var(--coming-soon-width);
  max-width: 100%;
  margin: calc(var(--space-16) + var(--space-2)) auto var(--space-6);
  overflow: visible;
  color: var(--accent-strong);
  opacity: 0.85;
  transform: rotate(var(--coming-soon-tilt));
}

.plan--off + .plan--off .plan__stamp {
  --coming-soon-tilt: -5deg;
}

.plan__stamp g {
  fill: none;
  stroke: currentColor;
}

.plan__stamp text {
  font: 600 26px/1 var(--font-sans);
  letter-spacing: 3px;
  fill: currentColor;
  stroke: none;
}
</style>
