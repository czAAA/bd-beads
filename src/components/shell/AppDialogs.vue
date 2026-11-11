<script setup lang="ts">
import { computed } from 'vue'
import { fillBlanks } from '../../domain/fillBlanks'
import { useDialogsContext } from '../../composables/shell/useAppShell'
import ConfirmModal from '../ui/ConfirmModal.vue'
import DuplicateProjectModal from '../project/DuplicateProjectModal.vue'
import DeleteProjectModal from '../project/DeleteProjectModal.vue'
import NamePieceModal from '../project/NamePieceModal.vue'
import ShortcutsHelp from './ShortcutsHelp.vue'
import FeedbackSheet from './FeedbackSheet.vue'
import { projectNameOf } from '../../domain/layerRecord'
import { inMillions } from '../../domain/formatNumber'
import { useI18n } from '../../i18n/useI18n'

// The app's dialogs (ticket 0618): the registry shows one at a time, named by `open`; each flow holds what its dialog
// asks about and answers it.
const {
  t,
  open,
  activeProject,
  onConfirmRemoveReferenceImage,
  onCancelRemoveReferenceImage,
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
  onCancelReplaceBead,
  onConfirmReplaceBead,
  pendingImport,
  pendingImportOpens,
  importSaveRefused,
  pendingSwitch,
  switchSaveRefused,
  onCancelSwitch,
  onConfirmSwitch,
  onSaveBeforeSwitch,
  pendingLargeOpen,
  onConfirmLargeOpen,
  onCancelLargeOpen,
  onKeepCurrentAfterImport,
  onSwitchToImported,
  onSaveBeforeImportSwitch,
  duplicating,
  onConfirmDuplicate,
  onCancelDuplicate,
  pendingDelete,
  onConfirmDelete,
  onCancelDelete,
  onSaveFileBeforeDelete,
  onConfirmDeleteAllProjects,
  onCancelDeleteAllProjects,
  naming,
  onSavePieceName,
  onCancelPieceName,
  onCloseShortcutsHelp,
  feedbackRequest,
  onCloseFeedback,
  sendReport,
  verifyFeedback,
  copyReport,
  onConfirmStorageNote,
  onCancelStorageNote,
  onConfirmLeaveConverter,
  onCancelLeaveConverter,
} = useDialogsContext()
const { locale } = useI18n()

/** The import question's message: a failed save comes first, then a name that was taken, then what came in (ticket
 * 0860). */
const importMessage = computed(() => {
  const joined = pendingImport.value
  const opens = pendingImportOpens.value
  const current = activeProject.value
  if (!joined || !opens || !current) return ''
  const words = t.value.importSwitch
  if (saveFailed.value) return fillBlanks(words.unsavedMessage, { current: projectNameOf(current) })
  const imported = projectNameOf(opens)
  if (joined.projects.length === 1) {
    const taken = joined.takenNames.get(opens.id)
    return taken === undefined
      ? fillBlanks(words.messageOne, { imported, current: projectNameOf(current) })
      : fillBlanks(words.messageTaken, { taken, imported })
  }
  const count = joined.projects.length
  return joined.takenNames.size > 0
    ? fillBlanks(words.messageManyTaken, { count })
    : fillBlanks(words.messageMany, { count, current: projectNameOf(current) })
})
</script>

<template>
  <!-- Leaving Convert image with a picture set (ADR 0086): Back to converter is the default, so Escape and a stray Enter keep the work. -->
  <ConfirmModal
    v-if="open === 'leave-converter'"
    data-testid="leave-converter-modal"
    :title="t.convertImage.leave.title"
    :message="t.convertImage.leave.message"
    :confirm-label="t.convertImage.leave.confirmButton"
    :cancel-label="t.convertImage.leave.cancelButton"
    @confirm="onConfirmLeaveConverter"
    @cancel="onCancelLeaveConverter"
  />

  <!-- Remove image asks first (ReferenceImage card, ticket 0790): the picture goes, the beads stay. -->
  <ConfirmModal
    v-if="open === 'remove-reference-image'"
    data-testid="remove-reference-image-modal"
    :title="t.referenceImage.removeTitle"
    :message="t.referenceImage.removeMessage"
    :confirm-label="t.referenceImage.removeButton"
    :cancel-label="t.referenceImage.cancelButton"
    @confirm="onConfirmRemoveReferenceImage"
    @cancel="onCancelRemoveReferenceImage"
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
  />

  <!-- What came in is in the library; the question is whether to open it (tickets 154, 0860). With a failed save it is
       about saving first. A taken name came in under the next free number, and the message says so. -->
  <ConfirmModal
    v-if="open === 'import-switch' && pendingImport && pendingImportOpens && activeProject"
    data-testid="import-switch-modal"
    :title="fillBlanks(t.importSwitch.title, { imported: projectNameOf(pendingImportOpens) })"
    :message="importMessage"
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

  <!-- A pick in the Projects library opens at once; it asks only while the last save failed (tickets 232, 0860). -->
  <ConfirmModal
    v-if="open === 'switch-project' && pendingSwitch && activeProject"
    data-testid="switch-project-modal"
    :title="t.switchProject.title"
    :message="fillBlanks(t.importSwitch.unsavedMessage, { current: projectNameOf(activeProject) })"
    :confirm-label="t.importSwitch.switchAnywayButton"
    :cancel-label="t.switchProject.cancelButton"
    :extra-label="t.switchProject.saveButton"
    :confirm-danger="false"
    @confirm="onConfirmSwitch"
    @cancel="onCancelSwitch"
    @extra="onSaveBeforeSwitch"
  >
    <p v-if="switchSaveRefused" class="app-shell__modal-error" role="alert" data-testid="switch-project-save-failed">
      {{ t.storage.saveFailedMessage }}
    </p>
  </ConfirmModal>

  <!-- A Project over the size gate opens only when picked, after this warning (ticket 0716). -->
  <ConfirmModal
    v-if="open === 'open-large-project' && pendingLargeOpen"
    data-testid="open-large-project-modal"
    :title="fillBlanks(t.opening.largeTitle, { name: pendingLargeOpen.name })"
    :message="fillBlanks(t.opening.largeMessage, { count: inMillions(pendingLargeOpen.gatedBeads ?? 0, locale) })"
    :confirm-label="t.opening.openAnyway"
    :cancel-label="t.opening.cancelButton"
    :confirm-danger="false"
    @confirm="onConfirmLargeOpen"
    @cancel="onCancelLargeOpen"
  />

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

  <!-- A Report to the maintainer (ADR 0081, ticket 0700): from the Menu or the Bead colors list, which have closed. -->
  <FeedbackSheet
    v-if="open === 'feedback' && feedbackRequest"
    :request="feedbackRequest"
    :verify="verifyFeedback"
    :send="sendReport"
    :copy="copyReport"
    @cancel="onCloseFeedback"
  />

  <!-- Duplicate this Project (ProjectPanel and ConfirmDialogs cards, ticket 443): opened from the Project panel, which has closed. -->
  <DuplicateProjectModal v-if="open === 'duplicate-project' && duplicating !== undefined" :suggested="duplicating" @confirm="onConfirmDuplicate" @cancel="onCancelDuplicate" />

  <!-- Delete “{name}”?, the one question of every delete of a Project, wherever it starts (ticket 0842). -->
  <DeleteProjectModal
    v-if="open === 'delete-project' && pendingDelete"
    :name="pendingDelete.name"
    @confirm="onConfirmDelete"
    @cancel="onCancelDelete"
    @save-file="onSaveFileBeforeDelete"
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
/* An error inside a confirmation, in the danger color (forms-and-states.md). */
.app-shell__modal-error {
  margin: 0 0 var(--space-8);
  color: var(--danger);
}
</style>
