import type { DrawingContext } from './beadLook'

// Small pictures kept to blit instead of redraw (ADR 0018): a Project has few looks and thousands of beads, and filling
// paths is costly. Made at screen-pixel size and blitted without smoothing (see renderProject) so they stay crisp.
export type Sprite = CanvasImageSource

const sprites = new Map<string, Sprite | null>()
const MAX_SPRITES = 512

// The picture for `key`, made by `draw` once and kept; undefined where there is no canvas. `draw`'s context is scaled
// so `size` fills `pixels`.
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
