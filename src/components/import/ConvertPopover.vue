<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import { wouldRaiseKeyboard } from '../../composables/ui/touchKeyboard'
import { useOverlayLayer } from '../../composables/ui/useOverlayLayer'

// A popover of the quiet converter (ConvertImage card DS-1, ticket 0896), from its own button, never a panel: `beside`
// the column, level with its section; `level` beside it, its bottom level with its button's (Clean up, ticket 0906); `tall`
// down the preview (Colors); `bar` over the floating bar (Background). Under 1024 px or in portrait it opens in place.
const props = defineProps<{
  /** Where it stands from 1024 px wide in landscape. */
  place: 'beside' | 'tall' | 'bar' | 'level'
  /** Its accessible name. */
  label: string
  /** The button that opened it: its own press toggles, and focus goes back to it on close. */
  opener: () => HTMLElement | undefined
  /** The section it stands level with (`beside`), or the button whose bottom its bottom is level with (`level`). */
  anchor?: () => HTMLElement | undefined
  /** A press outside it that still works its own thing, so it stays open (the Background tool's taps on the beads). */
  keepsPress?: (event: PointerEvent) => boolean
  testid: string
}>()
const emit = defineEmits<{ close: [] }>()

const rootEl = ref<HTMLElement>()
const top = ref<number>()
const bottom = ref<number>()

function close() {
  emit('close')
  props.opener()?.focus({ preventScroll: true })
}

useOverlayLayer({
  isOpen: () => true,
  root: () => rootEl.value,
  close,
  isOpener: (target) => props.opener()?.contains(target) ?? false,
  keepsPress: props.keepsPress,
})

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'

onMounted(async () => {
  const section = props.anchor?.()
  const page = rootEl.value?.closest('.convert-page')
  if (section && page && props.place === 'level') bottom.value = page.getBoundingClientRect().bottom - section.getBoundingClientRect().bottom
  else if (section && page) top.value = section.getBoundingClientRect().top - page.getBoundingClientRect().top
  await nextTick()
  // A field first would raise a touch keyboard nobody asked for: the popover itself takes focus then (ticket 0688).
  const first = rootEl.value?.querySelector<HTMLElement>(FOCUSABLE)
  ;(first && !wouldRaiseKeyboard(first) ? first : rootEl.value)?.focus({ preventScroll: true })
})
</script>

<template>
  <div
    ref="rootEl"
    class="convert-popover"
    :class="`convert-popover--${place}`"
    :style="top !== undefined ? { top: `${top}px` } : bottom !== undefined ? { bottom: `${bottom}px` } : undefined"
    role="dialog"
    tabindex="-1"
    :aria-label="label"
    :data-testid="testid"
  >
    <slot />
  </div>
</template>

<style scoped>
.convert-popover {
  position: absolute;
  z-index: 6;
  box-sizing: border-box;
  max-height: calc(100% - var(--space-32));
  overflow-y: auto;
  overscroll-behavior: contain;
  background: var(--elevated);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  box-shadow: var(--elevation-3);
}

.convert-popover:focus {
  outline: none;
}

:root[data-theme='dark'] .convert-popover {
  border-color: var(--line-strong);
  box-shadow: none;
}

/* To the column's left, over the preview's right edge, 12 from the column; never wider than the preview less 12 a side. */
.convert-popover--beside,
.convert-popover--level,
.convert-popover--tall {
  right: calc(var(--convert-column-width) + var(--space-12));
  max-width: calc(100% - var(--convert-column-width) - var(--space-24));
}

.convert-popover--beside {
  width: var(--convert-setting-popover-width);
  padding: var(--space-14) var(--space-16) var(--space-16);
}

.convert-popover--level {
  width: var(--convert-setting-popover-width);
  padding: var(--space-14) var(--space-16);
}

.convert-popover--tall {
  top: var(--space-16);
  bottom: var(--space-16);
  display: flex;
  flex-direction: column;
  width: var(--convert-colors-popover-width);
  overflow: hidden;
}

/* Centred over the floating bar, its bottom 78 above the preview's bottom (82 on a coarse pointer). */
.convert-popover--bar {
  bottom: var(--convert-background-popover-bottom);
  left: calc((100% - var(--convert-column-width)) / 2);
  width: var(--convert-background-popover-width);
  max-width: calc(100% - var(--convert-column-width) - var(--space-32));
  padding: var(--space-14) var(--space-16) var(--space-8);
  transform: translateX(-50%);
}

@media (pointer: coarse) {
  .convert-popover--bar {
    bottom: var(--convert-background-popover-bottom-touch);
    width: var(--convert-background-popover-width-touch);
  }
}

@media (max-width: 74.99rem) {
  .convert-popover--beside,
  .convert-popover--level,
  .convert-popover--tall {
    right: calc(var(--convert-column-width-narrow) + var(--space-12));
    max-width: calc(100% - var(--convert-column-width-narrow) - var(--space-24));
  }

  .convert-popover--tall {
    width: var(--convert-colors-popover-width-narrow);
  }

  .convert-popover--bar {
    left: calc((100% - var(--convert-column-width-narrow)) / 2);
    max-width: calc(100% - var(--convert-column-width-narrow) - var(--space-32));
  }
}

/* Under 1024 px or in portrait the column stacks under the preview: the popover opens in place, in the column's flow. */
@media (max-width: 63.99rem), (orientation: portrait) {
  .convert-popover,
  .convert-popover--tall,
  .convert-popover--bar {
    position: static;
    inset: auto;
    width: auto;
    max-width: none;
    max-height: none;
    margin: 0 0 var(--space-12);
    overflow: visible;
    border-inline: 0;
    border-radius: 0;
    box-shadow: none;
    transform: none;
  }
}
</style>
