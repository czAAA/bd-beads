<script setup lang="ts">
import { computed, nextTick, useId } from 'vue'
import { controlAction } from '../../composables/shell/controlRegistry'
import { useI18n } from '../../i18n/useI18n'
import { canvasBackgrounds } from '../../rendering/canvasBackgrounds'
import { useCanvasBackground } from '../../theme/useCanvasBackground'
import { useResolvedTheme } from '../../theme/useResolvedTheme'
import AppIcon from '../ui/AppIcon.vue'
import AppSwatch from '../ui/AppSwatch.vue'
import MenuButton from '../ui/MenuButton.vue'
import SegmentedControl from '../ui/form/SegmentedControl.vue'
import type { PositionMarkStyle } from '../../rendering/positionMarks'

/**
 * The Canvas color button and its picker (ticket 252; CanvasStrip and CanvasBackground cards): a round dot showing the
 * current background opens a popover of swatches, five in light and six in dark, with the chosen one's name and hex under
 * them, and under those the Dots | Squares choice for Position marks (ticket 348). The swatches are a radio group: Tab
 * lands on the chosen one, the arrows move and apply at once, and Escape or a press outside closes it and gives focus
 * back to the button, all of which MenuButton does. High contrast has one white canvas, so the popover holds the Position marks choice alone.
 */
const { t } = useI18n()
const theme = useResolvedTheme()
const canvas = useCanvasBackground()

const swatches = computed(() => canvasBackgrounds(theme.value))
const current = computed(() => canvas.background.value)

const marks = computed({
  get: () => canvas.positionMarks.value,
  set: (next: PositionMarkStyle) => canvas.setPositionMarks(next),
})
const marksOptions = computed(() =>
  (['dots', 'squares'] as const).map((value) => {
    const action = controlAction(`position-marks-${value}`)
    return { value, label: action.name(t.value), icon: action.icon, tooltip: { name: action.name(t.value), body: action.body?.(t.value) } }
  }),
)
const marksLabelId = useId()

const action = controlAction('canvas-color')

function nameOf(index: number): string {
  return t.value.canvas.canvasColor.names[swatches.value[index].id]
}

function swatchLabel(index: number): string {
  return t.value.canvas.canvasColor.swatchLabel
    .replace('{name}', nameOf(index))
    .replace('{n}', String(index + 1))
    .replace('{count}', String(swatches.value.length))
}

function choose(index: number) {
  canvas.setChoice(index + 1)
}

/** The arrows move to the neighbouring swatch, wrapping round, and apply it at once. */
function onSwatchKeydown(event: KeyboardEvent, index: number) {
  const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
  if (!step) return
  event.preventDefault()
  const count = swatches.value.length
  const next = (index + step + count) % count
  choose(next)
  const group = (event.currentTarget as HTMLElement | null)?.closest('.canvas-color__swatches')
  void nextTick(() => group?.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus())
}
</script>

<template>
  <MenuButton
    class="canvas-color"
    popover
    align="end"
    icon-only
    variant="plain"
    :label="action.name(t)"
    :tooltip="action.body?.(t)"
    data-testid="canvas-color-button"
  >
    <template #icon>
      <span class="canvas-color__dot" :style="{ background: current?.color ?? 'var(--canvas)' }" aria-hidden="true" />
    </template>
    <div class="canvas-color__popup" data-testid="canvas-color-picker">
      <span v-if="swatches.length" class="canvas-color__label">{{ t.canvas.canvasColor.pickerLabel }}</span>
      <div v-if="swatches.length" class="canvas-color__swatches" role="radiogroup" :aria-label="t.canvas.canvasColor.label">
        <AppSwatch
          v-for="(swatch, index) in swatches"
          :key="swatch.id"
          :color="swatch.color"
          :label="swatchLabel(index)"
          :selected="canvas.shown.value === index + 1"
          role="radio"
          :tabindex="canvas.shown.value === index + 1 ? 0 : -1"
          :data-testid="`canvas-color-${swatch.id}`"
          @select="choose(index)"
          @keydown="onSwatchKeydown($event, index)"
        >
          <AppIcon v-if="canvas.shown.value === index + 1" class="canvas-color__check" name="check" :size="16" />
        </AppSwatch>
      </div>
      <span v-if="current" class="canvas-color__name" data-testid="canvas-color-name">
        {{ nameOf(canvas.shown.value - 1) }}
        <span class="canvas-color__hex">{{ current.color }}</span>
      </span>
      <span :id="marksLabelId" class="canvas-color__label">{{ t.canvas.canvasColor.positionMarks.label }}</span>
      <SegmentedControl v-model="marks" :options="marksOptions" :labelledby="marksLabelId" small data-testid="position-marks" />
    </div>
  </MenuButton>
</template>

<style scoped>
.canvas-color {
  flex: none;
}

/* The dot's ring is `field-line`, so a near-white background stays visible (CanvasStrip card). */
.canvas-color__dot {
  width: 16px;
  height: 16px;
  box-sizing: border-box;
  border: 1.5px solid var(--field-line);
  border-radius: var(--radius-full);
}

.canvas-color__popup {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  color: var(--ink);
}

.canvas-color__label {
  font: var(--type-meta-small);
  color: var(--muted);
}

.canvas-color__swatches {
  --swatch-size: 32px;
  --swatch-gap: var(--overlay-fill);
  display: flex;
  gap: var(--space-8);
  /* Room for the 2px ring that sits 2px outside the chosen swatch. */
  padding: var(--space-4);
  margin: calc(-1 * var(--space-4));
}

.canvas-color__swatches > * {
  flex: none;
}

.canvas-color__name {
  font: var(--type-control);
}

.canvas-color__hex {
  margin-left: var(--space-4);
  font: var(--type-meta);
  color: var(--muted);
}

/* Coarse pointers: 40px swatches (CanvasBackground card). */
@media (pointer: coarse) {
  .canvas-color__swatches {
    --swatch-size: 40px;
  }
}
</style>
