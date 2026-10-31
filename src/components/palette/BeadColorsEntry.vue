<script setup lang="ts">
import { computed } from 'vue'
import type { Bead } from '../../domain/beads'
import { beadLabel } from '../../domain/beads'
import { fillBlanks } from '../../domain/fillBlanks'
import { useI18n } from '../../i18n/useI18n'
import AppButton from '../ui/AppButton.vue'
import InfoButton from '../ui/InfoButton.vue'

// The entry to the Bead's palette (BeadColors card, ticket 0746): "Palette {bead}" under the Palette grid, and while
// its list is open the Info button after it, whose Tooltip holds the notes the list no longer shows.
const props = defineProps<{ bead: Bead | undefined; open: boolean; testid: string }>()
defineEmits<{ toggle: [] }>()

const { t } = useI18n()
const words = computed(() => t.value.palette.beadColors)
const name = computed(() => fillBlanks(words.value.open, { bead: props.bead ? beadLabel(props.bead) : '' }))
</script>

<template>
  <div class="bead-colors-entry" :class="{ 'bead-colors-entry--open': open }">
    <AppButton class="bead-colors-entry__button" variant="in-box" size="sm" :trailing-icon="open ? 'chevron-up' : 'chevron-down'" :aria-expanded="open" :data-testid="testid" @click="$emit('toggle')">
      {{ name }}
    </AppButton>
    <InfoButton v-if="open" :label="words.info" :body="`${words.approximate} ${words.takenNote}`" data-testid="bead-colors-info" />
  </div>
</template>

<style scoped>
.bead-colors-entry {
  display: flex;
  align-items: center;
  align-self: flex-start;
  gap: var(--space-4);
}

/* Open, the entry takes the row: label at the left, chevron at the right edge, the Info button after it. */
.bead-colors-entry--open {
  align-self: stretch;
}

.bead-colors-entry--open .bead-colors-entry__button {
  flex: 1 1 auto;
  justify-content: flex-start;
  min-width: 0;
}

.bead-colors-entry--open .bead-colors-entry__button :deep(.app-button__trailing) {
  margin-left: auto;
}
</style>
