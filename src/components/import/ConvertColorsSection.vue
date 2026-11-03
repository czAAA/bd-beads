<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { useConvertImageWizardState } from '../../composables/import/useConvertImageWizard'
import type { ColorSource } from '../../domain/convertColors'
import { fillBlanks } from '../../domain/fillBlanks'
import { groupThousands } from '../../domain/formatNumber'
import { beadLabel } from '../../domain/beads'
import { MIN_IMAGE_COLORS } from '../../domain/imageConversion'
import { plural } from '../../i18n/plural'
import { useI18n } from '../../i18n/useI18n'
import AppIcon from '../ui/AppIcon.vue'
import AppNote from '../ui/AppNote.vue'
import SegmentedControl from '../ui/form/SegmentedControl.vue'
import ValueSlider from '../ui/form/ValueSlider.vue'
import ConvertDisclosure from './ConvertDisclosure.vue'
import FoundColorRow from './FoundColorRow.vue'
import FoundColorsHeader from './FoundColorsHeader.vue'

// Convert image's Colors section (ConvertImage card, 4 Colors; tickets 0747, 0758, 0780): the Colors slider, the line
// pointing at the preview's Make empty, what the found colors are matched to (the Bead's palette only with a Color catalog; Exact at first, a Note on the
// Bead's palette), and Color by color, closed at first: a heading and a row per found color, one Change open at a time.
const { t, locale } = useI18n()
const wizard = useConvertImageWizardState()
const words = computed(() => t.value.convertImage.wizard)
const sourceLabelId = useId()
/** The line pointing at Make empty round the tool's name, which is set in bold. */
const makeEmptyLine = computed(() => {
  const [before = '', after = ''] = words.value.makeEmptyLine.split('{tool}')
  return { before, after }
})

/** The Bead as the palette's Bead colors entry names it: its maker, name and shape, with no finish. */
const beadName = computed(() => beadLabel(wizard.bead.value))
const sourceOptions = computed(() => [
  ...(wizard.hasCatalog.value
    ? [{ value: 'bead-colors' as const, label: fillBlanks(words.value.beadPalette, { bead: beadName.value }) }]
    : []),
  { value: 'default' as const, label: words.value.defaultPalette },
  { value: 'exact' as const, label: words.value.exact },
])
const source = computed({ get: () => wizard.source.value, set: (next: ColorSource) => wizard.setSource(next) })

const colorsText = (count: number) => plural(locale.value, count, words.value.colorsCount)
const colorsValue = computed(() => colorsText(wizard.maxColors.value))
const colorsMaxText = computed(() => groupThousands(wizard.colorsMax.value, locale.value))
const colorsMaxLabel = computed(() => fillBlanks(words.value.maxLabel, { value: colorsMaxText.value }))
const colorsHint = computed(() => fillBlanks(wizard.colorsCapped.value ? words.value.colorsHintCapped : words.value.colorsHint, { n: colorsMaxText.value }))

const codes = computed(() =>
  fillBlanks(words.value.codesInSize, { size: wizard.bead.value.size, count: groupThousands(wizard.beadTargets.value.length, locale.value) }),
)

/** Color by color's summary: the colors the beads use, and how many found colors are empty when any are. */
const summary = computed(() => {
  const empty = wizard.emptyColorCount.value
  return [colorsText(wizard.usedColorCount.value), ...(empty > 0 ? [fillBlanks(words.value.emptyCount, { n: empty })] : [])].join(' · ')
})

/** The one row whose Remap picker is open. */
const remapping = ref<string>()
</script>

<template>
  <div class="convert-colors" data-testid="convert-colors">
    <ValueSlider
      :label="words.sections.colors"
      :model-value="wizard.maxColors.value"
      :min="MIN_IMAGE_COLORS"
      :max="wizard.colorsMax.value"
      :value="colorsValue"
      :valuetext="colorsValue"
      :min-label="String(MIN_IMAGE_COLORS)"
      :max-label="colorsMaxLabel"
      :hint="colorsHint"
      testid="convert-colors-slider"
      @update:model-value="wizard.setMaxColors"
    />

    <p class="convert-colors__empty" data-testid="convert-make-empty-line">
      <AppIcon name="eyedropper" :size="16" />
      <span>{{ makeEmptyLine.before }}<b>{{ words.makeEmpty }}</b>{{ makeEmptyLine.after }}</span>
    </p>

    <div class="convert-colors__source">
      <span :id="sourceLabelId" class="convert-colors__label">{{ words.matchTo }}</span>
      <SegmentedControl v-model="source" :options="sourceOptions" :labelledby="sourceLabelId" data-testid="convert-color-source" />
      <span v-if="wizard.source.value === 'bead-colors'" class="convert-colors__codes" data-testid="convert-codes">{{ codes }}</span>
    </div>
    <AppNote v-if="wizard.source.value === 'bead-colors' && wizard.catalogState.value === 'failed'" role="alert" data-testid="convert-catalog-failed">
      {{ t.palette.beadColors.failed }}
    </AppNote>
    <AppNote v-if="wizard.source.value === 'bead-colors'" data-testid="convert-source-note">
      {{ fillBlanks(words.beadPaletteNote, { bead: beadName }) }}
    </AppNote>

    <ConvertDisclosure :label="words.colorByColor" :summary="summary" testid="convert-color-by-color">
      <div class="convert-colors__found-head">
        <span class="convert-colors__label">{{ words.colorsFound }}</span>
        <span class="convert-colors__count" role="status" data-testid="convert-found-count">{{ wizard.found.value.length }}</span>
      </div>
      <FoundColorsHeader />
      <ul class="convert-colors__list" data-testid="convert-found-colors">
        <FoundColorRow
          v-for="color in wizard.found.value"
          :key="color.pictureHex"
          :color="color"
          :open="remapping === color.pictureHex"
          @toggle-remap="remapping = remapping === color.pictureHex ? undefined : color.pictureHex"
        />
      </ul>
    </ConvertDisclosure>
  </div>
</template>

<style scoped>
.convert-colors {
  display: flex;
  flex-direction: column;
  gap: var(--space-16);
}

.convert-colors__source {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.convert-colors__label {
  font: var(--type-label);
  color: var(--muted);
}

.convert-colors__empty {
  display: flex;
  align-items: flex-start;
  gap: var(--space-10);
  margin: 0;
  font: var(--type-body);
  color: var(--body);
}

.convert-colors__empty > :first-child {
  flex: none;
  margin-top: var(--space-2);
}

/* The Bead's palette is named in full, so the options share the row by their text, not equally (ticket 0758). */
.convert-colors__source :deep(.segmented__option) {
  flex-basis: auto;
}

.convert-colors__codes {
  font: var(--type-meta-small);
  color: var(--muted);
}

.convert-colors__found-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.convert-colors__count {
  font: var(--type-meta);
  color: var(--muted);
}

.convert-colors__list {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
}
</style>
