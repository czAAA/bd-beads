/**
 * A panel a press outside closes (BottomSheet, PanelShell) swallows that press, so the page under it never sees it and the
 * press leaves focus where it is. Handing focus back to the button that opened the panel after such a close would make
 * Space press that button instead of panning the canvas (ticket 424). Escape and the close button still hand focus back.
 */
export function usePressClosed() {
  let closed = false
  return {
    /** Call just before the panel emits its close for a press outside it. */
    markPressClosed() {
      closed = true
    },
    /** True when the panel closed because of a press outside it, so focus must not be handed back. */
    wasPressClosed() {
      return closed
    },
  }
}
