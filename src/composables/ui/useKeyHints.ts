import { computed, ref, type ComputedRef } from 'vue'
import { useDevicePreferences } from '../../services/devicePreferences'

/** A device with a mouse or trackpad that can hover is likely to have a keyboard too. */
const KEYBOARD_LIKELY_QUERY = '(any-pointer: fine) and (any-hover: hover)'
/** A device whose main pointer is a finger (a phone, an iPad): a Pencil or a trackpad beside it doesn't make a keyboard. */
const TOUCH_QUERY = '(pointer: coarse)'

/** The keys that only a real keyboard sends: a soft keyboard types characters but has none of these. */
const REAL_KEYS = new Set(['Tab', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])

const pointerLikely = ref(false)
const touchFirst = ref(false)
/** Whether a real keyboard key has been seen this session; never saved, and a later touch does not undo it. */
const keyboardSeen = ref(false)
let watching = false
let stopWatchingPointer: (() => void) | undefined

/** Follows one media query into `target`; returns how to let go of it. */
function follow(query: string, target: typeof pointerLikely): () => void {
  const list = window.matchMedia(query)
  const update = () => (target.value = list.matches)
  update()
  list.addEventListener('change', update)
  return () => list.removeEventListener('change', update)
}

/** Reads the device's pointers and follows them; a second call lets go of the first queries. */
function watchPointer() {
  stopWatchingPointer?.()
  stopWatchingPointer = undefined
  if (typeof window.matchMedia !== 'function') return
  const stops = [follow(KEYBOARD_LIKELY_QUERY, pointerLikely), follow(TOUCH_QUERY, touchFirst)]
  stopWatchingPointer = () => stops.forEach((stop) => stop())
}

/** Starts watching the device once for the whole app: its pointer, and the first real keyboard key. */
function watchDevice() {
  if (watching || typeof window === 'undefined') return
  watching = true
  watchPointer()
  window.addEventListener(
    'keydown',
    (event) => {
      if (REAL_KEYS.has(event.key) || event.ctrlKey || event.metaKey) keyboardSeen.value = true
    },
    true,
  )
}

/** Forgets the session's keyboard and reads the pointer afresh.
 * @internal A reset hook for tests, which share one page. */
export function resetKeyHintsDevice() {
  keyboardSeen.value = false
  if (watching) watchPointer()
}

// Whether hotkey chips show (tickets 438, 0846). Auto until the person flips the switch in Keyboard shortcuts: shown with
// a hovering fine pointer on a device not led by touch, or once a real key has been seen this session. The first flip
// keeps an explicit on/off on this device. The shared chip components read this, so no control carries its own check.
export function useKeyHints(): { shown: ComputedRef<boolean>; setShown: (on: boolean) => void } {
  watchDevice()
  const choice = useDevicePreferences().get('keyHints')
  const shown = computed(() => choice.value ?? (keyboardSeen.value || (pointerLikely.value && !touchFirst.value)))
  return {
    shown,
    setShown: (on) => {
      choice.value = on
    },
  }
}

/** Whether this is an Apple device, where the modifier key is ⌘. */
function isApple(): boolean {
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent || navigator.platform || '')
}

/** The device a help line speaks to (ticket 0846): touch words, ⌘ keys or Ctrl keys. */
export type HelpDevice = 'touch' | 'apple' | 'other'

/** The one rule by device for every help line (ticket 0846; writing.md, A help line fits the device in hand): touch
 * while the main pointer is a finger and the key chips are hidden, so a line names keys exactly when the chips show
 * them; otherwise ⌘ on an Apple device and Ctrl elsewhere. */
export function useHelpDevice(): {
  device: ComputedRef<HelpDevice>
  /** A key with the platform's modifier: "⌘V" on an Apple device, "Ctrl+V" elsewhere; "⌘" or "Ctrl" alone. */
  modKey: (key?: string) => string
} {
  const { shown } = useKeyHints()
  const apple = isApple()
  const device = computed<HelpDevice>(() => (touchFirst.value && !shown.value ? 'touch' : apple ? 'apple' : 'other'))
  return { device, modKey: (key = '') => (apple ? `⌘${key}` : key ? `Ctrl+${key}` : 'Ctrl') }
}
