import { SCROLLING_OVERFLOW } from '../ui/scrollingOverflow'

/** Whether anything from the target up to the layer scrolls by itself, so a plain wheel there is its own. */
function scrollsItself(target: EventTarget | null, layer: EventTarget | null): boolean {
  for (let el = target instanceof Element ? target : null; el && el !== layer; el = el.parentElement) {
    const { overflowX, overflowY } = getComputedStyle(el)
    if (SCROLLING_OVERFLOW.has(overflowY) && el.scrollHeight > el.clientHeight) return true
    if (SCROLLING_OVERFLOW.has(overflowX) && el.scrollWidth > el.clientWidth) return true
  }
  return false
}

/** The wheel over what floats above the Table (the margin sheet, the bars, the Tool pill): the surface takes it, so it
 * zooms and moves the Table as it does over the beads. The surface's own wheel arrives here already taken. */
export function useTableWheel(surface: () => { wheel: (event: WheelEvent) => void } | undefined) {
  return (event: Event) => {
    const wheel = event as WheelEvent
    if (wheel.defaultPrevented) return
    if (!wheel.ctrlKey && !wheel.metaKey && scrollsItself(wheel.target, wheel.currentTarget)) return
    surface()?.wheel(wheel)
  }
}
