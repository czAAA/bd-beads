import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Report } from '../domain/feedbackReport'
import { browserFeedback, reportOutcome, TURNSTILE_SITE_KEY } from './feedback'

const report: Report = {
  kind: 'general',
  fields: { message: 'The Row progress bar jumps back.' },
  context: { appVersion: '1.4.0', uiLanguage: 'en', browser: 'Firefox', os: 'Android', viewport: '412 × 915' },
}
const verification = { token: async () => 'token-1', dispose: () => {} }

const answer = (status: number, body: unknown = {}, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })

afterEach(() => vi.unstubAllGlobals())

describe('reportOutcome', () => {
  it('reads the Worker’s answers: sent, switched off, rate-limited with its wait, and any other refusal as failed', async () => {
    expect(await reportOutcome(answer(201, { sent: true }))).toEqual({ sent: true })
    expect(await reportOutcome(answer(503, { error: 'feature-off', feature: 'feedback' }, { 'Retry-After': '900' }))).toEqual({
      sent: false,
      reason: 'off',
      retryAfterSeconds: 900,
    })
    expect(await reportOutcome(answer(429, { error: 'rate-limited' }, { 'Retry-After': '60' }))).toEqual({
      sent: false,
      reason: 'rate-limited',
      retryAfterSeconds: 60,
    })
    for (const status of [400, 403, 502, 503]) expect(await reportOutcome(answer(status, { error: 'x' }))).toEqual({ sent: false, reason: 'failed' })
  })
})

describe('browserFeedback.send', () => {
  it('posts the Report as JSON with the Turnstile token in X-Turnstile-Token', async () => {
    const fetch = vi.fn(async () => answer(201, { sent: true }))
    vi.stubGlobal('fetch', fetch)
    expect(await browserFeedback.send(report, verification)).toEqual({ sent: true })
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/feedback')
    expect(init.method).toBe('POST')
    expect(new Headers(init.headers).get('X-Turnstile-Token')).toBe('token-1')
    expect(JSON.parse(String(init.body))).toEqual(report)
  })

  it('is offline without trying when the browser says so, and failed when the network or Turnstile fails online', async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError('network')
    })
    vi.stubGlobal('fetch', fetch)
    vi.stubGlobal('navigator', { onLine: false })
    expect(await browserFeedback.send(report, verification)).toEqual({ sent: false, reason: 'offline' })
    expect(fetch).not.toHaveBeenCalled()
    vi.stubGlobal('navigator', { onLine: true })
    expect(await browserFeedback.send(report, verification)).toEqual({ sent: false, reason: 'failed' })
    const refused = { token: () => Promise.reject(new Error('turnstile failed')), dispose: () => {} }
    expect(await browserFeedback.send(report, refused)).toEqual({ sent: false, reason: 'failed' })
  })
})

describe('TURNSTILE_SITE_KEY', () => {
  it('is the site key wrangler.jsonc gives both Workers', () => {
    const keys = [...readFileSync('wrangler.jsonc', 'utf8').matchAll(/"TURNSTILE_SITE_KEY":\s*"([^"]+)"/g)].map((match) => match[1])
    expect(keys.length).toBeGreaterThan(0)
    expect(new Set(keys)).toEqual(new Set([TURNSTILE_SITE_KEY]))
  })
})
