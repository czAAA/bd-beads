import { describe, expect, it } from 'vitest'
import { addWheel, leanOf, readies, scrolling, spend, turnDue, wheelPixels, type WheelGesture } from './wheelTurn'

/** A gesture of wheel events, each `[delta, time]`. */
function gesture(...wheels: [number, number][]): WheelGesture {
  return wheels.reduce<WheelGesture | undefined>((so, [delta, time]) => addWheel(so, { delta, time }), undefined)!
}

describe('a wheel gesture turning the Homepage on the second scroll (ticket 0793)', () => {
  it('does not turn a section on its first scroll, however far it goes', () => {
    expect(turnDue(gesture([400, 0], [400, 20]), undefined, -Infinity)).toBeUndefined()
  })

  it('readies the section to turn the way a scroll went, once it ends', () => {
    expect(readies(gesture([4, 0]))).toBe(1)
    expect(readies(gesture([-4, 0]))).toBe(-1)
  })

  it('turns on the next scroll the same way at once, however short it is', () => {
    expect(turnDue(gesture([4, 1000]), 1, -Infinity)).toEqual({ way: 1, at: 1000 })
    expect(turnDue(gesture([-4, 1000]), -1, -Infinity)).toEqual({ way: -1, at: 1000 })
  })

  it('does not turn on a scroll the other way: that one readies its own way instead', () => {
    expect(turnDue(gesture([-100, 1000]), 1, -Infinity)).toBeUndefined()
    expect(readies(gesture([-100, 1000]))).toBe(-1)
  })

  it('weighs a scroll back against the way it went', () => {
    expect(readies(gesture([100, 0], [-100, 30]))).toBeUndefined()
  })

  it('starts a new scroll after 300ms of quiet, so two notches far apart are two scrolls', () => {
    expect(gesture([100, 0], [100, 300]).start).toBe(300)
    expect(gesture([100, 0], [100, 299]).start).toBe(0)
  })

  it('waits 600ms after the last turn, so each section stays a moment', () => {
    expect(turnDue(gesture([4, 1000]), 1, 800)).toEqual({ way: 1, at: 1400 })
  })

  it('never turns on a scroll that scrolled something itself, but that scroll readies the next', () => {
    const inside = scrolling(gesture([100, 0]))
    expect(turnDue(inside, 1, -Infinity)).toBeUndefined()
    expect(readies(inside)).toBe(1)
  })

  it('turns once: the rest of a spent gesture, its momentum too, never turns again nor readies the next', () => {
    let momentum = spend(gesture([4, 0]))
    for (let time = 100; time <= 900; time += 100) momentum = addWheel(momentum, { delta: 400, time })
    expect(turnDue(momentum, 1, 0)).toBeUndefined()
    expect(readies(momentum)).toBeUndefined()
  })
})

describe('the section leaning with its first scroll (ticket 0793)', () => {
  it('leans 8px on the slightest scroll, up to 16px over a notch, up as the page goes down', () => {
    expect(leanOf(gesture([4, 0]))).toBe(-8)
    expect(leanOf(gesture([-75, 0]))).toBe(12)
    expect(leanOf(gesture([900, 0]))).toBe(-16)
  })

  it('stands straight once the gesture has turned the box or scrolled something itself, or with none', () => {
    expect(leanOf(spend(gesture([75, 0])))).toBe(0)
    expect(leanOf(scrolling(gesture([75, 0])))).toBe(0)
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
