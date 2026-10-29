<script setup lang="ts">
import { computed, useId } from 'vue'
import { controlAction } from '../../composables/shell/controlRegistry'
import { CUSTOM_RATIO_MAX, CUSTOM_RATIO_MIN, RATIO_PRESETS, ratioId, sameRatio, type PixelToBeadRatio } from '../../domain/convertSize'
import { fillBlanks } from '../../domain/fillBlanks'
import { ratioSentence, ratioText } from '../../i18n/ratioWords'
import { useI18n } from '../../i18n/useI18n'
import AppStepper from '../ui/form/AppStepper.vue'
import ChipRadioGroup from '../ui/form/ChipRadioGroup.vue'
import SegmentedControl from '../ui/form/SegmentedControl.vue'
import AppIcon from '../ui/AppIcon.vue'

// The Pixel to bead ratio (PixelToBeadRatio card): preset chips and Custom in one radiogroup, a Custom ratio's Stepper
// and direction, and the explainer, a drawing and a sentence redrawn with the choice in the picture's leading color.
const props = defineProps<{
  ratio: PixelToBeadRatio
  /** The Custom chip is chosen, even on a ratio a preset has. */
  custom: boolean
  /** The picture's color covering most of it, for the explainer's squares. */
  leadColor?: string
}>()

const emit = defineEmits<{ choose: [ratio: PixelToBeadRatio, custom: boolean] }>()

const { t } = useI18n()
const labelId = useId()

/** The Custom chip's value, beside the presets' ratio ids. */
const CUSTOM = 'custom'

/** The chips, each a registry action (ticket 0650): the presets by their ratio, then Custom. */
const chips = computed(() => [
  ...RATIO_PRESETS.map((preset) => ({ value: ratioId(preset), label: ratioText(preset), action: controlAction(`pixel-ratio-${ratioId(preset)}`), testid: `ratio-${ratioId(preset)}` })),
  { value: CUSTOM, label: t.value.convertImage.wizard.custom, action: controlAction(`pixel-ratio-${CUSTOM}`), testid: `ratio-${CUSTOM}` },
])
const chosen = computed(() => {
  if (props.custom) return CUSTOM
  const preset = RATIO_PRESETS.find((ratio) => sameRatio(ratio, props.ratio))
  return preset && ratioId(preset)
})

function choose(value: string | undefined) {
  if (value === CUSTOM) return chooseCustom()
  const preset = RATIO_PRESETS.find((ratio) => ratioId(ratio) === value)
  if (preset) emit('choose', preset, false)
}

/** A Custom ratio's whole number and which way it runs. */
const customNumber = computed(() => Math.max(props.ratio.pixels, props.ratio.beads))
const customWay = computed<'pixels' | 'beads'>(() => (props.ratio.beads > 1 ? 'beads' : 'pixels'))
const wayOptions = computed(() => [
  { value: 'pixels' as const, label: t.value.convertImage.wizard.pixelsPerBead },
  { value: 'beads' as const, label: t.value.convertImage.wizard.beadsPerPixel },
])

function customRatio(number: number, way: 'pixels' | 'beads'): PixelToBeadRatio {
  return way === 'pixels' ? { pixels: number, beads: 1 } : { pixels: 1, beads: number }
}

function chooseCustom() {
  emit('choose', customRatio(Math.max(CUSTOM_RATIO_MIN, customNumber.value), customWay.value), true)
}

/** The explainer: an n × n block of pixels over one bead, or one pixel over n × n beads, at most 8 or 4 a side. */
const drawing = computed(() => {
  const { pixels, beads } = props.ratio
  return { pixels: Math.min(8, pixels), beads: Math.min(4, beads) }
})
const sentence = computed(() => ratioSentence(t.value, props.ratio))
const pixelCaption = computed(() => (props.ratio.pixels > 1 ? fillBlanks(t.value.convertImage.wizard.blockPx, { n: props.ratio.pixels }) : t.value.convertImage.wizard.onePx))
const beadCaption = computed(() => (props.ratio.beads > 1 ? fillBlanks(t.value.convertImage.wizard.blockBeads, { n: props.ratio.beads }) : t.value.convertImage.wizard.oneBead))
</script>

<template>
  <div class="pixel-ratio" data-testid="pixel-ratio">
    <span :id="labelId" class="pixel-ratio__label">{{ t.convertImage.wizard.ratioLabel }}</span>
    <ChipRadioGroup :model-value="chosen" :options="chips" :labelledby="labelId" @update:model-value="choose" />

    <div v-if="custom" class="pixel-ratio__custom" data-testid="ratio-custom-controls">
      <AppStepper
        :model-value="customNumber"
        :min="CUSTOM_RATIO_MIN"
        :max="CUSTOM_RATIO_MAX"
        :value-label="t.convertImage.wizard.customRatio"
        :decrease-label="t.convertImage.wizard.fewerPixels"
        :increase-label="t.convertImage.wizard.morePixels"
        decrease-testid="ratio-custom-decrease"
        increase-testid="ratio-custom-increase"
        @update:model-value="(number: number) => emit('choose', customRatio(number, customWay), true)"
      />
      <SegmentedControl
        :model-value="customWay"
        :options="wayOptions"
        small
        :labelledby="labelId"
        data-testid="ratio-custom-way"
        @update:model-value="(way: 'pixels' | 'beads') => emit('choose', customRatio(customNumber, way), true)"
      />
    </div>

    <div class="pixel-ratio__explainer">
      <div class="pixel-ratio__drawing" aria-hidden="true">
        <span class="pixel-ratio__figure">
          <span class="pixel-ratio__pixels" :style="{ gridTemplateColumns: `repeat(${drawing.pixels}, 1fr)` }">
            <span v-for="n in drawing.pixels * drawing.pixels" :key="n" class="pixel-ratio__pixel" :style="leadColor ? { backgroundColor: leadColor } : undefined" />
          </span>
          <span class="pixel-ratio__caption">{{ pixelCaption }}</span>
        </span>
        <AppIcon class="pixel-ratio__arrow" name="arrow-down" :size="12" />
        <span class="pixel-ratio__figure">
          <span class="pixel-ratio__beads" :style="{ gridTemplateColumns: `repeat(${drawing.beads}, auto)` }">
            <span v-for="n in drawing.beads * drawing.beads" :key="n" class="pixel-ratio__bead" :style="leadColor ? { backgroundColor: leadColor } : undefined" />
          </span>
          <span class="pixel-ratio__caption">{{ beadCaption }}</span>
        </span>
      </div>
      <p class="pixel-ratio__sentence" data-testid="ratio-sentence">{{ sentence }}</p>
    </div>
  </div>
</template>

<style scoped>
.pixel-ratio {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

.pixel-ratio__label {
  font: var(--type-label);
  color: var(--muted);
}

.pixel-ratio__custom {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-8);
}

.pixel-ratio__explainer {
  display: flex;
  align-items: center;
  gap: var(--space-12);
}

.pixel-ratio__drawing {
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--space-8);
  color: var(--muted);
}

.pixel-ratio__figure {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
}

.pixel-ratio__pixels {
  display: grid;
  gap: 1px;
  width: var(--item-height);
  height: var(--item-height);
  background: var(--canvas);
  border: 1px solid var(--line-strong);
}

.pixel-ratio__pixel {
  background: var(--ink);
}

.pixel-ratio__beads {
  display: grid;
  gap: 1px;
}

.pixel-ratio__bead {
  width: var(--ratio-bead-width);
  height: var(--ratio-bead-height);
  background: var(--ink);
  border-radius: var(--radius-sm);
  box-shadow: inset 0 0 0 1px var(--bead-rim);
}

.pixel-ratio__beads:has(> :nth-child(2)) .pixel-ratio__bead {
  width: calc(var(--ratio-bead-width) / 2);
  height: calc(var(--ratio-bead-height) / 2);
}

.pixel-ratio__arrow {
  transform: rotate(-90deg);
}

.pixel-ratio__caption {
  font: var(--type-meta-small);
  color: var(--muted);
  white-space: nowrap;
}

.pixel-ratio__sentence {
  margin: 0;
  font: var(--type-body);
  color: var(--body);
}
</style>
