<script setup lang="ts">
import { computed } from 'vue'
import { useConvertImageWizardState } from '../../composables/import/useConvertImageWizard'
import { beadColorFilterCounts } from '../../domain/beadColorFilter'
import { FINISHES } from '../../domain/colorCatalog'
import { fillBlanks } from '../../domain/fillBlanks'
import { useI18n } from '../../i18n/useI18n'
import MenuButton from '../ui/MenuButton.vue'
import BeadColorFilters from '../palette/BeadColorFilters.vue'

// The Colors popover's Finish button and its list (ConvertImage card DS-2, ticket 0901): the Palette popover's own Finish
// filter (BeadColorFilters with no families), keeping the match to the Finishes on. Off under Default Palette and Exact,
// whose colors have no Finish; the Finishes are kept for the Bead's palette again.
defineProps<{ codes: string }>()

const { t } = useI18n()
const wizard = useConvertImageWizardState()
const words = computed(() => t.value.convertImage.wizard.finish)
const listWords = computed(() => t.value.palette.beadColors)

const count = computed(() => wizard.finishesApplied.value.length)
const offBody = computed(() => {
  const source = wizard.source.value
  return source === 'exact' ? words.value.offExact : source === 'default' ? words.value.offDefault : undefined
})

/** The Finishes the Bead's size has, in the shared order, each with its live count among the source's codes. */
const finishes = computed(() => {
  const present = new Set(wizard.beadTargets.value.map((target) => target.finish))
  const counts = beadColorFilterCounts(wizard.sourceBeadTargets.value, { families: [], finishes: wizard.finishes.value }).finishes
  return FINISHES.filter((finish) => present.has(finish)).map((finish) => ({
    finish,
    name: listWords.value.finishes[finish],
    on: wizard.finishes.value.includes(finish),
    count: counts.get(finish) ?? 0,
  }))
})
</script>

<template>
  <div class="convert-finish">
    <MenuButton
      :label="listWords.finishFilter"
      popover
      align="end"
      :disabled="!!offBody"
      :disabled-body="offBody"
      :aria-label="count > 0 ? fillBlanks(words.buttonOn, { count }) : undefined"
      data-testid="convert-finish"
    >
      <template #label>
        {{ listWords.finishFilter }}
        <span v-if="count > 0" class="convert-finish__badge" aria-hidden="true" data-testid="convert-finish-badge">{{ count }}</span>
      </template>
      <div class="convert-finish__list" data-testid="convert-finish-list">
        <BeadColorFilters
          class="convert-finish__filters"
          :families="[]"
          :finishes="finishes"
          :any-on="wizard.finishes.value.length > 0"
          :open="true"
          @toggle-finish="wizard.toggleFinish"
          @clear="wizard.clearFinishes"
        />
        <span class="convert-finish__codes" data-testid="convert-finish-codes">{{ codes }}</span>
      </div>
    </MenuButton>
  </div>
</template>

<style scoped>
.convert-finish {
  flex: none;
}

/* The list under the button (DS-2): its own width and padding, not a settings popover's. */
.convert-finish :deep(.menu-button__list--popover) {
  width: var(--convert-finish-list-width);
  padding: var(--space-8) var(--space-6);
  border-radius: var(--radius-lg);
}

/* Open: a 1.5px ink edge, as the column's Bead button open (ticket 0896). */
.convert-finish :deep(.app-button[aria-expanded='true']) {
  border-color: var(--ink);
  box-shadow: inset 0 0 0 0.5px var(--ink);
}

.convert-finish__badge {
  box-sizing: border-box;
  min-width: var(--filter-badge);
  height: var(--filter-badge);
  padding: 0 var(--space-6);
  font: var(--type-meta-tiny);
  line-height: var(--filter-badge);
  color: var(--canvas);
  text-align: center;
  background: var(--ink);
  border-radius: var(--radius-full);
}

.convert-finish__list {
  display: flex;
  flex-direction: column;
}

.convert-finish__filters {
  padding: 0;
  background: transparent;
}

.convert-finish__codes {
  margin-top: var(--space-8);
  padding: var(--space-8) var(--space-6) var(--space-2);
  font: var(--type-meta-small);
  color: var(--muted);
  border-top: 1px solid var(--line-soft);
}
</style>
