import runtimeUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url'
import files from '../data/cutOutFiles.json'
import type { CutOutOutcome, CutOutProgress, CutOutService } from '../domain/cutOutModel'
import type { PixelData } from '../domain/imageConversion'
import type { FromWorker, ModelFile, StaticFile, ToWorker } from './cutOutProtocol'

/** The Cache Storage the model and runtime are kept in on the device. Not `bd-beads-…`: the offline shell drops every
 * cache of that name but its own when a new version takes over (pwa/serviceWorker.js). The files' names carry their
 * version, so a new model is a new name and the worker drops the old one. */
const CACHE = 'cut-out-models'

/** The files subject() needs, at their addresses on this page's origin (ADR 0087: no third-party request). */
function filesFor(): { runtime: StaticFile; model: ModelFile } {
  const at = (path: string) => new URL(path, document.baseURI).href
  const { model, runtime } = files
  return {
    runtime: { bytes: runtime.bytes, parts: [{ url: at(runtimeUrl), bytes: runtime.bytes }] },
    model: {
      bytes: model.bytes,
      sha256: model.sha256,
      side: model.side,
      parts: model.parts.map((part) => ({ url: at(`${import.meta.env.BASE_URL}ai/${part.file}`), bytes: part.bytes })),
    },
  }
}

const hasCacheStorage = () => typeof caches !== 'undefined'

/** The cut-out service on this browser (ticket 0767, spec 0761, ADR 0087): a Web Worker running onnxruntime-web on
 * plain WebAssembly with one thread, made for each run and ended after it, so the model's memory goes with it and
 * Cancel stops a download or a run at once. */
function browserCutOutService(): CutOutService {
  let worker: Worker | undefined
  let finish: ((outcome: CutOutOutcome) => void) | undefined

  function end(outcome: CutOutOutcome) {
    worker?.terminate()
    worker = undefined
    const resolve = finish
    finish = undefined
    resolve?.(outcome)
  }

  return {
    async toDownload() {
      const { runtime, model } = filesFor()
      const parts = [...runtime.parts, ...model.parts]
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
      if (finish) end({ kind: 'cancelled' })
      return new Promise<CutOutOutcome>((resolve) => {
        finish = resolve
        const running = new Worker(new URL('./cutOutWorker.ts', import.meta.url), { type: 'module', name: 'cut-out' })
        worker = running
        running.onmessage = ({ data }: MessageEvent<FromWorker>) => {
          if (worker !== running) return
          if (data.kind === 'subject') end({ kind: 'done', mask: data.mask })
          else if (data.kind === 'failed') end({ kind: 'failed', reason: data.reason })
          else onProgress(data)
        }
        // A worker the browser closes (out of memory) or one that can't load says nothing more: it failed.
        running.onerror = (event) => {
          if (worker === running) end({ kind: 'failed', reason: event.message || 'the worker stopped' })
        }
        const message: ToWorker = { kind: 'subject', cache: hasCacheStorage() ? CACHE : undefined, ...filesFor(), picture }
        running.postMessage(message)
      })
    },

    cancel() {
      if (finish) end({ kind: 'cancelled' })
    },
  }
}

export const browserCutOut = browserCutOutService()
