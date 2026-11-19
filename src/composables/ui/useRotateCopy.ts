import { onBeforeUnmount, ref, watch } from 'vue'

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

/** A pointer's press on a bar's Rotate (`data-rotate-from="button"`) or its menu item (`data-rotate-from="menu"`): the
 * button's box on screen, where the press was, and whether a finger made it. */
export interface RotatePress {
  button?: DOMRect
  at: { x: number; y: number }
  touch: boolean
}

/** How near, in px, the bar's own button must come back to the copy to stand under it: the same place, less rounding. */
const SAME_PLACE_PX = 1

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

  /** The press on the bar's Rotate or its menu item, if the next Rotate came from one: a press from the keyboard leaves
   * no copy, as focus goes with the bar. */
  let press: RotatePress | undefined
  /** A pointer went down in the bar (listened to in the capture phase): noted if on Rotate, forgotten otherwise. */
  function notePress(event: PointerEvent): void {
    const pressed = event.target instanceof Element ? event.target.closest('[data-rotate-from]') : null
    const button = pressed?.getAttribute('data-rotate-from') === 'button' ? pressed.getBoundingClientRect() : undefined
    press = pressed ? { button, at: { x: event.clientX, y: event.clientY }, touch: event.pointerType === 'touch' } : undefined
  }
  /** A key in the bar: a Rotate it presses is the keyboard's, whatever press came before (one that never clicked). */
  function forgetPress(): void {
    press = undefined
  }
  /** The press the Rotate just run came from, once: none from the keyboard or Shift+R. */
  function takePress(): RotatePress | undefined {
    const taken = press
    press = undefined
    return taken
  }

  /** Whether the press on the copy was a finger's. */
  let copyTouch = false
  function noteCopyPress(event: PointerEvent): void {
    copyTouch = event.pointerType === 'touch'
  }
  /** The copy was pressed: it turns again and stays where it is. */
  function pressedAgain(): void {
    pressed(undefined, copyTouch)
  }

  /** The bar's own button is now at `own`, in the copy's px: back under the copy, it takes over. */
  function ownAt(own: { left: number; top: number } | undefined): void {
    const at = place.value
    if (at && own && Math.abs(own.left - at.left) < SAME_PLACE_PX && Math.abs(own.top - at.top) < SAME_PLACE_PX) handOver()
  }

  // A pointer that left before the copy was drawn under it never enters or leaves it: each move tells it where it is.
  const copyEl = ref<HTMLElement>()
  function onPointerMove(event: PointerEvent): void {
    const box = copyEl.value?.getBoundingClientRect()
    if (!box) return
    const over = event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom
    if (over) enter(event)
    else leave(event)
  }
  watch(
    () => !!place.value,
    (shown) => (shown ? window.addEventListener('pointermove', onPointerMove, { passive: true }) : window.removeEventListener('pointermove', onPointerMove)),
  )

  onBeforeUnmount(() => {
    clear()
    window.removeEventListener('pointermove', onPointerMove)
  })
  return { place, leaving, copyEl, pressed, pressedAgain, notePress, noteCopyPress, forgetPress, takePress, ownAt, enter, leave, drop }
}
