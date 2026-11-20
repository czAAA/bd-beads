import { BLACK_WHITE_BALANCE, channelsOf, mix, relativeLuminance, toHex, WHITE } from '../domain/color'

// The piece's ground (BeadBoard card): what lies between round beads (Open weave), from which the bead look parts a pale
// round bead (ticket 1037).

/** How far toward white the piece's ground is from the Background. */
const GROUND_TOWARD_WHITE = { dark: 0.05, light: 0.8 }

/** The look a Background is drawn in: dark on a dark one, light on a light one (canvasBackgrounds.ts's rule). */
export function lookSideOf(background: string): 'dark' | 'light' {
  return relativeLuminance(channelsOf(background)) < BLACK_WHITE_BALANCE ? 'dark' : 'light'
}

/** The piece's ground on `background`: the Background 5% toward white in the dark look, 80% in the light look. */
export function pieceGroundOf(background: string): string {
  return toHex(mix(channelsOf(background), WHITE, GROUND_TOWARD_WHITE[lookSideOf(background)]))
}
