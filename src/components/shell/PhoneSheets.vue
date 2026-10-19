<script setup lang="ts">
import BottomSheet from './BottomSheet.vue'
import FrameBar from '../canvas/FrameBar.vue'
import MenuPanel from './MenuPanel.vue'
import PanelHost from './PanelHost.vue'
import MirrorControls from '../tools/MirrorControls.vue'
import NewProjectForm from '../project/NewProjectForm.vue'
import TemplateGallery from '../project/TemplateGallery.vue'
import TemplateSetup from '../project/TemplateSetup.vue'
import AppButton from '../ui/AppButton.vue'
import ProjectList from '../project/ProjectList.vue'
import ProjectPanel from '../project/ProjectPanel.vue'
import { ref } from 'vue'
import { templateById, type TemplateId } from '../../domain/templates'
import { useAppShell } from '../../composables/shell/useAppShell'
import { MIRROR_ENABLED } from '../../features'

// The sheets over the canvas box (tickets 79, 295, 443): Menu and Project in one PanelHost, New Project as the Menu's sub-view, the Saved
// Projects sheet that opens from Menu, and Mirror's. Each panel only asks; the app shell does the work.
const {
  t,
  projects,
  activeProjectId,
  activeProject,
  saveFailed,
  unsaved,
  onRequestRemove,
  activeBeadLabel,
  settledProject,
  onNewProjectDraft,
  onCreateProject,
  onPlaceFrameFromTemplate,
  startConvertImage,
  onRequestDeleteAll,
  onRequestDeleteAllProjects,
  onSetTechnique,
  onSetBrickBlock,
  onSetCanvasTechnique,
  onSetCanvasBrickBlock,
  onSetBeadShape,
  onFitFrame,
  replaceBeadCandidates,
  onRequestReplaceBead,
  onImportProjects,
  onImportToast,
  decodeImage,
  exporting,
  onExportPng,
  onExportPdf,
  onExportProjectFile,
  onExportLibraryFile,
  onSave,
  onSaveMakerName,
  onRenameProject,
  onRequestDuplicate,
  onRequestDelete,
  inputMode,
  setInputMode,
  inputModeAvailable,
  mirrorAxisCounts,
  mirrorCopyMode,
  onSetMirrorAxisCount,
  onToggleMirrorCopyMode,
  onMirrorCurrent,
  onMirrorCurrentHover,
  openPanel,
  framing,
  frameBarShown,
  onStepFrameEdge,
  onResizeFrame,
  onRotateFrame,
  onRemoveFrame,
  onFrameKey,
  onCloseFrameBar,
  toolPillPosition,
  shortcutsHelpOpen,
  tour,
  menuOpensOnForm,
  phoneSavedProjectsOpen,
  onSelectProjectFromPhoneDrawer,
} = useAppShell()

/** The Template whose setup is open (ticket 493): the gallery's card sets it as it pushes the setup sub-view. */
const chosenTemplate = ref<TemplateId>()
</script>

<template>
  <BottomSheet
    v-if="MIRROR_ENABLED && openPanel === 'mirror' && activeProject"
    :title="t.toolbox.groups.mirror"
    @close="openPanel = null"
  >
    <MirrorControls
      :project="activeProject"
      :mirror-axis-counts="mirrorAxisCounts"
      :mirror-copy-mode="mirrorCopyMode"
      @set-mirror-axis-count="onSetMirrorAxisCount"
      @toggle-mirror-copy-mode="onToggleMirrorCopyMode"
      @mirror-current="onMirrorCurrent"
      @mirror-current-hover="onMirrorCurrentHover"
    />
  </BottomSheet>

  <!-- The Frame bar (tickets 473, 475, 511): a panel like the two below, mounted here and not in the canvas. -->
  <PanelHost v-if="activeProject && frameBarShown && !framing" open="frame" :only="['frame']" @close="onCloseFrameBar">
    <FrameBar
      :project="activeProject"
      @step="onStepFrameEdge"
      @resize="onResizeFrame"
      @rotate="onRotateFrame"
      @remove="onRemoveFrame"
      @key="onFrameKey"
    />
  </PanelHost>

  <!--
    Menu and Project (spec 0440, ticket 443; MenuPanel, ProjectPanel and TopSheet cards): one panel host, a dropdown from 1024px
    and a Top sheet under it, which stays mounted while the two swap. Menu is about the app and the device, Project about the
    open Project; New Project is Menu's sub-view and the Saved Projects sheet below opens from it.
  -->
  <PanelHost
    v-if="openPanel === 'menu' || (openPanel === 'project' && activeProject)"
    :open="openPanel"
    :only="['menu', 'project']"
    :sub-title="t.projects.newProjectButton"
    :start-in-sub="menuOpensOnForm || projects.length === 0"
    @close="openPanel = null"
  >
    <MenuPanel
      v-if="openPanel === 'menu'"
      v-model:tools-position="toolPillPosition"
      :projects="projects"
      :input-mode="inputMode"
      :pen-seen="inputModeAvailable"
      @import="onImportProjects"
      @import-result="(id, text, tone) => { onImportToast(id, text, tone); openPanel = null }"
      @export-all="onExportLibraryFile"
      @saved-projects="phoneSavedProjectsOpen = true"
      @delete-all="onRequestDeleteAllProjects"
      @update:input-mode="setInputMode"
      @shortcuts="shortcutsHelpOpen = true"
      @tour="tour.start()"
    />
    <ProjectPanel
      v-else-if="activeProject"
      :project="activeProject"
      :settled-project="settledProject"
      :bead-name="activeBeadLabel ?? ''"
      :replace-candidates="replaceBeadCandidates"
      :save-failed="saveFailed"
      :unsaved="unsaved"
      :exporting="exporting"
      @rename="onRenameProject"
      @set-technique="onSetTechnique"
      @set-brick-block="onSetBrickBlock"
      @set-canvas-technique="onSetCanvasTechnique"
      @set-canvas-brick-block="onSetCanvasBrickBlock"
      @set-bead-shape="onSetBeadShape"
      @replace-bead="onRequestReplaceBead"
      @save="onSave"
      @export-png="onExportPng"
      @export-pdf="onExportPdf"
      @export-project-file="onExportProjectFile"
      @fit-frame="onFitFrame(); openPanel = null"
      @save-maker-name="onSaveMakerName"
      @duplicate="onRequestDuplicate"
      @clear="onRequestDeleteAll"
      @delete="onRequestDelete"
    />
    <template #sub="{ depth }">
      <!-- The Project panel's Frame area opens the gallery and the setup alone, to put a Frame on the open Project (ticket 495). -->
      <template v-if="openPanel === 'project' && activeProject">
        <TemplateGallery v-if="depth === 1" without-blank class="phone-sheets__gallery" @choose="chosenTemplate = $event" />
        <TemplateSetup
          v-else-if="chosenTemplate"
          :template="templateById(chosenTemplate)"
          :project="activeProject"
          @submit="(payload) => { onPlaceFrameFromTemplate(payload); openPanel = null }"
        />
      </template>
      <!-- Level 1 is New Project: the Template gallery above the form. A card pushes level 2, its setup (ticket 493). -->
      <template v-else-if="depth === 1">
        <TemplateGallery class="phone-sheets__gallery" @choose="chosenTemplate = $event" />
        <NewProjectForm
          :decode-image="decodeImage"
          @submit="(payload) => { onCreateProject(payload); openPanel = null }"
          @draft="onNewProjectDraft"
          @convert-image="(draft) => { startConvertImage(draft); openPanel = null }"
        />
      </template>
      <TemplateSetup
        v-else-if="chosenTemplate"
        :template="templateById(chosenTemplate)"
        @submit="(payload) => { onCreateProject(payload); openPanel = null }"
      />
    </template>
    <template #footer="{ depth }">
      <AppButton v-if="depth === 2" class="phone-sheets__create" type="submit" form="template-setup-form" variant="primary" icon="plus" data-testid="create-template-project">
        {{ openPanel === 'project' ? (activeProject?.frame ? t.frame.replaceFrame : t.frame.addFrameButton) : t.form.submit }}
      </AppButton>
    </template>
  </PanelHost>

  <!-- Saved Projects: a non-modal sheet opened from the Project sheet's Saved Projects icon. Selecting a project closes both this and the Project sheet. -->
  <BottomSheet v-if="phoneSavedProjectsOpen" :title="t.projects.heading" @close="phoneSavedProjectsOpen = false">
    <ProjectList
      :projects="projects"
      :active-project-id="activeProjectId"
      @select="onSelectProjectFromPhoneDrawer"
      @remove="onRequestRemove"
      @export-project="onExportProjectFile"
      @export-library="onExportLibraryFile"
    />
  </BottomSheet>
</template>

<style scoped>
.phone-sheets__gallery {
  margin-bottom: var(--space-16);
}

.phone-sheets__create {
  width: 100%;
  height: var(--field-height);
}
</style>
