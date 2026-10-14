<script setup lang="ts">
import { computed } from 'vue'
import AppButton from '../ui/AppButton.vue'
import AppIcon from '../ui/AppIcon.vue'
import AppSelect from '../ui/AppSelect.vue'
import BeadPill from '../palette/BeadPill.vue'
import BeadQuantities from '../palette/BeadQuantities.vue'
import BottomSheet from './BottomSheet.vue'
import EditControls, { type EditControlId } from '../tools/EditControls.vue'
import IconButton from '../ui/IconButton.vue'
import ToolTiles from '../tools/ToolTiles.vue'
import MirrorControls from '../tools/MirrorControls.vue'
import NewProjectForm from '../project/NewProjectForm.vue'
import ProjectImport from '../import/ProjectImport.vue'
import ProjectList from '../project/ProjectList.vue'
import SaveBox from '../export/SaveBox.vue'
import FrameControls from '../project/FrameControls.vue'
import LanguageSwitcher from './LanguageSwitcher.vue'
import ThemeToggle from './ThemeToggle.vue'
import ToolColorControls from '../tools/ToolColorControls.vue'
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
  activeTool,
  selectedColorId,
  customColor,
  selectedImageColor,
  onSelectTool,
  onSelectAll,
  onSelectColor,
  onSelectCustomColor,
  onSelectImageColor,
  selection,
  pasteProjectionActive,
  onRotate,
  onRequestDeleteAll,
  onStartSetFrame,
  onSetFrameSize,
  pendingFrame,
  onSetTechnique,
  onFitFrame,
  onRemoveFrame,
  canRemoveSelectedLine,
  onRemoveSelectedLine,
  canNamePiece,
  onNamePiece,
  replaceBeadCandidates,
  onPickReplaceBead,
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
  shortcutsHelpOpen,
  tour,
  phoneNewProjectOpen,
  phoneSavedProjectsOpen,
  onSelectProjectFromPhoneDrawer,
} = useAppShell()

/** The Menu's Overview link and the repository's AGPL-3.0 source link (ADR 0031, ticket 269): the same two the wide header's menu holds. */
const overviewHref = overviewUrl(import.meta.env.BASE_URL)
const SOURCE_URL = 'https://github.com/czAAA/bd-beads'

const sheetActions = {
  removeLine: controlAction('remove-line'),
  namePiece: controlAction('name-piece'),
  clear: controlAction('clear'),
  newProject: controlAction('new-project'),
  savedProjects: controlAction('saved-projects'),
  changeMakerName: controlAction('change-maker-name'),
}

/** The Frame sheet's Edit row (EditControls card): Rotate acts at once. Copy and Paste live on the Selection bar (ticket 415). */
function onFrameSheetEdit(id: EditControlId) {
  if (id === 'rotate') onRotate()
}

function frameSheetEditTestId(id: EditControlId): string | undefined {
  return `sheet-${id}`
}

/** What the actions' enabled states and disabled reasons read (ADR 0035). */
const deps = computed(() =>
  controlDeps({
    activeProject: () => activeProject.value,
    canRemoveSelectedLine: () => canRemoveSelectedLine.value,
    canNamePiece: () => canNamePiece.value,
    hasSelection: () => !!selection.value,
    hasClipboard: () => pasteProjectionActive.value,
  }),
)
</script>

<template>
  <BottomSheet v-if="openPhoneSheet === 'tool' && activeProject" :title="t.toolbox.groups.tools" @close="openPhoneSheet = null">
    <div class="phone-sheet__tiles">
      <ToolTiles :active-tool="activeTool" @select="onSelectTool" @select-all="onSelectAll" />
    </div>
    <div class="phone-sheet__links">
      <AppButton variant="link" icon="remove-line" :action="sheetActions.removeLine" :deps="deps" data-testid="sheet-remove-line" data-tour="remove-line" @click="onRemoveSelectedLine(); openPhoneSheet = null">
        {{ t.tools.removeLineShort }}
      </AppButton>
      <AppButton variant="link" icon="piece" :action="sheetActions.namePiece" :deps="deps" data-testid="sheet-name-piece" @click="onNamePiece(); openPhoneSheet = null">
        {{ t.tools.namePieceButton }}
      </AppButton>
      <AppButton variant="link" icon="delete" danger :action="sheetActions.clear" :deps="deps" data-testid="sheet-delete-all" @click="onRequestDeleteAll(); openPhoneSheet = null">
        {{ t.deleteAll.button }}
      </AppButton>
    </div>
  </BottomSheet>

  <BottomSheet v-if="openPhoneSheet === 'color' && activeProject" :title="t.toolbox.groups.colors" @close="openPhoneSheet = null">
    <ToolColorControls
      :selected-color-id="selectedColorId"
      :custom-color="customColor"
      :selected-image-color="selectedImageColor"
      :image-colors="activeProject.imageColors"
      @select-color="onSelectColor"
      @select-custom-color="onSelectCustomColor"
      @select-image-color="onSelectImageColor"
    />
  </BottomSheet>

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
    The Frame sheet (ticket 295; Dock card): the Frame's own controls and, beneath them, what used to be the Edit sheet --
    Rotate, which acts on the Frame or a Selection (Copy and Paste are on the Selection bar, ticket 415); Undo and Redo live in the Zoom pill (ticket 296).
  -->
  <BottomSheet v-if="openPhoneSheet === 'frame' && activeProject" :title="t.frame.title" @close="openPhoneSheet = null">
    <FrameControls
      :project="activeProject"
      :pending-frame="pendingFrame"
      with-set-frame
      @set-frame="onStartSetFrame(); openPhoneSheet = null"
      @set-size="onSetFrameSize"
      @set-technique="onSetTechnique"
      @fit="onFitFrame"
      @remove="onRemoveFrame"
    />
    <div class="phone-sheet__edit">
      <EditControls :ids="['rotate']" :deps="deps" :test-id-for="frameSheetEditTestId" @activate="onFrameSheetEdit" />
    </div>
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
        <AppSelect
          variant="primary"
          data-testid="phone-replace-bead-select"
          :aria-label="t.replaceBead.selectLabel"
          :value="''"
          @change="onPickReplaceBead($event.target as HTMLSelectElement)"
        >
          <option value="" disabled>{{ t.replaceBead.selectLabel }}</option>
          <option v-for="bead in replaceBeadCandidates" :key="bead.id" :value="bead.id">
            {{ beadLabel(bead) }}
          </option>
        </AppSelect>
      </p>
      <SaveBox
        :has-frame="activeProject.frame !== undefined"
        :save-failed="saveFailed"
        :exporting="exporting"
        :project-name="activeProject.name"
        :maker-name="makerName"
        @edit-maker-name="nameOnExportsOpen = true"
        @save="onSave"
        @export-png="onExportPng"
        @export-pdf="onExportPdf"
        @fit-frame="onFitFrame(); openPhoneSheet = null"
        @set-frame="onStartSetFrame(); openPhoneSheet = null"
      />
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
    The Menu sheet (ticket 295; Dock card): the Dock's last slot and the header's whole remaining job -- language, theme, Name
    on exports, Keyboard shortcuts (only with a keyboard or mouse attached), Overview and the source link. Modal, like the
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
    <div class="phone-sheet__menu-row" data-testid="menu-item-name-on-exports">
      <span class="phone-sheet__menu-label">{{ t.saveBox.nameOnExports }}</span>
      <AppButton variant="in-box" size="sm" :action="sheetActions.changeMakerName" :label="makerName ? undefined : t.saveBox.addName" data-testid="menu-item-name-on-exports-change" @click="nameOnExportsOpen = true" />
    </div>
    <button type="button" class="ui-control phone-sheet__menu-link phone-sheet__menu-shortcuts" data-testid="menu-item-shortcuts" @click="shortcutsHelpOpen = true">
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
/* The phone ToolSheets' own content (ticket 79; ToolSheet card). */
.phone-sheet__tiles {
  display: grid;
  grid-template-columns: repeat(auto-fill, 56px);
  justify-content: space-between;
  grid-auto-rows: 72px;
  background-image: repeating-linear-gradient(to bottom, transparent 0 71px, var(--line-strong) 71px 72px);
}

.phone-sheet__links {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-8);
  justify-content: space-between;
  margin-top: var(--space-16);
}

.phone-sheet__edit {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-8);
  margin-top: var(--space-16);
  padding-top: var(--space-16);
  border-top: 1px solid var(--line-soft);
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

/* Keyboard shortcuts only helps a fine pointer or a keyboard (ticket 166; responsive.md "Input, not width"). */
.phone-sheet__menu-shortcuts {
  display: none;
}

@media (any-pointer: fine) {
  .phone-sheet__menu-shortcuts {
    display: flex;
  }
}

.phone-sheet__bead-row {
  display: flex;
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
