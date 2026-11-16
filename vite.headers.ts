import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { Plugin } from 'vite'

// The headers the build's pages and files are sent with (ticket 1024): no other site may frame the app, and a script
// that got into a page can load and send nothing. Cloudflare reads them from `_headers`; `vite preview` sends the same.

/** The file Cloudflare's static assets read their headers from, next to index.html; the host never serves it. */
export const HEADERS_FILE = '_headers'

/** Turnstile's script and frame (the Feedback sheet's check): the only other origin a page loads from. */
const TURNSTILE = 'https://challenges.cloudflare.com'

/** A script element as a browser reads it: tags in any case, and an end tag that may hold a space (`</script >`). A
 * script this missed would only be refused by the policy, never let through. */
const SCRIPT = /<script\b([^>]*)>([\s\S]*?)<\/script\b[^>]*>/gi

/** The `'sha256-…'` source of every inline script in `html`, in order: what a policy names to let that script run. */
export function inlineScriptHashes(html: string): string[] {
  return [...html.matchAll(SCRIPT)]
    .filter(([, attributes]) => !/\bsrc\s*=/i.test(attributes ?? ''))
    .map(([, , text]) => `'sha256-${createHash('sha256').update(text ?? '').digest('base64')}'`)
}

/** The headers for every page and file of a build whose pages are `pages`. Scripts run from the app's own files, the
 * pages' inline scripts by hash (they must run before first paint) and Turnstile, never `'unsafe-inline'`. Styles keep
 * it: the splash, the handoff's strip and Turnstile's widget carry inline styles, and a style can't run code. */
export function securityHeaders(pages: string[]): Record<string, string> {
  const hashes = [...new Set(pages.flatMap(inlineScriptHashes))]
  const policy = [
    "default-src 'self'",
    `script-src ${["'self'", ...hashes, TURNSTILE].join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    // Pictures the person picked or the app drew (blob:), and the cursors and marks drawn in CSS (data:).
    "img-src 'self' blob: data:",
    `frame-src ${TURNSTILE}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ')
  return {
    'Content-Security-Policy': policy,
    'X-Content-Type-Options': 'nosniff',
    // For a browser that doesn't read `frame-ancestors`.
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  }
}

/** The headers as Cloudflare's `_headers` file: one rule, for every path. */
export function renderHeadersFile(headers: Record<string, string>): string {
  return ['/*', ...Object.entries(headers).map(([name, value]) => `  ${name}: ${value}`), ''].join('\n')
}

/** The headers of the build in `dir`, from the pages as they were built: a changed inline script changes its hash. */
function headersOf(dir: string): Record<string, string> {
  const pages = readdirSync(dir, { recursive: true, encoding: 'utf8' }).filter((path) => path.endsWith('.html')).sort()
  return securityHeaders(pages.map((path) => readFileSync(join(dir, path), 'utf8')))
}

/** Writes `_headers` into the build once its pages are there, and has `vite preview` send the same headers, so the
 * browser checks (e2e) run under the policy the deployed app has. */
export function pageHeaders(): Plugin {
  let outDir = ''
  let building = false
  return {
    name: 'bd-beads:page-headers',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
      building = config.command === 'build'
    },
    closeBundle: {
      order: 'post',
      handler() {
        // A dev server closing calls this too, with no build to read.
        if (building) writeFileSync(join(outDir, HEADERS_FILE), renderHeadersFile(headersOf(outDir)))
      },
    },
    configurePreviewServer(server) {
      // Read per request: a preview left running serves the next build too, with other hashes.
      server.middlewares.use((_request, response, next) => {
        for (const [name, value] of Object.entries(headersOf(outDir))) response.setHeader(name, value)
        next()
      })
    },
  }
}
