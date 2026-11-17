// The offline shell's page side (ticket 69, ADR 0045; worker in pwa/serviceWorker.js): registers it after load and
// reports a waiting update, with what it brings, and a sign-in that has run out. Does nothing where there is no service
// worker (jsdom, old or private browsers).
import { BUILD_VERSION } from '../data/build'
import type { Locale } from '../domain/locale'
import { whatWaits, type WhatWaits } from '../domain/waitingBuild'

/** What the app knows of the offline shell: what a waiting newer Build brings, and how to switch to it. */
export interface AppUpdates {
  /** Calls `listener` with what waits, in `locale()`'s words, once a Build with another Version is waiting (at once, if
   * one already is), and again when a newer one takes its place (ticket 1048). A Build with the page's own Version
   * calls nothing. Returns the way to stop listening. */
  onReady(locale: () => Locale, listener: (waits: WhatWaits) => void): () => void
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

/** The question a waiting worker answers (ticket 1048): `ASK_NOTES` in pwa/serviceWorker.js. */
const ASK_NOTES = 'NOTES'
/** How long the waiting worker has to answer before the toast says only "Update ready". @internal tests wait it out. */
export const ASK_NOTES_MS = 2000

/** The waiting worker's notes file in `locale`, from its own copy over a port of its own; null with no answer in time. */
function askNotes(worker: ServiceWorker, locale: Locale): Promise<unknown> {
  return new Promise((resolve) => {
    const channel = new MessageChannel()
    const answer = (notes: unknown) => {
      clearTimeout(timer)
      channel.port1.close()
      resolve(notes)
    }
    const timer = setTimeout(() => answer(null), ASK_NOTES_MS)
    channel.port1.onmessage = (event) => answer(event.data)
    try {
      worker.postMessage({ type: ASK_NOTES, locale }, [channel.port2])
    } catch {
      answer(null)
    }
  })
}

/** A listener, and how many times it has been asked for: only the answer to its latest question reaches it. */
interface UpdateWatcher {
  locale: () => Locale
  listener: (waits: WhatWaits) => void
  asked: number
}

const watchers = new Set<UpdateWatcher>()
let registration: ServiceWorkerRegistration | undefined
/** The worker that waits with a newer Build, once one does. */
let waitingWorker: ServiceWorker | undefined

/** Asks `worker` what it brings for one listener, and tells it unless the Build has the page's own Version. */
async function tell(watcher: UpdateWatcher, worker: ServiceWorker) {
  const asked = ++watcher.asked
  const waits = whatWaits(await askNotes(worker, watcher.locale()), BUILD_VERSION)
  if (waits !== null && asked === watcher.asked && watchers.has(watcher)) watcher.listener(waits)
}

function notifyReady(worker: ServiceWorker) {
  waitingWorker = worker
  watchers.forEach((watcher) => void tell(watcher, worker))
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
  if (found.waiting && navigator.serviceWorker.controller) notifyReady(found.waiting)
  found.addEventListener('updatefound', () => {
    const installing = found.installing
    installing?.addEventListener('statechange', () => {
      if (installing.state === 'installed' && navigator.serviceWorker.controller) notifyReady(installing)
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
  onReady(locale, listener) {
    const watcher: UpdateWatcher = { locale, listener, asked: 0 }
    watchers.add(watcher)
    if (waitingWorker) void tell(watcher, waitingWorker)
    return () => void watchers.delete(watcher)
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
