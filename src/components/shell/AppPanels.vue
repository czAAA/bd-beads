<script setup lang="ts">
import FramePanel from '../canvas/FramePanel.vue'
import MenuPanel from './MenuPanel.vue'
import PanelHost from './PanelHost.vue'
import NewProjectForm from '../project/NewProjectForm.vue'
import TemplateGallery from '../project/TemplateGallery.vue'
import TemplateSetup from '../project/TemplateSetup.vue'
import AppButton from '../ui/AppButton.vue'
import ProjectList from '../project/ProjectList.vue'
import ProjectPanel from '../project/ProjectPanel.vue'
import { ref } from 'vue'
import { templateById, type TemplateId } from '../../domain/templates'
import { useAppShell } from '../../composables/shell/useAppShell'

// The sheets over the canvas box (tickets 79, 295, 443): Menu and Project in one PanelHost, New Project as the Menu's subpanel, and Saved Projects as another. Each panel only asks; the app shell does the work.
const {
  t,
  projects,
  activeProjectId,
  onRequestRemove,
  activeProject,
  saveFailed,
  unsaved,
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
  replaceBeadOutdated,
  onRequestReplaceBead,
  onImportProjects,
  decodeImage,
  exporting,
  onExportPng,
  onExportPdf,
  onExportProjectFile,
  onExportLibraryFile,
  saveNow,
  onSaveMakerName,
  onRenameProject,
  onRequestDuplicate,
  onRequestDelete,
  inputMode,
  setInputMode,
  inputModeAvailable,
  openPanel,
  framing,
  framePanelShown,
  onStepFrameEdge,
  onResizeFrame,
  onRotateFrame,
  onRemoveFrame,
  onFrameKey,
  onCloseFramePanel,
  toolPillPosition,
  shortcutsHelpOpen,
  menuOpensOnForm,
  phoneSavedProjectsOpen,
  onSelectProjectFromPhoneDrawer,
} = useAppShell()

/** The Template whose setup is open (ticket 493): the gallery's card sets it as it pushes the setup subpanel. */
const chosenTemplate = ref<TemplateId>()
const newProjectForm = ref<InstanceType<typeof NewProjectForm>>()
</script>

<template>
  <!-- The Frame panel (tickets 473, 475, 511): a panel like the two below, mounted here and not in the canvas. -->
  <PanelHost v-if="activeProject && framePanelShown && !framing" open="frame" :only="['frame']" @close="onCloseFramePanel">
    <FramePanel
      :project="activeProject"
      @step="onStepFrameEdge"
      @resize="onResizeFrame"
      @rotate="onRotateFrame"
      @remove="onRemoveFrame"
      @key="onFrameKey"
    />
  </PanelHost>

  <!--
    Menu and Project (spec 0440, ticket 443; MenuPanel and ProjectPanel cards): one panel host, a dropdown at every width,
    which stays mounted while the two swap. Menu is about the app and the device, Project about the
    open Project; New Project is Menu's subpanel and the Saved Projects sheet below opens from it.
  -->
  <PanelHost
    v-if="openPanel === 'menu' || (openPanel === 'project' && activeProject)"
    :open="openPanel"
    :only="['menu', 'project']"
    :sub-title="phoneSavedProjectsOpen ? t.projects.heading : t.projects.newProjectButton"
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
      @export-all="onExportLibraryFile"
      @new-project="phoneSavedProjectsOpen = false"
      @saved-projects="phoneSavedProjectsOpen = true"
      @delete-all="onRequestDeleteAllProjects"
      @update:input-mode="setInputMode"
      @shortcuts="shortcutsHelpOpen = true"
    />
    <ProjectPanel
      v-else-if="activeProject"
      :project="activeProject"
      :settled-project="settledProject"
      :bead-name="activeBeadLabel ?? ''"
      :replace-candidates="replaceBeadCandidates"
      :replace-outdated="replaceBeadOutdated"
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
      @save="saveNow"
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
        <TemplateGallery v-if="depth === 1" without-blank class="app-panels__gallery" @choose="chosenTemplate = $event" />
        <TemplateSetup
          v-else-if="chosenTemplate"
          :template="templateById(chosenTemplate)"
          :project="activeProject"
          @submit="(payload) => { onPlaceFrameFromTemplate(payload); openPanel = null }"
        />
      </template>
      <!-- Saved Projects: Menu's other subpanel. Picking a Project opens it and closes the panel. -->
      <ProjectList
        v-else-if="phoneSavedProjectsOpen && depth === 1"
        :projects="projects"
        :active-project-id="activeProjectId"
        @select="onSelectProjectFromPhoneDrawer"
        @remove="onRequestRemove"
        @export-project="onExportProjectFile"
        @export-library="onExportLibraryFile"
      />
      <!-- Level 1 is New Project: the Template gallery above the form. A card pushes level 2, its setup (ticket 493). -->
      <template v-else-if="depth === 1">
        <TemplateGallery class="app-panels__gallery" @choose="chosenTemplate = $event" @choose-blank="newProjectForm?.focusName()" />
        <NewProjectForm
          ref="newProjectForm"
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
      <AppButton v-if="depth === 2" class="app-panels__create" type="submit" form="template-setup-form" variant="primary" icon="plus" data-testid="create-template-project">
        {{ openPanel === 'project' ? (activeProject?.frame ? t.frame.replaceFrame : t.frame.addFrameButton) : t.form.submit }}
      </AppButton>
    </template>
  </PanelHost>
</template>

<style scoped>
.app-panels__gallery {
  margin-bottom: var(--space-16);
}

.app-panels__create {
  width: 100%;
  height: var(--field-height);
}
</style>
