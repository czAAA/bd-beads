import { ICON_BODIES } from '../ui/icons'

/**
 * The pointer while Pick color from canvas is on (ticket 403): the design system's eyedropper, 32px, with a light halo
 * so it reads on any bead, and its hot spot on the tip, so the bead picked is the one the tip touches. A cursor image
 * cannot read CSS custom properties, so the ink and halo are the icon file's own ink and white.
 */
const SIZE = 32
const TIP = { x: 6, y: 25 }

const drawing = ICON_BODIES.eyedropper ?? ''
const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">` +
  `<g stroke="#fff" stroke-width="4.5">${drawing}</g><g stroke="#1f1f1f" stroke-width="1.75">${drawing}</g></svg>`

/** The CSS `cursor` value: the image and its hot spot, falling back to a crosshair. */
export const EYEDROPPER_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${TIP.x} ${TIP.y}, crosshair`
