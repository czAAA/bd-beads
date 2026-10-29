import { computed, onBeforeUnmount, reactive, watch, type ComputedRef } from 'vue'

/** What the fitting needs: the forms to try, best first; the room they have; how wide the one shown is; and the
 * elements whose size changes that width. */
export interface FittingFormDeps<F extends string> {
  forms: () => readonly F[]
  room: () => number
  /** The width of the form shown now, read from the page; 0 where nothing is laid out (jsdom). */
  measure: () => number
  observed: () => readonly (Element | null | undefined)[]
}

/** The first of the forms whose width fits its room (ticket 0658): the margin sheet's band row and title block step down
 * a form where the sheet is too narrow for them. Each form's width is learnt as it is shown, so a form not yet seen is
 * tried; none fitting gives none. */
export function useFittingForm<F extends string>({ forms, room, measure, observed }: FittingFormDeps<F>): ComputedRef<F | undefined> {
  const widths = reactive(new Map<F, number>()) as Map<F, number>
  const shown = computed(() => forms().find((form) => !((widths.get(form) ?? 0) > room())))

  function learn(): void {
    const form = shown.value
    if (form === undefined) return
    const width = measure()
    if (width > 0 && widths.get(form) !== width) widths.set(form, width)
  }

  // After the page shows a form, and whenever what it holds is resized (a longer counter, another language).
  watch([shown, room], learn, { flush: 'post' })
  const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(learn)
  watch(
    () => observed().filter((element): element is Element => !!element),
    (elements) => {
      observer?.disconnect()
      elements.forEach((element) => observer?.observe(element))
    },
    { flush: 'post', immediate: true },
  )
  onBeforeUnmount(() => observer?.disconnect())
  return shown
}
