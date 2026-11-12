<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from '../i18n/useI18n'
import CoffeeAction from './CoffeeAction.vue'
import CoffeeBand from './CoffeeBand.vue'
import CoffeeChips from './CoffeeChips.vue'
import GroupedList from './GroupedList.vue'
import WhatsNewFold from './WhatsNewFold.vue'
import { coffeeChips } from './coffeeCopy'

/** The Homepage's coffee screen (tickets 0811, 0823, 0880; Homepage card): the band with its row of chips, then What's
 * new folded under it; on a phone the chips as a grouped list between them (0827). Send feedback only asks for the
 * Feedback sheet; the page opens it as the Menu's row does. */
const props = defineProps<{
  /** Drawn for a phone: the chips apart from the band, as rows with their lines. */
  phone?: boolean
  /** Whether the Homepage shows this section: a chip or What's new left open is closed again once it is turned away. */
  shown?: boolean
}>()
const emit = defineEmits<{ feedback: [] }>()

const { t } = useI18n()
/** The rows a phone lists: not Keyboard shortcuts, as a phone has no keyboard to speak of. */
const phoneRows = computed(() => coffeeChips(t.value).filter((chip) => chip.id !== 'shortcuts'))
/** How many times the screen was turned away: the chips and What's new are drawn afresh, closed, each time. */
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
      <CoffeeChips v-if="!phone" :key="leftTimes" @feedback="emit('feedback')" />
    </CoffeeBand>
    <GroupedList v-if="phone" :rows="phoneRows" testid="homepage-promises" row-testid="homepage-promise">
      <template #action-openSource><CoffeeAction of="openSource" /></template>
      <template #action-sayHello><CoffeeAction of="sayHello" @feedback="emit('feedback')" /></template>
    </GroupedList>
    <WhatsNewFold :key="leftTimes" />
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
