<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { loadCatalogWhen, useBeadColorsList } from '../../composables/palette/useBeadColors'
import { useRovingFocus } from '../../composables/ui/useRovingFocus'
import { useMoveColor, useMoveSection, usePalette, usePaletteLetters, useRecentColors, useRemoveAddedColor, useRemoveSection } from '../../composables/tools/usePalette'
import { useSwatchDrag } from '../../composables/tools/useSwatchDrag'
import { CUSTOM_COLORS, PALETTE_SHORTCUTS, RECENT_SHORTCUTS, catalogName, isAddedColorId, type PaletteColor } from '../../domain/palette'
import { codeName, colorLabel } from '../../i18n/colorLabel'
import { useI18n } from '../../i18n/useI18n'
import AppNote from '../ui/AppNote.vue'
import AppSwatch from '../ui/AppSwatch.vue'
import IconButton from '../ui/IconButton.vue'
import PickColorButton from './PickColorButton.vue'
import SwatchLetterField from './SwatchLetterField.vue'
import { useClosePopoverOnPick } from '../shell/pickContext'
import { fillBlanks } from '../../domain/fillBlanks'

const props = defineProps<{
  selectedColorId?: string
  /** Edit palette (ticket 531): a press on a swatch asks to remove it, and a section can be moved or removed (ticket 1226). */
  editing?: boolean
  /** The wide colour popover (ticket 0746): swatches of the usual size fill the width. */
  wide?: boolean
  /** Pick color from canvas is the grid's last tile (ticket 403); the Palette popover holds it beside Add another color instead (ticket 1226). */
  pickTile?: boolean
  /** Each section's label line (ticket 1226); the Convert image picker's rows have no room for them. */
  noLabels?: boolean
}>()
const emit = defineEmits<{
  select: [colorId: string]
}>()
const { t } = useI18n()
const palette = usePalette()
const recents = useRecentColors()
/** Every swatch stays in its slot (ticket 0865): a color that is one of the pill's recent chips is ringed there, not
 * taken out, so the grid never shifts as colors are used. Shift+4…0 are the first slots. */
const colors = computed(() => palette.value.colors)
/** The sections as shown (ADR 0103, ticket 1226), each swatch with its slot across all of them, which Shift+4…0 count. */
const sections = computed(() => {
  let slot = 0
  return palette.value.sections.map((section) => ({
    id: section.id,
    name: section.id === CUSTOM_COLORS ? t.value.palette.customColors : catalogName(section.id),
    colors: section.colors.map((color) => ({ color, slot: slot++ })),
  }))
})
const sectionOfSlot = (slot: number | undefined) => (slot === undefined ? undefined : colors.value[slot] && (colors.value[slot]!.catalog ?? CUSTOM_COLORS))
const isRecent = (color: PaletteColor) => recents.value.includes(color.hex)
const closePanel = useClosePopoverOnPick()

// A swatch picked from the Bead's Color catalog is named from it (ticket 0760), so the catalog loads once one is held.
const beadColors = useBeadColorsList()
loadCatalogWhen(beadColors, () => colors.value.some((color) => !!color.code))
const labelOf = (color: PaletteColor) => colorLabel(t.value, color, beadColors?.catalog.value)
/** Whether a swatch of a catalog code is made from its family and Finish (ticket 0905); a plain color has no mark. */
function approximateOf(color: PaletteColor): boolean | undefined {
  if (!color.code) return undefined
  return beadColors?.swatches.value.find((swatch) => swatch.code === color.code)?.approximate
}

/** The swatches are one Tab stop, the selected swatch (or the first); the arrows move between them (ticket 159). */
const gridEl = ref<HTMLElement>()
const roving = useRovingFocus(gridEl, { selector: '.palette-picker__swatch' })
const removeAdded = useRemoveAddedColor()
const removeSection = useRemoveSection()
const moveSection = useMoveSection()

// Swatch letters (ticket 1092): on the swatches while the Palette's Letters is on; in Edit palette on a button under
// each swatch, a Tab stop of their own with the arrows moving between them.
const paletteLetters = usePaletteLetters()
const letterOf = (color: PaletteColor) => paletteLetters?.letters.value[color.hex]
const lettersShown = computed(() => !!paletteLetters?.shown.value && !props.editing)
const lettersEdited = computed(() => !!props.editing && !!paletteLetters)
const letterRoving = useRovingFocus(gridEl, { selector: '.swatch-letter__button', managesTabIndex: true })
/** What the last letter typed did to another color: it had the letter, and got this color's in trade. */
const swapNote = ref<string>()
watch(lettersEdited, () => (swapNote.value = undefined))
// The line is about the letters as they stand: any later change of them (an Undo, another letter) takes it away.
watch(() => paletteLetters?.letters.value, () => (swapNote.value = undefined), { flush: 'sync' })

function changeLetter(color: PaletteColor, letter: string) {
  const swap = paletteLetters?.setLetter(color.hex, letter)
  const other = swap && colors.value.find((held) => held.hex === swap.hex)
  if (!swap || !other) return
  swapNote.value = fillBlanks(t.value.palette.letterSwapped, { name: labelOf(color).text, letter, other: labelOf(other).text, otherLetter: swap.letter })
}

function onGridKeydown(event: KeyboardEvent) {
  roving.onKeydown(event)
  letterRoving.onKeydown(event)
}

function isStop(colorId: string, index: number): boolean {
  const selected = colors.value.some((color) => color.id === props.selectedColorId)
  return selected ? colorId === props.selectedColorId : index === 0
}

// A swatch asks to be removed (tickets 228, 304, 531, 1226; PaletteSwatches card): by a press in Edit palette, or
// Delete/Backspace on a focused one, a default one too. The app shell confirms first.
function remove(colorId: string) {
  removeAdded?.(colorId)
}

// Rearranging (ticket 398): drag a swatch to another slot of its section, or move it with Alt+Left/Right; a swatch never
// changes section (ticket 1226). The slots own Shift+4…0 in order, so the swatch landing in the first slot is Shift+4.
const moveColor = useMoveColor()
const drag = useSwatchDrag(
  (from, to) => moveColor?.(from, to),
  (x, y) => {
    const id = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-color-id]')?.dataset.colorId
    const slot = colors.value.findIndex((color) => color.id === id)
    return slot < 0 || sectionOfSlot(slot) !== sectionOfSlot(drag.draggingFrom.value) ? undefined : slot
  },
)

// A section dragged by its label line in Edit palette (ticket 1226), or moved with Alt+Up/Down on it.
const sectionDrag = useSwatchDrag(
  (from, to) => moveSection?.(sections.value[from]!.id, to - from),
  (x, y) => {
    const id = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-section-id]')?.dataset.sectionId
    const index = sections.value.findIndex((section) => section.id === id)
    return index < 0 ? undefined : index
  },
)

async function nudgeSection(index: number, by: number) {
  if (!moveSection || !sections.value[index + by]) return
  const id = sections.value[index]!.id
  moveSection(id, by)
  await nextTick()
  gridEl.value?.querySelector<HTMLElement>(`[data-section-id="${id}"] .palette-picker__handle`)?.focus()
}

function onHandleKeydown(event: KeyboardEvent, index: number) {
  if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return
  event.preventDefault()
  event.stopPropagation()
  void nudgeSection(index, event.key === 'ArrowUp' ? -1 : 1)
}

async function nudge(slot: number, by: number) {
  if (!moveColor || !colors.value[slot + by] || sectionOfSlot(slot + by) !== sectionOfSlot(slot)) return
  const colorId = colors.value[slot]!.id
  moveColor(slot, slot + by)
  await nextTick()
  gridEl.value?.querySelector<HTMLElement>(`[data-color-id="${colorId}"]`)?.focus()
}

/** Choosing a swatch is the end of the visit to the colour popover (or a sheet): it closes. In Edit palette a press
 * asks to remove the swatch (ticket 1226). */
function pick(colorId: string) {
  if (drag.consumeDrag()) return
  if (props.editing) {
    remove(colorId)
    return
  }
  emit('select', colorId)
  closePanel()
}

/** A swatch's name, with its letter while the swatches show them; in Edit palette it is the removal it would ask for. */
function swatchLabel(color: PaletteColor, slot: number): string {
  const suffix = approximateOf(color) ? t.value.palette.beadColors.approximateSuffix : ''
  if (props.editing && removeAdded) return fillBlanks(t.value.palette.removeSwatch, { hex: color.hex })
  const name = isAddedColorId(color.id) ? labelOf(color).text + suffix : `${t.value.palette.colorLabel} ${slot + 1}, ${labelOf(color).text}${suffix}`
  const letter = lettersShown.value ? letterOf(color) : undefined
  return letter ? fillBlanks(t.value.palette.swatchLetter, { name, letter }) : name
}

function onSwatchKeydown(event: KeyboardEvent, colorId: string, position: number) {
  if (event.altKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
    event.preventDefault()
    event.stopPropagation()
    void nudge(position, event.key === 'ArrowLeft' ? -1 : 1)
    return
  }
  if (!removeAdded || (event.key !== 'Delete' && event.key !== 'Backspace')) return
  event.preventDefault()
  event.stopPropagation()
  remove(colorId)
}
</script>

<template>
  <div
    ref="gridEl"
    class="palette-picker"
    :class="{ 'palette-picker--wide': wide, 'palette-picker--lettered': lettersEdited, 'palette-picker--plain': noLabels }"
    role="group"
    :aria-label="t.palette.pickerLabel"
    data-testid="palette-picker"
    @keydown="onGridKeydown"
    @focusin="letterRoving.onFocusin"
  >
    <section
      v-for="(section, sectionIndex) in sections"
      :key="section.id"
      class="palette-picker__section"
      :class="{
        'palette-picker__section--dragging': sectionDrag.draggingFrom.value === sectionIndex,
        'palette-picker__section--before': sectionDrag.draggingFrom.value !== undefined && sectionDrag.hoverSlot.value === sectionIndex && sectionDrag.draggingFrom.value > sectionIndex,
        'palette-picker__section--after': sectionDrag.draggingFrom.value !== undefined && sectionDrag.hoverSlot.value === sectionIndex && sectionDrag.draggingFrom.value < sectionIndex,
      }"
      data-testid="palette-section"
      :data-section-id="section.id"
    >
      <div v-if="!noLabels" class="palette-picker__label-line">
        <button
          v-if="editing && moveSection"
          type="button"
          class="palette-picker__label palette-picker__handle"
          :aria-label="fillBlanks(t.palette.moveSection, { section: section.name })"
          aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
          data-testid="palette-section-handle"
          @pointerdown="sectionDrag.onPointerDown($event, sectionIndex)"
          @keydown="onHandleKeydown($event, sectionIndex)"
        >
          {{ section.name }}
        </button>
        <span v-else class="palette-picker__label" data-testid="palette-section-name">{{ section.name }}</span>
        <IconButton
          v-if="editing && removeSection"
          class="palette-picker__remove-section"
          variant="plain"
          icon="delete"
          :icon-size="16"
          :label="fillBlanks(t.palette.removeSection, { section: section.name })"
          tooltip
          data-testid="palette-section-remove"
          @click="removeSection(section.id)"
        />
      </div>
      <div class="palette-picker__grid">
        <span v-for="{ color, slot } in section.colors" :key="color.id" class="palette-picker__cell">
          <AppSwatch
            :color="color.hex"
            :label="swatchLabel(color, slot)"
            :tooltip-name="color.code ? codeName(t, color, beadColors?.catalog.value) : undefined"
            :selected="color.id === selectedColorId"
            :approximate="approximateOf(color)"
            :recent="isRecent(color)"
            :hotkey="PALETTE_SHORTCUTS[RECENT_SHORTCUTS + slot] ? `Shift+${PALETTE_SHORTCUTS[RECENT_SHORTCUTS + slot]!.keyLabel}` : undefined"
            :letter="lettersShown ? letterOf(color) : undefined"
            :removable="editing && !!removeAdded"
            class="palette-picker__swatch"
            :class="{
              'palette-picker__swatch--dragging': drag.draggingFrom.value === slot,
              'palette-picker__swatch--target': drag.draggingFrom.value !== undefined && drag.hoverSlot.value === slot && drag.hoverSlot.value !== drag.draggingFrom.value,
            }"
            :aria-keyshortcuts="removeAdded ? 'Delete Backspace' : undefined"
            :tabindex="roving.tabIndexFor(isStop(color.id, slot))"
            data-testid="palette-swatch"
            :data-color-id="color.id"
            @select="pick(color.id)"
            @pointerdown="drag.onPointerDown($event, slot)"
            @keydown="onSwatchKeydown($event, color.id, slot)"
          />
          <SwatchLetterField v-if="lettersEdited && letterOf(color)" :letter="letterOf(color)!" :name="labelOf(color).text" @change="changeLetter(color, $event)" />
        </span>
        <template v-if="sectionIndex === sections.length - 1">
          <PickColorButton v-if="pickTile" class="palette-picker__pick" :disabled="editing" />
          <slot />
        </template>
      </div>
    </section>
    <AppNote v-if="swapNote" class="palette-picker__note" role="status" data-testid="palette-letter-swapped">{{ swapNote }}</AppNote>
  </div>
</template>

<style scoped>
/* The Palette's sections stand one over another, 12px apart (PaletteSwatches card, ticket 1226); each is a label line over
 * its swatch grid. */
.palette-picker {
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
}

.palette-picker__section {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  border-radius: var(--radius-sm);
}

/* A section held in Edit palette lifts; a line shows where it lands among the others. */
.palette-picker__section--dragging {
  box-shadow: var(--elevation-2);
  opacity: 0.8;
}

.palette-picker__section--before::before,
.palette-picker__section--after::after {
  position: absolute;
  right: 0;
  left: 0;
  height: var(--focus-width);
  content: '';
  background: var(--focus-ring);
}

.palette-picker__section--before::before {
  top: calc(var(--space-6) * -1 - var(--focus-width));
}

.palette-picker__section--after::after {
  bottom: calc(var(--space-6) * -1 - var(--focus-width));
}

.palette-picker__label-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  min-width: 0;
}

.palette-picker__label {
  min-width: 0;
  overflow: hidden;
  font: var(--type-meta-small);
  color: var(--muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* In Edit palette the whole line is the section's drag handle, and the button on it is the line. */
.palette-picker__handle {
  flex: 1 1 auto;
  padding: 0;
  text-align: left;
  background: none;
  border: 0;
  cursor: grab;
  touch-action: none;
}

.palette-picker__handle:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: var(--focus-offset);
}

.palette-picker__remove-section {
  flex: none;
}

/* The swatch grid (PaletteSwatches card): 8 columns, 6px apart, square swatches with an inset edge. */
.palette-picker__grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: var(--space-6);
}

/* A slot: its swatch and, in Edit palette, its letter button under it, two targets that never overlap (ticket 1092). */
.palette-picker__cell {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
}

/* Edit palette with letters: the rows stand further apart, so a letter button is not pressed for the swatch under it. */
.palette-picker--lettered .palette-picker__grid {
  align-items: start;
  row-gap: var(--space-10);
}

.palette-picker__note {
  grid-column: 1 / -1;
}

/* Without label lines the sections run on as one grid, as the Palette did before them. */
.palette-picker--plain {
  gap: var(--space-6);
}

/* The wide colour popover (PaletteSwatches card): as many swatches of the usual size as fit, in fewer rows. */
.palette-picker--wide .palette-picker__grid {
  grid-template-columns: repeat(auto-fill, minmax(var(--palette-swatch-min), 1fr));
}

/* A swatch being dragged to another slot (ticket 398), and the slot it would land in. */
.palette-picker :deep(.palette-picker__swatch--dragging) {
  opacity: 0.5;
}

.palette-picker :deep(.palette-picker__swatch--target) {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: var(--focus-offset);
}

/* Pick color from canvas is the grid's last tile (ticket 403): a swatch's size, with a bigger eyedropper. Not a
 * slot: it isn't dragged and has no Shift+key. */
.palette-picker :deep(.palette-picker__pick),
.palette-picker :deep(.palette-picker__pick .icon-btn) {
  width: 100%;
  min-width: var(--swatch-min, 0);
  aspect-ratio: 1;
  height: auto;
}

/* Touch (ticket 166): a real 36px minimum swatch instead of controls.css's invisible 44px hit area, which would
 * overlap at 6px apart. */
@media (pointer: coarse) {
  /* The 8-column grid would overflow a narrow column at a real 36px minimum, so columns give way to more rows. */
  .palette-picker__grid {
    grid-template-columns: repeat(auto-fill, minmax(var(--swatch-touch-min), 1fr));
    --swatch-min: var(--swatch-touch-min);
  }
}
</style>
