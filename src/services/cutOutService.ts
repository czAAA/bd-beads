import runtimeUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url'
import files from '../data/cutOutFiles.json'
import type { CutOutModelName, CutOutOutcome, CutOutProgress, CutOutService } from '../domain/cutOutModel'
import { refinedMask } from '../domain/cutOutTaps'
import type { PixelData } from '../domain/imageConversion'
import type { SubjectMask } from '../domain/subjectMask'
import type { FromWorker, ModelFile, StaticFile, TapEmbedding, ToWorker } from './cutOutProtocol'

/** The Cache Storage the model and runtime are kept in on the device. Not `bd-beads-…`: the offline shell drops every
 * cache of that name but its own when a new version takes over (pwa/serviceWorker.js). The files' names carry their
 * version, so a new model is a new name and the worker drops the old one. */
const CACHE = 'cut-out-models'

/** The app's model and runtime files, at their addresses on this page's origin (ADR 0087: no third-party request): the
 * subject's model, the tap model's two (ticket 0769), and every part address among them. */
function filesFor(): { runtime: StaticFile; model: ModelFile; encoder: ModelFile; decoder: ModelFile; named: string[] } {
  const at = (path: string) => new URL(path, document.baseURI).href
  const { model, taps, runtime } = files
  const modelFile = ({ bytes, sha256, side, parts }: typeof model): ModelFile => ({
    bytes,
    sha256,
    side,
    parts: parts.map((part) => ({ url: at(`${import.meta.env.BASE_URL}ai/${part.file}`), bytes: part.bytes })),
  })
  const all = {
    runtime: { bytes: runtime.bytes, parts: [{ url: at(runtimeUrl), bytes: runtime.bytes }] },
    model: modelFile(model),
    encoder: modelFile(taps.encoder),
    decoder: modelFile(taps.decoder),
  }
  return { ...all, named: Object.values(all).flatMap((file) => file.parts.map((part) => part.url)) }
}

/** What later taps on a picture reuse (ticket 0769): the tap model's reading of it and each tapped pixel's region. */
interface TapWork {
  embedding?: TapEmbedding
  regions: Map<string, SubjectMask>
}
const tapKey = ({ x, y }: { x: number; y: number }) => `${x},${y}`

const hasCacheStorage = () => typeof caches !== 'undefined'

/** The cut-out service on this browser (tickets 0767, 0769, ADR 0087): a Web Worker on plain WebAssembly, one thread,
 * made for each run and ended after it, so the model's memory goes with it and Cancel stops at once. The tap model's
 * reading of a picture and its tapped regions are kept here while the picture is, so a later tap only runs the decoder. */
function browserCutOutService(): CutOutService {
  let worker: Worker | undefined
  let finish: ((outcome: CutOutOutcome) => void) | undefined
  const tapWork = new WeakMap<PixelData, TapWork>()

  function end(outcome: CutOutOutcome) {
    worker?.terminate()
    worker = undefined
    const resolve = finish
    finish = undefined
    resolve?.(outcome)
  }

  /** One run in a fresh worker: its progress told, its answer turned into the outcome by `answered`. */
  function inWorker(message: ToWorker, onProgress: (progress: CutOutProgress) => void, answered: (data: FromWorker) => CutOutOutcome | undefined) {
    if (finish) end({ kind: 'cancelled' })
    return new Promise<CutOutOutcome>((resolve) => {
      finish = resolve
      const running = new Worker(new URL('./cutOutWorker.ts', import.meta.url), { type: 'module', name: 'cut-out' })
      worker = running
      running.onmessage = ({ data }: MessageEvent<FromWorker>) => {
        if (worker !== running) return
        const outcome = data.kind === 'failed' ? { kind: 'failed' as const, reason: data.reason } : answered(data)
        if (outcome) end(outcome)
        else if (data.kind === 'downloading' || data.kind === 'thinking') onProgress(data)
      }
      // A worker the browser closes (out of memory) or one that can't load says nothing more: it failed.
      running.onerror = (event) => {
        if (worker === running) end({ kind: 'failed', reason: event.message || 'the worker stopped' })
      }
      // The kept reading is copied, not moved: the service keeps its own for the next tap.
      running.postMessage(message)
    })
  }

  return {
    async toDownload(name: CutOutModelName) {
      const { runtime, model, encoder, decoder } = filesFor()
      const parts = [...runtime.parts, ...(name === 'subject' ? model.parts : [...encoder.parts, ...decoder.parts])]
      const all = parts.reduce((sum, part) => sum + part.bytes, 0)
      if (!hasCacheStorage()) return all
      try {
        const cache = await caches.open(CACHE)
        const kept = await Promise.all(parts.map((part) => cache.match(part.url)))
        return parts.reduce((sum, part, index) => sum + (kept[index] ? 0 : part.bytes), 0)
      } catch {
        // A browser that refuses Cache Storage (a private window) keeps nothing: all of it is to download.
        return all
      }
    },

    subject(picture: PixelData, onProgress: (progress: CutOutProgress) => void) {
      const { runtime, model, named } = filesFor()
      const message: ToWorker = { kind: 'subject', cache: hasCacheStorage() ? CACHE : undefined, runtime, model, named, picture }
      return inWorker(message, onProgress, (data) => (data.kind === 'subject' ? { kind: 'done', mask: data.mask } : undefined))
    },

    async refine(picture, automatic, taps, onProgress) {
      const work = tapWork.get(picture) ?? { regions: new Map<string, SubjectMask>() }
      tapWork.set(picture, work)
      const refined = (): CutOutOutcome => ({
        kind: 'done',
        mask: refinedMask(automatic, taps.map((tap) => ({ kind: tap.kind, region: work.regions.get(tapKey(tap))! }))),
      })
      const points = [...new Map(taps.filter((tap) => !work.regions.has(tapKey(tap))).map((tap) => [tapKey(tap), { x: tap.x, y: tap.y }])).values()]
      if (points.length === 0) return refined()
      const { runtime, encoder, decoder, named } = filesFor()
      const cache = hasCacheStorage() ? CACHE : undefined
      const message: ToWorker = { kind: 'taps', cache, runtime, encoder, decoder, named, picture, embedding: work.embedding, points }
      return inWorker(message, onProgress, (data) => {
        if (data.kind !== 'regions') return undefined
        work.embedding ??= data.embedding
        data.regions.forEach((region, index) => work.regions.set(tapKey(points[index]!), region))
        return refined()
      })
    },

    cancel() {
      if (finish) end({ kind: 'cancelled' })
    },
  }
}

export const browserCutOut = browserCutOutService()
