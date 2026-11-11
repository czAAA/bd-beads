import { nextTick, reactive, watch, type Ref } from 'vue'
import { useElementSize } from './useElementSize'

/** Which labels in `box` are left out because their word has no room beside the rest of its row (ticket 0864): each
 * label is marked `data-fit-label="<key>"`, and a left-out one stays laid out, hidden, so its row keeps its icon, the word
 * moves to the icon's Tooltip and the room is measured again whenever the box changes size or `words` change. */
export function useLabelsThatFit(box: Ref<HTMLElement | undefined>, words: () => unknown): Readonly<Record<string, boolean>> {
  const cut = reactive<Record<string, boolean>>({})
  const { width } = useElementSize(box)

  function measure(): void {
    for (const label of box.value?.querySelectorAll<HTMLElement>('[data-fit-label]') ?? []) {
      const row = label.parentElement
      const rowWidth = row?.getBoundingClientRect().width ?? 0
      if (!row || rowWidth === 0) continue
      const style = getComputedStyle(row)
      const others = [...row.children].filter((child) => child !== label)
      const taken = others.reduce((sum, child) => sum + child.getBoundingClientRect().width, 0) + (parseFloat(style.columnGap) || 0) * others.length
      const room = rowWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - taken
      const text = document.createRange()
      text.selectNodeContents(label)
      const isCut = text.getBoundingClientRect().width > room
      const key = label.dataset.fitLabel!
      if (cut[key] !== isCut) cut[key] = isCut
    }
  }

  watch([width, words], () => void nextTick(measure), { immediate: true })
  return cut
}
