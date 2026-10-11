/** Wait before a held step button starts repeating, in ms (ticket 355). */
export const HOLD_DELAY_MS = 400
/** The gap between the first repeats, and the fastest it gets as the hold goes on, in ms. */
export const HOLD_START_INTERVAL_MS = 160
export const HOLD_MIN_INTERVAL_MS = 30
/** Each repeat waits this fraction of the one before, until it reaches the fastest gap. */
const HOLD_SPEED_UP = 0.85
/** How long after a release the browser's own `click` for it is still swallowed, in ms. */
const CLICK_AFTER_RELEASE_MS = 100

/**
 * Hold-to-repeat for a pair of step buttons (ticket 355): a press steps once straight away, and after a short delay keeps
 * stepping, faster the longer it is held, until release, pointer leave or `step` saying it can go no further. Mouse, touch
 * and Enter/Space all work. A press that has already stepped swallows the `click` that follows it, so a release never
 * adds a step; a `click` with no press before it (a screen reader, a script) still steps once.
 * `step(direction)` returns whether it moved.
 */
export function useHoldRepeat(step: (direction: 1 | -1) => boolean) {
  let timer: ReturnType<typeof setTimeout> | undefined
  let pressed = false
  let releasedAt = 0

  function stop() {
    clearTimeout(timer)
    timer = undefined
  }

  function release() {
    pressed = false
    releasedAt = Date.now()
  }

  /** The press ended without a click to come (left the button, cancelled). */
  function abandon() {
    pressed = false
    releasedAt = 0
  }

  function start(direction: 1 | -1) {
    stop()
    if (!step(direction)) return
    let interval = HOLD_START_INTERVAL_MS
    const repeat = () => {
      if (!step(direction)) {
        // The limit usually turns the button off, so its release may never be seen.
        if (pressed) release()
        return stop()
      }
      interval = Math.max(HOLD_MIN_INTERVAL_MS, interval * HOLD_SPEED_UP)
      timer = setTimeout(repeat, interval)
    }
    timer = setTimeout(repeat, HOLD_DELAY_MS)
  }

  function isActivationKey(event: KeyboardEvent) {
    return event.key === 'Enter' || event.key === ' '
  }

  /** The listeners for one button: spread them with `v-on`. */
  function handlers(direction: 1 | -1) {
    return {
      pointerdown(event: PointerEvent) {
        if (event.pointerType === 'mouse' && event.button !== 0) return
        // A touch pointer is captured by the button, which would hide it leaving; let go so `pointerleave` fires.
        const target = event.currentTarget as Element | null
        if (target?.hasPointerCapture?.(event.pointerId)) target.releasePointerCapture(event.pointerId)
        pressed = true
        start(direction)
      },
      pointerup() {
        release()
        stop()
      },
      pointercancel() {
        abandon()
        stop()
      },
      // Leaving after the release (touch fires it before the click) keeps the click to swallow; leaving mid-press has none.
      pointerleave() {
        if (pressed) abandon()
        stop()
      },
      click() {
        if (pressed || Date.now() - releasedAt < CLICK_AFTER_RELEASE_MS) releasedAt = 0
        else step(direction)
      },
      keydown(event: KeyboardEvent) {
        if (!isActivationKey(event)) return
        event.preventDefault()
        if (event.repeat) return
        pressed = true
        start(direction)
      },
      keyup(event: KeyboardEvent) {
        if (!isActivationKey(event)) return
        event.preventDefault()
        release()
        stop()
      },
      blur() {
        abandon()
        stop()
      },
      contextmenu(event: Event) {
        if (timer !== undefined) event.preventDefault()
      },
    }
  }

  return { handlers, stop }
}
