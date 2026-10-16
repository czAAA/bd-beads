<script setup lang="ts">
import { computed } from 'vue'
import AppButton from '../ui/AppButton.vue'
import AppIcon from '../ui/AppIcon.vue'
import AppMenuItem from '../ui/AppMenuItem.vue'
import MenuButton from '../ui/MenuButton.vue'
import BeadPill from '../palette/BeadPill.vue'
import BeadQuantities from '../palette/BeadQuantities.vue'
import BottomSheet from './BottomSheet.vue'
import IconButton from '../ui/IconButton.vue'
import MirrorControls from '../tools/MirrorControls.vue'
import NewProjectForm from '../project/NewProjectForm.vue'
import ProjectImport from '../import/ProjectImport.vue'
import ProjectList from '../project/ProjectList.vue'
import SaveBox from '../export/SaveBox.vue'
import FrameControls from '../project/FrameControls.vue'
import LanguageSwitcher from './LanguageSwitcher.vue'
import ThemeToggle from './ThemeToggle.vue'
import SegmentedControl from '../ui/form/SegmentedControl.vue'
import { useAppShell } from '../../composables/shell/useAppShell'
import { beadLabel } from '../../domain/beads'
import { summarizeProject } from '../../domain/project'
import { overviewUrl } from '../../overview/overviewRoute'
import { MIRROR_ENABLED, TOUR_ENABLED } from '../../features'
import { controlAction, controlDeps } from '../../composables/shell/controlRegistry'

const {
  t,
  projects,
  activeProjectId,
  activeProject,
  saveFailed,
  onRequestRemove,
  activeBeadLabel,
  settledProject,
  onNewProjectDraft,
  onCreateProject,
  startConvertImage,
  onRequestDeleteAll,
  onEditFrame,
  onSetTechnique,
  onFitFrame,
  onRemoveFrame,
  replaceBeadCandidates,
  onRequestReplaceBead,
  onImportProjects,
  decodeImage,
  makerName,
  nameOnExportsOpen,
  exporting,
  onExportPng,
  onExportPdf,
  onExportProjectFile,
  onExportLibraryFile,
  onSave,
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

/** The Menu's Overview link and the repository's AGPL-3.0 source link (ADR 0031, ticket 269): the same two the wide header's menu holds. */
const overviewHref = overviewUrl(import.meta.env.BASE_URL)
const SOURCE_URL = 'https://github.com/czAAA/bd-beads'

/** The Menu's Tools position (ticket 439): the same four edges the pill is dragged to. */
const pillPositionOptions = computed(() => [
  { value: 'left' as const, label: t.value.toolPill.left },
  { value: 'top' as const, label: t.value.toolPill.top },
  { value: 'right' as const, label: t.value.toolPill.right },
  { value: 'bottom' as const, label: t.value.toolPill.bottom },
])

const sheetActions = {
  clear: controlAction('clear'),
  newProject: controlAction('new-project'),
  savedProjects: controlAction('saved-projects'),
  changeMakerName: controlAction('change-maker-name'),
}

/** What the actions' enabled states and disabled reasons read (ADR 0035). */
const deps = computed(() =>
  controlDeps({
    activeProject: () => activeProject.value,
  }),
)
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
    The Project sheet (PhoneForms, ToolSheet cards): modal, taller, with a scrim -- an accidental tap past its edge
    shouldn't lose the way back to New Project or Import, unlike the five light sheets above.
  -->
  <BottomSheet v-if="openPhoneSheet === 'project'" modal :title="t.header.projectSheetLabel" @close="openPhoneSheet = null; phoneSavedProjectsOpen = false">
    <template v-if="activeProject">
      <!-- The open Project's name, size and save state (ticket 295): moved here from the header, which is gone under 1024px. -->
      <p class="phone-sheet__project-info" data-testid="phone-project-info">
        <span class="phone-sheet__summary" data-testid="phone-project-summary">
          {{ summarizeProject(activeProject) }}
        </span>
        <AppIcon :name="saveFailed ? 'warning' : 'check'" :size="14" class="phone-sheet__save" :class="{ 'phone-sheet__save--failed': saveFailed }" />
      </p>
      <p class="phone-sheet__bead-row">
        <BeadPill data-testid="phone-sheet-bead">{{ activeBeadLabel }}</BeadPill>
        <!-- A menu, not a native select (ticket 442): the iPad's picker swallowed the pick, and the menu works the same everywhere. -->
        <MenuButton variant="primary" :label="t.replaceBead.selectLabel" data-testid="phone-replace-bead-select">
          <AppMenuItem
            v-for="bead in replaceBeadCandidates"
            :key="bead.id"
            :data-testid="`phone-replace-bead-${bead.id}`"
            @select="onRequestReplaceBead(bead.id)"
          >
            {{ beadLabel(bead) }}
          </AppMenuItem>
        </MenuButton>
      </p>
      <!-- The Frame's Technique, Edit Frame, Fit and Remove (ticket 417): the Frame sheet is gone with the Dock's Frame slot. -->
      <FrameControls
        :project="activeProject"
        @edit-frame="onEditFrame(); openPhoneSheet = null"
        @set-technique="onSetTechnique"
        @fit="onFitFrame"
        @remove="onRemoveFrame"
      />
      <SaveBox
        :has-frame="activeProject.frame !== undefined"
        :save-failed="saveFailed"
        :exporting="exporting"
        :project-name="activeProject.name"
        @save="onSave"
        @export-png="onExportPng"
        @export-pdf="onExportPdf"
        @fit-frame="onFitFrame(); openPhoneSheet = null"
      />
      <!-- The Project's own Maker's name (ADR 0060, ticket 441); ticket 443 replaces this row with the Project menu's own. -->
      <div class="phone-sheet__menu-row" data-testid="project-name-on-exports">
        <span class="phone-sheet__menu-label">{{ t.saveBox.nameOnExports }}</span>
        <AppButton variant="in-box" size="sm" :action="sheetActions.changeMakerName" :label="makerName ? undefined : t.saveBox.addName" data-testid="name-on-exports-change" @click="nameOnExportsOpen = true" />
      </div>
      <BeadQuantities :project="settledProject" />
    </template>
    <div class="phone-sheet__project-actions">
      <!-- New Project: never disabled -- with no Projects yet this is the only way to reach the form (the wider tiers show it inline by default). -->
      <AppButton variant="primary" icon="plus" :action="sheetActions.newProject" data-testid="phone-new-project-button" @click="phoneNewProjectOpen = true" />
      <ProjectImport compact :projects="projects" testid-prefix="project-sheet-" @import="onImportProjects" />
      <IconButton
        :action="sheetActions.savedProjects"
        :disabled="projects.length === 0"
        data-testid="phone-saved-projects-button"
        @click="phoneSavedProjectsOpen = true"
      />
    </div>
    <!-- Delete all (ticket 431): the Project sheet's last line, with its usual confirmation. -->
    <div v-if="activeProject" class="phone-sheet__links">
      <AppButton variant="link" icon="delete" danger :action="sheetActions.clear" :deps="deps" data-testid="sheet-delete-all" @click="onRequestDeleteAll(); openPhoneSheet = null">
        {{ t.deleteAll.button }}
      </AppButton>
    </div>
  </BottomSheet>

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

  <!--
    The Menu sheet (ticket 295; Dock card): the header's whole remaining job -- language, theme, Tools position (ticket 439),
    Keyboard shortcuts (only with a keyboard or mouse attached), Overview and the source link. Modal, like the
    Project sheet. Everything about the open Project stays in the Project sheet; nothing is repeated here.
  -->
  <BottomSheet v-if="openPhoneSheet === 'menu'" modal :title="t.header.menuButton" @close="openPhoneSheet = null">
    <div class="phone-sheet__menu-row">
      <span class="phone-sheet__menu-label">{{ t.languageSwitcher.ariaLabel }}</span>
      <LanguageSwitcher />
    </div>
    <div class="phone-sheet__menu-row phone-sheet__menu-row--wrap">
      <span class="phone-sheet__menu-label">{{ t.theme.groupLabel }}</span>
      <ThemeToggle />
    </div>
    <div v-if="activeProject" class="phone-sheet__menu-row phone-sheet__menu-row--wrap" data-testid="menu-item-tools-position">
      <span id="menu-tools-position" class="phone-sheet__menu-label">{{ t.toolPill.position }}</span>
      <SegmentedControl v-model="toolPillPosition" :options="pillPositionOptions" labelledby="menu-tools-position" small data-testid="menu-tools-position" />
    </div>
    <button type="button" class="ui-control phone-sheet__menu-link" data-testid="menu-item-shortcuts" @click="shortcutsHelpOpen = true">
      <AppIcon name="keyboard" :size="16" />
      {{ t.shortcutsHelp.title }}
    </button>
    <a class="ui-control phone-sheet__menu-link" :href="overviewHref" data-testid="menu-item-overview">
      <AppIcon name="bead" :size="16" />
      {{ t.header.overviewItem }}
    </a>
    <button v-if="TOUR_ENABLED" type="button" class="ui-control phone-sheet__menu-link" data-testid="menu-item-tour" @click="openPhoneSheet = null; tour.start()">
      <AppIcon name="info" :size="16" />
      {{ t.header.tourItem }}
    </button>
    <!-- The repository is public under AGPL-3.0 (ADR 0031, ticket 269); this link is what the license's network clause requires a hosted copy to offer. -->
    <a class="ui-control phone-sheet__menu-link" :href="SOURCE_URL" target="_blank" rel="noopener" data-testid="menu-item-source">
      <AppIcon name="code" :size="16" />
      {{ t.header.sourceItem }}
    </a>
  </BottomSheet>
</template>

<style scoped>
/* The phone sheets' own content (ticket 79; ToolSheet card). */
.phone-sheet__links {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-8);
  justify-content: space-between;
  margin-top: var(--space-16);
}

.phone-sheet__project-info {
  display: flex;
  align-items: center;
  gap: var(--space-6);
  min-width: 0;
  margin: 0 0 var(--space-12);
}

.phone-sheet__summary {
  min-width: 0;
  overflow: hidden;
  font: var(--type-control);
  color: var(--ink);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.phone-sheet__save {
  flex: none;
  color: var(--accent-strong);
}

.phone-sheet__save--failed {
  color: var(--danger);
}

.phone-sheet__menu-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-8);
  padding: var(--space-8) 0;
}

.phone-sheet__menu-row--wrap {
  flex-wrap: wrap;
}

.phone-sheet__menu-label {
  font: var(--type-body);
  color: var(--body);
}

.phone-sheet__menu-link {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  box-sizing: border-box;
  width: 100%;
  height: var(--menu-item-height);
  padding: 0;
  font: var(--type-control);
  color: var(--ink);
  text-align: left;
  text-decoration: none;
  background: none;
  border: 0;
  cursor: pointer;
}

.phone-sheet__bead-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-8);
  margin: 0 0 var(--space-16);
}

.phone-sheet__project-actions {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--space-8);
  margin-top: var(--space-16);
  padding-top: var(--space-16);
  border-top: 1px solid var(--line-soft);
}

.phone-sheet__project-actions .app-button {
  flex: 1 1 0;
}
</style>
