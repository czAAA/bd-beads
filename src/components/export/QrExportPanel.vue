<script setup lang="ts">
import AppButton from '../ui/AppButton.vue'
import AppModal from '../ui/AppModal.vue'
import QrCode from './QrCode.vue'
import type { QrMatrix } from '../../domain/qrExport'
import { useI18n } from '../../i18n/useI18n'

/**
 * The QR export panel (tickets 68, 151; QrExport card, ADR 0015): the open Pattern's code in a narrow Modal, with the
 * Pattern's name and size under it, one line on how to use it, and Close. The code sits on white with dark modules in
 * every theme, since scanners need the contrast; Escape and the scrim close it, like the app's other dialogs.
 */
defineProps<{
  matrix: QrMatrix
  /** The Pattern's name and size, "Fox · 40×30". */
  summary: string
}>()

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()
</script>

<template>
  <AppModal
    :title="t.saveBox.menuQr"
    size="narrow"
    scrim-testid="qr-export-backdrop"
    initial-focus="dialog"
    data-testid="qr-export-panel"
    @cancel="emit('close')"
  >
    <div class="qr-export">
      <QrCode class="qr-export__code" :matrix="matrix" />
      <p class="qr-export__summary" data-testid="qr-export-summary">{{ summary }}</p>
      <p class="qr-export__hint">{{ t.transfer.qrScanHint }}</p>
    </div>
    <template #actions>
      <AppButton variant="in-box" data-testid="qr-export-close" @click="emit('close')">
        {{ t.transfer.closeQrButton }}
      </AppButton>
    </template>
  </AppModal>
</template>

<style scoped>
.qr-export {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-8);
  text-align: center;
}

/* The code is a vector, so it takes the dialog's whole width: a bigger code scans from further away. */
.qr-export__code {
  width: 100%;
  height: auto;
  border-radius: var(--radius-md);
}

.qr-export__summary {
  font: var(--type-control);
  color: var(--ink);
}

.qr-export__hint {
  font: var(--type-body);
  color: var(--muted);
}
</style>
