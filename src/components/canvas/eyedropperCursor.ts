import { ICON_BODIES } from '../ui/icons'

// Pointer while Pick color from canvas is on (ticket 403): the design system's eyedropper, 32px, light halo, hot spot
// on the tip so the bead picked is the one the tip touches. A cursor image cannot read CSS custom properties, so the
// ink and halo are the icon file's own.
const SIZE = 32
const TIP = { x: 6, y: 25 }

const drawing = ICON_BODIES.eyedropper ?? ''
const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">` +
  `<g stroke="#fff" stroke-width="4.5">${drawing}</g><g stroke="#1f1f1f" stroke-width="1.75">${drawing}</g></svg>`

/** The image and its hot spot, for the app to draw itself where a CSS cursor is not shown (a hovering Pencil, ticket 546). */
export const EYEDROPPER_IMAGE = { url: `data:image/svg+xml,${encodeURIComponent(svg)}`, hotSpot: [TIP.x, TIP.y] as const, size: SIZE, tip: true }

/** The CSS `cursor` value: the image and its hot spot, falling back to a crosshair. */
export const EYEDROPPER_CURSOR = `url("${EYEDROPPER_IMAGE.url}") ${TIP.x} ${TIP.y}, crosshair`
