import { describe, expect, it } from 'vitest'
import { addWheel, leanOf, spend, turnDue, wheelPixels, type WheelGesture } from './wheelTurn'

/** A gesture of wheel events, each `[delta, time]`. */
function gesture(...wheels: [number, number][]): WheelGesture | undefined {
  return wheels.reduce<WheelGesture | undefined>((so, [delta, time]) => addWheel(so, { delta, time }), undefined)
}

describe('a wheel gesture turning the Homepage (ticket 0784)', () => {
  it('does not turn on a single notch', () => {
    expect(turnDue(gesture([100, 0]), -Infinity)).toBeUndefined()
  })

  it('turns down once it has scrolled 150px, but not before it has lasted 120ms', () => {
    expect(turnDue(gesture([100, 0], [100, 30]), -Infinity)).toEqual({ way: 1, at: 120 })
  })

  it('turns up the same way', () => {
    expect(turnDue(gesture([-80, 1000], [-80, 1016], [-80, 1200]), -Infinity)).toEqual({ way: -1, at: 1120 })
  })
  it('starts afresh after 300ms of quiet, so notches far apart never add up', () => {
    expect(turnDue(gesture([100, 0], [100, 300]), -Infinity)).toBeUndefined()
    expect(turnDue(gesture([100, 0], [100, 299]), -Infinity)).toEqual({ way: 1, at: 120 })
  })

  it('weighs a scroll back against the way it went', () => {
    expect(turnDue(gesture([100, 0], [100, 30], [-100, 60]), -Infinity)).toBeUndefined()
  })

  it('waits 600ms after the last turn, so each section stays a moment', () => {
    expect(turnDue(gesture([200, 1000]), 800)).toEqual({ way: 1, at: 1400 })
  })

  it('turns once: the rest of a spent gesture, its momentum too, never turns again', () => {
    // Momentum: a wheel every 100ms for most of a second after the turn at 120.
    let momentum = spend(gesture([200, 0])!)
    for (let time = 100; time <= 900; time += 100) momentum = addWheel(momentum, { delta: 400, time })
    expect(turnDue(momentum, 120)).toBeUndefined()
    // A new gesture after the quiet turns again.
    expect(turnDue(addWheel(momentum, { delta: 400, time: 1200 }), 120)).toEqual({ way: 1, at: 1320 })
  })
})

describe('the section leaning with a wheel gesture (ticket 0784)', () => {
  it('leans with the scroll, 16px at most, up as the page goes down', () => {
    expect(leanOf(gesture([75, 0]))).toBe(-8)
    expect(leanOf(gesture([-75, 0]))).toBe(8)
    expect(leanOf(gesture([900, 0]))).toBe(-16)
  })

  it('stands straight once the gesture has turned the box, or with none', () => {
    expect(leanOf(spend(gesture([75, 0])!))).toBe(0)
    expect(leanOf(undefined)).toBe(0)
  })
})

describe('a wheel event in px (ticket 0784)', () => {
  it('counts a line as a third of a notch and a page as the screen', () => {
    expect(wheelPixels({ deltaY: 3, deltaMode: 1 }, 800)).toBe(100)
    expect(wheelPixels({ deltaY: -1, deltaMode: 2 }, 800)).toBe(-800)
    expect(wheelPixels({ deltaY: 42, deltaMode: 0 }, 800)).toBe(42)
  })
})
