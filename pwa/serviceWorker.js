// The offline shell (ticket 69, ADR 0045). vite.pwa.ts copies this to the build as `sw.js`, filling in cache and files.
// Install caches every built file as a plain answer, all or nothing; no skipWaiting; a built file, pages included,
// comes from the copy on the device (ticket 1041); anything else goes to the network. Plain JS: no library.

const CACHE = '__CACHE_NAME__'
const PRECACHE = '__PRECACHE__'

/** The mark on a page load that asks the host, so Cloudflare Access can show its sign-in page (ticket 1041). The page
 * side sets it: `SIGN_IN_MARK` in src/services/offlineShell.ts. */
const SIGN_IN_MARK = 'sign-in'

/** The one question a waiting worker answers, what it brings, with its own notes file (ticket 1048): `ASK_NOTES` in
 * src/services/offlineShell.ts. */
const ASK_NOTES = 'NOTES'

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

async function fromCache(path) {
  const cache = await caches.open(CACHE)
  return cache.match(urlOf(path))
}

/** This copy's notes file in `locale` (ticket 1047), read from its own cache, never the network; null if it has none. */
async function notesOf(locale) {
  const path = `notes/${locale}.json`
  const answer = precached.has(path) ? await fromCache(path) : undefined
  return answer ? answer.json() : null
}

self.addEventListener('message', (event) => {
  const data = event.data
  if (data && data.type === 'SKIP_WAITING') self.skipWaiting()
  // What this copy brings: the page works out from the file which Version and notes wait; the worker knows none.
  const port = event.ports && event.ports[0]
  if (data && data.type === ASK_NOTES && port) {
    event.waitUntil(notesOf(String(data.locale)).catch(() => null).then((notes) => port.postMessage(notes)))
  }
})

/** A built file from the copy on the device, so a refresh keeps the version the person is on (ticket 1041). The
 * network answers only when there is no copy. */
async function fromDevice(request, path) {
  return (await fromCache(path)) ?? fetch(request)
}

/** A page load marked Sign in asks the host first. A redirect (Access sending the person to sign in) goes to the
 * browser; any other answer is dropped for the copy on the device, so signing in never changes the version. */
async function signInOrPage(request, path) {
  const answer = await fetch(request).catch(() => null)
  return answer && answer.type === 'opaqueredirect' ? answer : fromDevice(request, path)
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  const path = builtFile(url)
  if (path === null) return
  const signIn = request.mode === 'navigate' && url.searchParams.has(SIGN_IN_MARK)
  event.respondWith(signIn ? signInOrPage(request, path) : fromDevice(request, path))
})
