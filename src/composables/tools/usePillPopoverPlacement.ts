import { nextTick, onBeforeUnmount, onMounted, ref, type Ref } from 'vue'
import { popoverPlacement, type PillPosition } from '../../domain/toolPill'
import { cssZoomOf } from '../ui/cssZoom'
import { providePlaceKeeper } from '../ui/placeKeeper'
import { PAGE_SCOPE, scopeRoom, useShellScope } from '../ui/shellScope'

/** Less than this much taller than its room is a rounding of the layout, not content to cut. */
const ROUNDING_PX = 0.5

/** What a popover beside the Tool pill is placed against: the tile that opened it, the pill, and the pill's edge. */
export interface PillPopoverAnchor {
  tile: HTMLElement | undefined
  pill: HTMLElement | undefined
  position: PillPosition
}

/** Places a popover beside the Tool pill (ToolPill card; tickets 439, 0703): toward the canvas, centred on its tile,
 * clamped inside the screen; again when the window or its own size changes. The style for the popover's root, hidden
 * until placed. A control inside that asked to keep its place (`PlaceKeeper`, ticket 1092) stays put on the screen. */
export function usePillPopoverPlacement(root: Ref<HTMLElement | undefined>, anchor: () => PillPopoverAnchor): Ref<Record<string, string>> {
  const style = ref<Record<string, string>>({ visibility: 'hidden' })
  const scope = useShellScope()
  /** The control that keeps its place, and where it was in the room when it asked, in the popover's own px. */
  let kept: { control: HTMLElement; left: number; top: number } | undefined
  const shift = ref(0)
  const roomAbove = ref(true)

  /** The room the popover is placed in, and how its own px stand to the screen's. */
  function measure(el: HTMLElement) {
    const room = scopeRoom(scope)
    return { room, zoom: cssZoomOf(el) }
  }

  providePlaceKeeper({
    keep(control) {
      const el = root.value
      if (!el) return
      const { room, zoom } = measure(el)
      const box = control.getBoundingClientRect()
      kept = { control, left: (box.left - room.left) / zoom, top: (box.top - room.top) / zoom }
    },
    release() {
      kept = undefined
      shift.value = 0
    },
    shift,
    roomAbove,
  })

  function place() {
    const el = root.value
    const { tile, pill, position } = anchor()
    const tileBox = tile?.getBoundingClientRect()
    const pillBox = pill?.getBoundingClientRect()
    if (!el || !tileBox || !pillBox) return
    const css = getComputedStyle(document.documentElement)
    const px = (name: string) => parseFloat(css.getPropertyValue(name)) * (css.getPropertyValue(name).endsWith('rem') ? parseFloat(css.fontSize) : 1)
    // In a boxed shell (ticket 0797) the box is the screen, and the popover, teleported into it, is placed from its corner;
    // it is never taller than the box and scrolls inside itself past that, as it does past the screen (ticket 0820).
    // Measured on screen, placed in the popover's own px, which CSS zoom draws larger (ticket 1071).
    const { room, zoom } = measure(el)
    const roomSize = { width: (room.right - room.left) / zoom, height: (room.bottom - room.top) / zoom }
    const edge = px('--float-edge')
    const tallest = roomSize.height - 2 * edge
    let maxHeight = scope === PAGE_SCOPE ? undefined : `${tallest}px`
    // Measured whole: a cut a kept control asked for last time is taken off first.
    el.style.maxHeight = maxHeight ?? ''
    const inRoom = (box: DOMRect) => ({ left: (box.left - room.left) / zoom, top: (box.top - room.top) / zoom, width: box.width / zoom, height: box.height / zoom })
    const placed = popoverPlacement(
      inRoom(tileBox),
      inRoom(pillBox),
      { width: el.offsetWidth, height: el.offsetHeight },
      position,
      roomSize,
      px('--pill-gap'),
      edge,
    )
    let { left, top } = placed
    if (kept && el.contains(kept.control)) {
      const box = kept.control.getBoundingClientRect()
      const own = el.getBoundingClientRect()
      // Where the control is in the popover's whole content, whatever it is scrolled to or cut to now.
      const above = (box.top - own.top) / zoom + el.scrollTop
      const whole = el.scrollHeight + el.offsetHeight - el.clientHeight
      const wanted = kept.top - above
      top = Math.max(edge, wanted)
      // No room for all of it: the popover is cut at the screen's edges and scrolled so the control stays put.
      const hidden = top - wanted
      const height = Math.min(whole - hidden, roomSize.height - edge - top)
      if (height < whole - ROUNDING_PX) {
        maxHeight = `${height}px`
        el.style.maxHeight = maxHeight
        el.scrollTop = hidden
      }
      // Sideways the popover stays too where it runs along the pill; what the screen or the pill's side leaves over,
      // the control makes up by sitting further right in its row.
      // Its own place in the row: where it is, less the margin it has now (read from it, as `shift` may not be drawn yet).
      const within = (box.left - own.left) / zoom - (parseFloat(getComputedStyle(kept.control).marginLeft) || 0)
      if (position === 'top' || position === 'bottom') left = Math.max(edge, Math.min(kept.left - within, roomSize.width - el.offsetWidth - edge))
      shift.value = Math.max(0, kept.left - (left + within))
    } else {
      kept = undefined
      shift.value = 0
      roomAbove.value = top - edge >= roomSize.height - edge - (top + el.offsetHeight)
    }
    style.value = { left: `${left}px`, top: `${top}px`, ...(maxHeight ? { maxHeight } : {}) }
  }

  /** A new window size is a new room: nothing is kept in place across it. */
  function onWindowResize() {
    kept = undefined
    shift.value = 0
    place()
  }

  let resizeObserver: ResizeObserver | undefined

  onMounted(async () => {
    await nextTick()
    place()
    window.addEventListener('resize', onWindowResize)
    // What opens inside the popover grows it (the Custom color picker, a Stepper row): place it again so it stays whole on screen.
    resizeObserver = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(place)
    if (root.value) resizeObserver?.observe(root.value)
  })
  onBeforeUnmount(() => {
    resizeObserver?.disconnect()
    window.removeEventListener('resize', onWindowResize)
  })

  return style
}
