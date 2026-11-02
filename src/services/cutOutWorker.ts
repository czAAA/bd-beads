import * as ort from 'onnxruntime-web/wasm'
import { maskFromModel, subjectModelInput } from '../domain/cutOutModel'
import type { FromWorker, ModelFile, StaticFile, ToWorker } from './cutOutProtocol'

// The cut-out service's worker (ticket 0767, ADR 0087): onnxruntime-web on plain WebAssembly, one thread, its runtime
// and the model fetched from the app's own static files (or the device's copy in Cache Storage), a split model joined
// here. One message at a time; the service stops a run by ending the worker.

ort.env.wasm.numThreads = 1
ort.env.wasm.proxy = false

const scope = self as unknown as { postMessage(message: FromWorker, transfer?: Transferable[]): void }
const post = (message: FromWorker, transfer: Transferable[] = []) => scope.postMessage(message, transfer)

/** Each model's session once made, by its SHA-256, so a later model (the tap model, ticket 0769) sits beside it. */
const sessions = new Map<string, Promise<ort.InferenceSession>>()
let runtimeSet = false

/** The parts not on the device yet. */
async function missing(cache: Cache | undefined, files: StaticFile[]) {
  const parts = files.flatMap((file) => file.parts)
  if (!cache) return parts
  const found = await Promise.all(parts.map((part) => cache.match(part.url)))
  return parts.filter((_part, index) => !found[index])
}

/** Every file's bytes, joined from its parts: from the device's copy where it has one, from the network otherwise (each
 * part kept once it has all come), telling the bytes downloaded as they come. */
async function read(cache: Cache | undefined, files: StaticFile[]): Promise<Uint8Array[]> {
  const toFetch = new Set((await missing(cache, files)).map((part) => part.url))
  const total = files.flatMap((file) => file.parts).reduce((sum, part) => sum + (toFetch.has(part.url) ? part.bytes : 0), 0)
  let done = 0
  if (total > 0) post({ kind: 'downloading', done, total })
  const joined: Uint8Array[] = []
  for (const file of files) {
    const bytes = new Uint8Array(file.bytes)
    let at = 0
    for (const part of file.parts) {
      const start = at
      const kept = toFetch.has(part.url) ? undefined : await cache?.match(part.url)
      const response = kept ?? (await fetch(part.url))
      if (!response.ok || !response.body) throw new Error(`${part.url}: HTTP ${response.status}`)
      const reader = response.body.getReader()
      for (;;) {
        const { done: ended, value } = await reader.read()
        if (ended) break
        if (at + value.length > start + part.bytes) throw new Error(`${part.url}: longer than ${part.bytes} bytes`)
        bytes.set(value, at)
        at += value.length
        if (!kept) post({ kind: 'downloading', done: (done += value.length), total })
      }
      if (at - start !== part.bytes) throw new Error(`${part.url}: ${at - start} bytes of ${part.bytes}`)
      if (!kept) await cache?.put(part.url, new Response(bytes.slice(start, at)))
    }
    joined.push(bytes)
  }
  return joined
}

async function sha256(bytes: Uint8Array) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>))
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** The model's session, its files read (and the runtime's, the first time) and checked. A damaged copy is dropped from
 * the device, so the next try downloads it again. */
async function session(cache: Cache | undefined, runtime: StaticFile, model: ModelFile) {
  const known = sessions.get(model.sha256)
  if (known) return known
  const [modelBytes, runtimeBytes] = await read(cache, runtimeSet ? [model] : [model, runtime])
  if ((await sha256(modelBytes!)) !== model.sha256) {
    await Promise.all(model.parts.map((part) => cache?.delete(part.url)))
    throw new Error('the model files are damaged')
  }
  if (runtimeBytes) {
    ort.env.wasm.wasmBinary = runtimeBytes
    runtimeSet = true
  }
  post({ kind: 'thinking' })
  const made = ort.InferenceSession.create(modelBytes!, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' })
  sessions.set(model.sha256, made)
  return made
}

/** Drops what the device keeps that the app no longer names: an older model's or runtime's files. */
async function prune(cache: Cache | undefined, files: StaticFile[]) {
  if (!cache) return
  const named = new Set(files.flatMap((file) => file.parts.map((part) => part.url)))
  for (const request of await cache.keys()) if (!named.has(request.url)) await cache.delete(request)
}

async function subject({ cache: cacheName, runtime, model, picture }: Extract<ToWorker, { kind: 'subject' }>) {
  // A browser that refuses Cache Storage (a private window) still runs the model; it only keeps nothing.
  const cache = cacheName && typeof caches !== 'undefined' ? await caches.open(cacheName).catch(() => undefined) : undefined
  const running = await session(cache, runtime, model)
  await prune(cache, [runtime, model])
  post({ kind: 'thinking' })
  const input = new ort.Tensor('float32', subjectModelInput(picture, model.side), [1, 3, model.side, model.side])
  const output = await running.run({ input })
  input.dispose()
  const answer = Object.values(output)[0]!
  const mask = maskFromModel(answer.data as Float32Array, model.side, picture.width, picture.height)
  answer.dispose()
  post({ kind: 'subject', mask }, [mask.subject.buffer])
}

let queue = Promise.resolve()
onmessage = ({ data }: MessageEvent<ToWorker>) => {
  queue = queue.then(() =>
    subject(data).catch((error: unknown) => post({ kind: 'failed', reason: error instanceof Error ? error.message : String(error) })),
  )
}
