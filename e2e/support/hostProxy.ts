import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { securityHeaders } from '../../vite.headers'

// Our hosting, played by the test (ticket 69): a server in front of the preview build that can be taken down (503),
// slowed, or have a file changed, so the service worker meets the failures the real one would. Like Cloudflare (ticket
// 1017): `/index.html` answers a 307 to its folder, and `accessExpired` sends every request to a sign-in page.
/** The folders of the built pages (`index.html`, `app/index.html`), relative to the base path. */
const PAGE_FOLDERS = ['', 'app/']

/** The headers the build's pages are sent with (ticket 1024), passed on as the preview sends them. */
const SECURITY_HEADERS = Object.keys(securityHeaders([])).map((name) => name.toLowerCase())

function securityHeadersOf(answer: Response): Record<string, string> {
  const sent = SECURITY_HEADERS.flatMap((name) => (answer.headers.has(name) ? [[name, answer.headers.get(name)!]] : []))
  return Object.fromEntries(sent)
}

export interface Host {
  /** The app's address, with the base path, like the preview's. */
  url: string
  /** What the sign-in page says, so a check can tell it from the app and from an error page. */
  signInText: string
  /** While true, everything, API paths included, answers 503. */
  down: boolean
  /** While true, every request answers a 302 to the sign-in page of another origin, like Cloudflare Access once its
   * session has run out. */
  accessExpired: boolean
  /** Waits this long before answering a path that matches. */
  delay: { pattern: RegExp; ms: number } | null
  /** Changes a text file before it is sent (a new version of the worker, say); returns the text as it is for other
   * paths. */
  rewrite: ((path: string, text: string) => string) | null
  close: () => Promise<void>
}

/** Starts the stand-in host in front of `upstream` (the preview's address) on a free port; `close()` it after the
 * check. */
export async function startHost(upstream: string): Promise<Host> {
  const { origin, pathname: basePath } = new URL(upstream)
  const host: Host = { url: '', signInText: 'Sign in with your email', accessExpired: false, down: false, delay: null, rewrite: null, close: async () => {} }

  // Another origin (another port), as bdbeads.cloudflareaccess.com is to the app.
  const signIn = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/html' }).end(`<!doctype html><title>Sign in</title><h1>${host.signInText}</h1>`)
  })
  await new Promise<void>((resolve) => signIn.listen(0, '127.0.0.1', resolve))
  const signInUrl = `http://localhost:${(signIn.address() as AddressInfo).port}/`

  // The requests still waiting in a delay, each with what ends its wait: closing the host drops them at once, where
  // waiting them out held a check's teardown for the rest of a 20 s delay (ticket 1143).
  const waiting = new Set<() => void>()
  let closed = false
  const delayed = (ms: number) =>
    new Promise<void>((resolve) => {
      const wake = () => {
        clearTimeout(timer)
        waiting.delete(wake)
        resolve()
      }
      const timer = setTimeout(wake, ms)
      waiting.add(wake)
    })

  const server = createServer((request, response) => {
    void (async () => {
      const path = request.url ?? '/'
      if (host.delay?.pattern.test(path)) await delayed(host.delay.ms)
      if (closed) {
        response.destroy()
        return
      }
      if (host.accessExpired) {
        response.writeHead(302, { location: signInUrl }).end()
        return
      }
      if (host.down) {
        response.writeHead(503, { 'content-type': 'text/plain' }).end('Service Unavailable')
        return
      }
      // Cloudflare's static assets send a page's own file name to its folder (the default HTML handling).
      // The target is picked from the built pages' folders, never built from the request.
      const folder = PAGE_FOLDERS.find((candidate) => path.split('?')[0] === `${basePath}${candidate}index.html`)
      if (folder !== undefined) {
        response.writeHead(307, { location: basePath + folder }).end()
        return
      }
      const answer = await fetch(origin + path, { headers: { 'cache-control': 'no-cache' } })
      const type = answer.headers.get('content-type') ?? 'application/octet-stream'
      const body = host.rewrite && /^text\/|javascript|json/.test(type)
        ? Buffer.from(host.rewrite(path, await answer.text()))
        : Buffer.from(await answer.arrayBuffer())
      response.writeHead(answer.status, { 'content-type': type, 'cache-control': 'no-cache', ...securityHeadersOf(answer) }).end(body)
    })()
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  host.url = `http://localhost:${port}${basePath}`
  host.close = () =>
    new Promise((resolve) => {
      closed = true
      for (const wake of [...waiting]) wake()
      signIn.close()
      server.close(() => resolve())
      // A browser keeps its connections open between requests; closing waits for none of them.
      signIn.closeAllConnections()
      server.closeAllConnections()
    })
  return host
}
