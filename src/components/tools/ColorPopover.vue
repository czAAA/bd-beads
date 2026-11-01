<script setup lang="ts">
import { provide, ref } from 'vue'
import { useOverlayLayer } from '../../composables/ui/useOverlayLayer'
import { usePillPopoverPlacement } from '../../composables/tools/usePillPopoverPlacement'
import type { PillPosition } from '../../domain/toolPill'
import { useI18n } from '../../i18n/useI18n'
import { PICK_CLOSE } from '../shell/pickContext'
import ColorPopoverBody from './ColorPopoverBody.vue'

// The colour popover (ticket 439, ADR 0046; ToolPill card): the Colour sheet's replacement on every device. Its body
// (ColorPopoverBody) is the head with the chosen colour, then the Palette with Pick color and Custom color.
// Beside the pill, clamped to the screen. Choosing, Close, Escape or a press outside closes it.
const props = defineProps<{
  /** The colour tile that opened it, and the pill it is part of: where the popover is placed. */
  tile: HTMLElement | undefined
  pill: HTMLElement | undefined
  position: PillPosition
  colorHex?: string
  colorName?: string
  selectedColorId?: string
  customColor?: string
}>()

const emit = defineEmits<{
  close: []
  'select-color': [colorId: string]
  'select-custom-color': [hex: string]
}>()

const { t } = useI18n()
const rootEl = ref<HTMLElement>()
// Edit palette (ticket 531): the popover always opens in normal mode.
const editing = ref(false)
/** The Bead's palette is open (ticket 0746): the popover is as wide as the panel, no wider than the screen. */
const wide = ref(false)

provide(PICK_CLOSE, () => emit('close'))
useOverlayLayer({
  isOpen: () => true,
  root: () => rootEl.value,
  close: () => (editing.value ? (editing.value = false) : emit('close')),
  isOpener: (target) => props.tile?.contains(target) ?? false,
})

const style = usePillPopoverPlacement(rootEl, () => ({ tile: props.tile, pill: props.pill, position: props.position }))
</script>

<template>
  <div ref="rootEl" class="color-popover" :class="{ 'color-popover--wide': wide }" :style="style" role="dialog" :aria-label="t.toolPill.popover" data-testid="color-popover">
    <ColorPopoverBody
      v-model:editing="editing"
      :color-hex="colorHex"
      :color-name="colorName"
      :selected-color-id="selectedColorId"
      :custom-color="customColor"
      @close="emit('close')"
      @select-color="(id) => emit('select-color', id)"
      @select-custom-color="(hex) => emit('select-custom-color', hex)"
      @wide-change="wide = $event"
    />
  </div>
</template>

<style scoped>
/* 288px, --pill-popover-radius corners, overlay fill and line, elevation-3, padding 12px 14px 14px, 12px between
 * sections (ToolPill card). */
.color-popover {
  position: fixed;
  /* In the app shell, not the canvas box (ToolPill), so nothing there clips it or is drawn over it. */
  z-index: var(--z-popover);
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
  box-sizing: border-box;
  width: var(--popover-width);
  /* Never taller than the screen: what opens inside it (the Custom color picker) scrolls when there is no room. */
  max-height: calc(100dvh - 2 * var(--float-edge));
  padding: var(--space-12) var(--space-14) var(--space-14);
  overflow-y: auto;
  /* Its own scroll stops at its ends: a drag past them must not carry on into the page. */
  overscroll-behavior: none;
  background: var(--overlay-fill);
  border: 1px solid var(--overlay-line);
  border-radius: var(--pill-popover-radius);
  box-shadow: var(--elevation-3);
  animation: color-popover-in var(--duration-slow) var(--ease-out);
}

@keyframes color-popover-in {
  from {
    opacity: 0;
    transform: scale(0.94);
  }
}

.color-popover--wide {
  width: min(var(--popover-width-wide), calc(100vw - 2 * var(--float-edge)));
}
</style>
