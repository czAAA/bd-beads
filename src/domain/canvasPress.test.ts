import { describe, expect, it } from 'vitest'
import { pressBecomes, type CanvasPress, type CanvasPressStep } from './canvasPress'
import { DRAG_SLOP_PX } from './dragSlop'
import { HOLD_MS } from './hold'

/** What a press is after these steps, in order. */
function after(...steps: CanvasPressStep[]): CanvasPress | undefined {
  return steps.reduce<CanvasPress | undefined>(pressBecomes, undefined)
}

const RIGHT_DOWN: CanvasPressStep = { type: 'down', button: 2 }

describe('pressBecomes (spec 1072, the right button)', () => {
  it('waits when the right button goes down', () => {
    expect(after(RIGHT_DOWN)).toBe('waits')
  })

  it('still waits while the pointer has moved less than the drag slop', () => {
    expect(after(RIGHT_DOWN, { type: 'move', moved: DRAG_SLOP_PX - 0.5 })).toBe('waits')
  })

  it('is a pan once the pointer has moved the drag slop', () => {
    expect(after(RIGHT_DOWN, { type: 'move', moved: DRAG_SLOP_PX })).toBe('pan')
  })

  it('stays a pan when the pointer comes back to where it was pressed', () => {
    expect(after(RIGHT_DOWN, { type: 'move', moved: 20 }, { type: 'move', moved: 0 })).toBe('pan')
  })

  it('opens the ring when the button lifts before the pointer has moved the drag slop', () => {
    expect(after(RIGHT_DOWN, { type: 'lift' })).toBe('ring')
    expect(after(RIGHT_DOWN, { type: 'move', moved: 3 }, { type: 'lift' })).toBe('ring')
  })

  it('opens the ring once: a second lift is nothing', () => {
    expect(after(RIGHT_DOWN, { type: 'lift' }, { type: 'lift' })).toBe('nothing')
  })

  it('is nothing more when the button lifts after a pan', () => {
    expect(after(RIGHT_DOWN, { type: 'move', moved: 30 }, { type: 'lift' })).toBe('nothing')
  })

  it('does not decide a press of the left or the middle button', () => {
    for (const button of [0, 1]) {
      expect(after({ type: 'down', button })).toBeUndefined()
      expect(after({ type: 'down', button }, { type: 'move', moved: 30 })).toBeUndefined()
      expect(after({ type: 'down', button }, { type: 'lift' })).toBeUndefined()
    }
  })
})

/** A press of the main button by this pointer in this input mode. */
function down(pointerType: string, inputMode?: 'pen' | 'mouse'): CanvasPressStep {
  return { type: 'down', button: 0, pointerType, ...(inputMode ? { inputMode } : {}) }
}

const PEN_DOWN = down('pen', 'pen')
const HELD: CanvasPressStep = { type: 'time', held: HOLD_MS }

describe('pressBecomes (spec 1072, the drawing pointer\'s hold, ticket 1065)', () => {
  it('times a hold for the pointer that draws: the pen in Pen mode, the finger in Mouse mode', () => {
    expect(after(down('pen', 'pen'))).toBe('held')
    expect(after(down('touch', 'mouse'))).toBe('held')
  })

  it('never times the pointer that moves the Canvas: a finger in Pen mode (a resting palm), the pen in Mouse mode', () => {
    expect(after(down('touch', 'pen'), HELD)).toBeUndefined()
    expect(after(down('pen', 'mouse'), HELD)).toBeUndefined()
  })

  it('never times a mouse\'s left button, in either mode', () => {
    expect(after(down('mouse', 'mouse'), HELD)).toBeUndefined()
    expect(after(down('mouse', 'pen'), HELD)).toBeUndefined()
  })

  it('times a finger and a pen alike where no input mode is set', () => {
    expect(after(down('touch'))).toBe('held')
    expect(after(down('pen'))).toBe('held')
  })

  it('times the main button only', () => {
    expect(after({ type: 'down', button: 1, pointerType: 'pen', inputMode: 'pen' })).toBeUndefined()
  })

  it('opens the ring and slides once the press has been still for the hold\'s length', () => {
    expect(after(PEN_DOWN, { type: 'time', held: HOLD_MS - 1 })).toBe('held')
    expect(after(PEN_DOWN, HELD)).toBe('sliding')
    expect(after(PEN_DOWN, { type: 'move', moved: DRAG_SLOP_PX - 0.5 }, HELD)).toBe('sliding')
  })

  it('is a stroke as today once the pointer has moved the drag slop: the hold is off for good', () => {
    expect(after(PEN_DOWN, { type: 'move', moved: DRAG_SLOP_PX })).toBe('stroke')
    expect(after(PEN_DOWN, { type: 'move', moved: DRAG_SLOP_PX }, { type: 'move', moved: 0 }, HELD)).toBe('stroke')
  })

  it('is a stroke as today when a second finger lands (a pinch): the hold is off', () => {
    expect(after(down('touch', 'mouse'), { type: 'finger' }, HELD)).toBe('stroke')
  })

  it('is a tap as today when it lifts before the hold is up: nothing opens', () => {
    expect(after(PEN_DOWN, { type: 'lift' })).toBe('nothing')
    expect(after(PEN_DOWN, { type: 'lift' }, HELD)).toBe('nothing')
  })

  it('keeps sliding when a second finger lands after the ring opened', () => {
    expect(after(PEN_DOWN, HELD, { type: 'finger' })).toBe('sliding')
  })

  it('leaves the right button\'s press alone: time never opens its ring', () => {
    expect(after(RIGHT_DOWN, HELD)).toBe('waits')
  })
})

describe('pressBecomes (spec 1072, sliding, ticket 1077)', () => {
  const ARMED: CanvasPressStep[] = [PEN_DOWN, HELD, { type: 'move', moved: DRAG_SLOP_PX }]

  it('is armed once the pointer has moved the drag slop since the ring opened, and not before', () => {
    expect(after(PEN_DOWN, HELD, { type: 'move', moved: DRAG_SLOP_PX - 0.5 })).toBe('sliding')
    expect(after(...ARMED)).toBe('armed')
  })

  it('stays armed when the pointer comes back to where the ring opened, and when a second finger lands', () => {
    expect(after(...ARMED, { type: 'move', moved: 0 })).toBe('armed')
    expect(after(...ARMED, { type: 'finger' })).toBe('armed')
  })

  it('lifted not armed, the ring stays open: nothing is picked, whatever the pointer is over', () => {
    expect(after(PEN_DOWN, HELD, { type: 'lift' })).toBe('nothing')
    expect(after(PEN_DOWN, HELD, { type: 'lift', over: 'on' })).toBe('nothing')
    expect(after(PEN_DOWN, HELD, { type: 'lift', over: 'hole' })).toBe('nothing')
  })

  it('lifted armed on an item that is on, it picks it', () => {
    expect(after(...ARMED, { type: 'lift', over: 'on' })).toBe('pick')
  })

  it('lifted armed on an item that is off, the ring stays open', () => {
    expect(after(...ARMED, { type: 'lift', over: 'off' })).toBe('nothing')
  })

  it('lifted armed in the hole, the ring closes with nothing picked', () => {
    expect(after(...ARMED, { type: 'lift', over: 'hole' })).toBe('close')
  })

  it('an armed press that ends away from the ring (cancelled) leaves it as it is', () => {
    expect(after(...ARMED, { type: 'lift' })).toBe('nothing')
  })

  it('picks or closes once: a second lift is nothing', () => {
    expect(after(...ARMED, { type: 'lift', over: 'on' }, { type: 'lift', over: 'on' })).toBe('nothing')
    expect(after(...ARMED, { type: 'lift', over: 'hole' }, { type: 'lift', over: 'hole' })).toBe('nothing')
  })

  it('a mouse never slides: its right-button drag is the pan', () => {
    expect(after(RIGHT_DOWN, { type: 'move', moved: DRAG_SLOP_PX }, { type: 'lift', over: 'on' })).toBe('nothing')
  })
})
