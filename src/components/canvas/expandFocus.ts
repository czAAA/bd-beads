import type { FrameId } from '../../domain/grid'

// Expand the Frame and Back to the Canvas are one control in two places (ticket 1260): the keyboard goes with it from
// the expanded rails back to the Frame's sheet, which takes it once it is shown.
let waiting: FrameId | undefined

/** The rails of this Frame are going while they held the focus. */
export function handBackExpandFocus(frame: FrameId): void {
  waiting = frame
}

/** Whether this Frame's sheet is to take the focus back; asked once. */
export function takeExpandFocus(frame: FrameId): boolean {
  if (waiting !== frame) return false
  waiting = undefined
  return true
}
