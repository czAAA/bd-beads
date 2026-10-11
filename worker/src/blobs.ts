import type { Env } from './env'

/**
 * An owner's plan, which decides where their synced data lives (spec 385): Free accounts' and View links' blobs in
 * D1, which stops at its limit instead of billing; only Pro's go to R2. Moving Free data to R2 later is a change
 * here plus a copy job.
 */
export type Plan = 'free' | 'pro'

/**
 * The size caps (spec 385, "Upload size caps"). The D1 cap leaves room in D1's 2 MB row limit for the row's own
 * columns. Ticket 323 sets the final numbers and adds the app's own warning first.
 */
const D1_BLOB_CAP_BYTES = 2_000_000 - 1024
const R2_BLOB_CAP_BYTES = 100 * 1024 * 1024

/** The largest body a plan's storage takes: D1's row limit for Free, R2's for Pro. */
export function blobCapFor(plan: Plan): number {
  return plan === 'pro' ? R2_BLOB_CAP_BYTES : D1_BLOB_CAP_BYTES
}

/** Put, get and delete by id; the only way a feature stores a blob. */
export interface BlobStore {
  put(id: string, bytes: Uint8Array): Promise<void>
  /** `null` when there is no blob with that id. */
  get(id: string): Promise<Uint8Array | null>
  /** Deleting an id that isn't there is not an error. */
  delete(id: string): Promise<void>
}

const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/

function checkId(id: string): void {
  if (!SAFE_ID.test(id)) throw new Error(`Blob id must be 1-64 letters, digits, "-" or "_": ${id}`)
}

/** Blobs as BLOB rows of the `blobs` table. `onWrite` is told how many rows a call wrote (the D1 usage counter). */
function d1BlobStore(db: D1Database, onWrite: (rows: number) => void = () => {}): BlobStore {
  return {
    async put(id, bytes) {
      checkId(id)
      await db
        .prepare(
          'INSERT INTO blobs (id, data, size, created_at) VALUES (?1, ?2, ?3, ?4) ' +
            'ON CONFLICT (id) DO UPDATE SET data = excluded.data, size = excluded.size',
        )
        .bind(id, bytes, bytes.byteLength, Date.now())
        .run()
      onWrite(2) // the row and its primary-key index entry: D1 counts both as rows written
    },
    async get(id) {
      checkId(id)
      const row = await db.prepare('SELECT data FROM blobs WHERE id = ?').bind(id).first<{ data: number[] | ArrayBuffer }>()
      if (!row) return null
      return row.data instanceof ArrayBuffer ? new Uint8Array(row.data) : Uint8Array.from(row.data)
    },
    async delete(id) {
      checkId(id)
      await db.prepare('DELETE FROM blobs WHERE id = ?').bind(id).run()
      onWrite(2)
    },
  }
}

/** Blobs as objects of the environment's R2 bucket. */
function r2BlobStore(bucket: R2Bucket): BlobStore {
  return {
    async put(id, bytes) {
      checkId(id)
      await bucket.put(id, bytes)
    },
    async get(id) {
      checkId(id)
      const object = await bucket.get(id)
      return object ? new Uint8Array(await object.arrayBuffer()) : null
    },
    async delete(id) {
      checkId(id)
      await bucket.delete(id)
    },
  }
}

/** The store for an owner's plan. */
export function blobStoreFor(env: Env, plan: Plan, onWrite?: (rows: number) => void): BlobStore {
  return plan === 'pro' ? r2BlobStore(env.BLOBS) : d1BlobStore(env.DB, onWrite)
}
