import { readBody, type Upload } from './body'
import { MB, numberVar, type Env } from './env'
import { ApiError } from './errors'

/**
 * An owner's plan, which decides where their blobs live (spec 385, ADR 0014): Free accounts' and View links' in the
 * `blobs` D1 database, which stops at its limit instead of billing; only Pro's in R2. Moving Free data to R2 later is
 * a change in `blobStoreFor` plus a copy job.
 */
export type Plan = 'free' | 'pro'

/** What is kept beside a blob's bytes. */
interface BlobMeta {
  /** The account id that owns it; quotas are counted by it (ticket 323). */
  owner: string
  /** Epoch milliseconds after which ticket 323's cleanup deletes it; null for a blob that doesn't expire. */
  expiresAt: number | null
}

/** A stored blob: its bytes (a stream when it comes from R2, so a download isn't held whole either), size and meta. */
interface StoredBlob extends BlobMeta {
  body: ReadableStream<Uint8Array> | Uint8Array
  size: number
}

/** Put, get and delete by id: the only way a feature stores a blob. */
export interface BlobStore {
  /** Stores the upload under `id`, replacing any blob there. Refuses `too-large` past the upload's cap. */
  put(id: string, upload: Upload, meta: BlobMeta): Promise<void>
  /** `null` when there is no blob with that id. */
  get(id: string): Promise<StoredBlob | null>
  /** Deleting an id that isn't there is not an error, so a deletion is safe to retry (ADR 0049). */
  delete(id: string): Promise<void>
}

/** The largest upload a plan's storage takes, from the environment's variables (ticket 323 sets the numbers). */
export function uploadCapFor(env: Env, plan: Plan): number {
  return plan === 'pro' ? numberVar(env, 'UPLOAD_CAP_R2_MB') * MB : numberVar(env, 'UPLOAD_CAP_D1_BYTES')
}

const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/

function checkId(id: string): void {
  if (!SAFE_ID.test(id)) throw new Error(`Blob id must be 1-64 letters, digits, "-" or "_": ${id}`)
}

/** Blobs as rows of the `blobs` database's `blobs` table (worker/migrations/blobs). */
function d1BlobStore(db: D1Database): BlobStore {
  return {
    async put(id, source, meta) {
      checkId(id)
      const bytes = await readBody(source)
      await db
        .prepare(
          'INSERT INTO blobs (id, owner, size, expires_at, created_at, data) VALUES (?1, ?2, ?3, ?4, ?5, ?6) ' +
            'ON CONFLICT (id) DO UPDATE SET owner = excluded.owner, size = excluded.size, ' +
            'expires_at = excluded.expires_at, data = excluded.data',
        )
        .bind(id, meta.owner, bytes.byteLength, meta.expiresAt, Date.now(), bytes)
        .run()
    },
    async get(id) {
      checkId(id)
      const row = await db
        .prepare('SELECT owner, size, expires_at, data FROM blobs WHERE id = ?')
        .bind(id)
        .first<{ owner: string; size: number; expires_at: number | null; data: ArrayBuffer | number[] }>()
      if (!row) return null
      const body = row.data instanceof ArrayBuffer ? new Uint8Array(row.data) : Uint8Array.from(row.data)
      return { owner: row.owner, expiresAt: row.expires_at, size: row.size, body }
    },
    async delete(id) {
      checkId(id)
      await db.prepare('DELETE FROM blobs WHERE id = ?').bind(id).run()
    },
  }
}

/**
 * Blobs as objects of the environment's R2 bucket, streamed both ways: the request's own body goes to R2 and R2's
 * body comes back, with no JavaScript copying a chunk. R2 takes only a stream of known length, so an upload needs a
 * Content-Length; the runtime holds the body to it, and the size-cap guard has held it to the cap.
 */
function r2BlobStore(bucket: R2Bucket): BlobStore {
  return {
    async put(id, source, meta) {
      checkId(id)
      if (source.size === null) throw new ApiError('length-required')
      if (source.size > source.cap) throw new ApiError('too-large', { cap: source.cap })
      const customMetadata: Record<string, string> = { owner: meta.owner }
      if (meta.expiresAt !== null) customMetadata.expiresAt = String(meta.expiresAt)
      await bucket.put(id, source.body, { customMetadata })
    },
    async get(id) {
      checkId(id)
      const object = await bucket.get(id)
      if (!object) return null
      const expiresAt = object.customMetadata?.expiresAt
      return {
        owner: object.customMetadata?.owner ?? '',
        expiresAt: expiresAt === undefined ? null : Number(expiresAt),
        size: object.size,
        body: object.body,
      }
    },
    async delete(id) {
      checkId(id)
      await bucket.delete(id)
    },
  }
}

/** The store for an owner's plan. */
export function blobStoreFor(env: Env, plan: Plan): BlobStore {
  return plan === 'pro' ? r2BlobStore(env.BLOBS) : d1BlobStore(env.BLOBS_DB)
}
