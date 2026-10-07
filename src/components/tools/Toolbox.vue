<script setup lang="ts">
import { computed, ref } from 'vue'
import AppLink from '../ui/AppLink.vue'
import CustomColorPicker from '../palette/CustomColorPicker.vue'
import DisclosureRow from '../ui/DisclosureRow.vue'
import IconButton from '../ui/IconButton.vue'
import type { IconName } from '../ui/icons'
import ImageColorsButton from '../palette/ImageColorsButton.vue'
import PalettePicker from '../palette/PalettePicker.vue'
import FrameControls from '../project/FrameControls.vue'
import ToolButton from './ToolButton.vue'
import ToolGroup from './ToolGroup.vue'
import { FRAME_HOTKEY, TOOL_HOTKEYS } from './toolIcons'
import { useI18n } from '../../i18n/useI18n'
import { useRovingFocus } from '../../composables/ui/useRovingFocus'
import type { Tool } from '../../domain/tool'
import type { InputMode } from '../../domain/inputMode'
import { resolveProjectBead, type Project } from '../../domain/project'
import { estimatedSizeMm, formatSizeMm } from '../../domain/projectSize'

const props = defineProps<{
  project: Project
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
  /** Whether the Frame is being set: the Frame tool shows as the active tool. */
  settingFrame?: boolean
  /** Pen mode or Mouse mode (ticket 325), shown after the Frame tool when the device can use it. */
  inputMode?: InputMode
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
  'toggle-input-mode': []
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

/** The Tools group's six icon tiles (ToolTabs card), with the hotkeys shown as badges and in their hints. */
const tools = computed<{ id: Tool; icon: IconName; label: string; hotkey?: string; description?: string }[]>(() => [
  { id: 'paint', icon: 'paint', label: t.value.tools.paintLabel, hotkey: TOOL_HOTKEYS.paint, description: t.value.tools.paintHint },
  { id: 'fill', icon: 'fill', label: t.value.tools.fillLabel, hotkey: TOOL_HOTKEYS.fill, description: t.value.tools.fillHint },
  { id: 'select', icon: 'select', label: t.value.tools.selectLabel, hotkey: TOOL_HOTKEYS.select, description: t.value.tools.selectHint },
  { id: 'erase', icon: 'erase', label: t.value.tools.eraseLabel, hotkey: TOOL_HOTKEYS.erase },
  { id: 'hand', icon: 'hand', label: t.value.tools.handLabel, hotkey: TOOL_HOTKEYS.hand, description: t.value.tools.handHint },
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
  if (open && !props.project.frame) emit('start-frame')
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
const rotateAvailable = computed(() => props.project.frame !== undefined && !props.project.rowProgress.enabled)
const rotateName = computed(() => {
  if (!props.project.frame) return t.value.frame.rotateNeedsFrame
  return props.project.rowProgress.enabled ? t.value.size.lockedReason : t.value.palette.rotateButton
})

/** The Frame row's value: "not set", or the Frame's measured size (its number is the chip before it). */
const frameSummary = computed(() => {
  const frame = props.project.frame
  if (!frame) return t.value.frame.notSet
  const bead = resolveProjectBead(props.project)
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
      <div ref="tabsEl" class="tool-buttons" @keydown="tabsRoving.onKeydown">
        <ToolButton
          v-for="tool in tools"
          :key="tool.id"
          :icon="tool.icon"
          :label="tool.label"
          :hotkey="tool.hotkey"
          :description="tool.description"
          :active="activeTool === tool.id && !settingFrame"
          :data-testid="`tool-${tool.id}`"
          :data-tour="`tool-${tool.id}`"
          :tabindex="tabsRoving.tabIndexFor(activeTool === tool.id && !settingFrame)"
          @click="emit('select-tool', tool.id)"
        />
        <!-- The Frame tool (ticket 258): Set Frame is a mode, not a Tool, so it lights up from `settingFrame`; choosing any tool ends it. -->
        <ToolButton
          icon="frame"
          :label="t.frame.setFrame"
          :hotkey="FRAME_HOTKEY"
          :description="t.frame.setFrameHint"
          :active="!!settingFrame"
          data-testid="tool-frame"
          :tabindex="tabsRoving.tabIndexFor(!!settingFrame)"
          @click="emit('start-frame')"
        />
        <!-- The input mode toggle (ticket 325): its face is the current mode, in the accent colour; it sits right after the Frame tool. -->
        <ToolButton
          v-if="inputMode"
          :icon="inputMode === 'pen' ? 'pen-mode' : 'pen-mode-off'"
          :label="inputMode === 'pen' ? t.inputMode.penLabel : t.inputMode.mouseLabel"
          :description="inputMode === 'pen' ? t.inputMode.penHint : t.inputMode.mouseHint"
          :active="false"
          :pressed="inputMode === 'pen'"
          data-testid="input-mode-toggle"
          :tabindex="-1"
          @click="emit('toggle-input-mode')"
        />
      </div>
      <div class="toolbox__links toolbox__links--frame">
        <AppLink
          icon="close"
          data-testid="tool-remove-frame"
          :disabled="!project.frame || project.rowProgress.enabled"
          :title="project.rowProgress.enabled ? t.size.lockedReason : undefined"
          @click="emit('remove-frame')"
        >
          {{ t.frame.removeFrame }}
        </AppLink>
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
          The open Project's Image colors (ADR 0011), alongside the Palette rather than instead of it: a converted
          Project is touched up with its own colors from this button's popover; any other Project has none, and the
          button says why.
        -->
        <ImageColorsButton
          :colors="project.imageColors"
          :selected-color="selectedImageColor"
          @select="(hex) => emit('select-image-color', hex)"
        />
      </div>
    </ToolGroup>

    <ToolGroup ref="editGroupRef" :title="t.toolbox.groups.edit" data-testid="tool-group-edit">
      <div class="toolbox__edit">
        <IconButton icon="undo" variant="toolbox" size="lg" :icon-size="17" shortcut="Ctrl/Cmd+Z" :label="t.palette.undoButton" data-testid="undo-button" data-tour="undo" :disabled="!canUndo" @click="emit('undo')" />
        <IconButton icon="redo" variant="toolbox" size="lg" :icon-size="17" shortcut="Ctrl/Cmd+Shift+Z" :label="t.palette.redoButton" data-testid="redo-button" :disabled="!canRedo" @click="emit('redo')" />
        <IconButton
          icon="rotate"
          variant="toolbox"
          size="lg"
          :icon-size="17"
          :label="rotateName"
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
          shortcut="Ctrl/Cmd+C"
          data-testid="copy-button"
          data-tour="copy"
          :disabled="!canCopy"
          @click="emit('copy')"
        />
      </div>
    </ToolGroup>

    <div class="toolbox__rows">
      <!-- The Frame (CONTEXT.md, ADR 0026): which beads are the Project, and what it measures. -->
      <DisclosureRow
        :open="frameOpen"
        icon="frame"
        :label="t.frame.title"
        :summary="frameSummary"
        :chip="project.frame ? '1' : undefined"
        :chip-label="t.frame.numberLabel.replace('{number}', '1')"
        data-testid="tool-group-frame"
        data-tour="frame-row"
        @update:open="onFrameOpenChange"
        @chip="emit('bring-frame')"
      >
        <FrameControls
          :project="project"
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

/* Tool tabs (ToolTabs card): 56x72 tabs, five to a row (Frame wraps), a full-width 1px `line-strong` rule under each row. */
.tool-buttons {
  display: grid;
  grid-template-columns: repeat(5, 56px);
  grid-auto-rows: 72px;
  background-image: repeating-linear-gradient(to bottom, transparent 0 71px, var(--line-strong) 71px 72px);
}

.toolbox__links {
  display: flex;
  justify-content: space-between;
  margin-top: var(--space-10);
}

/* Remove Frame sits 12px below the tiles (ToolTabs card). */
.toolbox__links--frame {
  margin-top: var(--space-12);
}

/* Side by side while both labels fit whole, one above the other when they don't (ticket 246). */
.toolbox__color-buttons {
  display: flex;
  flex-wrap: wrap;
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
</style>
