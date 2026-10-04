/**
 * Which part of a big Project a Drawing surface draws (ADR 0018). A Project at 300% zoom is thousands of px across,
 * far past what a canvas can be, so the surface is only as big as the screen (plus a margin) and is drawn again when
 * what is on screen moves out of what it holds. Everything here is in the displayed Project's px: zoomed, and turned
 * when the Project is rotated, measured from the top-left of its beads.
 */

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** The overlap of two rectangles, or undefined when they don't meet. */
export function intersect(a: Rect, b: Rect): Rect | undefined {
  const left = Math.max(a.x, b.x)
  const top = Math.max(a.y, b.y)
  const right = Math.min(a.x + a.width, b.x + b.width)
  const bottom = Math.min(a.y + a.height, b.y + b.height)
  return right > left && bottom > top ? { x: left, y: top, width: right - left, height: bottom - top } : undefined
}

/** Whether `inner` lies wholly inside `outer`. */
export function contains(outer: Rect, inner: Rect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  )
}

/**
 * The window of the displayed Project the surface should hold, given what is on screen: the visible part with a margin
 * on every side (so a little scrolling does not need a redraw), kept inside the Project and on whole px. Never bigger
 * than the Project itself, so a small Project gets a surface its own size and a big one costs what the screen does.
 */
export function drawingWindow(visible: Rect, extent: { width: number; height: number }, margin: number): Rect {
  const left = Math.max(0, Math.floor(visible.x - margin))
  const top = Math.max(0, Math.floor(visible.y - margin))
  const right = Math.min(Math.ceil(extent.width), Math.ceil(visible.x + visible.width + margin))
  const bottom = Math.min(Math.ceil(extent.height), Math.ceil(visible.y + visible.height + margin))
  return { x: left, y: top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) }
}
