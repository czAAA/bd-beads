<script setup lang="ts">
import { useAppShell } from '../../composables/shell/useAppShell'
import ConfirmModal from '../ui/ConfirmModal.vue'
import NameOnExportsModal from '../export/NameOnExportsModal.vue'
import NamePieceModal from '../project/NamePieceModal.vue'
import ShortcutsHelp from './ShortcutsHelp.vue'

const {
  t,
  activeProject,
  saveFailed,
  deleteAllConfirmOpen,
  onCancelDeleteAll,
  onConfirmDeleteAll,
  removeFrameConfirmOpen,
  onCancelRemoveFrame,
  onConfirmRemoveFrame,
  pendingColorRemovalHex,
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
  makerName,
  nameOnExportsOpen,
  naming,
  onSavePieceName,
  onCancelPieceName,
  onSaveMakerName,
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
    v-if="removeFrameConfirmOpen"
    data-testid="remove-frame-modal"
    :title="t.frame.removeConfirmTitle"
    :message="t.frame.removeConfirmMessage"
    :confirm-label="t.frame.removeConfirmButton"
    :cancel-label="t.frame.removeConfirmCancel"
    @confirm="onConfirmRemoveFrame"
    @cancel="onCancelRemoveFrame"
  />

  <ConfirmModal
    v-if="pendingColorRemovalHex"
    data-testid="remove-color-modal"
    :title="t.palette.removeConfirmTitle"
    :message="t.palette.removeConfirmMessage.replace('{hex}', pendingColorRemovalHex)"
    :confirm-label="t.palette.removeConfirmButton"
    :cancel-label="t.palette.removeCancelButton"
    @confirm="onConfirmRemoveAddedColor"
    @cancel="onCancelRemoveAddedColor"
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
        ? t.importSwitch.unsavedMessage.replace('{current}', () => activeProject!.name)
        : (pendingImport.length === 1 ? t.importSwitch.messageOne : t.importSwitch.messageMany)
            .replace('{count}', () => String(pendingImport!.length))
            .replaceAll('{imported}', () => pendingImportOpens!.name)
            .replaceAll('{current}', () => activeProject!.name)
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
    :message="t.removeProject.message.replaceAll('{name}', () => pendingRemove!.name)"
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
      (saveFailed ? t.importSwitch.unsavedMessage : t.switchProject.message)
        .replaceAll('{current}', () => activeProject!.name)
        .replaceAll('{picked}', () => pendingSwitch!.name)
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

  <NamePieceModal v-if="naming" :name="naming.name" @save="onSavePieceName" @cancel="onCancelPieceName" />

  <NameOnExportsModal
    v-if="nameOnExportsOpen"
    :name="makerName"
    @save="onSaveMakerName"
    @cancel="nameOnExportsOpen = false"
  />
</template>

<style scoped>
/* An error inside a confirmation, in the danger color (forms-and-states.md). */
.app-shell__modal-error {
  margin: 0 0 var(--space-8);
  color: var(--danger);
}
</style>
