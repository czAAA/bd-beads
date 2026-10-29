<script setup lang="ts">
import { computed, useId } from 'vue'
import { fillBlanks } from '../../domain/fillBlanks'
import { useDialogsContext } from '../../composables/shell/useAppShell'
import ConfirmModal from '../ui/ConfirmModal.vue'
import DuplicateProjectModal from '../project/DuplicateProjectModal.vue'
import NamePieceModal from '../project/NamePieceModal.vue'
import ShortcutsHelp from './ShortcutsHelp.vue'
import ConvertImageWizard from '../import/ConvertImageWizard.vue'
import SegmentedControl from '../ui/form/SegmentedControl.vue'
import { projectNameOf } from '../../domain/layerRecord'

// The app's dialogs (ticket 0618): the registry shows one at a time, named by `open`; each flow holds what its dialog
// asks about and answers it.
const {
  t,
  open,
  activeProject,
  saveFailed,
  onCancelDeleteAll,
  onConfirmDeleteAll,
  onCancelResetProgress,
  onConfirmResetProgress,
  onCancelRemoveFrame,
  onConfirmRemoveFrame,
  removeLinePrompt,
  onCancelRemoveLine,
  onConfirmRemoveLine,
  onCancelReplaceFrame,
  onConfirmReplaceFrame,
  pendingColorRemovalHex,
  removeAllColorsMessage,
  onConfirmRemoveAllAddedColors,
  onCancelRemoveAllAddedColors,
  onCancelRemoveAddedColor,
  onConfirmRemoveAddedColor,
  replaceBeadPendingBead,
  replaceBeadConfirmMessage,
  replaceBeadAsksLayer,
  replaceBeadLayer,
  onCancelReplaceBead,
  onConfirmReplaceBead,
  pendingImport,
  pendingImportOpens,
  importSaveRefused,
  pendingRemove,
  onCancelRemove,
  onConfirmRemove,
  pendingSwitch,
  switchSaveRefused,
  onCancelSwitch,
  onConfirmSwitch,
  onSaveBeforeSwitch,
  onKeepCurrentAfterImport,
  onSwitchToImported,
  onSaveBeforeImportSwitch,
  duplicating,
  onConfirmDuplicate,
  onCancelDuplicate,
  onConfirmDelete,
  onCancelDelete,
  onConfirmDeleteAllProjects,
  onCancelDeleteAllProjects,
  naming,
  onSavePieceName,
  onCancelPieceName,
  onCloseShortcutsHelp,
  onConfirmStorageNote,
  onCancelStorageNote,
  convertImageStart,
  decodeImage,
  readClipboardImage,
  loadColorCatalog,
  onConvertImageCreate,
  onConvertImageCancel,
} = useDialogsContext()

/** Replace bead's choice of layer with a Frame (ticket 0665): the Frame's Bead first, as it is the one woven. */
const replaceBeadLayerLabel = useId()
const replaceBeadLayers = computed(() => [
  { value: 'frame' as const, label: t.value.replaceBead.layerFrame },
  { value: 'canvas' as const, label: t.value.replaceBead.layerCanvas },
])
</script>

<template>
  <ConvertImageWizard
    v-if="open === 'convert-image' && convertImageStart"
    :start="convertImageStart"
    :decode-image="decodeImage"
    :load-catalog="loadColorCatalog"
    :read-clipboard-image="readClipboardImage"
    @create="onConvertImageCreate"
    @cancel="onConvertImageCancel"
  />

  <ConfirmModal
    v-if="open === 'delete-all'"
    data-testid="delete-all-modal"
    :title="t.deleteAll.confirmTitle"
    :message="t.deleteAll.confirmMessage"
    :confirm-label="t.deleteAll.confirmButton"
    :cancel-label="t.deleteAll.cancelButton"
    @confirm="onConfirmDeleteAll"
    @cancel="onCancelDeleteAll"
  />

  <ConfirmModal
    v-if="open === 'reset-progress'"
    data-testid="reset-progress-modal"
    :title="t.rowProgress.resetConfirmTitle"
    :message="t.rowProgress.resetConfirmMessage"
    :confirm-label="t.rowProgress.resetButton"
    :cancel-label="t.rowProgress.resetConfirmCancel"
    @confirm="onConfirmResetProgress"
    @cancel="onCancelResetProgress"
  />

  <ConfirmModal
    v-if="open === 'remove-frame'"
    data-testid="remove-frame-modal"
    :title="t.frame.removeConfirmTitle"
    :message="t.frame.removeConfirmMessage"
    :confirm-label="t.frame.removeConfirmButton"
    :cancel-label="t.frame.removeConfirmCancel"
    @confirm="onConfirmRemoveFrame"
    @cancel="onCancelRemoveFrame"
  />

  <ConfirmModal
    v-if="open === 'remove-line' && removeLinePrompt"
    data-testid="remove-line-modal"
    :title="removeLinePrompt.title"
    :message="removeLinePrompt.message"
    :confirm-label="t.removeLine.confirmButton"
    :cancel-label="t.removeLine.cancelButton"
    @confirm="onConfirmRemoveLine"
    @cancel="onCancelRemoveLine"
  />

  <ConfirmModal
    v-if="open === 'replace-frame'"
    data-testid="replace-frame-modal"
    :title="t.frame.replaceConfirmTitle"
    :message="t.frame.replaceConfirmMessage"
    :confirm-label="t.frame.replaceFrame"
    :cancel-label="t.frame.removeConfirmCancel"
    @confirm="onConfirmReplaceFrame"
    @cancel="onCancelReplaceFrame"
  />

  <ConfirmModal
    v-if="open === 'remove-color' && pendingColorRemovalHex"
    data-testid="remove-color-modal"
    :title="t.palette.removeConfirmTitle"
    :message="fillBlanks(t.palette.removeConfirmMessage, { hex: pendingColorRemovalHex })"
    :confirm-label="t.palette.removeConfirmButton"
    :cancel-label="t.palette.removeCancelButton"
    @confirm="onConfirmRemoveAddedColor"
    @cancel="onCancelRemoveAddedColor"
  />

  <ConfirmModal
    v-if="open === 'remove-all-colors'"
    data-testid="remove-all-colors-modal"
    :title="t.palette.removeAllConfirmTitle"
    :message="removeAllColorsMessage"
    :confirm-label="t.palette.removeAllConfirmButton"
    :cancel-label="t.palette.removeCancelButton"
    @confirm="onConfirmRemoveAllAddedColors"
    @cancel="onCancelRemoveAllAddedColors"
  />

  <ConfirmModal
    v-if="open === 'replace-bead' && replaceBeadPendingBead"
    data-testid="replace-bead-modal"
    :title="t.replaceBead.confirmTitle"
    :message="replaceBeadConfirmMessage"
    :confirm-label="t.replaceBead.confirmButton"
    :cancel-label="t.replaceBead.cancelButton"
    @confirm="onConfirmReplaceBead"
    @cancel="onCancelReplaceBead"
  >
    <div v-if="replaceBeadAsksLayer" class="app-shell__modal-choice" data-testid="replace-bead-layer-row">
      <span :id="replaceBeadLayerLabel">{{ t.replaceBead.layerLabel }}</span>
      <SegmentedControl v-model="replaceBeadLayer" :options="replaceBeadLayers" :labelledby="replaceBeadLayerLabel" small data-testid="replace-bead-layer" />
    </div>
  </ConfirmModal>

  <!-- Import asks before switching (ticket 154). With a failed save the question is about saving first. -->
  <ConfirmModal
    v-if="open === 'import-switch' && pendingImport && pendingImportOpens && activeProject"
    data-testid="import-switch-modal"
    :title="t.importSwitch.title"
    :message="
      saveFailed
        ? fillBlanks(t.importSwitch.unsavedMessage, { current: projectNameOf(activeProject) })
        : pendingImport.length === 1
          ? fillBlanks(t.importSwitch.messageOne, { imported: projectNameOf(pendingImportOpens), current: projectNameOf(activeProject) })
          : fillBlanks(t.importSwitch.messageMany, { count: pendingImport.length, imported: projectNameOf(pendingImportOpens), current: projectNameOf(activeProject) })
    "
    :confirm-label="saveFailed ? t.importSwitch.switchAnywayButton : t.importSwitch.switchButton"
    :cancel-label="t.importSwitch.keepButton"
    :extra-label="saveFailed ? t.importSwitch.saveButton : undefined"
    :confirm-danger="false"
    @confirm="onSwitchToImported"
    @cancel="onKeepCurrentAfterImport"
    @extra="onSaveBeforeImportSwitch"
  >
    <p v-if="saveFailed && importSaveRefused" class="app-shell__modal-error" role="alert" data-testid="import-switch-save-failed">
      {{ t.storage.saveFailedMessage }}
    </p>
  </ConfirmModal>

  <!-- Saved Projects asks before removing a Project or switching to another (ticket 232). -->
  <ConfirmModal
    v-if="open === 'remove-project' && pendingRemove"
    data-testid="remove-project-modal"
    :title="t.removeProject.title"
    :message="fillBlanks(t.removeProject.message, { name: projectNameOf(pendingRemove) })"
    :confirm-label="t.removeProject.confirmButton"
    :cancel-label="t.removeProject.cancelButton"
    @confirm="onConfirmRemove"
    @cancel="onCancelRemove"
  />

  <ConfirmModal
    v-if="open === 'switch-project' && pendingSwitch && activeProject"
    data-testid="switch-project-modal"
    :title="t.switchProject.title"
    :message="
      saveFailed
        ? fillBlanks(t.importSwitch.unsavedMessage, { current: projectNameOf(activeProject) })
        : fillBlanks(t.switchProject.message, { current: projectNameOf(activeProject), picked: projectNameOf(pendingSwitch) })
    "
    :confirm-label="saveFailed ? t.importSwitch.switchAnywayButton : t.switchProject.confirmButton"
    :cancel-label="t.switchProject.cancelButton"
    :extra-label="saveFailed ? t.switchProject.saveButton : undefined"
    :confirm-danger="false"
    @confirm="onConfirmSwitch"
    @cancel="onCancelSwitch"
    @extra="onSaveBeforeSwitch"
  >
    <p v-if="saveFailed && switchSaveRefused" class="app-shell__modal-error" role="alert" data-testid="switch-project-save-failed">
      {{ t.storage.saveFailedMessage }}
    </p>
  </ConfirmModal>

  <!-- The note before the browser's storage prompt, once per device at its first save (ticket 399). -->
  <ConfirmModal
    v-if="open === 'keep-note'"
    data-testid="keep-note-modal"
    :title="t.storage.keepNote.title"
    :message="t.storage.keepNote.message"
    :confirm-label="t.storage.keepNote.confirmButton"
    :cancel-label="t.storage.keepNote.cancelButton"
    :confirm-danger="false"
    @confirm="onConfirmStorageNote"
    @cancel="onCancelStorageNote"
  />

  <ShortcutsHelp v-if="open === 'shortcuts'" @close="onCloseShortcutsHelp" />

  <!-- Duplicate and Delete this Project (ProjectPanel and ConfirmDialogs cards, ticket 443): opened from the Project panel, which has closed. -->
  <DuplicateProjectModal v-if="open === 'duplicate-project' && duplicating !== undefined" :suggested="duplicating" @confirm="onConfirmDuplicate" @cancel="onCancelDuplicate" />

  <ConfirmModal
    v-if="open === 'delete-project' && activeProject"
    data-testid="delete-project-modal"
    :title="fillBlanks(t.panels.project.deleteTitle, { name: projectNameOf(activeProject) })"
    :message="fillBlanks(t.panels.project.deleteMessage, { name: projectNameOf(activeProject) })"
    :confirm-label="t.panels.project.deleteConfirm"
    :cancel-label="t.panels.project.cancel"
    @confirm="onConfirmDelete"
    @cancel="onCancelDelete"
  />

  <ConfirmModal
    v-if="open === 'delete-all-projects'"
    data-testid="delete-all-projects-modal"
    :title="t.panels.menu.deleteAllTitle"
    :message="t.panels.menu.deleteAllMessage"
    :confirm-label="t.panels.menu.deleteAllConfirm"
    :cancel-label="t.panels.project.cancel"
    @confirm="onConfirmDeleteAllProjects"
    @cancel="onCancelDeleteAllProjects"
  />

  <NamePieceModal v-if="open === 'name-piece' && naming" :name="naming.name" @save="onSavePieceName" @cancel="onCancelPieceName" />

</template>

<style scoped>
/* A choice inside a confirmation, above its message: its label, then the control (ConfirmDialogs card, ticket 0665). */
.app-shell__modal-choice {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  margin: 0 0 var(--space-8);
  font: var(--type-control);
  color: var(--ink);
}

/* An error inside a confirmation, in the danger color (forms-and-states.md). */
.app-shell__modal-error {
  margin: 0 0 var(--space-8);
  color: var(--danger);
}
</style>
