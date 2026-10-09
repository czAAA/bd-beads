<script setup lang="ts">
import { computed, ref } from 'vue'
import CanvasBackdrop from './CanvasBackdrop.vue'
import CanvasHint from './CanvasHint.vue'
import CanvasStrip from './CanvasStrip.vue'
import ContextBar from '../tools/ContextBar.vue'
import ConvertImageFrame from '../import/ConvertImageFrame.vue'
import EmptyCanvas from './EmptyCanvas.vue'
import ProjectSurface from './ProjectSurface.vue'
import ProgressBar from '../ui/ProgressBar.vue'
import ToastRegion from '../ui/ToastRegion.vue'
import ZoomPill from './ZoomPill.vue'
import { useAppShell } from '../../composables/shell/useAppShell'
import { useCanvasBackground } from '../../theme/useCanvasBackground'
import type { Technique } from '../../domain/grid'
import { resolveProjectBead } from '../../domain/project'
import { CONVERT_MAX_ZOOM, CONVERT_MIN_ZOOM } from '../../domain/imageFraming'
import { estimatedSizeMm, formatSizeMm } from '../../domain/projectSize'

const {
  t,
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
  onSelectLine,
  activeTool,
  showRulers,
  toggleRulers,
  showProgressBar,
  toggleProgressBar,
  zoomPillPlacement,
  setZoomPillPlacement,
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
  zoomPercent,
  stripSize,
  stripZoomPercent,
  spaceHeld,
  spacePanning,
  previewColor,
  tour,
  selection,
  pasteProjectionActive,
  onCopy,
  backOutOfSelect,
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
  keyboardOnProject,
  cursorShown,
  onProjectKeyboardFocus,
  onProjectKey,
  onProjectKeyUp,
  onRotate,
  onToggleRowProgress,
  onToggleRowDirection,
  onMoveRow,
  canRemoveSelectedLine,
  onRemoveSelectedLine,
  locale,
  settingFrame,
  surfaceInputMode,
  settledProject,
  onStartSetFrame,
  onDoneSetFrame,
  onFitFrame,
  onRemoveFrame,
  frameDraft,
  onFramePress,
  onFrameDrag,
  onFrameRelease,
  onFrameCancel,
} = useAppShell()

/** The Project as drawn: with the Frame as it looks mid-drag while a gesture is going on, which is committed only on release. */
const shownProject = computed(() => (activeProject.value && frameDraft.value ? { ...activeProject.value, frame: frameDraft.value } : activeProject.value))

/** The Frame's size tooltip while it is set: beads and measured size, "13×13 · 2.1 × 2.1 cm" (Frame card). */
const frameTooltip = computed(() => {
  const project = shownProject.value
  const frame = project?.frame
  if (!project || !frame) return ''
  const bead = resolveProjectBead(project)
  const estimate = bead ? formatSizeMm(estimatedSizeMm(frame, bead), { mm: t.value.form.unitMm, cm: t.value.form.unitCm }, locale.value) : ''
  return t.value.frame.sizeTooltip.replace('{columns}', String(frame.columns)).replace('{rows}', String(frame.rows)).replace('{estimate}', estimate)
})

/** Where the framing step puts its controls: the canvas box's bottom, in the Progress bar's place (ticket 150). */
const framingControlsEl = ref<HTMLElement>()

/** The Canvas color (ticket 252) as the drawing area's fill, and the technique word's own color where the background needs one. */
const canvasBackground = useCanvasBackground()
const drawingStyle = computed(() => {
  const color = canvasBackground.background.value?.color
  if (!color) return undefined
  const word = canvasBackground.wordColor.value
  return { '--canvas-bg': color, ...(word ? { '--word': word } : {}) }
})

/** The Technique's name, the background word behind the board (ticket 143). */
function techniqueWord(technique: Technique): string {
  const form = t.value.form
  return technique === 'peyote' ? form.techniquePeyote : technique === 'brick' ? form.techniqueBrick : form.techniqueLoom
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
      :class="{ 'app-shell__canvas--pan': spaceHeld, 'app-shell__canvas--panning': spacePanning, 'app-shell__canvas--no-progress': !showProgressBar && !framing }"
      data-testid="app-canvas"
    >
      <!--
        The canvas box's header strip (ticket 143): what is on the board and its zoom. While a picture is being
        framed (ticket 58) its zoom is the framing step's own, over its own 100–800% range (domain/imageFraming),
        since that zoom moves the picture under a fixed frame rather than scaling the Project on screen. The strip
        never scrolls, zooms or rotates with the Project below it.
      -->
      <CanvasStrip
        class="app-shell__canvas-strip"
        :project="settledProject"
        :size="stripSize"
        :zoom-percent="stripZoomPercent"
        :zoom-min-percent="framing ? CONVERT_MIN_ZOOM * 100 : undefined"
        :zoom-max-percent="framing ? CONVERT_MAX_ZOOM * 100 : undefined"
        :hint="keyboardOnProject ? (settingFrame ? t.frame.keyboardHint : t.a11y.keyboardHint) : undefined"
        :title="framing ? t.convertImage.heading : undefined"
        :rulers="activeProject && !framing ? showRulers : undefined"
        :setting-frame="settingFrame"
        :canvas-color="activeProject && !framing"
        @zoom-in="framing ? convertZoomIn() : zoomIn()"
        @zoom-out="framing ? convertZoomOut() : zoomOut()"
        @reset="framing ? convertResetZoom() : resetZoom()"
        @toggle-rulers="toggleRulers"
      />

      <!-- The drawing area: the rest of the box, measured for the fit zoom (it doesn't grow with the Project). -->
      <div :ref="bindCanvasArea" class="app-shell__drawing" :style="drawingStyle" data-testid="app-drawing-area">
        <CanvasBackdrop v-if="activeProject && !framing" :word="techniqueWord(activeProject.technique)" />

        <!-- How to move the canvas and its shortcuts: at 1024px and up (CanvasHint card). -->
        <CanvasHint v-if="activeProject && !framing" class="app-shell__canvas-hint" />

        <!-- The phone tier's own zoom (ticket 79; ZoomPill card): no canvas strip there, so this floats over the Project's bottom-right corner instead. -->
        <ZoomPill
          v-if="activeProject && !framing"
          class="app-shell__zoom-pill"
          :placement="zoomPillPlacement"
          :zoom-percent="zoomPercent"
          :rulers="showRulers"
          :progress-bar="showProgressBar"
          :can-undo="canUndo"
          :can-redo="canRedo"
          @toggle-rulers="toggleRulers"
          @toggle-progress-bar="toggleProgressBar"
          @undo="onUndo"
          @redo="onRedo"
          @zoom-in="zoomIn"
          @zoom-out="zoomOut"
          @reset="resetZoom"
          @move="setZoomPillPlacement"
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
              :project="shownProject!"
              :setting-frame="settingFrame"
              :frame-tooltip="frameTooltip"
              :zoom="zoom"
              :scroll="scroll"
              :show-rulers="showRulers"
              :moving="activeTool === 'hand'"
              :input-mode="surfaceInputMode"
              :blocks-margin="activeTool === 'paint' || activeTool === 'fill' || pasteProjectionActive"
              :preview-cells="previewCells"
              :preview-color="previewColor"
              :selection="selection"
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
              @select-line="onSelectLine"
              @frame-press="onFramePress"
              @frame-drag="onFrameDrag"
              @frame-release="onFrameRelease"
              @frame-cancel="onFrameCancel"
            />
            <EmptyCanvas v-else />
          </div>

        </div>
      </div>

      <!-- Short-lived results (ticket 76): bottom-right of the canvas box, above the Progress bar. -->
      <ToastRegion
        :class="{ 'app-shell__toasts--above-progress': activeProject && !framing }"
        :toasts="toasts"
        @dismiss="dismissToast"
      />

      <!-- The framing step's controls, in the Progress bar's place (ticket 150; ConvertImage card). -->
      <div v-if="framing" ref="framingControlsEl" data-testid="framing-controls" />

      <!--
        The Selection context bar (ticket 168; ContextBar card): floats above the Progress bar under 1024px,
        offering what a Selection can do without a right-click. Absent at 1024px and
        up, where the Toolbox's own Remove line/Copy already cover this.
      -->
      <ContextBar
        v-if="activeProject && !framing"
        class="app-shell__context-bar"
        :class="{ 'app-shell__context-bar--frame': settingFrame, [`app-shell__context-bar--pill-${zoomPillPlacement.y >= 0.5 ? 'bottom' : 'top'}`]: true }"
        :selection-size="selection ? { columns: selection.columns, rows: selection.rows } : undefined"
        :paste-armed="pasteProjectionActive"
        :project="activeProject"
        :can-remove-line="canRemoveSelectedLine"
        :setting-frame="settingFrame"
        :frame-summary="frameTooltip"
        @fit-frame="onFitFrame"
        @remove-frame="onRemoveFrame"
        @done-frame="onDoneSetFrame"
        @copy="onCopy"
        @rotate="onRotate"
        @remove-line="onRemoveSelectedLine"
        @dismiss="backOutOfSelect"
      />

      <!--
        Progress bar (ticket 144): along the canvas box's bottom edge, always there while a Project is open (not
        while a picture is being framed), since its first control is the switch that turns Row progress on.
      -->
      <ProgressBar
        v-if="activeProject && !framing"
        :class="{ 'app-shell__progress--hidden': !showProgressBar }"
        :project="activeProject"
        @move-row="onMoveRow"
        @toggle-row-progress="onToggleRowProgress"
        @toggle-row-direction="onToggleRowDirection"
        @set-frame="onStartSetFrame"
      />
    </div>
  </main>
</template>

<style scoped>
/* Toasts sit 16px above the Progress bar while it shows. */
.app-shell__toasts--above-progress {
  --toast-bottom: calc(var(--progress-height) + var(--space-16));
}

/*
 * The Selection context bar (ticket 168; ContextBar card): floats 10px from the canvas box's own edges, just above
 * the Progress bar, under 1024px only -- the Toolbox's own Remove line/Copy links cover this at 1024px and
 * up, where there's no need for it to float over the Project.
 */
.app-shell__context-bar {
  display: none;
}

@media (max-width: 1023px) {
  .app-shell__context-bar {
    position: absolute;
    right: var(--space-10);
    bottom: calc(var(--progress-height) + var(--space-10));
    left: var(--space-10);
    z-index: var(--z-context-bar);
    display: flex;
  }

  /*
   * The Frame bar (ticket 295; Frame bar card): while the Frame is being set, the same bar floats at the top-centre of
   * the canvas box over the beads instead of above the Progress bar, so it never takes a row and never reaches the Dock.
   */
  .app-shell__context-bar--frame {
    top: var(--space-10);
    right: auto;
    bottom: auto;
    left: 50%;
    max-width: calc(100% - 2 * var(--space-10));
    transform: translateX(-50%);
  }

  /*
   * The bars keep clear of the Zoom pill (ticket 297): the Selection bar rises above a pill resting in the lower half, and the
   * Frame bar drops below one resting in the upper half. The pill's own height is its 36px buttons, 4px padding and 1px border.
   */
  .app-shell__context-bar--pill-bottom:not(.app-shell__context-bar--frame) {
    bottom: calc(var(--progress-height) + var(--space-16) + env(safe-area-inset-bottom) + var(--zoom-pill-button) + 2 * var(--space-4) + 2px + var(--space-10));
  }

  .app-shell__context-bar--frame.app-shell__context-bar--pill-top {
    top: calc(var(--space-16) + var(--zoom-pill-button) + 2 * var(--space-4) + 2px + var(--space-10));
  }
}

.app-shell__zoom-pill {
  display: none;
}

/* The Zoom pill's Row progress toggle (ticket 296) hides the bar under 1024px only; the Zoom pill that holds the toggle is not there above. */
@media (max-width: 1023px) {
  .app-shell__progress--hidden {
    display: none;
  }

  /* With the bar gone, the toasts and the Selection bar sit where it was. */
  .app-shell__canvas--no-progress {
    --progress-height: 0px;
  }
}

@media (max-width: 1023px) {
  .app-shell__zoom-pill {
    position: absolute;
    z-index: var(--z-canvas-overlay);
    display: inline-flex;
    /* Never wider than the box it floats in, so a narrow phone can't push it out (ticket 297). */
    max-width: calc(100% - 2 * var(--space-16));
  }

  /*
   * The pill rests anywhere in the drawing area (tickets 297, 321), a --space-16 gap from its edges (ZOOM_PILL_INSET_PX).
   * Its placement is the share of the room it has to move in, so it is fully visible at any box size: `left` / `top`
   * put its own top-left corner that share of the way along, and `translate` takes back that share of its own size.
   */
  .app-shell__zoom-pill {
    left: calc(var(--space-16) + var(--zoom-pill-x) * (100% - 2 * var(--space-16)));
    top: calc(var(--space-16) + var(--zoom-pill-y) * (100% - 2 * var(--space-16)));
    translate: calc(var(--zoom-pill-x) * -100%) calc(var(--zoom-pill-y) * -100%);
  }
}

/* The canvas box's cell: the rest of the width, the full height. */
.app-shell__canvas-column {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

/*
 * The canvas box (ticket 141): all the width right of the left column and the full height of the body, on the same
 * dot-grid notepad texture as the Toolbox until ticket 143 restyles it. Its rows stack top to bottom (the zoom cluster,
 * a horizontal Progress bar, then the Project), and the Project's own row takes the rest of the height.
 *
 * The canvas is a surface that fills .app-shell__canvas-scroll edge to edge and moves under its own view (zoom and
 * scroll, ADR 0026), so nothing scrolls natively: the page never does either.
 *
 * The zoom cluster is a sibling of the scroller, not a descendant, so it never scrolls, zooms or rotates along with the
 * Project below it.
 */
.app-shell__canvas {
  position: relative;
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  background: var(--box);
  border: 1px solid var(--box-line);
  border-radius: var(--radius-lg);
  box-shadow: var(--elevation-2);
}

/*
 * The drawing area (ticket 143): the rest of the canvas box under the strip. Its size is measured for the fit zoom,
 * so it takes a share of the box (flex-basis 0), never the Project's size. The background highlight fills it behind
 * everything; what follows it is positioned too, so it paints over the highlight.
 */
.app-shell__drawing {
  position: relative;
  background: var(--canvas-bg, transparent);
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

/*
 * ZoomPill excluded (ticket 188): it already sets its own `position: absolute` to float over the phone's Project
 * (below), and this broader rule's `relative` used to outrank that in specificity -- `.app-shell__drawing > :not(x)`
 * beats a plain `.app-shell__zoom-pill`, stretching the pill across the top of the canvas box instead of floating it.
 * CanvasHint is excluded for the same reason: it floats over the bottom-left corner.
 */
.app-shell__drawing > :not(.canvas-backdrop):not(.app-shell__zoom-pill):not(.app-shell__canvas-hint) {
  position: relative;
}

/*
 * Space+drag panning (ticket 95): a grab cursor while Space is held, switching to grabbing once the drag actually starts
 * (BeadHover card). It wins over the board's own crosshair.
 */
.app-shell__canvas--pan,
.app-shell__canvas--pan :deep(*) {
  cursor: grab;
}

.app-shell__canvas--panning,
.app-shell__canvas--panning :deep(*) {
  cursor: grabbing;
}

/*
 * The row takes the whole drawing area; the surface inside it fills it, so the open canvas has no box of its own to centre.
 */
.app-shell__canvas-row {
  position: relative;
  flex: 1 1 auto;
  align-self: stretch;
  min-height: 0;
}

/* Fills the drawing area: the open canvas's surface (and Convert image's framing step) is laid over all of it. */
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

/* The phone layout has no wheel and no keyboard to hint at (CanvasHint card). */
@media (max-width: 1023px) {
  .app-shell__canvas-hint {
    display: none;
  }
}

/* No canvas header strip under 1024px (ticket 295, responsive.md): ZoomPill floats over the Project instead, and the strip's Project info lives in the Project sheet. */
@media (max-width: 1023px) {
  .app-shell__canvas-strip {
    display: none;
  }
}
</style>
