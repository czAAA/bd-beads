import { describe, expect, it } from 'vitest'
import { nearestQuarterTurn, settledOrientation, turnedOrientation, tiltOf } from './canvasOrientation'

describe('the Canvas orientation (ticket 0672)', () => {
  it('turns by any angle, kept within one turn clockwise from upright', () => {
    expect(turnedOrientation(0, 30)).toBe(30)
    expect(turnedOrientation(350, 20)).toBe(10)
    expect(turnedOrientation(10, -25)).toBe(345)
    expect(turnedOrientation(270, 90)).toBe(0)
    expect(turnedOrientation(30, 720)).toBe(30)
  })

  it('reads as the quarter turn it is nearest, which exports, sizes as seen and Row direction go by', () => {
    expect(nearestQuarterTurn(0)).toBe(0)
    expect(nearestQuarterTurn(30)).toBe(0)
    expect(nearestQuarterTurn(50)).toBe(90)
    expect(nearestQuarterTurn(200)).toBe(180)
    expect(nearestQuarterTurn(300)).toBe(270)
    expect(nearestQuarterTurn(340)).toBe(0)
  })

  it('leans off that quarter turn by under half of one, either way', () => {
    expect(tiltOf(90)).toBe(0)
    expect(tiltOf(30)).toBe(30)
    expect(tiltOf(50)).toBe(-40)
    expect(tiltOf(340)).toBe(-20)
  })

  it('snaps to a quarter turn within 10° of it when the fingers lift, and stays put further off', () => {
    expect(settledOrientation(8)).toBe(0)
    expect(settledOrientation(352)).toBe(0)
    expect(settledOrientation(98)).toBe(90)
    expect(settledOrientation(262)).toBe(270)
    expect(settledOrientation(15)).toBe(15)
    expect(settledOrientation(135)).toBe(135)
  })
})
