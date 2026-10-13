<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import AppButton from '../ui/AppButton.vue'
import DisclosureRow from '../ui/DisclosureRow.vue'
import EditControls, { type EditControlId } from './EditControls.vue'
import IconButton from '../ui/IconButton.vue'
import MirrorControls from './MirrorControls.vue'
import ToolColorControls from './ToolColorControls.vue'
import ToolTiles from './ToolTiles.vue'
import FrameControls from '../project/FrameControls.vue'
import ToolGroup from './ToolGroup.vue'
import { FRAME_HOTKEY } from './toolIcons'
import { controlAction, controlDeps } from '../../composables/shell/controlRegistry'
import { MIRROR_ENABLED } from '../../features'
import { useI18n } from '../../i18n/useI18n'
import { useRovingFocus } from '../../composables/ui/useRovingFocus'
import type { Frame } from '../../domain/canvas'
import type { Technique } from '../../domain/grid'
import type { Tool } from '../../domain/tool'
import type { InputMode } from '../../domain/inputMode'
import { rotationSwapsAxes } from '../../domain/grid'
import { gridAxisOfDirection, NO_MIRROR_AXES, type MirrorAxisCounts } from '../../domain/mirror'
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
  /** The size the Frame row's steppers have set and nothing has committed yet (ticket 410). */
  pendingFrame?: Frame
  /** Pen mode or Mouse mode (ticket 325), shown after the Frame tool when the device can use it. */
  inputMode?: InputMode
  /** Mirror's axis counts and copy mode (ADR 0006), read only while MIRROR_ENABLED. */
  mirrorAxisCounts?: MirrorAxisCounts
  mirrorCopyMode?: boolean
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
  'set-technique': [technique: Technique]
  'fit-frame': []
  'remove-frame': []
  /** The Frame row closed, or another row opened: whatever size its steppers left pending is committed (ticket 410). */
  'close-frame': []
  /** The Frame number was pressed: bring the Frame into view. */
  'bring-frame': []
  /** Mirror (ADR 0006), from the Mirror row: the axis counts, copy mode and the one-time "Mirror current". */
  'set-mirror-axis-count': [axis: 'columns' | 'rows', count: number]
  'toggle-mirror-copy-mode': []
  'mirror-current': [axis: 'horizontal' | 'vertical']
  'mirror-current-hover': [axis: 'horizontal' | 'vertical' | null]
}>()

const { t, locale } = useI18n()

/** An Edit button's press is the event of the same name (EditControls card). */
function onEdit(id: EditControlId) {
  if (id === 'undo') emit('undo')
  else if (id === 'redo') emit('redo')
  else if (id === 'rotate') emit('rotate')
  else if (id === 'copy') emit('copy')
}
const setFrameAction = controlAction('set-frame')
/** The input mode toggle's face is the current mode. */
const inputModeAction = computed(() => (props.inputMode ? controlAction(props.inputMode === 'pen' ? 'pen-mode' : 'mouse-mode') : undefined))

const toolActions = {
  removeFrame: controlAction('remove-frame'),
  removeLine: controlAction('remove-line'),
  clear: controlAction('clear'),
}

/** What the actions' enabled states and disabled reasons read (ADR 0035). */
const deps = computed(() =>
  controlDeps({
    activeProject: () => props.project,
    canUndo: () => props.canUndo,
    canRedo: () => props.canRedo,
    hasSelection: () => props.canCopy,
    canRemoveSelectedLine: () => props.canRemoveSelectedLine,
  }),
)

/** The tool tabs are one Tab stop, the active tab; the arrows move between them (ticket 159). */
const tabsEl = ref<HTMLElement>()
const tabsRoving = useRovingFocus(tabsEl)

/** Refs to the always-open Tool groups, so Escape can ask each one to collapse (ticket 41). */
const toolsGroupRef = ref<InstanceType<typeof ToolGroup> | null>(null)
const colorsGroupRef = ref<InstanceType<typeof ToolGroup> | null>(null)
const editGroupRef = ref<InstanceType<typeof ToolGroup> | null>(null)

/** Which disclosure row is open (DisclosureRow card): closed until pressed. */
const frameOpen = ref(false)
/** Whether the Mirror row is open. */
const mirrorOpen = ref(false)

// The Frame's size is applied when its row closes, or another opens, or the Toolbox goes away (ticket 410).
watch(frameOpen, (open) => {
  if (!open) emit('close-frame')
})
watch(mirrorOpen, (open) => {
  if (open) emit('close-frame')
})
onBeforeUnmount(() => {
  if (frameOpen.value) emit('close-frame')
})

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
  if (mirrorOpen.value || frameOpen.value) {
    mirrorOpen.value = false
    frameOpen.value = false
    return true
  }
  const groups = [toolsGroupRef, colorsGroupRef, editGroupRef]
  const collapsed = groups.map((group) => group.value?.collapse() ?? false)
  return collapsed.some(Boolean)
}

defineExpose({ collapseExpandedGroup })

/** The Mirror row's value ("↔ 1 · ↕ 0"): the counts as seen on screen, so a turned Project swaps them. */
const mirrorSummary = computed(() => {
  const counts = props.mirrorAxisCounts ?? NO_MIRROR_AXES
  const swapped = rotationSwapsAxes(props.project.rotation)
  return `↔ ${counts[gridAxisOfDirection('leftRight', swapped)]} · ↕ ${counts[gridAxisOfDirection('topBottom', swapped)]}`
})

/** The Frame row's value: "not set", or the Frame's measured size (its number is the chip before it). */
const frameSummary = computed(() => {
  const frame = props.pendingFrame ?? props.project.frame
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
        <ToolTiles
          :active-tool="activeTool"
          :setting-frame="!!settingFrame"
          testid-prefix="tool"
          :tab-index-for="tabsRoving.tabIndexFor"
          @select="(tool) => emit('select-tool', tool)"
        />
        <!-- The Frame tool (ticket 258): Set Frame is a mode, not a Tool, so it lights up from `settingFrame`; choosing any tool ends it. -->
        <IconButton
          variant="tool"
          :action="setFrameAction"
          :hotkey="FRAME_HOTKEY"
          show-hotkey
          :selected="!!settingFrame"
          data-testid="tool-frame"
          :tabindex="tabsRoving.tabIndexFor(!!settingFrame)"
          @click="emit('start-frame')"
        />
        <!-- The input mode toggle (ticket 325): its face is the current mode, in the accent colour; it sits right after the Frame tool. -->
        <IconButton
          v-if="inputModeAction"
          variant="tool"
          :action="inputModeAction"
          accent
          :pressed="inputMode === 'pen'"
          data-testid="input-mode-toggle"
          :tabindex="-1"
          @click="emit('toggle-input-mode')"
        />
      </div>
      <div class="toolbox__links toolbox__links--frame">
        <AppButton variant="link" :action="toolActions.removeFrame" :deps="deps" data-testid="tool-remove-frame" @click="emit('remove-frame')" />
      </div>
      <div class="toolbox__links">
        <AppButton variant="link" :action="toolActions.removeLine" :deps="deps" data-testid="tool-remove-line" data-tour="remove-line" @click="emit('remove-selected-line')">
          {{ t.tools.removeLineShort }}
        </AppButton>
        <AppButton variant="link" danger :action="toolActions.clear" :deps="deps" data-testid="delete-all-button" @click="emit('delete-all')">
          {{ t.deleteAll.button }}
        </AppButton>
      </div>
    </ToolGroup>

    <ToolGroup ref="colorsGroupRef" :title="t.toolbox.groups.colors" data-testid="tool-group-colors">
      <!-- The open Project's Image colors (ADR 0011), alongside the Palette rather than instead of it: a converted Project is touched up with its own colors from this button's popover; any other Project has none, and the button says why. -->
      <ToolColorControls
        :selected-color-id="selectedColorId"
        :custom-color="customColor"
        :selected-image-color="selectedImageColor"
        :image-colors="project.imageColors"
        @select-color="(colorId) => emit('select-color', colorId)"
        @select-custom-color="(hex) => emit('select-custom-color', hex)"
        @select-image-color="(hex) => emit('select-image-color', hex)"
      />
    </ToolGroup>

    <ToolGroup ref="editGroupRef" :title="t.toolbox.groups.edit" data-testid="tool-group-edit">
      <div class="toolbox__edit">
        <EditControls
          :ids="['undo', 'redo', 'rotate', 'copy']"
          :deps="deps"
          :icon-size="17"
          :test-id-for="(id: EditControlId) => `${id}-button`"
          @activate="onEdit"
        />
      </div>
    </ToolGroup>

    <div class="toolbox__rows">
      <!-- Mirror (ADR 0006), switched off by MIRROR_ENABLED. -->
      <DisclosureRow
        v-if="MIRROR_ENABLED"
        v-model:open="mirrorOpen"
        icon="mirror-horizontal"
        :label="t.toolbox.groups.mirror"
        :summary="mirrorSummary"
        data-testid="tool-group-mirror"
      >
        <MirrorControls
          :project="project"
          :mirror-axis-counts="mirrorAxisCounts ?? NO_MIRROR_AXES"
          :mirror-copy-mode="mirrorCopyMode ?? false"
          @set-mirror-axis-count="(axis, count) => emit('set-mirror-axis-count', axis, count)"
          @toggle-mirror-copy-mode="emit('toggle-mirror-copy-mode')"
          @mirror-current="(axis) => emit('mirror-current', axis)"
          @mirror-current-hover="(axis) => emit('mirror-current-hover', axis)"
        />
      </DisclosureRow>

      <!-- The Frame (CONTEXT.md, ADR 0026): which beads are the Project, and what it measures. -->
      <DisclosureRow
        :open="frameOpen"
        icon="frame"
        :label="t.frame.title"
        :summary="frameSummary"
        :chip="project.frame ? '1' : undefined"
        :chip-label="t.frame.numberLabel.replace('{number}', '1')"
        :chip-tooltip="{ name: t.frame.numberName.replace('{number}', '1'), body: t.tooltips.frameChip }"
        data-testid="tool-group-frame"
        data-tour="frame-row"
        @update:open="onFrameOpenChange"
        @chip="emit('bring-frame')"
      >
        <FrameControls
          :project="project"
          :pending-frame="pendingFrame"
          @set-size="(columns, rows) => emit('set-frame-size', columns, rows)"
          @set-technique="(technique) => emit('set-technique', technique)"
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
