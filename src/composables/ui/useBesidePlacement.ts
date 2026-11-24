import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'
import { cssZoomOf } from './cssZoom'
import { scopeRoom, useShellScope } from './shellScope'

/** What stands between a popover and the one it is placed beside, and between it and the room's edge, in the popover's px. */
const GAP_PX = 12
const EDGE_PX = 8
/** The narrowest a popover beside another is drawn; where neither side has this much, it stacks under it instead. */
const NARROWEST_PX = 320

/** Places a popover beside another (ticket 1226): on the side with more room, its bottom level with the anchor's; where
 * neither side has `NARROWEST_PX` it is `stacked` in the other's flow. The room is the window or a boxed shell's box
 * (ticket 0797), in the popover's own px (ticket 1071); placed again when either grows or moves. */
export function useBesidePlacement(root: Ref<HTMLElement | undefined>, anchor: () => Element | null | undefined) {
  const style = ref<Record<string, string>>({ visibility: 'hidden' })
  const stacked = ref(false)
  const scope = useShellScope()
  let resizeObserver: ResizeObserver | undefined
  let styleObserver: MutationObserver | undefined

  function place() {
    const el = root.value
    const beside = anchor()?.getBoundingClientRect()
    if (!el || !beside) return
    const room = scopeRoom(scope)
    const zoom = cssZoomOf(el)
    const size = { width: (room.right - room.left) / zoom, height: (room.bottom - room.top) / zoom }
    const anchored = { left: (beside.left - room.left) / zoom, right: (beside.right - room.left) / zoom, bottom: (beside.bottom - room.top) / zoom }
    const roomLeft = anchored.left - GAP_PX - EDGE_PX
    const roomRight = size.width - anchored.right - GAP_PX - EDGE_PX
    const toLeft = roomLeft >= roomRight
    const widest = Math.max(roomLeft, roomRight)
    stacked.value = widest < NARROWEST_PX
    if (stacked.value) {
      style.value = {}
      return
    }
    // Its own width, or what the room leaves of it: measured with no cut of ours, as it is when it fits.
    el.style.maxWidth = ''
    // Never taller than the room, a boxed shell's box too, scrolling inside itself past that.
    const tallest = size.height - 2 * EDGE_PX
    el.style.maxHeight = `${tallest}px`
    const width = Math.min(el.offsetWidth, widest)
    const left = toLeft ? anchored.left - GAP_PX - width : anchored.right + GAP_PX
    const top = Math.max(EDGE_PX, Math.min(anchored.bottom - el.offsetHeight, size.height - EDGE_PX - el.offsetHeight))
    style.value = { left: `${left}px`, top: `${top}px`, maxWidth: `${width}px`, maxHeight: `${tallest}px` }
  }

  onMounted(() => {
    place()
    window.addEventListener('resize', place)
    const beside = anchor()
    resizeObserver = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(place)
    if (beside) resizeObserver?.observe(beside)
    if (root.value) resizeObserver?.observe(root.value)
    // The anchor moves (its own placement) without changing size: its style says so.
    styleObserver = typeof MutationObserver === 'undefined' || !beside ? undefined : new MutationObserver(place)
    if (beside) styleObserver?.observe(beside, { attributes: true, attributeFilter: ['style'] })
  })
  onBeforeUnmount(() => {
    window.removeEventListener('resize', place)
    resizeObserver?.disconnect()
    styleObserver?.disconnect()
  })

  return { style, stacked }
}
