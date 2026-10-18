import { onBeforeUnmount, onMounted } from 'vue'

// Safety net for a stroke's deferred save (tickets 55, 203; ADR 0023): a button released outside the document fires no
// mouseup, leaving the stroke in memory only, so pagehide and the shell's unmount flush it. A no-op when storage is
// current. Registers lifecycle hooks: call from a component's setup.
export function useSaveOnPageHide(flushPendingSave: () => void) {
  onMounted(() => window.addEventListener('pagehide', flushPendingSave))
  onBeforeUnmount(() => {
    window.removeEventListener('pagehide', flushPendingSave)
    flushPendingSave()
  })
}
