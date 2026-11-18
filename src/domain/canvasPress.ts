import { DRAG_SLOP_PX } from './dragSlop'
import { HOLD_MS } from './hold'
import { pointerDraws, type InputMode } from './inputMode'

/** What a press on the Canvas is so far (spec 1072, "what a press becomes"). The right button `waits` to be told a
 * click from a drag, is a `pan` until it lifts, or was a click that opens the `ring` (the Radial toolbox, ticket 1064).
 * The drawing pointer is `held` while its hold is timed (ticket 1065), a `stroke` as today once the hold is off, or
 * `sliding`: the hold opened the ring and the pointer is still down. `nothing`: over, with no more for this rule to do. */
export type CanvasPress = 'waits' | 'pan' | 'ring' | 'nothing' | 'held' | 'stroke' | 'sliding'

/** What happens to a press: its button goes down (with the pointer's kind and the input mode, for a press that may be
 * a hold), its pointer is `moved` px (on screen) from where it went down, it has been `held` this many ms, a second
 * `finger` lands (a pinch), or its button lifts. */
export type CanvasPressStep =
  | { type: 'down'; button: number; pointerType?: string; inputMode?: InputMode }
  | { type: 'move'; moved: number }
  | { type: 'time'; held: number }
  | { type: 'finger' }
  | { type: 'lift' }

/** The mouse's right button, which a pen's barrel button reports too. */
const RIGHT_BUTTON = 2

/** Whether a press may be a hold (ticket 1065): the main button of a finger or a pen that draws in the input mode.
 * Never a mouse, whose right click opens the ring, nor the pointer that moves the Canvas (a resting palm in Pen mode). */
function timesHold(step: Extract<CanvasPressStep, { type: 'down' }>): boolean {
  const onGlass = step.pointerType === 'touch' || step.pointerType === 'pen'
  return step.button === 0 && onGlass && (step.inputMode === undefined || pointerDraws(step.inputMode, step.pointerType ?? ''))
}

/** What a press becomes at each step (tickets 1074, 1064, 1065; ADR 0098). The right button waits; moved `DRAG_SLOP_PX`
 * it pans until it lifts; lifted before that it opens the ring. The drawing pointer is held; moved `DRAG_SLOP_PX` or
 * joined by a second finger it is a stroke; still for `HOLD_MS` it opens the ring and slides. None for a press this
 * rule does not decide: a mouse's other buttons, the pointer that moves the Canvas. */
export function pressBecomes(press: CanvasPress, step: Exclude<CanvasPressStep, { type: 'down' }>): CanvasPress
export function pressBecomes(press: CanvasPress | undefined, step: CanvasPressStep): CanvasPress | undefined
export function pressBecomes(press: CanvasPress | undefined, step: CanvasPressStep): CanvasPress | undefined {
  if (step.type === 'down') return step.button === RIGHT_BUTTON ? 'waits' : timesHold(step) ? 'held' : undefined
  if (press === undefined) return undefined
  if (step.type === 'lift') return press === 'waits' ? 'ring' : 'nothing'
  if (step.type === 'finger') return press === 'held' ? 'stroke' : press
  if (step.type === 'time') return press === 'held' && step.held >= HOLD_MS ? 'sliding' : press
  if (step.moved < DRAG_SLOP_PX) return press
  return press === 'waits' ? 'pan' : press === 'held' ? 'stroke' : press
}
