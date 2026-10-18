// The offline shell's page side (ticket 69, ADR 0045; worker in pwa/serviceWorker.js): registers it after load and
// reports a waiting update. Does nothing where there is no service worker (jsdom, old or private browsers).

/** What the app knows of the offline shell: whether a newer version is waiting, and how to switch to it. */
export interface AppUpdates {
  /** Calls `listener` when a newer version is waiting (at once, if it already is); returns the way to stop
   * listening. */
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

// Registers the worker at `baseUrl` after load in a production build. Never asks for persistent storage: that waits for
// a first save (ticket 399).
export function startOfflineShell(baseUrl: string): void {
  if (!import.meta.env.PROD) return
  const start = () => {
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker
      .register(`${baseUrl}sw.js`, { scope: baseUrl, updateViaCache: 'none' })
      .then(watchForUpdates)
      .catch(() => {
        // The page works without the worker; it just won't open offline.
      })
  }
  if (document.readyState === 'complete') start()
  else window.addEventListener('load', start, { once: true })
}

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
