<script setup lang="ts">
import { computed } from 'vue'
import AppButton from './AppButton.vue'
import AppIcon from './AppIcon.vue'
import AppLink from './AppLink.vue'
import AppSelect from './AppSelect.vue'
import BeadPill from './BeadPill.vue'
import BeadQuantities from './BeadQuantities.vue'
import BottomSheet from './BottomSheet.vue'
import CustomColorPicker from './CustomColorPicker.vue'
import IconButton from './IconButton.vue'
import ImageColorsButton from './ImageColorsButton.vue'
import NewPatternForm from './NewPatternForm.vue'
import PalettePicker from './PalettePicker.vue'
import PatternImport from './PatternImport.vue'
import PatternList from './PatternList.vue'
import SaveBox from './SaveBox.vue'
import SizeControls from './SizeControls.vue'
import ThemeToggle from './ThemeToggle.vue'
import { useAppShell } from '../composables/useAppShell'
import { beadLabel } from '../domain/beads'
import type { Tool } from '../domain/tool'
import { TOOL_ICONS, TOOL_ORDER } from './toolIcons'

const {
  t,
  patterns,
  activePatternId,
  activePattern,
  saveFailed,
  removePattern,
  activeBeadLabel,
  settledPattern,
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
  pasteProjectionActive,
  onCopy,
  onToggleRotate,
  onRequestDeleteAll,
  onRequestChangeSize,
  canRemoveSelectedLine,
  onRemoveSelectedLine,
  replaceBeadCandidates,
  onPickReplaceBead,
  onImportPatterns,
  qrExport,
  makerName,
  nameOnExportsOpen,
  exporting,
  onExportPatternFile,
  onExportPng,
  onExportPdf,
  onSave,
  openPhoneSheet,
  themeSheetOpen,
  phoneNewPatternOpen,
  phoneSavedPatternsOpen,
  onSelectPatternFromPhoneDrawer,
} = useAppShell()

/** The phone Tool sheet's four tiles (ToolSheet card), same order and icons as everywhere else the four tools list themselves. */
const phoneTools = computed(() => TOOL_ORDER.map((id) => ({ id, icon: TOOL_ICONS[id], label: toolLabel(id) })))

function toolLabel(tool: Tool): string {
  return { paint: t.value.tools.paintLabel, fill: t.value.tools.fillLabel, select: t.value.tools.selectLabel, erase: t.value.tools.eraseLabel }[tool]
}
</script>

<template>
  <BottomSheet v-if="openPhoneSheet === 'tool' && activePattern" :title="t.toolbox.groups.tools" @close="openPhoneSheet = null">
    <div class="phone-sheet__tiles">
      <button
        v-for="tool in phoneTools"
        :key="tool.id"
        type="button"
        class="ui-control phone-sheet__tile"
        :class="{ 'phone-sheet__tile--active': activeTool === tool.id }"
        :data-testid="`sheet-tool-${tool.id}`"
        :aria-pressed="activeTool === tool.id"
        @click="onSelectTool(tool.id)"
      >
        <AppIcon :name="tool.icon" :size="22" />
        <span>{{ tool.label }}</span>
      </button>
    </div>
    <div class="phone-sheet__links">
      <AppLink icon="remove-line" :disabled="!canRemoveSelectedLine" data-testid="sheet-remove-line" @click="onRemoveSelectedLine(); openPhoneSheet = null">
        {{ t.tools.removeLineShort }}
      </AppLink>
      <AppLink icon="delete" danger data-testid="sheet-delete-all" @click="onRequestDeleteAll(); openPhoneSheet = null">
        {{ t.deleteAll.button }}
      </AppLink>
    </div>
  </BottomSheet>

  <BottomSheet v-if="openPhoneSheet === 'color' && activePattern" :title="t.toolbox.groups.colors" @close="openPhoneSheet = null">
    <PalettePicker :selected-color-id="selectedColorId" @select="onSelectColor" />
    <div class="phone-sheet__color-buttons">
      <CustomColorPicker
        :color="customColor"
        :selected="!selectedColorId && !selectedImageColor && !!customColor"
        @select="onSelectCustomColor"
      />
      <ImageColorsButton :colors="activePattern.imageColors" :selected-color="selectedImageColor" @select="onSelectImageColor" />
    </div>
  </BottomSheet>

  <BottomSheet v-if="openPhoneSheet === 'edit' && activePattern" :title="t.toolbox.groups.edit" @close="openPhoneSheet = null">
    <div class="phone-sheet__edit">
      <IconButton icon="undo" variant="toolbox" size="lg" :label="t.palette.undoButton" :disabled="!canUndo" @click="onUndo" />
      <IconButton icon="redo" variant="toolbox" size="lg" :label="t.palette.redoButton" :disabled="!canRedo" @click="onRedo" />
      <IconButton icon="rotate" variant="toolbox" size="lg" :label="t.palette.rotateButton" :selected="activePattern.rotation !== 0" @click="onToggleRotate" />
      <IconButton icon="copy" variant="toolbox" size="lg" :label="t.tools.copyButton" :disabled="!selection" @click="onCopy" />
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

  <BottomSheet v-if="openPhoneSheet === 'size' && activePattern" :title="t.toolbox.groups.size" @close="openPhoneSheet = null">
    <SizeControls :pattern="activePattern" @change-size="onRequestChangeSize" />
  </BottomSheet>

  <!--
    The Pattern sheet (PhoneForms, ToolSheet cards): modal, taller, with a scrim -- an accidental tap past its edge
    shouldn't lose the way back to New Pattern or Import, unlike the five light sheets above.
  -->
  <BottomSheet v-if="openPhoneSheet === 'pattern'" modal :title="t.header.patternSheetLabel" @close="openPhoneSheet = null; phoneSavedPatternsOpen = false">
    <template v-if="activePattern">
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
    </template>
    <div class="phone-sheet__pattern-actions">
      <!-- New Pattern: never disabled -- with no Patterns yet this is the only way to reach the form (the wider tiers show it inline by default). -->
      <AppButton variant="primary" icon="plus" data-testid="phone-new-pattern-button" @click="phoneNewPatternOpen = true">
        {{ t.patterns.newPatternButton }}
      </AppButton>
      <PatternImport compact :patterns="patterns" testid-prefix="pattern-sheet-" @import="onImportPatterns" />
      <IconButton
        icon="library"
        :label="t.patterns.heading"
        :disabled="patterns.length === 0"
        data-testid="phone-saved-patterns-button"
        @click="phoneSavedPatternsOpen = true"
      />
    </div>
  </BottomSheet>

  <!-- New Pattern (PhoneForms card): its own full-height modal sheet from the Pattern sheet, the same form the wider tiers show inline. -->
  <BottomSheet v-if="phoneNewPatternOpen" modal :title="t.patterns.newPatternButton" @close="phoneNewPatternOpen = false">
    <NewPatternForm
      @submit="(payload) => { onCreatePattern(payload); phoneNewPatternOpen = false; openPhoneSheet = null }"
      @draft="onNewPatternDraft"
      @convert-image="(draft) => { startConvertImage(draft); phoneNewPatternOpen = false; openPhoneSheet = null }"
    />
  </BottomSheet>

  <!-- Saved Patterns: a non-modal sheet opened from the Pattern sheet's Saved Patterns icon. Selecting a pattern closes both this and the Pattern sheet. -->
  <BottomSheet v-if="phoneSavedPatternsOpen" :title="t.patterns.heading" @close="phoneSavedPatternsOpen = false">
    <PatternList
      :patterns="patterns"
      :active-pattern-id="activePatternId"
      @select="onSelectPatternFromPhoneDrawer"
      @remove="removePattern"
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
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-8);
}

.phone-sheet__tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-6);
  height: 4.5rem;
  color: var(--body);
  background: var(--elevated);
  border: 1px solid var(--panel-line);
  border-radius: var(--radius-md);
  cursor: pointer;
}

.phone-sheet__tile--active {
  color: var(--accent-strong);
  border-color: var(--accent-strong);
}

.phone-sheet__tile:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: 2px;
}

.phone-sheet__links {
  display: flex;
  justify-content: space-between;
  margin-top: var(--space-16);
}

.phone-sheet__color-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
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

.phone-sheet__pattern-actions {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--space-8);
  margin-top: var(--space-16);
  padding-top: var(--space-16);
  border-top: 1px solid var(--line-soft);
}

.phone-sheet__pattern-actions .app-button {
  flex: 1 1 0;
}
</style>
