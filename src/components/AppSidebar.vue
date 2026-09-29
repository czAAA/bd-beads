<script setup lang="ts">
import AppDrawer from './AppDrawer.vue'
import BeadQuantities from './BeadQuantities.vue'
import NewPatternForm from './NewPatternForm.vue'
import PatternList from './PatternList.vue'
import SaveBox from './SaveBox.vue'
import Toolbox from './Toolbox.vue'
import { useAppShell } from '../composables/useAppShell'

const {
  t,
  patterns,
  activePatternId,
  activePattern,
  saveFailed,
  removePattern,
  onSelectPattern,
  settledPattern,
  framing,
  onNewPatternDraft,
  onCreatePattern,
  startConvertImage,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  activeTool,
  selectedColorId,
  customColor,
  selectedImageColor,
  onSelectTool,
  onSelectColor,
  onSelectCustomColor,
  onSelectImageColor,
  selection,
  onCopy,
  bindToolbox,
  onToggleRotate,
  onRequestDeleteAll,
  onRequestChangeSize,
  canRemoveSelectedLine,
  onRemoveSelectedLine,
  qrExport,
  makerName,
  nameOnExportsOpen,
  exporting,
  onExportPatternFile,
  onExportLibraryFile,
  decodeImage,
  onExportPng,
  onExportPdf,
  onSave,
  drawerOpen,
} = useAppShell()
</script>

<template>
  <!--
    The left column (ticket 141, ADR 0021): one column that scrolls on its own, holding separate boxes in a fixed
    order — the Toolbox (or the New Pattern form in its place), the save box (ticket 148), Beads needed, Saved
    Patterns. The first box is the form with no Pattern open or while a Convert image framing step is up (ticket
    58: the frame is sized by these very fields and follows them as they're edited, so taking them away mid-framing
    would freeze the frame at whatever it last read), the Toolbox otherwise.
  -->
  <AppDrawer :open="drawerOpen" :label="t.header.toolsButton" @close="drawerOpen = false">
  <aside class="app-shell__column" :aria-label="t.a11y.toolsLandmark" data-testid="app-main-panel">
    <section v-if="!activePattern || framing" class="app-shell__new-pattern" data-testid="new-pattern-box">
      <h2 class="app-shell__box-title">{{ t.patterns.newPatternButton }}</h2>
      <NewPatternForm
        :decode-image="decodeImage"
        @submit="onCreatePattern"
        @draft="onNewPatternDraft"
        @convert-image="startConvertImage"
      />
    </section>
    <!--
      Hidden while framing takes the canvas panel over (ticket 58): these are the open Pattern's editing tools, and a
      Pattern nobody can see is not one to offer Undo, Rotate or Delete all against. Cancel brings both the
      Pattern and its Toolbox straight back.
    -->
    <Toolbox
      v-else-if="activePattern"
      :ref="bindToolbox"
      :pattern="activePattern"
      :active-tool="activeTool"
      :selected-color-id="selectedColorId"
      :custom-color="customColor"
      :selected-image-color="selectedImageColor"
      :can-undo="canUndo"
      :can-redo="canRedo"
      :can-copy="!!selection"
      :can-remove-selected-line="canRemoveSelectedLine"
      @select-tool="onSelectTool"
      @select-color="onSelectColor"
      @select-custom-color="onSelectCustomColor"
      @select-image-color="onSelectImageColor"
      @undo="onUndo"
      @redo="onRedo"
      @toggle-rotate="onToggleRotate"
      @copy="onCopy"
      @delete-all="onRequestDeleteAll"
      @change-size="onRequestChangeSize"
      @remove-selected-line="onRemoveSelectedLine"
    />
    <!-- The save box (ticket 148): the library's save state, Save Pattern and Export ▾, beside the open Pattern's tools. -->
    <SaveBox
      v-if="activePattern && !framing"
      :save-failed="saveFailed"
      :qr-too-large="qrExport.tooLarge.value"
      :exporting="exporting"
      :pattern-name="activePattern.name"
      :maker-name="makerName"
      @edit-maker-name="nameOnExportsOpen = true"
      @save="onSave"
      @export-pattern="onExportPatternFile"
      @export-qr="qrExport.open"
      @export-png="onExportPng"
      @export-pdf="onExportPdf"
    />
    <BeadQuantities :pattern="settledPattern" />
    <PatternList
      :patterns="patterns"
      :active-pattern-id="activePatternId"
      @select="onSelectPattern"
      @remove="removePattern"
      @export-pattern="onExportPatternFile"
      @export-library="onExportLibraryFile"
    />
  </aside>
  </AppDrawer>
</template>

<style scoped>
/* The left column scrolls on its own, and never scrolls the canvas. height: 100% matters once the Drawer wrapping it switches to position: fixed (744-1023px): a percentage height needs a definite one to resolve against, and there it's the Drawer's own fixed box; in the grid it was already this tall via the row's default stretch. */
.app-shell__column {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: var(--space-16);
  box-sizing: border-box;
  min-height: 0;
  padding-right: var(--space-14);
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: var(--line-strong) transparent;
}

@media (min-width: 1024px) and (max-width: 1279px) {
  .app-shell__column {
    gap: var(--space-12);
  }
}

/* Each box keeps its content height and fills the column's width. */
.app-shell__column > * {
  flex: none;
  width: auto;
}

/* The New Pattern form's box (ticket 149; NewPatternForm card): the Toolbox's panel, its title in the `title` role. */
.app-shell__new-pattern {
  display: flex;
  flex-direction: column;
  gap: var(--space-20);
  box-sizing: border-box;
  padding: var(--space-24);
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: var(--radius-lg);
}

.app-shell__box-title {
  margin: 0;
  font: var(--type-title);
  color: var(--ink);
}
</style>
