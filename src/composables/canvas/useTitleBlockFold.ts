import { readonly, ref } from 'vue'

/** Whether the person folded the margin sheet's title block to its name tab: kept for the session, never saved. */
const folded = ref(false)

/** The title block folded by hand with its fold button and unfolded from its tab (MarginSheet card, ticket 0658), for
 * the session only, unlike the Frame panel's Switch that hides it, which the device remembers. */
export function useTitleBlockFold() {
  return {
    folded: readonly(folded),
    fold: () => (folded.value = true),
    unfold: () => (folded.value = false),
  }
}
