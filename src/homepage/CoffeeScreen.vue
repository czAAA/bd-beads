<script setup lang="ts">
import { computed } from 'vue'
import AppButton from '../components/ui/AppButton.vue'
import { SOURCE_URL } from '../data/sourceLink'
import { useI18n } from '../i18n/useI18n'
import CoffeeBand from './CoffeeBand.vue'
import CoffeeScreenTile from './CoffeeScreenTile.vue'
import WhatsNewTile from './WhatsNewTile.vue'
import { sayHelloText } from './coffeeCopy'

/** The Homepage's coffee screen (tickets 0811, 0823, 0824; Homepage card): the band, then the tiles in a row under it.
 * Send feedback only asks for the Feedback sheet; the page opens it as the Menu's row does. */
const emit = defineEmits<{ feedback: [] }>()

const { t } = useI18n()
const sayHello = computed(() => sayHelloText(t.value))
</script>

<template>
  <div class="coffee-screen" data-testid="homepage-coffee">
    <CoffeeBand />
    <div class="coffee-screen__tiles" data-testid="homepage-tiles">
      <WhatsNewTile />
      <CoffeeScreenTile icon="code" :name="t.homepage.openSource.name" data-testid="homepage-tile-open-source">
        <p>{{ t.homepage.openSource.text }}</p>
        <template #foot>
          <AppButton size="sm" trailing-icon="external" :href="SOURCE_URL" data-testid="homepage-coffee-source">{{ t.homepage.coffee.source }}</AppButton>
          <small class="coffee-screen__star">{{ t.homepage.coffee.star }}</small>
        </template>
      </CoffeeScreenTile>
      <CoffeeScreenTile icon="message" :name="t.homepage.sayHello.name" data-testid="homepage-tile-say-hello">
        <p>{{ sayHello }}</p>
        <template #foot>
          <AppButton size="sm" data-testid="homepage-send-feedback" @click="emit('feedback')">{{ t.panels.menu.sendFeedback }}</AppButton>
        </template>
      </CoffeeScreenTile>
    </div>
  </div>
</template>

<style scoped>
/* The band, then the tiles, 12px apart, at most 60rem wide, centred. */
.coffee-screen {
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
  width: 100%;
  max-width: 60rem;
  margin: 0 auto;
}

/* The tiles one under another on a phone, side by side from 481, top-aligned: a tile added is one more column. */
.coffee-screen__tiles {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: start;
  gap: var(--space-12);
}

@container homepage (min-width: 481px) {
  .coffee-screen__tiles {
    grid-template-columns: none;
    grid-auto-columns: minmax(0, 1fr);
    grid-auto-flow: column;
  }
}

.coffee-screen__star {
  font: var(--type-meta-small);
  color: var(--muted);
}
</style>
