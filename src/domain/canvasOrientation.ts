import type { Rotation } from './grid'

// The Canvas's orientation (ADR 0052, ADR 0079, ticket 0672): degrees clockwise, any angle on touch, quarter turns from
// the Rotate canvas button. What is drawn turned by quarters (exports, sizes as seen, Row direction) reads the quarter
// turn it is nearest; only the view on screen leans off it.

/** How near a quarter turn a twist must end to snap onto it (ADR 0079: about 10°). */
const SNAP_DEGREES = 10

/** An angle in degrees as the Canvas holds it: from 0 up to a whole turn, clockwise. */
export function normalizedOrientation(degrees: number): number {
  const turned = ((degrees % 360) + 360) % 360
  // Float noise from adding up a twist's steps is no angle: 359.9999999 is upright.
  const rounded = Math.round(turned * 1e6) / 1e6
  return rounded === 360 ? 0 : rounded
}

/** The Canvas's orientation turned further by `by` degrees clockwise (counter-clockwise when negative). */
export function turnedOrientation(orientation: number, by: number): number {
  return normalizedOrientation(orientation + by)
}

/** The quarter turn an orientation is nearest: how the Canvas is drawn, exported and measured as seen. */
export function nearestQuarterTurn(orientation: number): Rotation {
  return ((Math.round(normalizedOrientation(orientation) / 90) * 90) % 360) as Rotation
}

/** How far an orientation leans off its nearest quarter turn, in degrees: under 45 either way, clockwise positive. */
export function tiltOf(orientation: number): number {
  const lean = normalizedOrientation(orientation) - nearestQuarterTurn(orientation)
  return lean > 180 ? lean - 360 : lean
}

/** Where a twist comes to rest as the fingers lift: on its nearest quarter turn when within about 10° of it. */
export function settledOrientation(orientation: number): number {
  return Math.abs(tiltOf(orientation)) <= SNAP_DEGREES ? nearestQuarterTurn(orientation) : normalizedOrientation(orientation)
}
