import { vi } from 'vitest'
import type { BeadDrawer, BeadShape, DrawingContext } from '../rendering/beadLook'

/**
 * A stand-in for a canvas, for tests of components that draw with the Project renderer: jsdom has no real canvas, so
 * they would otherwise draw nothing at all. Installs a fake 2D context on every canvas, and hands back a bead drawer to
 * give the component as its `drawBead` prop — what a test asserts on is which beads were drawn, and it is the drawer
 * that is told (see the renderer's BeadDrawer). Each render starts with the renderer clearing the surface, which is how
 * one render is told from the next.
 */
export function installFakeCanvas(): {
  drawBead: BeadDrawer
  /** The beads of the most recent render, in the order they were drawn. */
  latest: () => BeadShape[]
  /** How many times the surface has been drawn. */
  renders: () => number
} {
  const renders: BeadShape[][] = []
  const context: DrawingContext = {
    save: () => undefined,
    restore: () => undefined,
    setTransform: () => undefined,
    clearRect: () => {
      renders.push([])
    },
    fillRect: () => undefined,
    beginPath: () => undefined,
    rect: () => undefined,
    clip: () => undefined,
    moveTo: () => undefined,
    lineTo: () => undefined,
    arcTo: () => undefined,
    arc: () => undefined,
    fillText: () => undefined,
    translate: () => undefined,
    rotate: () => undefined,
    font: '',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    roundRect: () => undefined,
    drawImage: () => undefined,
    createPattern: () => null,
    imageSmoothingEnabled: true,
    closePath: () => undefined,
    fill: () => undefined,
    fillStyle: '#000000',
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    stroke: () => undefined,
    strokeStyle: '#000000',
    lineWidth: 1,
    lineCap: 'butt',
    setLineDash: () => undefined,
  }
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D)

  return {
    drawBead: (_context, bead) => {
      renders.at(-1)!.push(bead)
    },
    latest: () => renders.at(-1) ?? [],
    renders: () => renders.length,
  }
}
