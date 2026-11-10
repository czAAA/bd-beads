<script setup lang="ts">
import { computed } from 'vue'
import AppButton from '../components/ui/AppButton.vue'
import AppIcon from '../components/ui/AppIcon.vue'
import { controlAction } from '../composables/shell/controlRegistry'
import { useI18n } from '../i18n/useI18n'
import GroupedList from './GroupedList.vue'
import WelcomePiece from './WelcomePiece.vue'
import { welcomeCaption, welcomeCounts, welcomePromises } from './welcomeCopy'

// The Welcome section (Homepage card, ticket 0830): one calm tile before the demo. The heading and its line, the way
// into the editor (the page's one primary button) with See how it works beside it, the app's counts, a finished piece
// and three promises. On a phone the bar carries the way in, and the promises are a grouped list under the tile.
defineProps<{
  /** Drawn for a phone: no button, the promises apart from the tile. */
  phone?: boolean
  /** No Projects saved: the way in is Make your first Project. */
  isNew: boolean
  /** The Projects saved, which Projects library shows. */
  count: number
}>()
const emit = defineEmits<{ makeFirstProject: []; openEditor: []; openSavedProjects: []; seeHow: [] }>()

const { t, locale } = useI18n()
const counts = computed(() => welcomeCounts(t.value, locale.value))
const caption = computed(() => welcomeCaption(t.value))
const promises = computed(() => welcomePromises(t.value))
/** The Menu row's action, whose name Projects library shows with the count, as the strip's does (ticket 0716). */
const savedProjects = controlAction('saved-projects')
</script>

<template>
  <!-- Named by its own heading, which sits in the tile, as What's inside names its own. -->
  <section class="welcome" aria-labelledby="homepage-welcome" data-testid="homepage-welcome">
    <div class="welcome__tile">
      <!-- A sentence, balanced over as many lines as the tile's width asks: `data-wrap-ok` tells the fit check so. -->
      <h2 id="homepage-welcome" class="welcome__heading" data-wrap-ok>{{ t.homepage.welcome.heading }}</h2>
      <p class="welcome__line">{{ t.homepage.welcome.line }}</p>
      <div v-if="!phone" class="welcome__ways">
        <span class="welcome__way-in">
          <AppButton v-if="isNew" variant="primary" size="lg" data-testid="welcome-make-first" @click="emit('makeFirstProject')">
            {{ t.homepage.makeFirstProject }}
          </AppButton>
          <template v-else>
            <AppButton variant="primary" size="lg" data-testid="welcome-open-editor" @click="emit('openEditor')">
              {{ t.homepage.openEditor }}
            </AppButton>
            <AppButton size="lg" :action="savedProjects" data-testid="welcome-saved-projects" @click="emit('openSavedProjects')">
              {{ savedProjects.name(t) }} · {{ count }}
            </AppButton>
          </template>
        </span>
        <AppButton variant="text" size="lg" trailing-icon="arrow-down" data-testid="welcome-see-how" @click="emit('seeHow')">
          {{ t.homepage.welcome.seeHow }}
        </AppButton>
      </div>
      <p class="welcome__counts" data-testid="welcome-counts">{{ counts }}</p>
      <div class="welcome__show">
        <WelcomePiece />
        <p class="welcome__caption" data-testid="welcome-caption">{{ caption }}</p>
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

/* Under 744px: padding 24 20, the heading 34 on 38, the ways in and the promises one under another. */
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

.welcome__ways {
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
  align-items: center;
  margin-top: var(--space-24);
}

.welcome__way-in {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-8);
  justify-content: center;
}

/* `meta-small`'s face and size, never lowercased: the counts hold brand names. */
.welcome__counts,
.welcome__caption {
  margin: var(--space-14) 0 0;
  font: var(--type-meta-small);
  color: var(--muted);
}

/* The piece, its caption and the promises share the piece's width, so the hairline is as wide as the piece. */
.welcome__show {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: var(--welcome-piece-width);
  /* 30px, as the card has it. */
  margin-top: 1.875rem;
}

.welcome__caption {
  margin-top: var(--space-8);
}

.welcome__promises {
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
  align-self: stretch;
  /* 28px over the hairline, as the card has it. */
  margin: 1.75rem 0 0;
  padding: var(--space-20) 0 0;
  text-align: left;
  list-style: none;
  border-top: 1px solid var(--panel-rule);
}

.welcome__promise {
  position: relative;
  display: flex;
  flex: 1 1 0;
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

/* From 744px: padding 28 32 24, the heading 44 on 48, the ways in side by side, the promises side by side 32px apart. */
@container homepage (min-width: 744px) {
  .welcome__tile {
    padding: 1.75rem var(--space-32) var(--space-24);
  }

  .welcome__heading {
    font-size: var(--welcome-heading-size);
    line-height: 3rem;
  }

  .welcome__ways {
    flex-flow: row wrap;
    justify-content: center;
  }

  .welcome__promises {
    flex-direction: row;
    gap: var(--space-32);
  }
}

/* From 1000px: padding 36 60 30. */
@container homepage (min-width: 1000px) {
  .welcome__tile {
    padding: 2.25rem 3.75rem 1.875rem;
  }
}

/* On a phone: padding 20 18. */
@container homepage (max-width: 480px) {
  .welcome__tile {
    padding: var(--space-20) 1.125rem;
  }
}
</style>
