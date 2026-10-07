<script setup lang="ts">
import BeadQuantities from '../palette/BeadQuantities.vue'
import NewProjectForm from '../project/NewProjectForm.vue'
import ProjectList from '../project/ProjectList.vue'
import SaveBox from '../export/SaveBox.vue'
import Toolbox from '../tools/Toolbox.vue'
import { useAppShell } from '../../composables/shell/useAppShell'

const {
  t,
  projects,
  activeProjectId,
  activeProject,
  saveFailed,
  onRequestRemove,
  onRequestSwitch,
  settledProject,
  framing,
  onNewProjectDraft,
  onCreateProject,
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
  onRotate,
  onRequestDeleteAll,
  onStartSetFrame,
  settingFrame,
  inputMode,
  inputModeAvailable,
  toggleInputMode,
  onSetFrameSize,
  onFitFrame,
  onRemoveFrame,
  onBringFrameIntoView,
  canRemoveSelectedLine,
  onRemoveSelectedLine,
  qrExport,
  makerName,
  nameOnExportsOpen,
  exporting,
  onExportProjectFile,
  onExportLibraryFile,
  decodeImage,
  onExportPng,
  onExportPdf,
  onSave,
} = useAppShell()
</script>

<template>
  <!--
    The left column (ticket 141, ADR 0021): one column that scrolls on its own, holding separate boxes in a fixed
    order — the Toolbox (or the New Project form in its place), the save box (ticket 148), Beads needed, Saved
    Projects. The first box is the form with no Project open or while a Convert image framing step is up (ticket
    58: the frame is sized by these very fields and follows them as they're edited, so taking them away mid-framing
    would freeze the frame at whatever it last read), the Toolbox otherwise.
  -->
  <aside class="app-shell__column" :aria-label="t.a11y.toolsLandmark" data-testid="app-main-panel">
    <section v-if="!activeProject || framing" class="app-shell__new-project" data-testid="new-project-box">
      <h2 class="app-shell__box-title">{{ t.projects.newProjectButton }}</h2>
      <NewProjectForm
        :decode-image="decodeImage"
        @submit="onCreateProject"
        @draft="onNewProjectDraft"
        @convert-image="startConvertImage"
      />
    </section>
    <!--
      Hidden while framing takes the canvas panel over (ticket 58): these are the open Project's editing tools, and a
      Project nobody can see is not one to offer Undo, Rotate or Delete all against. Cancel brings both the
      Project and its Toolbox straight back.
    -->
    <Toolbox
      v-else-if="activeProject"
      :ref="bindToolbox"
      :project="activeProject"
      :active-tool="activeTool"
      :selected-color-id="selectedColorId"
      :custom-color="customColor"
      :selected-image-color="selectedImageColor"
      :can-undo="canUndo"
      :can-redo="canRedo"
      :can-copy="!!selection"
      :can-remove-selected-line="canRemoveSelectedLine"
      :setting-frame="settingFrame"
      :input-mode="inputModeAvailable ? inputMode : undefined"
      @select-tool="onSelectTool"
      @toggle-input-mode="toggleInputMode"
      @select-color="onSelectColor"
      @select-custom-color="onSelectCustomColor"
      @select-image-color="onSelectImageColor"
      @undo="onUndo"
      @redo="onRedo"
      @rotate="onRotate"
      @copy="onCopy"
      @delete-all="onRequestDeleteAll"
      @start-frame="onStartSetFrame"
      @set-frame-size="onSetFrameSize"
      @fit-frame="onFitFrame"
      @remove-frame="onRemoveFrame"
      @bring-frame="onBringFrameIntoView"
      @remove-selected-line="onRemoveSelectedLine"
    />
    <!-- The save box (ticket 148): the library's save state, Save Project and Export ▾, beside the open Project's tools. -->
    <SaveBox
      v-if="activeProject && !framing"
      :has-frame="activeProject.frame !== undefined"
      :save-failed="saveFailed"
      :qr-too-large="qrExport.tooLarge.value"
      :exporting="exporting"
      :project-name="activeProject.name"
      :maker-name="makerName"
      @edit-maker-name="nameOnExportsOpen = true"
      @save="onSave"
      @export-project="onExportProjectFile"
      @export-qr="qrExport.open"
      @export-png="onExportPng"
      @export-pdf="onExportPdf"
      @fit-frame="onFitFrame"
      @set-frame="onStartSetFrame"
    />
    <BeadQuantities :project="settledProject" />
    <ProjectList
      :projects="projects"
      :active-project-id="activeProjectId"
      @select="onRequestSwitch"
      @remove="onRequestRemove"
      @export-project="onExportProjectFile"
      @export-library="onExportLibraryFile"
    />
  </aside>
</template>

<style scoped>
/* The left column scrolls on its own, and never scrolls the canvas. */
.app-shell__column {
  display: flex;
  flex-direction: column;
  gap: var(--space-16);
  box-sizing: border-box;
  min-height: 0;
  padding-right: var(--space-6);
  overflow-y: auto;
  overscroll-behavior: none;
  scrollbar-width: thin;
  scrollbar-color: var(--line-strong) transparent;
}

/*
 * Under 1024px (ticket 295, ADR 0032) there is no column: the Dock's sheets reach every control it holds through their
 * own markup. It stays mounted, just hidden, so its own state (an expanded panel, a roving tab stop) isn't lost.
 */
@media (max-width: 1023px) {
  .app-shell__column {
    display: none;
  }
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

/* The New Project form's box (ticket 149; NewProjectForm card): the Toolbox's panel, its title in the `title` role. */
.app-shell__new-project {
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
