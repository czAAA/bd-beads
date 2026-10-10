/*
 * The offline shell (ticket 69, ADR 0045). vite.pwa.ts copies this file to the build as `sw.js`, filling in the two
 * placeholders below: the cache's name (it changes whenever any built file does) and the list of every built file.
 * Plain JavaScript on purpose: a worker is its own bundle, and this one needs no library.
 *
 * - Install: every built file goes into this version's own cache. If any one fails, this version does not install and
 *   the one before it keeps serving.
 * - No skipWaiting by itself: a new version waits until the page asks for it ("Update ready, reload") or until every
 *   tab of the old one is closed, so an open tab never gets new code under it.
 * - A page (index.html, the Overview) is network-first, so a visit with a connection sees the newest, and a visit with
 *   none, or with our hosting down (any answer but success), sees the copy installed with this version.
 * - Every other built file is cache-first: its name carries a hash or the whole cache changes with it.
 * - Nothing else is touched, so a call to an API or to another site goes to the network as it would without a worker.
 */

const CACHE = '__CACHE_NAME__'
const PRECACHE = '__PRECACHE__'

/** How long a page may take before the copy on the device is shown instead. Only waited out when there is no copy. */
const NETWORK_TIMEOUT_MS = 4000

const scope = new URL(self.registration.scope)
const precached = new Set(PRECACHE)

/** The built file a request is for, as a path from the scope's root, or null for anything not in the build. */
function builtFile(url) {
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return null
  let path = decodeURIComponent(url.pathname.slice(scope.pathname.length))
  if (path === '' || path.endsWith('/')) path += 'index.html'
  return precached.has(path) ? path : null
}

const urlOf = (path) => new URL(path, scope).href

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE.map((path) => new Request(urlOf(path), { cache: 'reload' })))),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name.startsWith('bd-beads-') && name !== CACHE).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting()
})

async function fromCache(path) {
  const cache = await caches.open(CACHE)
  return cache.match(urlOf(path))
}

async function networkFirst(request, path) {
  const cached = await fromCache(path)
  let answer
  try {
    const attempt = fetch(request)
    attempt.catch(() => {}) // a slow answer that loses the race and then fails is not an error to report
    answer = await (cached
      ? Promise.race([attempt, new Promise((_, reject) => setTimeout(reject, NETWORK_TIMEOUT_MS))])
      : attempt)
    if (answer.ok) return answer
  } catch {
    // No network, or too slow: the copy on the device answers.
  }
  return cached ?? answer ?? Response.error()
}

async function cacheFirst(request, path) {
  return (await fromCache(path)) ?? fetch(request)
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const path = builtFile(new URL(request.url))
  if (path === null) return
  event.respondWith(request.mode === 'navigate' ? networkFirst(request, path) : cacheFirst(request, path))
})
