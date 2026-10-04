import type { DrawingContext } from './beadLook'

/**
 * Small pictures kept so they can be blitted instead of drawn again (ADR 0018): a Project has a handful of looks and
 * thousands of beads, and blitting a bitmap is many times cheaper than filling its shapes for every bead — filling a
 * path is the most expensive thing a canvas does. A bitmap is made at the size it is on the screen's own pixels, so it
 * stays crisp, and is blitted without smoothing (see renderProject), so it is never blurred by landing between pixels.
 */
export type Sprite = CanvasImageSource

const sprites = new Map<string, Sprite | null>()
const MAX_SPRITES = 512

/**
 * The picture for `key`, made by `draw` the first time and kept, or undefined where there is no canvas to make one on.
 * `draw` is given a context already scaled so that `size` units across fill the bitmap, which is `pixels` wide.
 */
export function cachedSprite(
  key: string,
  pixels: number,
  size: number,
  draw: (context: DrawingContext) => void,
): Sprite | undefined {
  if (typeof document === 'undefined') {
    return undefined
  }

  let sprite = sprites.get(key)
  if (sprite === undefined) {
    if (sprites.size >= MAX_SPRITES) {
      sprites.clear()
    }
    const canvas = document.createElement('canvas')
    canvas.width = pixels
    canvas.height = pixels
    const context = canvas.getContext('2d')
    if (context) {
      const scale = pixels / size
      context.setTransform(scale, 0, 0, scale, 0, 0)
      draw(context)
    }
    sprite = context ? canvas : null
    sprites.set(key, sprite)
  }
  return sprite ?? undefined
}
