<script setup lang="ts">
import { computed, ref } from 'vue'
import AppButton from '../components/ui/AppButton.vue'
import AppIcon from '../components/ui/AppIcon.vue'
import { useFittingForm } from '../composables/canvas/useFittingForm'
import { useElementSize } from '../composables/ui/useElementSize'
import { controlAction } from '../composables/shell/controlRegistry'
import { useI18n } from '../i18n/useI18n'
import GroupedList from './GroupedList.vue'
import WelcomeCuff from './WelcomeCuff.vue'
import { welcomeHeading, welcomeLine, welcomePromises } from './welcomeCopy'

// The Welcome section (Homepage card, tickets 0830, 1157): the heading, its line, the way in (two `2xl` buttons: the one
// primary and Projects library or, new, Start from a ready design, 0953), the cuff being woven with Row progress, and
// four promises. On a phone the bar carries the way in, and the promises are a grouped list under the tile.
const props = defineProps<{
  /** Drawn for a phone: no button, the promises apart from the tile. */
  phone?: boolean
  /** No Projects saved: the way in is Make your first Project. */
  isNew: boolean
  /** The Projects saved, which Projects library shows. */
  count: number
  /** Whether Welcome is the section shown: the cuff weaves by itself only then. */
  shown?: boolean
}>()
const emit = defineEmits<{ makeFirstProject: []; openEditor: []; openSavedProjects: []; startFromStarter: [] }>()

const { t, locale } = useI18n()
const heading = computed(() => welcomeHeading(t.value, locale.value))
const line = computed(() => welcomeLine(t.value, locale.value))
const promises = computed(() => welcomePromises(t.value))
/** The Menu row's action, whose name Projects library shows with the count, as the strip's does (ticket 0716). */
const savedProjects = controlAction('saved-projects')

const WAY_IN_SIZES = ['2xl', 'xl'] as const

/** How wide a row's children stand with the gaps between them; centred, an overflow runs off both ends, so the row's
 * own scroll width would count only half of it. */
function rowWidth(row: HTMLElement | null): number {
  if (!row) return 0
  const children = [...row.children] as HTMLElement[]
  const gap = parseFloat(getComputedStyle(row).columnGap) || 0
  return children.reduce((width, child) => width + child.offsetWidth, 0) + gap * Math.max(0, children.length - 1)
}

/** The way in at twice `lg` where both buttons fit on one row, a size down where they don't (a longer language, a
 * narrower tile), and wrapping only where neither fits (ticket 1130). */
const wayIn = ref<HTMLElement | null>(null)
const { width: wayInRoom } = useElementSize(wayIn)
const wayInFit = useFittingForm({
  forms: () => WAY_IN_SIZES,
  room: () => wayInRoom.value,
  measure: () => rowWidth(wayIn.value),
  observed: () => [...(wayIn.value?.children ?? [])],
  labels: () => `${locale.value} ${props.isNew} ${props.count}`,
})
/** Neither size fitting, the smaller one wraps. */
const wayInSize = computed(() => wayInFit.value ?? 'xl')
</script>

<template>
  <!-- Named by its own heading, which sits in the tile, as What's inside names its own. -->
  <section class="welcome" aria-labelledby="homepage-welcome" data-testid="homepage-welcome">
    <div class="welcome__tile">
      <!-- A sentence, balanced over as many lines as the tile's width asks: `data-wrap-ok` tells the fit check so. -->
      <!-- The page's one h1 (ticket 0995): the sections under it are h2s. -->
      <h1 id="homepage-welcome" class="welcome__heading" data-wrap-ok>{{ heading }}</h1>
      <p class="welcome__line">{{ line }}</p>
      <!-- The way in, twice the `lg` size: two buttons, so a new visitor's second is Start from a ready design. -->
      <div v-if="!phone" ref="wayIn" class="welcome__way-in" :class="{ 'welcome__way-in--wraps': !wayInFit }">
        <template v-if="isNew">
          <AppButton variant="primary" :size="wayInSize" data-testid="welcome-make-first" @click="emit('makeFirstProject')">
            {{ t.homepage.makeFirstProject }}
          </AppButton>
          <!-- The first Project, made at once, open on the Frame panel's Starter gallery (ticket 0953). -->
          <AppButton :size="wayInSize" icon="frame" data-testid="welcome-start-from-starter" @click="emit('startFromStarter')">
            {{ t.homepage.welcome.startFromStarter }}
          </AppButton>
        </template>
        <template v-else>
          <AppButton variant="primary" :size="wayInSize" data-testid="welcome-open-editor" @click="emit('openEditor')">
            {{ t.homepage.openEditor }}
          </AppButton>
          <AppButton :size="wayInSize" :action="savedProjects" data-testid="welcome-saved-projects" @click="emit('openSavedProjects')">
            {{ savedProjects.name(t) }} · {{ count }}
          </AppButton>
        </template>
      </div>
      <WelcomeCuff class="welcome__cuff" :shown="shown ?? false" />
      <!-- The promises: an icon, a name and its line each, nothing to press. -->
      <ul v-if="!phone" class="welcome__promises" data-testid="welcome-promises">
        <li v-for="promise in promises" :key="promise.id" class="welcome__promise" :data-testid="`welcome-promise-${promise.id}`">
          <AppIcon class="welcome__promise-icon" :name="promise.icon" :size="18" />
          <span class="welcome__promise-words">
            <span class="welcome__promise-name">{{ promise.name }}</span>
            <!-- The stop keeps a screen reader from running the name into its line. -->
            <span class="welcome__stop">. </span>
            <span class="welcome__promise-line">{{ promise.text }}</span>
          </span>
        </li>
      </ul>
    </div>
    <GroupedList v-if="phone" :rows="promises" testid="welcome-promises" row-testid="welcome-promise" />
  </section>
</template>

<style scoped>
/* The tile, at most `--welcome-tile-width` wide, centred; on a phone the promises' list 12px under it. */
.welcome {
  display: flex;
  flex: none;
  flex-direction: column;
  gap: var(--space-12);
  width: 100%;
  max-width: var(--welcome-tile-width);
  margin: 0 auto;
}

/* Under 744px: padding 24 20, the heading 34 on 38. */
.welcome__tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  box-sizing: border-box;
  padding: var(--space-24) var(--space-20);
  text-align: center;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: var(--radius-lg);
}

.welcome__heading {
  margin: 0;
  font: var(--type-serif-heading);
  letter-spacing: var(--tracking-serif-heading);
  color: var(--ink);
  text-wrap: balance;
}

/* Inter 16 on 24. */
.welcome__line {
  margin: var(--space-8) 0 0;
  font: 400 1rem/1.5rem var(--font-sans);
  color: var(--body);
}

/* The two big buttons 16px apart on one row, as wide as they need: a row too wide steps them a size down, and only
   where neither size fits do they take a row each. */
.welcome__way-in {
  display: flex;
  gap: var(--space-16);
  justify-content: center;
  width: 100%;
  margin-top: var(--space-24);
}

.welcome__way-in > * {
  flex: none;
}

.welcome__way-in--wraps {
  flex-wrap: wrap;
}

/* 18px under the way in, as the card has it. */
.welcome__cuff {
  margin-top: 1.125rem;
}

/* The tile's width, inside its padding, under a hairline: one under another, two by two from 744, four across from
 * 1000, 24px apart. */
.welcome__promises {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-12) var(--space-24);
  align-self: stretch;
  /* 22px over the hairline, as the card has it. */
  margin: 1.375rem 0 0;
  padding: var(--space-20) 0 0;
  text-align: left;
  list-style: none;
  border-top: 1px solid var(--panel-rule);
}

.welcome__promise {
  position: relative;
  display: flex;
  gap: var(--space-10);
  align-items: flex-start;
  min-width: 0;
}

.welcome__promise-icon {
  flex: none;
  color: var(--accent-strong);
}

.welcome__promise-words {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
}

.welcome__promise-name {
  font: var(--type-control);
  color: var(--ink);
}

.welcome__promise-line {
  font: var(--type-inside-line);
  color: var(--body);
}

.welcome__stop {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

/* From 744px: padding 28 32 24, the heading 44 on 48, the promises two by two. */
@container homepage (min-width: 744px) {
  .welcome__tile {
    padding: 1.75rem var(--space-32) var(--space-24);
  }

  .welcome__heading {
    font-size: var(--welcome-heading-size);
    line-height: 3rem;
  }

  .welcome__promises {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

/* From 1000px: padding 36 60 30, the promises four across. */
@container homepage (min-width: 1000px) {
  .welcome__tile {
    padding: 2.25rem 3.75rem 1.875rem;
  }

  .welcome__promises {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

/* On a phone: padding 20 18. */
@container homepage (max-width: 480px) {
  .welcome__tile {
    padding: var(--space-20) 1.125rem;
  }
}
</style>
