import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { build } from 'esbuild'
import { Miniflare, type Request as MiniflareRequest } from 'miniflare'
import { unstable_readConfig, unstable_splitSqlQuery } from 'wrangler'

/** Runs the Worker in workerd via Miniflare 4 with local D1 and R2, configured from the repo's `wrangler.jsonc`.
 * Miniflare is used directly: `@cloudflare/vitest-pool-workers` supports Vitest 4 only (docs/testing.md). Tests drive
 * it black-box over HTTP and `scheduled()`, seeing outbound calls in `outbound`, answered by `reply`. */
const root = resolve(import.meta.dirname, '../..')

/** A call the Worker made to the outside (Turnstile, GraphQL Analytics, Healthchecks), as the harness caught it. */
export interface Outbound {
  url: string
  method: string
  headers: Record<string, string>
  body: string
}

export interface StartOptions {
  /** Which environment of `wrangler.jsonc` to run (default dev). */
  env?: 'dev' | 'production'
  /** `worker` is the deployed module; `fixture` adds the tests' own routes and daily hook. */
  entry?: 'worker' | 'fixture'
  /** Variables and secrets, as the dashboard would set them, over the config's own. */
  vars?: Record<string, string | number>
  /** Answers the Worker's outbound calls; each is recorded in `outbound` first. Default: `{}`. */
  reply?: (call: Outbound) => Response | Promise<Response>
  /** Rate Limiting bindings, as a feature ticket would declare them under `ratelimits`. */
  ratelimits?: Record<string, { limit: number; period: 10 | 60 }>
  /** Binds this database to something that isn't one, so every query on it throws. */
  brokenDatabase?: 'CORE' | 'BLOBS_DB'
}

type D1 = Awaited<ReturnType<Miniflare['getD1Database']>>
type R2 = Awaited<ReturnType<Miniflare['getR2Bucket']>>

export interface RunningWorker {
  /** A request to the Worker's origin (`http://localhost`), routed as the platform would: assets or the Worker. */
  fetch(path: string, init?: RequestInit): Promise<Response>
  /** Fires the Cron Trigger as if at `time`; says how the run ended ('ok' or 'exception'). */
  scheduled(time: Date): Promise<string>
  blobsDb: D1
  r2: R2
  outbound: Outbound[]
  dispose(): Promise<void>
}

/** The Worker's origin in the tests; a changing request must name it in `Origin`. */
export const ORIGIN = 'http://localhost'

/** The parts of one environment of `wrangler.jsonc` the harness reads (Wrangler's own type for it is too loose
 * here). */
interface WranglerEnvironment {
  compatibility_date?: string
  compatibility_flags: string[]
  vars: Record<string, string | number>
  d1_databases: Array<{ binding: string; database_name?: string; migrations_dir?: string }>
  r2_buckets: Array<{ binding: string; bucket_name?: string }>
  assets?: { binding?: string; run_worker_first?: boolean | string[] }
  triggers: { crons?: string[] }
}

const bundles = new Map<string, Promise<string>>()

function bundle(entry: 'worker' | 'fixture'): Promise<string> {
  let built = bundles.get(entry)
  if (!built) {
    built = build({
      entryPoints: [join(root, entry === 'worker' ? 'worker/src/index.ts' : 'worker/test/fixtureWorker.ts')],
      bundle: true,
      write: false,
      format: 'esm',
      platform: 'neutral',
      conditions: ['workerd', 'worker', 'browser'],
      target: 'es2023',
      logLevel: 'silent',
    }).then((result) => result.outputFiles[0].text)
    bundles.set(entry, built)
  }
  return built
}

/** Applies a database's migrations in order, as `wrangler d1 migrations apply` does. */
async function migrate(db: D1, dir: string): Promise<void> {
  for (const file of readdirSync(join(root, dir)).filter((name) => name.endsWith('.sql')).sort()) {
    for (const statement of unstable_splitSqlQuery(readFileSync(join(root, dir, file), 'utf8'))) {
      await db.prepare(statement).run()
    }
  }
}

/** Starts the Worker with fresh, migrated databases and an empty bucket. Call `dispose` when done. */
export async function startWorker(options: StartOptions = {}): Promise<RunningWorker> {
  const config: WranglerEnvironment = unstable_readConfig({ config: join(root, 'wrangler.jsonc'), env: options.env ?? 'dev' })
  const databases = config.d1_databases.filter((db) => db.binding !== options.brokenDatabase)
  const assetsDir = mkdtempSync(join(tmpdir(), 'bd-beads-assets-'))
  writeFileSync(join(assetsDir, 'index.html'), '<!doctype html><title>app</title>')
  const outbound: Outbound[] = []
  const miniflare = new Miniflare({
    modules: true,
    script: await bundle(options.entry ?? 'worker'),
    compatibilityDate: config.compatibility_date,
    compatibilityFlags: config.compatibility_flags,
    bindings: {
      ...config.vars,
      ...options.vars,
      ...(options.brokenDatabase ? { [options.brokenDatabase]: 'not a database' } : {}),
    },
    d1Databases: Object.fromEntries(databases.map((db) => [db.binding, db.database_name ?? db.binding])),
    r2Buckets: Object.fromEntries(config.r2_buckets.map((bucket) => [bucket.binding, bucket.bucket_name ?? bucket.binding])),
    ratelimits: Object.fromEntries(
      Object.entries(options.ratelimits ?? {}).map(([name, simple], index) => [
        name,
        { namespace_id: String(index + 1), simple },
      ]),
    ),
    assets: {
      directory: assetsDir,
      binding: config.assets?.binding,
      routerConfig: {
        has_user_worker: true,
        invoke_user_worker_ahead_of_assets: false,
        static_routing: { user_worker: Array.isArray(config.assets?.run_worker_first) ? config.assets.run_worker_first : [] },
      },
    },
    outboundService: async (request: MiniflareRequest) => {
      const call = {
        url: request.url,
        method: request.method,
        headers: Object.fromEntries(request.headers),
        body: await request.text(),
      }
      outbound.push(call)
      return options.reply ? options.reply(call) : new Response('{}')
    },
  })
  await miniflare.ready
  for (const db of databases) await migrate(await miniflare.getD1Database(db.binding), db.migrations_dir ?? '')
  return {
    fetch: (path, init) => miniflare.dispatchFetch(`${ORIGIN}${path}`, init as never) as unknown as Promise<Response>,
    async scheduled(time) {
      const worker = await miniflare.getWorker()
      return (await worker.scheduled({ scheduledTime: time, cron: config.triggers.crons?.[0] ?? '' })).outcome
    },
    // A broken BLOBS_DB has no database behind it; a test that breaks it doesn't read it either.
    blobsDb: options.brokenDatabase === 'BLOBS_DB' ? (null as never) : await miniflare.getD1Database('BLOBS_DB'),
    r2: await miniflare.getR2Bucket('BLOBS'),
    outbound,
    async dispose() {
      await miniflare.dispose()
      rmSync(assetsDir, { recursive: true, force: true })
    },
  }
}
