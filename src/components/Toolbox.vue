<script setup lang="ts">
import { computed, ref } from 'vue'
import CustomColorPicker from './CustomColorPicker.vue'
import ImageColorsPicker from './ImageColorsPicker.vue'
import PalettePicker from './PalettePicker.vue'
import SizeControls from './SizeControls.vue'
import ToolGroup from './ToolGroup.vue'
import { useI18n } from '../i18n/useI18n'
import type { Tool } from '../domain/tool'
import { maxAxisCount, type MirrorAxisCounts } from '../domain/mirror'
import type { Pattern } from '../domain/pattern'
import type { ResizeRequest } from '../domain/resize'

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
  mirrorAxisCounts: MirrorAxisCounts
  /** Mirror's copy-mode switch (ticket 45). */
  mirrorCopyMode: boolean
  /** Whether the "Saved" confirmation (ticket 115) is showing — set by whoever ran the save, cleared by itself after a moment. */
  saved?: boolean
  /** The open Pattern doesn't fit a single QR code (ADR 0015), so QR export is off (ticket 116). */
  qrTooLarge?: boolean
  /** A PNG or PDF is being drawn (tickets 73, 74): its buttons wait, so a second press doesn't start a second one. */
  exporting?: boolean
}>()

const emit = defineEmits<{
  'select-tool': [tool: Tool]
  'select-color': [colorId: string]
  'select-custom-color': [hex: string]
  'select-image-color': [hex: string]
  undo: []
  redo: []
  'toggle-rotate': []
  copy: []
  /** Save (ticket 115): write the library to this device now. */
  save: []
  /** QR export (ticket 116): open the QR panel for the open Pattern. */
  'export-qr': []
  /** PNG and PDF export (tickets 73, 74): hand the open Pattern over as a picture / a printable document. */
  'export-png': []
  'export-pdf': []
  'set-mirror-axis-count': [axis: 'columns' | 'rows', count: number]
  'toggle-mirror-copy-mode': []
  'mirror-current': [axis: 'horizontal' | 'vertical']
  'mirror-current-hover': [axis: 'horizontal' | 'vertical' | null]
  'toggle-row-progress': [enabled: boolean]
  'toggle-row-direction': []
  'delete-all': []
  /** "Remove selected row/column" (ticket 123): the Selection names which one, so it takes no payload of its own. */
  'remove-selected-line': []
  /** A Resize (CONTEXT.md, ADR 0017) from the Size group, in grid space. */
  resize: [request: ResizeRequest]
}>()

const { t } = useI18n()

/** Custom color is the active paint color exactly when neither a Palette swatch nor an Image color is (App.vue keeps the three mutually exclusive). */
const customColorSelected = computed(
  () => !props.selectedColorId && !props.selectedImageColor && !!props.customColor,
)

/**
 * Refs to every Tool group, written out individually since they're written out individually below (ticket 40's
 * layout), so Escape can ask each one to collapse (ticket 41) — see collapseExpandedGroup and App.vue's onKeyDown,
 * which calls it before running its own Paste-cancel/Selection-clear precedence.
 */
const toolsGroupRef = ref<InstanceType<typeof ToolGroup> | null>(null)
const colorsGroupRef = ref<InstanceType<typeof ToolGroup> | null>(null)
const editGroupRef = ref<InstanceType<typeof ToolGroup> | null>(null)
const mirrorGroupRef = ref<InstanceType<typeof ToolGroup> | null>(null)
const sizeGroupRef = ref<InstanceType<typeof ToolGroup> | null>(null)
const rowProgressGroupRef = ref<InstanceType<typeof ToolGroup> | null>(null)

/**
 * Collapses whichever Tool group is currently hover-expanded (ticket 41). Only one ever is, since expansion follows
 * a single pointer, but this asks every group regardless rather than assuming that — each collapse() is a no-op
 * when that group wasn't expanded. Returns whether any of them was, so App.vue's onKeyDown knows whether this
 * Escape press was "used up" by collapsing a group or should fall through to its usual Select precedence.
 */
function collapseExpandedGroup(): boolean {
  const groups = [toolsGroupRef, colorsGroupRef, editGroupRef, mirrorGroupRef, sizeGroupRef, rowProgressGroupRef]
  const collapsed = groups.map((group) => group.value?.collapse() ?? false)
  return collapsed.some(Boolean)
}

defineExpose({ collapseExpandedGroup })

/**
 * Which grid-space axis ('columns'/'rows') the on-screen Left–right and Top–bottom counters each drive, given the
 * Pattern's current view-only rotation (see Pattern.rotated / PatternCanvas.vue): rotating swaps the two, the same
 * relabeling PatternCanvas already does for width/height, never a transform of the counts or grid data themselves.
 */
const leftRightAxis = computed<'columns' | 'rows'>(() => (props.pattern.rotated ? 'rows' : 'columns'))
const topBottomAxis = computed<'columns' | 'rows'>(() => (props.pattern.rotated ? 'columns' : 'rows'))

const leftRightCount = computed(() => props.mirrorAxisCounts[leftRightAxis.value])
const topBottomCount = computed(() => props.mirrorAxisCounts[topBottomAxis.value])

const leftRightMax = computed(() =>
  maxAxisCount(props.pattern.rotated ? props.pattern.rows : props.pattern.columns),
)
const topBottomMax = computed(() =>
  maxAxisCount(props.pattern.rotated ? props.pattern.columns : props.pattern.rows),
)
</script>

<template>
  <div class="toolbox" data-testid="toolbox">
    <ToolGroup ref="toolsGroupRef" :title="t.toolbox.groups.tools" data-testid="tool-group-tools">
      <button
        type="button"
        class="icon-button"
        data-testid="tool-paint"
        :title="`${t.tools.paintLabel} (1)`"
        :aria-label="t.tools.paintLabel"
        :aria-pressed="activeTool === 'paint'"
        :class="{ 'tool-picker__button--selected': activeTool === 'paint' }"
        @click="emit('select-tool', 'paint')"
      >
        <!-- A brush held at an angle, bristles splaying to the low corner. -->
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M17.5 2.5 21.5 6.5 11 17 7 13z" />
          <path d="M7 13 3.5 20.5 11 17" />
        </svg>
      </button>
      <button
        type="button"
        class="icon-button"
        data-testid="tool-fill"
        :title="`${t.tools.fillLabel} (2)`"
        :aria-label="t.tools.fillLabel"
        :aria-pressed="activeTool === 'fill'"
        :class="{ 'tool-picker__button--selected': activeTool === 'fill' }"
        @click="emit('select-tool', 'fill')"
      >
        <!-- A tipped paint bucket with a drop coming off it. -->
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M10.5 2.5 3.9 9.1a2 2 0 0 0 0 2.8l5.2 5.2a2 2 0 0 0 2.8 0l6.6-6.6z" />
          <path d="M20.5 14.5c.9 1.3 1.4 2.2 1.4 2.8a1.4 1.4 0 0 1-2.8 0c0-.6.5-1.5 1.4-2.8z" />
        </svg>
      </button>
      <button
        type="button"
        class="icon-button"
        data-testid="tool-select"
        :title="`${t.tools.selectLabel} (3)`"
        :aria-label="t.tools.selectLabel"
        :aria-pressed="activeTool === 'select'"
        :class="{ 'tool-picker__button--selected': activeTool === 'select' }"
        @click="emit('select-tool', 'select')"
      >
        <!-- A dashed rectangle: the marquee this tool drags out. -->
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M3 8V6a3 3 0 0 1 3-3h2" />
          <path d="M16 3h2a3 3 0 0 1 3 3v2" />
          <path d="M21 16v2a3 3 0 0 1-3 3h-2" />
          <path d="M8 21H6a3 3 0 0 1-3-3v-2" />
          <path d="M11 3h2M11 21h2M3 11v2M21 11v2" />
        </svg>
      </button>
      <button
        type="button"
        class="icon-button"
        data-testid="tool-erase"
        :title="t.tools.eraseLabel"
        :aria-label="t.tools.eraseLabel"
        :aria-pressed="activeTool === 'erase'"
        :class="{ 'tool-picker__button--selected': activeTool === 'erase' }"
        @click="emit('select-tool', 'erase')"
      >
        <!-- A tilted eraser block. -->
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M17.5 3.5 20.5 6.5 9 18H5.5v-3.5z" />
          <path d="M13 8 16 11" />
          <path d="M3.5 20.5h9" />
        </svg>
      </button>
      <button
        type="button"
        class="icon-button"
        data-testid="tool-remove-line"
        :title="t.tools.removeLineButton"
        :aria-label="t.tools.removeLineButton"
        :disabled="!canRemoveSelectedLine"
        @click="emit('remove-selected-line')"
      >
        <!-- A row lifted out of a stack, arrows closing the gap it leaves behind: works the same read sideways for a column. -->
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M3 6h18" />
          <path d="M3 18h18" />
          <path d="M3 12h18" stroke-dasharray="2.5 2.5" />
          <path d="M9 8.5 12 5.5l3 3" />
          <path d="M9 15.5l3 3 3-3" />
        </svg>
      </button>
      <button
        type="button"
        class="icon-button button--danger"
        data-testid="delete-all-button"
        :title="t.deleteAll.button"
        :aria-label="t.deleteAll.button"
        @click="emit('delete-all')"
      >
        <!-- The same bin glyph the app already uses for removing a Pattern (PatternList.vue). -->
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M4 7h16" />
          <path d="M9 7V4h6v3" />
          <path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
        </svg>
      </button>
    </ToolGroup>

    <ToolGroup ref="colorsGroupRef" :title="t.toolbox.groups.colors" data-testid="tool-group-colors">
      <PalettePicker :selected-color-id="selectedColorId" @select="(colorId) => emit('select-color', colorId)" />
      <CustomColorPicker
        :color="customColor"
        :selected="customColorSelected"
        @select="(hex) => emit('select-custom-color', hex)"
      />
      <!--
        The open Pattern's Image colors (ADR 0011), alongside the Palette rather than instead of it — a converted
        Pattern is touched up with its own colors, and any other Pattern has none of these and shows nothing here.

        Marked as a full row so it keeps its own line under the Palette's swatches rather than being squeezed into one
        of the group's grid columns. That also takes it outside the group's 14-control cap (see ToolGroup.vue), so the
        set it can hold is bounded at the other end instead: a conversion keeps at most MAX_IMAGE_COLORS colors, which
        is that same 14, two rows of seven (see domain/imageConversion.ts).
      -->
      <ImageColorsPicker
        v-if="pattern.imageColors?.length"
        class="tool-group__full-row"
        :colors="pattern.imageColors"
        :selected-color="selectedImageColor"
        @select="(hex) => emit('select-image-color', hex)"
      />
    </ToolGroup>

    <ToolGroup ref="editGroupRef" :title="t.toolbox.groups.edit" data-testid="tool-group-edit">
      <button
        type="button"
        class="icon-button"
        data-testid="undo-button"
        :title="t.palette.undoButton"
        :aria-label="t.palette.undoButton"
        :disabled="!canUndo"
        @click="emit('undo')"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M7 7 3 11l4 4" />
          <path d="M3 11h11a7 7 0 1 1 -7 7" />
        </svg>
      </button>
      <button
        type="button"
        class="icon-button"
        data-testid="rotate-button"
        :title="`${t.palette.rotateButton} (R)`"
        :aria-label="t.palette.rotateButton"
        :aria-pressed="pattern.rotated"
        :class="{ 'tool-picker__button--selected': pattern.rotated }"
        @click="emit('toggle-rotate')"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <rect x="3" y="11" width="13" height="9" rx="1.5" />
          <rect x="9" y="4" width="9" height="13" rx="1.5" />
        </svg>
      </button>
      <button
        type="button"
        class="icon-button"
        data-testid="copy-button"
        :title="`${t.tools.copyButton} (Ctrl/Cmd+C)`"
        :aria-label="t.tools.copyButton"
        :disabled="!canCopy"
        @click="emit('copy')"
      >
        <!-- One sheet laid over a second: the duplicate the Selection becomes. Only the back sheet's exposed corner is drawn, so it doesn't read as Rotate's two full rectangles. -->
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <rect x="8" y="8" width="13" height="13" rx="2" />
          <path d="M16 8V3H3v13h5" />
        </svg>
      </button>
      <button
        type="button"
        class="icon-button"
        data-testid="redo-button"
        :title="t.palette.redoButton"
        :aria-label="t.palette.redoButton"
        :disabled="!canRedo"
        @click="emit('redo')"
      >
        <!-- Undo's icon, mirrored left-right: the same swoop curling the other way, arrowhead pointing right. -->
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M17 7 21 11l-4 4" />
          <path d="M21 11h-11a7 7 0 1 0 7 7" />
        </svg>
      </button>
      <button
        type="button"
        class="icon-button"
        data-testid="save-button"
        :title="`${t.tools.saveButton} (Ctrl/Cmd+S)`"
        :aria-label="t.tools.saveButton"
        @click="emit('save')"
      >
        <!-- A floppy disk: the shutter notch at the top, the label window below it. -->
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M4 4h13l3 3v13H4z" />
          <path d="M8 4v5h7V4" />
          <path d="M7 20v-6h10v6" />
        </svg>
      </button>
      <!-- The tooltip sits on a wrapper: browsers don't reliably show a disabled button's own title. -->
      <span
        class="toolbox__qr-action"
        :title="qrTooLarge ? t.transfer.qrTooLargeMessage : undefined"
        data-testid="export-qr-wrapper"
      >
        <button
          type="button"
          class="icon-button"
          data-testid="export-qr"
          :title="qrTooLarge ? undefined : t.transfer.exportQrButton"
          :aria-label="t.transfer.exportQrButton"
          :disabled="qrTooLarge"
          @click="emit('export-qr')"
        >
          <!-- Three finder squares and a few data modules: the shape of a QR code. -->
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <path d="M14 14h3v3h-3zM19 14h2M14 19h2M19 19h2v2" />
          </svg>
        </button>
      </span>
      <button
        type="button"
        class="icon-button"
        data-testid="export-png"
        :title="t.transfer.exportPngButton"
        :aria-label="t.transfer.exportPngButton"
        :disabled="exporting"
        @click="emit('export-png')"
      >
        <!-- A picture: a frame with a sun and a hill. -->
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <circle cx="9" cy="10" r="1.5" />
          <path d="m21 16-5-5-8 8" />
        </svg>
      </button>
      <button
        type="button"
        class="icon-button"
        data-testid="export-pdf"
        :title="t.transfer.exportPdfButton"
        :aria-label="t.transfer.exportPdfButton"
        :disabled="exporting"
        @click="emit('export-pdf')"
      >
        <!-- A sheet with a folded corner and lines of text: a document to print. -->
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M6 3h9l4 4v14H6z" />
          <path d="M15 3v4h4" />
          <path d="M9 12h7M9 15h7M9 18h4" />
        </svg>
      </button>
      <!--
        Save's confirmation (ticket 115): a status line of its own inside the group, so it sits right by the button that
        caused it. A full row, like the other text readouts, so it doesn't count toward the group's control cap.
      -->
      <p v-if="saved" class="tool-group__full-row toolbox__saved" role="status" data-testid="save-confirmation">
        {{ t.tools.savedConfirmation }}
      </p>
    </ToolGroup>

    <ToolGroup ref="mirrorGroupRef" :title="t.toolbox.groups.mirror" data-testid="tool-group-mirror">
      <p class="tool-group__full-row mirror-axis-counter" data-testid="mirror-left-right">
        <button
          type="button"
          class="icon-button"
          data-testid="mirror-left-right-decrease"
          :title="`${t.mirror.decreaseLeftRightButton} (-)`"
          :aria-label="t.mirror.decreaseLeftRightButton"
          :disabled="leftRightCount === 0"
          @click="emit('set-mirror-axis-count', leftRightAxis, leftRightCount - 1)"
        >
          −
        </button>
        <span class="mirror-axis-counter__label" data-testid="mirror-left-right-value">
          {{ t.mirror.leftRightLabel }}: {{ leftRightCount }}
        </span>
        <button
          type="button"
          class="icon-button"
          data-testid="mirror-left-right-increase"
          :title="`${t.mirror.increaseLeftRightButton} (=)`"
          :aria-label="t.mirror.increaseLeftRightButton"
          :disabled="leftRightCount === leftRightMax"
          @click="emit('set-mirror-axis-count', leftRightAxis, leftRightCount + 1)"
        >
          +
        </button>
      </p>
      <p class="tool-group__full-row mirror-axis-counter" data-testid="mirror-top-bottom">
        <button
          type="button"
          class="icon-button"
          data-testid="mirror-top-bottom-decrease"
          :title="`${t.mirror.decreaseTopBottomButton} ([)`"
          :aria-label="t.mirror.decreaseTopBottomButton"
          :disabled="topBottomCount === 0"
          @click="emit('set-mirror-axis-count', topBottomAxis, topBottomCount - 1)"
        >
          −
        </button>
        <span class="mirror-axis-counter__label" data-testid="mirror-top-bottom-value">
          {{ t.mirror.topBottomLabel }}: {{ topBottomCount }}
        </span>
        <button
          type="button"
          class="icon-button"
          data-testid="mirror-top-bottom-increase"
          :title="`${t.mirror.increaseTopBottomButton} (])`"
          :aria-label="t.mirror.increaseTopBottomButton"
          :disabled="topBottomCount === topBottomMax"
          @click="emit('set-mirror-axis-count', topBottomAxis, topBottomCount + 1)"
        >
          +
        </button>
      </p>
      <button
        type="button"
        class="icon-button"
        data-testid="mirror-copy-mode"
        :title="`${t.mirror.copyModeLabel} (M)`"
        :aria-label="t.mirror.copyModeLabel"
        :aria-pressed="mirrorCopyMode"
        :class="{ 'tool-picker__button--selected': mirrorCopyMode }"
        @click="emit('toggle-mirror-copy-mode')"
      >
        <!-- Three identical rectangles in a row: this switch makes every strip repeat the same way round (A | A | A) instead of mirror-imaging. -->
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <rect x="2" y="8" width="5" height="8" rx="1" />
          <rect x="9.5" y="8" width="5" height="8" rx="1" />
          <rect x="17" y="8" width="5" height="8" rx="1" />
        </svg>
      </button>
      <button
        type="button"
        class="icon-button"
        data-testid="mirror-current-horizontal"
        :title="`${t.mirror.mirrorCurrentHorizontalButton} (H)`"
        :aria-label="t.mirror.mirrorCurrentHorizontalButton"
        @click="emit('mirror-current', 'horizontal')"
        @mouseenter="emit('mirror-current-hover', 'horizontal')"
        @mouseleave="emit('mirror-current-hover', null)"
      >
        <!-- Two shapes facing away from a dashed vertical axis: the left-right flip this button performs. -->
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M12 3v3M12 10.5v3M12 18v3" />
          <path d="M8.5 7 3.5 12l5 5z" />
          <path d="M15.5 7l5 5-5 5z" />
        </svg>
      </button>
      <button
        type="button"
        class="icon-button"
        data-testid="mirror-current-vertical"
        :title="`${t.mirror.mirrorCurrentVerticalButton} (V)`"
        :aria-label="t.mirror.mirrorCurrentVerticalButton"
        @click="emit('mirror-current', 'vertical')"
        @mouseenter="emit('mirror-current-hover', 'vertical')"
        @mouseleave="emit('mirror-current-hover', null)"
      >
        <!-- The same glyph turned a quarter turn: a dashed horizontal axis with the shapes above and below it. -->
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M3 12h3M10.5 12h3M18 12h3" />
          <path d="M7 8.5 12 3.5l5 5z" />
          <path d="M7 15.5 12 20.5l5-5z" />
        </svg>
      </button>
    </ToolGroup>

    <!--
      Estimated size and Resize (CONTEXT.md, ADR 0017). One full-row control, like Mirror's counters: it lays its own
      readout, inputs and notes out inside, and doesn't count toward the group's 14-control cap.
    -->
    <ToolGroup ref="sizeGroupRef" :title="t.toolbox.groups.size" data-testid="tool-group-size">
      <SizeControls class="tool-group__full-row" :pattern="pattern" @resize="(request) => emit('resize', request)" />
    </ToolGroup>

    <!--
      Row progress's moment-to-moment controls — the readout and Previous/Next — moved to Progress bar on the canvas
      (CONTEXT.md; ADR 0005's 2026-09-22 amendment, ticket 124). This group keeps only what's set once per session.
    -->
    <ToolGroup
      ref="rowProgressGroupRef"
      :title="t.toolbox.groups.rowProgress"
      data-testid="tool-group-row-progress"
    >
      <button
        type="button"
        class="icon-button"
        data-testid="row-progress-enabled"
        :title="`${t.rowProgress.enabledLabel} (P)`"
        :aria-label="t.rowProgress.enabledLabel"
        :aria-pressed="pattern.rowProgress.enabled"
        :class="{ 'tool-picker__button--selected': pattern.rowProgress.enabled }"
        @click="emit('toggle-row-progress', !pattern.rowProgress.enabled)"
      >
        <!-- Rows of weaving with the current one boxed: the overlay this toggles on. -->
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M3 5.5h18" />
          <rect x="3" y="9.5" width="18" height="5" rx="1.5" />
          <path d="M3 18.5h18" />
        </svg>
      </button>
      <button
        type="button"
        class="icon-button"
        data-testid="row-progress-direction"
        :title="`${t.rowProgress.directionButton} (D)`"
        :aria-label="t.rowProgress.directionButton"
        :aria-pressed="pattern.rowProgress.direction === 'columns'"
        :class="{ 'tool-picker__button--selected': pattern.rowProgress.direction === 'columns' }"
        @click="emit('toggle-row-direction')"
      >
        <!-- A row lying across and a row standing upright, with a quarter-turn arrow from one to the other. -->
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <rect x="3" y="3" width="11" height="5" rx="1.5" />
          <rect x="16" y="10" width="5" height="11" rx="1.5" />
          <path d="M6 11.5v1.5a4 4 0 0 0 4 4h2.5" />
          <path d="M10.5 14.5 13 17l-2.5 2.5" />
        </svg>
      </button>
    </ToolGroup>
  </div>
</template>

<style scoped>
/* The default button is already wedgewood, so the selected tool/state reads as ink-on-paper instead. */
.tool-picker__button--selected,
.tool-picker__button--selected:hover:not(:disabled) {
  background: var(--color-ink);
  color: var(--color-paper);
}

/*
 * The Toolbox (CONTEXT.md): a fixed-width rail down the left of the app shell (ticket 114, ADR 0005), its Tool groups
 * stacked vertically on a dot-grid notepad-paper texture. The dots are a muted tint of --color-ink, derived with
 * color-mix rather than a new token — a decorative texture, not a palette addition (ticket 20's "no new tokens"
 * constraint is about the header boxes, not this).
 *
 * The width is what the controls add up to, not a number chosen on its own: four 36px columns with their gaps, the group
 * boxes' padding and borders, and the rail's own — 200px. On a tablet (an iPad in either orientation, or anything narrow
 * enough to be short of room) it is three 44px columns instead, so a finger has a full-size target, for 172px. Both are
 * the "fixed" of the rail's fixed width: it never grows with the window.
 *
 * Kept in view by the shell (App.vue's .app-shell__rail: sticky, and no taller than the viewport), which scrolls the
 * rail itself when its groups add up to more than a short window can show — so overflow-x is never wanted, and every
 * group below is laid out to fit without it.
 */
.toolbox {
  --tool-columns: 4;
  --tool-size: 36px;
  --tool-gap: 6px;
  --tool-group-padding: 6px;
  --swatch-size: 32px;

  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 10px;
  box-sizing: border-box;
  width: 200px;
  padding: 6px;
  background-color: var(--color-paper-solid);
  background-image: radial-gradient(color-mix(in srgb, var(--color-ink) 15%, transparent) 1.5px, transparent 1.5px);
  background-size: 16px 16px;
  border: var(--border-width) solid var(--color-ink);
  border-radius: var(--radius-lg);
}

@media (max-width: 1100px), (pointer: coarse) {
  .toolbox {
    --tool-columns: 3;
    --tool-size: 44px;
    --tool-gap: 4px;
    --tool-group-padding: 5px;
    --swatch-size: 40px;

    width: 172px;
    padding: 4px;
  }
}

/* An icon button is 44px everywhere else; in the rail it takes the column's width so four fit across (three on a tablet, at the full 44px). */
.toolbox :deep(.icon-button) {
  width: var(--tool-size);
  height: var(--tool-size);
}

/* Palette, Custom color and Image color swatches all take the one size, so they line up with each other and with the columns. */
.toolbox :deep(.palette-picker__swatch),
.toolbox :deep(.image-colors-picker__swatch),
.toolbox :deep(.custom-color-picker) {
  width: var(--swatch-size);
  height: var(--swatch-size);
}

/*
 * Image colors keep their own row under the Palette (they are marked .tool-group__full-row), so they wrap on their own
 * rather than in the group's columns: as many swatches as fit across, on the same gap as the columns.
 */
.toolbox :deep(.image-colors-picker) {
  gap: var(--tool-gap);
}

/*
 * :deep() reaches into PalettePicker's own root, which normally lays its swatches out with its own flex-wrap.
 * display:contents removes that box so the 12 swatches become direct children of the Colors group's own
 * .tool-group__grid instead, wrapping at the same four-per-row the rest of the Toolbox uses. Trade-off: this can drop
 * PalettePicker's own role="group"/aria-label from the accessibility tree in engines that don't preserve ARIA
 * semantics through display:contents — each swatch still names itself individually, and the Colors group itself is
 * still named via ToolGroup's aria-labelledby, so nothing becomes unreachable, just less specifically grouped.
 */
.toolbox :deep(.palette-picker) {
  display: contents;
}

/* The wrapper is there to carry a tooltip a disabled button can't (ticket 116), so it needs a real box exactly the button's size to be hovered — display: contents would drop it. */
.toolbox__qr-action {
  display: inline-flex;
}

.toolbox__saved {
  margin: 0;
  font-weight: var(--font-weight-bold);
}

/*
 * Mirror's per-direction axis counters (ticket 44): each takes its own full row (tool-group__full-row). The rail is too
 * narrow for decrease / value / increase side by side, so the value takes the row's first line and the two buttons share
 * the one beneath — `order` moves only what is seen; the markup, and so the reading and Tab order, stays decrease,
 * value, increase.
 */
.mirror-axis-counter {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px var(--tool-gap);
  margin: 0;
}

.mirror-axis-counter__label {
  order: -1;
  font-size: 15px;
  flex: 1 1 100%;
  min-width: 0;
  font-variant-numeric: tabular-nums;
}
</style>
