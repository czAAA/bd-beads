import { computed, onScopeDispose, shallowRef, watch, type Ref } from 'vue'
import { LOW_MEMORY_GB, type CutOutDevice, type CutOutModelName, type CutOutProgress, type CutOutService, type CutOutTap } from '../../domain/cutOutModel'
import type { PixelData } from '../../domain/imageConversion'
import type { SubjectMask } from '../../domain/subjectMask'

/** Cut out's three choices (ConvertImage card, 1 Picture): nothing taken away; Simple, the color round the picture's
 * edges taken away as far as its Tolerance reaches (ticket 0765); or the AI chip, a model on the device finding the
 * subject (ticket 0767). */
export type CutOut = 'off' | 'simple' | 'ai'

/** Where the AI choice is (ConvertImage card; Loading card, AI variant): nothing to show; looking for the model; asking
 * before a first download of `bytes` with what the checks warn of, or with none, once more after a stopped run (0768);
 * downloading; the model at work, `longer` past the "taking longer" threshold; or the last run failed. */
export type AiCutOutStatus =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'asking'; bytes: number; lowMemory: boolean; lowSpace: boolean }
  | { kind: 'downloading'; done: number; total: number }
  | { kind: 'thinking'; longer: boolean }
  | { kind: 'failed' }

/** How long the model may think before the Loading says the device is taking longer (ADR 0087, measured by spike 0763). */
const TAKING_LONGER_MS = 10_000

/** What tap add or tap remove does to a tap on the preview (ticket 0769). */
export type CutOutTapMode = CutOutTap['kind']

/** The AI choice's result for one picture: the automatic mask, the taps on it and the mask they make. */
interface AiResult {
  picture: PixelData
  automatic: SubjectMask
  taps: readonly CutOutTap[]
  mask: SubjectMask
}

/** Cut out's choice and the AI choice's run through the cut-out service (ticket 0767, spec 0761): asked before a first
 * download, stopped by Cancel or another choice, its result kept while the picture is; its taps (0769) and Reset; and
 * the device record (0768, ADR 0087), warning of a stopped run, never blocking. Leaving stops a run in hand. */
export function useAiCutOut({ service, device, image }: { service: CutOutService; device: CutOutDevice; image: Ref<PixelData | undefined> }) {
  const choice = shallowRef<CutOut>('off')
  const status = shallowRef<AiCutOutStatus>({ kind: 'idle' })
  /** A flag still set as the converter opens: the tab was closed mid-run, most likely by Safari for lack of memory. */
  const opened = device.read()
  if (opened.running) device.write({ ...opened, running: false, stopped: true })
  const stopped = shallowRef(opened.running || opened.stopped)
  const result = shallowRef<AiResult>()
  const tapMode = shallowRef<CutOutTapMode>()
  /** The choice before AI, for Cancel and a failed run to go back to. */
  let before: CutOut = 'off'
  /** Bumped by every start and stop, so a stopped run's late answer changes nothing. */
  let run = 0
  /** Download (or Try again) pressed once on this page: a turn or a new picture doesn't ask again. */
  let downloadAllowed = false
  /** The same for the tap model's download. */
  let tapsDownloadAllowed = false
  /** The taps a tap in hand works out (all of them, the new one last), while it asks, downloads or runs. */
  let tapping: readonly CutOutTap[] | undefined
  let longerTimer: ReturnType<typeof setTimeout> | undefined
  /** When the model began to think, for the first run's time; none while it doesn't. */
  let thinkingSince: number | undefined
  /** The flag as this page last wrote it, so a download's many progress reports don't each touch storage. */
  let flagged = false

  /** The AI choice's result for the picture as it is; none until worked out. */
  const found = computed(() => (result.value && result.value.picture === image.value ? result.value : undefined))
  /** The AI choice's mask for the picture as it is, with its taps; none until worked out. */
  const mask = computed(() => found.value?.mask)
  const working = () => status.value.kind === 'checking' || status.value.kind === 'downloading' || status.value.kind === 'thinking'

  /** The run-in-progress flag follows the model at work: set as it begins to think, cleared as it stops; a download
   * alone never sets it, so a tab closed then isn't taken for lack of memory. */
  function flag(running: boolean) {
    if (running === flagged) return
    flagged = running
    device.write({ ...device.read(), running })
  }

  /** One clock for the model at work: "taking longer" past the threshold, and the time a run that finishes took. */
  function show(next: AiCutOutStatus) {
    clearTimeout(longerTimer)
    status.value = next
    const thinking = next.kind === 'thinking'
    if (thinking && !next.longer) {
      thinkingSince = Date.now()
      longerTimer = setTimeout(() => (status.value = { kind: 'thinking', longer: true }), TAKING_LONGER_MS)
    }
    if (!thinking) thinkingSince = undefined
    flag(thinking)
  }

  /** A run that finished: the warning of a stopped one goes, and the first one's time is kept. */
  function finished() {
    const record = device.read()
    const firstRunMs = record.firstRunMs ?? (thinkingSince === undefined ? undefined : Date.now() - thinkingSince)
    device.write({ ...record, stopped: false, ...(firstRunMs === undefined ? {} : { firstRunMs }) })
    stopped.value = false
  }

  /** The question before a first download, with the device's cheap checks (spec 0761): memory under 4 GB where the
   * browser reports it, and less free space than the download. They warn only. */
  async function ask(bytes: number) {
    const memory = device.memoryGb()
    const free = await device.freeBytes()
    return { kind: 'asking' as const, bytes, lowMemory: memory !== undefined && memory < LOW_MEMORY_GB, lowSpace: free !== undefined && free < bytes }
  }

  /** What to ask before a run of `model`: its download, or after a stopped run, once more; nothing when it may go. */
  async function question(model: CutOutModelName, allowed: boolean): Promise<AiCutOutStatus | undefined> {
    if (allowed) return undefined
    const bytes = await service.toDownload(model)
    if (bytes > 0) return ask(bytes)
    return model === 'subject' && stopped.value ? { kind: 'asking', bytes: 0, lowMemory: false, lowSpace: false } : undefined
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
      finished()
      result.value = { picture, automatic: outcome.mask, taps: [], mask: outcome.mask }
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
    const asking = await question('subject', downloadAllowed)
    if (token !== run) return
    if (asking) show(asking)
    else await go(picture, token)
  }

  /** Works out the tap in hand (the last of `taps`) on the found result; a tap that ends any other way is dropped. */
  async function refine(at: AiResult, taps: readonly CutOutTap[], token: number) {
    show({ kind: 'thinking', longer: false })
    const outcome = await service.refine(at.picture, at.automatic, taps, (progress) => showProgress(token, progress))
    if (token !== run) return
    tapping = undefined
    if (outcome.kind === 'done') {
      finished()
      result.value = { ...at, taps, mask: outcome.mask }
      show({ kind: 'idle' })
      return
    }
    if (outcome.kind === 'failed') console.warn(`Cut out with AI failed: ${outcome.reason}`)
    tapMode.value = undefined
    show(outcome.kind === 'failed' ? { kind: 'failed' } : { kind: 'idle' })
  }

  async function startTap(at: AiResult, taps: readonly CutOutTap[]) {
    const token = ++run
    tapping = taps
    show({ kind: 'checking' })
    const asking = await question('taps', tapsDownloadAllowed)
    if (token !== run) return
    if (asking) show(asking)
    else await refine(at, taps, token)
  }

  /** Stops whatever is in hand, a tap's question or run too; the choice stays as it is. */
  function stop() {
    run += 1
    tapping = undefined
    if (working()) service.cancel()
    show({ kind: 'idle' })
  }

  watch(
    [choice, image],
    ([chosen, picture]) => {
      if (chosen !== 'ai' || !picture || mask.value) return
      if (working() || tapping) stop()
      if (status.value.kind !== 'asking') void start(picture)
    },
    { flush: 'sync' },
  )
  // A new picture (or a turn or flip) has a subject of its own to tap.
  watch(image, () => (tapMode.value = undefined), { flush: 'sync' })
  onScopeDispose(stop)

  return {
    choice,
    /** A choice from the Cut out chips: another choice stops the model at work, as Cancel does, and stays chosen. */
    choose(next: CutOut) {
      if (next === choice.value) return
      if (choice.value === 'ai') {
        stop()
        tapMode.value = undefined
      }
      else if (status.value.kind === 'failed') show({ kind: 'idle' })
      if (next === 'ai') before = choice.value
      choice.value = next
    },
    status,
    /** The last run stopped with the tab (ticket 0768): the AI chip's warning dot, until a run finishes. */
    stopped,
    mask,
    /** Download (or Try again, after a stopped run) on the note: the run starts, its download first. */
    download() {
      const picture = image.value
      if (status.value.kind !== 'asking' || !picture) return
      if (tapping && found.value) {
        tapsDownloadAllowed = true
        void refine(found.value, tapping, ++run)
        return
      }
      downloadAllowed = true
      void go(picture, ++run)
    },
    /** Cancel on the note or the Loading: stops the download or run at once and takes the choice back to the one before;
     * for a tap, the tap is dropped and its chip turned off, the AI choice and its mask staying. */
    cancel() {
      if (choice.value !== 'ai') return
      if (tapping) {
        stop()
        tapsDownloadAllowed = false
        tapMode.value = undefined
        return
      }
      stop()
      // A cancelled download asks again next time, with what is left to download.
      downloadAllowed = false
      choice.value = before
    },
    /** Whether the tap chips show: the AI choice with its subject found. */
    tapsShown: computed(() => choice.value === 'ai' && !!found.value),
    tapMode,
    /** Tap add or tap remove pressed: at most one is on, and pressing the one on turns it off (ConvertImage card). */
    toggleTap(kind: CutOutTapMode) {
      tapMode.value = tapMode.value === kind ? undefined : kind
    },
    /** The taps on the picture's subject so far. */
    taps: computed<readonly CutOutTap[]>(() => found.value?.taps ?? []),
    /** A tap on the preview at a picture pixel: with tap add or remove on, the region under it is joined or taken away.
     * One tap at a time: a tap while a model works or the note asks is let go. */
    tap(at: { x: number; y: number }) {
      const kind = tapMode.value
      const subject = found.value
      if (choice.value !== 'ai' || !kind || !subject || working() || status.value.kind === 'asking') return
      void startTap(subject, [...subject.taps, { x: at.x, y: at.y, kind }])
    },
    /** Reset: every tap dropped, back to the automatic mask; a tap in hand stops. */
    resetTaps() {
      const subject = found.value
      if (!subject) return
      if (tapping || status.value.kind === 'failed') stop()
      result.value = { ...subject, taps: [], mask: subject.automatic }
    },
  }
}
