/** The WCAG relative luminance of a `#rrggbb` color. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const channel = parseInt(hex.slice(i, i + 2), 16) / 255
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light! + 0.05) / (dark! + 0.05)
}

/**
 * Which of the theme's two marks reads on a swatch of this color (ticket 333): `ink` or `canvas`, whichever has more
 * contrast with it. `ink` and `canvas` are the hexes those tokens have in the theme being drawn.
 */
export function markOn(swatch: string, ink: string, canvas: string): 'ink' | 'canvas' {
  return contrast(swatch, canvas) > contrast(swatch, ink) ? 'canvas' : 'ink'
}
