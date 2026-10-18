/** The WCAG relative luminance of a `#rrggbb` color. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const channel = parseInt(hex.slice(i, i + 2), 16) / 255
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}

/** The luminance where black and white have the same contrast ratio with a color: sqrt(1.05 * 0.05) - 0.05. */
const BLACK_WHITE_BALANCE = 0.1791

/** Which mark reads on a swatch (ticket 333): `dark` or `light`, whichever contrasts more with its hex; never looks
 * at the theme. */
export function markOn(swatch: string): 'dark' | 'light' {
  return luminance(swatch) > BLACK_WHITE_BALANCE ? 'dark' : 'light'
}
