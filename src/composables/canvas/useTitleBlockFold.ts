import { hasInjectionContext, inject, provide, readonly, ref, type InjectionKey } from 'vue'

/** The fold of one shell's title block, so the Homepage's demo folds its own and not the editor's (ticket 0797). */
function createTitleBlockFold() {
  /** Whether the person folded the margin sheet's details away, the Frame's name staying: for the session, never saved. */
  const folded = ref(false)
  return {
    folded: readonly(folded),
    fold: () => (folded.value = true),
    unfold: () => (folded.value = false),
  }
}

type TitleBlockFold = ReturnType<typeof createTitleBlockFold>

const foldKey: InjectionKey<TitleBlockFold> = Symbol('titleBlockFold')
/** The fold outside any shell (a margin sheet mounted on its own in a test). */
const pageFold = createTitleBlockFold()

/** Gives the shell below the caller a title block fold of its own (ticket 0797). */
export function provideTitleBlockFold(): void {
  provide(foldKey, createTitleBlockFold())
}

/** The title block (the band's chips and the foot's facts) folded and unfolded by hand (MarginSheet card, tickets 0658,
 * 1258), for the session only, unlike the Switch that hides it with the name, which the device remembers. */
export function useTitleBlockFold(): TitleBlockFold {
  return (hasInjectionContext() ? inject(foldKey, undefined) : undefined) ?? pageFold
}
