<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import QrCode from './QrCode.vue'
import type { QrMatrix } from '../domain/qrExport'
import { useI18n } from '../i18n/useI18n'

/**
 * The QR export panel (ticket 68, ADR 0015): the open Pattern's code, over the page as a dialog now that the Toolbox
 * opens it (ticket 116) — the box it used to sit in is gone, and the code has to be big and unobstructed for another
 * device to scan. Escape and the backdrop close it, like the app's other dialogs.
 */
defineProps<{ matrix: QrMatrix }>()

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()

const closeButtonEl = ref<HTMLButtonElement | null>(null)

function onKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    emit('close')
  }
}

// Bound to the window rather than the dialog itself, the same as ConfirmModal and ShortcutsHelp: nothing here takes
// keyboard focus reliably enough to rely on a local keydown handler.
onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
  closeButtonEl.value?.focus()
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKeyDown))
</script>

<template>
  <div class="qr-export" data-testid="qr-export-backdrop" @click.self="emit('close')">
    <div class="qr-export__panel" data-testid="qr-export-panel" role="dialog" aria-modal="true" :aria-label="t.transfer.exportQrButton">
      <QrCode :matrix="matrix" />
      <button ref="closeButtonEl" type="button" data-testid="qr-export-close" @click="emit('close')">
        {{ t.transfer.closeQrButton }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.qr-export {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: color-mix(in srgb, var(--color-ink) 55%, transparent);
}

.qr-export__panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  max-width: 100%;
  max-height: 100%;
  overflow: auto;
  padding: 24px;
  background: var(--color-paper-solid);
  border: var(--border-width) solid var(--color-ink);
  border-radius: var(--radius-lg);
}

/* The code is a vector, so it can be drawn as large as the screen allows — a bigger code scans from further away. */
.qr-export__panel :deep(.qr-code) {
  width: min(80vw, 60vh, 480px);
  height: auto;
}
</style>
