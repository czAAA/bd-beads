<script setup lang="ts">
import { computed, onMounted, ref, useId } from 'vue'
import { useElementSize } from '../../composables/ui/useElementSize'
import { useOverlayLayer } from '../../composables/ui/useOverlayLayer'
import { convertPopoverPlace, type ScreenBox } from '../../composables/canvas/pictureBarPlacement'
import type { ColorSource } from '../../domain/convertColors'
import { fillBlanks } from '../../domain/fillBlanks'
import { useI18n } from '../../i18n/useI18n'
import AppButton from '../ui/AppButton.vue'
import AppSwitch from '../ui/AppSwitch.vue'
import IconButton from '../ui/IconButton.vue'
import InfoButton from '../ui/InfoButton.vue'
import AppStepper from '../ui/form/AppStepper.vue'
import SegmentedControl from '../ui/form/SegmentedControl.vue'

// The Convert to beads popover (ReferenceImage card, ticket 0883): a non-modal dialog beside the reference image, its
// top level with the picture bar's, so the picture's place stays in view. Size, match to (Exact first), Colors, Hide the
// picture after, All settings and Convert {n} beads; Escape or × closes it and gives focus back to the bar's button.
const props = defineProps<{
  picture: ScreenBox
  barTop: number
  viewport: { width: number; height: number }
  /** "26×18" and its measure through the Canvas's Bead. */
  size: { grid: string; measure: string }
  source: ColorSource
  /** The Bead's name, for its palette's choice, with a Color catalog. */
  beadName?: string
  colors: number
  colorsMax: number
  /** The bead colors the conversion uses, most beads first. */
  swatches: readonly string[]
  hideAfter: boolean
  convertLabel: string
  replacedLabel?: string
  ready: boolean
}>()

const emit = defineEmits<{
  close: []
  source: [source: ColorSource]
  colors: [count: number]
  'hide-after': [on: boolean]
  'all-settings': []
  convert: []
}>()

const { t } = useI18n()
const words = computed(() => t.value.referenceImage.convert)
const wizard = computed(() => t.value.convertImage.wizard)
const rootEl = ref<HTMLElement>()
const titleId = useId()
const sourceId = useId()
const { width, height } = useElementSize(rootEl, { box: 'border-box' })
const at = computed(() => convertPopoverPlace(props.picture, props.barTop, { width: width.value, height: height.value }, props.viewport))

const sourceOptions = computed(() => [
  { value: 'exact' as const, label: wizard.value.exact },
  ...(props.beadName ? [{ value: 'bead-colors' as const, label: fillBlanks(wizard.value.beadPalette, { bead: props.beadName }) }] : []),
  { value: 'default' as const, label: wizard.value.defaultPalette },
])
/** Convert image's own Note for the choice in hand. */
const sourceNote = computed(() => {
  if (props.source === 'bead-colors') return fillBlanks(wizard.value.beadPaletteNote, { bead: props.beadName ?? '' })
  return props.source === 'default' ? wizard.value.defaultPaletteNote : wizard.value.exactNote
})
const countText = computed(() => fillBlanks(words.value.colorsCount, { count: props.colors, max: props.colorsMax }))
const colorsModel = computed({ get: () => props.colors, set: (count: number) => emit('colors', count) })
const hideModel = computed({ get: () => props.hideAfter, set: (on: boolean) => emit('hide-after', on) })

/** Escape, × and a press outside close it; the canvas gives focus back to the bar's Convert to beads button. */
const close = () => emit('close')

useOverlayLayer({
  isOpen: () => true,
  root: () => rootEl.value,
  close,
  // The picture's handles and its bar still work the picture while the popover is open: a corner drag resizes it live.
  keepsPress: (event) => event.target instanceof Element && event.target.closest('[data-testid="reference-adjust"], [data-testid="picture-bar"]') !== null,
})

onMounted(() => rootEl.value?.querySelector<HTMLElement>('button, [tabindex="0"]')?.focus({ preventScroll: true }))
</script>

<template>
  <div
    ref="rootEl"
    class="convert-popover"
    :style="{ left: `${at.left}px`, top: `${at.top}px` }"
    role="dialog"
    :aria-labelledby="titleId"
    data-testid="convert-to-beads"
  >
    <div class="convert-popover__head">
      <h2 :id="titleId" class="convert-popover__title">{{ words.name }}</h2>
      <IconButton variant="plain" icon="close" :label="t.referenceImage.bar.close" data-testid="convert-to-beads-close" @click="close" />
    </div>

    <div class="convert-popover__size">
      <span class="convert-popover__label">{{ words.size }}</span>
      <span class="convert-popover__grid" data-testid="convert-to-beads-size">{{ fillBlanks(t.referenceImage.bar.sizeBeads, { size: size.grid }) }}</span>
      <span class="convert-popover__measure">{{ fillBlanks(words.measure, { measure: size.measure }) }}</span>
      <InfoButton :label="words.sizeInfoName" :body="words.sizeInfo" />
    </div>

    <div class="convert-popover__part">
      <span :id="sourceId" class="convert-popover__label">{{ wizard.matchTo }}</span>
      <SegmentedControl :model-value="source" :options="sourceOptions" :labelledby="sourceId" class="convert-popover__source" data-testid="convert-to-beads-source" @update:model-value="emit('source', $event)" />
      <p class="convert-popover__note">{{ sourceNote }}</p>
    </div>

    <div class="convert-popover__part">
      <div class="convert-popover__colors">
        <span class="convert-popover__control">{{ wizard.colorsLabel }}</span>
        <span class="convert-popover__count" data-testid="convert-to-beads-count">{{ countText }}</span>
        <AppStepper
          v-model="colorsModel"
          :min="1"
          :max="colorsMax"
          :decrease-label="t.referenceImage.convert.colorsLess"
          :value-label="wizard.colorsLabel"
          :increase-label="t.referenceImage.convert.colorsMore"
          decrease-testid="convert-to-beads-fewer"
          increase-testid="convert-to-beads-more"
        />
      </div>
      <ul class="convert-popover__swatches" data-testid="convert-to-beads-swatches">
        <li v-for="hex in swatches" :key="hex" class="convert-popover__swatch" :style="{ background: hex }" />
      </ul>
    </div>

    <div class="convert-popover__switch">
      <span>{{ words.hideAfter }}</span>
      <AppSwitch v-model="hideModel" :label="words.hideAfter" data-testid="convert-to-beads-hide" />
    </div>

    <p v-if="replacedLabel" class="convert-popover__replaces" data-testid="convert-to-beads-replaces">{{ replacedLabel }}</p>
    <div class="convert-popover__actions">
      <AppButton trailing-icon="arrow-right" data-testid="convert-to-beads-all-settings" @click="emit('all-settings')">{{ words.allSettings }}</AppButton>
      <AppButton variant="primary" icon="convert-to-beads" :disabled="!ready" data-testid="convert-to-beads-convert" @click="emit('convert')">{{ convertLabel }}</AppButton>
    </div>
  </div>
</template>

<style scoped>
.convert-popover {
  position: absolute;
  z-index: 3;
  display: flex;
  flex-direction: column;
  gap: var(--space-14);
  box-sizing: border-box;
  width: var(--convert-popover-width);
  max-width: calc(100% - 2 * var(--space-8));
  padding: var(--space-16) var(--space-20) calc(var(--space-16) + var(--space-2));
  color: var(--ink);
  background: var(--canvas);
  border: 1px solid var(--box-line);
  border-radius: var(--radius-lg);
  box-shadow: var(--elevation-3);
  pointer-events: auto;
}

.convert-popover__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-8);
}

.convert-popover__title {
  margin: 0;
  font: var(--type-title);
}

.convert-popover__size {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-4) var(--space-8);
}

.convert-popover__label {
  width: 100%;
  font: var(--type-label);
  color: var(--muted);
  text-transform: lowercase;
}

.convert-popover__grid {
  font: var(--type-meta);
  font-weight: 500;
}

.convert-popover__measure,
.convert-popover__count {
  font: var(--type-meta);
  color: var(--muted);
}

.convert-popover__part {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.convert-popover__source {
  width: 100%;
}

/* The options share the row by their text, as the card asks; a long Bead's palette takes a row of its own. */
.convert-popover__source :deep(.segmented__option) {
  flex: 1 1 auto;
  white-space: nowrap;
}

.convert-popover__note,
.convert-popover__replaces {
  margin: 0;
  font: var(--type-small);
  color: var(--muted);
}

.convert-popover__replaces {
  color: var(--ink);
}

.convert-popover__colors {
  display: flex;
  align-items: center;
  gap: var(--space-8);
}

.convert-popover__control {
  font: var(--type-control);
}

.convert-popover__count {
  flex: 1;
}

.convert-popover__swatches {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
  max-height: calc(4 * var(--convert-swatch) + 3 * var(--space-4));
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}

.convert-popover__swatch {
  width: var(--convert-swatch);
  height: var(--convert-swatch);
  border-radius: var(--radius-sm);
  box-shadow: inset 0 0 0 1px var(--swatch-edge);
}

.convert-popover__switch {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-8);
  padding-top: var(--space-14);
  font: var(--type-control);
  border-top: 1px solid var(--panel-rule);
}

.convert-popover__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: var(--space-8);
}
</style>
