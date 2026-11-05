import { describe, expect, it } from 'vitest'
import { addWheel, scrolling, spend, turnDue, wheelPixels, type WheelGesture } from './wheelTurn'

/** A gesture of wheel events, each `[delta, time]`. */
function gesture(...wheels: [number, number][]): WheelGesture {
  return wheels.reduce<WheelGesture | undefined>((so, [delta, time]) => addWheel(so, { delta, time }), undefined)!
}

describe('a wheel gesture turning the Homepage (tickets 0784, 0801)', () => {
  it('turns on its first scroll, however short, the way it went', () => {
    expect(turnDue(gesture([4, 1000]), -Infinity)).toEqual({ way: 1, at: 1000 })
    expect(turnDue(gesture([-4, 1000]), -Infinity)).toEqual({ way: -1, at: 1000 })
  })

  it('waits 600ms after the last turn, so each section stays a moment', () => {
    expect(turnDue(gesture([4, 1000]), 800)).toEqual({ way: 1, at: 1400 })
  })

  it('weighs a scroll back against the way it went', () => {
    expect(turnDue(gesture([100, 0], [-100, 30]), -Infinity)).toBeUndefined()
  })

  it('never turns on a scroll that scrolled something itself', () => {
    expect(turnDue(scrolling(gesture([100, 0])), -Infinity)).toBeUndefined()
  })

  it('turns once: the rest of a spent gesture, its fading momentum, never turns again', () => {
    let momentum = spend(gesture([60, 0]))
    for (let time = 20, delta = 58; time <= 1500; time += 20, delta *= 0.97) momentum = addWheel(momentum, { delta, time })
    expect(momentum.spent).toBe(true)
    expect(turnDue(momentum, 0)).toBeUndefined()
  })

  it('starts a new scroll inside the momentum on a fresh push, once the turn has stood its while', () => {
    /** A turn's momentum fading to 8px an event by `until`. */
    const fadingUntil = (until: number) => {
      let momentum = spend(gesture([60, 0]))
      for (let time = 20; time <= until; time += 20) momentum = addWheel(momentum, { delta: time === until ? 8 : 30, time })
      return momentum
    }
    expect(addWheel(fadingUntil(700), { delta: 40, time: 720 }).spent).toBe(false)
    // Before the turn's while, or a push no stronger than the fade, is still the old scroll.
    expect(addWheel(fadingUntil(300), { delta: 40, time: 320 }).spent).toBe(true)
    expect(addWheel(fadingUntil(700), { delta: 12, time: 720 }).spent).toBe(true)
  })

  it('starts a new scroll the other way at once', () => {
    const turned = spend(gesture([60, 0], [50, 20]))
    expect(turnDue(addWheel(turned, { delta: -4, time: 40 }), -Infinity)).toEqual({ way: -1, at: 40 })
  })

  it('starts a new scroll after a 300ms quiet', () => {
    expect(addWheel(spend(gesture([60, 0])), { delta: 4, time: 300 }).spent).toBe(false)
  })
})

describe('a wheel event in px (ticket 0784)', () => {
  it('counts a line as a third of a notch and a page as the screen', () => {
    expect(wheelPixels({ deltaY: 3, deltaMode: 1 }, 800)).toBe(100)
    expect(wheelPixels({ deltaY: -1, deltaMode: 2 }, 800)).toBe(-800)
    expect(wheelPixels({ deltaY: 42, deltaMode: 0 }, 800)).toBe(42)
  })
})
