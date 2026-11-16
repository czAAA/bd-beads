/** The converter page's four layouts (ConvertImage card DS-4, ticket 0911), chosen from the page's own size. */
export type ConvertLayout = 'phone' | 'tablet' | 'side' | 'desktop'

/** From this page width a portrait page is a Tablet, not a Phone. */
const CONVERT_TABLET_MIN = 600
/** From this page width a landscape page is the Desktop's (DS-1). */
const CONVERT_DESKTOP_MIN = 1024

/** The layout for a page of this size; a square page is landscape. With no size yet it is the Desktop's, as in a test. */
export function convertLayoutFor(width: number, height: number): ConvertLayout {
  if (!(width > 0) || !(height > 0)) return 'desktop'
  if (width >= height) return width >= CONVERT_DESKTOP_MIN ? 'desktop' : 'side'
  return width >= CONVERT_TABLET_MIN ? 'tablet' : 'phone'
}
