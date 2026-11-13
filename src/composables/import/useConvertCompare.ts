import { computed, getCurrentScope, onScopeDispose, ref, watch, type Ref } from 'vue'

/** How long a press lasts before it is a hold (ConvertImage card DS-3): held, the picture shows only until let go.
 * @internal the test holds a press exactly this long. */
export const COMPARE_HOLD_MS = 300

/** Under 1024 px or in portrait (the converter's stacked layout, as its CSS has it): Compare is Beads | Picture there.
 * @internal a test sets this query to stand the page there. */
export const NARROW_CONVERTER = '(max-width: 63.99rem), (orientation: portrait)'

/** What the narrow bar's Beads | Picture shows (ticket 0909). */
export type CompareView = 'beads' | 'picture'

export interface ConvertCompareDeps {
  /** Under 1024 px or in portrait: Compare is Beads | Picture there, a toggle for the picture beside the beads above. */
  narrow: Ref<boolean>
}

/** Compare's one action (ConvertImage card DS-3, ticket 0909) with its triggers: a press (pointer, Enter, Space or a
 * screen reader's click) puts the picture beside the beads, or under 1024 px chooses Picture, and stays; a press held
 * past 300 ms shows the picture in the beads' place until let go. Not remembered; a page crossing 1024 px drops it. */
export function useConvertCompare({ narrow }: ConvertCompareDeps) {
  /** Wide: the picture beside the beads; narrow: Picture chosen. */
  const on = ref(false)
  const held = ref(false)
  let timer: ReturnType<typeof setTimeout> | undefined
  let pressing = false
  // The click a browser sends after a hold or a key's press is that gesture's own, not one more press.
  let ownClick = false
  let ownClickTimer: ReturnType<typeof setTimeout> | undefined

  watch(narrow, () => (on.value = false))

  function markOwnClick() {
    ownClick = true
    clearTimeout(ownClickTimer)
    ownClickTimer = setTimeout(() => (ownClick = false), 0)
  }

  /** A press begins: held long enough, it shows the picture in the beads' place. */
  function pressStart() {
    if (pressing) return
    pressing = true
    clearTimeout(timer)
    timer = setTimeout(() => (held.value = true), COMPARE_HOLD_MS)
  }
  /** A press ends; a hold ends with it, and the click that follows is the hold's own. */
  function pressEnd() {
    if (!pressing) return
    pressing = false
    clearTimeout(timer)
    if (!held.value) return
    held.value = false
    markOwnClick()
  }

  /** The button's click: a press, unless it is the end of a hold or a key's press. Returns whether it toggled. */
  function clicked() {
    if (ownClick) return false
    on.value = !on.value
    return true
  }

  const isPressKey = (event: KeyboardEvent) => event.key === 'Enter' || event.key === ' '
  /** Enter and Space run the same press: a tap toggles on letting go, a hold shows the picture until the key is up. */
  function keyDown(event: KeyboardEvent) {
    if (!isPressKey(event)) return
    event.preventDefault()
    if (!event.repeat) pressStart()
  }
  function keyUp(event: KeyboardEvent) {
    if (!isPressKey(event) || !pressing) return
    event.preventDefault()
    const wasHeld = held.value
    pressEnd()
    if (!wasHeld) on.value = !on.value
    markOwnClick()
  }

  /** Under 1024 px: Beads or Picture, chosen until the other is. */
  function choose(view: CompareView) {
    on.value = view === 'picture'
  }

  if (getCurrentScope()) {
    onScopeDispose(() => {
      clearTimeout(timer)
      clearTimeout(ownClickTimer)
    })
  }

  return {
    on,
    held,
    /** Wide and on: the picture and the beads in two halves at one scale. */
    sideBySide: computed(() => !narrow.value && on.value && !held.value),
    /** The picture in the beads' place: held, or Picture chosen under 1024 px. */
    pictureAlone: computed(() => held.value || (narrow.value && on.value)),
    shown: computed<CompareView>(() => (on.value ? 'picture' : 'beads')),
    pressStart,
    pressEnd,
    clicked,
    /** Whether a click now is a hold's or a key's own (Beads | Picture swallows it rather than choose again). */
    isOwnClick: () => ownClick,
    keyDown,
    keyUp,
    choose,
  }
}
