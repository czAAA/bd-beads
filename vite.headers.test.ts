import { describe, expect, it } from 'vitest'
import { inlineScriptHashes, renderHeadersFile, securityHeaders } from './vite.headers.ts'

// Ticket 1024: the headers the build's pages are sent with. The hashes are worked out by hand (`openssl dgst -sha256
// -binary | base64` of the script's text), so they can disagree with the code.
const HELLO = "'sha256-qznLcsROx4GACP2dm0UCKCzCG+HiZ1guq6ZZDob/Tng='"
const VAR_A = "'sha256-h1HrJPkDwnmmTjhElzuRBLDNtr5UPz5PinuqE+ovmj8='"

const page = `<!doctype html><head><script>alert('Hello, world.');</script>
<script data-handoff>var a = 1</script><script type="module" crossorigin src="/assets/app.js"></script></head>`

/** One directive of a policy, as its list of sources. */
function directive(policy: string, name: string): string[] {
  const found = policy.split('; ').find((part) => part.startsWith(`${name} `))
  return found ? found.split(' ').slice(1) : []
}

describe('inlineScriptHashes', () => {
  it("names each inline script by its text's hash, attributes or not, and no script that is a file", () => {
    expect(inlineScriptHashes(page)).toEqual([HELLO, VAR_A])
  })
})

describe('securityHeaders', () => {
  const headers = securityHeaders([page, "<script>alert('Hello, world.');</script>"])
  const policy = headers['Content-Security-Policy']

  it('lets scripts run only from the app, each page\'s inline scripts by hash, and Turnstile', () => {
    expect(directive(policy, 'script-src')).toEqual(["'self'", HELLO, VAR_A, 'https://challenges.cloudflare.com'])
  })

  it('keeps everything else to the app, with Turnstile the only frame and pictures from blob: and data: too', () => {
    expect(directive(policy, 'default-src')).toEqual(["'self'"])
    expect(directive(policy, 'frame-src')).toEqual(['https://challenges.cloudflare.com'])
    expect(directive(policy, 'img-src')).toEqual(["'self'", 'blob:', 'data:'])
    expect(directive(policy, 'object-src')).toEqual(["'none'"])
    expect(directive(policy, 'base-uri')).toEqual(["'self'"])
    expect(directive(policy, 'form-action')).toEqual(["'self'"])
  })

  it('lets no other site show the app in a frame, nor a browser guess a type or pass the address on', () => {
    expect(directive(policy, 'frame-ancestors')).toEqual(["'none'"])
    expect(headers['X-Frame-Options']).toBe('DENY')
    expect(headers['X-Content-Type-Options']).toBe('nosniff')
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin')
  })
})

describe('renderHeadersFile', () => {
  it("writes one rule for every path, as Cloudflare's static assets read it", () => {
    expect(renderHeadersFile({ 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer' })).toBe(
      '/*\n  X-Frame-Options: DENY\n  Referrer-Policy: no-referrer\n',
    )
  })
})
