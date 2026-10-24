<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import AppButton from '../components/ui/AppButton.vue'
import CanvasStrip from '../components/canvas/CanvasStrip.vue'
import MenuPanel from '../components/shell/MenuPanel.vue'
import PanelHost from '../components/shell/PanelHost.vue'
import { useElementSize } from '../composables/ui/useElementSize'
import { useCanvasBackground } from '../theme/useCanvasBackground'
import DrawnLayer from './DrawnLayer.vue'
import CoffeeTile from './CoffeeTile.vue'
import FeatureCarousel from './FeatureCarousel.vue'
import PlanTiles from './PlanTiles.vue'
import { provideI18n } from '../i18n/useI18n'
import { OVERVIEW_MAX_ZOOM_PERCENT, OVERVIEW_MIN_ZOOM_PERCENT, useOverviewZoom } from './overviewZoom'

// The Overview (ticket 77; Overview card): the page outside the editor that introduces openbeads, a canvas box like the
// editor's (ticket 540, ADR 0073): the Canvas strip on top, the content scrolling between, an empty Canvas footer below.
// It only reports which way in was chosen: the entry decides where that goes.
const props = defineProps<{
  /** How many Projects this device has saved; none means a new visitor. */
  projectCount: number
}>()
const emit = defineEmits<{ makeFirstProject: []; openEditor: [] }>()

const { t } = provideI18n()
watchEffect(() => {
  document.title = `${t.value.overview.pageTitle} · ${t.value.app.title}`
})

/** The slogan's first word carries the note "you". */
const sloganFirst = computed(() => t.value.overview.sloganLead.split(' ')[0]!)
const sloganRest = computed(() => t.value.overview.sloganLead.slice(sloganFirst.value.length))

const menuOpen = ref(false)
const zoom = useOverviewZoom()
/** The content's own width once zoomed: the width its layout is made for (the CSS asks the container the same). */
/** The width from which the carousel is a tablist, as in the CSS (1024px). */
const WIDE_FROM = 1024
const scrollEl = ref<HTMLElement>()
const scrollSize = useElementSize(scrollEl)
const pageWidth = computed(() => (scrollSize.width.value || window.innerWidth) / (zoom.percent.value / 100))
const canvasBackground = useCanvasBackground()
const boxStyle = computed(() => {
  const color = canvasBackground.background.value?.color
  return color ? { '--canvas-bg': color } : undefined
})

const isNew = computed(() => props.projectCount === 0)
const projectsSaved = computed(() => t.value.overview.projectsSaved.replace('{count}', String(props.projectCount)))
</script>

<template>
  <div class="overview" :style="boxStyle" data-testid="overview">
    <CanvasStrip
      page="overview"
      :open-panel="menuOpen ? 'menu' : null"
      :zoom-percent="zoom.percent.value"
      :zoom-min-percent="OVERVIEW_MIN_ZOOM_PERCENT"
      :zoom-max-percent="OVERVIEW_MAX_ZOOM_PERCENT"
      @select-panel="menuOpen = !menuOpen"
      @zoom-in="zoom.zoomIn"
      @zoom-out="zoom.zoomOut"
      @reset="zoom.reset"
    />
    <PanelHost v-if="menuOpen" open="menu" :only="['menu']" @close="menuOpen = false">
      <MenuPanel page="overview" />
    </PanelHost>

    <div ref="scrollEl" class="overview__scroll" data-testid="overview-scroll">
      <div class="overview__page" :style="{ zoom: zoom.percent.value / 100 }">
    <main class="overview__main">
      <section class="overview__hero">
        <DrawnLayer section="hero" />
        <p class="overview__slogan" data-testid="overview-slogan">
          <span class="overview__slogan-first"
            >{{ sloganFirst
            }}<span class="overview__note overview__note--you" aria-hidden="true" data-testid="overview-note-you">{{
              t.overview.notes.you
            }}</span></span
          >{{ sloganRest }} <span class="overview__slogan-last">{{ t.overview.sloganLast }}</span>
        </p>
        <p class="overview__tagline">
          <span class="overview__tagline-text">{{ t.overview.tagline }}</span>
          <span class="overview__aside overview__aside--us" aria-hidden="true" data-testid="overview-note-on-us">
            <svg class="overview__arrow" width="18" height="8" viewBox="0 0 18 8"><path d="M17 4 H2 M6 1 L2 4 L6 7" /></svg>
            <span class="overview__note overview__note--accent">{{ t.overview.notes.onUs }}</span>
          </span>
        </p>
        <div class="overview__actions">
          <template v-if="isNew">
            <span class="overview__buttons">
              <AppButton variant="primary" size="lg" data-testid="overview-make-first" @click="emit('makeFirstProject')">
                {{ t.overview.makeFirstProject }}
              </AppButton>
              <AppButton size="lg" data-testid="overview-open-editor" @click="emit('openEditor')">
                {{ t.overview.openEditor }}
              </AppButton>
            </span>
          </template>
          <template v-else>
            <AppButton variant="primary" size="lg" data-testid="overview-open-editor" @click="emit('openEditor')">
              {{ t.overview.openEditor }}
            </AppButton>
            <p class="overview__saved" data-testid="overview-saved">{{ projectsSaved }}</p>
          </template>
        </div>
      </section>

      <section class="overview__inside" aria-labelledby="overview-inside">
        <DrawnLayer section="inside" />
        <h2 id="overview-inside" class="overview__heading">{{ t.overview.whatsInside }}</h2>
        <FeatureCarousel :wide="pageWidth >= WIDE_FROM" />
      </section>

      <div class="overview__coffee">
        <DrawnLayer section="coffee" />
        <CoffeeTile />
      </div>

      <PlanTiles @open-editor="emit('openEditor')" />
    </main>
      </div>
    </div>
    <div class="overview__footer" data-testid="canvas-footer" />
  </div>
</template>

<style scoped>
/* The canvas box (ticket 540, ADR 0073): the screen, the Canvas strip on top, the content scrolling between it and the
 * empty Canvas footer, as the editor's box is laid out. */
.overview {
  position: fixed;
  inset: 0;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
  overflow: hidden;
  color: var(--ink);
  background: var(--box);
}

.overview__scroll {
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden auto;
  background: var(--canvas-bg, var(--canvas));
}

/* The zoom scales the content; the layout is made for the width it ends up with, so the text reflows and the page never
 * scrolls sideways. The drawn layer measures its placements from the main column's edge in this width. */
.overview__page {
  container: overview / inline-size;
}

/* The same height as the editor's Progress bar, so the box doesn't change between pages. */
.overview__footer {
  flex: none;
  height: var(--progress-height);
  border-top: 1px solid color-mix(in srgb, var(--box-muted) 22%, transparent);
}

.overview__main {
  box-sizing: border-box;
  max-width: 67.5rem;
  margin: 0 auto;
  padding: var(--space-32) var(--space-16) var(--space-32);
}

@container overview (min-width: 744px) {
  .overview__main {
    padding-right: var(--space-24);
    padding-left: var(--space-24);
  }
}

@container overview (min-width: 1024px) {
  .overview__main {
    padding-right: var(--space-32);
    padding-left: var(--space-32);
  }
}

@container overview (min-width: 1920px) {
  .overview__main {
    max-width: 75rem;
    padding-right: 2.5rem;
    padding-left: 2.5rem;
  }
}

.overview__hero,
.overview__inside,
.overview__coffee {
  /* The drawn layer (ticket 221) sits behind the section's content and never above it. */
  position: relative;
  isolation: isolate;
}

.overview__hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: var(--space-32) 0;
}

.overview__slogan {
  /* Steps up with the screen (Overview card): 40px phone, 58px from 744, 60px from 1024, 70px at 24″. */
  --slogan-size: 2.5rem;
  --slogan-line: 2.5rem;

  margin: 0;
  font: var(--type-tagline);
  font-size: var(--slogan-size);
  line-height: var(--slogan-line);
  letter-spacing: var(--tracking-tagline);
  color: var(--ink);
}

@container overview (min-width: 744px) {
  .overview__slogan {
    --slogan-size: 3.625rem;
    --slogan-line: 3.875rem;
  }
}

@container overview (min-width: 1024px) {
  .overview__slogan {
    --slogan-size: 3.75rem;
  }
}

@container overview (min-width: 1920px) {
  .overview__slogan {
    --slogan-size: 4.375rem;
    --slogan-line: 4.5rem;
  }
}

/* Russian runs longer: 20% smaller. */
.overview__slogan:lang(ru) {
  font-size: calc(var(--slogan-size) * 0.8);
  line-height: calc(var(--slogan-line) * 0.8);
}

.overview__slogan-last {
  color: var(--accent-strong);
}

.overview__slogan-first {
  position: relative;
  display: inline-block;
}

.overview__tagline {
  position: relative;
  margin: var(--space-16) 0 0;
  font: var(--type-meta);
  color: var(--muted);
}

.overview__tagline-text {
  display: inline-block;
}

/* The hand-written notes (Overview card): decorative, never over text, muted unless they say otherwise. */
.overview__note {
  position: absolute;
  font: var(--type-note);
  color: var(--muted);
  white-space: nowrap;
  pointer-events: none;
}

.overview__note--accent,
.overview__note--you {
  color: var(--accent-strong);
}

.overview__note--you {
  top: -0.75rem;
  left: -0.25rem;
  transform: rotate(-8deg);
}

.overview__aside {
  pointer-events: none;
}

.overview__arrow {
  overflow: visible;
  fill: none;
  stroke: var(--muted);
  stroke-width: 1.25;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* "on us": above the line's right end on a phone, beside it from 744. */
.overview__aside--us {
  position: absolute;
  top: 0;
  right: 0;
  left: auto;
}

.overview__aside--us .overview__note {
  top: -1.125rem;
  right: -0.25rem;
  transform: rotate(-6deg);
}

.overview__aside--us .overview__arrow {
  display: none;
}

@container overview (min-width: 744px) {
  .overview__aside--us {
    top: 0.0625rem;
    left: calc(100% + 0.25rem);
    right: auto;
  }

  .overview__aside--us .overview__note {
    top: 0;
    right: auto;
    left: 1.375rem;
  }

  .overview__aside--us .overview__arrow {
    display: block;
    margin-top: 0.4375rem;
  }
}

.overview__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: var(--space-12);
  margin-top: var(--space-24);
}

.overview__buttons {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: var(--space-12);
}

.overview__saved {
  margin: 0;
  font: var(--type-meta-small);
  color: var(--muted);
}

.overview__inside {
  padding: var(--space-16) 0;
}

.overview__coffee {
  margin-top: var(--space-16);
}

.overview__heading {
  margin: 0 0 var(--space-16);
  font: var(--type-serif-heading);
  letter-spacing: var(--tracking-serif-heading);
  color: var(--ink);
}
</style>
