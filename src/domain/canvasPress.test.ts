import { describe, expect, it } from 'vitest'
import { pressBecomes, type CanvasPress, type CanvasPressStep } from './canvasPress'
import { DRAG_SLOP_PX } from './dragSlop'

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
