import type { WritingHand } from '../../domain/inputMode'
import type { Region, Scroll } from '../../rendering/surfaceView'

/** How far, up and to the side away from the Writing hand, a hovering Pencil's Tool pointer stays from the tip at
 * least, in px on each side (about 16px on the diagonal): clear of the Pencil's own tip and barrel. */
export const PEN_POINTER_CLEARANCE_PX = 11

/** A Tool pointer's image as the app draws it: its hot spot, its square size and whether it points with a tip (Paint,
 * Erase, Fill, the eyedropper) or does not (Select, Hand, Piece). */
export interface PenPointerImage {
  hotSpot: readonly [number, number]
  size: number
  tip: boolean
}

/** Where a hovering Pencil's Tool pointer image goes (its top-left), clear of the Pencil and the hand (ticket 548): at the
 * bead's top corner away from the Writing hand, at least the clearance from the tip (no bead: the clearance alone). A
 * tool that points has its hot spot there; one that does not is drawn whole beyond it. */
export function penPointerAt(tip: Scroll, bead: Region | undefined, image: PenPointerImage, hand: WritingHand): Scroll {
  const left = hand === 'left'
  const side = left ? 1 : -1
  const corner = bead ? { x: left ? bead.x + bead.width : bead.x, y: bead.y } : tip
  const anchor = {
    x: tip.x + side * Math.max(side * (corner.x - tip.x), PEN_POINTER_CLEARANCE_PX),
    y: tip.y - Math.max(tip.y - corner.y, PEN_POINTER_CLEARANCE_PX),
  }
  if (image.tip) return { x: anchor.x - image.hotSpot[0], y: anchor.y - image.hotSpot[1] }
  return { x: left ? anchor.x : anchor.x - image.size, y: anchor.y - image.size }
}
