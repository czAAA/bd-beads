<script setup lang="ts">
import { computed } from 'vue'
import type { Bead } from '../../domain/beads'
import { beadLabel } from '../../domain/beads'
import type { MeasuredColorSource } from '../../domain/colorCatalog'
import { fillBlanks } from '../../domain/fillBlanks'
import { beadColorsNote } from '../../i18n/measuredColorWords'
import { useI18n } from '../../i18n/useI18n'
import AppButton from '../ui/AppButton.vue'
import InfoButton from '../ui/InfoButton.vue'

// The entry to the Bead's palette (BeadColors card, tickets 0746, 1092): "Add {bead} colors" under the Palette grid. The
// button is the same size open or closed and its chevron points where the list is, so a second press in the same place
// closes the list. While open the Info button follows it, with the notes the list doesn't show.
const props = defineProps<{
  bead: Bead | undefined
  open: boolean
  testid: string
  measuredFrom?: MeasuredColorSource
  /** Whether a row in the Palette can be pressed out of it. */
  removable?: boolean
  /** The list opens above the button (the colour popover, which grows upward) rather than under it. */
  opensAbove?: boolean
}>()
defineEmits<{ toggle: [] }>()

const { t } = useI18n()
const words = computed(() => t.value.palette.beadColors)
const name = computed(() => fillBlanks(words.value.open, { bead: props.bead ? beadLabel(props.bead) : '' }))
/** The chevron points where the list will open while it is closed, and back toward the button's side once it is open. */
const chevron = computed(() => {
  const towardList = props.opensAbove ? 'chevron-up' : 'chevron-down'
  const awayFromList = props.opensAbove ? 'chevron-down' : 'chevron-up'
  return props.open ? awayFromList : towardList
})
const note = computed(() => [beadColorsNote(t.value, props.measuredFrom), words.value.takenNote, ...(props.removable ? [words.value.removeNote] : [])].join(' '))
</script>

<template>
  <div class="bead-colors-entry">
    <AppButton class="bead-colors-entry__button" variant="in-box" size="sm" :trailing-icon="chevron" :aria-expanded="open" :data-testid="testid" @click="$emit('toggle')">
      {{ name }}
    </AppButton>
    <InfoButton v-if="open" :label="words.info" :body="note" data-testid="bead-colors-info" />
  </div>
</template>

<style scoped>
/* The button never changes size: where the row has no room for the Info button beside it, that goes under it. */
.bead-colors-entry {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  align-self: flex-start;
  gap: var(--space-4);
  max-width: 100%;
}

.bead-colors-entry__button {
  flex: none;
}
</style>
