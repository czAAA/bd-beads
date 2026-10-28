<script setup lang="ts">
import { fillBlanks } from '../../domain/fillBlanks'
import { useAppShell } from '../../composables/shell/useAppShell'
import ConfirmModal from '../ui/ConfirmModal.vue'
import SwitchTechniqueModal from '../project/SwitchTechniqueModal.vue'
import DuplicateProjectModal from '../project/DuplicateProjectModal.vue'
import NamePieceModal from '../project/NamePieceModal.vue'
import ShortcutsHelp from './ShortcutsHelp.vue'

const {
  t,
  activeProject,
  saveFailed,
  deleteAllConfirmOpen,
  onCancelDeleteAll,
  onConfirmDeleteAll,
  resetProgressConfirmOpen,
  onCancelResetProgress,
  onConfirmResetProgress,
  removeFrameConfirmOpen,
  removeFrameTakesBeads,
  sizeConfirm,
  onCancelSize,
  onConfirmSize,
  onCancelRemoveFrame,
  onConfirmRemoveFrame,
  switchQuestion,
  onSetSwitchNetSize,
  onSetSwitchBrickBlock,
  onCancelSwitchTechnique,
  onConfirmSwitchTechnique,
  replaceFrameConfirmOpen,
  onCancelReplaceFrame,
  onConfirmReplaceFrame,
  pendingColorRemovalHex,
  removeAllColorsConfirmOpen,
  removeAllColorsMessage,
  onConfirmRemoveAllAddedColors,
  onCancelRemoveAllAddedColors,
  onCancelRemoveAddedColor,
  onConfirmRemoveAddedColor,
  replaceBeadPendingBead,
  replaceBeadConfirmMessage,
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
  deleting,
  onConfirmDuplicate,
  onCancelDuplicate,
  onConfirmDelete,
  onCancelDelete,
  deletingAll,
  onConfirmDeleteAllProjects,
  onCancelDeleteAllProjects,
  naming,
  onSavePieceName,
  onCancelPieceName,
  shortcutsHelpOpen,
  storageNoteOpen,
  onConfirmStorageNote,
  onCancelStorageNote,
} = useAppShell()
</script>

<template>
  <ConfirmModal
    v-if="deleteAllConfirmOpen"
    data-testid="delete-all-modal"
    :title="t.deleteAll.confirmTitle"
    :message="t.deleteAll.confirmMessage"
    :confirm-label="t.deleteAll.confirmButton"
    :cancel-label="t.deleteAll.cancelButton"
    @confirm="onConfirmDeleteAll"
    @cancel="onCancelDeleteAll"
  />

  <ConfirmModal
    v-if="resetProgressConfirmOpen"
    data-testid="reset-progress-modal"
    :title="t.rowProgress.resetConfirmTitle"
    :message="t.rowProgress.resetConfirmMessage"
    :confirm-label="t.rowProgress.resetButton"
    :cancel-label="t.rowProgress.resetConfirmCancel"
    @confirm="onConfirmResetProgress"
    @cancel="onCancelResetProgress"
  />

  <ConfirmModal
    v-if="removeFrameConfirmOpen"
    data-testid="remove-frame-modal"
    :title="t.frame.removeConfirmTitle"
    :message="removeFrameTakesBeads ? t.frame.removeConfirmCustom : t.frame.removeConfirmMessage"
    :confirm-label="t.frame.removeConfirmButton"
    :cancel-label="t.frame.removeConfirmCancel"
    @confirm="onConfirmRemoveFrame"
    @cancel="onCancelRemoveFrame"
  />

  <ConfirmModal
    v-if="sizeConfirm"
    data-testid="size-modal"
    :title="sizeConfirm.title"
    :message="sizeConfirm.message"
    :confirm-label="sizeConfirm.button"
    :cancel-label="t.frame.removeConfirmCancel"
    @confirm="onConfirmSize"
    @cancel="onCancelSize"
  />

  <SwitchTechniqueModal
    v-if="switchQuestion"
    :question="switchQuestion"
    @update:net-size="onSetSwitchNetSize"
    @update:brick-block="onSetSwitchBrickBlock"
    @confirm="onConfirmSwitchTechnique"
    @cancel="onCancelSwitchTechnique"
  />

  <ConfirmModal
    v-if="replaceFrameConfirmOpen"
    data-testid="replace-frame-modal"
    :title="t.frame.replaceConfirmTitle"
    :message="t.frame.replaceConfirmMessage"
    :confirm-label="t.frame.replaceFrame"
    :cancel-label="t.frame.removeConfirmCancel"
    @confirm="onConfirmReplaceFrame"
    @cancel="onCancelReplaceFrame"
  />

  <ConfirmModal
    v-if="pendingColorRemovalHex"
    data-testid="remove-color-modal"
    :title="t.palette.removeConfirmTitle"
    :message="fillBlanks(t.palette.removeConfirmMessage, { hex: pendingColorRemovalHex })"
    :confirm-label="t.palette.removeConfirmButton"
    :cancel-label="t.palette.removeCancelButton"
    @confirm="onConfirmRemoveAddedColor"
    @cancel="onCancelRemoveAddedColor"
  />

  <ConfirmModal
    v-if="removeAllColorsConfirmOpen"
    data-testid="remove-all-colors-modal"
    :title="t.palette.removeAllConfirmTitle"
    :message="removeAllColorsMessage"
    :confirm-label="t.palette.removeAllConfirmButton"
    :cancel-label="t.palette.removeCancelButton"
    @confirm="onConfirmRemoveAllAddedColors"
    @cancel="onCancelRemoveAllAddedColors"
  />

  <ConfirmModal
    v-if="replaceBeadPendingBead"
    data-testid="replace-bead-modal"
    :title="t.replaceBead.confirmTitle"
    :message="replaceBeadConfirmMessage"
    :confirm-label="t.replaceBead.confirmButton"
    :cancel-label="t.replaceBead.cancelButton"
    @confirm="onConfirmReplaceBead"
    @cancel="onCancelReplaceBead"
  />

  <!-- Import asks before switching (ticket 154). With a failed save the question is about saving first. -->
  <ConfirmModal
    v-if="pendingImport && pendingImportOpens && activeProject"
    data-testid="import-switch-modal"
    :title="t.importSwitch.title"
    :message="
      saveFailed
        ? fillBlanks(t.importSwitch.unsavedMessage, { current: activeProject.name })
        : pendingImport.length === 1
          ? fillBlanks(t.importSwitch.messageOne, { imported: pendingImportOpens.name, current: activeProject.name })
          : fillBlanks(t.importSwitch.messageMany, { count: pendingImport.length, imported: pendingImportOpens.name, current: activeProject.name })
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
    v-if="pendingRemove"
    data-testid="remove-project-modal"
    :title="t.removeProject.title"
    :message="fillBlanks(t.removeProject.message, { name: pendingRemove.name })"
    :confirm-label="t.removeProject.confirmButton"
    :cancel-label="t.removeProject.cancelButton"
    @confirm="onConfirmRemove"
    @cancel="onCancelRemove"
  />

  <ConfirmModal
    v-if="pendingSwitch && activeProject"
    data-testid="switch-project-modal"
    :title="t.switchProject.title"
    :message="
      saveFailed
        ? fillBlanks(t.importSwitch.unsavedMessage, { current: activeProject.name })
        : fillBlanks(t.switchProject.message, { current: activeProject.name, picked: pendingSwitch.name })
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
    v-if="storageNoteOpen"
    data-testid="keep-note-modal"
    :title="t.storage.keepNote.title"
    :message="t.storage.keepNote.message"
    :confirm-label="t.storage.keepNote.confirmButton"
    :cancel-label="t.storage.keepNote.cancelButton"
    :confirm-danger="false"
    @confirm="onConfirmStorageNote"
    @cancel="onCancelStorageNote"
  />

  <ShortcutsHelp v-if="shortcutsHelpOpen" @close="shortcutsHelpOpen = false" />

  <!-- Duplicate and Delete this Project (ProjectPanel and ConfirmDialogs cards, ticket 443): opened from the Project panel, which has closed. -->
  <DuplicateProjectModal v-if="duplicating !== undefined" :suggested="duplicating" @confirm="onConfirmDuplicate" @cancel="onCancelDuplicate" />

  <ConfirmModal
    v-if="deleting && activeProject"
    data-testid="delete-project-modal"
    :title="fillBlanks(t.panels.project.deleteTitle, { name: activeProject.name })"
    :message="fillBlanks(t.panels.project.deleteMessage, { name: activeProject.name })"
    :confirm-label="t.panels.project.deleteConfirm"
    :cancel-label="t.panels.project.cancel"
    @confirm="onConfirmDelete"
    @cancel="onCancelDelete"
  />

  <ConfirmModal
    v-if="deletingAll"
    data-testid="delete-all-projects-modal"
    :title="t.panels.menu.deleteAllTitle"
    :message="t.panels.menu.deleteAllMessage"
    :confirm-label="t.panels.menu.deleteAllConfirm"
    :cancel-label="t.panels.project.cancel"
    @confirm="onConfirmDeleteAllProjects"
    @cancel="onCancelDeleteAllProjects"
  />

  <NamePieceModal v-if="naming" :name="naming.name" @save="onSavePieceName" @cancel="onCancelPieceName" />

</template>

<style scoped>
/* An error inside a confirmation, in the danger color (forms-and-states.md). */
.app-shell__modal-error {
  margin: 0 0 var(--space-8);
  color: var(--danger);
}
</style>
