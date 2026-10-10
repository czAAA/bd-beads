import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'

/**
 * Our hosting, played by the test (ticket 69): a server in front of the preview build that the test can take down (every
 * answer 503, as a failing host or a gateway in front of it would), slow down, or change a file on. The page under test
 * is opened from here instead of from the preview, so the service worker meets the same failures the real one would.
 */
export interface Host {
  /** The app's address, with the base path, like the preview's. */
  url: string
  /** While true, everything, API paths included, answers 503. */
  down: boolean
  /** Waits this long before answering a path that matches. */
  delay: { pattern: RegExp; ms: number } | null
  /** Changes a text file before it is sent (a new version of the worker, say); returns the text as it is for other paths. */
  rewrite: ((path: string, text: string) => string) | null
  close: () => Promise<void>
}

/** Starts the stand-in host in front of `upstream` (the preview's address) on a free port; `close()` it after the check. */
export async function startHost(upstream: string): Promise<Host> {
  const origin = new URL(upstream).origin
  const host: Host = { url: '', down: false, delay: null, rewrite: null, close: async () => {} }

  const server = createServer((request, response) => {
    void (async () => {
      const path = request.url ?? '/'
      if (host.delay?.pattern.test(path)) await new Promise((resolve) => setTimeout(resolve, host.delay!.ms))
      if (host.down) {
        response.writeHead(503, { 'content-type': 'text/plain' }).end('Service Unavailable')
        return
      }
      const answer = await fetch(origin + path, { headers: { 'cache-control': 'no-cache' } })
      const type = answer.headers.get('content-type') ?? 'application/octet-stream'
      const body = host.rewrite && /^text\/|javascript|json/.test(type)
        ? Buffer.from(host.rewrite(path, await answer.text()))
        : Buffer.from(await answer.arrayBuffer())
      response.writeHead(answer.status, { 'content-type': type, 'cache-control': 'no-cache' }).end(body)
    })()
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  host.url = `http://localhost:${port}${new URL(upstream).pathname}`
  host.close = () => new Promise((resolve) => server.close(() => resolve()))
  return host
}
