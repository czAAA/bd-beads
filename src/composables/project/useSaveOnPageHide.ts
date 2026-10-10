import { onBeforeUnmount, onMounted } from 'vue'

/**
 * The safety net for a stroke's deferred save (tickets 55, 203; ADR 0023): endStroke normally writes it, on the mouseup
 * the app shell hears, but a button released outside the document -- dragging off the window edge to paint the last
 * column -- fires no mouseup anywhere on the page, leaving that stroke in memory only. Any later edit would carry it (a
 * save writes the whole library), so the one thing that could actually lose it is leaving the page first: the page's
 * pagehide and the shell's unmount flush it. A no-op whenever storage is already up to date. Registers its own
 * lifecycle hooks, so it must be called from a component's setup.
 */
export function useSaveOnPageHide(flushPendingSave: () => void) {
  onMounted(() => window.addEventListener('pagehide', flushPendingSave))
  onBeforeUnmount(() => {
    window.removeEventListener('pagehide', flushPendingSave)
    flushPendingSave()
  })
}
