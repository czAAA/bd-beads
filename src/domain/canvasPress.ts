import { DRAG_SLOP_PX } from './dragSlop'
import { HOLD_MS } from './hold'
import { pointerDraws, type InputMode } from './inputMode'

/** What a press on the Canvas is so far (spec 1072, "what a press becomes"). The right button: */
type RightPress =
  /** it has not yet told a click from a drag, */
  | 'waits'
  /** it moves the Canvas until it lifts, */
  | 'pan'
  /** or it was a click, which opens the Radial toolbox where it was pressed (ticket 1064). */
  | 'ring'

/** The drawing pointer (ticket 1065): */
type HeldPress =
  /** its hold is being timed while its tool has started, */
  | 'held'
  /** the hold is off and the press is a stroke as today, */
  | 'stroke'
  /** the hold opened the ring and the pointer is still down, */
  | 'sliding'
  /** or it has since moved far enough for its lift to mean the place it lifts over (ticket 1077). */
  | 'armed'

/** What an armed lift does to the ring (ticket 1077): it picks the item it is over, or closes the ring. */
type SlideLift = 'pick' | 'close'

/** What a press is so far; `nothing` once it is over, with no more for this rule to do. */
export type CanvasPress = RightPress | HeldPress | SlideLift | 'nothing'

/** What a sliding pointer is over, by the ring's rule: an item that is `on`, one that is `off`, or the `hole`. */
type RingPart = 'on' | 'off' | 'hole'

/** What happens to a press: its button goes down (with the pointer's kind and the input mode, for a hold), its pointer
 * is `moved` px (on screen) from where it went down or, sliding, from where it was when the ring opened, it has been
 * `held` this many ms, a second `finger` lands (a pinch), or its button lifts, `over` this part of the open ring. */
export type CanvasPressStep =
  | { type: 'down'; button: number; pointerType?: string; inputMode?: InputMode }
  | { type: 'move'; moved: number }
  | { type: 'time'; held: number }
  | { type: 'finger' }
  | { type: 'lift'; over?: RingPart }

/** The mouse's right button, which a pen's barrel button reports too. */
const RIGHT_BUTTON = 2

/** Whether a press may be a hold (ticket 1065): the main button of a finger or a pen that draws in the input mode.
 * Never a mouse, whose right click opens the ring, nor the pointer that moves the Canvas (a resting palm in Pen mode). */
function timesHold(step: Extract<CanvasPressStep, { type: 'down' }>): boolean {
  const onGlass = step.pointerType === 'touch' || step.pointerType === 'pen'
  return step.button === 0 && onGlass && (step.inputMode === undefined || pointerDraws(step.inputMode, step.pointerType ?? ''))
}

/** What an armed lift does: over an item that is on it picks it, in the hole it closes the ring, and over an item that
 * is off (or told no part) the ring stays as it is. */
function armedLift(over: RingPart | undefined): CanvasPress {
  return over === 'on' ? 'pick' : over === 'hole' ? 'close' : 'nothing'
}

/** What a press becomes at each step (tickets 1074, 1064, 1065, 1077; ADR 0098). The right button waits, pans once
 * moved `DRAG_SLOP_PX`, or opens the ring at its lift. The drawing pointer is held: moved as far or joined by a finger
 * it is a stroke, still for `HOLD_MS` it slides, armed once moved as far again. None for a press it does not decide. */
export function pressBecomes(press: CanvasPress, step: Exclude<CanvasPressStep, { type: 'down' }>): CanvasPress
export function pressBecomes(press: CanvasPress | undefined, step: CanvasPressStep): CanvasPress | undefined
export function pressBecomes(press: CanvasPress | undefined, step: CanvasPressStep): CanvasPress | undefined {
  if (step.type === 'down') return step.button === RIGHT_BUTTON ? 'waits' : timesHold(step) ? 'held' : undefined
  if (press === undefined) return undefined
  if (step.type === 'lift') return press === 'waits' ? 'ring' : press === 'armed' ? armedLift(step.over) : 'nothing'
  if (step.type === 'finger') return press === 'held' ? 'stroke' : press
  if (step.type === 'time') return press === 'held' && step.held >= HOLD_MS ? 'sliding' : press
  if (step.moved < DRAG_SLOP_PX) return press
  return press === 'waits' ? 'pan' : press === 'held' ? 'stroke' : press === 'sliding' ? 'armed' : press
}
