import { onScopeDispose, readonly, ref, type Ref } from 'vue'

/** The stillness on the first section before the nudge plays, in ms. */
const NUDGE_WAIT = 1500
/** The nudge's length, in ms: `--nudge-length`. */
const NUDGE_LENGTH = 1100
const STORAGE_KEY = 'openbeads:homepage-scroll-known'

function knownOnDevice(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function rememberKnown() {
  try {
    localStorage.setItem(STORAGE_KEY, '1')
  } catch {
    // Nowhere to remember it: the nudge may play again on the next visit.
  }
}

/** What the nudge needs of the page: whether it is on the first section, and whether motion is reduced. */
export interface ScrollNudgeDeps {
  onFirst: () => boolean
  reducedMotion: Readonly<Ref<boolean>>
}

/** The Homepage showing a first-time visitor it scrolls (ticket 0784; Homepage card, the nudge): after a stillness on the
 * first section its section lifts and settles once, and Next's arrow dips. Once per device, and never for a beader who
 * scrolled first; a press or a key starts the wait again. Never under reduced motion. */
export function useScrollNudge({ onFirst, reducedMotion }: ScrollNudgeDeps): {
  nudging: Readonly<Ref<boolean>>
  /** The page moved, or the beader tried to move it: they know it scrolls. */
  scrolled: () => void
  /** A press or a key: not a sign they know, but not stillness either. */
  acted: () => void
} {
  const nudging = ref(false)
  let known = knownOnDevice()
  let timer: ReturnType<typeof setTimeout> | undefined

  function wait() {
    clearTimeout(timer)
    if (known) return
    timer = setTimeout(play, NUDGE_WAIT)
  }

  function play() {
    if (!onFirst() || reducedMotion.value) return
    known = true
    rememberKnown()
    nudging.value = true
    timer = setTimeout(() => (nudging.value = false), NUDGE_LENGTH)
  }

  function scrolled() {
    nudging.value = false
    clearTimeout(timer)
    if (known) return
    known = true
    rememberKnown()
  }

  function acted() {
    nudging.value = false
    wait()
  }

  wait()
  onScopeDispose(() => clearTimeout(timer))
  return { nudging: readonly(nudging), scrolled, acted }
}
