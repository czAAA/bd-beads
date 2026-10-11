import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ORIGIN, startWorker, type RunningWorker, type StartOptions } from './harness.ts'

// Spec 385, seam 1: the Worker's request handling, requests in and responses out, in workerd with local D1 and R2.

/** Cloudflare's Turnstile dummy secret keys: one always passes, one always fails. */
const TURNSTILE_PASSES = '1x0000000000000000000000000000000AA'
const TURNSTILE_FAILS = '2x0000000000000000000000000000000AA'
const MB = 1024 * 1024

/** Runs `test` against a Worker started with `options`, and stops it after. */
async function withWorker(options: StartOptions, test: (worker: RunningWorker) => Promise<void>): Promise<void> {
  const worker = await startWorker(options)
  try {
    await test(worker)
  } finally {
    await worker.dispose()
  }
}

/**
 * A changing request from the app's own origin. A buffered body declares its length, as a browser's always does
 * (Miniflare's `dispatchFetch` would otherwise send it in chunks).
 */
function change(method: string, init: RequestInit = {}): RequestInit {
  const length =
    init.body instanceof Uint8Array ? init.body.byteLength : typeof init.body === 'string' ? new TextEncoder().encode(init.body).byteLength : null
  return {
    ...init,
    method,
    headers: { Origin: ORIGIN, ...(length === null ? {} : { 'Content-Length': String(length) }), ...(init.headers as Record<string, string>) },
  }
}

/** A body sent in chunks with no Content-Length, as a stream. */
function chunked(bytes: Uint8Array, chunkSize = 64 * 1024): RequestInit {
  let offset = 0
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset >= bytes.byteLength) return controller.close()
      controller.enqueue(bytes.slice(offset, offset + chunkSize))
      offset += chunkSize
    },
  })
  return { body, duplex: 'half' } as RequestInit
}

function bytesOf(size: number, seed = 7): Uint8Array {
  const bytes = new Uint8Array(size)
  for (let i = 0; i < size; i++) bytes[i] = (i * seed) % 251
  return bytes
}

/** Byte-for-byte equality; `toEqual` on megabytes would walk them as objects. */
function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  return Buffer.from(a).equals(Buffer.from(b))
}

describe('the Worker', () => {
  let worker: RunningWorker
  beforeAll(async () => {
    worker = await startWorker({ vars: { VERSION: 'abc1234' } })
  })
  afterAll(() => worker.dispose())

  it('answers /api/health with its name and version after reading both databases', async () => {
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
      headers: { Origin: 'https://elsewhere.example', 'Access-Control-Request-Method': 'POST' },
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

describe('health', () => {
  for (const broken of ['CORE', 'BLOBS_DB'] as const) {
    it(`answers 503 with ok false when ${broken} can't be read`, () =>
      withWorker({ brokenDatabase: broken, vars: { VERSION: 'abc1234' } }, async (worker) => {
        const response = await worker.fetch('/api/health')
        expect(response.status).toBe(503)
        expect(await response.json()).toEqual({ ok: false, worker: 'dev', version: 'abc1234' })
      }))
  }

  it('names the production Worker in production', () =>
    withWorker({ env: 'production' }, async (worker) => {
      expect(await (await worker.fetch('/api/health')).json()).toMatchObject({ ok: true, worker: 'production' })
    }))
})

describe('the kill switches', () => {
  it('switch off everything but health with `api`, and the app still loads', () =>
    withWorker({ entry: 'fixture', vars: { DISABLED_FEATURES: 'api' } }, async (worker) => {
      const off = await worker.fetch('/api/test/feature/sync')
      expect(off.status).toBe(503)
      expect(off.headers.get('Retry-After')).toBe('900')
      expect(await off.json()).toEqual({ error: 'feature-off', feature: 'api' })
      expect((await worker.fetch('/api/nothing-here')).status).toBe(503)
      expect((await worker.fetch('/api/health')).status).toBe(200)
      expect((await worker.fetch('/')).status).toBe(200)
    }))

  it('switch off the features named in DISABLED_FEATURES and no others', () =>
    withWorker({ entry: 'fixture', vars: { DISABLED_FEATURES: 'view-links, sync' } }, async (worker) => {
      for (const feature of ['view-links', 'sync']) {
        const response = await worker.fetch(`/api/test/feature/${feature}`)
        expect(response.status).toBe(503)
        expect(response.headers.get('Retry-After')).toBe('900')
        expect(await response.json()).toEqual({ error: 'feature-off', feature })
      }
      for (const feature of ['sign-up', 'sign-in', 'magic-link']) {
        expect((await worker.fetch(`/api/test/feature/${feature}`)).status).toBe(200)
      }
    }))

  it('leave every feature on when the variable is not set', () =>
    withWorker({ entry: 'fixture' }, async (worker) => {
      expect((await worker.fetch('/api/test/feature/sync')).status).toBe(200)
    }))
})

describe('the Origin check', () => {
  let worker: RunningWorker
  beforeAll(async () => {
    worker = await startWorker({ entry: 'fixture' })
  })
  afterAll(() => worker.dispose())

  for (const method of ['POST', 'PUT', 'DELETE']) {
    it(`refuses a ${method} from another origin or with none, and lets the app's own through`, async () => {
      for (const headers of [{ Origin: 'https://elsewhere.example' }, {} as Record<string, string>]) {
        const refused = await worker.fetch('/api/test/change', { method, headers })
        expect(refused.status).toBe(403)
        expect(await refused.json()).toEqual({ error: 'forbidden-origin' })
      }
      const allowed = await worker.fetch('/api/test/change', change(method))
      expect(allowed.status).toBe(200)
      expect(await allowed.json()).toEqual({ changed: method })
    })
  }

  it('leaves GET alone, whatever its origin', async () => {
    const response = await worker.fetch('/api/test/change', { headers: { Origin: 'https://elsewhere.example' } })
    expect(response.status).toBe(200)
  })

  it('refuses before any guard runs', async () => {
    const response = await worker.fetch('/api/test/create', { method: 'POST', headers: { 'X-Turnstile-Token': 'x' } })
    expect(await response.json()).toEqual({ error: 'forbidden-origin' })
    expect(worker.outbound).toHaveLength(0)
  })
})

describe('the Turnstile guard', () => {
  /** Answers siteverify as Cloudflare does for its dummy secret keys. */
  const siteverify: StartOptions['reply'] = ({ url, body }) => {
    if (!url.startsWith('https://challenges.cloudflare.com/turnstile/')) return new Response('unexpected', { status: 500 })
    return Response.json({ success: new URLSearchParams(body).get('secret') === TURNSTILE_PASSES })
  }

  it('refuses a request with no token, without asking Cloudflare', () =>
    withWorker({ entry: 'fixture', vars: { TURNSTILE_SECRET_KEY: TURNSTILE_PASSES }, reply: siteverify }, async (worker) => {
      const response = await worker.fetch('/api/test/create', change('POST'))
      expect(response.status).toBe(403)
      expect(await response.json()).toEqual({ error: 'turnstile-failed' })
      expect(worker.outbound).toHaveLength(0)
    }))

  it('refuses a token Cloudflare rejects', () =>
    withWorker({ entry: 'fixture', vars: { TURNSTILE_SECRET_KEY: TURNSTILE_FAILS }, reply: siteverify }, async (worker) => {
      const response = await worker.fetch('/api/test/create', change('POST', { headers: { 'X-Turnstile-Token': 'token' } }))
      expect(response.status).toBe(403)
      expect(await response.json()).toEqual({ error: 'turnstile-failed' })
    }))

  it('lets a confirmed token through, verified with the secret key and the caller address', () =>
    withWorker({ entry: 'fixture', vars: { TURNSTILE_SECRET_KEY: TURNSTILE_PASSES }, reply: siteverify }, async (worker) => {
      const response = await worker.fetch(
        '/api/test/create',
        change('POST', { headers: { 'X-Turnstile-Token': 'XXXX.DUMMY.TOKEN.XXXX', 'CF-Connecting-IP': '203.0.113.9' } }),
      )
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ created: true })
      const form = new URLSearchParams(worker.outbound.at(-1)?.body)
      expect(worker.outbound.at(-1)?.url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify')
      expect(form.get('response')).toBe('XXXX.DUMMY.TOKEN.XXXX')
      expect(form.get('remoteip')).toBe('203.0.113.9')
    }))

  it('refuses when no secret key is set, and when Cloudflare cannot be reached', async () => {
    await withWorker({ entry: 'fixture' }, async (worker) => {
      const response = await worker.fetch('/api/test/create', change('POST', { headers: { 'X-Turnstile-Token': 't' } }))
      expect(response.status).toBe(403)
    })
    await withWorker(
      { entry: 'fixture', vars: { TURNSTILE_SECRET_KEY: TURNSTILE_PASSES }, reply: () => new Response('down', { status: 502 }) },
      async (worker) => {
        const response = await worker.fetch('/api/test/create', change('POST', { headers: { 'X-Turnstile-Token': 't' } }))
        expect(response.status).toBe(403)
      },
    )
  })
})

describe('the rate limit', () => {
  it('refuses a caller past the binding, with Retry-After, and counts each address apart', () =>
    withWorker({ entry: 'fixture', ratelimits: { RATE_LIMIT_TEST: { limit: 2, period: 60 } } }, async (worker) => {
      const from = (ip: string) => change('POST', { headers: { 'CF-Connecting-IP': ip } })
      expect((await worker.fetch('/api/test/limited', from('203.0.113.1'))).status).toBe(200)
      expect((await worker.fetch('/api/test/limited', from('203.0.113.1'))).status).toBe(200)
      const refused = await worker.fetch('/api/test/limited', from('203.0.113.1'))
      expect(refused.status).toBe(429)
      expect(refused.headers.get('Retry-After')).toBe('60')
      expect(await refused.json()).toEqual({ error: 'rate-limited' })
      expect((await worker.fetch('/api/test/limited', from('203.0.113.2'))).status).toBe(200)
    }))

  it('lets requests through when the environment has no such binding', () =>
    withWorker({ entry: 'fixture' }, async (worker) => {
      for (let i = 0; i < 5; i++) expect((await worker.fetch('/api/test/unbound', change('POST'))).status).toBe(200)
    }))
})

describe('the size cap', () => {
  let worker: RunningWorker
  beforeAll(async () => {
    // Small caps, so the tests send small bodies: the D1 cap in bytes, the R2 cap in MB.
    worker = await startWorker({ entry: 'fixture', vars: { UPLOAD_CAP_D1_BYTES: 300_000, UPLOAD_CAP_R2_MB: 1 } })
  })
  afterAll(() => worker.dispose())

  it('refuses a body whose declared length is over the cap, before reading it', async () => {
    const response = await worker.fetch('/api/test/json', change('POST', { body: 'x'.repeat(65) }))
    expect(response.status).toBe(413)
    expect(await response.json()).toEqual({ error: 'too-large', cap: 64 })
  })

  it('refuses a D1 upload over its cap, by declared length and by streamed bytes', async () => {
    const declared = await worker.fetch('/api/test/free/blobs/big', change('PUT', { body: bytesOf(300_001) }))
    expect(declared.status).toBe(413)
    expect(await declared.json()).toEqual({ error: 'too-large', cap: 300_000 })
    const streamed = await worker.fetch('/api/test/free/blobs/big', change('PUT', chunked(bytesOf(300_001))))
    expect(streamed.status).toBe(413)
    expect(await streamed.json()).toEqual({ error: 'too-large', cap: 300_000 })
    expect(await worker.blobsDb.prepare('SELECT COUNT(*) AS n FROM blobs').first('n')).toBe(0)
  })

  it('takes a D1 upload at its cap, streamed or not', async () => {
    expect((await worker.fetch('/api/test/free/blobs/at-cap', change('PUT', { body: bytesOf(300_000) }))).status).toBe(200)
    expect((await worker.fetch('/api/test/free/blobs/at-cap-2', change('PUT', chunked(bytesOf(300_000))))).status).toBe(200)
  })

  it('refuses an R2 upload over its cap by declared length, and one without a length', async () => {
    const declared = await worker.fetch('/api/test/pro/blobs/big', change('PUT', { body: bytesOf(MB + 1) }))
    expect(declared.status).toBe(413)
    expect(await declared.json()).toEqual({ error: 'too-large', cap: MB })
    const streamed = await worker.fetch('/api/test/pro/blobs/big', change('PUT', chunked(bytesOf(1000))))
    expect(streamed.status).toBe(411)
    expect(await streamed.json()).toEqual({ error: 'length-required' })
    expect(await worker.r2.head('big')).toBeNull()
  })
})

describe('the blob storage limit', () => {
  it('refuses uploads to the blobs database past BLOBS_STORAGE_LIMIT_MB with 507, and never deletes or R2', () =>
    withWorker({ entry: 'fixture', vars: { BLOBS_STORAGE_LIMIT_MB: 1 } }, async (worker) => {
      expect((await worker.fetch('/api/test/free/blobs/first', change('PUT', { body: bytesOf(1_500_000) }))).status).toBe(200)
      const refused = await worker.fetch('/api/test/free/blobs/second', change('PUT', { body: bytesOf(10) }))
      expect(refused.status).toBe(507)
      expect(await refused.json()).toEqual({ error: 'storage-full' })
      expect((await worker.fetch('/api/test/free/blobs/first', change('DELETE'))).status).toBe(200)
      expect((await worker.fetch('/api/test/pro/blobs/second', change('PUT', { body: bytesOf(10) }))).status).toBe(200)
    }))

  it('takes uploads while the database is under the limit', () =>
    withWorker({ entry: 'fixture' }, async (worker) => {
      expect((await worker.fetch('/api/test/free/blobs/one', change('PUT', { body: bytesOf(1_500_000) }))).status).toBe(200)
      expect((await worker.fetch('/api/test/free/blobs/two', change('PUT', { body: bytesOf(1_500_000) }))).status).toBe(200)
    }))
})

describe('the blob stores', () => {
  let worker: RunningWorker
  beforeAll(async () => {
    worker = await startWorker({ entry: 'fixture' })
  })
  afterAll(() => worker.dispose())

  for (const plan of ['free', 'pro'] as const) {
    it(`put, get and delete a blob by id in the ${plan === 'free' ? 'D1' : 'R2'} store, with its owner and expiry`, async () => {
      // The R2 blob is larger than D1 could hold in a row.
      const bytes = bytesOf(plan === 'free' ? 1_000_000 : 3 * MB)
      const put = await worker.fetch(`/api/test/${plan}/blobs/abc_1?expires=1760000000000`, change('PUT', { body: bytes }))
      expect(put.status).toBe(200)
      const got = await worker.fetch(`/api/test/${plan}/blobs/abc_1`)
      expect(got.status).toBe(200)
      expect(got.headers.get('X-Owner')).toBe('account-1')
      expect(got.headers.get('X-Expires-At')).toBe('1760000000000')
      expect(sameBytes(new Uint8Array(await got.arrayBuffer()), bytes)).toBe(true)
      expect((await worker.fetch(`/api/test/${plan}/blobs/abc_1`, change('DELETE'))).status).toBe(200)
      expect((await worker.fetch(`/api/test/${plan}/blobs/abc_1`)).status).toBe(404)
      // Deleting again is not an error, so a deletion is safe to retry.
      expect((await worker.fetch(`/api/test/${plan}/blobs/abc_1`, change('DELETE'))).status).toBe(200)
    })
  }

  it('keeps a D1 blob in the blobs database with its owner, size and expiry, and an R2 blob only in R2', async () => {
    await worker.fetch('/api/test/free/blobs/in-d1', change('PUT', { body: bytesOf(1234) }))
    await worker.fetch('/api/test/pro/blobs/in-r2', change('PUT', { body: bytesOf(4321) }))
    expect(await worker.blobsDb.prepare("SELECT owner, size, expires_at FROM blobs WHERE id = 'in-d1'").first()).toEqual({
      owner: 'account-1',
      size: 1234,
      expires_at: null,
    })
    expect(await worker.blobsDb.prepare("SELECT COUNT(*) AS n FROM blobs WHERE id = 'in-r2'").first('n')).toBe(0)
    const object = await worker.r2.head('in-r2')
    expect(object?.size).toBe(4321)
    expect(object?.customMetadata).toEqual({ owner: 'account-1' })
  })

  it('replaces a blob put again under the same id', async () => {
    await worker.fetch('/api/test/free/blobs/again', change('PUT', { body: bytesOf(100, 3) }))
    await worker.fetch('/api/test/free/blobs/again', change('PUT', { body: bytesOf(200, 5) }))
    expect(sameBytes(new Uint8Array(await (await worker.fetch('/api/test/free/blobs/again')).arrayBuffer()), bytesOf(200, 5))).toBe(true)
  })
})
