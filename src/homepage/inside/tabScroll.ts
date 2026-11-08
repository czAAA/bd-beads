// What's inside's tabs (Homepage card, ticket 0825): one line that scrolls sideways, keeping the playing tab in view.

/** A stretch along the row of tabs, in its scroll coordinates. */
interface Stretch {
  left: number
  width: number
}

/** Where the row of tabs scrolls to so a tab shows whole, `room` clear of the edge it was past: where it is when the tab
 * already shows; a tab wider than the view shows from its start. Only the row scrolls, never the section round it. */
export function scrollToShow(view: Stretch, tab: Stretch, room: number): number {
  const before = tab.left - room
  const after = tab.left + tab.width + room - view.width
  if (before < view.left || tab.width + 2 * room > view.width) return Math.max(0, before)
  if (after > view.left) return after
  return view.left
}
