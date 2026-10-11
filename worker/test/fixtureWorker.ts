// The production Worker plus parts that exist only for the tests (ticket 71): the guards, the blob stores and the
// daily hook have no caller until the feature tickets, so these stand in for one. Never deployed.
import type { Route } from '../src/api'
import { readBody, upload } from '../src/body'
import { blobStoreFor, uploadCapFor, type Plan } from '../src/blobs'
import { ApiError, json } from '../src/errors'
import { FEATURES } from '../src/features'
import { blobStorageLimit, rateLimit, sizeCap, turnstile } from '../src/guards'
import { createWorker } from '../src/index'

/** PUT, GET and DELETE of a blob in one plan's store; only the D1 store's uploads meet the storage limit. */
function blobRoutes(plan: Plan): Route[] {
  const path = `/api/test/${plan}/blobs/:id`
  return [
    {
      method: 'PUT',
      path,
      guards: [sizeCap((rc) => uploadCapFor(rc.env, plan)), ...(plan === 'free' ? [blobStorageLimit()] : [])],
      async handler(rc) {
        const expires = rc.url.searchParams.get('expires')
        await blobStoreFor(rc.env, plan).put(rc.params.id, upload(rc), {
          owner: 'account-1',
          expiresAt: expires === null ? null : Number(expires),
        })
        return json({ stored: rc.params.id })
      },
    },
    {
      method: 'GET',
      path,
      async handler(rc) {
        const blob = await blobStoreFor(rc.env, plan).get(rc.params.id)
        if (!blob) throw new ApiError('not-found')
        return new Response(blob.body, {
          headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Length': String(blob.size),
            'X-Owner': blob.owner,
            'X-Expires-At': String(blob.expiresAt),
          },
        })
      },
    },
    {
      method: 'DELETE',
      path,
      async handler(rc) {
        await blobStoreFor(rc.env, plan).delete(rc.params.id)
        return json({ deleted: rc.params.id })
      },
    },
  ]
}

const routes: Route[] = [
  { method: 'POST', path: '/api/test/create', guards: [turnstile()], handler: () => json({ created: true }) },
  {
    method: 'POST',
    path: '/api/test/limited',
    guards: [rateLimit({ binding: 'RATE_LIMIT_TEST', periodSeconds: 60 })],
    handler: () => json({ ok: true }),
  },
  {
    method: 'POST',
    path: '/api/test/unbound',
    guards: [rateLimit({ binding: 'RATE_LIMIT_NOT_DECLARED', periodSeconds: 10 })],
    handler: () => json({ ok: true }),
  },
  {
    method: 'POST',
    path: '/api/test/json',
    guards: [sizeCap(() => 64)],
    handler: async (rc) => json({ length: (await readBody(upload(rc))).byteLength }),
  },
  ...(['GET', 'POST', 'PUT', 'DELETE'] as const).map(
    (method): Route => ({ method, path: '/api/test/change', handler: () => json({ changed: method }) }),
  ),
  ...blobRoutes('free'),
  ...blobRoutes('pro'),
  ...FEATURES.map(
    (feature): Route => ({ method: 'GET', path: `/api/test/feature/${feature}`, feature, handler: () => json({ feature }) }),
  ),
]

export default createWorker({
  routes,
  // Tells the test it ran by an outbound call the harness records.
  daily: [
    async () => {
      await fetch('https://daily-hook.test/ran', { method: 'POST' })
    },
  ],
})
