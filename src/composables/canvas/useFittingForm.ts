import { computed, onBeforeUnmount, reactive, watch, type ComputedRef } from 'vue'

/** What the fitting needs: the forms to try, best first; the room each has (most have the same); how wide the one
 * shown is; the elements whose size changes that width; and the labels the forms read. */
export interface FittingFormDeps<F extends string> {
  forms: () => readonly F[]
  room: (form: F) => number
  /** The width of the form shown now, read from the page; 0 where nothing is laid out (jsdom). */
  measure: () => number
  observed: () => readonly (Element | null | undefined)[]
  /** What the forms' labels say, as one key: when it changes (a row direction, a language), every width learnt is
   * forgotten and the best form is measured again (ticket 0851). */
  labels: () => string
}

/** The first of the forms whose width fits its room (ticket 0658): the margin sheet's band row and title block step down
 * a form where the sheet is too narrow for them. Each form's width is learnt as it is shown, so a form not yet seen is
 * tried; none fitting gives none. A change of label forgets every width learnt (ticket 0851). */
export function useFittingForm<F extends string>({ forms, room, measure, observed, labels }: FittingFormDeps<F>): ComputedRef<F | undefined> {
  const widths = reactive(new Map<F, number>()) as Map<F, number>
  const shown = computed(() => forms().find((form) => !((widths.get(form) ?? 0) > room(form))))
  // Before the page shows the new labels, so the best form is the one laid out with them, and the steps down from it
  // are taken before the next paint.
  watch(labels, () => widths.clear())

  function learn(): void {
    const form = shown.value
    if (form === undefined) return
    const width = measure()
    if (width > 0 && widths.get(form) !== width) widths.set(form, width)
  }

  // After the page shows a form, and whenever what it holds is resized (a longer counter, another language).
  watch([shown, () => forms().map(room).join()], learn, { flush: 'post' })
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

/** How wide a row of flex items needs to be: each shown one's width, a Progress track at its least, and the gaps between
 * (the Progress bar and the Welcome cuff's, ticket 1183). */
export function rowItemsWidth(items: readonly HTMLElement[], gap: number): number {
  const widths = items.map((item) => (item.classList.contains('progress-track') ? Number.parseFloat(getComputedStyle(item).minWidth) || 0 : item.offsetWidth))
  return widths.reduce((sum, width) => sum + width, 0) + gap * Math.max(0, items.length - 1)
}
