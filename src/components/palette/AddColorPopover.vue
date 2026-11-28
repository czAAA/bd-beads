<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import { useBeadColorsList } from '../../composables/palette/useBeadColors'
import { useColorNudge } from '../../composables/tools/usePalette'
import { useBesidePlacement } from '../../composables/ui/useBesidePlacement'
import { useOverlayLayer } from '../../composables/ui/useOverlayLayer'
import { catalogName, CUSTOM_COLORS } from '../../domain/palette'
import { offeredBeads } from '../../domain/beads'
import { fillBlanks } from '../../domain/fillBlanks'
import { useI18n } from '../../i18n/useI18n'
import BeadSection from '../project/BeadSection.vue'
import AppNote from '../ui/AppNote.vue'
import IconButton from '../ui/IconButton.vue'
import SegmentedControl from '../ui/form/SegmentedControl.vue'
import BasicColors from './BasicColors.vue'
import BeadColorList from './BeadColorList.vue'
import CustomColorPanel from './CustomColorPanel.vue'

// Add another color (ticket 1226; PaletteSwatches card, option B "Beside the Palette"): a popover to the left of the Palette's
// own, so each color added is seen landing in its section. Bead colors: the Bead chooser (Brand, Type, Size) over that
// Bead's codes; Custom color: the wheel and the basic colors. It stays open for the next color. Escape or Close shuts it alone.
const props = defineProps<{
  /** The Palette popover it opens beside. */
  anchor: Element | null
}>()
const emit = defineEmits<{
  close: []
  /** A color from the wheel: it joins Custom colors. */
  'add-custom': [hex: string]
  /** Whether there is no room beside the Palette, so it stands in the Palette popover's flow. */
  stacked: [stacked: boolean]
}>()

const { t } = useI18n()
const beadColors = useBeadColorsList()
const { nudge, clear } = useColorNudge()
const rootEl = ref<HTMLElement>()
const tab = ref<'bead' | 'custom'>('bead')
const tabsId = useId()
const customPanel = ref<InstanceType<typeof CustomColorPanel>>()
/** Opening the Custom color tab puts the keyboard on its wheel. */
watch(tab, async (now) => {
  if (now !== 'custom') return
  await nextTick()
  customPanel.value?.focus()
})

/** Starts on the Palette's own Bead, each time it opens; its codes are fetched as the Bead changes. */
beadColors?.resetChooser?.()
watch(() => beadColors?.chooser?.bead.value?.id, () => void beadColors?.chooser?.load(), { immediate: true })
onBeforeUnmount(() => {
  clear()
  beadColors?.resetChooser?.()
})

const chooser = computed(() => beadColors?.chooser)
const chooserBead = computed(() => chooser.value?.bead.value)

/** What a hex clash says: the section and code the color is a shade apart from, once, until the next add. */
const nudgeText = computed(() => {
  const clash = nudge.value
  if (!clash) return undefined
  const words = t.value.palette
  return clash.code && clash.section !== CUSTOM_COLORS ? fillBlanks(words.nudgeCoded, { section: catalogName(clash.section), code: clash.code }) : words.nudgeCustom
})

const tabs = computed(() => [
  { value: 'bead' as const, label: t.value.palette.addTabBead },
  { value: 'custom' as const, label: t.value.palette.addTabCustom },
])

const { style, stacked } = useBesidePlacement(rootEl, () => props.anchor)
watch(stacked, (now) => emit('stacked', now), { immediate: true })
useOverlayLayer({
  isOpen: () => true,
  root: () => rootEl.value,
  close: () => emit('close'),
  isOpener: (target) => target.closest('[data-testid="add-color-button"]') !== null,
  // The Palette popover it belongs to is no outside: a press there (a swatch's Tooltip, the pencil) goes on and it stays.
  keepsPress: (event) => event.target instanceof Element && event.target.closest('[data-beside-anchor]') !== null,
})
</script>

<template>
  <div ref="rootEl" class="add-color" :class="{ 'add-color--stacked': stacked }" :style="style" role="dialog" :aria-label="t.palette.addAnotherColor" data-testid="add-color-popover">
    <div class="add-color__head">
      <span :id="tabsId" hidden>{{ t.palette.addAnotherColor }}</span>
      <SegmentedControl v-model="tab" class="add-color__tabs" :options="tabs" :labelledby="tabsId" data-testid="add-color-tabs" />
      <IconButton v-if="!stacked" class="add-color__close" variant="plain" icon="close" :label="t.toolPill.close" :icon-size="16" tooltip data-testid="add-color-close" @click="emit('close')" />
    </div>
    <AppNote v-if="nudgeText" role="status" data-testid="add-color-nudge">{{ nudgeText }}</AppNote>
    <div class="add-color__panels">
      <!-- The tab not shown is only unseen: both hold the popover's height, so the tabs stay where pressed. -->
      <div v-if="chooser" class="add-color__panel" :class="{ 'add-color__panel--unseen': tab !== 'bead' }" :inert="tab !== 'bead' || undefined" data-testid="add-color-panel-bead">
        <BeadSection :bead="chooserBead" :candidates="offeredBeads()" @pick="beadColors?.chooseBead?.($event)" />
        <BeadColorList :key="chooserBead?.id" :colors="chooser" />
      </div>
      <div class="add-color__panel add-color__panel--custom" :class="{ 'add-color__panel--unseen': tab !== 'custom' }" :inert="tab !== 'custom' || undefined" data-testid="add-color-panel-custom">
        <CustomColorPanel ref="customPanel" addable inline @add="emit('add-custom', $event)" />
        <BasicColors @add="emit('add-custom', $event)" />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* The popover look of the Palette's (ToolPill card): overlay fill and line, `radius-xl`, elevation 3; 35.5rem wide, never
 * wider than the screen. */
.add-color {
  position: fixed;
  z-index: var(--z-popover);
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
  box-sizing: border-box;
  width: min(var(--add-color-popover-width), calc(100vw - 2 * var(--float-edge)));
  max-height: calc(100dvh - 2 * var(--float-edge));
  padding: var(--space-12) var(--space-14) var(--space-14);
  overflow-y: auto;
  overscroll-behavior: none;
  background: var(--overlay-fill);
  border: 1px solid var(--overlay-line);
  border-radius: var(--radius-xl);
  box-shadow: var(--elevation-3);
}

.add-color__head {
  display: flex;
  align-items: center;
  gap: var(--space-8);
}

.add-color__tabs {
  flex: 1 1 auto;
  min-width: 0;
}

.add-color__close {
  flex: none;
}

/* Both tabs share one cell, so it is as tall as the taller. */
.add-color__panels {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
}

.add-color__panel {
  grid-area: 1 / 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
}

.add-color__panel--unseen {
  visibility: hidden;
}

.add-color__panel--custom {
  align-items: center;
}

.add-color__panel--custom > :deep(.custom-color-panel) {
  align-self: stretch;
}

/* Stacked, it grows down from under its button, so no height is held. */
.add-color--stacked .add-color__panel--unseen {
  display: none;
}

/* Where there is no room beside the Palette, it opens under the Add another color button as part of the Palette popover. */
.add-color--stacked {
  position: static;
  width: auto;
  max-width: none;
  max-height: none;
  padding: 0;
  overflow: visible;
  background: none;
  border: 0;
  box-shadow: none;
}

/* Stacked, the rows take the room of the popover's padding too: its text is no narrower than it was in its own list. */
.add-color--stacked :deep(.bead-color-list) {
  margin-inline: calc(var(--space-10) * -1);
}

/* The list sits under the chooser with the chooser's own gap, not its stand-alone margin. */
.add-color :deep(.bead-color-list) {
  margin-top: 0;
}
</style>
