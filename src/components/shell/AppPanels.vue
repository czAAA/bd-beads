<script setup lang="ts">
import ExportPanel from '../canvas/ExportPanel.vue'
import MenuPanel from './MenuPanel.vue'
import SignInPanel from './SignInPanel.vue'
import ShortcutsHelp from './ShortcutsHelp.vue'
import PanelHost from './PanelHost.vue'
import NewProjectForm from '../project/NewProjectForm.vue'
import StarterGallery from '../project/StarterGallery.vue'
import StarterSetup from '../project/StarterSetup.vue'
import AppButton from '../ui/AppButton.vue'
import ProjectsLibrary from '../project/ProjectsLibrary.vue'
import ProjectPanel from '../project/ProjectPanel.vue'
import { computed, ref } from 'vue'
import { starterById, type StarterCategoryId, type StarterId } from '../../domain/starters'
import { usePanelsContext } from '../../composables/shell/useAppShell'

// The sheets over the canvas box (tickets 79, 295, 443): Menu and Project in one PanelHost, New Project as the Menu's subpanel, and the Projects library and Sign in as others. Each panel only asks; the app shell does the work.
const {
  t,
  projects,
  sealed,
  activeProjectId,
  onRequestRemove,
  activeProject,
  saveFailed,
  unsaved,
  openElsewhere,
  onNewProjectDraft,
  unnamedProjectName,
  onCreateProject,
  onCreateFromStarter,
  onPlaceFrameFromStarter,
  onOpenConvertImage,
  page,
  onLeavePage,
  demo,
  onStartDemoAfresh,
  onRequestDeleteAll,
  onRequestDeleteAllProjects,
  onSetTechnique,
  onSetWeaveSetting,
  referenceImage,
  onSetBackground,
  onFitFrame,
  onSelectFrame,
  onSelectPieceFrame,
  onRequestReplaceBead,
  onImportProjects,
  exporting,
  onExportPng,
  onExportPdf,
  onSaveProjectFile,
  onSaveProjectFileAs,
  canSaveAs,
  lastFileName,
  sinceFile,
  saveReminderInPanel,
  onExportLibraryFile,
  saveNow,
  onSaveMakerName,
  onRenameProject,
  onRequestDelete,
  inputMode,
  setInputMode,
  inputModeAvailable,
  handedness,
  setHandedness,
  openPanel,
  onRemoveFrame,
  onBringFrameIntoView,
  onExportFrame,
  onPickExportFrame,
  exportedFrame,
  projectOpensOnStarters,
  toolPillPosition,
  menuOpensOnForm,
  phoneSavedProjectsOpen,
  onSelectProjectFromPhoneDrawer,
  shortcutsOpen,
  onOpenFeedback,
  exportChoice,
  exportOpener,
  exportScope,
  exportFrame,
  exportSelection,
  signInOpen,
  menuOpensOnList,
  account,
  mayOpenSignIn,
  signInRefusal,
  signInAsks,
  signInLeaving,
  verifySignIn,
  onContinueWithGoogle,
  onSignOut,
  onRequestDeleteAccount,
} = usePanelsContext()

/** The button the Export panel hangs from: the Selection bar's Export, or its "..." where the bar folded the button away
 * (ticket 1210). */
const exportAnchor = computed(() => {
  if (exportOpener.value === 'context-bar-export' && !document.querySelector('[data-testid="context-bar-export"]')) return 'context-bar-more'
  // On a Frame's sheet the button is the one on that Frame's (ticket 1220).
  return exportFrame.value ? `${exportOpener.value}@${exportFrame.value}` : exportOpener.value
})

/** The reference image's state the Project panel shows (ticket 0790). */
const referencePanel = computed(() => ({
  thumbnail: referenceImage.thumbnail.value,
  preparing: referenceImage.preparing.value,
  refusal: referenceImage.refusal.value,
  notSaved: referenceImage.notSaved.value,
}))

/** The Starter gallery's category and Starter open (ticket 0596): a card sets its own as it pushes the next level. */
const chosenCategory = ref<StarterCategoryId>()
const chosenStarter = ref<StarterId>()
</script>

<template>
  <!-- The Export panel (tickets 0652, 0657): the strip's Export button's or the margin sheet's, hung from the one pressed. -->
  <PanelHost v-if="activeProject && openPanel === 'export'" open="export" :only="['export']" :anchor="exportAnchor" :keeps-canvas="exportScope === 'selection'" @close="openPanel = null">
    <ExportPanel
      :project="activeProject"
      :frame="exportedFrame"
      :exporting="exporting"
      :opens-on="exportChoice"
      :selection="exportScope === 'selection' ? exportSelection : undefined"
      @fit="onFitFrame"
      @select-frame="onSelectFrame('export')"
      @select-piece-frame="onSelectPieceFrame('export')"
      @pick-frame="onPickExportFrame"
      @export-png="onExportPng"
      @export-pdf="onExportPdf"
      @save-project-file="onSaveProjectFile"
      @save-maker-name="onSaveMakerName"
    />
  </PanelHost>

  <!--
    Menu and Project (spec 0440, ticket 443; MenuPanel and ProjectPanel cards): one panel host, a dropdown at every width,
    which stays mounted while the two swap. Menu is about the app and the device, Project about the open Project; New
    Project is Menu's subpanel, as is the library. Over the converter Menu opens on its root list, which asks (0861).
  -->
  <PanelHost
    v-if="openPanel === 'menu' || (openPanel === 'project' && activeProject)"
    :open="openPanel"
    :only="['menu', 'project']"
    :sub-title="openPanel === 'project' ? t.starters.title : shortcutsOpen ? t.shortcutsHelp.title : signInOpen ? t.account.signIn : phoneSavedProjectsOpen ? t.projects.heading : t.projects.newProjectButton"
    :sub-meta="openPanel === 'menu' && phoneSavedProjectsOpen && !signInOpen && !shortcutsOpen ? String(projects.length + sealed.length) : undefined"
    :sub-key="openPanel === 'menu' && shortcutsOpen ? '?' : undefined"
    :sub-width="openPanel === 'menu' && shortcutsOpen ? 'var(--panel-width-wide)' : undefined"
    :sub-opener="shortcutsOpen ? 'menu-item-shortcuts' : undefined"
    :start-in-sub="openPanel === 'project' ? projectOpensOnStarters : shortcutsOpen || (page !== 'convert-image' && !menuOpensOnList && (menuOpensOnForm || projects.length + sealed.length === 0))"
    @close="openPanel = null"
  >
    <MenuPanel
      v-if="openPanel === 'menu'"
      v-model:tools-position="toolPillPosition"
      :page="page"
      :leave="onLeavePage"
      :project-count="projects.length + sealed.length"
      :input-mode="inputMode"
      :pen-seen="inputModeAvailable"
      :handedness="handedness"
      :demo="demo"
      :account="account"
      :may-open-sign-in="mayOpenSignIn"
      @new-project="demo ? onStartDemoAfresh() : ((phoneSavedProjectsOpen = false), (signInOpen = false), (shortcutsOpen = false))"
      @convert-image="onOpenConvertImage()"
      @saved-projects="(phoneSavedProjectsOpen = true), (signInOpen = false), (shortcutsOpen = false)"
      @sign-in="(signInOpen = true), (shortcutsOpen = false)"
      @sign-out="onSignOut"
      @delete-account="onRequestDeleteAccount"
      @update:input-mode="setInputMode"
      @update:handedness="setHandedness"
      @shortcuts="(shortcutsOpen = true), (signInOpen = false), (phoneSavedProjectsOpen = false)"
      @feedback="onOpenFeedback"
    />
    <ProjectPanel
      v-else-if="activeProject"
      :project="activeProject"
      :save-failed="saveFailed"
      :unsaved="unsaved"
      :open-elsewhere="openElsewhere"
      :reference="referencePanel"
      :last-file-name="lastFileName"
      :since-file="sinceFile"
      :save-reminder="saveReminderInPanel"
      :can-save-as="canSaveAs"
      :exporting="exporting"
      :export-frame="exportedFrame"
      @rename="onRenameProject"
      @pick-reference-image="referenceImage.pick($event, 'panel')"
      @set-reference-opacity="referenceImage.setOpacity"
      @remove-reference-image="referenceImage.requestRemove"
      @set-technique="onSetTechnique"
      @set-weave-setting="onSetWeaveSetting"
      @set-background="onSetBackground"
      @replace-bead="onRequestReplaceBead"
      @save="saveNow"
      @save-project-file="onSaveProjectFile"
      @save-project-file-as="onSaveProjectFileAs"
      @export-png="onExportPng"
      @export-pdf="onExportPdf"
      @fit="onFitFrame"
      @select-frame="onSelectFrame('export')"
      @select-piece-frame="onSelectPieceFrame('export')"
      @pick-export-frame="onPickExportFrame"
      @draw-frame="onSelectFrame()"
      @show-frame="onBringFrameIntoView"
      @export-frame="onExportFrame"
      @remove-frame="onRemoveFrame"
      @save-maker-name="onSaveMakerName"
      @clear="onRequestDeleteAll"
      @delete="onRequestDelete"
    />
    <template #sub="{ depth }">
      <!-- Frame from starter (tickets 495, 555, 0596, 1222): the Project panel's subpanel, the categories, a category's
        options, then a Starter's setup, to put its Frame on the open Project as a new Frame. -->
      <template v-if="openPanel === 'project'">
        <StarterGallery v-if="depth === 1" @choose-category="chosenCategory = $event" />
        <StarterGallery v-else-if="depth === 2" :category="chosenCategory" @choose="chosenStarter = $event" />
        <StarterSetup
          v-else-if="chosenStarter && activeProject"
          :starter="starterById(chosenStarter)"
          :project="activeProject"
          @submit="(choice) => { onPlaceFrameFromStarter(starterById(chosenStarter!), choice); openPanel = null }"
        />
      </template>
      <!-- Keyboard shortcuts (ticket 1159): Help's Subpanel, or what `?` opens Menu on. -->
      <ShortcutsHelp v-else-if="shortcutsOpen && depth === 1" />
      <!-- Sign in (ticket 0078): the Account section's subpanel, also what Menu opens on back from Google refused. -->
      <SignInPanel
        v-else-if="signInOpen && depth === 1"
        :refusal="signInRefusal"
        :asks="signInAsks"
        :leaving="signInLeaving"
        :verify="verifySignIn"
        @continue="onContinueWithGoogle"
      />
      <!-- The Projects library: Menu's other subpanel. Picking a Project opens it and closes the panel. -->
      <ProjectsLibrary
        v-else-if="phoneSavedProjectsOpen && depth === 1"
        :projects="projects"
        :sealed="sealed"
        :active-project-id="activeProjectId"
        deletes-all
        @select="onSelectProjectFromPhoneDrawer"
        @remove="onRequestRemove"
        @import="onImportProjects"
        @export-all="onExportLibraryFile"
        @delete-all="onRequestDeleteAllProjects"
      />
      <!-- Level 1 is New Project; its Pick a starter pushes the Starter gallery's categories, then a category's options,
        then a Starter's setup (ticket 0596). -->
      <template v-else-if="depth === 1">
        <NewProjectForm
          :name-placeholder="unnamedProjectName"
          @submit="(payload) => { onCreateProject(payload); openPanel = null }"
          @draft="onNewProjectDraft"
          @convert-image="(draft) => { onOpenConvertImage(draft); openPanel = null }"
        />
      </template>
      <StarterGallery v-else-if="depth === 2" @choose-category="chosenCategory = $event" />
      <StarterGallery v-else-if="depth === 3" :category="chosenCategory" @choose="chosenStarter = $event" />
      <StarterSetup
        v-else-if="chosenStarter"
        :starter="starterById(chosenStarter)"
        @submit="(choice) => { onCreateFromStarter(starterById(chosenStarter!), choice); openPanel = null }"
      />
    </template>
    <template #footer="{ depth }">
      <AppButton v-if="openPanel === 'project' && depth === 3" class="app-panels__create" type="submit" form="starter-setup-form" variant="primary" icon="plus" data-testid="create-starter-project">
        {{ t.frame.addFrameButton }}
      </AppButton>
      <AppButton v-else-if="openPanel !== 'project' && depth === 4" class="app-panels__create" type="submit" form="starter-setup-form" variant="primary" icon="plus" data-testid="create-starter-project">
        {{ t.form.submit }}
      </AppButton>
    </template>
  </PanelHost>
</template>

<style scoped>
.app-panels__create {
  width: 100%;
  height: var(--field-height);
}
</style>
