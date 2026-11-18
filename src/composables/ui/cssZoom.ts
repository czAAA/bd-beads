// On-screen px into an element's own under CSS `zoom` (ticket 1071). The browser gives a pointer's place and a box in
// on-screen px, which include the zoom of every ancestor; an element places its children in its own px, which the zoom
// enlarges again. The Homepage draws its demo larger this way; the editor is drawn at zoom 1, where both are the same.

/** The zoom `element` is drawn at, its ancestors' with its own; 1 where the browser can't tell or there is none. */
export function cssZoomOf(element: Element | null | undefined): number {
  const zoom = (element as (Element & { currentCSSZoom?: number }) | null | undefined)?.currentCSSZoom
  return typeof zoom === 'number' && zoom > 0 ? zoom : 1
}

/** A length on screen (a drag's step, a box's width) in `element`'s own px. */
export function ownLength(element: Element | null | undefined, onScreen: number): number {
  return onScreen / cssZoomOf(element)
}

/** Where a client point is from `element`'s top-left corner, in its own px. */
export function ownPoint(element: Element | null | undefined, point: { clientX: number; clientY: number }): { x: number; y: number } {
  const box = element?.getBoundingClientRect()
  const zoom = cssZoomOf(element)
  return { x: (point.clientX - (box?.left ?? 0)) / zoom, y: (point.clientY - (box?.top ?? 0)) / zoom }
}

/** The device's pixels to one of `element`'s own px: a canvas in it, drawn larger by the zoom, stays as sharp. */
export function pixelRatioOf(element: Element | null | undefined): number {
  return (globalThis.devicePixelRatio || 1) * cssZoomOf(element)
}
