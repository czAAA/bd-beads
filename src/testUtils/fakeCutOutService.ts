import type { CutOutOutcome, CutOutProgress, CutOutService } from '../domain/cutOutModel'
import type { PixelData } from '../domain/imageConversion'
import type { SubjectMask } from '../domain/subjectMask'

/** A run the fake cut-out service holds open until the test ends it. */
interface FakeRun {
  picture: PixelData
  progress: (progress: CutOutProgress) => void
  end: (outcome: CutOutOutcome) => void
}

/** A cut-out service a test drives by hand (ticket 0767): the bytes it says are still to download, every run it was
 * asked for, and ways to report progress and end the run in hand. No model, no worker (spec 0761, Testing). */
export function fakeCutOutService(options: { toDownload?: number } = {}) {
  let toDownload = options.toDownload ?? 0
  const runs: FakeRun[] = []
  let open: FakeRun | undefined
  let cancels = 0

  const service: CutOutService = {
    toDownload: () => Promise.resolve(toDownload),
    subject: (picture, progress) =>
      new Promise<CutOutOutcome>((resolve) => {
        const run: FakeRun = {
          picture,
          progress,
          end: (outcome) => {
            if (open === run) open = undefined
            resolve(outcome)
          },
        }
        runs.push(run)
        open = run
      }),
    cancel: () => {
      cancels += 1
      open?.end({ kind: 'cancelled' })
    },
  }

  return {
    service,
    /** Every picture a run was asked for, in order. */
    pictures: () => runs.map((run) => run.picture),
    /** How many times `cancel()` was called. */
    cancels: () => cancels,
    /** Whether a run is in hand. */
    running: () => open !== undefined,
    /** Reports progress on the run in hand. */
    progress: (progress: CutOutProgress) => open?.progress(progress),
    /** Ends the run in hand with the mask the test gives: the files are on the device from then on. */
    finish: (mask: SubjectMask) => {
      toDownload = 0
      open?.end({ kind: 'done', mask })
    },
    /** Ends the run in hand as failed. */
    fail: (reason = 'out of memory') => open?.end({ kind: 'failed', reason }),
  }
}

/** A cut-out service for a test that never chooses AI: every call fails the test. */
export const unusedCutOutService: CutOutService = {
  toDownload: () => Promise.reject(new Error('the cut-out service is not used here')),
  subject: () => Promise.reject(new Error('the cut-out service is not used here')),
  cancel: () => {},
}
