<script setup lang="ts">
import BottomSheet from './BottomSheet.vue'
import MenuPanel from './MenuPanel.vue'
import PanelShell from './PanelShell.vue'
import MirrorControls from '../tools/MirrorControls.vue'
import NewProjectForm from '../project/NewProjectForm.vue'
import ProjectList from '../project/ProjectList.vue'
import ProjectPanel from '../project/ProjectPanel.vue'
import { useAppShell } from '../../composables/shell/useAppShell'
import { MIRROR_ENABLED } from '../../features'

// The sheets over the canvas box (tickets 79, 295, 443): Menu and Project in one PanelShell, the New Project and Saved
// Projects sheets that open from Menu, and Mirror's. Each panel only asks; the app shell does the work.
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
  startConvertImage,
  onRequestDeleteAll,
  onRequestDeleteAllProjects,
  onSetTechnique,
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
  openPhoneSheet,
  toolPillPosition,
  shortcutsHelpOpen,
  tour,
  phoneNewProjectOpen,
  phoneSavedProjectsOpen,
  onSelectProjectFromPhoneDrawer,
} = useAppShell()
</script>

<template>
  <BottomSheet
    v-if="MIRROR_ENABLED && openPhoneSheet === 'mirror' && activeProject"
    :title="t.toolbox.groups.mirror"
    @close="openPhoneSheet = null"
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

  <!--
    Menu and Project (spec 0440, ticket 443; MenuPanel, ProjectPanel and TopSheet cards): one shell, a dropdown from 1024px
    and a Top sheet under it, which stays mounted while the two swap. Menu is about the app and the device, Project about the
    open Project; the New Project and Saved Projects sheets below open from Menu.
  -->
  <PanelShell
    v-if="openPhoneSheet === 'menu' || (openPhoneSheet === 'project' && activeProject)"
    :title="openPhoneSheet === 'menu' ? t.header.menuButton : t.header.projectSheetLabel"
    :anchor="openPhoneSheet === 'menu' ? 'strip-menu' : 'strip-project'"
    :menu="openPhoneSheet === 'menu'"
    @close="openPhoneSheet = null"
  >
    <MenuPanel
      v-if="openPhoneSheet === 'menu'"
      v-model:tools-position="toolPillPosition"
      :projects="projects"
      :input-mode="inputMode"
      :pen-seen="inputModeAvailable"
      @new-project="phoneNewProjectOpen = true"
      @import="onImportProjects"
      @import-result="(id, text, tone) => { onImportToast(id, text, tone); openPhoneSheet = null }"
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
      @replace-bead="onRequestReplaceBead"
      @save="onSave"
      @export-png="onExportPng"
      @export-pdf="onExportPdf"
      @export-project-file="onExportProjectFile"
      @fit-frame="onFitFrame(); openPhoneSheet = null"
      @save-maker-name="onSaveMakerName"
      @duplicate="onRequestDuplicate"
      @clear="onRequestDeleteAll"
      @delete="onRequestDelete"
    />
  </PanelShell>

  <!-- New Project (PhoneForms card): its own full-height modal sheet from the Project sheet, the same form the wider tiers show inline. -->
  <BottomSheet v-if="phoneNewProjectOpen" modal :title="t.projects.newProjectButton" @close="phoneNewProjectOpen = false">
    <NewProjectForm
      :decode-image="decodeImage"
      @submit="(payload) => { onCreateProject(payload); phoneNewProjectOpen = false; openPhoneSheet = null }"
      @draft="onNewProjectDraft"
      @convert-image="(draft) => { startConvertImage(draft); phoneNewProjectOpen = false; openPhoneSheet = null }"
    />
  </BottomSheet>

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
