<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useBeadColorsList } from '../../composables/palette/useBeadColors'
import { usePalette } from '../../composables/tools/usePalette'
import { usePlaceKeeper } from '../../composables/ui/placeKeeper'
import { measuredColorSource } from '../../domain/colorCatalog'
import { useClosePopoverOnPick } from '../shell/pickContext'
import BeadColorList from '../palette/BeadColorList.vue'
import BeadColorsEntry from '../palette/BeadColorsEntry.vue'
import CustomColorPanel from '../palette/CustomColorPanel.vue'
import CustomColorPicker from '../palette/CustomColorPicker.vue'
import PalettePicker from '../palette/PalettePicker.vue'

// The Colors group's controls (ticket 384): the Palette (Pick color from canvas, ticket 398, is its last tile) and
// Custom color, in one place so the Color sheet and any other host show the same controls.
const props = defineProps<{
  selectedColorId?: string
  /** The last Custom color chosen (CONTEXT.md), kept on its slot even once a Palette swatch deselects it. */
  customColor?: string
  /** Edit palette (ticket 531). */
  editing?: boolean
}>()

const emit = defineEmits<{
  'select-color': [colorId: string]
  'select-custom-color': [hex: string]
  /** The Bead's palette is open or not: the colour popover is as wide as the panel while it is (ticket 0746). */
  'wide-change': [wide: boolean]
}>()

/** Custom color is the active paint color exactly when no Palette swatch is (App.vue keeps the two mutually exclusive). */
const customColorSelected = computed(() => !props.selectedColorId && !!props.customColor)

// The Custom color picker expands under the grid (ticket 449) and does not close on use. Taking its color (press
// outside, Escape, Enter) hands it up once and closes the sheet holding this control; picking a Palette swatch instead
// closes the picker with nothing taken. Its + (ticket 0690) hands a color up at once and keeps the picker open.
const palette = usePalette()
// The Bead's own colors (ticket 0537) open between the grid and their button, which keeps its place on the screen
// (ticket 1092): pressed again where it is, it closes them. Only a Bead with a Color catalog offers them.
const beadColors = useBeadColorsList()
const placeKeeper = usePlaceKeeper()
const catalogEntry = ref<InstanceType<typeof BeadColorsEntry>>()
/** The list opens on the side of its button where the popover has room to grow: above it, or under it beside a pill at
 * the top; under it too in a host that places nothing (the Convert image wizard's row). Settled when it opens. */
const openedAbove = ref(false)
const listAbove = computed(() => (catalogOpen.value ? openedAbove.value : !!placeKeeper?.roomAbove.value))
const catalogOpen = ref(false)
const listShown = computed(() => catalogOpen.value && !!beadColors && !props.editing)
watch(listShown, (wide) => emit('wide-change', wide))
const closePanel = useClosePopoverOnPick()
const pickerOpen = ref(false)
const panel = ref<InstanceType<typeof CustomColorPanel>>()
const customButton = ref<InstanceType<typeof CustomColorPicker>>()
const paintHex = computed(() => palette.value.byId(props.selectedColorId)?.hex)

function take(hex: string) {
  emit('select-custom-color', hex)
  leave()
}

function selectColor(colorId: string) {
  pickerOpen.value = false
  emit('select-color', colorId)
}

function leave() {
  pickerOpen.value = false
  closePanel()
}

function toggleCatalog() {
  const entry = catalogEntry.value?.$el as HTMLElement | undefined
  if (entry) placeKeeper?.keep(entry)
  if (!catalogOpen.value) openedAbove.value = !!placeKeeper?.roomAbove.value
  catalogOpen.value = !catalogOpen.value
  if (catalogOpen.value) pickerOpen.value = false
}

function toggle() {
  placeKeeper?.release()
  catalogOpen.value = false
  if (pickerOpen.value) panel.value?.take()
  else pickerOpen.value = true
}

async function cancel() {
  pickerOpen.value = false
  await nextTick()
  customButton.value?.focus()
}
</script>

<template>
  <PalettePicker :selected-color-id="selectedColorId" :editing="editing" :wide="listShown" @select="selectColor">
    <CustomColorPicker ref="customButton" :selected="customColorSelected" :expanded="pickerOpen" :disabled="editing" @toggle="toggle" />
  </PalettePicker>
  <BeadColorList v-if="beadColors && listShown && listAbove" :colors="beadColors" />
  <BeadColorsEntry
    v-if="beadColors?.available.value && !editing"
    ref="catalogEntry"
    :bead="beadColors.bead.value"
    :measured-from="measuredColorSource(beadColors.catalog.value)"
    :open="catalogOpen"
    :removable="!!beadColors.remove"
    :opens-above="listAbove"
    class="tool-color-controls__catalog"
    :style="placeKeeper?.shift.value ? { marginLeft: `${placeKeeper.shift.value}px` } : undefined"
    testid="bead-colors-toggle"
    @toggle="toggleCatalog"
  />
  <BeadColorList v-if="beadColors && listShown && !listAbove" :colors="beadColors" />
  <CustomColorPanel
    ref="panel"
    v-if="pickerOpen"
    :color="customColor ?? paintHex"
    addable
    @take="take"
    @add="emit('select-custom-color', $event)"
    @leave="leave"
    @cancel="cancel"
  />
</template>

<style scoped>
.tool-color-controls__catalog {
  margin-top: var(--space-12);
}
</style>
