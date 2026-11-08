// The ghost above the demo editor's menus and pickers (Homepage card, What's inside, ticket 0820): they open in the
// browser's top layer, over anything a z-index can lift, so while one is open the ghost's layer joins them there, last,
// laid over the demo's box, and leaves again once none is.

/** Whether this browser has popovers (a test DOM may not). */
const topLayer = typeof HTMLElement !== 'undefined' && 'showPopover' in HTMLElement.prototype

/** Keeps `layer`, a `popover="manual"` element drawn over `box`, above every popover open in `box`; returns the stop. */
export function keepAboveMenus(layer: HTMLElement, box: HTMLElement): () => void {
  if (!topLayer) return () => {}
  let following = 0

  const raised = () => layer.matches(':popover-open')
  const anyOpen = () => [...box.querySelectorAll(':popover-open')].some((each) => each !== layer)

  function place(): void {
    const room = box.getBoundingClientRect()
    Object.assign(layer.style, { left: `${room.left}px`, top: `${room.top}px`, width: `${room.width}px`, height: `${room.height}px` })
  }

  function lower(): void {
    cancelAnimationFrame(following)
    following = 0
    if (raised()) layer.hidePopover()
    for (const side of ['left', 'top', 'width', 'height']) layer.style.removeProperty(side)
  }

  /** Each frame while raised: over the box wherever it moved, and down once no popover is open (one taken out of the
   * page closes without a `toggle`). */
  function follow(): void {
    if (!anyOpen()) return lower()
    place()
    following = requestAnimationFrame(follow)
  }

  /** Last into the top layer, so above the popover that just opened. */
  function raise(): void {
    if (raised()) layer.hidePopover()
    place()
    layer.showPopover()
    if (!following) following = requestAnimationFrame(follow)
  }

  function onToggle(event: Event): void {
    if (event.target === layer) return
    if ((event as ToggleEvent).newState === 'open') raise()
    else if (!anyOpen()) lower()
  }

  box.addEventListener('toggle', onToggle, true)
  if (anyOpen()) raise()
  return () => {
    box.removeEventListener('toggle', onToggle, true)
    lower()
  }
}
