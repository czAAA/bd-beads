<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { useConvertImageWizardState } from '../../composables/import/useConvertImageWizard'
import type { ColorSource } from '../../domain/convertColors'
import { fillBlanks } from '../../domain/fillBlanks'
import { groupThousands } from '../../domain/formatNumber'
import { beadLabel } from '../../domain/beads'
import { plural } from '../../i18n/plural'
import { useI18n } from '../../i18n/useI18n'
import AppNote from '../ui/AppNote.vue'
import InfoButton from '../ui/InfoButton.vue'
import SegmentedControl from '../ui/form/SegmentedControl.vue'
import FoundColorRow from './FoundColorRow.vue'
import FoundColorsHeader from './FoundColorsHeader.vue'

// The Colors popover's body, from "More for the colors" (ConvertImage card DS-1, ticket 0896; tickets 0747, 0758, 0863):
// "Colors" and match to, each with what it does behind an Info button, then Color by color already open, its list
// scrolling inside the popover: a row per bead color the found colors become, one Change open at a time.
const { t, locale } = useI18n()
const wizard = useConvertImageWizardState()
const words = computed(() => t.value.convertImage.wizard)
const sourceLabelId = useId()

/** The Bead as the palette's Bead colors entry names it: its maker, name and shape, with no finish. */
const beadName = computed(() => beadLabel(wizard.bead.value))
const sourceOptions = computed(() => [
  ...(wizard.hasCatalog.value ? [{ value: 'bead-colors' as const, label: fillBlanks(words.value.beadPalette, { bead: beadName.value }) }] : []),
  { value: 'default' as const, label: words.value.defaultPalette },
  { value: 'exact' as const, label: words.value.exact },
])
const source = computed({ get: () => wizard.source.value, set: (next: ColorSource) => wizard.setSource(next) })

const colorsMaxText = computed(() => groupThousands(wizard.colorsMax.value, locale.value))
/** Under Exact a color is not a bead to buy, so the Info says what it is instead (tickets 0863, 0894). */
const colorsInfo = computed(() => {
  const exact = wizard.source.value === 'exact'
  const capped = wizard.colorsCapped.value
  const hint = exact ? (capped ? words.value.colorsHintExactCapped : words.value.colorsHintExact) : capped ? words.value.colorsHintCapped : words.value.colorsHint
  return { label: fillBlanks(words.value.whatDoes, { name: words.value.colorsLabel }), body: fillBlanks(hint, { n: colorsMaxText.value }) }
})
/** Where colors come from: each choice's note led by its name, the three in one Info button (ticket 0896). */
const sourceNote = computed(() =>
  sourceOptions.value
    .map((option) => {
      const note = option.value === 'bead-colors' ? fillBlanks(words.value.beadPaletteNote, { bead: beadName.value }) : option.value === 'default' ? words.value.defaultPaletteNote : words.value.exactNote
      return `${option.label}: ${note}`
    })
    .join(' '),
)

const codes = computed(() =>
  fillBlanks(words.value.codesInSize, { size: wizard.bead.value.size, count: groupThousands(wizard.beadTargets.value.length, locale.value) }),
)

/** Color by color's count: the colors the beads use, and how many found colors are empty when any are. */
const summary = computed(() => {
  const empty = wizard.emptyColorCount.value
  return [plural(locale.value, wizard.usedColorCount.value, words.value.colorsCount), ...(empty > 0 ? [fillBlanks(words.value.emptyCount, { n: empty })] : [])].join(' · ')
})

/** The one row whose Remap picker is open, by a found color it joins, so it stays open when a pick joins it to another. */
const remapping = ref<string>()
</script>

<template>
  <div class="convert-colors" data-testid="convert-colors">
    <div class="convert-colors__head">
      <span class="convert-colors__title">
        {{ words.colorsLabel }}
        <InfoButton :label="colorsInfo.label" :body="colorsInfo.body" data-testid="convert-colors-slider-info" />
      </span>
      <span class="convert-colors__label convert-colors__source-head">
        <span :id="sourceLabelId">{{ words.matchTo }}</span>
        <InfoButton :label="words.whereColorsFrom" :body="sourceNote" data-testid="convert-color-source-info" />
      </span>
      <SegmentedControl v-model="source" :options="sourceOptions" :labelledby="sourceLabelId" data-testid="convert-color-source" />
      <span v-if="wizard.source.value === 'bead-colors'" class="convert-colors__codes" data-testid="convert-codes">{{ codes }}</span>
      <AppNote v-if="wizard.source.value === 'bead-colors' && wizard.catalogState.value === 'failed'" role="alert" data-testid="convert-catalog-failed">
        {{ t.palette.beadColors.failed }}
      </AppNote>
    </div>

    <div class="convert-colors__found-head">
      <span class="convert-colors__title">{{ words.colorByColor }}</span>
      <span class="convert-colors__count" role="status" data-testid="convert-found-count">{{ summary }}</span>
    </div>
    <div class="convert-colors__table">
      <FoundColorsHeader />
      <ul class="convert-colors__list" data-testid="convert-found-colors">
        <FoundColorRow
          v-for="row in wizard.rows.value"
          :key="row.pictureHexes[0]"
          :row="row"
          :open="!!remapping && row.pictureHexes.includes(remapping)"
          @toggle-remap="remapping = remapping && row.pictureHexes.includes(remapping) ? undefined : row.pictureHexes[0]"
        />
      </ul>
    </div>
  </div>
</template>

<style scoped>
/* The head stays; the list under it scrolls inside the popover. */
.convert-colors {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
}

.convert-colors__head {
  display: flex;
  flex: none;
  flex-direction: column;
  gap: var(--space-6);
  padding: var(--space-14) var(--space-16) var(--space-12);
  border-bottom: 1px solid var(--line-soft);
}

.convert-colors__title {
  display: inline-flex;
  align-items: center;
  gap: var(--space-4);
  font: var(--type-control);
  font-weight: 600;
  color: var(--ink);
}

.convert-colors__label {
  font: var(--type-label);
  color: var(--muted);
}

.convert-colors__source-head {
  display: inline-flex;
  align-items: center;
  gap: var(--space-4);
}

/* The Bead's palette is named in full, so the options share the row by their text, not equally (ticket 0758). */
.convert-colors__head :deep(.segmented__option) {
  flex-basis: auto;
}

.convert-colors__codes {
  font: var(--type-meta-small);
  color: var(--muted);
}

.convert-colors__found-head {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-4) var(--space-12);
  padding: var(--space-12) var(--space-16) var(--space-8);
}

.convert-colors__count {
  font: var(--type-meta);
  color: var(--muted);
}

/* The found-colors table: its heading row and rows take their narrow columns by its width (FoundColorRow card,
 * ticket 0782). Only the list scrolls. */
.convert-colors__table {
  container: found-colors / inline-size;
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: var(--space-4);
  min-height: 0;
  padding: 0 var(--space-16) var(--space-12);
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
}

/* Under 1024 px or in portrait the popover stands in the column's flow, which scrolls: the list need not. */
@media (max-width: 63.99rem), (orientation: portrait) {
  .convert-colors__table {
    overflow-y: visible;
  }
}

.convert-colors__list {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
}
</style>
