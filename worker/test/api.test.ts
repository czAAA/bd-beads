import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startWorker, type RunningWorker } from './harness.ts'

const TURNSTILE_PASS = '1x0000000000000000000000000000000AA'
const TURNSTILE_FAIL = '2x0000000000000000000000000000000AA'
const MB = 1024 * 1024

describe('the deployed Worker', () => {
  let worker: RunningWorker
  beforeAll(async () => {
    worker = await startWorker({ vars: { VERSION: 'abc1234' } })
  })
  afterAll(() => worker.dispose())

  it('answers /api/health with its name and version', async () => {
    const response = await worker.fetch('/api/health')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, worker: 'dev', version: 'abc1234' })
  })

  it('answers a HEAD probe of /api/health as a GET, without a body', async () => {
    const response = await worker.fetch('/api/health', { method: 'HEAD' })
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('')
  })

  it('refuses an unknown /api path with not-found', async () => {
    const response = await worker.fetch('/api/nothing-here')
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'not-found' })
  })

  it('sends no CORS headers, and does not answer a preflight', async () => {
    const health = await worker.fetch('/api/health', { headers: { Origin: 'https://elsewhere.example' } })
    expect([...health.headers.keys()].filter((name) => name.startsWith('access-control-'))).toEqual([])
    const preflight = await worker.fetch('/api/health', {
      method: 'OPTIONS',
      headers: { Origin: 'https://elsewhere.example' },
    })
    expect(preflight.status).toBe(404)
    expect(preflight.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('serves the app from the static assets', async () => {
    const response = await worker.fetch('/')
    expect(response.status).toBe(200)
    expect(await response.text()).toContain('<title>app</title>')
  })
})

describe('the kill switches', () => {
  it('switch off everything but health with `api`, and the app still loads', async () => {
    const worker = await startWorker({ entry: 'fixture', vars: { DISABLED_FEATURES: 'api' } })
    try {
      const off = await worker.fetch('/api/test/feature/sync')
      expect(off.status).toBe(503)
      expect(await off.json()).toEqual({ error: 'feature-off', feature: 'api' })
      const unknown = await worker.fetch('/api/nothing-here')
      expect(unknown.status).toBe(503)
      expect((await worker.fetch('/api/health')).status).toBe(200)
      expect((await worker.fetch('/')).status).toBe(200)
    } finally {
      await worker.dispose()
    }
  })

  it('switch everything off with an `api` row in D1', async () => {
    const worker = await startWorker({ entry: 'fixture', vars: { SWITCHES_CACHE_SECONDS: '0' } })
    try {
      await worker.db.prepare("INSERT INTO switches (feature, reason, set_at) VALUES ('api', 'test', 0)").run()
      const response = await worker.fetch('/api/test/feature/sync')
      expect(await response.json()).toEqual({ error: 'feature-off', feature: 'api' })
      expect((await worker.fetch('/api/health')).status).toBe(200)
    } finally {
      await worker.dispose()
    }
  })

  it('switch off the features named in the DISABLED_FEATURES variable and no others', async () => {
    const worker = await startWorker({ entry: 'fixture', vars: { DISABLED_FEATURES: 'view-links, sync' } })
    try {
      for (const feature of ['view-links', 'sync']) {
        const response = await worker.fetch(`/api/test/feature/${feature}`)
        expect(response.status).toBe(503)
        expect(await response.json()).toEqual({ error: 'feature-off', feature })
      }
      for (const feature of ['sign-up', 'sign-in', 'magic-link']) {
        expect((await worker.fetch(`/api/test/feature/${feature}`)).status).toBe(200)
      }
    } finally {
      await worker.dispose()
    }
  })

  it('switch off a feature with a row in D1, which a later deploy cannot undo', async () => {
    const worker = await startWorker({ entry: 'fixture', vars: { SWITCHES_CACHE_SECONDS: '0' } })
    try {
      expect((await worker.fetch('/api/test/feature/sign-up')).status).toBe(200)
      await worker.db
        .prepare("INSERT INTO switches (feature, reason, set_at, source) VALUES ('sign-up', 'by hand', 0, 'manual')")
        .run()
      const response = await worker.fetch('/api/test/feature/sign-up')
      expect(response.status).toBe(503)
      expect(await response.json()).toEqual({ error: 'feature-off', feature: 'sign-up' })
      expect((await worker.fetch('/api/test/feature/sync')).status).toBe(200)
    } finally {
      await worker.dispose()
    }
  })
})

describe('the Turnstile guard', () => {
  let worker: RunningWorker
  beforeAll(async () => {
    worker = await startWorker({
      entry: 'fixture',
      vars: { TURNSTILE_SECRET_KEY: TURNSTILE_PASS },
      reply: ({ url, body }) => {
        const form = new URLSearchParams(body)
        const passes = url.includes('/turnstile/') && form.get('secret') === TURNSTILE_PASS && form.get('response') !== 'bad'
        return Response.json({ success: passes })
      },
    })
  })
  afterAll(() => worker.dispose())

  it('refuses a request with no token, without asking Cloudflare', async () => {
    const before = worker.outbound.length
    const response = await worker.fetch('/api/test/create', { method: 'POST' })
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'turnstile-failed' })
    expect(worker.outbound).toHaveLength(before)
  })

  it('refuses a token Cloudflare rejects', async () => {
    const response = await worker.fetch('/api/test/create', { method: 'POST', headers: { 'X-Turnstile-Token': 'bad' } })
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'turnstile-failed' })
  })

  it('lets a verified token through, and verifies it with the secret key', async () => {
    const response = await worker.fetch('/api/test/create', {
      method: 'POST',
      headers: { 'X-Turnstile-Token': 'XXXX.DUMMY.TOKEN.XXXX' },
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ created: true })
    const call = worker.outbound.at(-1)
    expect(call?.url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify')
    expect(new URLSearchParams(call?.body).get('response')).toBe('XXXX.DUMMY.TOKEN.XXXX')
  })

  it('refuses a token that Cloudflare’s always-fail secret rejects', async () => {
    const failing = await startWorker({
      entry: 'fixture',
      vars: { TURNSTILE_SECRET_KEY: TURNSTILE_FAIL },
      reply: ({ body }) => Response.json({ success: new URLSearchParams(body).get('secret') === TURNSTILE_PASS }),
    })
    try {
      const response = await failing.fetch('/api/test/create', {
        method: 'POST',
        headers: { 'X-Turnstile-Token': 'XXXX.DUMMY.TOKEN.XXXX' },
      })
      expect(response.status).toBe(403)
    } finally {
      await failing.dispose()
    }
  })

  it('refuses when Cloudflare cannot be reached', async () => {
    const down = await startWorker({
      entry: 'fixture',
      vars: { TURNSTILE_SECRET_KEY: TURNSTILE_FAIL },
      reply: () => new Response('nope', { status: 500 }),
    })
    try {
      const response = await down.fetch('/api/test/create', { method: 'POST', headers: { 'X-Turnstile-Token': 'x' } })
      expect(response.status).toBe(403)
    } finally {
      await down.dispose()
    }
  })
})

describe('upload size caps and the blob stores', () => {
  let worker: RunningWorker
  beforeAll(async () => {
    worker = await startWorker({ entry: 'fixture' })
  })
  afterAll(() => worker.dispose())

  const bytes = (size: number) => Uint8Array.from({ length: size }, (_, index) => index % 251)

  it('keeps a Free account’s blob in D1 and gives it back, then deletes it', async () => {
    const body = bytes(100_000)
    const put = await worker.fetch('/api/test/blobs/p1?plan=free', { method: 'PUT', body })
    expect(await put.json()).toEqual({ id: 'p1', size: 100_000 })
    const stored = await worker.db.prepare('SELECT size FROM blobs WHERE id = ?').bind('p1').first<{ size: number }>()
    expect(stored?.size).toBe(100_000)

    const got = await worker.fetch('/api/test/blobs/p1?plan=free')
    expect(new Uint8Array(await got.arrayBuffer())).toEqual(body)

    await worker.fetch('/api/test/blobs/p1?plan=free', { method: 'DELETE' })
    expect((await worker.fetch('/api/test/blobs/p1?plan=free')).status).toBe(404)
  })

  it('replaces a blob that is put again under the same id', async () => {
    await worker.fetch('/api/test/blobs/p2?plan=free', { method: 'PUT', body: bytes(10) })
    await worker.fetch('/api/test/blobs/p2?plan=free', { method: 'PUT', body: bytes(20) })
    const got = await worker.fetch('/api/test/blobs/p2?plan=free')
    expect(new Uint8Array(await got.arrayBuffer())).toEqual(bytes(20))
  })

  it('keeps a Pro account’s blob in R2, not in D1', async () => {
    const body = bytes(100_000)
    await worker.fetch('/api/test/blobs/pro1?plan=pro', { method: 'PUT', body })
    expect(await worker.db.prepare('SELECT id FROM blobs WHERE id = ?').bind('pro1').first()).toBeNull()
    const object = await worker.r2.get('pro1')
    expect(new Uint8Array((await object?.arrayBuffer()) ?? new ArrayBuffer(0))).toEqual(body)

    const got = await worker.fetch('/api/test/blobs/pro1?plan=pro')
    expect(new Uint8Array(await got.arrayBuffer())).toEqual(body)
    await worker.fetch('/api/test/blobs/pro1?plan=pro', { method: 'DELETE' })
    expect(await worker.r2.head('pro1')).toBeNull()
  })

  it('refuses a Free body over the D1 cap before reading it, and says the cap', async () => {
    const response = await worker.fetch('/api/test/blobs/big?plan=free', { method: 'PUT', body: bytes(2 * MB + 1) })
    expect(response.status).toBe(413)
    expect(await response.json()).toEqual({ error: 'too-large', cap: 2_000_000 - 1024 })
    expect(await worker.db.prepare('SELECT id FROM blobs WHERE id = ?').bind('big').first()).toBeNull()
  })

  it('takes a body Free would refuse when the plan is Pro (R2 has the larger cap)', async () => {
    const response = await worker.fetch('/api/test/blobs/bigpro?plan=pro', { method: 'PUT', body: bytes(2 * MB + 1) })
    expect(response.status).toBe(200)
    expect((await worker.r2.head('bigpro'))?.size).toBe(2 * MB + 1)
  })

  it('refuses a streamed body with no length as soon as it passes the cap', async () => {
    const chunk = new Uint8Array(512 * 1024)
    let sent = 0
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (sent >= 8) return controller.close()
        sent += 1
        controller.enqueue(chunk)
      },
    })
    const init = { method: 'PUT', body, duplex: 'half' } as RequestInit
    const response = await worker.fetch('/api/test/blobs/streamed?plan=free', init)
    expect(response.status).toBe(413)
    expect(await worker.db.prepare('SELECT id FROM blobs WHERE id = ?').bind('streamed').first()).toBeNull()
  })

  it('does not store a blob under an id that is not made of letters, digits, "-" and "_"', async () => {
    const response = await worker.fetch('/api/test/blobs/a%2Fb?plan=free', { method: 'PUT', body: bytes(1) })
    expect(response.ok).toBe(false)
    const { results } = await worker.db.prepare('SELECT id FROM blobs').all<{ id: string }>()
    expect(results.map((row) => row.id)).not.toContain('a/b')
  })
})

describe('rate limits', () => {
  const call = (worker: RunningWorker, ip: string) =>
    worker.fetch('/api/test/limited', { method: 'POST', headers: { 'CF-Connecting-IP': ip } })

  it('refuse a caller past the limit with Retry-After, and count each address on its own (D1 counters)', async () => {
    const worker = await startWorker({ entry: 'fixture' })
    try {
      expect((await call(worker, '203.0.113.1')).status).toBe(200)
      expect((await call(worker, '203.0.113.1')).status).toBe(200)
      const refused = await call(worker, '203.0.113.1')
      expect(refused.status).toBe(429)
      const body = (await refused.json()) as { error: string; retryAfter: number }
      expect(body.error).toBe('rate-limited')
      expect(body.retryAfter).toBeGreaterThanOrEqual(1)
      expect(body.retryAfter).toBeLessThanOrEqual(60)
      expect(refused.headers.get('Retry-After')).toBe(String(body.retryAfter))
      expect((await call(worker, '203.0.113.2')).status).toBe(200)
    } finally {
      await worker.dispose()
    }
  })

  it('use the Rate Limiting binding when the config declares one for the rule', async () => {
    const worker = await startWorker({
      entry: 'fixture',
      ratelimits: { RATE_LIMIT_TEST_LIMITED: { namespace_id: '1001', simple: { limit: 2, period: 60 } } },
    })
    try {
      expect((await call(worker, '203.0.113.1')).status).toBe(200)
      expect((await call(worker, '203.0.113.1')).status).toBe(200)
      expect((await call(worker, '203.0.113.1')).status).toBe(429)
      expect(await worker.db.prepare('SELECT key FROM rate_limits').all()).toMatchObject({ results: [] })
    } finally {
      await worker.dispose()
    }
  })
})

describe('the usage counters', () => {
  it('count each /api request in D1, and the rows it wrote, while USAGE_SOURCE is d1', async () => {
    const worker = await startWorker({ entry: 'fixture' })
    try {
      await worker.fetch('/api/health')
      await worker.fetch('/api/nothing-here')
      await worker.fetch('/api/test/blobs/c1?plan=free', { method: 'PUT', body: new Uint8Array(10) })
      // The counters are written after the response, so wait for the last one.
      await expect
        .poll(async () => {
          const rows = await worker.db
            .prepare('SELECT measure, value FROM usage_counters')
            .all<{ measure: string; value: number }>()
          return Object.fromEntries(rows.results.map((row) => [row.measure, row.value]))
        })
        .toEqual({ requests: 3, 'd1-rows-written': 8 })
    } finally {
      await worker.dispose()
    }
  })

  it('are not kept when the usage comes from Cloudflare’s analytics', async () => {
    const worker = await startWorker({ vars: { USAGE_SOURCE: 'graphql' } })
    try {
      await worker.fetch('/api/health')
      await new Promise((done) => setTimeout(done, 200))
      expect((await worker.db.prepare('SELECT * FROM usage_counters').all()).results).toEqual([])
    } finally {
      await worker.dispose()
    }
  })
})
