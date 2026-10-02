import { onBeforeUnmount, ref, watch, type Ref } from 'vue'

/**
 * A media query's live answer (ticket 168), for the handful of things pure CSS can't decide on its own: whether the
 * Drawer is acting as a real dialog right now (a static sidebar at wider tiers, an overlay at the iPad mini one)
 * needs its focus trap, its Escape layer and its aria-modal gated on the *same* tier the CSS puts it in, not on
 * whether `open` merely happens to be true -- and `open` only ever becomes true from a button CSS already hides
 * outside that tier, but a window resized while it's open must still fall back cleanly. `win` defaults to `window`
 * and is otherwise only for tests (`src/testUtils/fakeMatchMedia.ts`), the same dependency-injected shape
 * `theme.ts`'s `followDeviceTheme` uses for its own matchMedia listening.
 */
export function useMediaQuery(query: string, win: Pick<Window, 'matchMedia'> = window): Ref<boolean> {
  const matches = ref(false)
  let mql: MediaQueryList | undefined
  let listener: (() => void) | undefined

  function detach() {
    if (mql && listener) mql.removeEventListener('change', listener)
    mql = undefined
    listener = undefined
  }

  watch(
    () => query,
    (nextQuery) => {
      detach()
      mql = win.matchMedia(nextQuery)
      matches.value = mql.matches
      listener = () => {
        matches.value = mql!.matches
      }
      mql.addEventListener('change', listener)
    },
    { immediate: true },
  )

  onBeforeUnmount(detach)

  return matches
}
