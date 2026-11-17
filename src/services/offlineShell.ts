// The offline shell's page side (ticket 69, ADR 0045; worker in pwa/serviceWorker.js): registers it after load and
// reports a waiting update and a sign-in that has run out. Does nothing where there is no service worker (jsdom, old
// or private browsers).

/** What the app knows of the offline shell: whether a newer version is waiting, and how to switch to it. */
export interface AppUpdates {
  /** Calls `listener` when a newer version is waiting (at once, if it already is); returns the way to stop
   * listening. */
  onReady(listener: () => void): () => void
  /** Hands the page over to the waiting version and reloads onto it. */
  apply(): void
}

/** What the app knows of the host's sign-in (Cloudflare Access), which a page from the device never meets (ticket
 * 1041). */
export interface AppSignIn {
  /** Calls `listener` when the sign-in has run out (at once, if it already has); returns the way to stop listening. */
  onRunOut(listener: () => void): () => void
  /** Loads this page through the host, so its sign-in page shows and returns here; nothing on the device changes. */
  signIn(): void
}

/** The mark on a page load that the worker sends to the host first: `SIGN_IN_MARK` in pwa/serviceWorker.js. */
const SIGN_IN_MARK = 'sign-in'

const listeners = new Set<() => void>()
let registration: ServiceWorkerRegistration | undefined
let ready = false

function notifyReady() {
  ready = true
  listeners.forEach((listener) => listener())
}

const signInListeners = new Set<() => void>()
let signInRunOut = false

/** Whether the host sends the app's own request to another origin, as Access does once its sign-in has run out. The
 * worker file is asked for: it is never in the copy on the device, and the check for a newer version needs it. */
async function hostAsksToSignIn(baseUrl: string): Promise<boolean> {
  if (!navigator.onLine) return false
  const workerFile = `${baseUrl}sw.js`
  const ask = { method: 'HEAD', cache: 'no-store' } as const
  try {
    if ((await fetch(workerFile, { ...ask, redirect: 'manual' })).type !== 'opaqueredirect') return false
  } catch {
    return false
  }
  // A redirect's target can't be read; asked to stay on this origin, only one that leaves it fails.
  return fetch(workerFile, { ...ask, mode: 'same-origin' }).then(() => false, () => true)
}

async function lookForSignIn(baseUrl: string) {
  if (!(await hostAsksToSignIn(baseUrl))) return
  signInRunOut = true
  signInListeners.forEach((listener) => listener())
}

/** Back from signing in, the address loses its mark, so a later refresh is a plain one. */
function dropSignInMark() {
  const url = new URL(location.href)
  if (!url.searchParams.has(SIGN_IN_MARK)) return
  url.searchParams.delete(SIGN_IN_MARK)
  history.replaceState(history.state, '', url.href)
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
    dropSignInMark()
    void lookForSignIn(baseUrl)
    // Asked again when a tab is brought back or the connection returns, as the check for a newer version is.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void lookForSignIn(baseUrl)
    })
    window.addEventListener('online', () => void lookForSignIn(baseUrl))
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

/** The host's sign-in as this browser sees it; `startOfflineShell` does the looking (ticket 1041). */
export const browserAppSignIn: AppSignIn = {
  onRunOut(listener) {
    signInListeners.add(listener)
    if (signInRunOut) listener()
    return () => void signInListeners.delete(listener)
  },
  signIn() {
    const url = new URL(location.href)
    url.searchParams.set(SIGN_IN_MARK, '')
    location.assign(url.href)
  },
}
