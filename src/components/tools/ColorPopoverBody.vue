<script setup lang="ts">
import { computed, watch } from 'vue'
import { controlAction } from '../../composables/shell/controlRegistry'
import { usePalette, useRemoveAllAddedColors } from '../../composables/tools/usePalette'
import { isAddedColorId } from '../../domain/palette'
import { useI18n } from '../../i18n/useI18n'
import IconButton from '../ui/IconButton.vue'
import ToolColorControls from './ToolColorControls.vue'

// The colour popover's body (ticket 439, ADR 0046; ToolPill card; ticket 0758): the head with the chosen colour, then
// the Palette with Pick color and Custom color. The Tool pill's popover and Convert image's Change picker both show it,
// each with its own Palette, Bead colors and way to close.
const props = withDefaults(
  defineProps<{
    colorHex?: string
    colorName?: string
    selectedColorId?: string
    customColor?: string
    /** The section's label; the Palette's by default. */
    paletteLabel?: string
    /** Whether the Palette's added colors can be edited (the pencil in the head, Remove all). */
    editable?: boolean
  }>(),
  { colorHex: undefined, colorName: undefined, selectedColorId: undefined, customColor: undefined, paletteLabel: undefined, editable: true },
)

const emit = defineEmits<{
  close: []
  'select-color': [colorId: string]
  'select-custom-color': [hex: string]
  /** The Bead's palette is open or not: the host is as wide as the panel while it is (ticket 0746). */
  'wide-change': [wide: boolean]
}>()

/** Edit palette (ticket 531): the host owns the mode, since its Escape ends it before it closes. */
const editing = defineModel<boolean>('editing', { default: false })

const { t } = useI18n()
const closeAction = controlAction('close')
const editAction = controlAction('edit-palette')
const removeAllAction = controlAction('remove-all-colors')
const removeAll = useRemoveAllAddedColors()

// The pencil is there while the Palette has an added color, and the mode ends with the last added color.
const palette = usePalette()
const hasAdded = computed(() => props.editable && palette.value.colors.some((color) => isAddedColorId(color.id)))
watch(hasAdded, (has) => {
  if (!has) editing.value = false
})
</script>

<template>
  <div class="color-popover-body__head">
    <span class="color-popover-body__chosen" :style="{ backgroundColor: colorHex ?? 'transparent' }" />
    <span class="color-popover-body__name" data-testid="color-popover-name">{{ colorName }}</span>
    <span v-if="colorHex" class="color-popover-body__hex">{{ colorHex }}</span>
    <IconButton
      v-if="hasAdded"
      class="color-popover-body__edit"
      variant="plain"
      :action="editAction"
      :label="editing ? t.palette.doneEditingPalette : t.palette.editPalette"
      :icon-size="16"
      :pressed="editing"
      data-testid="color-popover-edit"
      @click="editing = !editing"
    />
    <span v-if="$slots.head" class="color-popover-body__extra"><slot name="head" /></span>
    <IconButton class="color-popover-body__close" variant="plain" :action="closeAction" :label="t.toolPill.close" :icon-size="16" data-testid="color-popover-close" @click="emit('close')" />
  </div>

  <div class="color-popover-body__section">
    <span class="color-popover-body__label-row">
      <span class="color-popover-body__label">{{ paletteLabel ?? t.toolPill.palette }}</span>
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
      @wide-change="emit('wide-change', $event)"
    />
  </div>
</template>

<style scoped>
.color-popover-body__head {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  min-width: 0;
}

.color-popover-body__chosen {
  flex: none;
  width: var(--space-20);
  height: var(--space-20);
  border-radius: var(--radius-sm);
  box-shadow: inset 0 0 0 1px var(--swatch-edge);
}

.color-popover-body__name {
  min-width: 0;
  overflow: hidden;
  font: var(--type-control);
  color: var(--ink);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.color-popover-body__hex {
  flex: none;
  font: var(--type-meta-small);
  color: var(--muted);
}

.color-popover-body__edit {
  flex: none;
  margin-left: auto;
}

.color-popover-body__edit[aria-pressed='true'] {
  color: var(--accent);
  background: var(--press-fill);
}

.color-popover-body__extra {
  flex: none;
  margin-left: auto;
}

.color-popover-body__edit + .color-popover-body__extra,
.color-popover-body__edit + .color-popover-body__close,
.color-popover-body__extra + .color-popover-body__close {
  margin-left: 0;
}

.color-popover-body__close {
  flex: none;
  margin-left: auto;
}

.color-popover-body__section {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.color-popover-body__label-row {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.color-popover-body__label {
  font: var(--type-meta-small);
  color: var(--muted);
}
</style>
