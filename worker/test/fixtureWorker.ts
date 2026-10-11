// The production Worker plus routes that exist only for the tests (ticket 71): the reusable guards and the blob
// stores have no caller until the feature tickets, so these stand in for one. Never part of the deployed bundle.
import { blobCapFor, type Plan } from '../src/blobs'
import { blobStore, readBody, type Route } from '../src/api'
import { json } from '../src/errors'
import { FEATURES } from '../src/features'
import { byIp, rateLimit, sizeCap, turnstile } from '../src/guards'
import { createWorker } from '../src/index'

const planOf = (url: URL): Plan => (url.searchParams.get('plan') === 'pro' ? 'pro' : 'free')

const routes: Route[] = [
  {
    method: 'POST',
    path: '/api/test/create',
    guards: [turnstile()],
    handler: () => json({ created: true }),
  },
  {
    method: 'POST',
    path: '/api/test/limited',
    guards: [rateLimit({ name: 'test-limited', limit: 2, windowSeconds: 60 }, byIp)],
    handler: () => json({ ok: true }),
  },
  {
    method: 'PUT',
    path: '/api/test/blobs/:id',
    guards: [sizeCap((rc) => blobCapFor(planOf(rc.url)))],
    async handler(rc) {
      const bytes = await readBody(rc)
      await blobStore(rc, planOf(rc.url)).put(rc.params.id, bytes)
      return json({ id: rc.params.id, size: bytes.byteLength })
    },
  },
  {
    method: 'GET',
    path: '/api/test/blobs/:id',
    async handler(rc) {
      const bytes = await blobStore(rc, planOf(rc.url)).get(rc.params.id)
      if (!bytes) return json({ error: 'not-found' }, 404)
      return new Response(bytes, { headers: { 'Content-Type': 'application/octet-stream' } })
    },
  },
  {
    method: 'DELETE',
    path: '/api/test/blobs/:id',
    async handler(rc) {
      await blobStore(rc, planOf(rc.url)).delete(rc.params.id)
      return json({ deleted: true })
    },
  },
  ...FEATURES.map(
    (feature): Route => ({
      method: 'GET',
      path: `/api/test/feature/${feature}`,
      feature,
      handler: () => json({ feature, on: true }),
    }),
  ),
]

export default createWorker(routes)
