<script setup lang="ts">
import { useAppShell } from '../../composables/shell/useAppShell'
import { summarizePattern } from '../../domain/pattern'
import ChangeSizeModal from '../pattern/ChangeSizeModal.vue'
import ConfirmModal from '../ui/ConfirmModal.vue'
import NameOnExportsModal from '../export/NameOnExportsModal.vue'
import QrExportPanel from '../export/QrExportPanel.vue'
import ShortcutsHelp from './ShortcutsHelp.vue'

const {
  t,
  activePattern,
  saveFailed,
  deleteAllConfirmOpen,
  onCancelDeleteAll,
  onConfirmDeleteAll,
  changeSizeOpen,
  onConfirmChangeSize,
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
  qrExport,
  makerName,
  nameOnExportsOpen,
  onSaveMakerName,
  shortcutsHelpOpen,
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
    v-if="replaceBeadPendingBead"
    data-testid="replace-bead-modal"
    :title="t.replaceBead.confirmTitle"
    :message="replaceBeadConfirmMessage"
    :confirm-label="t.replaceBead.confirmButton"
    :cancel-label="t.replaceBead.cancelButton"
    @confirm="onConfirmReplaceBead"
    @cancel="onCancelReplaceBead"
  />

  <ChangeSizeModal
    v-if="changeSizeOpen && activePattern"
    :pattern="activePattern"
    @confirm="onConfirmChangeSize"
    @cancel="changeSizeOpen = false"
  />

  <!-- Import asks before switching (ticket 154). With a failed save the question is about saving first. -->
  <ConfirmModal
    v-if="pendingImport && pendingImportOpens && activePattern"
    data-testid="import-switch-modal"
    :title="t.importSwitch.title"
    :message="
      saveFailed
        ? t.importSwitch.unsavedMessage.replace('{current}', () => activePattern!.name)
        : (pendingImport.length === 1 ? t.importSwitch.messageOne : t.importSwitch.messageMany)
            .replace('{count}', () => String(pendingImport!.length))
            .replaceAll('{imported}', () => pendingImportOpens!.name)
            .replaceAll('{current}', () => activePattern!.name)
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

  <!-- Saved Patterns asks before removing a Pattern or switching to another (ticket 232). -->
  <ConfirmModal
    v-if="pendingRemove"
    data-testid="remove-pattern-modal"
    :title="t.removePattern.title"
    :message="t.removePattern.message.replaceAll('{name}', () => pendingRemove!.name)"
    :confirm-label="t.removePattern.confirmButton"
    :cancel-label="t.removePattern.cancelButton"
    @confirm="onConfirmRemove"
    @cancel="onCancelRemove"
  />

  <ConfirmModal
    v-if="pendingSwitch && activePattern"
    data-testid="switch-pattern-modal"
    :title="t.switchPattern.title"
    :message="
      (saveFailed ? t.importSwitch.unsavedMessage : t.switchPattern.message)
        .replaceAll('{current}', () => activePattern!.name)
        .replaceAll('{picked}', () => pendingSwitch!.name)
    "
    :confirm-label="saveFailed ? t.importSwitch.switchAnywayButton : t.switchPattern.confirmButton"
    :cancel-label="t.switchPattern.cancelButton"
    :extra-label="saveFailed ? t.switchPattern.saveButton : undefined"
    :confirm-danger="false"
    @confirm="onConfirmSwitch"
    @cancel="onCancelSwitch"
    @extra="onSaveBeforeSwitch"
  >
    <p v-if="saveFailed && switchSaveRefused" class="app-shell__modal-error" role="alert" data-testid="switch-pattern-save-failed">
      {{ t.storage.saveFailedMessage }}
    </p>
  </ConfirmModal>

  <QrExportPanel
    v-if="qrExport.panelOpen.value && activePattern"
    :matrix="qrExport.matrix.value!"
    :summary="summarizePattern(activePattern)"
    @close="qrExport.close"
  />

  <ShortcutsHelp v-if="shortcutsHelpOpen" @close="shortcutsHelpOpen = false" />

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
