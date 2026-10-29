<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { useConvertImageWizardState } from '../../composables/import/useConvertImageWizard'
import type { ColorSource } from '../../domain/convertColors'
import { fillBlanks } from '../../domain/fillBlanks'
import { groupThousands } from '../../domain/formatNumber'
import { MAX_IMAGE_COLORS, MIN_IMAGE_COLORS } from '../../domain/imageConversion'
import { defaultPalette } from '../../domain/palette'
import { useI18n } from '../../i18n/useI18n'
import AppNote from '../ui/AppNote.vue'
import AppStepper from '../ui/form/AppStepper.vue'
import SegmentedControl from '../ui/form/SegmentedControl.vue'
import FoundColorRow from './FoundColorRow.vue'

// Convert image's Colors section (ConvertImage card, 4 Colors): what the found colors are matched to (Bead colors only
// where the Bead has a Color catalog), a Note on what that source does, Colors at most, and one row per found color,
// most beads first, one row's Remap open at a time.
const { t, locale } = useI18n()
const wizard = useConvertImageWizardState()
const words = computed(() => t.value.convertImage.wizard)
const sourceLabelId = useId()

const sourceOptions = computed(() => [
  ...(wizard.hasCatalog.value ? [{ value: 'bead-colors' as const, label: words.value.beadColors }] : []),
  { value: 'default' as const, label: words.value.defaultPalette },
  { value: 'exact' as const, label: words.value.exact },
])
const source = computed({ get: () => wizard.source.value, set: (next: ColorSource) => wizard.setSource(next) })
const maxColors = computed({ get: () => wizard.maxColors.value, set: (next: number) => wizard.setMaxColors(next) })

const note = computed(() => {
  if (wizard.source.value === 'bead-colors') return t.value.palette.beadColors.approximate
  if (wizard.source.value === 'exact') return words.value.exactNote
  return fillBlanks(words.value.defaultNote, { count: defaultPalette(wizard.bead.value.id).length })
})
const codes = computed(() =>
  fillBlanks(words.value.codesInSize, { size: wizard.bead.value.size, count: groupThousands(wizard.beadTargets.value.length, locale.value) }),
)

/** The one row whose Remap picker is open. */
const remapping = ref<string>()
</script>

<template>
  <div class="convert-colors" data-testid="convert-colors">
    <div class="convert-colors__source">
      <span :id="sourceLabelId" class="convert-colors__label">{{ words.matchTo }}</span>
      <SegmentedControl v-model="source" :options="sourceOptions" :labelledby="sourceLabelId" data-testid="convert-color-source" />
      <span v-if="wizard.source.value === 'bead-colors'" class="convert-colors__codes" data-testid="convert-codes">{{ codes }}</span>
    </div>
    <AppNote v-if="wizard.source.value === 'bead-colors' && wizard.catalogState.value === 'failed'" role="alert" data-testid="convert-catalog-failed">
      {{ t.palette.beadColors.failed }}
    </AppNote>
    <AppNote data-testid="convert-source-note">{{ note }}</AppNote>

    <div class="convert-colors__row">
      <span>{{ t.convertImage.maxColorsLabel }}</span>
      <AppStepper
        v-model="maxColors"
        :min="MIN_IMAGE_COLORS"
        :max="MAX_IMAGE_COLORS"
        :value-label="t.convertImage.maxColorsLabel"
        :decrease-label="t.convertImage.decreaseColorsButton"
        :increase-label="t.convertImage.increaseColorsButton"
        decrease-testid="convert-image-colors-decrease"
        increase-testid="convert-image-colors-increase"
        value-testid="convert-image-max-colors"
      />
    </div>

    <div class="convert-colors__found-head">
      <span class="convert-colors__label">{{ words.colorsFound }}</span>
      <span class="convert-colors__count" role="status" data-testid="convert-found-count">{{ wizard.found.value.length }}</span>
    </div>
    <ul class="convert-colors__list" data-testid="convert-found-colors">
      <FoundColorRow
        v-for="color in wizard.found.value"
        :key="color.pictureHex"
        :color="color"
        :open="remapping === color.pictureHex"
        @toggle-remap="remapping = remapping === color.pictureHex ? undefined : color.pictureHex"
      />
    </ul>
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

.convert-colors__codes {
  font: var(--type-meta-small);
  color: var(--muted);
}

.convert-colors__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-12);
  font: var(--type-control);
  color: var(--ink);
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
