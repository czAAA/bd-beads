<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import CanvasBackdrop from './CanvasBackdrop.vue'
import CanvasHint from './CanvasHint.vue'
import CanvasStrip from './CanvasStrip.vue'
import ContextBar from '../tools/ContextBar.vue'
import AppButton from '../ui/AppButton.vue'
import ProjectImport from '../import/ProjectImport.vue'
import ToolPill from '../tools/ToolPill.vue'
import ConvertImageFrame from '../import/ConvertImageFrame.vue'
import FrameBar from './FrameBar.vue'
import FrameChrome from './FrameChrome.vue'
import EmptyCanvas from './EmptyCanvas.vue'
import ProjectSurface from './ProjectSurface.vue'
import ProgressBar from './ProgressBar.vue'
import ToastRegion from '../ui/ToastRegion.vue'
import { useAppShell } from '../../composables/shell/useAppShell'
import { useColorPick } from '../../composables/tools/usePalette'
import { controlAction } from '../../composables/shell/controlRegistry'
import type { BarBox, FrameAnchor, SelectionAnchor } from '../../composables/tools/selectionBarPlacement'
import { useCanvasBackground } from '../../theme/useCanvasBackground'
import type { Technique } from '../../domain/weave'
import { techniqueName } from '../../i18n/techniqueName'
import type { PillRect } from '../../domain/toolPill'
import { hasGuides } from '../../domain/selection'
import { hasProjectBeads, resolveProjectBead } from '../../domain/project'
import { CONVERT_MAX_ZOOM, CONVERT_MIN_ZOOM } from '../../domain/imageFraming'
import { estimatedSizeMm, formatSizeMm } from '../../domain/projectSize'
import { describeWeave } from '../../domain/weave'

const {
  t,
  openPhoneSheet,
  onSelectPhoneSheet,
  projects,
  onImportProjects,
  onImportToast,
  openMenuOnForm,
  activeProject,
  projectLabel,
  toasts,
  dismissToast,
  framing,
  onConvertImageCreate,
  cancelConvertImage,
  convertZoom,
  convertPan,
  convertMaxColors,
  setConvertPan,
  setConvertMaxColors,
  convertZoomIn,
  convertZoomOut,
  convertResetZoom,
  bindCanvasArea,
  canvasAreaWidth,
  bindCanvasScroll,
  zoom,
  scroll,
  activeTool,
  showRulers,
  toggleRulers,
  rowHighlight,
  toggleRowHighlight,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  panBy,
  scrollBy,
  setZoom,
  zoomIn,
  zoomOut,
  resetZoom,
  stripZoomPercent,
  spaceHeld,
  spacePanning,
  previewColor,
  tour,
  selection,
  pasteProjectionActive,
  onCopy,
  onCut,
  onPasteMode,
  hasClipboard,
  onClearSelection,
  onFillSelection,
  onFrameFromSelection,
  canNamePiece,
  hasPaintColor,
  onNamePiece,
  previewCells,
  previewedMirrorAxisCounts,
  mirrorCurrentDimmedCells,
  onCellPrimaryDown,
  onCellPrimaryMove,
  onCellSecondaryDown,
  onCellSecondaryMove,
  onCellHover,
  onHoverEnd,
  beadCursor,
  cursorShown,
  onProjectKeyboardFocus,
  onProjectKey,
  onProjectKeyUp,
  onRotate,
  onRotateFrame,
  onRotateCanvas,
  onSelectAll,
  toolPillPosition,
  toolPillPopoverOpen,
  recentsInPill,
  recentsInPopover,
  pickRecent,
  selectedColorHex,
  selectedColorId,
  customColor,
  onSelectTool,
  onSelectColor,
  onSelectCustomColor,
  onToggleRowDirection,
  onMoveRow,
  canRemoveSelectedLine,
  onRemoveSelectedLine,
  locale,
  settingFrame,
  onResizeFrame,
  frameBarShown,
  frameBarOpen,
  frameBarFrom,
  surfaceInputMode,
  onFitFrame,
  onEditFrame,
  onCloseFrameBar,
  onFrameKey,
  onStepFrameEdge,
  onRemoveFrame,
  onResetProgress,
  frameDraftProject,
  onFramePress,
  onFrameDrag,
  onFrameRelease,
  onFrameCancel,
  onSelectionPress,
  onSelectionDrag,
  onSelectionRelease,
} = useAppShell()

const newProjectAction = controlAction('new-project')

/** Whenever the empty canvas appears (nothing open, no picture being framed), Menu opens on its New Project form. */
watch(
  () => !framing.value && !activeProject.value,
  (empty) => {
    if (empty) openMenuOnForm()
  },
  { immediate: true },
)

/** The chosen colour as the pill's colour control shows it: its hex and its name (a Palette colour's own, "Custom"
 * for a one-off). */
const colorHex = computed(() => selectedColorHex() ?? undefined)
const colorName = computed(() => {
  const id = selectedColorId.value
  if (id) return t.value.colorNames[id] ?? colorHex.value
  return customColor.value ? t.value.colorNames.custom : undefined
})

/** Where the Tool pill is in the drawing area, so the Selection bar keeps clear of it (ticket 439). */
const pillRect = ref<PillRect>()

/** Pick color from canvas (ticket 403): the surface shows the eyedropper while it is on. */
const colorPick = useColorPick()

/** The Project as drawn: with the Frame as it looks mid-drag while a gesture is going on, which is committed only on
 * release. */
/** Whether Select or Piece is in hand: the pointer is the native arrow, not the bead-shaped marker (ticket 414). */
const selecting = computed(() => activeTool.value === 'select' || activeTool.value === 'piece')

const shownProject = frameDraftProject

/** The Frame's size tooltip while it is set: beads and measured size, "13×13 ≈ 2.1 × 2.1 cm" (Frame card). */
const frameTooltip = computed(() => {
  const project = shownProject.value
  const frame = project?.frame
  if (!project || !frame) return ''
  const bead = resolveProjectBead(project)
  const estimate = bead ? formatSizeMm(estimatedSizeMm(frame, bead), { mm: t.value.form.unitMm, cm: t.value.form.unitCm }, locale.value) : ''
  const { columns, rows } = describeWeave(frame).unitsOf(frame)
  return t.value.frame.sizeTooltip.replace('{columns}', String(columns)).replace('{rows}', String(rows)).replace('{estimate}', estimate)
})

/** Whether the Selection carries handles and ruler numbers (ticket 435): while it is dragged or resized, its bar
 * then shrinks to the size instead of hiding. */
const selectionGuided = computed(() => !!selection.value && hasGuides(selection.value) && showRulers.value !== false)

/** The Selection's size for the bar's readout: "12×8 ≈ 4.2 × 2.6 cm", the rectangle through the Project's Bead
 * (ticket 415). */
const selectionSummary = computed(() => {
  const project = activeProject.value
  const current = selection.value
  if (!project || !current) return undefined
  const bead = resolveProjectBead(project)
  const estimate = bead ? formatSizeMm(estimatedSizeMm(current, bead), { mm: t.value.form.unitMm, cm: t.value.form.unitCm }, locale.value) : ''
  return t.value.frame.sizeTooltip.replace('{columns}', String(current.columns)).replace('{rows}', String(current.rows)).replace('{estimate}', estimate)
})

/** Where the Selection is on the surface and whether a pointer is down on it: the bar anchors to the one and steps
 * aside for the other (ticket 415). */
const selectionAnchor = ref<SelectionAnchor>()
/** Where the Frame is on the canvas box: the Move handle and the edit pencil follow it (ticket 473). */
const frameAnchor = ref<FrameAnchor>()
/** The surface, so a press on the Move handle's button is handed to it as a press on the canvas (ticket 455). */
/** Where the Frame bar is on the drawing area, for the Move handle to keep clear of (ticket 473). */
const frameBarRect = ref<BarBox>()
const surfaceRef = ref<InstanceType<typeof ProjectSurface>>()
const surfacePressing = ref(false)

/** Where the framing step puts its controls: the canvas box's bottom, in the Progress bar's place (ticket 150). */
const framingControlsEl = ref<HTMLElement>()

/** The Canvas color (ticket 252) as the drawing area's fill, and the technique word's own color where the background
 * needs one. */
const canvasBackground = useCanvasBackground()
const drawingStyle = computed(() => {
  const color = canvasBackground.background.value?.color
  if (!color) return undefined
  const word = canvasBackground.wordColor.value
  return { '--canvas-bg': color, ...(word ? { '--word': word } : {}) }
})

/** The Technique's name, the background word behind the board (ticket 143). */
function techniqueWord(technique: Technique): string {
  return techniqueName(t.value, technique)
}
</script>

<template>
  <!--
    The canvas box (ticket 141): all the width right of the left column and the full height of the main area. The
    page never scrolls; the Project scrolls inside the box.
  -->
  <main class="app-shell__canvas-column">
    <div
      class="app-shell__canvas"
      :class="{ 'app-shell__canvas--pan': spaceHeld, 'app-shell__canvas--panning': spacePanning, 'app-shell__canvas--no-progress': framing }"
      data-testid="app-canvas"
    >
      <!--
        The canvas box's header strip (ticket 143, ADR 0055): the canvas controls (Rulers, Undo, Redo, zoom, Fit) and
        Canvas color. While a picture is being framed (ticket 58) its zoom is the framing step's own, over its own
        100–800% range (domain/imageFraming), since that zoom moves the picture under a fixed frame rather than
        scaling the Project on screen. The strip never scrolls, zooms or rotates with the Project below it.
      -->
      <CanvasStrip
        class="app-shell__canvas-strip"
        :project="framing ? undefined : activeProject"
        :rulers="showRulers"
        :frame-open="frameBarOpen"
        :can-undo="canUndo"
        :can-redo="canRedo"
        :open-sheet="openPhoneSheet"
        :zoom-percent="stripZoomPercent"
        :zoom-min-percent="framing ? CONVERT_MIN_ZOOM * 100 : undefined"
        :zoom-max-percent="framing ? CONVERT_MAX_ZOOM * 100 : undefined"
        @select-sheet="onSelectPhoneSheet"
        @toggle-frame="onEditFrame"
        @rotate-canvas="onRotateCanvas"
        @toggle-rulers="toggleRulers"
        @undo="onUndo"
        @redo="onRedo"
        @zoom-in="framing ? convertZoomIn() : zoomIn()"
        @zoom-out="framing ? convertZoomOut() : zoomOut()"
        @reset="framing ? convertResetZoom() : resetZoom()"
      />

      <!-- The drawing area: the rest of the box, measured for the fit zoom (it doesn't grow with the Project). -->
      <div :ref="bindCanvasArea" class="app-shell__drawing" :style="drawingStyle" data-testid="app-drawing-area">
        <CanvasBackdrop v-if="activeProject && !framing" :word="techniqueWord(activeProject.technique)" />

        <!-- How to move the canvas and its shortcuts: top-centre, only while the Project has no beads,
          not on a phone (CanvasHint card). -->
        <CanvasHint v-if="activeProject && !framing && !hasProjectBeads(activeProject)" class="app-shell__canvas-hint" />

        <!--
          The Selection bar (tickets 168, 415; ContextBar card): anchored above the Selection's top edge and clamped
          inside the canvas box, clear of the Tool pill; Select all is its first item.
        -->
        <ContextBar
          v-if="activeProject && !framing"
          :selection-summary="selectionSummary"
          :selection="selection"
          :anchor="selectionAnchor"
          :gesturing="surfacePressing"
          :size-only="selectionGuided"
          :paste-armed="pasteProjectionActive"
          :has-clipboard="hasClipboard()"
          :project="activeProject"
          :can-remove-line="canRemoveSelectedLine"
          :can-name-piece="canNamePiece"
          :has-paint-color="hasPaintColor()"
          :select-active="activeTool === 'select'"
          :obstacle="pillRect"
          @copy="onCopy"
          @cut="onCut"
          @paste="onPasteMode"
          @fill="onFillSelection"
          @frame="onFrameFromSelection"
          @clear-selection="onClearSelection"
          @rotate="onRotate"
          @select-all="onSelectAll"
          @remove-line="onRemoveSelectedLine"
          @name-piece="onNamePiece"
        />

        <!-- The Frame's own controls (tickets 473, 475): the Move handle and edit pencil follow the Frame; the bar hangs
          from the pencil or the strip's Frame button, whichever opened it. -->
        <FrameChrome
          v-if="activeProject && frameAnchor"
          :project="activeProject"
          :anchor="frameAnchor"
          :editing="frameBarOpen"
          :pressing="surfacePressing"
          :bar="frameBarRect"
          :selection="selectionAnchor?.box"
          :pill="pillRect"
          @toggle="onEditFrame('pencil')"
          @remove="onRemoveFrame"
          @move-press="surfaceRef?.pressMoveHandle($event)"
          @key="onFrameKey"
        />

        <FrameBar
          v-if="activeProject && frameBarShown && !framing"
          :project="activeProject"
          :anchor="frameAnchor"
          :from-pencil="frameBarFrom === 'pencil'"
          :grabs-frame="(event: PointerEvent) => surfaceRef?.grabsFrame(event) ?? false"
          @step="onStepFrameEdge"
          @resize="onResizeFrame"
          @rotate="onRotateFrame"
          @remove="onRemoveFrame"
          @key="onFrameKey"
          @close="onCloseFrameBar"
          @rect="frameBarRect = $event"
        />

        <div class="app-shell__canvas-row">
          <div :ref="bindCanvasScroll" class="app-shell__canvas-scroll" data-tour="canvas" :class="{ 'app-shell__canvas-scroll--empty': !activeProject && !framing }">
            <!--
              Convert image's framing step takes this panel over (ticket 58, ADR 0010), in the slot the "No Project
              open yet" placeholder otherwise occupies — and ahead of the open Project too, since framing can be
              entered with one open. Cancel hands the panel straight back.
            -->
            <ConvertImageFrame
              v-if="framing"
              :image="framing.image"
              :technique="framing.technique"
              :brick-block="framing.brickBlock"
              :net-size="framing.netSize"
              :bead="framing.bead"
              :dimensions="framing.dimensions"
              :zoom="convertZoom"
              :pan="convertPan"
              :max-colors="convertMaxColors"
              :available-width="canvasAreaWidth"
              :controls-to="framingControlsEl"
              @pan="setConvertPan"
              @set-max-colors="setConvertMaxColors"
              @create="onConvertImageCreate"
              @cancel="cancelConvertImage"
            />
            <ProjectSurface
              v-else-if="activeProject"
              ref="surfaceRef"
              :project="shownProject!"
              :setting-frame="settingFrame"
              :frame-tooltip="frameTooltip"
              :zoom="zoom"
              :scroll="scroll"
              :show-rulers="showRulers"
              :row-marks="rowHighlight"
              :moving="activeTool === 'hand'"
              :marker-hidden="spaceHeld"
              :picking="colorPick?.picking.value"
              :input-mode="surfaceInputMode"
              :preview-cells="previewCells"
              :preview-color="previewColor"
              :selection="selection"
              :selecting="selecting"
              :mirror-axis-counts="previewedMirrorAxisCounts"
              :dimmed-cells="mirrorCurrentDimmedCells"
              :cursor="cursorShown ? beadCursor : undefined"
              :tour-marks="tour.marks.value"
              :label="projectLabel"
              @cursor-key="onProjectKey"
              @keyup="onProjectKeyUp"
              @keyboard-focus="onProjectKeyboardFocus"
              @cell-primary-down="onCellPrimaryDown"
              @cell-primary-move="onCellPrimaryMove"
              @cell-secondary-down="onCellSecondaryDown"
              @cell-secondary-move="onCellSecondaryMove"
              @cell-hover="onCellHover"
              @hover-end="onHoverEnd"
              @pan="panBy"
              @scroll="scrollBy"
              @zoom-by="(factor, anchor) => setZoom(zoom * factor, anchor)"
              @frame-press="onFramePress"
              @frame-drag="onFrameDrag"
              @frame-release="onFrameRelease"
              @frame-cancel="onFrameCancel"
              @selection-press="onSelectionPress"
              @selection-drag="onSelectionDrag"
              @selection-release="onSelectionRelease"
              @selection-anchor="selectionAnchor = $event"
              @frame-anchor="frameAnchor = $event"
              @pressing="surfacePressing = $event"
            />
            <EmptyCanvas v-else>
              <div class="app-shell__empty-actions" data-testid="phone-project-bar">
                <AppButton variant="primary" icon="plus" :action="newProjectAction" data-testid="phone-bar-new-project" @click="openMenuOnForm" />
                <ProjectImport compact toast-results :projects="projects" testid-prefix="phone-bar-" @import="onImportProjects" @import-result="onImportToast" />
              </div>
            </EmptyCanvas>
          </div>

        </div>

        <!-- The Tool pill (ticket 439, ADR 0059): floats over the drawing, outside the zoom transform. -->
        <ToolPill
          v-if="activeProject && !framing"
          v-model:position="toolPillPosition"
          v-model:popover-open="toolPillPopoverOpen"
          :active-tool="activeTool"
          :has-clipboard="hasClipboard()"
          :paste-armed="pasteProjectionActive"
          :color-hex="colorHex"
          :color-name="colorName"
          :recents-in-pill="recentsInPill"
          :recents-in-popover="recentsInPopover"
          :selected-color-id="selectedColorId"
          :custom-color="customColor"
          :open-sheet="openPhoneSheet"
          @select-sheet="onSelectPhoneSheet"
          @select-tool="onSelectTool"
          @paste-mode="onPasteMode"
          @pick-recent="pickRecent"
          @select-color="onSelectColor"
          @select-custom-color="onSelectCustomColor"
          @rect="pillRect = $event"
        />
      </div>

      <!-- Short-lived results (ticket 76, 429): top-right of the canvas box, under the strip, stacking downward. -->
      <ToastRegion
        :toasts="toasts"
        @dismiss="dismissToast"
      />

      <!-- The framing step's controls, in the Progress bar's place (ticket 150; ConvertImage card). -->
      <div v-if="framing" ref="framingControlsEl" data-testid="framing-controls" />

      <!--
        Progress bar (ticket 144): along the canvas box's bottom edge, always there while a Project is open (not
        while a picture is being framed), since its first control is Remove frame (ticket 426).
      -->
      <ProgressBar
        v-if="activeProject && !framing"
        :project="activeProject"
        :row-highlight="rowHighlight"
        @move-row="onMoveRow"
        @reset-progress="onResetProgress"
        @toggle-row-direction="onToggleRowDirection"
        @toggle-row-highlight="toggleRowHighlight"
        @fit-frame="onFitFrame"
      />
    </div>
  </main>
</template>

<style scoped>
/* New Project and the import icons, under the empty canvas's message (they were a bar in the Progress bar's place,
   ticket 439). */
.app-shell__empty-actions {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  /* Narrow enough that New Project and both imports fit a 320px screen in Russian. */
  width: min(100%, var(--tooltip-wide));
}

/* New Project grows to take the remaining width; the import icons sit at a fixed square size beside it. */
.app-shell__empty-actions :deep(.app-button) {
  flex: 1 1 0;
}

/* With the bar gone (while a picture is framed), the toasts and the Selection bar sit where it was. */
.app-shell__canvas--no-progress {
  --progress-height: 0px;
}

/* The canvas box's cell: the rest of the width, the full height. */
.app-shell__canvas-column {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

/* The canvas box (ticket 141): right of the left column, full body height, dot-grid texture; rows stack zoom cluster,
 * Progress bar, Project. The canvas moves under its own view (ADR 0026), so nothing scrolls natively; the zoom
 * cluster is a sibling of the scroller, so it never scrolls, zooms or rotates with the Project. */
.app-shell__canvas {
  position: relative;
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  overflow: clip;
  background: var(--box);
  border: 1px solid var(--box-line);
  border-radius: var(--radius-lg);
  box-shadow: var(--elevation-2);
}

/* The drawing area (ticket 143): the box under the strip, sized for the fit zoom, so it takes a share (flex-basis 0),
 * never the Project's size. The backdrop fills it behind everything; later siblings are positioned too, so they paint
 * over it. */
.app-shell__drawing {
  position: relative;
  background: var(--canvas-bg, transparent);
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

/* CanvasHint is excluded: it floats over the top-centre, and so are the context bar, the Frame's chrome, and
 * the Tool pill's layer, which float over the beads. */
.app-shell__drawing > :not(.canvas-backdrop):not(.app-shell__canvas-hint):not(.context-bar):not(.frame-chrome):not(.tool-pill-layer) {
  position: relative;
}

/** Space+drag panning (ticket 95): grab cursor while Space is held, grabbing once the drag starts (BeadHover card);
 * wins over the bead marker. */
.app-shell__canvas--pan,
.app-shell__canvas--pan :deep(*) {
  cursor: grab;
}

.app-shell__canvas--panning,
.app-shell__canvas--panning :deep(*) {
  cursor: grabbing;
}

/*
 * The row takes the whole drawing area; the surface inside it fills it, so the Canvas has no box of its own to centre.
 */
.app-shell__canvas-row {
  position: relative;
  flex: 1 1 auto;
  align-self: stretch;
  min-height: 0;
}

/* Fills the drawing area: the Canvas's surface (and Convert image's framing step) is laid over all of it. */
.app-shell__canvas-scroll {
  position: absolute;
  inset: 0;
  box-sizing: border-box;
  min-width: 0;
  overflow: auto;
  overscroll-behavior: none;
}

/* When no Project is open the scroll panel stretches to fill the whole row so the dot board covers it edge to edge. */
.app-shell__canvas-scroll--empty {
  align-self: stretch;
  width: 100%;
  overflow: hidden;
}

</style>
