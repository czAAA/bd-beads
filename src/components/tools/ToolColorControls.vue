<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useBeadColorsList } from '../../composables/palette/useBeadColors'
import { usePalette } from '../../composables/tools/usePalette'
import { useI18n } from '../../i18n/useI18n'
import { useClosePopoverOnPick } from '../shell/pickContext'
import AppButton from '../ui/AppButton.vue'
import BeadColorList from '../palette/BeadColorList.vue'
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
}>()

/** Custom color is the active paint color exactly when no Palette swatch is (App.vue keeps the two mutually exclusive). */
const customColorSelected = computed(() => !props.selectedColorId && !!props.customColor)

// The Custom color picker expands under the grid (ticket 449) and does not close on use. Taking its color (press
// outside, Escape, Enter) hands it up once and closes the sheet holding this control; picking a Palette swatch instead
// closes the picker with nothing taken. Its + (ticket 0690) hands a color up at once and keeps the picker open.
const palette = usePalette()
const { t } = useI18n()
// The Bead's own colors (ticket 0537) open under the grid the same way; only a Bead with a Color catalog offers them.
const beadColors = useBeadColorsList()
const catalogOpen = ref(false)
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
  catalogOpen.value = !catalogOpen.value
  if (catalogOpen.value) pickerOpen.value = false
}

function toggle() {
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
  <PalettePicker :selected-color-id="selectedColorId" :editing="editing" @select="selectColor">
    <CustomColorPicker ref="customButton" :selected="customColorSelected" :expanded="pickerOpen" :disabled="editing" @toggle="toggle" />
  </PalettePicker>
  <AppButton
    v-if="beadColors?.available.value && !editing"
    variant="in-box"
    size="sm"
    :trailing-icon="catalogOpen ? 'chevron-up' : 'chevron-down'"
    :aria-expanded="catalogOpen"
    class="tool-color-controls__catalog"
    data-testid="bead-colors-toggle"
    @click="toggleCatalog"
  >
    {{ t.palette.beadColors.open }}
  </AppButton>
  <BeadColorList v-if="beadColors && catalogOpen && !editing" :colors="beadColors" />
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
