import { computed, onScopeDispose, shallowRef, watch, type Ref } from 'vue'
import type { CutOutProgress, CutOutService } from '../../domain/cutOutModel'
import type { PixelData } from '../../domain/imageConversion'
import type { SubjectMask } from '../../domain/subjectMask'

/** Cut out's three choices (ConvertImage card, 1 Picture): nothing taken away; Simple, the color round the picture's
 * edges taken away as far as its Tolerance reaches (ticket 0765); or the AI chip, a model on the device finding the
 * subject (ticket 0767). */
export type CutOut = 'off' | 'simple' | 'ai'

/** Where the AI choice is (ConvertImage card, the download note; Loading card, AI variant): nothing to show; looking
 * whether the model is on the device; asking before its first download, of `bytes`; downloading; the model at work,
 * `longer` past the "taking longer" threshold; or the last run failed. */
export type AiCutOutStatus =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'asking'; bytes: number }
  | { kind: 'downloading'; done: number; total: number }
  | { kind: 'thinking'; longer: boolean }
  | { kind: 'failed' }

/** How long the model may think before the Loading says the device is taking longer (ADR 0087, measured by spike 0763). */
const TAKING_LONGER_MS = 10_000

/** Cut out's choice and the AI choice's run through the cut-out service (ticket 0767, spec 0761): asked before a first
 * download, stopped by Cancel (back to the choice before) or another choice, its result kept while the picture is, so
 * flipping back is instant. Run in the wizard's scope: leaving stops a run in hand. */
export function useAiCutOut({ service, image }: { service: CutOutService; image: Ref<PixelData | undefined> }) {
  const choice = shallowRef<CutOut>('off')
  const status = shallowRef<AiCutOutStatus>({ kind: 'idle' })
  const result = shallowRef<{ picture: PixelData; mask: SubjectMask }>()
  /** The choice before AI, for Cancel and a failed run to go back to. */
  let before: CutOut = 'off'
  /** Bumped by every start and stop, so a stopped run's late answer changes nothing. */
  let run = 0
  /** Download pressed once on this page: a turn or a new picture doesn't ask again. */
  let downloadAllowed = false
  let longerTimer: ReturnType<typeof setTimeout> | undefined

  /** The AI choice's mask for the picture as it is; none until worked out. */
  const mask = computed(() => (result.value && result.value.picture === image.value ? result.value.mask : undefined))
  const working = () => status.value.kind === 'checking' || status.value.kind === 'downloading' || status.value.kind === 'thinking'

  function show(next: AiCutOutStatus) {
    clearTimeout(longerTimer)
    status.value = next
    if (next.kind === 'thinking' && !next.longer) {
      longerTimer = setTimeout(() => (status.value = { kind: 'thinking', longer: true }), TAKING_LONGER_MS)
    }
  }

  function showProgress(token: number, progress: CutOutProgress) {
    if (token !== run) return
    if (progress.kind === 'downloading') show({ ...progress })
    else if (status.value.kind !== 'thinking') show({ kind: 'thinking', longer: false })
  }

  async function go(picture: PixelData, token: number) {
    show({ kind: 'thinking', longer: false })
    const outcome = await service.subject(picture, (progress) => showProgress(token, progress))
    if (token !== run) return
    if (outcome.kind === 'done') {
      result.value = { picture, mask: outcome.mask }
      show({ kind: 'idle' })
      return
    }
    if (outcome.kind === 'failed') console.warn(`Cut out with AI failed: ${outcome.reason}`)
    choice.value = before
    show(outcome.kind === 'failed' ? { kind: 'failed' } : { kind: 'idle' })
  }

  async function start(picture: PixelData) {
    const token = ++run
    show({ kind: 'checking' })
    const bytes = downloadAllowed ? 0 : await service.toDownload()
    if (token !== run) return
    if (bytes > 0) show({ kind: 'asking', bytes })
    else await go(picture, token)
  }

  /** Stops whatever is in hand; the choice stays as it is. */
  function stop() {
    run += 1
    if (working()) service.cancel()
    show({ kind: 'idle' })
  }

  watch(
    [choice, image],
    ([chosen, picture]) => {
      if (chosen !== 'ai' || !picture || mask.value) return
      if (working()) stop()
      if (status.value.kind !== 'asking') void start(picture)
    },
    { flush: 'sync' },
  )
  onScopeDispose(stop)

  return {
    choice,
    /** A choice from the Cut out chips: another choice stops the model at work, as Cancel does, and stays chosen. */
    choose(next: CutOut) {
      if (next === choice.value) return
      if (choice.value === 'ai') stop()
      else if (status.value.kind === 'failed') show({ kind: 'idle' })
      if (next === 'ai') before = choice.value
      choice.value = next
    },
    status,
    mask,
    /** Download on the note: the run starts, its download first. */
    download() {
      const picture = image.value
      if (status.value.kind !== 'asking' || !picture) return
      downloadAllowed = true
      void go(picture, ++run)
    },
    /** Cancel on the note or the Loading: stops the download or run at once and takes the choice back to the one before. */
    cancel() {
      if (choice.value !== 'ai') return
      stop()
      choice.value = before
    },
  }
}
