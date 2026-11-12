import { onBeforeUnmount, readonly, ref, watch, type Ref } from 'vue'

// What's inside's tour (Homepage card, tickets 0797, 0802): the rows in order, each done in the demo editor and lit while
// it plays, then a rest and the loop again. A row pressed plays from there on a fresh demo, the rows before it applied at
// once; one that can't be done is skipped. It plays only while seen, until the beader pauses it (0830).

/** The tour's timing, in ms (Homepage card): 1.2 times its first pace (ticket 0802).
 * @internal Its test steps the clock by it. */
export const TOUR_TIMING = {
  /** A row is lit this long before its hand moves… */
  before: 420,
  /** …and stays lit this long after. */
  after: 540,
  /** After the last row, before the loop starts again. */
  rest: 2160,
  /** After the section first shows, before the tour starts by itself. */
  start: 1080,
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

/** The tour: the row playing, whether it is paused, and its controls. */
export function useInsideTour<Row extends string, Hand>(deps: InsideTourDeps<Row, Hand>) {
  const timing = deps.timing ?? TOUR_TIMING
  /** The row lit in the list: the one playing, or under reduced motion the one shown. */
  const playing = ref<Row>()
  /** The row the caption shows: the one last lit, the first before any is (ticket 0825), so it stays still unlit. */
  const captioned = ref<Row>(deps.rows[0]!) as Ref<Row>
  /** The beader paused it (ticket 0830): stopped at its row, still lit, until Play or a row is pressed. */
  const paused = ref(false)
  let run: AbortController | undefined
  let startTimer: ReturnType<typeof setTimeout> | undefined
  let everShown = false
  /** The rows that failed once: each is warned of once, however often the loop comes back to it. */
  const warned = new Set<Row>()

  /** Lights a row, which the caption shows until another is lit. */
  function light(row: Row): void {
    playing.value = row
    captioned.value = row
  }

  function wait(ms: number, signal: AbortSignal): Promise<void> {
    if (signal.aborted) return Promise.reject(new Stopped())
    return new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, ms)
      signal.addEventListener('abort', () => (clearTimeout(timer), reject(new Stopped())), { once: true })
    })
  }

  function check(signal: AbortSignal): void {
    if (signal.aborted) throw new Stopped()
  }

  /** Does a row, played or applied at once. A step that can't be done (a control gone from this layout) skips the rest of
   * the row, so the tour goes on to the next instead of stopping on a fresh demo; a stop goes through. */
  async function attempt(row: Row, instant: boolean, signal: AbortSignal): Promise<void> {
    try {
      await deps.play(row, deps.hand(instant, signal))
    } catch (error) {
      if (error instanceof Stopped || deps.isStop(error) || signal.aborted) throw error
      if (!warned.has(row)) console.warn(error)
      warned.add(row)
    }
  }

  /** Applies rows at once, with no ghost. */
  async function apply(rows: readonly Row[], signal: AbortSignal): Promise<void> {
    for (const row of rows) {
      check(signal)
      await attempt(row, true, signal)
    }
  }

  async function playFrom(start: Row, signal: AbortSignal): Promise<void> {
    let index = deps.rows.indexOf(start)
    await deps.fresh()
    check(signal)
    if (deps.reducedMotion()) {
      await apply(deps.rows.slice(0, index + 1), signal)
      light(start)
      return
    }
    await apply(deps.rows.slice(0, index), signal)
    for (;;) {
      const row = deps.rows[index]
      light(row)
      await wait(timing.before, signal)
      await attempt(row, false, signal)
      await wait(timing.after, signal)
      index += 1
      if (index < deps.rows.length) continue
      playing.value = undefined
      deps.hideGhost()
      await wait(timing.rest, signal)
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

  /** Plays from a row, lit at once: a fresh demo, the rows before it applied at once. */
  function choose(row: Row): void {
    stop()
    paused.value = false
    light(row)
    const current = new AbortController()
    run = current
    void playFrom(row, current.signal).catch((error: unknown) => {
      if (error instanceof Stopped || deps.isStop(error)) return
      // The demo itself could not start afresh: the tour stops, the row lit and the editor left as it is.
      console.warn(error)
      if (run === current) stop()
    })
  }

  /** Pause (ticket 0830): the tour stops where it is, its row still lit and the editor as it is. */
  function pause(): void {
    stop()
    paused.value = true
  }

  /** Play (ticket 0830): on from the start of the row that was playing, as a row pressed plays. */
  function resume(): void {
    choose(captioned.value)
  }

  /** Plays only while `seen()`: the first time after a moment, again from the first row each time it comes back, unless
   * the beader paused it. */
  function follow(seen: () => boolean): void {
    watch(
      seen,
      (now) => {
        if (!now) {
          stop()
          if (!paused.value) playing.value = undefined
          return
        }
        if (paused.value) return
        const delay = everShown || deps.reducedMotion() ? 0 : timing.start
        everShown = true
        clearStart()
        startTimer = setTimeout(() => choose(deps.rows[0]), delay)
      },
      { immediate: true },
    )
  }

  onBeforeUnmount(stop)

  return { playing: readonly(playing), captioned: readonly(captioned), paused: readonly(paused), choose, pause, resume, follow }
}
