<script setup lang="ts">
import { computed } from 'vue'
import AppButton from '../ui/AppButton.vue'
import AppLink from '../ui/AppLink.vue'
import AppSelect from '../ui/AppSelect.vue'
import BeadPill from '../palette/BeadPill.vue'
import BeadQuantities from '../palette/BeadQuantities.vue'
import BottomSheet from './BottomSheet.vue'
import CanvasColorPicker from '../canvas/CanvasColorPicker.vue'
import CustomColorPicker from '../palette/CustomColorPicker.vue'
import IconButton from '../ui/IconButton.vue'
import ImageColorsButton from '../palette/ImageColorsButton.vue'
import NewProjectForm from '../project/NewProjectForm.vue'
import PalettePicker from '../palette/PalettePicker.vue'
import ProjectImport from '../import/ProjectImport.vue'
import ProjectList from '../project/ProjectList.vue'
import SaveBox from '../export/SaveBox.vue'
import FrameControls from '../project/FrameControls.vue'
import ThemeToggle from './ThemeToggle.vue'
import { useAppShell } from '../../composables/shell/useAppShell'
import { beadLabel } from '../../domain/beads'
import type { Tool } from '../../domain/tool'
import ToolButton from '../tools/ToolButton.vue'
import { TOOL_HOTKEYS, TOOL_ICONS, TOOL_ORDER } from '../tools/toolIcons'

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
  pasteProjectionActive,
  onCopy,
  onRotate,
  onRequestDeleteAll,
  onStartSetFrame,
  onSetFrameSize,
  onFitFrame,
  onRemoveFrame,
  canRemoveSelectedLine,
  onRemoveSelectedLine,
  replaceBeadCandidates,
  onPickReplaceBead,
  onImportProjects,
  decodeImage,
  qrExport,
  makerName,
  nameOnExportsOpen,
  exporting,
  onExportProjectFile,
  onExportPng,
  onExportPdf,
  onSave,
  openPhoneSheet,
  themeSheetOpen,
  phoneNewProjectOpen,
  phoneSavedProjectsOpen,
  onSelectProjectFromPhoneDrawer,
} = useAppShell()

/** The phone Tool sheet's four tiles (ToolSheet card), same order and icons as everywhere else the four tools list themselves. */
const phoneTools = computed(() => TOOL_ORDER.map((id) => ({ id, icon: TOOL_ICONS[id], label: toolLabel(id), hotkey: TOOL_HOTKEYS[id] })))

function toolLabel(tool: Tool): string {
  return { paint: t.value.tools.paintLabel, fill: t.value.tools.fillLabel, select: t.value.tools.selectLabel, erase: t.value.tools.eraseLabel, hand: t.value.tools.handLabel }[tool]
}
</script>

<template>
  <BottomSheet v-if="openPhoneSheet === 'tool' && activeProject" :title="t.toolbox.groups.tools" @close="openPhoneSheet = null">
    <div class="phone-sheet__tiles">
      <ToolButton
        v-for="tool in phoneTools"
        :key="tool.id"
        :icon="tool.icon"
        :label="tool.label"
        :hotkey="tool.hotkey"
        :active="activeTool === tool.id"
        :data-testid="`sheet-tool-${tool.id}`"
        :data-tour="`tool-${tool.id}`"
        @click="onSelectTool(tool.id)"
      />
    </div>
    <div class="phone-sheet__links">
      <AppLink icon="remove-line" :disabled="!canRemoveSelectedLine" data-testid="sheet-remove-line" :aria-label="t.tools.removeLineName" data-tour="remove-line" @click="onRemoveSelectedLine(); openPhoneSheet = null">
        {{ t.tools.removeLineShort }}
      </AppLink>
      <AppLink icon="delete" danger data-testid="sheet-delete-all" :aria-label="t.deleteAll.confirmButton" @click="onRequestDeleteAll(); openPhoneSheet = null">
        {{ t.deleteAll.button }}
      </AppLink>
    </div>
  </BottomSheet>

  <BottomSheet v-if="openPhoneSheet === 'color' && activeProject" :title="t.toolbox.groups.colors" @close="openPhoneSheet = null">
    <PalettePicker :selected-color-id="selectedColorId" @select="onSelectColor" />
    <div class="phone-sheet__color-buttons">
      <CustomColorPicker
        :color="customColor"
        :selected="!selectedColorId && !selectedImageColor && !!customColor"
        @select="onSelectCustomColor"
      />
      <ImageColorsButton :colors="activeProject.imageColors" :selected-color="selectedImageColor" @select="onSelectImageColor" />
    </div>
  </BottomSheet>

  <BottomSheet v-if="openPhoneSheet === 'edit' && activeProject" :title="t.toolbox.groups.edit" @close="openPhoneSheet = null">
    <div class="phone-sheet__edit">
      <IconButton icon="undo" variant="toolbox" size="lg" data-tour="undo" :label="t.palette.undoButton" :disabled="!canUndo" @click="onUndo" />
      <IconButton icon="redo" variant="toolbox" size="lg" :label="t.palette.redoButton" :disabled="!canRedo" @click="onRedo" />
      <IconButton
        icon="rotate"
        variant="toolbox"
        size="lg"
        :label="activeProject.frame ? t.palette.rotateButton : t.frame.rotateNeedsFrame"
        :disabled="!activeProject.frame || activeProject.rowProgress.enabled"
        :title="activeProject.frame && activeProject.rowProgress.enabled ? t.size.lockedReason : undefined"
        data-testid="sheet-rotate"
        @click="onRotate"
      />
      <IconButton icon="copy" variant="toolbox" size="lg" data-tour="copy" :label="t.tools.copyButton" :disabled="!selection" @click="onCopy" />
      <IconButton
        icon="paste"
        variant="toolbox"
        size="lg"
        :label="t.tools.pasteLabel"
        :disabled="!pasteProjectionActive"
        data-testid="sheet-paste"
        @click="openPhoneSheet = null"
      />
    </div>
  </BottomSheet>

  <BottomSheet v-if="openPhoneSheet === 'frame' && activeProject" :title="t.frame.title" @close="openPhoneSheet = null">
    <FrameControls
      :project="activeProject"
      with-set-frame
      @set-frame="onStartSetFrame(); openPhoneSheet = null"
      @set-size="onSetFrameSize"
      @fit="onFitFrame"
      @remove="onRemoveFrame"
    />
  </BottomSheet>

  <!--
    The Project sheet (PhoneForms, ToolSheet cards): modal, taller, with a scrim -- an accidental tap past its edge
    shouldn't lose the way back to New Project or Import, unlike the five light sheets above.
  -->
  <BottomSheet v-if="openPhoneSheet === 'project'" modal :title="t.header.projectSheetLabel" @close="openPhoneSheet = null; phoneSavedProjectsOpen = false">
    <!-- Canvas color on the phone (CanvasBackground card): the CanvasStrip is hidden here, so the picker lives in this header, before Close. Hidden in high contrast, and with no Project open there is no canvas to color. -->
    <template v-if="activeProject" #actions>
      <CanvasColorPicker />
    </template>
    <template v-if="activeProject">
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
        @fit-frame="onFitFrame(); openPhoneSheet = null"
        @set-frame="onStartSetFrame(); openPhoneSheet = null"
      />
      <BeadQuantities :project="settledProject" />
    </template>
    <div class="phone-sheet__project-actions">
      <!-- New Project: never disabled -- with no Projects yet this is the only way to reach the form (the wider tiers show it inline by default). -->
      <AppButton variant="primary" icon="plus" data-testid="phone-new-project-button" @click="phoneNewProjectOpen = true">
        {{ t.projects.newProjectButton }}
      </AppButton>
      <ProjectImport compact :decode-image="decodeImage" :projects="projects" testid-prefix="project-sheet-" @import="onImportProjects" />
      <IconButton
        icon="library"
        :label="t.projects.heading"
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
    />
  </BottomSheet>

  <!-- Theme: the phone header's own quick-access icon opens the same four-way choice the More menu's ThemeToggle offers. -->
  <BottomSheet v-if="themeSheetOpen" :title="t.theme.groupLabel" @close="themeSheetOpen = false">
    <ThemeToggle />
  </BottomSheet>
</template>

<style scoped>
/* The phone ToolSheets' own content (ticket 79; ToolSheet card). */
.phone-sheet__tiles {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(56px, 1fr));
  grid-auto-rows: 72px;
  background-image: repeating-linear-gradient(to bottom, transparent 0 71px, var(--line-strong) 71px 72px);
}

.phone-sheet__tiles :deep(.tool-button) {
  width: 100%;
}

.phone-sheet__links {
  display: flex;
  justify-content: space-between;
  margin-top: var(--space-16);
}

/* Side by side while both labels fit whole, one above the other when they don't (ticket 246). */
.phone-sheet__color-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-8);
  margin-top: var(--space-12);
}

.phone-sheet__edit {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-8);
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
