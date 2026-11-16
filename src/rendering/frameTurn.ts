import type { Box } from '../domain/weaveGeometry'

// Rotate Frame seen turning (ticket 1016; interaction-and-motion.md, Rotate Frame): the Frame as it was drawn turns a
// quarter clockwise about its middle over the Frame drawn turned, which shows once it has. Its CSS twin in
// design-values.css is held to this by frameTurn.test.ts.

/** How long the Frame is seen turning, in ms (`--frame-turn-duration`, on `--ease-standard`). */
export const FRAME_TURN_MS = 150

/** What one frame of the turn is drawn from: a copy of the beads' canvas as it was before the press, the Frame's box in
 * it and the box it lies in now, the paper under the Frame, how far the turn has gone (0 to 1, eased), and where the
 * canvas lies in the drawing area and at what density. */
export interface FrameTurnFrame {
  image: CanvasImageSource
  from: Box
  to: Box | undefined
  paper: string
  progress: number
  /** The canvas's first px in the drawing area, its bitmap px per drawing px, and its bitmap's size. */
  origin: { x: number; y: number }
  ratio: number
  bitmap: { width: number; height: number }
}

/** Draws one frame of the turn on a canvas laid as the beads' canvas is: the box the Frame lies in now covered with its
 * paper, so the Frame drawn turned is not seen twice, and the Frame as it was turned `progress` of a quarter about its
 * middle, which slides to the middle it has now. */
export function drawFrameTurn(context: CanvasRenderingContext2D, { image, from, to, paper, progress, origin, ratio, bitmap }: FrameTurnFrame): void {
  context.setTransform(1, 0, 0, 1, 0, 0)
  context.clearRect(0, 0, bitmap.width, bitmap.height)
  context.setTransform(ratio, 0, 0, ratio, -origin.x * ratio, -origin.y * ratio)
  if (to) {
    context.fillStyle = paper
    context.fillRect(to.x, to.y, to.width, to.height)
  }
  const end = to ?? from
  const middle = (box: Box) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 })
  const [was, now] = [middle(from), middle(end)]
  context.translate(was.x + (now.x - was.x) * progress, was.y + (now.y - was.y) * progress)
  context.rotate((progress * Math.PI) / 2)
  const source = { x: (from.x - origin.x) * ratio, y: (from.y - origin.y) * ratio, width: from.width * ratio, height: from.height * ratio }
  context.drawImage(image, source.x, source.y, source.width, source.height, -from.width / 2, -from.height / 2, from.width, from.height)
  context.setTransform(1, 0, 0, 1, 0, 0)
}
