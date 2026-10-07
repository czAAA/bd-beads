<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useId } from 'vue'
import { useAnchoredPosition } from '../../composables/ui/useAnchoredPosition'
import { useEscapeLayer } from '../../composables/ui/useEscapeLayer'
import { useI18n } from '../../i18n/useI18n'
import { canvasBackgrounds } from '../../rendering/canvasBackgrounds'
import { useCanvasBackground } from '../../theme/useCanvasBackground'
import { useResolvedTheme } from '../../theme/useResolvedTheme'
import AppIcon from '../ui/AppIcon.vue'
import AppTooltip from '../ui/AppTooltip.vue'
import AppSwatch from '../ui/AppSwatch.vue'

/**
 * The Canvas color button and its picker (ticket 252; CanvasStrip and CanvasBackground cards): a round dot showing the
 * current background opens a popover of swatches, five in light and six in dark, with the chosen one's name and hex under
 * them. The swatches are a radio group: Tab lands on the chosen one, the arrows move and apply at once, and Escape or a
 * press outside closes it and gives focus back to the button. High contrast has one white canvas, so no button at all.
 */
const { t } = useI18n()
const theme = useResolvedTheme()
const canvas = useCanvasBackground()

const swatches = computed(() => canvasBackgrounds(theme.value))
const current = computed(() => canvas.background.value)

const open = ref(false)
const rootEl = ref<HTMLElement>()
const buttonEl = ref<HTMLElement>()
const popupEl = ref<HTMLElement>()
const popupId = useId()
const anchored = useAnchoredPosition(buttonEl, popupEl, () => 'end')

function nameOf(index: number): string {
  return t.value.canvas.canvasColor.names[swatches.value[index].id]
}

function swatchLabel(index: number): string {
  return t.value.canvas.canvasColor.swatchLabel
    .replace('{name}', nameOf(index))
    .replace('{n}', String(index + 1))
    .replace('{count}', String(swatches.value.length))
}

function onPointerDownOutside(event: PointerEvent) {
  if (rootEl.value && !rootEl.value.contains(event.target as Node)) close(false)
}

async function show() {
  open.value = true
  document.addEventListener('pointerdown', onPointerDownOutside)
  await nextTick()
  anchored.follow()
}

function close(returnFocus = true) {
  if (!open.value) return
  open.value = false
  document.removeEventListener('pointerdown', onPointerDownOutside)
  anchored.stop()
  if (returnFocus) buttonEl.value?.focus()
}

useEscapeLayer(() => open.value, () => close())
onBeforeUnmount(() => document.removeEventListener('pointerdown', onPointerDownOutside))

function toggle() {
  if (open.value) close(false)
  else void show()
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
  void nextTick(() => popupEl.value?.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus())
}

/** Leaving the popover by Tab or a click elsewhere closes it. */
function onFocusOut(event: FocusEvent) {
  if (open.value && event.relatedTarget instanceof Node && !rootEl.value?.contains(event.relatedTarget)) close(false)
}
</script>

<template>
  <div v-show="swatches.length" ref="rootEl" class="canvas-color">
    <AppTooltip :name="t.canvas.canvasColor.label" :announce="false">
      <button
        ref="buttonEl"
        class="ui-control canvas-color__button"
        type="button"
        :class="{ 'canvas-color__button--open': open }"
        :aria-label="t.canvas.canvasColor.label"
        aria-haspopup="dialog"
        :aria-expanded="open"
        :aria-controls="open ? popupId : undefined"
        data-testid="canvas-color-button"
        @click="toggle"
      >
        <span class="canvas-color__dot" :style="{ background: current?.color }" aria-hidden="true" />
      </button>
    </AppTooltip>
    <Transition name="canvas-color">
      <div
        v-if="open"
        :id="popupId"
        ref="popupEl"
        class="canvas-color__popup"
        :style="anchored.style.value"
        role="dialog"
        :aria-label="t.canvas.canvasColor.label"
        data-testid="canvas-color-picker"
        @focusout="onFocusOut"
      >
        <span class="canvas-color__label">{{ t.canvas.canvasColor.pickerLabel }}</span>
        <div class="canvas-color__swatches" role="radiogroup" :aria-label="t.canvas.canvasColor.label">
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
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.canvas-color {
  position: relative;
  display: inline-flex;
  flex: none;
}

.canvas-color__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: var(--control-height-plain);
  height: var(--control-height-plain);
  padding: 0;
  background: none;
  border: 0;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.canvas-color__button--open {
  background: var(--press-fill);
}

@media (hover: hover) {
  .canvas-color__button:hover:not(.canvas-color__button--open) {
    background: var(--hover-fill);
  }
}

.canvas-color__button:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: 2px;
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
  position: absolute;
  top: calc(100% + var(--space-4));
  z-index: var(--z-popover);
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  box-sizing: border-box;
  padding: var(--space-12);
  color: var(--ink);
  background: var(--overlay-fill);
  border: 1px solid var(--overlay-line);
  border-radius: var(--radius-md);
  box-shadow: var(--elevation-3);
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

/* Coarse pointers: 40px swatches and a 44px button (CanvasBackground card). */
@media (pointer: coarse) {
  .canvas-color__button {
    width: 44px;
    height: 44px;
  }

  .canvas-color__swatches {
    --swatch-size: 40px;
  }
}

:root[data-theme='contrast'] .canvas-color__popup {
  border-width: 2px;
  box-shadow: none;
}

.canvas-color-enter-active {
  transition:
    opacity var(--duration-base) var(--ease-out),
    transform var(--duration-base) var(--ease-out);
}

.canvas-color-leave-active {
  transition:
    opacity calc(var(--duration-base) * 0.75) var(--ease-in),
    transform calc(var(--duration-base) * 0.75) var(--ease-in);
}

.canvas-color-enter-from,
.canvas-color-leave-to {
  opacity: 0;
  transform: translateY(calc(-1 * var(--space-4)));
}

@media (prefers-reduced-motion: reduce) {
  .canvas-color-enter-from,
  .canvas-color-leave-to {
    transform: none;
  }
}
</style>
