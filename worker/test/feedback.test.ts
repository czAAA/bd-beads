import { describe, expect, it } from 'vitest'
import { ORIGIN, startWorker, type Outbound, type RunningWorker, type StartOptions } from './harness.ts'

// Ticket 0699, seam 1: POST /api/feedback, a Report in, one issue posted to a fake GitHub (ADR 0081, spec 0698).

/** Cloudflare's Turnstile dummy secret keys: one always passes, one always fails. */
const TURNSTILE_PASSES = '1x0000000000000000000000000000000AA'
const TURNSTILE_FAILS = '2x0000000000000000000000000000000AA'
const ISSUES_URL = 'https://api.github.com/repos/czAAA/bd-beads-docs/issues'

const context = { appVersion: '1.4.0', uiLanguage: 'en', browser: 'Safari', os: 'iOS', viewport: '390 × 844' }

const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/'
/** A token the fake verifier rejects whatever the secret key, as Cloudflare rejects a made-up one. */
const REJECTED_TOKEN = 'made-up'

/** Answers siteverify as Cloudflare does for its dummy keys, for a token made on the app's own page, and GitHub's issue
 * creation with `github`'s status. */
function fakes(github = 201): NonNullable<StartOptions['reply']> {
  return ({ url, body }: Outbound) => {
    if (url.startsWith(SITEVERIFY)) {
      const form = new URLSearchParams(body)
      const success = form.get('secret') === TURNSTILE_PASSES && form.get('response') !== REJECTED_TOKEN
      return Response.json({ success, hostname: new URL(ORIGIN).hostname })
    }
    if (url === ISSUES_URL) return Response.json({ number: 7 }, { status: github })
    return new Response('unexpected', { status: 500 })
  }
}

async function withWorker(options: StartOptions, test: (worker: RunningWorker) => Promise<void>): Promise<void> {
  const worker = await startWorker({
    reply: fakes(),
    ...options,
    vars: { TURNSTILE_SECRET_KEY: TURNSTILE_PASSES, GITHUB_TOKEN: 'github_pat_test', ...options.vars },
  })
  try {
    await test(worker)
  } finally {
    await worker.dispose()
  }
}

/** A Report sent as the sheet sends it: from the app's origin, with a Turnstile token and a declared length. */
function send(worker: RunningWorker, report: unknown, headers: Record<string, string> = {}): Promise<Response> {
  const body = typeof report === 'string' ? report : JSON.stringify(report)
  return worker.fetch('/api/feedback', {
    method: 'POST',
    body,
    headers: {
      Origin: ORIGIN,
      'Content-Type': 'application/json',
      'Content-Length': String(new TextEncoder().encode(body).byteLength),
      'X-Turnstile-Token': 'XXXX.DUMMY.TOKEN.XXXX',
      ...headers,
    },
  })
}

function postedIssue(worker: RunningWorker): { title: string; labels: string[]; body: string } | undefined {
  const call = worker.outbound.find(({ url }) => url === ISSUES_URL)
  return call && JSON.parse(call.body)
}

describe('POST /api/feedback', () => {
  it('posts each kind as one issue, titled, labelled and written by the Worker, with the token', () =>
    withWorker({ env: 'production' }, async (worker) => {
      const general = await send(worker, { kind: 'general', fields: { message: 'Lovely app.' }, context }, { 'CF-Connecting-IP': '203.0.113.1' })
      expect(general.status).toBe(201)
      expect(await general.json()).toEqual({ sent: true })
      const call = worker.outbound.find(({ url }) => url === ISSUES_URL)
      expect(call?.method).toBe('POST')
      expect(call?.headers.authorization).toBe('Bearer github_pat_test')
      expect(postedIssue(worker)).toEqual({
        title: 'feedback: Lovely app.',
        labels: ['from-app', 'feedback'],
        body: expect.stringMatching(/^### Message\n\n```text\nLovely app\.\n```\n\n### Context\n/),
      })

      worker.outbound.length = 0
      const translation = { language: 'pl', shown: 'Zapisz koralik', shouldSay: 'Zapisz projekt' }
      await send(worker, { kind: 'translation', fields: translation, context }, { 'CF-Connecting-IP': '203.0.113.2' })
      expect(postedIssue(worker)).toMatchObject({ title: 'translation [pl]: Zapisz koralik', labels: ['from-app', 'translation'] })

      worker.outbound.length = 0
      const color = { problem: 'wrong', brand: 'Miyuki', catalog: 'miyuki-delica', code: 'DB723' }
      const sent = await send(worker, { kind: 'bead-color', fields: color, context, email: 'ann@example.com' }, { 'CF-Connecting-IP': '203.0.113.3' })
      expect(sent.status).toBe(201)
      const issue = postedIssue(worker)
      expect(issue).toMatchObject({ title: 'bead-color [miyuki-delica DB723]: wrong color', labels: ['from-app', 'bead-color'] })
      expect(issue?.body.endsWith('### Email\n\n`ann@example.com`')).toBe(true)
    }))

  it('adds the label dev on the dev Worker', () =>
    withWorker({ env: 'dev' }, async (worker) => {
      expect((await send(worker, { kind: 'general', fields: { message: 'Hi' }, context })).status).toBe(201)
      expect(postedIssue(worker)?.labels).toEqual(['from-app', 'feedback', 'dev'])
    }))

  it('refuses 400 a body not shaped as a Report, or a field past its length, and posts nothing', () =>
    withWorker({}, async (worker) => {
      for (const [index, body] of [
        'not json',
        { kind: 'general', fields: { message: 'Hi' }, context, title: 'Mine', labels: ['urgent'] },
        { kind: 'spam', fields: { message: 'Hi' }, context },
        { kind: 'general', fields: { message: 'x'.repeat(2001) }, context },
        { kind: 'translation', fields: { language: 'pl', shown: 'x'.repeat(201) }, context },
        { kind: 'general', fields: { message: 'Hi' }, context, email: `${'a'.repeat(309)}@example.com` },
      ].entries()) {
        const response = await send(worker, body, { 'CF-Connecting-IP': `203.0.113.${index + 1}` })
        expect(response.status, JSON.stringify(body)).toBe(400)
        expect(await response.json()).toEqual({ error: 'bad-request' })
      }
      expect(postedIssue(worker)).toBeUndefined()
    }))

  it('refuses 403 a Report without a Turnstile token or with one that fails', async () => {
    await withWorker({}, async (worker) => {
      const response = await send(worker, { kind: 'general', fields: { message: 'Hi' }, context }, { 'X-Turnstile-Token': '' })
      expect(response.status).toBe(403)
      expect(await response.json()).toEqual({ error: 'turnstile-failed' })
    })
    await withWorker({ vars: { TURNSTILE_SECRET_KEY: TURNSTILE_FAILS } }, async (worker) => {
      expect((await send(worker, { kind: 'general', fields: { message: 'Hi' }, context })).status).toBe(403)
      expect(postedIssue(worker)).toBeUndefined()
    })
  })

  it("refuses 429 with Retry-After past wrangler.jsonc's FEEDBACK_RATE, per address", () =>
    withWorker({}, async (worker) => {
      const report = { kind: 'general', fields: { message: 'Hi' }, context }
      const from = { 'CF-Connecting-IP': '203.0.113.9' }
      expect((await send(worker, report, from)).status).toBe(201)
      expect((await send(worker, report, from)).status).toBe(201)
      const refused = await send(worker, report, from)
      expect(refused.status).toBe(429)
      expect(refused.headers.get('Retry-After')).toBe('60')
      expect((await send(worker, report, { 'CF-Connecting-IP': '203.0.113.10' })).status).toBe(201)
    }))

  it('refuses a Report past the per-address limit without asking the verifier (ticket 1024)', () =>
    withWorker({}, async (worker) => {
      const report = { kind: 'general', fields: { message: 'Hi' }, context }
      const from = { 'CF-Connecting-IP': '203.0.113.9' }
      for (let sent = 0; sent < 2; sent++) await send(worker, report, from)
      worker.outbound.length = 0
      expect((await send(worker, report, from)).status).toBe(429)
      expect(worker.outbound).toHaveLength(0)
    }))

  it("refuses 429 with Retry-After past wrangler.jsonc's FEEDBACK_RATE_ALL, 10 a minute over every address (ticket 1024)", () =>
    withWorker({ env: 'production' }, async (worker) => {
      const report = { kind: 'general', fields: { message: 'Hi' }, context }
      for (let sent = 1; sent <= 10; sent++) {
        expect((await send(worker, report, { 'CF-Connecting-IP': `203.0.113.${sent}` })).status, `Report ${sent}`).toBe(201)
      }
      const refused = await send(worker, report, { 'CF-Connecting-IP': '203.0.113.11' })
      expect(refused.status).toBe(429)
      expect(refused.headers.get('Retry-After')).toBe('60')
      expect(await refused.json()).toEqual({ error: 'rate-limited' })
    }))

  it('counts only Reports with a confirmed token toward the overall limit, so made-up ones cannot shut everyone out', () =>
    withWorker({}, async (worker) => {
      const report = { kind: 'general', fields: { message: 'Hi' }, context }
      for (let sent = 1; sent <= 12; sent++) {
        const junk = await send(worker, report, { 'CF-Connecting-IP': `203.0.113.${sent}`, 'X-Turnstile-Token': REJECTED_TOKEN })
        expect(junk.status).toBe(403)
      }
      expect((await send(worker, report, { 'CF-Connecting-IP': '203.0.113.99' })).status).toBe(201)
    }))

  it('takes FEEDBACK_DAILY_LIMIT Reports a day and refuses the next as a switched-off feature, posting nothing (ticket 1051)', () =>
    withWorker({ vars: { FEEDBACK_DAILY_LIMIT: 2 } }, async (worker) => {
      const report = { kind: 'general', fields: { message: 'Hi' }, context }
      const from = (sent: number) => ({ 'CF-Connecting-IP': `203.0.113.${sent}` })
      // Refused before the count: a made-up token and a body that is no Report take no place.
      expect((await send(worker, report, { ...from(1), 'X-Turnstile-Token': REJECTED_TOKEN })).status).toBe(403)
      expect((await send(worker, { kind: 'spam' }, from(2))).status).toBe(400)
      expect((await send(worker, report, from(3))).status).toBe(201)
      expect((await send(worker, report, from(4))).status).toBe(201)
      worker.outbound.length = 0
      for (const sent of [5, 6, 7]) {
        const refused = await send(worker, report, from(sent))
        expect(refused.status).toBe(503)
        expect(refused.headers.get('Retry-After')).toBe('900')
        expect(await refused.json()).toEqual({ error: 'feature-off', feature: 'feedback' })
      }
      expect(postedIssue(worker)).toBeUndefined()
      // A refusal writes no row: the count stops at the limit plus the one Report that was refused.
      const row = await worker.coreDb.prepare('SELECT reports FROM feedback_days').first<{ reports: number }>()
      expect(row?.reports).toBe(3)
    }))

  for (const [why, limit] of [['not a number', 'many'], ['not set', undefined]] as const) {
    it(`refuses every Report when FEEDBACK_DAILY_LIMIT is ${why}`, () =>
      withWorker({ vars: { FEEDBACK_DAILY_LIMIT: limit } }, async (worker) => {
        expect((await send(worker, { kind: 'general', fields: { message: 'Hi' }, context })).status).toBe(503)
        expect(postedIssue(worker)).toBeUndefined()
      }))
  }

  it('answers 502 feedback-failed when GitHub refuses, and logs a 401 by name', async () => {
    await withWorker({ reply: fakes(401) }, async (worker) => {
      const response = await send(worker, { kind: 'general', fields: { message: 'Hi' }, context })
      expect(response.status).toBe(502)
      expect(await response.json()).toEqual({ error: 'feedback-failed' })
      await expect.poll(() => worker.logs.some((line) => line.includes('feedback: github 401'))).toBe(true)
    })
    await withWorker({ reply: fakes(422) }, async (worker) => {
      expect((await send(worker, { kind: 'general', fields: { message: 'Hi' }, context })).status).toBe(502)
    })
  })

  it('answers 502 feedback-failed when GitHub cannot be reached or the Worker has no token', async () => {
    const unreachable: StartOptions['reply'] = (call) => {
      if (call.url === ISSUES_URL) throw new Error('connection refused')
      return fakes()(call)
    }
    await withWorker({ reply: unreachable }, async (worker) => {
      expect((await send(worker, { kind: 'general', fields: { message: 'Hi' }, context })).status).toBe(502)
    })
    await withWorker({ vars: { GITHUB_TOKEN: '' } }, async (worker) => {
      expect((await send(worker, { kind: 'general', fields: { message: 'Hi' }, context })).status).toBe(502)
      expect(postedIssue(worker)).toBeUndefined()
    })
  })

  it('answers like every switched-off feature when feedback is switched off, and health still answers', () =>
    withWorker({ vars: { DISABLED_FEATURES: 'feedback' } }, async (worker) => {
      const response = await send(worker, { kind: 'general', fields: { message: 'Hi' }, context })
      expect(response.status).toBe(503)
      expect(response.headers.get('Retry-After')).toBe('900')
      expect(await response.json()).toEqual({ error: 'feature-off', feature: 'feedback' })
      expect(worker.outbound).toHaveLength(0)
      expect((await worker.fetch('/api/health')).status).toBe(200)
    }))
})
