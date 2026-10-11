import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { build } from 'esbuild'
import { Miniflare, type WorkerOptions } from 'miniflare'
import { unstable_getMiniflareWorkerOptions } from 'wrangler'

/**
 * Runs the Worker in workerd through Miniflare with a local D1 and R2, from the repo's own `wrangler.jsonc` (so its
 * assets rule, bindings and cron are under test too). `@cloudflare/vitest-pool-workers` isn't used: it supports Vitest
 * 4 only (spec 385, seam 1). Tests drive it black-box, over HTTP and `scheduled()`, and read D1 directly.
 */
const root = resolve(import.meta.dirname, '../..')

export interface Outbound {
  url: string
  method: string
  headers: Record<string, string>
  body: string
}

export interface StartOptions {
  /** `worker` is the production module; `fixture` adds the tests' own routes. */
  entry?: 'worker' | 'fixture'
  /** Variables and secrets, as the dashboard would set them. */
  vars?: Record<string, string>
  /** Answers the Worker's outbound calls (Turnstile, Telegram, Healthchecks, Analytics); records each in `outbound`. */
  reply?: (call: Outbound) => Response | Promise<Response>
  /** Miniflare `ratelimits` bindings, by binding name. */
  ratelimits?: Record<string, { namespace_id: string; simple: { limit: number; period: number } }>
}

type D1 = Awaited<ReturnType<Miniflare['getD1Database']>>
type R2 = Awaited<ReturnType<Miniflare['getR2Bucket']>>

export interface RunningWorker {
  /** `GET /api/health`-style calls against the Worker as the platform would route them. */
  fetch(path: string, init?: RequestInit): Promise<Response>
  /** Fires the Cron Trigger as if it were `time`; says how the run ended ('ok' or 'exception'). */
  scheduled(time: Date): Promise<string>
  db: D1
  r2: R2
  outbound: Outbound[]
  dispose(): Promise<void>
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
      mainFields: ['module', 'main'],
      conditions: ['workerd', 'worker', 'browser'],
      target: 'es2023',
      logLevel: 'silent',
    }).then((result) => result.outputFiles[0].text)
    bundles.set(entry, built)
  }
  return built
}

/** Applies the migrations in order, as `wrangler d1 migrations apply` does. */
async function migrate(db: D1): Promise<void> {
  const dir = join(root, 'worker/migrations')
  for (const file of readdirSync(dir).filter((name) => name.endsWith('.sql')).sort()) {
    const sql = readFileSync(join(dir, file), 'utf8')
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n')
    for (const statement of sql.split(';').map((part) => part.trim()).filter(Boolean)) {
      await db.prepare(statement).run()
    }
  }
}

/** Starts the Worker in workerd with a fresh, migrated D1 and an empty R2 bucket. Call `dispose` when done. */
export async function startWorker(options: StartOptions = {}): Promise<RunningWorker> {
  const { workerOptions: config } = unstable_getMiniflareWorkerOptions(join(root, 'wrangler.jsonc'), 'dev')
  const workerOptions = config as unknown as WorkerOptions & {
    assets: object
    bindings: Record<string, unknown>
  }
  const assetsDir = mkdtempSync(join(tmpdir(), 'bd-beads-assets-'))
  writeFileSync(join(assetsDir, 'index.html'), '<!doctype html><title>app</title>')
  const outbound: Outbound[] = []
  const miniflare = new Miniflare({
    ...workerOptions,
    modules: true,
    script: await bundle(options.entry ?? 'worker'),
    assets: { ...workerOptions.assets, directory: assetsDir },
    bindings: { ...workerOptions.bindings, ...options.vars },
    ...(options.ratelimits ? { ratelimits: options.ratelimits } : {}),
    outboundService: async (request: Request) => {
      const call = {
        url: request.url,
        method: request.method,
        headers: Object.fromEntries(request.headers),
        body: await request.text(),
      }
      outbound.push(call)
      return options.reply ? options.reply(call) : new Response('{}')
    },
  } as WorkerOptions)
  await miniflare.ready
  const db = await miniflare.getD1Database('DB')
  const r2 = await miniflare.getR2Bucket('BLOBS')
  await migrate(db)
  return {
    fetch: (path, init) => miniflare.dispatchFetch(`http://localhost${path}`, init as never) as unknown as Promise<Response>,
    async scheduled(time) {
      const worker = await miniflare.getWorker()
      const result = await worker.scheduled({ scheduledTime: time, cron: '*/15 * * * *' })
      return result.outcome
    },
    db,
    r2,
    outbound,
    async dispose() {
      await miniflare.dispose()
      rmSync(assetsDir, { recursive: true, force: true })
    },
  }
}
