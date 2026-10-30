import { handleApi, healthRoute, type Route } from './api'
import type { Env } from './env'
import { feedbackRoute } from './feedback'
import { runWatchdog, watchdogDeps, type DailyHook } from './watchdog/run'

/** What a Worker is built from: its routes besides health and feedback, and the work its watchdog does once a day. */
interface WorkerParts {
  routes?: Route[]
  daily?: DailyHook[]
}

/** The Worker (spec 385). Called only for /api/* (`run_worker_first`) and the Cron Trigger's watchdog; the app is
 * static assets. Built by a function so the tests can add parts of their own. */
export function createWorker({ routes = [], daily = [] }: WorkerParts = {}): ExportedHandler<Env> {
  const all = [healthRoute, feedbackRoute, ...routes]
  return {
    fetch(request, env) {
      if (new URL(request.url).pathname.startsWith('/api/')) return handleApi(request, env, all)
      // Reached only for a path with no static asset; the assets' own 404 answers it.
      return env.ASSETS.fetch(request)
    },
    async scheduled(controller, env) {
      await runWatchdog(env, controller.scheduledTime, watchdogDeps(env, daily))
    },
  }
}

export default createWorker()
