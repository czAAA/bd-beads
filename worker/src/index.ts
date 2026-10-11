import { handleApi, healthRoute, type Route } from './api'
import type { Env } from './env'
import { scheduledWatchdog } from './watchdog'

/**
 * The Worker (spec 385). It runs for /api/* only (`run_worker_first` in wrangler.jsonc) and, on its Cron Trigger, the
 * watchdog; everything else is served by the static assets without invoking it. Later tickets add their routes here.
 * Declared apart from the default export so the tests can add routes of their own.
 */
export function createWorker(routes: Route[] = []): ExportedHandler<Env> {
  const all = [healthRoute, ...routes]
  return {
    fetch(request, env, ctx) {
      if (new URL(request.url).pathname.startsWith('/api/')) return handleApi(request, env, ctx, all)
      // Not reached in production, where the platform serves assets itself; keeps `wrangler dev` and tests whole.
      return env.ASSETS.fetch(request)
    },
    scheduled(controller, env, ctx) {
      ctx.waitUntil(scheduledWatchdog(env, controller.scheduledTime))
    },
  }
}

export default createWorker()
