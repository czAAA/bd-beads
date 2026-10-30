import { nextTick, onBeforeUnmount, onMounted, ref, type Ref } from 'vue'
import { popoverPlacement, type PillPosition } from '../../domain/toolPill'

/** What a popover beside the Tool pill is placed against: the tile that opened it, the pill, and the pill's edge. */
export interface PillPopoverAnchor {
  tile: HTMLElement | undefined
  pill: HTMLElement | undefined
  position: PillPosition
}

/** Places a popover beside the Tool pill (ToolPill card; tickets 439, 0703): toward the canvas, centred on its tile,
 * clamped inside the screen; measured once it has its real size, again when the window or its own size changes. The
 * style to bind on the popover's root, hidden until placed. */
export function usePillPopoverPlacement(root: Ref<HTMLElement | undefined>, anchor: () => PillPopoverAnchor): Ref<Record<string, string>> {
  const style = ref<Record<string, string>>({ visibility: 'hidden' })

  function place() {
    const el = root.value
    const { tile, pill, position } = anchor()
    const tileBox = tile?.getBoundingClientRect()
    const pillBox = pill?.getBoundingClientRect()
    if (!el || !tileBox || !pillBox) return
    const css = getComputedStyle(document.documentElement)
    const px = (name: string) => parseFloat(css.getPropertyValue(name)) * (css.getPropertyValue(name).endsWith('rem') ? parseFloat(css.fontSize) : 1)
    const { left, top } = popoverPlacement(
      tileBox,
      pillBox,
      { width: el.offsetWidth, height: el.offsetHeight },
      position,
      { width: window.innerWidth, height: window.innerHeight },
      px('--pill-gap'),
      px('--float-edge'),
    )
    style.value = { left: `${left}px`, top: `${top}px` }
  }

  let resizeObserver: ResizeObserver | undefined

  onMounted(async () => {
    await nextTick()
    place()
    window.addEventListener('resize', place)
    // What opens inside the popover grows it (the Custom color picker, a Stepper row): place it again so it stays whole on screen.
    resizeObserver = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(place)
    if (root.value) resizeObserver?.observe(root.value)
  })
  onBeforeUnmount(() => {
    resizeObserver?.disconnect()
    window.removeEventListener('resize', place)
  })

  return style
}
