import type { RequestContext } from './api'
import { ApiError } from './errors'

/**
 * A request body on its way to a store: the stream itself, its declared length, and the cap the size-cap guard set.
 * Nothing is read until a store reads it, so an R2 upload passes straight through the Worker (spec 385: a Worker has
 * 128 MB, an upload may be 90).
 */
export interface Upload {
  body: ReadableStream<Uint8Array>
  /** The declared Content-Length; null when the body is sent in chunks without one. */
  size: number | null
  cap: number
}

/** The request's body as an `Upload`. A handler takes its body only through this or `readBody`. */
export function upload(rc: RequestContext): Upload {
  const declared = rc.request.headers.get('Content-Length')
  return {
    body: rc.request.body ?? new Response(new Uint8Array()).body!,
    size: declared === null ? null : Number(declared),
    cap: rc.bodyCap ?? Number.POSITIVE_INFINITY,
  }
}

/**
 * The whole body in memory, refused with `413 too-large` as soon as the streamed bytes pass the cap, whatever the
 * declared length said. Only for bodies capped small enough to hold (a D1 blob, a JSON request), never an R2 upload.
 */
export async function readBody(source: Upload): Promise<Uint8Array> {
  const chunks: Uint8Array[] = []
  let size = 0
  const reader = source.body.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > source.cap) {
      await reader.cancel()
      throw new ApiError('too-large', { cap: source.cap })
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}
