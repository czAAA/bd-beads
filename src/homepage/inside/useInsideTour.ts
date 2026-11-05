import { onBeforeUnmount, readonly, ref, watch } from 'vue'

// What's inside's tour (Homepage card, ticket 0797): the rows in order, each shown by doing it in the demo editor, its
// row lit while it plays, then a rest and the loop again on a fresh demo. A row pressed plays from there, the rows
// before it applied at once. It plays only while the section is seen; a press in the editor takes it over for the visit.

/** The tour's timing, in ms (Homepage card). */
export const TOUR_TIMING = {
  /** A row is lit this long before its hand moves… */
  before: 350,
  /** …and stays lit this long after. */
  after: 450,
  /** After the last row, before the loop starts again. */
  rest: 1800,
  /** After the section first shows, before the tour starts by itself. */
  start: 900,
}

/** A run of the tour stopping, which every step of it hears. */
class Stopped extends Error {}

export interface InsideTourDeps<Row extends string, Hand> {
  /** The rows in the order they play. */
  rows: readonly Row[]
  /** Starts the demo afresh: an empty Canvas, nothing done. */
  fresh: () => Promise<void>
  /** A hand for a run, playing (with the ghost and its waits) or applying at once. */
  hand: (instant: boolean, signal: AbortSignal) => Hand
  /** Does a row with a hand. */
  play: (row: Row, hand: Hand) => Promise<void>
  /** Hides the ghost: the rest between loops, or a stop. */
  hideGhost: () => void
  /** Reduced motion: no ghost and no loop, each row's end shown at once. */
  reducedMotion: () => boolean
  /** Whether a failure is only the run being stopped. */
  isStop: (error: unknown) => boolean
  timing?: typeof TOUR_TIMING
}

/** The tour: the row playing, whether the beader took it over, and its controls. */
export function useInsideTour<Row extends string, Hand>(deps: InsideTourDeps<Row, Hand>) {
  const timing = deps.timing ?? TOUR_TIMING
  /** The row lit in the list: the one playing, or under reduced motion the one shown. */
  const playing = ref<Row>()
  /** The beader took the editor over: the tour stays stopped until a row is pressed. */
  const takenOver = ref(false)
  let run: AbortController | undefined
  let startTimer: ReturnType<typeof setTimeout> | undefined
  let everShown = false

  function pause(ms: number, signal: AbortSignal): Promise<void> {
    if (signal.aborted) return Promise.reject(new Stopped())
    return new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, ms)
      signal.addEventListener('abort', () => (clearTimeout(timer), reject(new Stopped())), { once: true })
    })
  }

  function check(signal: AbortSignal): void {
    if (signal.aborted) throw new Stopped()
  }

  /** Applies rows at once, with no ghost. */
  async function apply(rows: readonly Row[], signal: AbortSignal): Promise<void> {
    for (const row of rows) {
      check(signal)
      await deps.play(row, deps.hand(true, signal))
    }
  }

  async function playFrom(start: Row, signal: AbortSignal): Promise<void> {
    let index = deps.rows.indexOf(start)
    await deps.fresh()
    check(signal)
    if (deps.reducedMotion()) {
      await apply(deps.rows.slice(0, index + 1), signal)
      playing.value = start
      return
    }
    await apply(deps.rows.slice(0, index), signal)
    for (;;) {
      const row = deps.rows[index]
      playing.value = row
      await pause(timing.before, signal)
      await deps.play(row, deps.hand(false, signal))
      await pause(timing.after, signal)
      index += 1
      if (index < deps.rows.length) continue
      playing.value = undefined
      deps.hideGhost()
      await pause(timing.rest, signal)
      await deps.fresh()
      check(signal)
      index = 0
    }
  }

  function clearStart(): void {
    if (startTimer !== undefined) clearTimeout(startTimer)
    startTimer = undefined
  }

  /** Stops whatever is playing; the editor stays as it is. */
  function stop(): void {
    clearStart()
    run?.abort()
    run = undefined
    deps.hideGhost()
  }

  /** Plays from a row: a fresh demo, the rows before it applied at once. */
  function choose(row: Row): void {
    stop()
    takenOver.value = false
    const current = new AbortController()
    run = current
    void playFrom(row, current.signal).catch((error: unknown) => {
      if (error instanceof Stopped || deps.isStop(error)) return
      // A step that could not be done stops the tour and leaves the editor to the beader.
      console.warn(error)
      if (run === current) stop()
    })
  }

  /** The beader pressed, dragged or typed in the editor: it is theirs for the visit, the list unlit. */
  function takeOver(): void {
    if (takenOver.value) return
    stop()
    takenOver.value = true
    playing.value = undefined
  }

  /** Plays only while `seen()`: the first time after a moment, again from the first row each time it comes back. */
  function follow(seen: () => boolean): void {
    watch(
      seen,
      (now) => {
        if (!now) {
          stop()
          if (!takenOver.value) playing.value = undefined
          return
        }
        if (takenOver.value) return
        const delay = everShown || deps.reducedMotion() ? 0 : timing.start
        everShown = true
        clearStart()
        startTimer = setTimeout(() => choose(deps.rows[0]), delay)
      },
      { immediate: true },
    )
  }

  onBeforeUnmount(stop)

  return { playing: readonly(playing), takenOver: readonly(takenOver), choose, takeOver, follow, stop }
}
