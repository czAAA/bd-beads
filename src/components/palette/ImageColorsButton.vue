<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useId } from 'vue'
import { useAnchoredPosition } from '../../composables/ui/useAnchoredPosition'
import { useEscapeLayer } from '../../composables/ui/useEscapeLayer'
import { useI18n } from '../../i18n/useI18n'
import AppIcon from '../ui/AppIcon.vue'
import AppTooltip from '../ui/AppTooltip.vue'
import ImageColorsPicker from './ImageColorsPicker.vue'

/**
 * The Image colors button (ticket 151; ColorPickers card): opens a popover under it, on the popover layer, with the
 * colors Convert image found as a 7-column grid. Choosing one, Escape or a press outside closes it, and Escape hands
 * focus back to the button. A Project with no Image colors leaves the button `faint`, saying why in its tooltip; it
 * stays focusable so that reason can be read.
 */
const props = defineProps<{
  colors?: readonly string[]
  selectedColor?: string
}>()

const emit = defineEmits<{ select: [hex: string] }>()
const { t } = useI18n()

const open = ref(false)
const rootEl = ref<HTMLElement>()
const popoverId = useId()
const buttonEl = ref<HTMLElement>()
const popoverEl = ref<HTMLElement>()
const anchored = useAnchoredPosition(buttonEl, popoverEl, () => 'end')

function onPointerDownOutside(event: PointerEvent) {
  if (rootEl.value && !rootEl.value.contains(event.target as Node)) close(false)
}

function close(returnFocus = true) {
  if (!open.value) return
  open.value = false
  document.removeEventListener('pointerdown', onPointerDownOutside)
  anchored.stop()
  if (returnFocus) rootEl.value?.querySelector<HTMLElement>('[data-testid="image-colors-button"]')?.focus()
}

async function toggle() {
  if (!props.colors?.length) return
  if (open.value) {
    close(false)
    return
  }
  open.value = true
  document.addEventListener('pointerdown', onPointerDownOutside)
  await nextTick()
  buttonEl.value = rootEl.value?.querySelector<HTMLElement>('[data-testid="image-colors-button"]') ?? undefined
  anchored.follow()
  const swatches = rootEl.value?.querySelectorAll<HTMLElement>('[data-testid="image-color-swatch"]')
  ;([...(swatches ?? [])].find((swatch) => swatch.getAttribute('aria-pressed') === 'true') ?? swatches?.[0])?.focus()
}

function onSelect(hex: string) {
  emit('select', hex)
  close()
}

useEscapeLayer(() => open.value, () => close())
onBeforeUnmount(() => document.removeEventListener('pointerdown', onPointerDownOutside))
</script>

<template>
  <div ref="rootEl" class="image-colors-button">
    <AppTooltip :name="colors?.length ? t.convertImage.imageColorsLabel : t.convertImage.noImageColors" :announce="!colors?.length">
      <template #default="{ describedby }">
        <button
          class="ui-control image-colors-button__button"
          :class="{ 'image-colors-button__button--none': !colors?.length }"
          type="button"
          :aria-disabled="!colors?.length || undefined"
          :aria-expanded="colors?.length ? open : undefined"
          :aria-controls="open ? popoverId : undefined"
          :aria-describedby="describedby"
          :aria-label="t.convertImage.imageColorsLabel"
          data-testid="image-colors-button"
          @click="toggle"
        >
          <AppIcon name="image" :size="15" />
          <span class="image-colors-button__label">{{ t.convertImage.imageColorsShort }}</span>
        </button>
      </template>
    </AppTooltip>
    <!-- Kept in the page while closed, hidden, so the Project's Image colors are always the same swatches. -->
    <div
      v-if="colors?.length"
      v-show="open"
      :id="popoverId"
      ref="popoverEl"
      class="image-colors-button__popover"
      :style="anchored.style.value"
    >
      <ImageColorsPicker :colors="colors" :selected-color="selectedColor" @select="onSelect" />
    </div>
  </div>
</template>

<style scoped>
.image-colors-button {
  position: relative;
  display: flex;
  flex: 1 1 auto;
  min-width: max-content;
}

.image-colors-button > :deep(.app-tooltip) {
  flex: 1 1 auto;
  min-width: 0;
}

/* A Toolbox button (Button card, `toolbox`): the image icon and the label. */
.image-colors-button__button {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  justify-content: center;
  gap: var(--space-8);
  box-sizing: border-box;
  min-width: 0;
  height: var(--control-height);
  padding: 0 var(--space-8);
  font: var(--type-tab);
  color: var(--ink);
  background: var(--elevated);
  border: 1px solid var(--panel-line);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: border-color var(--duration-fast) var(--ease-standard);
}

:root[data-theme='dark'] .image-colors-button__button {
  border-color: var(--elevated);
}

@media (hover: hover) {
  .image-colors-button__button:hover:not(.image-colors-button__button--none) {
    border-color: var(--ink);
  }
}

.image-colors-button__button:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: 2px;
}

.image-colors-button__button--none {
  color: var(--faint);
  cursor: default;
}

.image-colors-button__label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:root[data-theme='contrast'] .image-colors-button__button {
  border: 2px solid var(--line-strong);
}

/* The popover (Menu card's frame) under its button, on the popover layer. */
.image-colors-button__popover {
  position: absolute;
  top: calc(100% + var(--space-4));
  right: 0;
  z-index: var(--z-popover);
  box-sizing: border-box;
  padding: var(--space-8);
  background: var(--overlay-fill);
  border: 1px solid var(--overlay-line);
  border-radius: var(--radius-md);
  box-shadow: var(--elevation-3);
  animation: image-colors-arrive var(--duration-base) var(--ease-out);
}

@keyframes image-colors-arrive {
  from {
    opacity: 0;
    transform: translateY(calc(-1 * var(--space-4)));
  }
}

@media (prefers-reduced-motion: reduce) {
  .image-colors-button__popover {
    animation-name: image-colors-fade;
  }

  @keyframes image-colors-fade {
    from {
      opacity: 0;
    }
  }
}
</style>
