import { onBeforeUnmount, ref, watch, type Ref } from 'vue'

// A media query's live answer (ticket 168), for what CSS can't decide: whether the Drawer acts as a real dialog (focus
// trap, Escape layer, aria-modal) must be gated on the same tier the CSS uses, and survive a resize while open. `win`
// defaults to `window`; tests inject `src/testUtils/fakeMatchMedia.ts`, as theme.ts's `followDeviceTheme` does.
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
