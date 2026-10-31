<script setup lang="ts">
import { nextTick, ref, useTemplateRef } from 'vue'
import AppIcon from '../components/ui/AppIcon.vue'
import type { IconName } from '../components/ui/icons'
import { useI18n } from '../i18n/useI18n'
import type { Translations } from '../i18n/translations'
import FeatureExample from './examples/FeatureExample.vue'

// The Homepage's "What's inside" carousel (ticket 217; Homepage card): a `tablist` of the features beside the selected
// one's stage from 1024, a row of tabs above it below (ticket 0739), with ‹ › and the count. "1024" is the page's width
// after its zoom (ticket 540), which the page says; each stage scales its example (ticket 218) to the room it leaves.
defineProps<{ wide: boolean }>()
const { t } = useI18n()

/** The features in the order the design system lists them, each with its Icons v2 icon. */
const FEATURES: { key: keyof Translations['homepage']['features']; icon: IconName }[] = [
  { key: 'techniques', icon: 'grid' },
  { key: 'projectEditing', icon: 'paint' },
  { key: 'convertImage', icon: 'image' },
  { key: 'rowProgress', icon: 'turn-row-direction' },
  { key: 'beadsNeeded', icon: 'bead' },
  { key: 'exports', icon: 'export' },
  { key: 'savedProjects', icon: 'library' },
]

const current = ref(0)
const tabs = useTemplateRef<HTMLElement[]>('tabs')

/** Selects a feature, wrapping at the ends; the row of tabs scrolls the selected one into view. */
function show(index: number, focusTab = false) {
  current.value = (index + FEATURES.length) % FEATURES.length
  void nextTick(() => {
    const tab = tabs.value?.[current.value]
    tab?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
    if (focusTab) tab?.focus()
  })
}

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
</script>

<template>
  <div class="carousel" data-testid="feature-carousel">
    <div
      class="carousel__list"
      role="tablist"
      :aria-orientation="wide ? 'vertical' : 'horizontal'"
      :aria-label="t.homepage.whatsInside"
      data-testid="homepage-features"
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
        <strong class="carousel__tab-name">{{ t.homepage.features[feature.key].tabName ?? t.homepage.features[feature.key].name }}</strong>
        <span v-if="i === current" class="carousel__tab-line">{{ t.homepage.features[feature.key].tabLine ?? t.homepage.features[feature.key].text }}</span>
      </button>
    </div>

    <div class="carousel__view">
      <div
        v-for="(feature, i) in FEATURES"
        v-show="i === current"
        :id="`feature-panel-${feature.key}`"
        :key="feature.key"
        class="carousel__slide"
        role="tabpanel"
        :aria-labelledby="`feature-tab-${feature.key}`"
        :data-feature="feature.key"
      >
        <div class="carousel__stage" data-testid="feature-stage">
          <FeatureExample :feature="feature.key" />
        </div>
        <p class="carousel__caption">
          <span class="carousel__number">0{{ i + 1 }}</span>
          <strong class="carousel__title">{{ t.homepage.features[feature.key].name }}</strong>
          <span class="carousel__description">{{ t.homepage.features[feature.key].text }}</span>
        </p>
      </div>

      <div class="carousel__nav">
        <button type="button" class="carousel__arrow" :aria-label="t.homepage.previousFeature" data-testid="feature-prev" @click="show(current - 1)">
          <AppIcon name="chevron-left" :size="18" />
        </button>
        <span class="carousel__count" data-testid="feature-count">{{ current + 1 }} / {{ FEATURES.length }}</span>
        <button type="button" class="carousel__arrow carousel__arrow--next" :aria-label="t.homepage.nextFeature" data-testid="feature-next" @click="show(current + 1)">
          <AppIcon name="chevron-left" :size="18" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* It fills the section: below 1024 the row of tabs above the stage, the caption under it. */
.carousel {
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
  height: 100%;
  min-height: 0;
}

.carousel__view {
  position: relative;
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.carousel__slide {
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  gap: var(--space-12);
  min-height: 0;
}

/* A stage too small for its example would show nothing: below that the section scrolls inside itself. */
.carousel__stage {
  position: relative;
  box-sizing: border-box;
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  min-height: 12rem;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: var(--radius-board);
  overflow: hidden;

  /* The example keeps clear of ‹ › and the count above it. */
  --example-inset-top: 3.5rem;
}

.carousel__number {
  font: var(--type-note);
  font-size: 1.125rem;
  color: var(--accent-strong);
}

.carousel__caption {
  display: flex;
  flex: none;
  flex-direction: column;
  gap: var(--space-4);
  margin: 0;
}

.carousel__caption .carousel__number {
  display: none;
}

.carousel__title {
  font: var(--type-title);
  color: var(--ink);
}

.carousel__description {
  font: var(--type-body);
  color: var(--body);
}

/* ‹ 1 / 7 › at the stage's top right. */
.carousel__nav {
  position: absolute;
  top: var(--space-14);
  right: var(--space-16);
  display: flex;
  align-items: center;
  gap: var(--space-12);
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
  outline-offset: var(--focus-offset);
}

.carousel__arrow--next :deep(.icon) {
  transform: scaleX(-1);
}

.carousel__count {
  font: var(--type-meta-small);
  color: var(--muted);
}

/* Below 1024: a row of tabs, the names alone, scrolling sideways. */
.carousel__list {
  display: flex;
  flex: none;
  gap: var(--space-4);
  overflow-x: auto;
  scrollbar-width: none;
}

.carousel__list::-webkit-scrollbar {
  display: none;
}

.carousel__tab {
  position: relative;
  flex: none;
  display: grid;
  grid-template-columns: auto;
  column-gap: var(--space-10);
  padding: var(--space-8) var(--space-14);
  font: inherit;
  color: var(--muted);
  text-align: left;
  white-space: nowrap;
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

.carousel__tab[aria-selected='true'] .carousel__tab-icon {
  color: var(--accent-strong);
}

.carousel__tab-icon,
.carousel__tab-line {
  display: none;
}

.carousel__tab-name {
  font: var(--type-title);
}

/* From 1024: the list left with each tab's icon and the selected one's line, the stage right with its caption inside. */
@container homepage (min-width: 1024px) {
  .carousel {
    display: grid;
    grid-template-columns: 18.75rem 1fr;
    gap: var(--space-24);
  }

  .carousel__list {
    flex-direction: column;
    gap: var(--space-2);
    overflow: visible;
  }

  .carousel__tab {
    grid-template-columns: 1.75rem 1fr;
    padding: var(--space-10) var(--space-14);
    white-space: normal;
  }

  .carousel__tab[aria-selected='true']::before {
    content: '';
    position: absolute;
    top: var(--space-12);
    bottom: var(--space-12);
    left: 0;
    width: 2px;
    background: var(--accent);
    border-radius: var(--radius-xs);
  }

  .carousel__tab-icon {
    display: block;
  }

  .carousel__tab-line {
    display: block;
    grid-column: 2;
    margin-top: var(--space-4);
    font: var(--type-body);
    color: var(--body);
  }

  .carousel__slide {
    position: relative;
  }

  .carousel__stage {
    /* The example keeps clear of the caption below it too. */
    --example-inset-bottom: 7.5rem;
  }

  .carousel__caption {
    position: absolute;
    bottom: var(--space-24);
    left: var(--space-24);
    max-width: 24rem;
  }

  .carousel__caption .carousel__number {
    display: inline;
  }
}

@container homepage (min-width: 1920px) {
  .carousel {
    grid-template-columns: 21.25rem 1fr;
  }
}
</style>
