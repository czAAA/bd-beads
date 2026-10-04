import type { Rotation } from './grid'

/** The four sides of a box, clockwise from the top. */
export type Side = 'top' | 'right' | 'bottom' | 'left'

const SIDES: Side[] = ['top', 'right', 'bottom', 'left']

export interface Box {
  left: number
  top: number
  right: number
  bottom: number
}

export type Stick = Record<Side, number>

/**
 * How far each side of the Project's box has scrolled out of view, in screen px (ticket 225): the distance each
 * ruler has to be carried inward to stay at its edge of the scroll area. A ruler is never carried past the far side
 * of its own gutter, so it stops at the opposite edge when the box is scrolled nearly out of view.
 */
export function stickDistances(box: Box, view: Box, gutterPx: number): Stick {
  const along = (past: number, length: number) => Math.min(Math.max(past, 0), Math.max(length - gutterPx, 0))
  const width = box.right - box.left
  const height = box.bottom - box.top
  return {
    top: along(view.top - box.top, height),
    bottom: along(box.bottom - view.bottom, height),
    left: along(view.left - box.left, width),
    right: along(box.right - view.right, width),
  }
}

/** The side of the screen a side of the Project faces once the Project is turned clockwise by `rotation`. */
export function screenSideOf(side: Side, rotation: Rotation): Side {
  return SIDES[(SIDES.indexOf(side) + rotation / 90) % 4]!
}
