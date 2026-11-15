import { computed, onBeforeUnmount, ref, type Ref } from 'vue'
import { middleCut } from '../../domain/middleCut'
import { useElementSize } from './useElementSize'

export interface MiddleCut {
  /** The text as it shows: whole, or cut in the middle. */
  shown: Readonly<Ref<string>>
  /** Whether it is cut, so the whole text goes in a Tooltip. */
  cut: Readonly<Ref<boolean>>
}

/** `text()` on one line of `line`, in its font: cut in the middle when the line is too short for it (ticket 0929), and
 * measured again when the line changes width or the fonts load. Whole where nothing can measure it (a test DOM). */
export function useMiddleCut(line: Ref<HTMLElement | undefined>, text: () => string): MiddleCut {
  const { width } = useElementSize(line)
  let measuring: CanvasRenderingContext2D | null | undefined
  const fontsLoaded = ref(0)
  const onFonts = () => (fontsLoaded.value += 1)
  const fonts = typeof document === 'undefined' ? undefined : document.fonts
  fonts?.addEventListener?.('loadingdone', onFonts)
  onBeforeUnmount(() => fonts?.removeEventListener?.('loadingdone', onFonts))

  const shown = computed(() => {
    const whole = text()
    void fontsLoaded.value
    const room = width.value
    const el = line.value
    measuring ??= typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d')
    if (!el || room <= 0 || typeof measuring?.measureText !== 'function') return whole
    const style = getComputedStyle(el)
    measuring.font = style.font
    measuring.letterSpacing = style.letterSpacing === 'normal' ? '0px' : style.letterSpacing
    return middleCut(whole, (candidate) => measuring!.measureText(candidate).width <= room)
  })
  return { shown, cut: computed(() => shown.value !== text()) }
}
