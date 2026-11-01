<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { useConvertImageWizardState } from '../../composables/import/useConvertImageWizard'
import { controlAction } from '../../composables/shell/controlRegistry'
import type { ColorSource } from '../../domain/convertColors'
import { fillBlanks } from '../../domain/fillBlanks'
import { groupThousands } from '../../domain/formatNumber'
import { beadLabel } from '../../domain/beads'
import { MIN_IMAGE_COLORS } from '../../domain/imageConversion'
import { MAX_CLEAN_UP } from '../../domain/strayBeads'
import { plural } from '../../i18n/plural'
import { useI18n } from '../../i18n/useI18n'
import AppNote from '../ui/AppNote.vue'
import AppSwitch from '../ui/AppSwitch.vue'
import SegmentedControl from '../ui/form/SegmentedControl.vue'
import ValueSlider from '../ui/form/ValueSlider.vue'
import ConvertDisclosure from './ConvertDisclosure.vue'
import ConvertOutlineRow from './ConvertOutlineRow.vue'
import FoundColorRow from './FoundColorRow.vue'
import FoundColorsHeader from './FoundColorsHeader.vue'

// Convert image's Colors section (ConvertImage card, 4 Colors; tickets 0747, 0758, 0766): the Colors slider, Treat as
// empty, Auto-fix lighting, Clean up stray beads, the Outline (with empty beads round the subject), what the found colors
// are matched to (Exact at first), and Color by color, closed at first: a row per found color, one Change open at a time.
const { t, locale } = useI18n()
const wizard = useConvertImageWizardState()
const words = computed(() => t.value.convertImage.wizard)
const sourceLabelId = useId()
const actions = { treatAsEmpty: controlAction('treat-as-empty'), autoFixLighting: controlAction('auto-fix-lighting') }
const autoFixLighting = computed({ get: () => wizard.autoFixLighting.value, set: (next: boolean) => wizard.setAutoFixLighting(next) })
/** Clean up stray beads' value: Off, then the passes it allows. */
const cleanUpValue = computed(() => (wizard.cleanUp.value === 0 ? words.value.helpers.off : String(wizard.cleanUp.value)))
const cleanUpMaxLabel = computed(() => fillBlanks(words.value.maxLabel, { value: String(MAX_CLEAN_UP) }))

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

    <div class="convert-colors__empty">
      <span class="convert-colors__label convert-colors__label--ink">{{ words.treatAsEmpty }}</span>
      <AppSwitch v-model="wizard.treatAsEmpty.value" :action="actions.treatAsEmpty" data-testid="convert-treat-as-empty" />
    </div>

    <div class="convert-colors__empty">
      <span class="convert-colors__label convert-colors__label--ink">{{ words.helpers.autoFixLighting }}</span>
      <AppSwitch v-model="autoFixLighting" :action="actions.autoFixLighting" data-testid="convert-auto-fix-lighting" />
    </div>

    <ValueSlider
      :label="words.helpers.cleanUp"
      :model-value="wizard.cleanUp.value"
      :min="0"
      :max="MAX_CLEAN_UP"
      :value="cleanUpValue"
      :valuetext="cleanUpValue"
      :min-label="words.helpers.off"
      :max-label="cleanUpMaxLabel"
      :hint="words.helpers.cleanUpHint"
      testid="convert-clean-up-slider"
      @update:model-value="wizard.setCleanUp"
    />

    <ConvertOutlineRow v-if="wizard.outlineShown.value" />

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
  gap: var(--space-12);
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

.convert-colors__label--ink {
  font: var(--type-control);
  color: var(--ink);
}

.convert-colors__empty {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-8);
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
