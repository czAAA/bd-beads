// A panel closed by a press outside (AppPanel) swallows that press, so focus stays put. Handing focus
// back to the opener would make Space press that button instead of panning the canvas (ticket 424). Escape and the
// close button still hand focus back.
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
