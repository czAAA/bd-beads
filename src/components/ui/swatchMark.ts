import { BLACK_WHITE_BALANCE, fromHex, relativeLuminance } from '../../domain/color'

/** Which mark reads on a swatch (ticket 333): `dark` or `light`, whichever contrasts more with its hex; never looks
 * at the theme. */
export function markOn(swatch: string): 'dark' | 'light' {
  const rgb = fromHex(swatch)
  return rgb && relativeLuminance(rgb) > BLACK_WHITE_BALANCE ? 'dark' : 'light'
}
