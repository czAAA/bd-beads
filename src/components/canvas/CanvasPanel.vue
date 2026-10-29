<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useElementSize } from '../../composables/ui/useElementSize'
import CanvasHint from './CanvasHint.vue'
import CanvasStrip from './CanvasStrip.vue'
import ContextBar from '../tools/ContextBar.vue'
import AppButton from '../ui/AppButton.vue'
import ProjectImport from '../import/ProjectImport.vue'
import ToolPill from '../tools/ToolPill.vue'
import FrameChrome from './FrameChrome.vue'
import EmptyCanvas from './EmptyCanvas.vue'
import ProjectSurface from './ProjectSurface.vue'
import ProgressBar from './ProgressBar.vue'
import ToastRegion from '../ui/ToastRegion.vue'
import { useCanvasContext } from '../../composables/shell/useAppShell'
import { useColorPick, usePalette } from '../../composables/tools/usePalette'
import { colorName } from '../../i18n/colorName'
import { controlAction } from '../../composables/shell/controlRegistry'
import type { FrameAnchor, SelectionAnchor } from '../../composables/tools/selectionBarPlacement'
import { useCanvasBackground } from '../../theme/useCanvasBackground'
import type { PillRect } from '../../domain/toolPill'
import { hasGuides } from '../../domain/selection'
import { toolCapabilities } from '../../domain/tool'
import { hasProjectBeads } from '../../domain/layerBeads'
import { resolveProjectBead } from '../../domain/projectBead'
import { estimatedSizeMm, formatSizeMm } from '../../domain/projectSize'
import { fillBlanks } from '../../domain/fillBlanks'

const {
  t,
  openPanel,
  onSelectPanel,
  projects,
  onImportProjects,
  openMenuOnForm,
  activeProject,
  projectLabel,
  toasts,
  dismissToast,
  bindCanvasArea,
  bindCanvasScroll,
  zoom,
  scroll,
  selectionRefusals,
  activeTool,
  showRulers,
  stroking,
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
  onCellPrimaryDown,
  onCellPrimaryMove,
  onCellsPrimaryMove,
  onCellHover,
  onHoverEnd,
  onRotate,
  onRotateCanvas,
  onSelectAll,
  toolPillPosition,
  toolPillPopoverOpen,
  recentsInPill,
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
  framePanelOpen,
  frameHandlesOn,
  onToggleFramePanel,
  surfaceInputMode,
  handedness,
  onFitFrame,
  onEditFrame,
  onFrameKey,
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
} = useCanvasContext()

const newProjectAction = controlAction('new-project')

/** Whenever the empty canvas appears (nothing open), Menu opens on its New Project form. */
watch(
  () => !activeProject.value,
  (empty) => {
    if (empty) openMenuOnForm()
  },
  { immediate: true },
)

/** The chosen colour as the pill's colour control shows it: its hex and its name (a Palette colour's own, "Custom"
 * for a one-off). */
const colorHex = computed(() => selectedColorHex() ?? undefined)
const palette = usePalette()
const colorLabel = computed(() => {
  const id = selectedColorId.value
  if (id) return colorName(t.value, palette.value.byId(id))
  return customColor.value ? colorName(t.value, undefined) : undefined
})

/** Where the Tool pill is in the drawing area, so the Selection bar keeps clear of it (ticket 439). */
const pillRect = ref<PillRect>()

/** Pick color from canvas (ticket 403): the surface shows the eyedropper while it is on. */
const colorPick = useColorPick()

/** The Project as drawn: with the Frame as it looks mid-drag while a gesture is going on, which is committed only on
 * release. */
/** What the tool in hand and the modes on let the Drawing surface do (ticket 0619): one value, worked out once. */
const surfaceTools = computed(() =>
  toolCapabilities(activeTool.value, { picking: colorPick?.picking.value, spaceHeld: spaceHeld.value, settingFrame: settingFrame.value, pasteArmed: pasteProjectionActive.value }),
)

const shownProject = frameDraftProject

/** The Frame's size tooltip while it is set: beads and measured size, "13×13 ≈ 2.1 × 2.1 cm" (Frame card). */
const frameTooltip = computed(() => {
  const project = shownProject.value
  const frame = project?.frame
  if (!project || !frame) return ''
  const bead = resolveProjectBead(project)
  const estimate = bead ? formatSizeMm(estimatedSizeMm(frame, bead), { mm: t.value.form.unitMm, cm: t.value.form.unitCm }, locale.value) : ''
  return fillBlanks(t.value.frame.sizeTooltip, { columns: frame.columns, rows: frame.rows, estimate })
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
  return fillBlanks(t.value.frame.sizeTooltip, { columns: current.columns, rows: current.rows, estimate })
})

/** Where the Selection is on the surface and whether a pointer is down on it: the bar anchors to the one and steps
 * aside for the other (ticket 415). */
const selectionAnchor = ref<SelectionAnchor>()
/** Where the Frame is on the canvas box: the Move handle and the edit pencil follow it (ticket 473). */
const frameAnchor = ref<FrameAnchor>()
/** The surface, so a press on the Move handle's button is handed to it as a press on the canvas (ticket 455). */
const surfaceRef = ref<InstanceType<typeof ProjectSurface>>()
const surfacePressing = ref(false)

/** The Canvas color (ticket 252) as the drawing area's fill, and the technique word's own color where the background
 * needs one. */
const canvasBackground = useCanvasBackground()

/** The drawing area, also tracked here for the layer that carries the Selection bar over it. */
const drawingEl = ref<HTMLElement>()
function bindDrawing(el: unknown) {
  bindCanvasArea(el)
  drawingEl.value = el instanceof HTMLElement ? el : undefined
}
const drawingSize = useElementSize(drawingEl)
const selectionLayerStyle = computed(() => {
  const el = drawingEl.value
  if (!el) return undefined
  return { left: `${el.offsetLeft}px`, top: `${el.offsetTop}px`, width: `${drawingSize.width.value}px`, height: `${drawingSize.height.value}px` }
})
const drawingStyle = computed(() => {
  const color = canvasBackground.background.value?.color
  if (!color) return undefined
  return { '--canvas-bg': color }
})
</script>

<template>
  <!--
    The canvas box (ticket 141): all the width right of the left column and the full height of the main area. The
    page never scrolls; the Project scrolls inside the box.
  -->
  <main class="app-shell__canvas-column">
    <div
      class="app-shell__canvas"
      :class="{ 'app-shell__canvas--pan': spaceHeld, 'app-shell__canvas--panning': spacePanning}"
      data-testid="app-canvas"
    >
      <!--
        The canvas box's header strip (ticket 143, ADR 0046, 0073): Menu, the Brand and the canvas controls (Rulers, Undo,
        Redo, zoom, Fit). The strip never scrolls, zooms or rotates with the Project below it.
      -->
      <CanvasStrip
        class="app-shell__canvas-strip"
        :project="activeProject"
        :rulers="showRulers"
        :frame-open="framePanelOpen"
        :can-undo="canUndo"
        :can-redo="canRedo"
        :open-panel="openPanel"
        :zoom-percent="stripZoomPercent"
        @select-panel="onSelectPanel"
        @toggle-frame="onToggleFramePanel"
        @rotate-canvas="onRotateCanvas"
        @toggle-rulers="toggleRulers"
        @undo="onUndo"
        @redo="onRedo"
        @zoom-in="zoomIn"
        @zoom-out="zoomOut"
        @reset="resetZoom"
      />

      <!-- The drawing area: the rest of the box, measured for the fit zoom (it doesn't grow with the Project). -->
      <div :ref="bindDrawing" class="app-shell__drawing" :style="drawingStyle" data-testid="app-drawing-area">

        <!-- How to move the canvas and its shortcuts: top-centre, only while the Project has no beads,
          not on a phone (CanvasHint card). -->
        <CanvasHint v-if="activeProject && !hasProjectBeads(activeProject)" class="app-shell__canvas-hint" />

        <div class="app-shell__canvas-row">
          <div :ref="bindCanvasScroll" class="app-shell__canvas-scroll" :class="{ 'app-shell__canvas-scroll--empty': !activeProject }">
            <ProjectSurface
              v-if="activeProject"
              ref="surfaceRef"
              :project="shownProject!"
              :tools="surfaceTools"
              :frame-tooltip="frameTooltip"
              :zoom="zoom"
              :scroll="scroll"
              :show-rulers="showRulers"
              :stroking="stroking"
              :row-marks="rowHighlight"
              :input-mode="surfaceInputMode"
              :handedness="handedness"
              :preview-cells="previewCells"
              :preview-color="previewColor"
              :selection="selection"
              :selection-refusals="selectionRefusals"
              :label="projectLabel"
              @cell-primary-down="onCellPrimaryDown"
              @cell-primary-move="onCellPrimaryMove"
              @cells-primary-move="onCellsPrimaryMove"
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
                <ProjectImport compact :projects="projects" testid-prefix="phone-bar-" @import="onImportProjects" />
              </div>
            </EmptyCanvas>
          </div>

        </div>

        <!-- The Tool pill (ticket 439, ADR 0046): floats over the drawing, outside the zoom transform. -->
        <ToolPill
          v-if="activeProject"
          v-model:position="toolPillPosition"
          v-model:popover-open="toolPillPopoverOpen"
          :active-tool="activeTool"
          :has-clipboard="hasClipboard()"
          :paste-armed="pasteProjectionActive"
          :color-hex="colorHex"
          :color-name="colorLabel"
          :recents-in-pill="recentsInPill"
          :selected-color-id="selectedColorId"
          :custom-color="customColor"
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

      <!--
        Progress bar (ticket 144): along the canvas box's bottom edge, always there while a Project is open, since its
        first control is Remove frame (ticket 426).
      -->
      <ProgressBar
        v-if="activeProject"
        :project="activeProject"
        :row-highlight="rowHighlight"
        @move-row="onMoveRow"
        @reset-progress="onResetProgress"
        @toggle-row-direction="onToggleRowDirection"
        @toggle-row-highlight="toggleRowHighlight"
        @fit-frame="onFitFrame"
      />

      <!--
        The Selection bar comes last in the page order (ADR 0075: Tab reaches the Progress bar first), so it sits in a
        layer laid over the drawing area, which keeps the bar's coordinates the drawing area's own. The Frame's controls
        ride in it after the bar: the order of ADR 0075 has no place for them.
      -->
      <div v-if="activeProject" class="app-shell__selection-layer" :style="selectionLayerStyle" data-testid="selection-layer">
        <!--
          The Selection bar (tickets 168, 415; ContextBar card): anchored above the Selection's top edge and clamped
          inside the canvas box, clear of the Tool pill; Select all is its first item.
        -->
        <ContextBar
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
          :editing="frameHandlesOn"
          :pressing="surfacePressing"
          :selection="selectionAnchor?.box"
          :pill="pillRect"
          @toggle="onEditFrame"
          @remove="onRemoveFrame"
          @move-press="surfaceRef?.pressMoveHandle($event)"
          @key="onFrameKey"
        />
      </div>
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
  border-radius: var(--canvas-box-radius);
}

/* The drawing area (ticket 143): the box under the strip, sized for the fit zoom, so it takes a share (flex-basis 0),
 * never the Project's size. Its children are positioned, so they stack in order. */
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
.app-shell__drawing > :not(.app-shell__canvas-hint):not(.context-bar):not(.frame-chrome):not(.tool-pill-layer) {
  position: relative;
}

/* The Selection bar's layer: the drawing area's box, taking no pointer itself. Its overflow clips like the drawing
 * area's. */
.app-shell__selection-layer {
  position: absolute;
  overflow: hidden;
  pointer-events: none;
}

.app-shell__selection-layer > .context-bar {
  pointer-events: auto;
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

/* Fills the drawing area: the Canvas's surface is laid over all of it. */
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
