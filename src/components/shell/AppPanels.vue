<script setup lang="ts">
import FramePanel from '../canvas/FramePanel.vue'
import MenuPanel from './MenuPanel.vue'
import PanelHost from './PanelHost.vue'
import NewProjectForm from '../project/NewProjectForm.vue'
import StarterGallery from '../project/StarterGallery.vue'
import StarterSetup from '../project/StarterSetup.vue'
import AppButton from '../ui/AppButton.vue'
import ProjectsLibrary from '../project/ProjectsLibrary.vue'
import PanelItem from './PanelItem.vue'
import ProjectPanel from '../project/ProjectPanel.vue'
import { ref, watch } from 'vue'
import { starterById, type StarterId } from '../../domain/starters'
import { useAppShell } from '../../composables/shell/useAppShell'

// The sheets over the canvas box (tickets 79, 295, 443): Menu and Project in one PanelHost, New Project as the Menu's subpanel, and the Projects library as another. Each panel only asks; the app shell does the work.
const {
  t,
  projects,
  activeProjectId,
  onRequestRemove,
  activeProject,
  saveFailed,
  unsaved,
  settledProject,
  onNewProjectDraft,
  onCreateProject,
  onPlaceFrameFromStarter,
  startConvertImage,
  onRequestDeleteAll,
  onRequestDeleteAllProjects,
  onSetTechnique,
  onSetBrickBlock,
  onSetNetSize,
  onSetCanvasNetSize,
  onSetCanvasTechnique,
  onSetCanvasBrickBlock,
  onSetBeadShape,
  onFitFrame,
  onSelectFrame,
  replaceBeadCandidates,
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
  handedness,
  setHandedness,
  openPanel,
  framing,
  framePanelShown,
  onStepFrameEdge,
  onResizeFrame,
  onRenameFrame,
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

/** The Starter whose setup is open (ticket 493): the gallery's card sets it as it pushes the setup subpanel. */
const chosenStarter = ref<StarterId>()
/** Whether New Project's Pick a starter has unfolded the gallery (ticket 568); folded again whenever the panel closes. */
const startersOpen = ref(false)
watch(openPanel, (open) => {
  if (open === null) startersOpen.value = false
})
</script>

<template>
  <!-- The Frame panel (tickets 473, 475, 511): a panel like the two below, mounted here and not in the canvas. -->
  <PanelHost v-if="activeProject && framePanelShown && !framing" open="frame" :only="['frame']" :sub-title="t.frame.fromStarter" @close="onCloseFramePanel">
    <FramePanel
      :project="activeProject"
      :settled-project="settledProject"
      :exporting="exporting"
      @step="onStepFrameEdge"
      @resize="onResizeFrame"
      @rotate="onRotateFrame"
      @remove="onRemoveFrame"
      @rename="onRenameFrame"
      @fit="onFitFrame"
      @select-frame="onSelectFrame"
      @export-png="onExportPng"
      @export-pdf="onExportPdf"
      @key="onFrameKey"
    />
    <!-- Frame from starter (ticket 495, 555): the gallery, then the setup, to put a Frame on the open Project. -->
    <template #sub="{ depth }">
      <StarterGallery v-if="depth === 1" class="app-panels__gallery" @choose="chosenStarter = $event" />
      <StarterSetup
        v-else-if="chosenStarter"
        :starter="starterById(chosenStarter)"
        :project="activeProject"
        @submit="(payload) => { onPlaceFrameFromStarter(payload); onCloseFramePanel() }"
      />
    </template>
    <template #footer="{ depth }">
      <AppButton v-if="depth === 2" class="app-panels__create" type="submit" form="starter-setup-form" variant="primary" icon="plus" data-testid="create-starter-project">
        {{ activeProject.frame ? t.frame.replaceFrame : t.frame.addFrameButton }}
      </AppButton>
    </template>
  </PanelHost>

  <!--
    Menu and Project (spec 0440, ticket 443; MenuPanel and ProjectPanel cards): one panel host, a dropdown at every width,
    which stays mounted while the two swap. Menu is about the app and the device, Project about the
    open Project; New Project is Menu's subpanel and the Projects library below opens from it.
  -->
  <PanelHost
    v-if="openPanel === 'menu' || (openPanel === 'project' && activeProject)"
    :open="openPanel"
    :only="['menu', 'project']"
    :sub-title="phoneSavedProjectsOpen ? t.projects.heading : t.projects.newProjectButton"
    :sub-meta="openPanel === 'menu' && phoneSavedProjectsOpen ? String(projects.length) : undefined"
    :start-in-sub="menuOpensOnForm || projects.length === 0"
    @close="openPanel = null"
  >
    <MenuPanel
      v-if="openPanel === 'menu'"
      v-model:tools-position="toolPillPosition"
      :projects="projects"
      :input-mode="inputMode"
      :pen-seen="inputModeAvailable"
      :handedness="handedness"
      @new-project="phoneSavedProjectsOpen = false"
      @saved-projects="phoneSavedProjectsOpen = true"
      @update:input-mode="setInputMode"
      @update:handedness="setHandedness"
      @shortcuts="shortcutsHelpOpen = true"
    />
    <ProjectPanel
      v-else-if="activeProject"
      :project="activeProject"
      :replace-candidates="replaceBeadCandidates"
      :save-failed="saveFailed"
      :unsaved="unsaved"
      @rename="onRenameProject"
      @set-technique="onSetTechnique"
      @set-brick-block="onSetBrickBlock"
      @set-canvas-technique="onSetCanvasTechnique"
      @set-canvas-brick-block="onSetCanvasBrickBlock"
      @set-net-size="onSetNetSize"
      @set-canvas-net-size="onSetCanvasNetSize"
      @set-bead-shape="onSetBeadShape"
      @replace-bead="onRequestReplaceBead"
      @save="saveNow"
      @export-project-file="onExportProjectFile"
      @save-maker-name="onSaveMakerName"
      @duplicate="onRequestDuplicate"
      @clear="onRequestDeleteAll"
      @delete="onRequestDelete"
    />
    <template #sub="{ depth }">
      <!-- The Projects library: Menu's other subpanel. Picking a Project opens it and closes the panel. -->
      <ProjectsLibrary
        v-if="phoneSavedProjectsOpen && depth === 1"
        :projects="projects"
        :active-project-id="activeProjectId"
        @select="onSelectProjectFromPhoneDrawer"
        @remove="onRequestRemove"
        @import="onImportProjects"
        @export-all="onExportLibraryFile"
      />
      <!-- Level 1 is New Project, with the Starter gallery under its Pick a starter button. A card pushes level 2, its setup (ticket 493). -->
      <template v-else-if="depth === 1">
        <NewProjectForm
          v-model:starters-open="startersOpen"
          :decode-image="decodeImage"
          @submit="(payload) => { onCreateProject(payload); openPanel = null }"
          @draft="onNewProjectDraft"
          @choose-starter="chosenStarter = $event"
          @convert-image="(draft) => { startConvertImage(draft); openPanel = null }"
        />
      </template>
      <StarterSetup
        v-else-if="chosenStarter"
        :starter="starterById(chosenStarter)"
        @submit="(payload) => { onCreateProject(payload); openPanel = null }"
      />
    </template>
    <template #footer="{ depth }">
      <PanelItem
        v-if="depth === 1 && phoneSavedProjectsOpen && openPanel === 'menu'"
        icon="delete"
        danger
        :disabled="projects.length === 0"
        :name="t.panels.menu.deleteAll"
        :disabled-body="t.projects.emptyTitle"
        data-testid="menu-delete-all"
        @select="onRequestDeleteAllProjects"
      >
        {{ t.panels.menu.deleteAll }}
      </PanelItem>
      <AppButton v-if="depth === 2" class="app-panels__create" type="submit" form="starter-setup-form" variant="primary" icon="plus" data-testid="create-starter-project">
        {{ t.form.submit }}
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
