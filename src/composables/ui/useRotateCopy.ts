import { onBeforeUnmount, ref } from 'vue'

/** How the Rotate copy leaves, in ms (MarginSheet and ContextBar cards).
 * @internal Its test holds these to their CSS twins in design-values.css. */
export const ROTATE_COPY = {
  /** After the pointer leaves it, the copy waits this long (`--rotate-copy-wait`)... */
  wait: 200,
  /** ...then fades out on `--ease-in` (`--rotate-copy-fade`). */
  fade: 150,
  /** On touch it leaves this long after the last tap (`--rotate-copy-tap-hold`). */
  tapHold: 1600,
} as const

/** Where the copy's button stands, in the px of the bar's parent, and the scale and form (compact or full) the bar drew
 * the button it copies at. */
export interface RotateCopyPlace {
  left: number
  top: number
  scale: number
  small: boolean
}

/** A Rotate button's copy that waits where it was pressed as its bar turns away: Rotate Frame's (ticket 1016) and the
 * Selection bar's Rotate (ticket 1110). It leaves `wait` after the pointer does, fading over `fade`, on touch `tapHold`
 * after the last tap; once the bar's own button is back under it, `handOverMs` later (the turn seen; 0 where none plays). */
export function useRotateCopy(options: { handOverMs: number }) {
  const place = ref<RotateCopyPlace>()
  /** Fading out: its last `fade` ms. */
  const leaving = ref(false)
  let timer: ReturnType<typeof setTimeout> | undefined
  /** Whether the copy was last pressed by a finger, which has no hover to leave by. */
  let touch = false
  /** Whether the pointer is away from the copy, its wait begun. */
  let away = false

  function clear(): void {
    clearTimeout(timer)
    timer = undefined
  }

  function drop(): void {
    clear()
    place.value = undefined
    leaving.value = false
  }

  /** Fades out, then goes. */
  function fadeOut(): void {
    clear()
    leaving.value = true
    timer = setTimeout(drop, ROTATE_COPY.fade)
  }

  /** A press of Rotate Frame, from the band or from the copy: the copy stands at `at` (where it was, for a press on the
   * copy itself). */
  function pressed(at: RotateCopyPlace | undefined, byFinger: boolean): void {
    clear()
    if (at) place.value = at
    leaving.value = false
    away = false
    touch = byFinger
    if (touch) timer = setTimeout(fadeOut, ROTATE_COPY.tapHold)
  }

  /** The pointer came back over the copy: it stays. */
  function enter(event: PointerEvent): void {
    if (event.pointerType === 'touch' || !place.value || !away) return
    clear()
    away = false
    leaving.value = false
  }

  /** The pointer left the copy: it waits, then fades; told again while away, it keeps the wait it began. */
  function leave(event: PointerEvent): void {
    if (event.pointerType === 'touch' || touch || !place.value || away) return
    clear()
    away = true
    timer = setTimeout(fadeOut, ROTATE_COPY.wait)
  }

  /** The bar's own button has come back under the copy: it takes over once the turn has been seen. */
  function handOver(): void {
    if (!place.value) return
    clear()
    if (options.handOverMs > 0) timer = setTimeout(drop, options.handOverMs)
    else drop()
  }

  onBeforeUnmount(clear)
  return { place, leaving, pressed, enter, leave, handOver, drop }
}
