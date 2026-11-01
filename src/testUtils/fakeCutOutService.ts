import type { CutOutModelName, CutOutOutcome, CutOutProgress, CutOutService, CutOutTap } from '../domain/cutOutModel'
import type { PixelData } from '../domain/imageConversion'
import type { SubjectMask } from '../domain/subjectMask'

/** A run the fake cut-out service holds open until the test ends it: finding the subject, or refining it with taps. */
interface FakeRun {
  model: CutOutModelName
  picture: PixelData
  automatic?: SubjectMask
  taps?: readonly CutOutTap[]
  progress: (progress: CutOutProgress) => void
  end: (outcome: CutOutOutcome) => void
}

/** A cut-out service a test drives by hand (tickets 0767, 0769): the bytes it says each model still has to download,
 * every run it was asked for, and ways to report progress and end the run in hand. No model, no worker (spec 0761,
 * Testing). */
export function fakeCutOutService(options: { toDownload?: number; tapsToDownload?: number } = {}) {
  const toDownload: Record<CutOutModelName, number> = { subject: options.toDownload ?? 0, taps: options.tapsToDownload ?? 0 }
  const runs: FakeRun[] = []
  let open: FakeRun | undefined
  let cancels = 0

  const begin = (run: Omit<FakeRun, 'end'>) =>
    new Promise<CutOutOutcome>((resolve) => {
      const started: FakeRun = {
        ...run,
        end: (outcome) => {
          if (open === started) open = undefined
          resolve(outcome)
        },
      }
      runs.push(started)
      open = started
    })

  const service: CutOutService = {
    toDownload: (model) => Promise.resolve(toDownload[model]),
    subject: (picture, progress) => begin({ model: 'subject', picture, progress }),
    refine: (picture, automatic, taps, progress) => begin({ model: 'taps', picture, automatic, taps: [...taps], progress }),
    cancel: () => {
      cancels += 1
      open?.end({ kind: 'cancelled' })
    },
  }

  return {
    service,
    /** Every picture a subject run was asked for, in order. */
    pictures: () => runs.filter((run) => run.model === 'subject').map((run) => run.picture),
    /** Every refine asked for, in order: the picture, the automatic mask and the taps passed through. */
    refines: () => runs.filter((run) => run.model === 'taps').map(({ picture, automatic, taps }) => ({ picture, automatic, taps })),
    /** How many times `cancel()` was called. */
    cancels: () => cancels,
    /** Whether a run is in hand. */
    running: () => open !== undefined,
    /** Reports progress on the run in hand. */
    progress: (progress: CutOutProgress) => open?.progress(progress),
    /** Ends the run in hand with the mask the test gives: its model's files are on the device from then on. */
    finish: (mask: SubjectMask) => {
      if (open) toDownload[open.model] = 0
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
  refine: () => Promise.reject(new Error('the cut-out service is not used here')),
  cancel: () => {},
}
