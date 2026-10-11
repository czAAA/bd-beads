import { databaseSize } from './d1'
import type { Env } from './env'
import { ApiError, json } from './errors'
import { disabledFeatures, FEATURE_OFF_RETRY_SECONDS, type FeatureName } from './features'

/** What a guard and a handler know about the request they're serving. */
export interface RequestContext {
  request: Request
  env: Env
  url: URL
  /** The `:name` segments of the route's path. */
  params: Record<string, string>
  /** Set by the size-cap guard: the body is refused as it passes this many bytes (body.ts). */
  bodyCap?: number
}

/** A guard refuses by throwing an `ApiError`; one that passes returns. Guards run in order, before the handler. */
export type Guard = (rc: RequestContext) => void | Promise<void>

/** One endpoint: a method and path, the kill switch it belongs to, its guards in order, and its handler. */
export interface Route {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  /** Exact path under /api, with `:name` segments for parameters. */
  path: string
  /** The kill switch this route belongs to; `api` always applies, so a route names only its own feature. */
  feature?: FeatureName
  guards?: Guard[]
  handler(rc: RequestContext): Response | Promise<Response>
}

/** Methods that change nothing, so they skip the Origin check. */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

function match(route: Route, method: string, pathname: string): Record<string, string> | null {
  // HEAD gets what GET would (monitors often probe with it); the runtime drops the body.
  if (route.method !== method && !(route.method === 'GET' && method === 'HEAD')) return null
  const want = route.path.split('/')
  const got = pathname.split('/')
  if (want.length !== got.length) return null
  const params: Record<string, string> = {}
  for (const [index, segment] of want.entries()) {
    if (segment.startsWith(':')) params[segment.slice(1)] = decodeURIComponent(got[index])
    else if (segment !== got[index]) return null
  }
  return params
}

/**
 * Everything under /api, in the order spec 385 sets: the Origin check on changing requests (CSRF), the kill
 * switches, the route, its guards, its handler. Health skips the kill switches, so a switched-off feature never looks
 * like a dead Worker. Only `ApiError`s become refusals; anything else is rethrown as the crash it is.
 */
export async function handleApi(request: Request, env: Env, routes: Route[]): Promise<Response> {
  const url = new URL(request.url)
  try {
    if (!SAFE_METHODS.has(request.method) && request.headers.get('Origin') !== url.origin) {
      throw new ApiError('forbidden-origin')
    }
    const found = routes
      .map((route) => ({ route, params: match(route, request.method, url.pathname) }))
      .find((candidate) => candidate.params !== null)
    if (found?.route !== healthRoute) {
      const off = disabledFeatures(env)
      const feature = off.has('api') ? 'api' : found?.route.feature
      if (feature && off.has(feature)) throw new ApiError('feature-off', { feature }, FEATURE_OFF_RETRY_SECONDS)
    }
    if (!found) throw new ApiError('not-found')
    const rc: RequestContext = { request, env, url, params: found.params ?? {} }
    for (const guard of found.route.guards ?? []) await guard(rc)
    return await found.route.handler(rc)
  } catch (error) {
    if (error instanceof ApiError) return error.toResponse()
    throw error
  }
}

/**
 * `GET /api/health`: the Worker's name and version, after one read of each database, so "up" means "can reach its
 * storage". Behind Access it is the one bypassed path, so it reveals nothing but these.
 */
export const healthRoute: Route = {
  method: 'GET',
  path: '/api/health',
  async handler({ env }) {
    const body = { worker: env.WORKER_NAME, version: env.VERSION ?? 'unknown' }
    try {
      await Promise.all([databaseSize(env.CORE), databaseSize(env.BLOBS_DB)])
    } catch (error) {
      console.error('Health: a database could not be read', error)
      return json({ ok: false, ...body }, 503)
    }
    return json({ ok: true, ...body })
  },
}
