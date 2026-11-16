// The offline shell (ticket 69, ADR 0045). vite.pwa.ts copies this to the build as `sw.js`, filling in cache and files.
// Install caches every built file as a plain answer, all or nothing; no skipWaiting; pages are network-first, other
// built files cache-first (hashed names); anything else goes to the network. Plain JS: no library.

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

/** The answer as a plain one. Cloudflare answers `/index.html` with a redirect to `/`, and a response that followed a
 * redirect is marked as such: a browser refuses it as the answer to a page load (ERR_FAILED), so it is rebuilt from
 * its content. */
async function plain(answer) {
  if (!answer.redirected) return answer
  return new Response(await answer.blob(), { status: answer.status, statusText: answer.statusText, headers: answer.headers })
}

/** Fetches every built file, then keeps them all or none. */
async function precache() {
  const answers = await Promise.all(
    PRECACHE.map(async (path) => {
      const answer = await fetch(new Request(urlOf(path), { cache: 'reload' }))
      if (!answer.ok) throw new Error(`${path}: ${answer.status}`)
      return [path, await plain(answer)]
    }),
  )
  // A failed put fails the install: the worker never takes over, so a half-filled cache is never served.
  const cache = await caches.open(CACHE)
  await Promise.all(answers.map(([path, answer]) => cache.put(urlOf(path), answer)))
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache())
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
    // Only a server error falls back to the copy (owner's rule, ticket 1017). Anything else goes to the browser as it
    // is, a redirect above all: Cloudflare Access sending a person whose session ran out to sign in.
    if (answer.status < 500) return answer
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
