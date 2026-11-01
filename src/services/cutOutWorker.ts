import * as ort from 'onnxruntime-web/wasm'
import { maskFromModel, subjectModelInput } from '../domain/cutOutModel'
import { regionFromTapModel, TAP_MASK_SIDE, tapModelInput, tapModelPoint } from '../domain/cutOutTaps'
import type { PixelData } from '../domain/imageConversion'
import type { SubjectMask } from '../domain/subjectMask'
import type { FromWorker, ModelFile, StaticFile, TapEmbedding, ToWorker } from './cutOutProtocol'

// The cut-out service's worker (tickets 0767, 0769, ADR 0087): onnxruntime-web on plain WebAssembly, one thread, its
// runtime and models fetched from the app's own static files (or the device's copy in Cache Storage), a split model
// joined here. One message at a time; the service stops a run by ending the worker.

ort.env.wasm.numThreads = 1
ort.env.wasm.proxy = false

const scope = self as unknown as { postMessage(message: FromWorker, transfer?: Transferable[]): void }
const post = (message: FromWorker, transfer: Transferable[] = []) => scope.postMessage(message, transfer)

/** Each model's session once made, by its SHA-256, so the tap model's two sit beside each other (ticket 0769). */
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

/** The models' sessions, in order: the files of those not made yet read in one download (with the runtime's, the first
 * time) and checked. A damaged copy is dropped from the device, so the next try downloads it again. */
async function open(cache: Cache | undefined, runtime: StaticFile, models: ModelFile[]) {
  const unmade = models.filter((model) => !sessions.has(model.sha256))
  if (unmade.length > 0) {
    const bytes = await read(cache, runtimeSet ? unmade : [...unmade, runtime])
    for (const [index, model] of unmade.entries()) {
      if ((await sha256(bytes[index]!)) === model.sha256) continue
      await Promise.all(model.parts.map((part) => cache?.delete(part.url)))
      throw new Error('the model files are damaged')
    }
    if (!runtimeSet) {
      ort.env.wasm.wasmBinary = bytes.at(-1)!
      runtimeSet = true
    }
    post({ kind: 'thinking' })
    for (const [index, model] of unmade.entries()) {
      sessions.set(model.sha256, ort.InferenceSession.create(bytes[index]!, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' }))
    }
  }
  return Promise.all(models.map((model) => sessions.get(model.sha256)!))
}

/** Drops what the device keeps that the app no longer names: an older model's or runtime's files. */
async function prune(cache: Cache | undefined, named: string[]) {
  if (!cache) return
  const kept = new Set(named)
  for (const request of await cache.keys()) if (!kept.has(request.url)) await cache.delete(request)
}

/** The Cache Storage the files are kept in. A browser that refuses it (a private window) still runs the model; it only
 * keeps nothing. */
async function opened(cacheName: string | undefined) {
  return cacheName && typeof caches !== 'undefined' ? await caches.open(cacheName).catch(() => undefined) : undefined
}

async function subject({ cache: cacheName, runtime, model, named, picture }: Extract<ToWorker, { kind: 'subject' }>) {
  const cache = await opened(cacheName)
  const [running] = await open(cache, runtime, [model])
  await prune(cache, named)
  post({ kind: 'thinking' })
  const input = new ort.Tensor('float32', subjectModelInput(picture, model.side), [1, 3, model.side, model.side])
  const output = await running!.run({ input })
  input.dispose()
  const answer = Object.values(output)[0]!
  const mask = maskFromModel(answer.data as Float32Array, model.side, picture.width, picture.height)
  answer.dispose()
  post({ kind: 'subject', mask }, [mask.subject.buffer])
}

/** The shape of each of SlimSAM's encoder outputs: 256 channels over a 64 × 64 grid of the read square. */
const EMBEDDING_SHAPE = [1, 256, 64, 64]

/** SlimSAM's reading of the picture: its encoder's two outputs, owned here so they can go to the service. */
async function embed(encoder: ort.InferenceSession, picture: PixelData, side: number): Promise<TapEmbedding> {
  const input = new ort.Tensor('float32', tapModelInput(picture, side), [1, 3, side, side])
  const output = await encoder.run({ pixel_values: input })
  input.dispose()
  const embedding = {
    embeddings: (output.image_embeddings!.data as Float32Array).slice(),
    positions: (output.image_positional_embeddings!.data as Float32Array).slice(),
  }
  for (const tensor of Object.values(output)) tensor.dispose()
  return embedding
}

/** Each tapped point's region (ticket 0769): the picture read by the encoder unless the service kept its reading, then
 * the decoder once a point, its likeliest of three answers kept. */
async function taps({ cache: cacheName, runtime, encoder, decoder, named, picture, embedding, points }: Extract<ToWorker, { kind: 'taps' }>) {
  const cache = await opened(cacheName)
  const [decoding, encoding] = await open(cache, runtime, embedding ? [decoder] : [decoder, encoder])
  await prune(cache, named)
  post({ kind: 'thinking' })
  const read = embedding ?? (await embed(encoding!, picture, encoder.side))
  const image_embeddings = new ort.Tensor('float32', read.embeddings, EMBEDDING_SHAPE)
  const image_positional_embeddings = new ort.Tensor('float32', read.positions, EMBEDDING_SHAPE)
  const area = TAP_MASK_SIDE * TAP_MASK_SIDE
  const regions: SubjectMask[] = []
  for (const point of points) {
    const input_points = new ort.Tensor('float32', Float32Array.from(tapModelPoint(point, picture.width, picture.height, decoder.side)), [1, 1, 1, 2])
    const input_labels = new ort.Tensor('int64', new BigInt64Array([1n]), [1, 1, 1])
    const output = await decoding!.run({ input_points, input_labels, image_embeddings, image_positional_embeddings })
    const likelihoods = Array.from(output.iou_scores!.data as Float32Array)
    const best = likelihoods.indexOf(Math.max(...likelihoods))
    const scores = (output.pred_masks!.data as Float32Array).subarray(best * area, (best + 1) * area)
    regions.push(regionFromTapModel(scores, picture.width, picture.height))
    for (const tensor of [input_points, input_labels, ...Object.values(output)]) tensor.dispose()
  }
  const made = embedding ? undefined : read
  const transfer = [...regions.map((region) => region.subject.buffer), ...(made ? [made.embeddings.buffer, made.positions.buffer] : [])]
  post({ kind: 'regions', regions, embedding: made }, transfer)
}

let queue = Promise.resolve()
onmessage = ({ data }: MessageEvent<ToWorker>) => {
  queue = queue.then(() =>
    (data.kind === 'subject' ? subject(data) : taps(data)).catch((error: unknown) => post({ kind: 'failed', reason: error instanceof Error ? error.message : String(error) })),
  )
}
