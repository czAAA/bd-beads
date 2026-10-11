import type { Env } from '../env'
import type { Usage } from './levels'

/** Where the watchdog gets today's counts (spec 385, "How it reads usage"). */
export interface UsageReader {
  /** Usage from `since` to `until`; throws when it can't be read at all. */
  read(since: Date, until: Date): Promise<Usage>
}

const GRAPHQL_URL = 'https://api.cloudflare.com/client/v4/graphql'

interface AnalyticsResponse {
  data?: {
    viewer?: {
      accounts?: Array<{
        requests?: Array<{ sum?: { requests?: number } }>
        errors?: Array<{ sum?: { errors?: number } }>
        d1?: Array<{ sum?: { rowsWritten?: number } }>
        r2?: Array<{ max?: { payloadSize?: number; metadataSize?: number }; dimensions?: { bucketName?: string } }>
      }>
    }
  }
  errors?: Array<{ message?: string }> | null
}

/** A GraphQL input object written inline: the values are JSON strings and lists, which GraphQL reads the same way. */
function graphqlFilter(fields: Record<string, string | string[]>): string {
  return `{ ${Object.entries(fields).map(([name, value]) => `${name}: ${JSON.stringify(value)}`).join(', ')} }`
}

/** A time window as the adaptive datasets filter by it. */
function timeWindow(since: Date, until: Date): Record<string, string> {
  return { datetime_geq: since.toISOString(), datetime_leq: until.toISOString() }
}

const DAY_MS = 86_400_000

/** A variable the reader can't work without; a missing one fails the read, which the watchdog reports. */
function requireVar(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} is not set`)
  return value
}

/**
 * Cloudflare's GraphQL Analytics API, with a read-only Account Analytics token (spec 385). Production counts requests,
 * D1 rows written and R2 storage account-wide, the limits it shares with dev; dev counts only its own Worker,
 * databases and bucket. Each counts only its own Worker's errors (crashes and CPU over the limit). GraphQL counts a
 * little more than Cloudflare bills, so it errs towards warning early.
 *
 * UNVERIFIED: the dataset, field and filter names below are from Cloudflare's documentation and have not been run
 * against the real API. Ticket 71 step A2 checks that Workers Free serves them and fixes this reader to match
 * (`docs/operations.md`); if Free serves none, the watchdog reports the database sizes alone.
 */
export function graphqlUsageReader(env: Env): UsageReader {
  return {
    async read(since, until) {
      const account = requireVar(env.CF_ACCOUNT_ID, 'CF_ACCOUNT_ID')
      const token = requireVar(env.CF_ANALYTICS_TOKEN, 'CF_ANALYTICS_TOKEN')
      const script = requireVar(env.WORKER_SCRIPT, 'WORKER_SCRIPT')
      const own = env.WORKER_NAME !== 'production'
      const today = timeWindow(since, until)
      const day = since.toISOString().slice(0, 10)
      // R2 storage is sampled through the day, so the last 24 hours always hold a sample, even just after midnight.
      const lastDay = timeWindow(new Date(until.getTime() - DAY_MS), until)
      const ownDatabases = () => [
        requireVar(env.CORE_DATABASE_ID, 'CORE_DATABASE_ID'),
        requireVar(env.BLOBS_DATABASE_ID, 'BLOBS_DATABASE_ID'),
      ]
      const requests = graphqlFilter({ ...today, ...(own ? { scriptName: script } : {}) })
      const errors = graphqlFilter({ ...today, scriptName: script })
      const d1 = graphqlFilter({ date_geq: day, date_leq: day, ...(own ? { databaseId_in: ownDatabases() } : {}) })
      const r2 = graphqlFilter({ ...lastDay, ...(own ? { bucketName: requireVar(env.BLOBS_BUCKET_NAME, 'BLOBS_BUCKET_NAME') } : {}) })
      const query = `query {
  viewer {
    accounts(filter: ${graphqlFilter({ accountTag: account })}) {
      requests: workersInvocationsAdaptive(limit: 10000, filter: ${requests}) {
        sum { requests }
      }
      errors: workersInvocationsAdaptive(limit: 10000, filter: ${errors}) {
        sum { errors }
      }
      d1: d1AnalyticsAdaptiveGroups(limit: 10000, filter: ${d1}) {
        sum { rowsWritten }
      }
      r2: r2StorageAdaptiveGroups(limit: 10000, filter: ${r2}) {
        max { payloadSize metadataSize }
        dimensions { bucketName }
      }
    }
  }
}`
      const response = await fetch(GRAPHQL_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      })
      if (!response.ok) throw new Error(`GraphQL Analytics answered ${response.status}`)
      const body = (await response.json()) as AnalyticsResponse
      if (body.errors?.length) throw new Error(`GraphQL Analytics: ${body.errors.map((e) => e.message).join('; ')}`)
      const result = body.data?.viewer?.accounts?.[0]
      if (!result) throw new Error('GraphQL Analytics returned no account')
      const sum = <T>(rows: T[] | undefined, pick: (row: T) => number | undefined): number =>
        (rows ?? []).reduce((total, row) => total + (pick(row) ?? 0), 0)
      return {
        'api-requests': sum(result.requests, (row) => row.sum?.requests),
        'worker-errors': sum(result.errors, (row) => row.sum?.errors),
        'd1-rows-written': sum(result.d1, (row) => row.sum?.rowsWritten),
        // One row per bucket, its largest sample in the window.
        'r2-storage': sum(result.r2, (row) => (row.max?.payloadSize ?? 0) + (row.max?.metadataSize ?? 0)),
      }
    },
  }
}
