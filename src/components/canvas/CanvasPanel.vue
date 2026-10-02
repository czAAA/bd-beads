<script setup lang="ts">
import { ref } from 'vue'
import CanvasBackdrop from './CanvasBackdrop.vue'
import CanvasStrip from './CanvasStrip.vue'
import ContextBar from '../tools/ContextBar.vue'
import ConvertImageFrame from '../import/ConvertImageFrame.vue'
import EmptyCanvas from './EmptyCanvas.vue'
import PatternCanvas from './PatternCanvas.vue'
import ProgressBar from '../ui/ProgressBar.vue'
import ToastRegion from '../ui/ToastRegion.vue'
import ZoomPill from './ZoomPill.vue'
import { useAppShell } from '../../composables/shell/useAppShell'
import type { Technique } from '../../domain/grid'

const {
  t,
  activePattern,
  patternLabel,
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
  onSelectLine,
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
  keyboardOnPattern,
  onPatternKeyboardFocus,
  onPatternKey,
  onPatternKeyUp,
  onToggleRotate,
  onToggleRowProgress,
  onToggleRowDirection,
  onMoveRow,
  canRemoveSelectedLine,
  onRemoveSelectedLine,
} = useAppShell()

/** Where the framing step puts its controls: the canvas box's bottom, in the Progress bar's place (ticket 150). */
const framingControlsEl = ref<HTMLElement>()

/** The Technique's name, the background word behind the board (ticket 143). */
function techniqueWord(technique: Technique): string {
  const form = t.value.form
  return technique === 'peyote' ? form.techniquePeyote : technique === 'brick' ? form.techniqueBrick : form.techniqueLoom
}
</script>

<template>
  <!--
    The canvas box (ticket 141): all the width right of the left column and the full height of the main area. The
    page never scrolls; the Pattern scrolls inside the box.
  -->
  <main class="app-shell__canvas-column">
    <div
      class="app-shell__canvas"
      :class="{ 'app-shell__canvas--pan': spaceHeld, 'app-shell__canvas--panning': spacePanning }"
      data-testid="app-canvas"
    >
      <!--
        The canvas box's header strip (ticket 143): what is on the board and its zoom. While a picture is being
        framed (ticket 58) its zoom is the framing step's own, over its own 100–800% range (domain/imageFraming),
        since that zoom moves the picture under a fixed frame rather than scaling the Pattern on screen. The strip
        never scrolls, zooms or rotates with the Pattern below it.
      -->
      <CanvasStrip
        class="app-shell__canvas-strip"
        :size="stripSize"
        :zoom-percent="stripZoomPercent"
        :hint="keyboardOnPattern ? t.a11y.keyboardHint : undefined"
        :title="framing ? t.convertImage.heading : undefined"
        @zoom-in="framing ? convertZoomIn() : zoomIn()"
        @zoom-out="framing ? convertZoomOut() : zoomOut()"
        @reset="framing ? convertResetZoom() : resetZoom()"
      />

      <!-- The drawing area: the rest of the box, measured for the fit zoom (it doesn't grow with the Pattern). -->
      <div :ref="bindCanvasArea" class="app-shell__drawing" data-testid="app-drawing-area">
        <CanvasBackdrop v-if="activePattern && !framing" :word="techniqueWord(activePattern.technique)" />

        <!-- The phone tier's own zoom (ticket 79; ZoomPill card): no canvas strip there, so this floats over the Pattern's bottom-right corner instead. -->
        <ZoomPill
          v-if="activePattern && !framing"
          class="app-shell__zoom-pill"
          :zoom-percent="zoomPercent"
          @zoom-in="zoomIn"
          @zoom-out="zoomOut"
          @reset="resetZoom"
        />

        <div class="app-shell__canvas-row">
          <div :ref="bindCanvasScroll" class="app-shell__canvas-scroll" data-tour="canvas" :class="{ 'app-shell__canvas-scroll--empty': !activePattern && !framing }">
            <!--
              Convert image's framing step takes this panel over (ticket 58, ADR 0010), in the slot the "No Pattern
              open yet" placeholder otherwise occupies — and ahead of the open Pattern too, since framing can be
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
            <PatternCanvas
              v-else-if="activePattern"
              :pattern="activePattern"
              :zoom="zoom"
              :preview-cells="previewCells"
              :preview-color="previewColor"
              :selection="selection"
              :mirror-axis-counts="previewedMirrorAxisCounts"
              :dimmed-cells="mirrorCurrentDimmedCells"
              :cursor="keyboardOnPattern ? beadCursor : undefined"
              :tour-marks="tour.marks.value"
              :label="patternLabel"
              @cursor-key="onPatternKey"
              @keyup="onPatternKeyUp"
              @keyboard-focus="onPatternKeyboardFocus"
              @cell-primary-down="onCellPrimaryDown"
              @cell-primary-move="onCellPrimaryMove"
              @cell-secondary-down="onCellSecondaryDown"
              @cell-secondary-move="onCellSecondaryMove"
              @cell-hover="onCellHover"
              @hover-end="onHoverEnd"
              @select-line="onSelectLine"
            />
            <EmptyCanvas v-else />
          </div>

        </div>
      </div>

      <!-- Short-lived results (ticket 76): bottom-right of the canvas box, above the Progress bar. -->
      <ToastRegion
        :class="{ 'app-shell__toasts--above-progress': activePattern && !framing }"
        :toasts="toasts"
        @dismiss="dismissToast"
      />

      <!-- The framing step's controls, in the Progress bar's place (ticket 150; ConvertImage card). -->
      <div v-if="framing" ref="framingControlsEl" data-testid="framing-controls" />

      <!--
        The Selection context bar (ticket 168; ContextBar card): floats above the Progress bar on phone and iPad
        mini, offering what a Selection can do without needing the Drawer or a right-click. Absent at 1024px and
        up, where the Toolbox's own Remove line/Copy already cover this.
      -->
      <ContextBar
        v-if="activePattern && !framing"
        class="app-shell__context-bar"
        :selection-size="selection ? { columns: selection.columns, rows: selection.rows } : undefined"
        :paste-armed="pasteProjectionActive"
        :can-remove-line="canRemoveSelectedLine"
        @copy="onCopy"
        @rotate="onToggleRotate"
        @remove-line="onRemoveSelectedLine"
        @dismiss="backOutOfSelect"
      />

      <!--
        Progress bar (ticket 144): along the canvas box's bottom edge, always there while a Pattern is open (not
        while a picture is being framed), since its first control is the switch that turns Row progress on.
      -->
      <ProgressBar
        v-if="activePattern && !framing"
        :pattern="activePattern"
        @move-row="onMoveRow"
        @toggle-row-progress="onToggleRowProgress"
        @toggle-row-direction="onToggleRowDirection"
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
 * the Progress bar, on phone and iPad mini only -- the Toolbox's own Remove line/Copy links cover this at 1024px and
 * up, where there's no need for it to float over the Pattern.
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
}

.app-shell__zoom-pill {
  display: none;
}

@media (max-width: 743px) {
  .app-shell__zoom-pill {
    position: absolute;
    right: var(--space-16);
    /* Clears the home indicator / gesture bar (responsive.md "Screen edges"), the same as the Dock and BottomToolbar. */
    bottom: calc(var(--space-16) + env(safe-area-inset-bottom));
    z-index: var(--z-canvas-overlay);
    display: inline-flex;
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
 * a horizontal Progress bar, then the Pattern), and the Pattern's own row takes the rest of the height.
 *
 * The Pattern scrolls inside .app-shell__canvas-scroll, both ways: the page never does. The Pattern's own box
 * (PatternCanvas) sizes itself to the open Pattern's shape rather than stretching, and centers itself with margin:
 * auto — block layout, not flex, inside the scroller (ticket 28): a flex container with justify-content: center and
 * overflow: auto has a long-standing browser bug where an overflowing child's start edge can't be scrolled to.
 *
 * The zoom cluster is a sibling of the scroller, not a descendant, so it never scrolls, zooms or rotates along with the
 * Pattern below it.
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
 * so it takes a share of the box (flex-basis 0), never the Pattern's size. The background highlight fills it behind
 * everything; what follows it is positioned too, so it paints over the highlight.
 */
.app-shell__drawing {
  position: relative;
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

/*
 * ZoomPill excluded (ticket 188): it already sets its own `position: absolute` to float over the phone's Pattern
 * (below), and this broader rule's `relative` used to outrank that in specificity -- `.app-shell__drawing > :not(x)`
 * beats a plain `.app-shell__zoom-pill`, stretching the pill across the top of the canvas box instead of floating it.
 */
.app-shell__drawing > :not(.canvas-backdrop):not(.app-shell__zoom-pill) {
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
 * Centers the Pattern's scroll box in the drawing area both ways while it is smaller than the area; once it is bigger,
 * the scroll box is capped at the area's size (max-height below; min-width: 0 across) and scrolls instead.
 */
.app-shell__canvas-row {
  display: flex;
  flex: 1 1 auto;
  justify-content: center;
  align-items: center;
  min-height: 0;
}

.app-shell__canvas-scroll {
  box-sizing: border-box;
  min-width: 0;
  max-height: 100%;
  overflow: auto;
}

/* When no Pattern is open the scroll panel stretches to fill the whole row so the dot board covers it edge to edge. */
.app-shell__canvas-scroll--empty {
  align-self: stretch;
  width: 100%;
  overflow: hidden;
}

/* No canvas strip on phone (responsive.md): ZoomPill floats over the Pattern instead. */
@media (max-width: 743px) {
  .app-shell__canvas-strip {
    display: none;
  }
}
</style>
