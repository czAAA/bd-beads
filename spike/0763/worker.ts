// Spike 0763: the model worker. onnxruntime-web on plain WebAssembly, one thread (ADR 0087), its runtime and the
// models fetched from the app's own static files, a split model joined here. The page measures; this reports the
// time of each step and the size of the WebAssembly heap, which only grows, so its last size is its peak.
import * as ort from 'onnxruntime-web/wasm'
import { SAM_MASK, SIDE, type FromWorker, type IsNetId, type Manifest, type ModelFile, type ModelId, type Part, type ToWorker } from './protocol'

const memories = new Set<WebAssembly.Memory>()
const NativeMemory = WebAssembly.Memory
WebAssembly.Memory = new Proxy(NativeMemory, {
  construct(target, args: [WebAssembly.MemoryDescriptor]) {
    const memory = Reflect.construct(target, args) as WebAssembly.Memory
    memories.add(memory)
    return memory
  },
})
const keepExportedMemory = (instance: WebAssembly.Instance) => {
  for (const value of Object.values(instance.exports)) if (value instanceof NativeMemory) memories.add(value)
}
const nativeInstantiate = WebAssembly.instantiate
WebAssembly.instantiate = (async (source: BufferSource | WebAssembly.Module, imports?: WebAssembly.Imports) => {
  const result = await nativeInstantiate(source as BufferSource, imports)
  keepExportedMemory(result instanceof WebAssembly.Instance ? result : result.instance)
  return result
}) as typeof WebAssembly.instantiate
const nativeStreaming = WebAssembly.instantiateStreaming
WebAssembly.instantiateStreaming = async (source, imports) => {
  const result = await nativeStreaming(source, imports)
  keepExportedMemory(result.instance)
  return result
}
const wasm = () => Math.max(0, ...[...memories].map((m) => m.buffer.byteLength))

ort.env.wasm.numThreads = 1
ort.env.wasm.proxy = false

const scope = self as unknown as { postMessage(message: FromWorker, transfer: Transferable[]): void }
const post = (message: FromWorker, transfer: Transferable[] = []) => scope.postMessage(message, transfer)
const sessions = new Map<ModelId, ort.InferenceSession>()
let runtimeReady = false
let embedding: { embeddings: ort.Tensor; positions: ort.Tensor } | undefined

async function fetchParts(base: string, id: ModelId | 'runtime', parts: Part[], total: number): Promise<Uint8Array> {
  const start = performance.now()
  const bytes = new Uint8Array(total)
  let at = 0
  for (const part of parts) {
    const response = await fetch(base + part.url, { cache: 'no-store' })
    if (!response.ok || !response.body) throw new Error(`${part.url}: HTTP ${response.status}`)
    const reader = response.body.getReader()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      bytes.set(value, at)
      at += value.length
      post({ kind: 'progress', id, done: at, total })
    }
  }
  if (at !== total) throw new Error(`${id}: got ${at} bytes of ${total}`)
  post({ kind: 'downloaded', id, bytes: total, ms: performance.now() - start })
  return bytes
}

async function load(base: string, manifest: Manifest, id: ModelId, lean: boolean) {
  if (!runtimeReady) {
    const { url, bytes } = manifest.runtime
    ort.env.wasm.wasmBinary = await fetchParts(base, 'runtime', [{ url, bytes }], bytes)
  }
  const model = manifest.models.find((m) => m.id === id) as ModelFile
  const bytes = await fetchParts(base, id, model.parts, model.bytes)
  const start = performance.now()
  sessions.set(id, await ort.InferenceSession.create(bytes, { executionProviders: ['wasm'], graphOptimizationLevel: 'all', enableCpuMemArena: !lean, enableMemPattern: !lean }))
  post({ kind: 'loaded', id, ms: performance.now() - start, firstSession: !runtimeReady, wasm: wasm() })
  runtimeReady = true
}

function session(id: ModelId) {
  const s = sessions.get(id)
  if (!s) throw new Error(`${id} is not loaded`)
  return s
}

// The picture as a planar float tensor: (value / 255 - mean) / std per channel, over the first w x h pixels only.
function planar(rgba: Uint8ClampedArray, mean: number[], std: number[], w = SIDE, h = SIDE) {
  const data = new Float32Array(3 * SIDE * SIDE)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * SIDE + x
      for (let c = 0; c < 3; c++) data[c * SIDE * SIDE + i] = (rgba[i * 4 + c] / 255 - mean[c]) / std[c]
    }
  }
  return new ort.Tensor('float32', data, [1, 3, SIDE, SIDE])
}

async function subject(id: IsNetId, rgba: Uint8ClampedArray) {
  const s = session(id)
  const pre = performance.now()
  const input = planar(rgba, [0.5, 0.5, 0.5], [1, 1, 1])
  const run = performance.now()
  const { mask } = await s.run({ input })
  const done = performance.now()
  const values = mask.data as Float32Array
  let lo = Infinity
  let hi = -Infinity
  for (const v of values) {
    if (v < lo) lo = v
    if (v > hi) hi = v
  }
  const scaled = new Float32Array(values.length)
  for (let i = 0; i < values.length; i++) scaled[i] = (values[i] - lo) / (hi - lo || 1)
  input.dispose()
  mask.dispose()
  post({ kind: 'subject', id, mask: scaled, preMs: run - pre, runMs: done - run, wasm: wasm() }, [scaled.buffer])
}

async function embed(rgba: Uint8ClampedArray, w: number, h: number) {
  const s = session('slimsam-encoder')
  const pre = performance.now()
  const pixel_values = planar(rgba, [0.485, 0.456, 0.406], [0.229, 0.224, 0.225], w, h)
  const run = performance.now()
  const out = await s.run({ pixel_values })
  const done = performance.now()
  pixel_values.dispose()
  embedding?.embeddings.dispose()
  embedding?.positions.dispose()
  embedding = { embeddings: out.image_embeddings, positions: out.image_positional_embeddings }
  post({ kind: 'embedded', preMs: run - pre, runMs: done - run, wasm: wasm() })
}

async function tap(x: number, y: number) {
  if (!embedding) throw new Error('no picture embedded yet')
  const s = session('slimsam-decoder')
  const start = performance.now()
  const out = await s.run({
    input_points: new ort.Tensor('float32', new Float32Array([x, y]), [1, 1, 1, 2]),
    input_labels: new ort.Tensor('int64', new BigInt64Array([1n]), [1, 1, 1]),
    image_embeddings: embedding.embeddings,
    image_positional_embeddings: embedding.positions,
  })
  const runMs = performance.now() - start
  const scores = out.iou_scores.data as Float32Array
  const best = scores.indexOf(Math.max(...scores))
  const area = SAM_MASK * SAM_MASK
  const logits = (out.pred_masks.data as Float32Array).slice(best * area, (best + 1) * area)
  out.iou_scores.dispose()
  out.pred_masks.dispose()
  post({ kind: 'tapped', logits, iou: scores[best], runMs, wasm: wasm() }, [logits.buffer])
}

async function handle(data: ToWorker) {
  try {
    if (data.kind === 'load') await load(data.base, data.manifest, data.id, data.lean)
    else if (data.kind === 'release') {
      await sessions.get(data.id)?.release()
      sessions.delete(data.id)
    } else if (data.kind === 'subject') await subject(data.id, data.rgba)
    else if (data.kind === 'embed') await embed(data.rgba, data.w, data.h)
    else await tap(data.x, data.y)
  } catch (e) {
    post({ kind: 'error', message: e instanceof Error ? e.message : String(e) })
  }
}

// One message at a time, in order: a release ends before the next load starts.
let queue = Promise.resolve()
onmessage = ({ data }: MessageEvent<ToWorker>) => {
  queue = queue.then(() => handle(data))
}
