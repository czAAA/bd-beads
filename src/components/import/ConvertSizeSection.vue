<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { useConvertImageWizardState, type ConvertSizeUnit } from '../../composables/import/useConvertImageWizard'
import { useConvertResult } from '../../composables/import/useConvertResult'
import { LARGE_SCHEMA_BEADS, type SizeMode } from '../../domain/convertSize'
import { clamp } from '../../domain/clamp'
import { fillBlanks } from '../../domain/fillBlanks'
import { CONVERT_MAX_ZOOM, CONVERT_MIN_ZOOM, CONVERT_ZOOM_STEP } from '../../domain/imageFraming'
import { techniqueName } from '../../i18n/techniqueName'
import { useI18n } from '../../i18n/useI18n'
import AppIcon from '../ui/AppIcon.vue'
import AppMessage from '../ui/AppMessage.vue'
import AppNote from '../ui/AppNote.vue'
import AppSwitch from '../ui/AppSwitch.vue'
import FormField from '../ui/form/FormField.vue'
import NumberField from '../ui/form/NumberField.vue'
import SegmentedControl from '../ui/form/SegmentedControl.vue'
import PixelToBeadRatio from './PixelToBeadRatio.vue'

// Convert image's Size section (ConvertImage card, 3 Size): By Pixel to bead ratio (the ratio, cropped on the preview)
// or By size (beads, mm or cm, Keep picture proportions, the picture zoom), the result line both share, and the
// slow-preview warning and Large Schema note.
const { t } = useI18n()
const wizard = useConvertImageWizardState()
const result = useConvertResult(wizard)
const words = computed(() => t.value.convertImage.wizard)
const modeLabelId = useId()
const unitLabelId = useId()

const modeOptions = computed(() => [
  { value: 'ratio' as const, label: words.value.byRatio },
  { value: 'size' as const, label: words.value.bySize },
])
const unitOptions = computed(() => [
  { value: 'beads' as const, label: t.value.form.unitBeads },
  { value: 'mm' as const, label: t.value.form.unitMm },
  { value: 'cm' as const, label: t.value.form.unitCm },
])
const mode = computed({ get: () => wizard.mode.value, set: (next: SizeMode) => wizard.setMode(next) })
const unit = computed({ get: () => wizard.unit.value, set: (next: ConvertSizeUnit) => wizard.setUnit(next) })
const keep = computed({ get: () => wizard.keepProportions.value, set: (on: boolean) => wizard.setKeepProportions(on) })

/** What the number fields ask for in each unit: whole beads from 1, or any length above 0. */
const numberAttrs = computed(() =>
  wizard.unit.value === 'beads' ? { whole: true, min: 1, step: 1, digitsOnly: true } : { whole: false, min: 0, step: 'any' as const, digitsOnly: false },
)

const leadColor = computed(() => wizard.found.value[0]?.pictureHex)
const slowWarning = computed(() =>
  wizard.slowFraming.value ? fillBlanks(t.value.convertImage.slowFramingWarning, { technique: techniqueName(t.value, wizard.technique.value) }) : undefined,
)

// The picture zoom slider (QualitySlider look): 100% is the picture just covering the Frame. A track with a thumb,
// not an <input>, so it is one of the app's own controls; the arrows step it.
const trackEl = ref<HTMLElement>()
const at = computed(() => (wizard.zoom.value - CONVERT_MIN_ZOOM) / (CONVERT_MAX_ZOOM - CONVERT_MIN_ZOOM))
function zoomAt(clientX: number) {
  const box = trackEl.value?.getBoundingClientRect()
  if (!box || box.width === 0) return
  const fraction = clamp((clientX - box.left) / box.width, 0, 1)
  wizard.setZoom(CONVERT_MIN_ZOOM + fraction * (CONVERT_MAX_ZOOM - CONVERT_MIN_ZOOM))
}
function onTrackDown(event: PointerEvent) {
  ;(event.currentTarget as Element).setPointerCapture?.(event.pointerId)
  zoomAt(event.clientX)
}
function onTrackMove(event: PointerEvent) {
  if ((event.currentTarget as Element).hasPointerCapture?.(event.pointerId)) zoomAt(event.clientX)
}
function onSliderKey(event: KeyboardEvent) {
  const step = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[event.key]
  if (event.key === 'Home') wizard.setZoom(CONVERT_MIN_ZOOM)
  else if (event.key === 'End') wizard.setZoom(CONVERT_MAX_ZOOM)
  else if (step) wizard.setZoom(wizard.zoom.value + step * CONVERT_ZOOM_STEP)
  else return
  event.preventDefault()
}
</script>

<template>
  <div class="convert-size" data-testid="convert-size">
    <span :id="modeLabelId" class="convert-size__hidden">{{ t.convertImage.wizard.sections.size }}</span>
    <SegmentedControl v-model="mode" class="convert-size__mode" :options="modeOptions" :labelledby="modeLabelId" data-testid="convert-size-mode" />

    <template v-if="wizard.mode.value === 'ratio'">
      <PixelToBeadRatio :ratio="wizard.ratio.value" :custom="wizard.customRatio.value" :lead-color="leadColor" @choose="wizard.setRatio" />
      <p class="convert-size__hint">{{ words.cropHint }}</p>
    </template>

    <template v-else>
      <FormField :label="t.form.unitLabel" :label-id="unitLabelId">
        <SegmentedControl v-model="unit" :options="unitOptions" mono small :labelledby="unitLabelId" data-testid="convert-size-unit" />
      </FormField>
      <div class="convert-size__pair">
        <FormField :label="t.form.widthLabel" label-for="convert-width">
          <NumberField
            id="convert-width"
            :model-value="wizard.widthText.value"
            v-bind="numberAttrs"
            stepper
            :placeholder="unit"
            :decrease-label="t.form.decreaseWidthButton"
            :increase-label="t.form.increaseWidthButton"
            testid-prefix="convert-width"
            data-testid="convert-width"
            @update:model-value="wizard.setWidth"
          />
        </FormField>
        <FormField :label="t.form.heightLabel" label-for="convert-height">
          <NumberField
            id="convert-height"
            :model-value="wizard.heightText.value"
            v-bind="numberAttrs"
            stepper
            :placeholder="unit"
            :decrease-label="t.form.decreaseHeightButton"
            :increase-label="t.form.increaseHeightButton"
            testid-prefix="convert-height"
            data-testid="convert-height"
            @update:model-value="wizard.setHeight"
          />
        </FormField>
      </div>
      <div class="convert-size__row">
        <span aria-hidden="true">{{ words.keepProportions }}</span>
        <AppSwitch v-model="keep" :label="words.keepProportions" data-testid="convert-keep-proportions" />
      </div>
      <div class="convert-size__zoom">
        <span class="convert-size__label">{{ words.pictureZoom }}</span>
        <AppIcon name="zoom-out" :size="16" />
        <div
          ref="trackEl"
          class="convert-size__track"
          role="slider"
          tabindex="0"
          :aria-label="words.pictureZoom"
          :aria-valuemin="CONVERT_MIN_ZOOM * 100"
          :aria-valuemax="CONVERT_MAX_ZOOM * 100"
          :aria-valuenow="wizard.zoomPercent.value"
          :aria-valuetext="fillBlanks(words.zoomLevel, { percent: wizard.zoomPercent.value })"
          data-testid="convert-picture-zoom"
          @pointerdown="onTrackDown"
          @pointermove="onTrackMove"
          @keydown="onSliderKey"
        >
          <span class="convert-size__fill" :style="{ width: `${at * 100}%` }" />
          <span class="convert-size__thumb" :style="{ left: `${at * 100}%` }" />
        </div>
        <AppIcon name="zoom-in" :size="16" />
        <span class="convert-size__percent">{{ fillBlanks(words.zoomLevel, { percent: wizard.zoomPercent.value }) }}</span>
      </div>
    </template>

    <div v-if="result" class="convert-size__result" data-testid="convert-result">
      <span class="convert-size__label">{{ words.result }}</span>
      <p class="convert-size__line" role="status">
        <span class="convert-size__grid">{{ result.grid }}</span> · {{ result.measured }} · {{ result.ratio }}
      </p>
    </div>

    <AppMessage v-if="slowWarning" tone="warning" placement="notice" :closable="false" data-testid="convert-image-slow-framing-warning">{{ slowWarning }}</AppMessage>
    <AppNote v-if="wizard.largeSchema.value" data-testid="convert-large-schema">{{ fillBlanks(words.largeSchema, { beads: LARGE_SCHEMA_BEADS }) }}</AppNote>
  </div>
</template>

<style scoped>
.convert-size {
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
}

.convert-size__hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

/* On a phone the two long mode labels stack, one option a row, rather than squeeze to three lines each. */
@media (max-width: 30rem) {
  .convert-size__mode :deep(.segmented__option) {
    flex-basis: 100%;
  }
}

.convert-size__hint {
  margin: 0;
  font: var(--type-small);
  color: var(--muted);
}

.convert-size__pair {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-10);
}

.convert-size__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-12);
  min-height: var(--panel-row);
  font: var(--type-control);
  color: var(--ink);
}

.convert-size__zoom {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  color: var(--muted);
}

.convert-size__label {
  font: var(--type-label);
  color: var(--muted);
}

.convert-size__track {
  position: relative;
  flex: 1;
  height: var(--space-20);
  cursor: pointer;
  touch-action: none;
}

.convert-size__track::before,
.convert-size__fill {
  position: absolute;
  top: 50%;
  left: 0;
  height: var(--space-4);
  border-radius: var(--space-2);
  transform: translateY(-50%);
  content: '';
}

.convert-size__track::before {
  right: 0;
  background: var(--line);
}

.convert-size__fill {
  background: var(--track-fill);
}

.convert-size__thumb {
  position: absolute;
  top: 50%;
  width: var(--space-16);
  height: var(--space-16);
  background: var(--canvas);
  border: 2px solid var(--ink);
  border-radius: 50%;
  transform: translate(-50%, -50%);
}

.convert-size__track:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: 2px;
}

.convert-size__percent {
  min-width: var(--space-32);
  font: var(--type-meta);
  color: var(--muted);
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.convert-size__result {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-10) var(--space-12);
  background: var(--surface);
  border-radius: var(--radius-lg);
}

:root[data-theme='dark'] .convert-size__result {
  background: var(--elevated);
}

:root[data-theme='contrast'] .convert-size__result {
  border: 2px solid var(--line);
}

.convert-size__line {
  margin: 0;
  font: var(--type-meta);
  color: var(--body);
}

.convert-size__grid {
  font-weight: 500;
  color: var(--ink);
}
</style>
