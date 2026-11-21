import { reduceRequested, type ReductionRequest } from '../domain/convertColors'
import type { ReducedColors } from '../domain/imageColors'

/** Reduces a picture's colors without holding the page (ticket 1163): in a worker where the browser has one, else on the
 * spot (tests, old browsers). Only the latest request is answered: an older one still running is dropped. */
export interface ColorReducer {
  reduce(request: ReductionRequest, done: (reduced: ReducedColors) => void): void
  /** Drops the request running, if any, and its worker. */
  stop(): void
}

export function createColorReducer(): ColorReducer {
  let worker: Worker | undefined
  let current = 0
  let busy = false

  function stop(): void {
    current += 1
    busy = false
    worker?.terminate()
    worker = undefined
  }

  function reduce(request: ReductionRequest, done: (reduced: ReducedColors) => void): void {
    // A worker still on an older request is replaced rather than waited for: the old answer would never be shown.
    if (busy) stop()
    const id = ++current
    if (typeof Worker === 'undefined') return done(reduceRequested(request))
    try {
      worker ??= new Worker(new URL('../workers/reduceColors.worker.ts', import.meta.url), { type: 'module' })
      worker.onmessage = ({ data }: MessageEvent<{ id: number; reduced: ReducedColors }>) => {
        if (data.id !== current) return
        busy = false
        done(data.reduced)
      }
      worker.onerror = () => {
        stop()
        done(reduceRequested(request))
      }
      busy = true
      worker.postMessage({ id, request })
    } catch {
      stop()
      done(reduceRequested(request))
    }
  }

  return { reduce, stop }
}
