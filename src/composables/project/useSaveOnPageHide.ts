import { onBeforeUnmount, onMounted } from 'vue'

// Safety net for a stroke's deferred save (tickets 55, 203; ADR 0020): a button released outside the document fires no
// mouseup, so pagehide and the shell's unmount flush it (a no-op when storage is current). On pagehide the writes under
// way are also noted for the next start, as one begun as the page goes may not land (ADR 0012). Call from setup.
export function useSaveOnPageHide(flushPendingSave: () => void, noteClosing: () => void = () => undefined) {
  const onPageHide = () => {
    flushPendingSave()
    noteClosing()
  }
  onMounted(() => window.addEventListener('pagehide', onPageHide))
  onBeforeUnmount(() => {
    window.removeEventListener('pagehide', onPageHide)
    flushPendingSave()
  })
}
