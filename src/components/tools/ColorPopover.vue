<script setup lang="ts">
import { computed, provide, ref, watch } from 'vue'
import { controlAction } from '../../composables/shell/controlRegistry'
import { usePalette, useRemoveAllAddedColors } from '../../composables/tools/usePalette'
import { useOverlayLayer } from '../../composables/ui/useOverlayLayer'
import { usePillPopoverPlacement } from '../../composables/tools/usePillPopoverPlacement'
import { isAddedColorId } from '../../domain/palette'
import type { PillPosition } from '../../domain/toolPill'
import { useI18n } from '../../i18n/useI18n'
import IconButton from '../ui/IconButton.vue'
import { PICK_CLOSE } from '../shell/pickContext'
import ToolColorControls from './ToolColorControls.vue'

// The colour popover (ticket 439, ADR 0046; ToolPill card): the Colour sheet's replacement on every device. Head with
// the chosen colour, then the Palette with Pick color and Custom color.
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
const closeAction = controlAction('close')
const editAction = controlAction('edit-palette')
const removeAllAction = controlAction('remove-all-colors')
const removeAll = useRemoveAllAddedColors()

// Edit palette (ticket 531): the pencil is there while the Palette has an added color; the popover always opens
// in normal mode, and the mode ends with the last added color.
const palette = usePalette()
const hasAdded = computed(() => palette.value.colors.some((color) => isAddedColorId(color.id)))
const editing = ref(false)
watch(hasAdded, (has) => {
  if (!has) editing.value = false
})

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
  <div ref="rootEl" class="color-popover" :style="style" role="dialog" :aria-label="t.toolPill.popover" data-testid="color-popover">
    <div class="color-popover__head">
      <span class="color-popover__chosen" :style="{ backgroundColor: colorHex ?? 'transparent' }" />
      <span class="color-popover__name" data-testid="color-popover-name">{{ colorName }}</span>
      <span v-if="colorHex" class="color-popover__hex">{{ colorHex }}</span>
      <IconButton
        v-if="hasAdded"
        class="color-popover__edit"
        variant="plain"
        :action="editAction"
        :label="editing ? t.palette.doneEditingPalette : t.palette.editPalette"
        :icon-size="16"
        :pressed="editing"
        data-testid="color-popover-edit"
        @click="editing = !editing"
      />
      <IconButton class="color-popover__close" variant="plain" :action="closeAction" :label="t.toolPill.close" :icon-size="16" data-testid="color-popover-close" @click="emit('close')" />
    </div>

    <div class="color-popover__section">
      <span class="color-popover__label-row">
        <span class="color-popover__label">{{ t.toolPill.palette }}</span>
        <IconButton
          v-if="editing && removeAll"
          variant="plain"
          :action="removeAllAction"
          :label="t.palette.removeAllColors"
          :icon-size="16"
          data-testid="color-popover-remove-all"
          @click="removeAll()"
        />
      </span>
      <ToolColorControls
        :selected-color-id="selectedColorId"
        :custom-color="customColor"
        :editing="editing"
        @select-color="(id) => emit('select-color', id)"
        @select-custom-color="(hex) => emit('select-custom-color', hex)"
      />
    </div>
  </div>
</template>

<style scoped>
/* 288px, --pill-popover-radius corners, overlay fill and line, elevation-3, padding 12px 14px 14px, 12px between
 * sections (ToolPill card). */
.color-popover {
  position: fixed;
  z-index: var(--z-popover);
  /* It lives in the pill's layer, which takes no pointer events so the canvas under it stays usable; the popover
   * takes its own. */
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
  box-sizing: border-box;
  width: var(--popover-width);
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

.color-popover__head {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  min-width: 0;
}

.color-popover__chosen {
  flex: none;
  width: var(--space-20);
  height: var(--space-20);
  border-radius: var(--radius-sm);
  box-shadow: inset 0 0 0 1px var(--swatch-edge);
}

.color-popover__name {
  min-width: 0;
  overflow: hidden;
  font: var(--type-control);
  color: var(--ink);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.color-popover__hex {
  flex: none;
  font: var(--type-meta-small);
  color: var(--muted);
}

.color-popover__edit {
  flex: none;
  margin-left: auto;
}

.color-popover__edit[aria-pressed='true'] {
  color: var(--accent);
  background: var(--press-fill);
}

.color-popover__edit + .color-popover__close {
  margin-left: 0;
}

.color-popover__close {
  flex: none;
  margin-left: auto;
}

.color-popover__section {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.color-popover__label-row {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.color-popover__label {
  font: var(--type-meta-small);
  color: var(--muted);
}
</style>
