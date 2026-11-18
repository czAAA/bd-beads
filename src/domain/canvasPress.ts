import { DRAG_SLOP_PX } from './dragSlop'

/** What a press on the Canvas is so far (spec 1072, "what a press becomes"): it `waits` to be told a click from a
 * drag, it is a `pan` until its button lifts, or it is `nothing`, over with no work done. */
export type CanvasPress = 'waits' | 'pan' | 'nothing'

/** What happens to a press: its button goes down, its pointer is `moved` px (on screen) from where it went down, or
 * its button lifts. */
export type CanvasPressStep = { type: 'down'; button: number } | { type: 'move'; moved: number } | { type: 'lift' }

/** The mouse's right button, which a pen's barrel button reports too. */
const RIGHT_BUTTON = 2

/** What a press becomes at each step (ticket 1074, ADR 0098): the right button waits; moved `DRAG_SLOP_PX` it pans
 * until it lifts; lifted before that it does nothing. None for a press this rule does not decide: every other button. */
export function pressBecomes(press: CanvasPress, step: Exclude<CanvasPressStep, { type: 'down' }>): CanvasPress
export function pressBecomes(press: CanvasPress | undefined, step: CanvasPressStep): CanvasPress | undefined
export function pressBecomes(press: CanvasPress | undefined, step: CanvasPressStep): CanvasPress | undefined {
  if (step.type === 'down') return step.button === RIGHT_BUTTON ? 'waits' : undefined
  if (press === undefined) return undefined
  if (step.type === 'lift') return 'nothing'
  return press === 'waits' && step.moved >= DRAG_SLOP_PX ? 'pan' : press
}
