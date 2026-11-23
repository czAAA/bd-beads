import { describe, expect, it } from 'vitest'
import { ORIGIN, startWorker, type RunningWorker, type StartOptions } from './harness.ts'

// Ticket 1209: POST /api/opened, a device's one ping a day, counted per UTC day and combination with no identifier.

async function withWorker(options: StartOptions, test: (worker: RunningWorker) => Promise<void>): Promise<void> {
  const worker = await startWorker(options)
  try {
    await test(worker)
  } finally {
    await worker.dispose()
  }
}

const later = { first: false, since: '2-7', installed: true, version: '1.14.22' }
const first = { first: true, installed: false, version: '1.14.22' }

let address = 0
/** A ping from an address of its own, unless one is given, so the per-address limit stays out of the way. */
function send(worker: RunningWorker, body: unknown, headers: Record<string, string> = {}): Promise<Response> {
  address += 1
  return worker.fetch('/api/opened', {
    method: 'POST',
    headers: { Origin: ORIGIN, 'Content-Type': 'application/json', 'CF-Connecting-IP': `198.51.100.${address % 250}`, ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

interface Row {
  first: number
  since: string
  installed: number
  version: string
  opens: number
}

async function rows(worker: RunningWorker): Promise<Row[]> {
  const { results } = await worker.coreDb
    .prepare('SELECT first, since, installed, version, opens FROM opens ORDER BY first, since, installed, version')
    .all<Row>()
  return results
}

async function total(worker: RunningWorker): Promise<number | undefined> {
  return (await worker.coreDb.prepare('SELECT opens FROM open_days').first<{ opens: number }>())?.opens
}

describe('POST /api/opened', () => {
  it('answers 204 with no body and adds one to its combination of the day', () =>
    withWorker({}, async (worker) => {
      for (const body of [first, later, later, { ...later, installed: false }, { ...later, version: '1.15.0' }]) {
        const response = await send(worker, body)
        expect(response.status).toBe(204)
        expect(response.headers.get('Cache-Control')).toBe('no-store')
        expect(await response.text()).toBe('')
      }
      expect(await rows(worker)).toEqual([
        { first: 0, since: '2-7', installed: 0, version: '1.14.22', opens: 1 },
        { first: 0, since: '2-7', installed: 1, version: '1.14.22', opens: 2 },
        { first: 0, since: '2-7', installed: 1, version: '1.15.0', opens: 1 },
        { first: 1, since: '', installed: 0, version: '1.14.22', opens: 1 },
      ])
      expect(await total(worker)).toBe(5)
      const { results } = await worker.coreDb.prepare('SELECT DISTINCT day FROM opens').all<{ day: string }>()
      const day = await worker.coreDb.prepare('SELECT day FROM open_days').first<{ day: string }>()
      expect(results).toEqual([{ day: day?.day }])
    }))

  it('keeps nothing of the request but the four fields, and logs nothing', () =>
    withWorker({}, async (worker) => {
      const response = await send(worker, later, { Cookie: 'session=abc', 'User-Agent': 'Mozilla/5.0 (iPad)' })
      expect(response.status).toBe(204)
      expect(await rows(worker)).toEqual([{ first: 0, since: '2-7', installed: 1, version: '1.14.22', opens: 1 }])
      expect(worker.logs).toEqual([])
      expect(worker.outbound).toEqual([])
    }))

  it.each([
    ['not JSON', '{first'],
    ['an unknown field', { ...later, locale: 'en' }],
    ['a value outside its set', { ...later, since: '3' }],
    ['a version that is not x.y.z', { ...later, version: '1.14' }],
    ['since given with first', { ...first, since: '1' }],
    ['since missing without first', { first: false, installed: true, version: '1.14.22' }],
  ])('refuses %s with 400 and writes nothing', (_, body) =>
    withWorker({}, async (worker) => {
      const response = await send(worker, body)
      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({ error: 'bad-request' })
      expect(await rows(worker)).toEqual([])
      expect(await total(worker)).toBeUndefined()
    }),
  )

  it('refuses a body past its cap with 413', () =>
    withWorker({}, async (worker) => {
      const response = await send(worker, { ...later, padding: 'x'.repeat(400) })
      expect(response.status).toBe(413)
      expect(await rows(worker)).toEqual([])
    }))

  it('refuses a ping from another origin', () =>
    withWorker({}, async (worker) => {
      expect((await send(worker, later, { Origin: 'https://example.com' })).status).toBe(403)
      expect(await rows(worker)).toEqual([])
    }))

  it('takes two pings a minute from one address, and refuses the third with 429', () =>
    withWorker({}, async (worker) => {
      const one = { 'CF-Connecting-IP': '203.0.113.7' }
      expect((await send(worker, later, one)).status).toBe(204)
      expect((await send(worker, later, one)).status).toBe(204)
      const refused = await send(worker, later, one)
      expect(refused.status).toBe(429)
      expect(refused.headers.get('Retry-After')).toBe('60')
      expect((await send(worker, later, { 'CF-Connecting-IP': '203.0.113.8' })).status).toBe(204)
      expect(await total(worker)).toBe(3)
    }))

  it('limits every address together', () =>
    withWorker({ ratelimits: { OPENS_RATE_ALL: { limit: 3, period: 60 } } }, async (worker) => {
      const answers = []
      for (let sent = 0; sent < 4; sent++) answers.push((await send(worker, later)).status)
      expect(answers).toEqual([204, 204, 204, 429])
      expect(await total(worker)).toBe(3)
    }))

  it("counts OPENS_DAILY_LIMIT a day, and past it writes nothing and waits until 00:00 UTC", () =>
    withWorker({ vars: { OPENS_DAILY_LIMIT: 2 } }, async (worker) => {
      expect((await send(worker, later)).status).toBe(204)
      expect((await send(worker, first)).status).toBe(204)
      for (let sent = 0; sent < 3; sent++) {
        const refused = await send(worker, later)
        expect(refused.status).toBe(503)
        expect(await refused.json()).toEqual({ error: 'feature-off', feature: 'opens' })
        // Until the next 00:00 UTC: never more than a day, never nothing.
        const wait = Number(refused.headers.get('Retry-After'))
        expect(wait).toBeGreaterThanOrEqual(1)
        expect(wait).toBeLessThanOrEqual(86_400)
      }
      expect((await rows(worker)).reduce((sum, row) => sum + row.opens, 0)).toBe(2)
      // The ceiling plus the one ping that was refused, so the watchdog sees the day it was reached.
      expect(await total(worker)).toBe(3)
    }))

  it('lets only one of two pings at once take the last place', () =>
    withWorker({ vars: { OPENS_DAILY_LIMIT: 3 } }, async (worker) => {
      expect((await send(worker, later)).status).toBe(204)
      expect((await send(worker, later)).status).toBe(204)
      const answers = await Promise.all([send(worker, first), send(worker, later)])
      expect(answers.map((response) => response.status).sort()).toEqual([204, 503])
      expect((await rows(worker)).reduce((sum, row) => sum + row.opens, 0)).toBe(3)
    }))

  for (const [why, limit] of [['not a number', 'many'], ['not set', undefined]] as const) {
    it(`refuses every ping when OPENS_DAILY_LIMIT is ${why}`, () =>
      withWorker({ vars: { OPENS_DAILY_LIMIT: limit } }, async (worker) => {
        expect((await send(worker, later)).status).toBe(503)
        expect(await rows(worker)).toEqual([])
      }))
  }

  it('answers like every switched-off feature when opens is switched off', () =>
    withWorker({ vars: { DISABLED_FEATURES: 'opens' } }, async (worker) => {
      const response = await send(worker, later)
      expect(response.status).toBe(503)
      expect(response.headers.get('Retry-After')).toBe('900')
      expect(await response.json()).toEqual({ error: 'feature-off', feature: 'opens' })
      expect(await rows(worker)).toEqual([])
    }))
})
