<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useConvertImageWizardState } from '../../composables/import/useConvertImageWizard'
import { useConvertSizeReadings } from '../../composables/import/useConvertSizeReadings'
import { estimatedGrams, formatGrams } from '../../domain/beadQuantities'
import { fillBlanks } from '../../domain/fillBlanks'
import { groupThousands } from '../../domain/formatNumber'
import { plural, pluralForm } from '../../i18n/plural'
import { useI18n } from '../../i18n/useI18n'
import AppButton from '../ui/AppButton.vue'

// The converter column's foot (ConvertImage card DS-1, ticket 0897): the Project's name, asked once on the New Project
// form, the result in three lines, and Create Project (Add to Canvas from a reference image), on screen from the first
// second and off until a picture is read. Pressing it makes the Project at once: there is nothing more to confirm.
const emit = defineEmits<{ create: [] }>()

const { t, locale } = useI18n()
const wizard = useConvertImageWizardState()
const words = computed(() => t.value.convertImage.wizard)
const result = useConvertSizeReadings(wizard).result
/** A picture is read and none is being read: the button is on. */
const ready = computed(() => wizard.hasPicture.value && !wizard.reading.value)

/** The beads the Project will hold and, where the Bead has a weight, about how much they weigh (BeadsNeeded card). */
const beadsNeeded = computed(() => {
  const count = groupThousands(wizard.beadCount.value, locale.value)
  const grams = estimatedGrams(wizard.beadCount.value, wizard.bead.value)
  if (grams === undefined) return fillBlanks(words.value.resultBeadsNeededCount, { count })
  return fillBlanks(words.value.resultBeadsNeeded, { count, grams: formatGrams(grams, t.value.quantities.gramsUnit, locale.value) })
})

/** The result: the size, the colors (a kept part's, with the whole it was kept from), the beads needed. */
const lines = computed(() => {
  const shown = result.value?.kept ?? result.value
  if (!ready.value || !shown) return undefined
  // Too few codes in the Finishes on (ticket 0901), or a My beads list shorter than the count asked (ticket 0902), says
  // why fewer come out.
  const used = wizard.usedColorCount.value
  const finish = words.value.finish
  const colors = wizard.finishesShort.value
    ? fillBlanks(finish.colorsShort, { colors: plural(locale.value, used, words.value.colorsCount), codes: plural(locale.value, wizard.codesLeft.value, finish.codesLeft) })
    : wizard.myBeadsShort.value
    ? fillBlanks(pluralForm(locale.value, used, words.value.myBeads.fewerColors), { codes: groupThousands(wizard.myBeadsTargets.value.length, locale.value) }, { count: groupThousands(used, locale.value) })
    : plural(locale.value, used, words.value.colorsCount)
  const kept = result.value?.kept && fillBlanks(words.value.resultKeptFrom, { columns: wizard.dimensions.value.columns, rows: wizard.dimensions.value.rows })
  return {
    grid: shown.grid,
    measured: shown.measured,
    colors: kept ? `${colors} · ${kept}` : colors,
    beads: beadsNeeded.value,
    goesWhere: wizard.addsToCanvas ? words.value.resultGoesWhere : undefined,
  }
})

/** What a screen reader hears: the result once a change has settled, not every step of a slider's move. */
const ANNOUNCE_AFTER_MS = 600
const heard = ref('')
let timer: ReturnType<typeof setTimeout> | undefined
const said = computed(() => {
  const shown = lines.value
  return shown ? [`${shown.grid} · ${shown.measured}`, shown.colors, shown.beads, shown.goesWhere].filter(Boolean).join('. ') : ''
})
watch(
  said,
  (next) => {
    clearTimeout(timer)
    timer = setTimeout(() => (heard.value = next), ANNOUNCE_AFTER_MS)
  },
  { immediate: true },
)
onBeforeUnmount(() => clearTimeout(timer))

const buttonLabel = computed(() => (wizard.addsToCanvas ? t.value.convertImage.addToCanvas : t.value.convertImage.createButton))
</script>

<template>
  <div class="convert-foot" data-testid="convert-foot">
    <template v-if="lines">
      <p class="convert-foot__project" data-testid="convert-project-line">
        <span class="convert-foot__label">{{ wizard.addsToCanvas ? words.footAddsTo : words.footProject }}</span> <span class="convert-foot__name">{{ wizard.projectName.value }}</span>
      </p>
      <p class="convert-foot__result" aria-hidden="true" data-testid="convert-result">
        <span data-testid="convert-result-size"><b>{{ lines.grid }}</b> · {{ lines.measured }}</span>
        <span data-testid="convert-result-colors">{{ lines.colors }}</span>
        <span class="convert-foot__muted" data-testid="convert-result-beads">{{ lines.beads }}</span>
        <span v-if="lines.goesWhere" class="convert-foot__muted" data-testid="convert-result-goes-where">{{ lines.goesWhere }}</span>
      </p>
    </template>
    <p v-else class="convert-foot__result convert-foot__muted" data-testid="convert-result-none">
      {{ wizard.reading.value ? words.readingLine : words.bandEmpty }}
    </p>
    <p class="convert-foot__heard" role="status" data-testid="convert-result-heard">{{ heard }}</p>
    <AppButton
      variant="primary"
      class="convert-foot__create"
      :disabled="!ready"
      :disabled-body="words.addPictureFirst"
      :label="buttonLabel"
      data-testid="convert-image-create"
      @click="emit('create')"
    >
      {{ buttonLabel }}
    </AppButton>
  </div>
</template>

<style scoped>
/* Pinned to the column's bottom whatever the column holds above, so Create Project is always whole on screen. */
.convert-foot {
  position: sticky;
  bottom: 0;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
  margin-top: auto;
  padding: var(--space-14) var(--space-20) var(--space-20);
  background: var(--canvas);
  border-top: 1px solid var(--line-soft);
}

.convert-foot__project {
  margin: 0;
  font: var(--type-control);
  overflow-wrap: anywhere;
}

.convert-foot__label {
  font: var(--type-label);
  color: var(--muted);
}

.convert-foot__name {
  font: var(--type-control);
  color: var(--ink);
}

.convert-foot__result {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: 0;
  font: var(--type-meta);
  color: var(--body);
}

.convert-foot__result b {
  font-weight: 500;
  color: var(--ink);
}

.convert-foot__muted {
  color: var(--muted);
}

.convert-foot__heard {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.convert-foot :deep(.app-button-wrap) {
  display: flex;
}

.convert-foot :deep(.convert-foot__create.app-button) {
  width: 100%;
  height: var(--field-height);
}

/* Stacked under the preview (under 1024 px or in portrait) the foot ends the column's flow (the phone's is ticket 0911). */
@media (max-width: 63.99rem), (orientation: portrait) {
  .convert-foot {
    position: relative;
  }
}

@media (pointer: coarse) {
  .convert-foot :deep(.convert-foot__create.app-button) {
    height: var(--touch-target);
  }
}
</style>
