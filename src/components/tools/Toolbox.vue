<script setup lang="ts">
import { computed, ref } from 'vue'
import AppIcon from '../ui/AppIcon.vue'
import AppLink from '../ui/AppLink.vue'
import CustomColorPicker from '../palette/CustomColorPicker.vue'
import DisclosureRow from '../ui/DisclosureRow.vue'
import IconButton from '../ui/IconButton.vue'
import type { IconName } from '../ui/icons'
import ImageColorsButton from '../palette/ImageColorsButton.vue'
import PalettePicker from '../palette/PalettePicker.vue'
import FrameControls from '../pattern/FrameControls.vue'
import ToolGroup from './ToolGroup.vue'
import { useI18n } from '../../i18n/useI18n'
import { useRovingFocus } from '../../composables/ui/useRovingFocus'
import type { Tool } from '../../domain/tool'
import { resolvePatternBead, type Pattern } from '../../domain/pattern'
import { estimatedSizeMm, formatSizeMm } from '../../domain/patternSize'

const props = defineProps<{
  pattern: Pattern
  activeTool: Tool
  selectedColorId?: string
  /** The last Custom color chosen (CONTEXT.md), kept on its slot even once a Palette swatch deselects it. */
  customColor?: string
  /** The Image color being painted with right now (ticket 58), if that is what the paint color currently is. */
  selectedImageColor?: string
  canUndo: boolean
  canRedo: boolean
  canCopy: boolean
  /** Whether "remove selected row/column" (ticket 123) would apply right now: the Selection is exactly one whole row or column, and Row progress isn't locking it. */
  canRemoveSelectedLine: boolean
}>()

const emit = defineEmits<{
  'select-tool': [tool: Tool]
  'select-color': [colorId: string]
  'select-custom-color': [hex: string]
  'select-image-color': [hex: string]
  undo: []
  redo: []
  rotate: []
  copy: []
  'delete-all': []
  /** "Remove selected row/column" (ticket 123): the Selection names which one, so it takes no payload of its own. */
  'remove-selected-line': []
  /** The Frame row opened with no Frame: start Set Frame. */
  'start-frame': []
  'set-frame-size': [columns: number, rows: number]
  'fit-frame': []
  'remove-frame': []
  /** The Frame number was pressed: bring the Frame into view. */
  'bring-frame': []
}>()

const { t, locale } = useI18n()

/** Custom color is the active paint color exactly when neither a Palette swatch nor an Image color is (App.vue keeps the three mutually exclusive). */
const customColorSelected = computed(
  () => !props.selectedColorId && !props.selectedImageColor && !!props.customColor,
)

/** The Tools group's five tabs (ToolTabs card), with the hotkeys shown in their tooltips. */
const tools = computed<{ id: Tool; icon: IconName; label: string; hotkey?: string }[]>(() => [
  { id: 'paint', icon: 'paint', label: t.value.tools.paintLabel, hotkey: '1' },
  { id: 'fill', icon: 'fill', label: t.value.tools.fillLabel, hotkey: '2' },
  { id: 'select', icon: 'select', label: t.value.tools.selectLabel, hotkey: '3' },
  { id: 'erase', icon: 'erase', label: t.value.tools.eraseLabel },
  { id: 'hand', icon: 'hand', label: t.value.tools.handLabel, hotkey: 'H' },
])

/** The tool tabs are one Tab stop, the active tab; the arrows move between them (ticket 159). */
const tabsEl = ref<HTMLElement>()
const tabsRoving = useRovingFocus(tabsEl)

/** Refs to the always-open Tool groups, so Escape can ask each one to collapse (ticket 41). */
const toolsGroupRef = ref<InstanceType<typeof ToolGroup> | null>(null)
const colorsGroupRef = ref<InstanceType<typeof ToolGroup> | null>(null)
const editGroupRef = ref<InstanceType<typeof ToolGroup> | null>(null)

/** Which disclosure row is open (DisclosureRow card): closed until pressed. */
const frameOpen = ref(false)

/** Opening the Frame row with no Frame starts Set Frame as well (Frame card); the row still opens, to say what a Frame is. */
function onFrameOpenChange(open: boolean) {
  frameOpen.value = open
  if (open && !props.pattern.frame) emit('start-frame')
}

/**
 * What Escape closes in the Toolbox before anything else (tickets 41, 75): an open disclosure row first, then a
 * hover-expanded group. Returns whether it closed something, so App.vue's onKeyDown knows whether this Escape press was
 * used up or should fall through to its usual Select precedence.
 */
function collapseExpandedGroup(): boolean {
  if (frameOpen.value) {
    frameOpen.value = false
    return true
  }
  const groups = [toolsGroupRef, colorsGroupRef, editGroupRef]
  const collapsed = groups.map((group) => group.value?.collapse() ?? false)
  return collapsed.some(Boolean)
}

defineExpose({ collapseExpandedGroup })

/** Rotate turns the Frame, so it needs one, and waits while Row progress holds the Frame's rows still (Toolbox card). */
const rotateAvailable = computed(() => props.pattern.frame !== undefined && !props.pattern.rowProgress.enabled)
const rotateName = computed(() => (props.pattern.frame ? t.value.palette.rotateButton : t.value.frame.rotateNeedsFrame))
const rotateTitle = computed(() => (props.pattern.frame && props.pattern.rowProgress.enabled ? t.value.size.lockedReason : rotateName.value))

/** The Frame row's value: "not set", or the Frame's measured size (its number is the chip before it). */
const frameSummary = computed(() => {
  const frame = props.pattern.frame
  if (!frame) return t.value.frame.notSet
  const bead = resolvePatternBead(props.pattern)
  if (!bead) return undefined
  return formatSizeMm(
    estimatedSizeMm(frame, bead),
    { mm: t.value.form.unitMm, cm: t.value.form.unitCm },
    locale.value,
  )
})
</script>

<template>
  <!--
    The Toolbox (ticket 75; Toolbox card): the left column's first box. Tools as tabs, Colors and Edit are always open;
    Size is a disclosure row that opens in place (ticket 174 hid Mirror's pending its own redesign, keeping the domain
    logic behind it, ADR 0006, in the codebase). Every control keeps its hotkey in its tooltip.
  -->
  <div class="toolbox" data-testid="toolbox">
    <ToolGroup ref="toolsGroupRef" :title="t.toolbox.groups.tools" data-testid="tool-group-tools">
      <div ref="tabsEl" class="tool-tabs" @keydown="tabsRoving.onKeydown">
        <button
          v-for="tool in tools"
          :key="tool.id"
          type="button"
          class="ui-control tool-tab"
          :class="{ 'tool-tab--active': activeTool === tool.id }"
          :data-testid="`tool-${tool.id}`"
          :data-tour="`tool-${tool.id}`"
          :title="tool.hotkey ? `${tool.label} (${tool.hotkey})` : tool.label"
          :aria-pressed="activeTool === tool.id"
          :tabindex="tabsRoving.tabIndexFor(activeTool === tool.id)"
          @click="emit('select-tool', tool.id)"
        >
          <AppIcon :name="tool.icon" :size="18" />
          <span class="tool-tab__label">{{ tool.label }}</span>
        </button>
      </div>
      <div class="toolbox__links">
        <AppLink
          icon="remove-line"
          data-testid="tool-remove-line"
          data-tour="remove-line"
          :title="t.tools.removeLineButton"
          :aria-label="t.tools.removeLineName"
          :disabled="!canRemoveSelectedLine"
          @click="emit('remove-selected-line')"
        >
          {{ t.tools.removeLineShort }}
        </AppLink>
        <AppLink icon="delete" danger data-testid="delete-all-button" :title="t.deleteAll.confirmButton" :aria-label="t.deleteAll.confirmButton" @click="emit('delete-all')">
          {{ t.deleteAll.button }}
        </AppLink>
      </div>
    </ToolGroup>

    <ToolGroup ref="colorsGroupRef" :title="t.toolbox.groups.colors" data-testid="tool-group-colors">
      <PalettePicker :selected-color-id="selectedColorId" @select="(colorId) => emit('select-color', colorId)" />
      <div class="toolbox__color-buttons">
        <CustomColorPicker
          :color="customColor"
          :selected="customColorSelected"
          @select="(hex) => emit('select-custom-color', hex)"
        />
        <!--
          The open Pattern's Image colors (ADR 0011), alongside the Palette rather than instead of it: a converted
          Pattern is touched up with its own colors from this button's popover; any other Pattern has none, and the
          button says why.
        -->
        <ImageColorsButton
          :colors="pattern.imageColors"
          :selected-color="selectedImageColor"
          @select="(hex) => emit('select-image-color', hex)"
        />
      </div>
    </ToolGroup>

    <ToolGroup ref="editGroupRef" :title="t.toolbox.groups.edit" data-testid="tool-group-edit">
      <div class="toolbox__edit">
        <IconButton icon="undo" variant="toolbox" size="lg" :icon-size="17" :label="t.palette.undoButton" data-testid="undo-button" data-tour="undo" :disabled="!canUndo" @click="emit('undo')" />
        <IconButton icon="redo" variant="toolbox" size="lg" :icon-size="17" :label="t.palette.redoButton" data-testid="redo-button" :disabled="!canRedo" @click="emit('redo')" />
        <IconButton
          icon="rotate"
          variant="toolbox"
          size="lg"
          :icon-size="17"
          :label="rotateName"
          :title="rotateTitle"
          :disabled="!rotateAvailable"
          data-testid="rotate-button"
          @click="emit('rotate')"
        />
        <IconButton
          icon="copy"
          variant="toolbox"
          size="lg"
          :icon-size="17"
          :label="t.tools.copyButton"
          :title="`${t.tools.copyButton} (Ctrl/Cmd+C)`"
          data-testid="copy-button"
          data-tour="copy"
          :disabled="!canCopy"
          @click="emit('copy')"
        />
      </div>
    </ToolGroup>

    <div class="toolbox__rows">
      <!-- The Frame (CONTEXT.md, ADR 0026): which beads are the Pattern, and what it measures. -->
      <DisclosureRow
        :open="frameOpen"
        icon="frame"
        :label="t.frame.title"
        :summary="frameSummary"
        :chip="pattern.frame ? '1' : undefined"
        :chip-label="t.frame.numberLabel.replace('{number}', '1')"
        data-testid="tool-group-frame"
        data-tour="frame-row"
        @update:open="onFrameOpenChange"
        @chip="emit('bring-frame')"
      >
        <FrameControls
          :pattern="pattern"
          @set-size="(columns, rows) => emit('set-frame-size', columns, rows)"
          @fit="emit('fit-frame')"
          @remove="emit('remove-frame')"
        />
      </DisclosureRow>
    </div>
  </div>
</template>

<style scoped>
/* The Toolbox box (Toolbox card): `panel`, a `panel-line` hairline, radius 12, padding 24, groups 20px apart. */
.toolbox {
  display: flex;
  flex-direction: column;
  gap: var(--space-20);
  box-sizing: border-box;
  padding: var(--space-24);
  color: var(--ink);
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: var(--radius-lg);
}

/* Tool tabs (ToolTabs card): four equal columns over a `line-strong` rule. */
.tool-tabs {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  border-bottom: 1px solid var(--line-strong);
}

.tool-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  margin-bottom: -1px;
  padding: var(--space-8) 0 var(--space-10);
  color: var(--muted);
  background: none;
  border: 0;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition:
    color var(--duration-fast) var(--ease-standard),
    transform var(--duration-instant) var(--ease-standard);
}

.tool-tab__label {
  font: var(--type-tab);
}

.tool-tab--active {
  color: var(--accent-strong);
  border-bottom-color: var(--accent-strong);
}

@media (hover: hover) {
  .tool-tab:not(.tool-tab--active):hover {
    color: var(--ink);
  }
}

.tool-tab:active {
  transform: scale(0.96);
}

.tool-tab:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: 2px;
}

:root[data-theme='contrast'] .tool-tab--active {
  font-weight: 700;
  border-bottom-width: 3px;
}

/*
 * Touch input (ticket 166): a tab grows to a real 48px minimum instead of controls.css's usual invisible 44px hit
 * area, one of the two documented exceptions alongside palette swatches.
 */
@media (pointer: coarse) {
  .tool-tab {
    box-sizing: border-box;
    min-height: 3rem;
    justify-content: center;
  }

  .tool-tab::before {
    content: none;
  }
}

.toolbox__links {
  display: flex;
  justify-content: space-between;
  margin-top: var(--space-10);
}

.toolbox__color-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-8);
  margin-top: var(--space-12);
}

/* The Edit row (Toolbox card): four equal 38px icon buttons, 6px apart. */
.toolbox__edit {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-6);
}

.toolbox__edit :deep(.app-tooltip),
.toolbox__edit :deep(.icon-btn) {
  display: flex;
  width: 100%;
}

/* Size as a disclosure row, with a rule above it. */
.toolbox__rows {
  border-top: 1px solid var(--panel-rule);
}

@media (prefers-reduced-motion: reduce) {
  .tool-tab:active {
    transform: none;
  }
}
</style>
