import { computed, ref, type ComputedRef } from 'vue'
import { useDevicePreferences } from '../../services/devicePreferences'

/** A device with a mouse or trackpad that can hover is likely to have a keyboard too. */
const KEYBOARD_LIKELY_QUERY = '(any-pointer: fine) and (any-hover: hover)'

/** The keys that only a real keyboard sends: a soft keyboard types characters but has none of these. */
const REAL_KEYS = new Set(['Tab', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])

const pointerLikely = ref(false)
/** Whether a real keyboard key has been seen this session; never saved, and a later touch does not undo it. */
const keyboardSeen = ref(false)
let watching = false
let stopWatchingPointer: (() => void) | undefined

/** Reads the device's pointer and follows it; a second call lets go of the first query. */
function watchPointer() {
  stopWatchingPointer?.()
  stopWatchingPointer = undefined
  if (typeof window.matchMedia !== 'function') return
  const query = window.matchMedia(KEYBOARD_LIKELY_QUERY)
  const update = () => (pointerLikely.value = query.matches)
  update()
  query.addEventListener('change', update)
  stopWatchingPointer = () => query.removeEventListener('change', update)
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

/** Forgets the session's keyboard and reads the pointer afresh. For tests, which share one page. */
export function resetKeyHintsDevice() {
  keyboardSeen.value = false
  if (watching) watchPointer()
}

/**
 * Whether hotkey chips show (ticket 438). Auto, until the person flips the switch in Keyboard shortcuts: they show on a
 * device with a hovering fine pointer, or once a real keyboard key has been seen this session. The first flip keeps
 * an explicit on or off on this device and there is no way back to auto. The shared chip components read this, so no
 * control carries its own check.
 */
export function useKeyHints(): { shown: ComputedRef<boolean>; setShown: (on: boolean) => void } {
  watchDevice()
  const choice = useDevicePreferences().get('keyHints')
  const shown = computed(() => choice.value ?? (pointerLikely.value || keyboardSeen.value))
  return {
    shown,
    setShown: (on) => {
      choice.value = on
    },
  }
}
