<script setup lang="ts">
import { computed, watchEffect } from 'vue'
import AppButton from '../components/AppButton.vue'
import AppIcon from '../components/AppIcon.vue'
import AppLogo from '../components/AppLogo.vue'
import AppMenu from '../components/AppMenu.vue'
import AppMenuItem from '../components/AppMenuItem.vue'
import LanguageSwitcher from '../components/LanguageSwitcher.vue'
import ThemeToggle from '../components/ThemeToggle.vue'
import type { IconName } from '../components/icons'
import { provideI18n } from '../i18n/useI18n'
import type { Translations } from '../i18n/translations'

/**
 * The Overview (ticket 77; Overview card): the page outside the editor that introduces bd-beads to someone new. The
 * header is the editor's own (logo, header menu, Language, Theme; no Keyboard shortcuts), then the slogan, the two
 * ways in and one line per feature. It only reports which way in was chosen: the entry decides where that goes.
 */
const props = defineProps<{
  /** How many Patterns this device has saved; none means a new visitor. */
  patternCount: number
  /** This page's own address, for the header menu's Overview item. */
  overviewHref: string
}>()
const emit = defineEmits<{ makeFirstPattern: []; openEditor: [] }>()

const { t } = provideI18n()
watchEffect(() => {
  document.title = `${t.value.overview.pageTitle} · ${t.value.app.title}`
})

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
        </AppMenu>
      </span>
      <span class="overview__gap" />
      <LanguageSwitcher />
      <ThemeToggle />
    </header>

    <main class="overview__main">
      <section class="overview__hero">
        <p class="overview__slogan" data-testid="overview-slogan">
          {{ t.overview.sloganLead }} <span class="overview__slogan-last">{{ t.overview.sloganLast }}</span>
        </p>
        <p class="overview__tagline">{{ t.overview.tagline }}</p>
        <div class="overview__actions">
          <template v-if="isNew">
            <AppButton variant="primary" size="lg" data-testid="overview-make-first" @click="emit('makeFirstPattern')">
              {{ t.overview.makeFirstPattern }}
            </AppButton>
            <AppButton size="lg" data-testid="overview-open-editor" @click="emit('openEditor')">
              {{ t.overview.openEditor }}
            </AppButton>
          </template>
          <template v-else>
            <AppButton variant="primary" size="lg" data-testid="overview-open-editor" @click="emit('openEditor')">
              {{ t.overview.openEditor }}
            </AppButton>
            <p class="overview__saved" data-testid="overview-saved">{{ patternsSaved }}</p>
          </template>
        </div>
      </section>

      <section class="overview__inside" aria-labelledby="overview-inside">
        <h2 id="overview-inside" class="overview__heading">{{ t.overview.whatsInside }}</h2>
        <ul class="overview__features" data-testid="overview-features">
          <li v-for="feature in FEATURES" :key="feature.key" class="overview__feature" :data-feature="feature.key">
            <AppIcon :name="feature.icon" :size="22" class="overview__feature-icon" />
            <p class="overview__feature-text">
              <strong class="overview__feature-name">{{ t.overview.features[feature.key].name }}</strong>
              <span class="overview__feature-line">{{ t.overview.features[feature.key].text }}</span>
            </p>
          </li>
        </ul>
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

.overview__tagline {
  margin: var(--space-16) 0 0;
  font: var(--type-meta);
  color: var(--muted);
}

.overview__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: var(--space-12);
  margin-top: var(--space-24);
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

.overview__features {
  display: grid;
  gap: var(--space-4);
  margin: 0;
  padding: 0;
  list-style: none;
}

.overview__feature {
  display: flex;
  align-items: flex-start;
  gap: var(--space-14);
  padding: var(--space-12) var(--space-4);
  border-bottom: 1px solid var(--line-soft);
}

.overview__feature-icon {
  flex: none;
  margin-top: var(--space-2);
  color: var(--ink);
}

.overview__feature-text {
  display: flex;
  flex-wrap: wrap;
  gap: 0 var(--space-8);
  margin: 0;
  font: var(--type-body);
  color: var(--body);
}

.overview__feature-name {
  font: var(--type-title);
  color: var(--ink);
}
</style>
