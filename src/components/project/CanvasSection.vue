<script setup lang="ts">
import { computed, nextTick } from 'vue'
import { useI18n } from '../../i18n/useI18n'
import { canvasBackgrounds } from '../../rendering/canvasBackgrounds'
import { useCanvasBackground } from '../../theme/useCanvasBackground'
import { useResolvedTheme } from '../../theme/useResolvedTheme'
import AppIcon from '../ui/AppIcon.vue'
import AppSwatch from '../ui/AppSwatch.vue'
import { fillBlanks } from '../../domain/fillBlanks'

// The body of the Project panel's canvas section (ProjectPanel and CanvasBackground cards, tickets 252, 348, 443, 554):
// Canvas background swatches (five in each theme; a radio group applying at once) and the chosen one's name and hex. High
// contrast has one white canvas, so only a line saying so remains.
const { t } = useI18n()
const theme = useResolvedTheme()
const canvas = useCanvasBackground()

const swatches = computed(() => canvasBackgrounds(theme.value))
const current = computed(() => canvas.background.value)

function nameOf(index: number): string {
  return t.value.canvas.canvasColor.names[swatches.value[index].id]
}

function swatchLabel(index: number): string {
  return fillBlanks(t.value.canvas.canvasColor.swatchLabel, { name: nameOf(index), n: index + 1, count: swatches.value.length })
}

function choose(index: number) {
  canvas.setChoice(index + 1)
}

/** The arrows move to the neighbouring swatch, wrapping round, and apply it at once. */
function onSwatchKeydown(event: KeyboardEvent, index: number) {
  const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
  if (!step) return
  event.preventDefault()
  event.stopPropagation()
  const count = swatches.value.length
  const next = (index + step + count) % count
  choose(next)
  const group = (event.currentTarget as HTMLElement | null)?.closest('.canvas-section__swatches')
  void nextTick(() => group?.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus())
}
</script>

<template>
  <div class="canvas-section" data-testid="canvas-section">
    <div v-if="swatches.length" class="canvas-section__swatches" role="radiogroup" :aria-label="t.canvas.canvasColor.label" data-testid="canvas-color-picker">
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
        <AppIcon v-if="canvas.shown.value === index + 1" class="canvas-section__check" name="check" :size="16" />
      </AppSwatch>
    </div>
    <p v-else class="canvas-section__white" data-testid="canvas-stays-white">{{ t.panels.project.whiteInContrast }}</p>
    <span v-if="current" class="canvas-section__name" data-testid="canvas-color-name">
      {{ nameOf(canvas.shown.value - 1) }}
      <span class="canvas-section__hex">{{ current.color }}</span>
    </span>
  </div>
</template>

<style scoped>
.canvas-section {
  --swatch-size: 26px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-8);
  padding: var(--space-4) var(--space-10);
  color: var(--ink);
}

.canvas-section__swatches {
  --swatch-gap: var(--overlay-fill);
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-6);
  /* Room for the 2px ring that sits 2px outside the chosen swatch. */
  padding: var(--space-4);
  margin: calc(-1 * var(--space-4));
}

.canvas-section__swatches > * {
  flex: none;
}

.canvas-section__white {
  margin: 0;
  font: var(--type-body);
  color: var(--body);
}

.canvas-section__name {
  font: var(--type-control);
}

.canvas-section__hex {
  margin-left: var(--space-4);
  font: var(--type-meta);
  color: var(--muted);
}
</style>
