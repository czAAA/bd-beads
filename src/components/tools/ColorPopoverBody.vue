<script setup lang="ts">
import { computed, watch } from 'vue'
import { controlAction } from '../../composables/shell/controlRegistry'
import { usePalette, usePaletteLetters, useRemoveAllAddedColors } from '../../composables/tools/usePalette'
import { isAddedColorId } from '../../domain/palette'
import { useI18n } from '../../i18n/useI18n'
import BeadSwatchChip from '../palette/BeadSwatchChip.vue'
import AppSwitch from '../ui/AppSwitch.vue'
import IconButton from '../ui/IconButton.vue'
import ToolColorControls from './ToolColorControls.vue'

// The colour popover's body (ticket 439, ADR 0046; ToolPill card; ticket 0758): the head with the chosen colour, then
// the Palette with Pick color and Custom color. The Tool pill's popover and Convert image's Change picker both show it,
// each with its own Palette, Bead colors and way to close.
const props = withDefaults(
  defineProps<{
    colorHex?: string
    colorName?: string
    /** Whether the chosen color is a Bead color made from its family and Finish (true), read from a photo (false), or no bead of a catalog (ticket 0905). */
    colorApproximate?: boolean
    selectedColorId?: string
    customColor?: string
    /** The section's label; the Palette's by default. */
    paletteLabel?: string
    /** Whether the Palette's added colors can be edited (the pencil in the head, Remove all). */
    editable?: boolean
  }>(),
  { colorHex: undefined, colorName: undefined, colorApproximate: undefined, selectedColorId: undefined, customColor: undefined, paletteLabel: undefined, editable: true },
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
const doneAction = controlAction('done-editing-palette')
const lettersAction = controlAction('palette-letters')
// The Palette's Letters switch (ticket 1092): the Canvas's own, where the host has a Project to letter.
const paletteLetters = usePaletteLetters()
const removeAllAction = controlAction('remove-all-colors')
const removeAll = useRemoveAllAddedColors()

// The pencil is there while Edit palette has something to change: an added color to remove, or the letters where the
// host hands them out (ticket 1092). The mode ends when nothing is left to change.
const palette = usePalette()
const hasAdded = computed(() => palette.value.colors.some((color) => isAddedColorId(color.id)))
const canEdit = computed(() => props.editable && (hasAdded.value || !!paletteLetters))
watch(canEdit, (can) => {
  if (!can) editing.value = false
})
</script>

<template>
  <div class="color-popover-body__head">
    <BeadSwatchChip v-if="colorApproximate !== undefined && colorHex" :hex="colorHex" :size="16" :approximate="colorApproximate" />
    <span v-else class="color-popover-body__chosen" :style="{ backgroundColor: colorHex ?? 'transparent' }" />
    <span class="color-popover-body__name" data-testid="color-popover-name">{{ colorName }}</span>
    <span v-if="colorHex" class="color-popover-body__hex">{{ colorHex }}</span>
    <IconButton
      v-if="canEdit"
      class="color-popover-body__edit"
      :class="{ 'color-popover-body__edit--done': editing }"
      variant="plain"
      :action="editing ? doneAction : editAction"
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
        v-if="editing && removeAll && hasAdded"
        variant="plain"
        :action="removeAllAction"
        :label="t.palette.removeAllColors"
        :icon-size="16"
        data-testid="color-popover-remove-all"
        @click="removeAll()"
      />
      <span v-if="editable && paletteLetters" class="color-popover-body__letters">
        <span class="color-popover-body__label" aria-hidden="true">{{ t.frame.lettersLabel }}</span>
        <AppSwitch :model-value="paletteLetters.shown.value" :action="lettersAction" data-testid="palette-letters" @update:model-value="paletteLetters.setShown" />
      </span>
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

/* Done editing (ticket 1092): the check in the accent on the pressed fill, plainly not the pencil. The class is on the
 * button inside IconButton, so it is reached through `:deep`. */
.color-popover-body__head :deep(.color-popover-body__edit--done) {
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

/* The Letters switch at the row's end (ticket 1092), its word before it as in the margin's title block. */
.color-popover-body__letters {
  display: inline-flex;
  gap: var(--space-6);
  align-items: center;
  margin-left: auto;
}
</style>
