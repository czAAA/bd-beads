<script setup lang="ts">
import { controlAction } from '../../composables/shell/controlRegistry'
import { useColorPick } from '../../composables/tools/usePalette'
import IconButton from '../ui/IconButton.vue'
import { useClosePopoverOnPick } from '../shell/pickContext'

// Pick color from canvas (ticket 398; PaletteSwatches card): the last swatch-grid tile, a 22px eyedropper (ticket 403).
// It arms the pick: the next press on a bead takes its color (the Palette gains it if a slot is free); pressed again
// it disarms. Armed, the canvas pointer is the eyedropper; arming closes the colour popover.
/** Edit palette (ticket 531) disables it. */
defineProps<{ disabled?: boolean }>()
const colorPick = useColorPick()
const closePanel = useClosePopoverOnPick()
const action = controlAction('pick-color')

function onClick() {
  const arming = !colorPick!.picking.value
  colorPick!.toggle()
  if (arming) closePanel()
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
    :disabled="disabled"
    data-testid="pick-color-button"
    @click="onClick"
  />
</template>
