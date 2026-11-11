<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { useElementSize } from '../../composables/ui/useElementSize'
import CanvasHint from './CanvasHint.vue'
import FirstRunHints from './FirstRunHints.vue'
import CanvasStrip from './CanvasStrip.vue'
import ContextBar, { type MirrorBarState } from '../tools/ContextBar.vue'
import AppButton from '../ui/AppButton.vue'
import ProjectImport from '../import/ProjectImport.vue'
import ConvertImageWizard from '../import/ConvertImageWizard.vue'
import ConvertStepBar from '../import/ConvertStepBar.vue'
import ToolPill from '../tools/ToolPill.vue'
import MarginSheet from './MarginSheet.vue'
import EmptyCanvas from './EmptyCanvas.vue'
import ProjectSurface from './ProjectSurface.vue'
import ReferenceAdjust from './ReferenceAdjust.vue'
import ReferenceAdjustBar from './ReferenceAdjustBar.vue'
import ProgressBar from './ProgressBar.vue'
import SchemaTags from './SchemaTags.vue'
import ToastRegion from '../ui/ToastRegion.vue'
import SaveReminder from './SaveReminder.vue'
import { useCanvasContext } from '../../composables/shell/useAppShell'
import { useColorPick, usePalette } from '../../composables/tools/usePalette'
import { colorName } from '../../i18n/colorName'
import { controlAction } from '../../composables/shell/controlRegistry'
import type { FrameAnchor, SelectionAnchor } from '../../composables/tools/selectionBarPlacement'
import type { SchemaAnchors } from '../../composables/canvas/schemaTagPlacement'
import { useCanvasBackground } from '../../theme/useCanvasBackground'
import type { PillRect } from '../../domain/toolPill'
import { hasGuides, selectionLayer } from '../../domain/selection'
import { toolCapabilities } from '../../domain/tool'
import { hasProjectBeads } from '../../domain/layerBeads'
import { beadOfLayer, frameOf, layerOf } from '../../domain/layerRecord'
import { canvasWeave, layerWeave } from '../../domain/layerWeave'
import { cellSizePx } from '../../rendering/cellSize'
import type { SurfaceView } from '../../rendering/surfaceView'
import { estimatedSizeMm, formatSizeMm } from '../../domain/projectSize'
import { seenSize } from '../../domain/frameOrientation'
import { fillBlanks } from '../../domain/fillBlanks'

const {
  t,
  page,
  convertSession,
  readClipboardImage,
  onCloseConvertImage,
  onCreateConvertImage,
  openPanel,
  onSelectPanel,
  projects,
  onImportProjects,
  openMenuOnForm,
  deletedProjectName,
  openMenuOnSavedProjects,
  activeProject,
  projectLabel,
  toasts,
  dismissToast,
  saveRing,
  onSaveProjectFile,
  onHoldSaveRing,
  onSurfaceDrawn,
  bindCanvasArea,
  bindCanvasScroll,
  zoom,
  scroll,
  canvasOrientation,
  twistPhase,
  selectionRefusals,
  fillRefusals,
  activeTool,
  showRulers,
  stroking,
  toggleRulers,
  referenceImage,
  rowHighlight,
  toggleRowHighlight,
  rowPress,
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
  onFrameSchema,
  canNamePiece,
  hasPaintColor,
  onNamePiece,
  onRenameSchema,
  previewCells,
  previewStamp,
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
  mirrorSetting,
  mirrorOn,
  mirrorOnFrame,
  mirrorRect,
  mirrorFit,
  mirrorShape,
  mirrorMarking,
  mirrorAdjusting,
  onMirrorChange,
  onCloseMirror,
  onMirrorTile,
  onMirrorWholeFrame,
  onMirrorSelection,
  selectedColorHex,
  selectedColorId,
  customColor,
  onSelectTool,
  onSelectColor,
  onSelectCustomColor,
  onToggleRowDirection,
  onMoveRow,
  onGoToRow,
  canRemoveSelectedLine,
  onRemoveSelectedLine,
  locale,
  settingFrame,
  framePanelOpen,
  onToggleFramePanel,
  surfaceInputMode,
  handedness,
  onFitAndExport,
  onEditFrame,
  onFrameKey,
  onRemoveFrame,
  onResetProgress,
  onRotateFrame,
  onRenameFrame,
  onSetFrameTechnique,
  onSetFrameSetting,
  onSaveMakerName,
  onSetLetters,
  exportOpener,
  onOpenExport,
  frameDraftProject,
  onFramePress,
  onFrameDrag,
  onFrameRelease,
  onFrameCancel,
  onSelectionPress,
  onSelectionDrag,
  onAreaKey,
  onSelectionRelease,
  onSelectionResume,
  demo,
  demoExpand,
  onToggleDemoExpand,
  surfaceProbe,
} = useCanvasContext()

const newProjectAction = controlAction('new-project')

/** The editor is the page unless Convert image fills the box (ADR 0085): the editor stays mounted behind it, so leaving
 * lands on the Project as it was. */
const onEditor = computed(() => page.value === 'editor')

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
  // While the reference image is adjusted the tools rest (ticket 0790): a drag beside it moves the view.
  referenceImage.adjusting.value
    ? toolCapabilities('hand')
    : toolCapabilities(activeTool.value, { picking: colorPick?.picking.value, spaceHeld: spaceHeld.value, settingFrame: settingFrame.value, pasteArmed: pasteProjectionActive.value, markingArea: mirrorMarking.value }),
)

/** The strip's Reference image button (ticket 0790): none yet, shown or hidden. */
const referenceState = computed(() => {
  const image = referenceImage.image.value
  return image ? (image.shown ? 'shown' : 'hidden') : 'none'
})
/** The surface's view, which the picture's handles are laid through. */
const surfaceView = shallowRef<SurfaceView>()
/** What the handles work, whenever the picture is drawn (ticket 0799) and in Adjust: the picture as it is saved, its
 * shape and limits, and one bead's width. */
const handled = computed(() => {
  const image = referenceImage.image.value
  const limits = referenceImage.limits.value
  const project = activeProject.value
  const standing = referenceImage.adjusting.value || (onEditor.value && referenceImage.drawn.value !== undefined)
  if (!standing || !image || !limits || !project || !surfaceView.value) return undefined
  const weave = canvasWeave(project)
  return { image, limits, aspect: image.picture.height / image.picture.width, bead: cellSizePx(weave.technique, weave.cell).width, view: surfaceView.value }
})

const shownProject = frameDraftProject

/** The Frame's size tooltip while it is set: beads and measured size, "13×13 ≈ 2.1 × 2.1 cm" (Frame card). */
const frameTooltip = computed(() => {
  const project = shownProject.value
  const frame = frameOf(project)
  if (!project || !frame) return ''
  const bead = layerOf(project, 'frame')?.bead
  const estimate = bead ? formatSizeMm(estimatedSizeMm(frame, bead, frame.technique), { mm: t.value.form.unitMm, cm: t.value.form.unitCm }, locale.value) : ''
  return fillBlanks(t.value.frame.sizeTooltip, { ...seenSize(frame), estimate })
})

/** Whether the Selection carries handles and ruler numbers (ticket 435): while it is dragged or resized, its bar
 * then shrinks to the size instead of hiding. */
const selectionGuided = computed(() => !!selection.value && hasGuides(selection.value) && showRulers.value !== false)

/** The Selection's size for the bar's readout: "12×8 ≈ 4.2 × 2.6 cm", the rectangle through the Bead of the layer it
 * is on (tickets 415, 0665). */
const selectionSummary = computed(() => {
  const project = activeProject.value
  const current = selection.value
  if (!project || !current) return undefined
  const layer = selectionLayer(project, current)
  const { bead } = beadOfLayer(project, layer)
  const estimate = bead ? formatSizeMm(estimatedSizeMm(current, bead, layerWeave(project, layer).technique), { mm: t.value.form.unitMm, cm: t.value.form.unitCm }, locale.value) : ''
  return fillBlanks(t.value.frame.sizeTooltip, { columns: current.columns, rows: current.rows, estimate })
})

/** The Mirror bar's state while the Mirror is on (ADR 0082): its readout is the Area's size as the Selection bar's,
 * through the Bead of the layer it is on; the whole Frame's the Frame's own, a Custom frame's shape named first. */
const mirrorBar = computed<MirrorBarState | undefined>(() => {
  const project = activeProject.value
  const setting = mirrorSetting.value
  const rect = mirrorRect.value
  if (!project || !mirrorOn.value || !rect) return undefined
  if (setting.place?.layer === 'frame') {
    const shape = frameOf(project)?.shape
    return { setting, rect, fit: mirrorFit.value, shape: mirrorShape.value, summary: shape ? `${t.value.frame.shapes[shape]} · ${frameTooltip.value}` : frameTooltip.value }
  }
  const { bead } = beadOfLayer(project, 'canvas')
  const estimate = bead ? formatSizeMm(estimatedSizeMm(rect, bead, layerWeave(project, 'canvas').technique), { mm: t.value.form.unitMm, cm: t.value.form.unitCm }, locale.value) : ''
  return { setting, rect, fit: mirrorFit.value, summary: fillBlanks(t.value.frame.sizeTooltip, { columns: rect.columns, rows: rect.rows, estimate }) }
})

/** Where the Selection is on the surface and whether a pointer is down on it: the bar anchors to the one and steps
 * aside for the other (ticket 415). */
const selectionAnchor = ref<SelectionAnchor>()
/** Where the Mirror's Area is on the surface: the Mirror bar anchors to it (ADR 0082). */
const mirrorAnchor = ref<SelectionAnchor>()
/** Where the Frame and its margin sheet are on the canvas box: the sheet's tools follow them (tickets 473, 0657). */
const frameAnchor = ref<FrameAnchor>()
/** Where the unframed Schemas are on the canvas box: their tags follow them (tickets 0721, 0733). */
const schemaAnchors = ref<SchemaAnchors>()
/** The surface, so a press on the Move handle's button is handed to it as a press on the canvas (ticket 455). */
const surfaceRef = ref<InstanceType<typeof ProjectSurface>>()
// The surface tells the shell where it draws a bead (ticket 0797).
watch(surfaceRef, (shown) => (surfaceProbe.value = shown ?? undefined))
const surfacePressing = ref(false)

/** The Canvas's Background (tickets 252, 0666) as the drawing area's fill; the device's last pick with no Project open. */
const canvasBackground = useCanvasBackground(() => activeProject.value)

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
/** The open Project has no beads and no Frame, not even an empty one: the CanvasHint line and the first-run welcome show
 * (FirstRunHints card, tickets 0725, 0798). A Frame is already a start on the Pattern. The Homepage's demo has none:
 * nothing shows there that the tour didn't make (ticket 0797). */
const emptyProject = computed(() => !demo && !!activeProject.value && !frameOf(activeProject.value) && !hasProjectBeads(activeProject.value))
/** The save ring shows over the editor's drawing area only (SaveReminder card), and the toasts start under it; never in
 * the Homepage's demo, which saves nothing (ticket 0797). */
const ringShown = computed(() => !demo && onEditor.value && !!activeProject.value && saveRing.value.shown)
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
      :class="{ 'app-shell__canvas--pan': spaceHeld, 'app-shell__canvas--panning': spacePanning }"
      data-testid="app-canvas"
    >
      <!--
        The canvas box's header strip (ticket 143, ADR 0046, 0073): Menu, the Brand and the canvas controls (Rulers, Undo,
        Redo, zoom, Fit). The strip never scrolls, zooms or rotates with the Project below it.
      -->
      <CanvasStrip
        class="app-shell__canvas-strip"
        :page="page"
        :demo="demo"
        :expand="demoExpand"
        :project="onEditor ? activeProject : undefined"
        :rulers="showRulers"
        :reference-image="onEditor && activeProject ? referenceState : undefined"
        :frame-open="framePanelOpen"
        :can-undo="canUndo"
        :can-redo="canRedo"
        :open-panel="openPanel === 'export' && exportOpener !== 'strip-export' ? null : openPanel"
        :zoom-percent="onEditor ? stripZoomPercent : undefined"
        @select-panel="onSelectPanel"
        @toggle-expand="onToggleDemoExpand"
        @close="onCloseConvertImage"
        @toggle-frame="onToggleFramePanel"
        @rotate-canvas="onRotateCanvas"
        @toggle-rulers="toggleRulers"
        @toggle-reference-image="referenceImage.toggleShown"
        @pick-reference-image="referenceImage.pick($event, 'strip')"
        @undo="onUndo"
        @redo="onRedo"
        @zoom-in="zoomIn"
        @zoom-out="zoomOut"
        @reset="resetZoom"
      />

      <!-- The drawing area: the rest of the box, measured for the fit zoom (it doesn't grow with the Project). -->
      <div
        :ref="bindDrawing"
        class="app-shell__drawing"
        :class="{ 'app-shell__drawing--behind': !onEditor }"
        :style="drawingStyle"
        :inert="!onEditor || undefined"
        data-testid="app-drawing-area"
      >
        <!-- The save ring (ticket 0796, SaveReminder card): top-right, after the strip and before the drawing in Tab order. -->
        <SaveReminder
          v-if="ringShown"
          :beads="saveRing.beads"
          :last-file-at="saveRing.lastFileAt"
          :label-open="saveRing.labelOpen"
          @save="onSaveProjectFile"
          @hold="onHoldSaveRing"
        />

        <!-- How to move the canvas and its shortcuts: top-centre, only while the Project has no beads,
          not on a phone (CanvasHint card). -->
        <CanvasHint v-if="emptyProject" />

        <!-- Where Projects are kept (tickets 0725, 0798, FirstRunHints card): over an empty Project, gone with
          the first bead. -->
        <Transition name="first-run-hints">
          <FirstRunHints v-if="emptyProject" />
        </Transition>

        <div class="app-shell__canvas-row">
          <div :ref="bindCanvasScroll" class="app-shell__canvas-scroll" :class="{ 'app-shell__canvas-scroll--empty': !activeProject }">
            <ProjectSurface
              v-if="activeProject"
              ref="surfaceRef"
              :project="shownProject!"
              :tools="surfaceTools"
              :frame-tooltip="frameTooltip"
              :selection-tooltip="selectionSummary"
              :area-tooltip="mirrorBar?.summary"
              :zoom="zoom"
              :scroll="scroll"
              :orientation="canvasOrientation"
              :twist="twistPhase"
              :show-rulers="showRulers"
              :stroking="stroking"
              :row-marks="rowHighlight"
              :row-press="rowPress"
              :input-mode="surfaceInputMode"
              :handedness="handedness"
              :preview-cells="previewCells"
              :preview-stamp="previewStamp"
              :preview-color="previewColor"
              :mirror="mirrorOn ? mirrorSetting : undefined"
              :selection="selection"
              :selection-refusals="selectionRefusals"
              :fill-refusals="fillRefusals"
              :label="projectLabel"
              :reference="referenceImage.drawn.value"
              @surface-view="surfaceView = $event"
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
              @selection-resume="onSelectionResume"
              @selection-anchor="selectionAnchor = $event"
              @mirror-anchor="mirrorAnchor = $event"
              @frame-anchor="frameAnchor = $event"
              @schema-anchors="schemaAnchors = $event"
              @pressing="surfacePressing = $event"
              @drawn="onSurfaceDrawn"
            />
            <!-- The reference image's handles over the drawing whenever it is shown, its outline in Adjust (tickets 0790,
              0799), outside its image role. -->
            <ReferenceAdjust
              v-if="handled"
              :place="handled.image.place"
              :aspect="handled.aspect"
              :limits="handled.limits"
              :opacity="handled.image.opacity"
              :view="handled.view"
              :bead="handled.bead"
              :adjusting="referenceImage.adjusting.value"
              @preview="referenceImage.preview"
              @commit="referenceImage.commit"
              @done="referenceImage.endAdjust"
            />
            <EmptyCanvas v-else-if="!activeProject" :deleted="deletedProjectName" :quiet="openPanel !== null" @library="openMenuOnSavedProjects">
              <div class="app-shell__empty-actions" data-testid="phone-project-bar">
                <AppButton variant="primary" icon="plus" :action="newProjectAction" data-testid="phone-bar-new-project" @click="openMenuOnForm" />
                <ProjectImport compact :projects="projects" testid-prefix="phone-bar-" @import="onImportProjects" />
              </div>
            </EmptyCanvas>
          </div>

          <!-- The unframed Schemas' names on tags (tickets 0721, 0733, SchemaTag card): over the beads, one Tab stop after
            the canvas, under the Tool pill and the Selection bar. -->
          <SchemaTags
            v-if="activeProject && schemaAnchors?.schemas.length"
            :project="activeProject"
            :anchors="schemaAnchors"
            @rename="onRenameSchema"
            @frame="onFrameSchema"
          />
        </div>

        <!-- The Tool pill (ticket 439, ADR 0046): floats over the drawing, outside the zoom transform. -->
        <!-- The Adjust bar takes the Tool pill's place while the reference image is adjusted (ticket 0790). -->
        <ReferenceAdjustBar
          v-if="handled && referenceImage.adjusting.value"
          @replace="referenceImage.pick($event, 'adjust')"
          @fit="referenceImage.fit"
          @done="referenceImage.endAdjust"
        />
        <ToolPill
          v-else-if="activeProject"
          v-model:position="toolPillPosition"
          v-model:popover-open="toolPillPopoverOpen"
          :mirror-on="mirrorOn"
          :mirror-marking="mirrorMarking"
          :picking="colorPick?.picking.value"
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
          @mirror-tile="onMirrorTile"
          @pick-recent="pickRecent"
          @select-color="onSelectColor"
          @select-custom-color="onSelectCustomColor"
          @rect="pillRect = $event"
        />
      </div>

      <!-- Convert image fills the same cell as the drawing area, which stays laid out beneath it (ADR 0086). -->
      <ConvertImageWizard
        v-if="page === 'convert-image' && convertSession"
        :wizard="convertSession"
        :read-clipboard-image="readClipboardImage"
        class="app-shell__page"
        @close="onCloseConvertImage"
      />

      <!-- Short-lived results (ticket 76, 429): top-right of the canvas box, under the strip, stacking downward. -->
      <ToastRegion
        :toasts="toasts"
        :under-ring="ringShown"
        :clear-of-panel="openPanel !== null"
        @dismiss="dismissToast"
      />

      <!--
        Progress bar (ticket 144): along the canvas box's bottom edge, always there while a Project is open, since its
        first control is Remove frame (ticket 426); with none open the Canvas footer stays, empty (ticket 0748).
      -->
      <ConvertStepBar v-if="page === 'convert-image' && convertSession" class="app-shell__footer" :wizard="convertSession" @create="onCreateConvertImage" />
      <ProgressBar
        v-else
        class="app-shell__footer"
        :project="activeProject"
        :row-highlight="rowHighlight"
        :row-press="rowPress"
        @move-row="onMoveRow"
        @reset-progress="onResetProgress"
        @toggle-row-direction="onToggleRowDirection"
        @toggle-row-highlight="toggleRowHighlight"
        @fit-and-export="onFitAndExport"
        @go-to-row="onGoToRow"
      />

      <!--
        The Selection bar comes last in the page order (ADR 0075: Tab reaches the Progress bar first), so it sits in a
        layer laid over the drawing area, which keeps the bar's coordinates the drawing area's own. The margin sheet's
        tools ride in it after the bar: the order of ADR 0075 has no place for them.
      -->
      <div v-if="activeProject" v-show="onEditor" class="app-shell__selection-layer" :style="selectionLayerStyle" data-testid="selection-layer">
        <!--
          The Selection bar (tickets 168, 415, 0808, 0812; ContextBar card): above a rectangle Selection's Area sheet, its
          move grip handing a press on to the canvas; above a Piece's shape it floats too, clamped inside the canvas box while
          it stays beside it (ticket 0779), clear of the Tool pill. It shrinks to its readout in a gesture only while
          the Mirror's Area isn't the one resized or moved.
        -->
        <ContextBar
          :selection-summary="selectionSummary"
          :selection="selection"
          :anchor="selectionAnchor"
          :gesturing="surfacePressing"
          :size-only="selectionGuided && !mirrorAdjusting"
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
          @mirror-selection="onMirrorSelection"
          @select-all="onSelectAll"
          @remove-line="onRemoveSelectedLine"
          @name-piece="onNamePiece"
          @move-press="(event, area) => surfaceRef?.pressAreaGrip(event, area)"
          @move-key="onAreaKey"
        />
        <!--
          The Mirror bar (tickets 0750, 0809; ContextBar card): shown whenever the Mirror is on, a Selection or not,
          above a Canvas Area's sheet or above the whole Frame's. Right after the Selection bar in the page order, so
          Tab reaches it next (ADR 0075); drawn under the Selection bar where the two meet, as its sheet is.
        -->
        <ContextBar
          :gesturing="surfacePressing"
          :paste-armed="pasteProjectionActive"
          :project="activeProject"
          :can-remove-line="false"
          :obstacle="pillRect"
          :mirror="mirrorBar"
          :mirror-anchor="mirrorAnchor"
          :mirror-size-only="mirrorAdjusting"
          @update:mirror="onMirrorChange"
          @close-mirror="onCloseMirror"
          @move-press="(event, area) => surfaceRef?.pressAreaGrip(event, area)"
          @move-key="onAreaKey"
        />

        <!-- The Frame's tools on its margin sheet (ticket 0657, MarginSheet card): Row progress, the Move bar and the
          tools in its top band, the title block in its bottom-right corner, following the Frame. -->
        <MarginSheet
          v-if="frameOf(activeProject) && frameAnchor"
          :project="activeProject"
          :anchor="frameAnchor"
          :editing="settingFrame"
          :pressing="surfacePressing"
          :row-highlight="rowHighlight"
          :row-press="rowPress"
          :export-open="openPanel === 'export' && exportOpener === 'margin-export'"
          :selection="selectionAnchor?.box"
          :mirror-on-frame="mirrorOnFrame"
          :without-not-done="demo"
          @mirror="onMirrorWholeFrame"
          @rotate="onRotateFrame"
          @toggle-edit="onEditFrame"
          @export="onOpenExport"
          @remove="onRemoveFrame"
          @move-press="surfaceRef?.pressMoveHandle($event)"
          @key="onFrameKey"
          @move-row="onMoveRow"
          @reset-progress="onResetProgress"
          @toggle-row-direction="onToggleRowDirection"
          @toggle-row-highlight="toggleRowHighlight"
          @rename="onRenameFrame"
          @set-technique="onSetFrameTechnique"
          @set-setting="onSetFrameSetting"
          @save-maker-name="onSaveMakerName"
          @set-letters="onSetLetters"
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
  flex-wrap: wrap;
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

/* The canvas box (ticket 141, ADR 0085): right of the left column, full body height; three rows: the strip, the page's
 * content, the Progress bar. The editor's drawing area and Convert image share the middle one. The canvas moves under its
 * own view (ADR 0026), so nothing scrolls natively; the strip is a sibling of the scroller, so it never scrolls, zooms or
 * rotates with the Project. */
.app-shell__canvas {
  position: relative;
  display: grid;
  flex: 1 1 auto;
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: auto minmax(0, 1fr) auto;
  min-height: 0;
  overflow: hidden;
  overflow: clip;
  background: var(--box);
  border-radius: var(--canvas-box-radius);
}

.app-shell__canvas-strip {
  grid-row: 1;
}

/* The drawing area (ticket 143): the box under the strip, sized for the fit zoom, never the Project's size. Its
 * children are positioned, so they stack in order. Behind Convert image it keeps its size, so the fit zoom holds. */
.app-shell__drawing {
  position: relative;
  background: var(--canvas-bg, transparent);
  display: flex;
  grid-row: 2;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.app-shell__drawing--behind {
  visibility: hidden;
}

/* An App page other than the editor takes the drawing area's cell (ADR 0085). */
.app-shell__page {
  z-index: 1;
  grid-row: 2;
  grid-column: 1;
}

.app-shell__footer {
  grid-row: 3;
}

/* The Selection bar's layer: the drawing area's box, taking no pointer itself. Its overflow clips like the drawing
 * area's, and never scrolls to show a bar partly out of view with its Area (ticket 0779) when focus lands in it. */
.app-shell__selection-layer {
  position: absolute;
  overflow: hidden;
  overflow: clip;
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
 * It is the drawing area's one child in the flow and positions itself (relative, the canvas scroll laid over it): what
 * floats over the drawing (the save ring, the hints, the Tool pill, the Adjust bar) sets its own `position: absolute`,
 * so a new overlay touches only its own component (ticket 0800).
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
