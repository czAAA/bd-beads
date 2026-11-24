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
import AddColorPopover from '../palette/AddColorPopover.vue'
import PickColorButton from '../palette/PickColorButton.vue'
import AppButton from '../ui/AppButton.vue'
import { useI18n } from '../../i18n/useI18n'
import { useShellScope } from '../../composables/ui/shellScope'

// The Colors group's controls (ticket 384): the Palette (Pick color from canvas, ticket 398, is its last tile) and
// Custom color, in one place so the Color sheet and any other host show the same controls.
const props = defineProps<{
  selectedColorId?: string
  /** The last Custom color chosen (CONTEXT.md), kept on its slot even once a Palette swatch deselects it. */
  customColor?: string
  /** Edit palette (ticket 531). */
  editing?: boolean
  /** The one Add another color button, its popover beside this one, in place of the Custom color and Bead colors entries
   * (ticket 1226); the Convert image picker keeps the two entries. */
  addAnother?: boolean
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
const { t } = useI18n()
const palette = usePalette()
const addOpen = ref(false)
/** The popover has no room beside the Palette's: it then lives in the Palette popover's own flow. */
const addStacked = ref(false)
const addButton = ref<InstanceType<typeof AppButton>>()
const shell = useShellScope()
/** Where the Palette popover is, which the Add another color popover stands beside; teleported out of it. */
const paletteEl = computed(() => (addOpen.value ? ((addButton.value?.$el as HTMLElement | undefined)?.closest('[data-beside-anchor]') ?? null) : null))
const shellFound = computed(() => addOpen.value && document.querySelector(shell.teleportTo) !== null)
watch(() => props.editing, (editing) => editing && (addOpen.value = false))
watch(addOpen, (open) => open || (addStacked.value = false))

async function closeAdd() {
  addOpen.value = false
  await nextTick()
  ;(addButton.value?.$el as HTMLElement | undefined)?.focus()
}

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
  <template v-if="addAnother">
    <PalettePicker :selected-color-id="selectedColorId" :editing="editing" @select="selectColor" />
    <div class="tool-color-controls__add">
      <AppButton
        ref="addButton"
        class="tool-color-controls__add-button"
        variant="in-box"
        size="sm"
        icon="plus"
        :expanded="addOpen"
        :disabled="editing"
        data-testid="add-color-button"
        @click="addOpen = !addOpen"
      >
        {{ t.palette.addAnotherColor }}
      </AppButton>
      <PickColorButton class="tool-color-controls__pick" :disabled="editing" />
    </div>
    <!-- In the shell with the other popovers, so nothing of the Palette popover's clips it (the pill's does the same). -->
    <Teleport v-if="addOpen" :to="shell.teleportTo" :disabled="addStacked || !shellFound">
      <AddColorPopover :anchor="paletteEl" @stacked="addStacked = $event" @close="closeAdd" @add-custom="emit('select-custom-color', $event)" />
    </Teleport>
  </template>
  <template v-else>
  <PalettePicker :selected-color-id="selectedColorId" :editing="editing" :wide="listShown" pick-tile no-labels @select="selectColor">
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
</template>

<style scoped>
.tool-color-controls__catalog {
  margin-top: var(--space-12);
}

/* Add another color fills the row; Pick color from canvas is a square of the same height beside it (PaletteSwatches card). */
.tool-color-controls__add {
  display: flex;
  gap: var(--space-6);
  align-items: stretch;
}

.tool-color-controls__add-button {
  flex: 1 1 auto;
  min-width: 0;
}

.tool-color-controls__add :deep(.tool-color-controls__pick),
.tool-color-controls__add :deep(.tool-color-controls__pick .icon-btn) {
  flex: none;
  width: var(--field-height);
  height: var(--field-height);
}
</style>
