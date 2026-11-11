/** A box in screen coordinates, as `getBoundingClientRect` gives it. */
interface Box {
  left: number
  right: number
  top: number
  bottom: number
}

/** Where in their box the toasts start so an open panel over their corner (the Export panel; a phone's full width)
 * never covers them, ticket 0859: its bottom edge, the gap following. None where the panel misses their column or
 * reaches so low that they would leave the box: there they stay on top. */
export function toastsBelowPanel(panel: Box, toasts: Box, room: Box): number | undefined {
  if (panel.left >= toasts.right || panel.right <= toasts.left) return undefined
  const below = panel.bottom - room.top
  return below + (toasts.bottom - toasts.top) > room.bottom - room.top ? undefined : below
}
