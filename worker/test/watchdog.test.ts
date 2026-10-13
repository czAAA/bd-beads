import { describe, expect, it } from 'vitest'
import { startWorker, type Outbound, type RunningWorker, type StartOptions } from './harness.ts'

// Spec 385, seam 2: the watchdog's scheduled run, with Cloudflare's GraphQL Analytics and Healthchecks.io stood in for
// by the harness's answers to the Worker's outbound calls, and the real local D1 for the databases' sizes.

const GRAPHQL = 'https://api.cloudflare.com/client/v4/graphql'
const PING = 'https://hc-ping.test/watchdog-uuid'
const DAILY_HOOK = 'https://daily-hook.test/ran'

/** What the stand-in analytics report for today. */
interface Today {
  requests?: number
  errors?: number
  rowsWritten?: number
  r2Bytes?: number
}

/** The GraphQL answer for `today`, in the shape the reader asks for (watchdog/analytics.ts). */
function analytics(today: Today): Response {
  return Response.json({
    data: {
      viewer: {
        accounts: [
          {
            requests: [{ sum: { requests: today.requests ?? 0 } }],
            errors: [{ sum: { errors: today.errors ?? 0 } }],
            d1: [{ sum: { rowsWritten: today.rowsWritten ?? 0 } }],
            r2: [{ max: { payloadSize: today.r2Bytes ?? 0, metadataSize: 0 }, dimensions: { bucketName: 'bd-beads-dev' } }],
          },
        ],
      },
    },
    errors: null,
  })
}

const SECRETS = {
  CF_ACCOUNT_ID: 'account-tag',
  CF_ANALYTICS_TOKEN: 'analytics-token',
  CORE_DATABASE_ID: 'core-id',
  BLOBS_DATABASE_ID: 'blobs-id',
  HEALTHCHECK_URL: PING,
}

/** Starts the test Worker in `env` with analytics answering `today` (or `graphql`'s answer), and runs `test`. */
async function withWatchdog(
  options: { env?: StartOptions['env']; today?: Today; graphql?: () => Response; vars?: StartOptions['vars'] },
  test: (worker: RunningWorker) => Promise<void>,
): Promise<void> {
  const worker = await startWorker({
    entry: 'fixture',
    env: options.env,
    vars: { ...SECRETS, ...options.vars },
    reply: ({ url }) => (url === GRAPHQL ? (options.graphql?.() ?? analytics(options.today ?? {})) : new Response('OK')),
  })
  try {
    await test(worker)
  } finally {
    await worker.dispose()
  }
}

/** The run's heartbeat pings, which the test expects exactly one of. */
function pings(worker: RunningWorker): Outbound[] {
  return worker.outbound.filter((call) => call.url.startsWith(PING))
}

function onePing(worker: RunningWorker): Outbound {
  const all = pings(worker)
  expect(all).toHaveLength(1)
  return all[0]
}

const NOON = new Date('2026-10-11T12:00:00Z')

describe('the watchdog', () => {
  it('pings success when every measure is under its level, with every reading in the report', () =>
    withWatchdog({ today: { requests: 999, rowsWritten: 10, errors: 1, r2Bytes: 1024 } }, async (worker) => {
      expect(await worker.scheduled(NOON)).toBe('ok')
      const ping = onePing(worker)
      expect(ping.url).toBe(PING)
      expect(ping.body).toContain('bd-beads watchdog, dev Worker, 2026-10-11 12:00 UTC')
      expect(ping.body).toContain('API requests today (dev Worker only): 999 (warn level 1,000)')
      expect(ping.body).toContain('blobs database size: ')
      expect(ping.body).not.toContain('Over its warn level')
    }))

  it('pings /fail naming the Worker and each measure over its level, with value and level', () =>
    withWatchdog({ today: { requests: 1204, rowsWritten: 5000, errors: 3 } }, async (worker) => {
      await worker.scheduled(NOON)
      const ping = onePing(worker)
      expect(ping.url).toBe(`${PING}/fail`)
      const over = ping.body.split('\n\n').find((part) => part.startsWith('Over its warn level:'))
      expect(over).toBe(
        [
          'Over its warn level:',
          '- API requests today (dev Worker only): 1,204 (warn level 1,000)',
          '- D1 rows written today (dev Worker only): 5,000 (warn level 1,000)',
        ].join('\n'),
      )
      expect(ping.body).toContain('dev Worker')
    }))

  it('groups counts by thousands, from 0 up to millions', () =>
    withWatchdog({ today: { requests: 1234567, rowsWritten: 0, errors: 999 } }, async (worker) => {
      await worker.scheduled(NOON)
      const body = onePing(worker).body
      expect(body).toContain('API requests today (dev Worker only): 1,234,567 (warn level 1,000)')
      expect(body).toContain('D1 rows written today (dev Worker only): 0 (warn level 1,000)')
      expect(body).toContain('Worker errors today (this Worker): 999 (warn level 10)')
    }))

  it("applies dev's levels to dev and production's to production", async () => {
    const today = { requests: 2000, rowsWritten: 2000 }
    await withWatchdog({ env: 'dev', today }, async (worker) => {
      await worker.scheduled(NOON)
      expect(onePing(worker).url).toBe(`${PING}/fail`)
    })
    await withWatchdog({ env: 'production', today }, async (worker) => {
      await worker.scheduled(NOON)
      const ping = onePing(worker)
      expect(ping.url).toBe(PING)
      expect(ping.body).toContain('bd-beads watchdog, production Worker')
      expect(ping.body).toContain('API requests today (whole account): 2,000 (warn level 55,000)')
    })
  })

  it('counts only its own Worker, databases and bucket on dev, and the whole account on production', async () => {
    const query = (worker: RunningWorker) => {
      const call = worker.outbound.find((c) => c.url === GRAPHQL)
      expect(call?.headers.authorization).toBe('Bearer analytics-token')
      return (JSON.parse(call?.body ?? '{}') as { query: string }).query
    }
    await withWatchdog({ env: 'dev' }, async (worker) => {
      await worker.scheduled(NOON)
      const sent = query(worker)
      expect(sent).toContain('accountTag: "account-tag"')
      expect(sent).toMatch(/requests: workersInvocationsAdaptive\([^)]*scriptName: "bd-beads-dev"/)
      expect(sent).toContain('databaseId_in: ["core-id","blobs-id"]')
      expect(sent).toContain('bucketName: "bd-beads-dev"')
      expect(sent).toContain('datetime_geq: "2026-10-11T00:00:00.000Z", datetime_leq: "2026-10-11T12:00:00.000Z"')
    })
    await withWatchdog({ env: 'production' }, async (worker) => {
      await worker.scheduled(NOON)
      const sent = query(worker)
      expect(sent).not.toMatch(/requests: workersInvocationsAdaptive\([^)]*scriptName/)
      expect(sent).toMatch(/errors: workersInvocationsAdaptive\([^)]*scriptName: "bd-beads"/)
      expect(sent).not.toContain('databaseId_in')
      expect(sent).not.toContain('bucketName:')
    })
  })

  it("warns on a database's size, read from D1 itself", () =>
    withWatchdog({ vars: { WARN_BLOBS_DB_MB: 0.001 } }, async (worker) => {
      await worker.scheduled(NOON)
      const ping = onePing(worker)
      expect(ping.url).toBe(`${PING}/fail`)
      expect(ping.body).toMatch(/Over its warn level:\n- blobs database size: [\d.]+ MB \(warn level 0\.0 MB\)/)
    }))

  it('pings /fail with the error when the analytics cannot be read, and still reports the sizes', async () => {
    await withWatchdog({ graphql: () => new Response('nope', { status: 500 }) }, async (worker) => {
      expect(await worker.scheduled(NOON)).toBe('ok')
      const ping = onePing(worker)
      expect(ping.url).toBe(`${PING}/fail`)
      expect(ping.body).toContain("- Usage could not be read from Cloudflare's analytics: GraphQL Analytics answered 500")
      expect(ping.body).toMatch(/core database size: [\d.]+ MB/)
    })
    const graphqlError = () => Response.json({ data: null, errors: [{ message: 'unknown field' }] })
    await withWatchdog({ graphql: graphqlError }, async (worker) => {
      await worker.scheduled(NOON)
      expect(onePing(worker).body).toContain('GraphQL Analytics: unknown field')
    })
    await withWatchdog({ vars: { CF_ANALYTICS_TOKEN: '' } }, async (worker) => {
      await worker.scheduled(NOON)
      expect(onePing(worker).body).toContain('CF_ANALYTICS_TOKEN is not set')
      expect(worker.outbound.some((call) => call.url === GRAPHQL)).toBe(false)
    })
  })

  it('reports a level that is not a number instead of never warning', () =>
    withWatchdog({ vars: { WARN_API_REQUESTS: 'lots' } }, async (worker) => {
      await worker.scheduled(NOON)
      const ping = onePing(worker)
      expect(ping.url).toBe(`${PING}/fail`)
      expect(ping.body).toContain('API requests today (dev Worker only): its level WARN_API_REQUESTS is not a number')
    }))

  it('runs the daily hook on the first run after 00:00 UTC only', () =>
    withWatchdog({}, async (worker) => {
      const hookRuns = () => worker.outbound.filter((call) => call.url === DAILY_HOOK).length
      await worker.scheduled(new Date('2026-10-11T23:45:00Z'))
      expect(hookRuns()).toBe(0)
      await worker.scheduled(new Date('2026-10-12T00:00:00Z'))
      expect(hookRuns()).toBe(1)
      await worker.scheduled(new Date('2026-10-12T00:15:00Z'))
      await worker.scheduled(NOON)
      expect(hookRuns()).toBe(1)
      expect(pings(worker).map((ping) => ping.url)).toEqual([PING, PING, PING, PING])
    }))
})
