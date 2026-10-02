<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import AppIcon from '../components/ui/AppIcon.vue'
import type { IconName } from '../components/ui/icons'
import { useMediaQuery } from '../composables/ui/useMediaQuery'
import { useI18n } from '../i18n/useI18n'
import type { Translations } from '../i18n/translations'
import FeatureExample from './examples/FeatureExample.vue'

/**
 * The Overview's "What's inside" carousel (ticket 217; Overview card). From 1024 a `tablist` of the seven features on
 * the left and the selected feature's stage on the right, with ‹ › and "n / 7" top-right; below 1024 swipe cards with
 * dots and ‹ ›. Each stage holds the feature's example (ticket 218), scaled to what the stage leaves it.
 */
const { t } = useI18n()

/** The features in the order the design system lists them, each with its Icons v2 icon. Mirror is left out while its controls are hidden (ticket 174). */
const FEATURES: { key: keyof Translations['overview']['features']; icon: IconName }[] = [
  { key: 'techniques', icon: 'grid' },
  { key: 'patternEditing', icon: 'paint' },
  { key: 'convertImage', icon: 'image' },
  { key: 'rowProgress', icon: 'turn-row-direction' },
  { key: 'beadsNeeded', icon: 'bead' },
  { key: 'exports', icon: 'export' },
  { key: 'savedPatterns', icon: 'library' },
]

const wide = useMediaQuery('(min-width: 1024px)')
const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
const current = ref(0)
const track = useTemplateRef<HTMLElement>('track')
const tabs = useTemplateRef<HTMLElement[]>('tabs')
const count = computed(() => `${current.value + 1} / ${FEATURES.length}`)

/** Selects a feature (wrapping at the ends); below 1024 it also scrolls that card into view. */
function show(index: number, focusTab = false) {
  current.value = (index + FEATURES.length) % FEATURES.length
  if (focusTab) void nextTick(() => tabs.value?.[current.value]?.focus())
  if (!wide.value) {
    void nextTick(() => {
      const card = track.value?.children[current.value] as HTMLElement | undefined
      if (card && track.value) track.value.scrollTo?.({ left: card.offsetLeft - track.value.offsetLeft, behavior: reducedMotion.value ? 'auto' : 'smooth' })
    })
  }
}

/** Crossing 1024 either way re-seats the swipe track on the selected card. */
watch(wide, () => show(current.value))

function onTabKey(event: KeyboardEvent) {
  const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key]
  if (step) {
    event.preventDefault()
    show(current.value + step, true)
  } else if (event.key === 'Home' || event.key === 'End') {
    event.preventDefault()
    show(event.key === 'Home' ? 0 : FEATURES.length - 1, true)
  }
}

/** Swiping settles on the card nearest the left edge; the dots and count follow it. */
let settle: ReturnType<typeof setTimeout> | undefined
function onScroll() {
  if (wide.value) return
  clearTimeout(settle)
  settle = setTimeout(() => {
    const el = track.value
    if (!el) return
    let best = 0
    let bestDistance = Infinity
    for (let i = 0; i < el.children.length; i++) {
      const distance = Math.abs((el.children[i] as HTMLElement).offsetLeft - el.offsetLeft - el.scrollLeft)
      if (distance < bestDistance) {
        best = i
        bestDistance = distance
      }
    }
    current.value = best
  }, 80)
}
</script>

<template>
  <div class="carousel" data-testid="feature-carousel">
    <div
      v-if="wide"
      class="carousel__list"
      role="tablist"
      aria-orientation="vertical"
      :aria-label="t.overview.whatsInside"
      data-testid="overview-features"
    >
      <button
        v-for="(feature, i) in FEATURES"
        :id="`feature-tab-${feature.key}`"
        ref="tabs"
        :key="feature.key"
        type="button"
        role="tab"
        class="carousel__tab"
        :aria-selected="i === current"
        :aria-controls="`feature-panel-${feature.key}`"
        :tabindex="i === current ? 0 : -1"
        :data-feature="feature.key"
        @click="show(i)"
        @keydown="onTabKey"
      >
        <AppIcon :name="feature.icon" :size="22" class="carousel__tab-icon" />
        <strong class="carousel__tab-name">{{ t.overview.features[feature.key].tabName ?? t.overview.features[feature.key].name }}</strong>
        <span v-if="i === current" class="carousel__tab-line">{{ t.overview.features[feature.key].tabLine ?? t.overview.features[feature.key].text }}</span>
      </button>
    </div>

    <div class="carousel__view">
      <div ref="track" class="carousel__track" data-testid="overview-features-track" @scroll.passive="onScroll">
        <div
          v-for="(feature, i) in FEATURES"
          v-show="!wide || i === current"
          :id="`feature-panel-${feature.key}`"
          :key="feature.key"
          class="carousel__slide"
          :role="wide ? 'tabpanel' : 'group'"
          :aria-labelledby="wide ? `feature-tab-${feature.key}` : undefined"
          :aria-label="wide ? undefined : t.overview.features[feature.key].name"
          :data-feature="feature.key"
        >
          <div class="carousel__stage" data-testid="feature-stage">
            <FeatureExample :feature="feature.key" />
            <p v-if="wide" class="carousel__caption">
              <span class="carousel__number">0{{ i + 1 }}</span>
              <strong class="carousel__title">{{ t.overview.features[feature.key].name }}</strong>
              <span class="carousel__description">{{ t.overview.features[feature.key].text }}</span>
            </p>
          </div>
          <div v-if="!wide" class="carousel__card-caption">
            <h3 class="carousel__card-title">
              <span class="carousel__number">0{{ i + 1 }}</span>{{ t.overview.features[feature.key].name }}
            </h3>
            <p class="carousel__card-text">{{ t.overview.features[feature.key].text }}</p>
          </div>
        </div>
      </div>

      <div class="carousel__nav">
        <button type="button" class="carousel__arrow" :aria-label="t.overview.previousFeature" data-testid="feature-prev" @click="show(current - 1)">
          <AppIcon name="chevron-left" :size="18" />
        </button>
        <span v-if="!wide" class="carousel__dots" aria-hidden="true" data-testid="feature-dots">
          <i v-for="(feature, i) in FEATURES" :key="feature.key" :class="{ 'carousel__dot--on': i === current }" />
        </span>
        <span class="carousel__count" data-testid="feature-count">{{ count }}</span>
        <button type="button" class="carousel__arrow carousel__arrow--next" :aria-label="t.overview.nextFeature" data-testid="feature-next" @click="show(current + 1)">
          <AppIcon name="chevron-left" :size="18" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.carousel {
  display: block;
}

.carousel__view {
  position: relative;
  min-width: 0;
}

/* Below 1024: swipe cards. */
.carousel__track {
  display: flex;
  gap: var(--space-12);
  margin: 0 calc(var(--space-16) * -1);
  padding: var(--space-2) var(--space-16) var(--space-4);
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scroll-padding: 0 var(--space-16);
  scrollbar-width: none;
}

.carousel__track::-webkit-scrollbar {
  display: none;
}

.carousel__slide {
  display: flex;
  flex: 0 0 86%;
  flex-direction: column;
  gap: var(--space-12);
  min-width: 0;
  scroll-snap-align: start;
}

.carousel__stage {
  position: relative;
  box-sizing: border-box;
  aspect-ratio: 4 / 3;
  display: flex;
  flex-direction: column;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: var(--radius-board);
  overflow: hidden;
}

.carousel__number {
  font: var(--type-note);
  font-size: 1.125rem;
  color: var(--accent-strong);
}

.carousel__card-title {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  margin: 0;
  font: var(--type-title);
  color: var(--ink);
}

.carousel__card-text {
  margin: var(--space-4) 0 0;
  font: var(--type-body);
  color: var(--body);
}

.carousel__nav {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-12);
  margin-top: var(--space-12);
}

.carousel__arrow {
  display: grid;
  place-items: center;
  width: 2.5rem;
  height: 2.5rem;
  padding: 0;
  color: var(--ink);
  background: var(--canvas);
  border: 1px solid var(--line);
  border-radius: var(--radius-full);
  cursor: pointer;
}

.carousel__arrow:hover {
  background: var(--hover-fill);
}

.carousel__arrow:focus-visible,
.carousel__tab:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

.carousel__arrow--next :deep(.icon) {
  transform: scaleX(-1);
}

.carousel__dots {
  display: flex;
  gap: var(--space-6);
}

.carousel__dots i {
  width: 0.5rem;
  height: 0.5rem;
  background: var(--bead-empty);
  border-radius: var(--radius-xs);
}

.carousel__dots i.carousel__dot--on {
  background: var(--accent);
}

.carousel__count {
  font: var(--type-meta-small);
  color: var(--muted);
}

.carousel__list {
  display: none;
}

/* From 1024: the list left, the stage right, ‹ › and the count top-right of the stage. */
@media (min-width: 1024px) {
  .carousel {
    display: grid;
    grid-template-columns: 18.75rem 1fr;
    gap: var(--space-24);
    align-items: stretch;
  }

  .carousel__list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .carousel__tab {
    position: relative;
    display: grid;
    grid-template-columns: 1.75rem 1fr;
    column-gap: var(--space-10);
    padding: var(--space-12) var(--space-14);
    font: inherit;
    color: var(--muted);
    text-align: left;
    background: none;
    border: 0;
    border-radius: var(--radius-lg);
    cursor: pointer;
  }

  .carousel__tab:hover {
    color: var(--ink);
    background: var(--hover-fill);
  }

  .carousel__tab[aria-selected='true'] {
    color: var(--ink);
    background: var(--panel);
  }

  .carousel__tab[aria-selected='true']::before {
    content: '';
    position: absolute;
    top: var(--space-14);
    bottom: var(--space-14);
    left: 0;
    width: 2px;
    background: var(--accent);
    border-radius: var(--radius-xs);
  }

  .carousel__tab[aria-selected='true'] .carousel__tab-icon {
    color: var(--accent-strong);
  }

  .carousel__tab-name {
    font: var(--type-title);
  }

  .carousel__tab-line {
    grid-column: 2;
    margin-top: var(--space-4);
    font: var(--type-body);
    color: var(--body);
  }

  .carousel__track {
    margin: 0;
    padding: 0;
    overflow: hidden;
    scroll-snap-type: none;
  }

  .carousel__slide {
    flex: 0 0 100%;
  }

  .carousel__stage {
    height: 100%;
    /* Keeps the whole carousel above the fold on a MacBook Air. */
    min-height: 26rem;
    aspect-ratio: auto;

    /* The example keeps clear of ‹ › and the count above it and the caption below it. */
    --example-inset-top: 3.5rem;
    --example-inset-bottom: 7.5rem;
  }

  .carousel__caption {
    position: absolute;
    bottom: var(--space-24);
    left: var(--space-24);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    max-width: 24rem;
    margin: 0;
  }

  .carousel__title {
    font: var(--type-title);
    color: var(--ink);
  }

  .carousel__description {
    font: var(--type-body);
    color: var(--body);
  }

  .carousel__nav {
    position: absolute;
    top: var(--space-14);
    right: var(--space-16);
    margin: 0;
  }
}

@media (min-width: 1920px) {
  .carousel {
    grid-template-columns: 21.25rem 1fr;
  }

  .carousel__stage {
    min-height: 31.25rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .carousel__track {
    scroll-behavior: auto;
  }
}
</style>
