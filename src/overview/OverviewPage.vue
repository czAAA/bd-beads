<script setup lang="ts">
import { computed, watchEffect } from 'vue'
import AppButton from '../components/ui/AppButton.vue'
import AppLogo from '../components/ui/AppLogo.vue'
import AppMenu from '../components/ui/AppMenu.vue'
import AppMenuItem from '../components/ui/AppMenuItem.vue'
import LanguageSwitcher from '../components/shell/LanguageSwitcher.vue'
import ThemeToggle from '../components/shell/ThemeToggle.vue'
import FeatureCarousel from './FeatureCarousel.vue'
import TourBand from './TourBand.vue'
import { provideI18n } from '../i18n/useI18n'

/**
 * The Overview (ticket 77; Overview card): the page outside the editor that introduces bd-beads to someone new. The
 * header is the editor's own (logo, header menu, Language, Theme; no Keyboard shortcuts), then the slogan, the two
 * ways in and the features carousel (ticket 217). It only reports which way in was chosen: the entry decides where that goes.
 */
const props = defineProps<{
  /** How many Patterns this device has saved; none means a new visitor. */
  patternCount: number
  /** This page's own address, for the header menu's Overview item. */
  overviewHref: string
}>()
const emit = defineEmits<{ makeFirstPattern: []; openEditor: []; takeTour: [] }>()

const { t } = provideI18n()
watchEffect(() => {
  document.title = `${t.value.overview.pageTitle} · ${t.value.app.title}`
})

/** The slogan's first word carries the note "you". */
const sloganFirst = computed(() => t.value.overview.sloganLead.split(' ')[0]!)
const sloganRest = computed(() => t.value.overview.sloganLead.slice(sloganFirst.value.length))

const isNew = computed(() => props.patternCount === 0)
const patternsSaved = computed(() => t.value.overview.patternsSaved.replace('{count}', String(props.patternCount)))
</script>

<template>
  <div class="overview" data-testid="overview">
    <header class="overview__header">
      <h1 class="overview__brand">
        <AppLogo class="overview__mark" :size="22" />
        <span class="overview__name">{{ t.app.title }}</span>
      </h1>
      <span class="overview__menu">
        <AppMenu :label="t.header.menuButton" icon="menu" icon-only data-testid="header-menu">
          <AppMenuItem icon="bead" :href="overviewHref" current data-testid="menu-item-overview">
            {{ t.header.overviewItem }}
          </AppMenuItem>
          <AppMenuItem icon="info" data-testid="menu-item-tour" @select="emit('takeTour')">
            {{ t.header.tourItem }}
          </AppMenuItem>
        </AppMenu>
      </span>
      <span class="overview__gap" />
      <LanguageSwitcher />
      <ThemeToggle />
    </header>

    <main class="overview__main">
      <section class="overview__hero">
        <p class="overview__slogan" data-testid="overview-slogan">
          <span class="overview__slogan-first"
            >{{ sloganFirst
            }}<span v-if="isNew" class="overview__note overview__note--you" aria-hidden="true" data-testid="overview-note-you">{{
              t.overview.notes.you
            }}</span></span
          >{{ sloganRest }} <span class="overview__slogan-last">{{ t.overview.sloganLast }}</span>
        </p>
        <p class="overview__tagline">
          <span class="overview__tagline-text">{{ t.overview.tagline }}</span>
          <span v-if="isNew" class="overview__aside overview__aside--us" aria-hidden="true" data-testid="overview-note-on-us">
            <svg class="overview__arrow" width="18" height="8" viewBox="0 0 18 8"><path d="M17 4 H2 M6 1 L2 4 L6 7" /></svg>
            <span class="overview__note overview__note--accent">{{ t.overview.notes.onUs }}</span>
          </span>
        </p>
        <div class="overview__actions">
          <template v-if="isNew">
            <span class="overview__buttons">
              <AppButton variant="primary" size="lg" data-testid="overview-make-first" @click="emit('makeFirstPattern')">
                {{ t.overview.makeFirstPattern }}
              </AppButton>
              <AppButton size="lg" data-testid="overview-open-editor" @click="emit('openEditor')">
                {{ t.overview.openEditor }}
              </AppButton>
              <span class="overview__aside overview__aside--steps" aria-hidden="true" data-testid="overview-note-steps">
                <span class="overview__note">{{ t.overview.notes.elevenSteps }}</span>
                <svg class="overview__arrow" width="64" height="26" viewBox="0 0 64 26">
                  <path d="M4 10 C 22 2, 42 6, 58 18 M47 20 L59 19 L55 8" />
                </svg>
              </span>
            </span>
          </template>
          <template v-else>
            <AppButton variant="primary" size="lg" data-testid="overview-open-editor" @click="emit('openEditor')">
              {{ t.overview.openEditor }}
            </AppButton>
            <p class="overview__saved" data-testid="overview-saved">{{ patternsSaved }}</p>
          </template>
        </div>
        <div v-if="isNew" class="overview__band">
          <TourBand />
          <p class="overview__note overview__note--gold" aria-hidden="true" data-testid="overview-note-make-this">
            {{ t.overview.notes.youllMakeThis }}
          </p>
        </div>
      </section>

      <section class="overview__inside" aria-labelledby="overview-inside">
        <h2 id="overview-inside" class="overview__heading">{{ t.overview.whatsInside }}</h2>
        <FeatureCarousel />
      </section>
    </main>
  </div>
</template>

<style scoped>
.overview {
  min-height: 100vh;
  color: var(--ink);
  background: var(--surface);
}

.overview__header {
  display: flex;
  align-items: center;
  gap: var(--space-10);
  box-sizing: border-box;
  min-height: var(--header-height);
  padding: env(safe-area-inset-top) var(--space-32) 0;
  background: var(--canvas);
  border-bottom: 1px solid var(--line-soft);
}

@media (max-width: 743px) {
  .overview__header {
    min-height: var(--header-height-phone);
    gap: var(--space-4);
    padding-right: var(--space-16);
    padding-left: var(--space-16);
  }
}

@media (min-width: 1920px) {
  .overview__header {
    padding-right: 2.5rem;
    padding-left: 2.5rem;
  }
}

.overview__header > * {
  flex: none;
}

.overview__gap {
  flex: 1 1 0 !important;
}

.overview__brand {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  margin: 0 var(--space-10) 0 0;
}

.overview__mark {
  color: var(--accent);
}

.overview__name {
  font: var(--type-brand);
  letter-spacing: var(--tracking-brand);
  color: var(--ink);
}

.overview__main {
  box-sizing: border-box;
  max-width: 67.5rem;
  margin: 0 auto;
  padding: var(--space-32) var(--space-16) var(--space-32);
}

@media (min-width: 744px) {
  .overview__main {
    padding-right: var(--space-24);
    padding-left: var(--space-24);
  }
}

@media (min-width: 1024px) {
  .overview__main {
    padding-right: var(--space-32);
    padding-left: var(--space-32);
  }
}

@media (min-width: 1920px) {
  .overview__main {
    max-width: 75rem;
    padding-right: 2.5rem;
    padding-left: 2.5rem;
  }
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

@media (min-width: 744px) {
  .overview__slogan {
    --slogan-size: 3.625rem;
    --slogan-line: 3.875rem;
  }
}

@media (min-width: 1024px) {
  .overview__slogan {
    --slogan-size: 3.75rem;
  }
}

@media (min-width: 1920px) {
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
  font-size: 1.125rem;
  letter-spacing: 0;
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

@media (min-width: 744px) {
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

/* "eleven small steps": only from 1024, where there is room left of the buttons. */
.overview__aside--steps {
  display: none;
}

@media (min-width: 1024px) {
  .overview__aside--steps {
    display: block;
    position: absolute;
    top: 0;
    right: calc(100% + var(--space-8));
  }

  .overview__aside--steps .overview__note {
    top: 0.25rem;
    right: 4.75rem;
  }

  .overview__aside--steps .overview__arrow {
    position: absolute;
    top: 0.875rem;
    right: 0;
  }
}

.overview__band {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 55rem;
  margin-top: var(--space-24);
}

.overview__note--gold {
  position: static;
  margin: var(--space-8) 0 0;
  color: var(--note-gold);
  text-align: center;
}

.overview__saved {
  margin: 0;
  font: var(--type-meta-small);
  color: var(--muted);
}

.overview__inside {
  padding: var(--space-16) 0;
}

.overview__heading {
  margin: 0 0 var(--space-16);
  font: var(--type-serif-heading);
  letter-spacing: var(--tracking-serif-heading);
  color: var(--ink);
}
</style>
