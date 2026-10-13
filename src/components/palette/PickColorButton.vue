<script setup lang="ts">
import { controlAction } from '../../composables/shell/controlRegistry'
import { useColorPick } from '../../composables/tools/usePalette'
import IconButton from '../ui/IconButton.vue'
import { useCloseSheetOnPick } from '../shell/sheetContext'

/**
 * Pick color from canvas (ticket 398; PaletteSwatches card): the last tile of the swatch grid, a swatch's size with a
 * 22px eyedropper (ticket 403). It arms the pick, so the next press on a bead takes its color as the paint color (the
 * Palette gains it when a slot is free); pressed again it disarms. While armed the canvas pointer is the eyedropper
 * (ProjectSurface). Arming closes a Dock sheet, which would otherwise cover the canvas it is about to be picked from.
 */
const colorPick = useColorPick()
const closeSheet = useCloseSheetOnPick()
const action = controlAction('pick-color')

function onClick() {
  const arming = !colorPick!.picking.value
  colorPick!.toggle()
  if (arming) closeSheet()
}
</script>

<template>
  <IconButton
    v-if="colorPick"
    variant="toolbox"
    size="lg"
    :icon-size="22"
    :action="action"
    :deps="{}"
    :pressed="colorPick.picking.value"
    data-testid="pick-color-button"
    @click="onClick"
  />
</template>
