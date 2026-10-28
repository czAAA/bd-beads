<script setup lang="ts">
import { computed, ref } from 'vue'
import { useConvertImageWizardState } from '../../composables/import/useConvertImageWizard'
import { useMediaQuery } from '../../composables/ui/useMediaQuery'
import { computeColorQuantities, estimatedGrams, formatGrams } from '../../domain/beadQuantities'
import { formFactorName } from '../../domain/beads'
import { fillBlanks } from '../../domain/fillBlanks'
import { groupThousands } from '../../domain/formatNumber'
import { projectPalette } from '../../domain/palette'
import { beadsPerGram, formatPrintedGrams, printedGrams, tubesToBuy } from '../../domain/printGrams'
import { listedColorName } from '../../i18n/colorName'
import { useI18n } from '../../i18n/useI18n'
import AppButton from '../ui/AppButton.vue'
import AppNote from '../ui/AppNote.vue'
import NamesSection from '../project/NamesSection.vue'

// Convert image's Review section (ConvertImage card, 5 Review): Name and Maker's name, and the summary of what Create
// Project makes (size, colors, Beads needed with Estimated weight and tubes to buy, then one row per color), the
// per-color rows behind Show details on a phone.
const { t, locale } = useI18n()
const wizard = useConvertImageWizardState()
const words = computed(() => t.value.convertImage.wizard)
const phone = useMediaQuery('(max-width: 63.99rem), (orientation: portrait)')
const detailsShown = ref(false)

const project = computed(() => wizard.draftProject.value)
const palette = computed(() => project.value && projectPalette(project.value))
const quantities = computed(() => (project.value && palette.value ? computeColorQuantities(project.value, palette.value) : []))
const bead = computed(() => wizard.bead.value)
const total = computed(() => quantities.value.reduce((sum, quantity) => sum + quantity.count, 0))

const grams = (count: number) => {
  const weight = printedGrams(count, bead.value)
  return weight === undefined ? undefined : formatPrintedGrams(weight, locale.value, t.value.quantities.gramsUnit)
}
const tubesOf = (count: number) => {
  const weight = printedGrams(count, bead.value)
  return weight === undefined ? undefined : tubesToBuy(weight)
}
const tubes = (count: number) => fillBlanks(t.value.print.tubes, { count: groupThousands(count, locale.value) })

const rows = computed(() =>
  quantities.value.map((quantity) => {
    const color = palette.value?.byId(quantity.colorId)
    const tubeCount = tubesOf(quantity.count)
    return {
      hex: quantity.hex,
      name: color?.code ?? listedColorName(t.value, color, quantity.hex),
      beads: groupThousands(quantity.count, locale.value),
      grams: grams(quantity.count),
      tubes: tubeCount === undefined ? undefined : tubes(tubeCount),
    }
  }),
)

const summary = computed(() => {
  const weight = estimatedGrams(total.value, bead.value)
  const tubeCounts = quantities.value.map((quantity) => tubesOf(quantity.count))
  const tubeTotal = tubeCounts.some((count) => count === undefined) ? undefined : tubeCounts.reduce((sum, count) => sum! + count!, 0)
  const { columns, rows: gridRows } = wizard.dimensions.value
  return [
    { label: words.value.summarySize, value: fillBlanks(words.value.resultGrid, { columns, rows: gridRows }) },
    { label: words.value.summaryColors, value: groupThousands(quantities.value.length, locale.value) },
    { label: words.value.summaryBeadsNeeded, value: groupThousands(total.value, locale.value) },
    ...(weight === undefined ? [] : [{ label: words.value.summaryWeight, value: `≈ ${formatGrams(weight, t.value.quantities.gramsUnit, locale.value)}` }]),
    ...(tubeTotal === undefined ? [] : [{ label: words.value.summaryToBuy, value: tubes(tubeTotal) }]),
  ]
})

const gramsNote = computed(() => {
  const perGram = beadsPerGram(bead.value)
  return perGram
    ? `${fillBlanks(t.value.print.gramsNote, { count: groupThousands(perGram, locale.value), bead: `${formFactorName(bead.value.formFactor, t.value.formFactors)} ${bead.value.size}` })} ${t.value.print.spares}`
    : undefined
})
</script>

<template>
  <div class="convert-review" data-testid="convert-review">
    <NamesSection v-model:name="wizard.name.value" v-model:maker-name="wizard.makerName.value" :name-placeholder="wizard.fileStem.value" />

    <div class="convert-review__summary" data-testid="convert-summary">
      <dl class="convert-review__totals">
        <div v-for="row in summary" :key="row.label" class="convert-review__total">
          <dt>{{ row.label }}</dt>
          <dd>{{ row.value }}</dd>
        </div>
      </dl>
      <AppButton
        v-if="phone && rows.length > 0"
        variant="text"
        size="sm"
        :aria-expanded="detailsShown"
        data-testid="convert-details-toggle"
        @click="detailsShown = !detailsShown"
      >
        {{ detailsShown ? words.hideDetails : words.showDetails }}
      </AppButton>
      <ul v-if="!phone || detailsShown" class="convert-review__colors" data-testid="convert-summary-colors">
        <li v-for="row in rows" :key="row.hex" class="convert-review__color">
          <span class="convert-review__swatch" :style="{ backgroundColor: row.hex }" aria-hidden="true" />
          <span class="convert-review__name">{{ row.name }}</span>
          <span class="convert-review__figure">{{ row.beads }}</span>
          <span v-if="row.grams" class="convert-review__figure">{{ row.grams }}</span>
          <span v-if="row.tubes" class="convert-review__figure">{{ row.tubes }}</span>
        </li>
      </ul>
    </div>
    <AppNote v-if="gramsNote" data-testid="convert-grams-note">{{ gramsNote }}</AppNote>
  </div>
</template>

<style scoped>
.convert-review {
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
}

/* Name and Maker's name side by side, stacked on a phone (ConvertImage card). */
.convert-review :deep(.names-section) {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-10);
}

@media (max-width: 63.99rem), (orientation: portrait) {
  .convert-review :deep(.names-section) {
    grid-template-columns: 1fr;
  }
}

.convert-review__summary {
  display: flex;
  flex-direction: column;
  padding: var(--space-4) var(--space-12);
  background: var(--surface);
  border-radius: var(--radius-lg);
}

.convert-review__totals {
  margin: 0;
}

.convert-review__total,
.convert-review__color {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  min-height: var(--panel-row);
}

.convert-review__total dt {
  flex: 1;
  font: var(--type-label);
  color: var(--muted);
}

.convert-review__total dd {
  margin: 0;
  font: var(--type-meta);
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}

.convert-review__colors {
  margin: 0;
  padding: var(--space-4) 0 0;
  list-style: none;
  border-top: 1px solid var(--line);
}

.convert-review__swatch {
  flex: none;
  width: var(--space-14);
  height: var(--space-14);
  border-radius: var(--radius-sm);
  box-shadow: inset 0 0 0 1px var(--swatch-edge);
}

.convert-review__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font: var(--type-meta);
  color: var(--ink);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.convert-review__figure {
  font: var(--type-meta);
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
</style>
