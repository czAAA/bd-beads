/**
 * The offline shell's side in the page (ticket 69, ADR 0045; the worker itself is pwa/serviceWorker.js): registers the
 * worker once the app has loaded, so the offline copy downloads silently behind the app, asks the browser to keep the
 * library, and tells the app when a newer version is waiting. Everything here does nothing where the browser has no
 * service worker (jsdom, an old browser, a private window that refuses it): the app just isn't offline-capable there.
 */

/** What the app knows of the offline shell: whether a newer version is waiting, and how to switch to it. */
export interface AppUpdates {
  /** Calls `listener` when a newer version is waiting (at once, if it already is); returns the way to stop listening. */
  onReady(listener: () => void): () => void
  /** Hands the page over to the waiting version and reloads onto it. */
  apply(): void
}

const listeners = new Set<() => void>()
let registration: ServiceWorkerRegistration | undefined
let ready = false

function notifyReady() {
  ready = true
  listeners.forEach((listener) => listener())
}

/** A worker that installs while an older one controls the page is an update; the first install is not. */
function watchForUpdates(found: ServiceWorkerRegistration) {
  registration = found
  if (found.waiting && navigator.serviceWorker.controller) notifyReady()
  found.addEventListener('updatefound', () => {
    const installing = found.installing
    installing?.addEventListener('statechange', () => {
      if (installing.state === 'installed' && navigator.serviceWorker.controller) notifyReady()
    })
  })
  // The browser looks for a new worker when a page loads; a tab left open for days looks again when it is brought back.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void found.update().catch(() => {})
  })
}

/**
 * Registers the worker found at `baseUrl` once the page has loaded, and asks for persistent storage so the library is
 * not cleared when the device is short of space (the privacy copy says so; ticket 82). Called by each page's entry.
 */
export function startOfflineShell(baseUrl: string): void {
  if (!('serviceWorker' in navigator)) return
  const register = () => {
    navigator.serviceWorker
      .register(`${baseUrl}sw.js`, { scope: baseUrl, updateViaCache: 'none' })
      .then(watchForUpdates)
      .catch(() => {
        // The page works without the worker; it just won't open offline.
      })
    void navigator.storage?.persist?.().catch(() => {})
  }
  if (document.readyState === 'complete') register()
  else window.addEventListener('load', register, { once: true })
}

/** The page's view of the worker's updates: one set of listeners for the whole page, however many composables ask. */
export const browserAppUpdates: AppUpdates = {
  onReady(listener) {
    listeners.add(listener)
    if (ready) listener()
    return () => void listeners.delete(listener)
  },
  apply() {
    const waiting = registration?.waiting
    if (!waiting) {
      location.reload()
      return
    }
    // Only this tab follows the new worker; another open tab keeps its own page until it is reloaded.
    navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true })
    waiting.postMessage({ type: 'SKIP_WAITING' })
  },
}
