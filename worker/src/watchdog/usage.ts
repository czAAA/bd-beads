import type { Env } from '../env'
import type { Measure } from '../usageCounters'

/** Today's usage of the shared account, as far as the reader can tell; a measure it can't read is left out. */
type Usage = Partial<Record<Measure, number>>

/** Where the watchdog gets today's usage (spec 385, "Reads today's usage"). */
export interface UsageReader {
  read(day: string): Promise<Usage>
}

const COUNTED: Measure[] = ['requests', 'd1-rows-written', 'magic-link-emails']

/**
 * The fallback reader: the counters this Worker keeps itself (usageCounters.ts), and the database's size from D1's own
 * query metadata. It sees only this Worker's traffic, not the account's, and counting costs a write of its own, so its
 * levels are halved by `scheduledWatchdog`.
 */
export function d1UsageReader(db: D1Database): UsageReader {
  return {
    async read(day) {
      const usage: Usage = {}
      const { results } = await db
        .prepare('SELECT measure, value FROM usage_counters WHERE day = ?')
        .bind(day)
        .all<{ measure: Measure; value: number }>()
      for (const row of results) if (COUNTED.includes(row.measure)) usage[row.measure] = row.value
      const probe = await db.prepare('SELECT 1').run()
      const size = probe.meta?.size_after
      if (typeof size === 'number') usage['d1-storage'] = size
      return usage
    },
  }
}

interface AnalyticsResponse {
  data?: {
    viewer?: {
      accounts?: Array<{
        workers?: Array<{ sum?: { requests?: number } }>
        d1Writes?: Array<{ sum?: { rowsWritten?: number } }>
        d1Storage?: Array<{ max?: { databaseSizeBytes?: number }; dimensions?: { databaseId?: string } }>
        r2Storage?: Array<{ max?: { payloadSize?: number; metadataSize?: number } }>
      }>
    }
  }
  errors?: Array<{ message?: string }> | null
}

const QUERY = `
query Usage($account: String!, $since: Time!, $until: Time!, $day: Date!) {
  viewer {
    accounts(filter: { accountTag: $account }) {
      workers: workersInvocationsAdaptive(limit: 10000, filter: { datetime_geq: $since, datetime_leq: $until }) {
        sum { requests }
      }
      d1Writes: d1AnalyticsAdaptiveGroups(limit: 10000, filter: { date_geq: $day, date_leq: $day }) {
        sum { rowsWritten }
      }
      d1Storage: d1StorageAdaptiveGroups(limit: 10000, filter: { date_geq: $day, date_leq: $day }) {
        max { databaseSizeBytes }
        dimensions { databaseId }
      }
      r2Storage: r2StorageAdaptiveGroups(limit: 10000, filter: { date_geq: $day, date_leq: $day }) {
        max { payloadSize metadataSize }
      }
    }
  }
}`

/**
 * Cloudflare's GraphQL Analytics API, account-wide and with a read-only Account Analytics token. The dataset and field
 * names are from Cloudflare's documentation and not yet run against the real API: ticket 71 step A2 checks that
 * Workers Free serves it and fixes them if not; if it doesn't, `USAGE_SOURCE` stays 'd1'.
 */
export function graphqlUsageReader(env: Env, now: () => number = Date.now): UsageReader {
  return {
    async read(day) {
      if (!env.CF_ACCOUNT_ID || !env.CF_ANALYTICS_TOKEN) {
        throw new Error('CF_ACCOUNT_ID and CF_ANALYTICS_TOKEN are needed for the graphql usage source')
      }
      const response = await fetch('https://api.cloudflare.com/client/v4/graphql', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.CF_ANALYTICS_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: QUERY,
          variables: {
            account: env.CF_ACCOUNT_ID,
            since: `${day}T00:00:00Z`,
            until: new Date(now()).toISOString(),
            day,
          },
        }),
      })
      if (!response.ok) throw new Error(`GraphQL Analytics answered ${response.status}`)
      const body = (await response.json()) as AnalyticsResponse
      if (body.errors?.length) throw new Error(`GraphQL Analytics: ${body.errors[0]?.message ?? 'error'}`)
      const account = body.data?.viewer?.accounts?.[0]
      if (!account) throw new Error('GraphQL Analytics returned no account')
      const sum = <T>(rows: T[] | undefined, pick: (row: T) => number | undefined): number =>
        (rows ?? []).reduce((total, row) => total + (pick(row) ?? 0), 0)
      const usage: Usage = {
        requests: sum(account.workers, (row) => row.sum?.requests),
        'd1-rows-written': sum(account.d1Writes, (row) => row.sum?.rowsWritten),
        'r2-storage': sum(account.r2Storage, (row) => (row.max?.payloadSize ?? 0) + (row.max?.metadataSize ?? 0)),
      }
      // Storage is production's alone (spec 385), so without its database id there is nothing honest to report.
      const production = (account.d1Storage ?? []).filter((row) => row.dimensions?.databaseId === env.D1_DATABASE_ID)
      if (env.D1_DATABASE_ID && production.length > 0) {
        usage['d1-storage'] = sum(production, (row) => row.max?.databaseSizeBytes)
      }
      return usage
    },
  }
}
