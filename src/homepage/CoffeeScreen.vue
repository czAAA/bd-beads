<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from '../i18n/useI18n'
import CoffeeAction from './CoffeeAction.vue'
import CoffeeBand from './CoffeeBand.vue'
import CoffeePromises from './CoffeePromises.vue'
import GroupedList from './GroupedList.vue'
import WhatsNewFold from './WhatsNewFold.vue'
import { coffeeRows } from './coffeeCopy'
import type { NotesSource } from '../services/notesFile'

/** The Homepage's coffee screen (tickets 0811, 0823, 0880, 0948; Homepage card): the band with its promises, then What's
 * new folded under it; on a phone the promises as a grouped list between them (0827). Send feedback only asks for the
 * Feedback sheet; the page opens it as the Menu's row does. */
const props = defineProps<{
  /** Drawn for a phone: the promises apart from the band, as rows with their lines. */
  phone?: boolean
  /** Whether the Homepage shows this section: What's new left open is closed again once it is turned away. */
  shown?: boolean
  /** Reads What's new's notes file (ticket 1047). */
  notes?: NotesSource
}>()
const emit = defineEmits<{ feedback: [] }>()

const { t } = useI18n()
/** The rows a phone lists: not Keyboard shortcuts, as a phone has no keyboard to speak of. */
const phoneRows = computed(() => coffeeRows(t.value).filter((row) => row.id !== 'shortcuts'))
/** How many times the screen was turned away: What's new is drawn afresh, closed, each time. */
const leftTimes = ref(0)
watch(
  () => props.shown,
  (shown) => {
    if (shown === false) leftTimes.value++
  },
)
</script>

<template>
  <div class="coffee-screen" data-testid="homepage-coffee">
    <CoffeeBand>
      <CoffeePromises v-if="!phone" @feedback="emit('feedback')" />
    </CoffeeBand>
    <GroupedList v-if="phone" :rows="phoneRows" testid="homepage-promises" row-testid="homepage-promise">
      <template #action-openSource><CoffeeAction of="openSource" /></template>
      <template #action-sayHello><CoffeeAction of="sayHello" @feedback="emit('feedback')" /></template>
    </GroupedList>
    <WhatsNewFold :key="leftTimes" :notes="notes" />
  </div>
</template>

<style scoped>
/* The band, then What's new, 12px apart, at most 60rem wide, centred. */
.coffee-screen {
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
  width: 100%;
  max-width: 60rem;
  margin: 0 auto;
}
</style>
