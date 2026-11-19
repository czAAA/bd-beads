import { describe, expect, it } from 'vitest'
import { RECORDED_FOUR_SWIPES, RECORDED_ONE_SWIPE, lumped, trackpadSwipes } from '../testUtils/trackpad'
import { TURN_REST, addWheel, scrolling, spend, turnDue, wheelPixels, type Wheel, type WheelGesture } from './wheelTurn'

/** A gesture of wheel events, each `[delta, time]`. */
function gesture(...wheels: [number, number][]): WheelGesture {
  return wheels.reduce<WheelGesture | undefined>((so, [delta, time]) => addWheel(so, { delta, time }), undefined)!
}

/** When each scroll in the wheels begins, in ms: a scroll turns on its first event, so its gesture is spent at once. */
function scrolls(wheels: Wheel[]): number[] {
  const starts: number[] = []
  let so: WheelGesture | undefined
  for (const wheel of wheels) {
    so = addWheel(so, wheel)
    if (so.spent) continue
    starts.push(wheel.time)
    so = spend(so)
  }
  return starts
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

  it('starts a new scroll the other way at once', () => {
    const turned = spend(gesture([60, 0], [50, 20]))
    expect(turnDue(addWheel(turned, { delta: -4, time: 40 }), -Infinity)).toEqual({ way: -1, at: 40 })
  })

  it('starts a new scroll the other way at once after one that scrolled a section', () => {
    const scrolled = scrolling(gesture([60, 0], [50, 20]))
    expect(turnDue(addWheel(scrolled, { delta: -4, time: 40 }), -Infinity)).toEqual({ way: -1, at: 40 })
  })

  it('starts a new scroll after a 300ms quiet', () => {
    expect(addWheel(spend(gesture([60, 0])), { delta: 4, time: 300 }).spent).toBe(false)
  })
})

/** A swipe and the next one, by strength: alike, a gentle one after a firm one, after a flick, a firm one after a gentle. */
const PAIRS = [[1, 1], [1, 0.3], [3, 1], [0.3, 2]] as const

describe('a trackpad\'s next swipe inside the last one\'s momentum (tickets 1116, 1131)', () => {
  it('counts a scroll a swipe on swipes recorded from a MacBook trackpad in Safari', () => {
    expect(scrolls(RECORDED_FOUR_SWIPES)).toHaveLength(4)
    expect(scrolls(RECORDED_ONE_SWIPE)).toEqual([0])
  })

  it('is one scroll while it is one swipe, however strong, its momentum and all', () => {
    for (const strength of [0.15, 0.3, 1, 3, 5]) expect(scrolls(trackpadSwipes({ at: 0, strength }))).toEqual([0])
  })

  it('is one scroll still when a busy page lumps its wheel events', () => {
    expect(scrolls(lumped(trackpadSwipes({ at: 0 }), 7, 3))).toEqual([0])
    expect(scrolls(lumped(trackpadSwipes({ at: 0 }), 11, 5))).toEqual([0])
    expect(scrolls(lumped(trackpadSwipes({ at: 0, strength: 3 }), 9, 4))).toEqual([0])
  })

  it.each([700, 800, 1200])('starts a new scroll on a swipe begun %ims in, gentle or strong, never quiet for 300ms', (at) => {
    for (const [first, next] of PAIRS) {
      expect(scrolls(trackpadSwipes({ at: 0, strength: first }, { at, strength: next })), `${first} then ${next}`).toHaveLength(2)
    }
  })

  it.each([250, 500])('starts it once the turn has stood its while, on a swipe begun %ims in', (at) => {
    for (const [first, next] of PAIRS) {
      const [, second, ...more] = scrolls(trackpadSwipes({ at: 0, strength: first }, { at, strength: next }))
      expect(second, `${first} then ${next}`).toBeGreaterThanOrEqual(TURN_REST)
      // On the first events once the while is over, not a swipe later.
      expect(second).toBeLessThan(TURN_REST + 40)
      expect(more).toEqual([])
    }
  })

  it('counts a scroll a swipe, swipe after swipe, also on a busy page', () => {
    const three = trackpadSwipes({ at: 0 }, { at: 900 }, { at: 1800 })
    expect(scrolls(three)).toHaveLength(3)
    expect(scrolls(lumped(three, 7, 3))).toHaveLength(3)
  })

  it('starts a new scroll on the next swipe after one that scrolled a section, which turns', () => {
    const [first, ...rest] = trackpadSwipes({ at: 0 }, { at: 900 })
    const so = rest.reduce((gesture, wheel) => (gesture.scrolled ? addWheel(gesture, wheel) : gesture), scrolling(addWheel(undefined, first!)))
    expect(so.scrolled).toBe(false)
    expect(turnDue(so, -Infinity)?.way).toBe(1)
  })

  it('leaves a mouse wheel rolled notch after notch one scroll until it rests', () => {
    expect(scrolls(Array.from({ length: 20 }, (_, notch) => ({ delta: 100, time: notch * 150 })))).toEqual([0])
  })
})

describe('a wheel event in px (ticket 0784)', () => {
  it('counts a line as a third of a notch and a page as the screen', () => {
    expect(wheelPixels({ deltaY: 3, deltaMode: 1 }, 800)).toBe(100)
    expect(wheelPixels({ deltaY: -1, deltaMode: 2 }, 800)).toBe(-800)
    expect(wheelPixels({ deltaY: 42, deltaMode: 0 }, 800)).toBe(42)
  })
})
