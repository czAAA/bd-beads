import { describe, expect, it } from 'vitest'
import { screenSideOf, stickDistances, type Box } from './rulerStick'

const box = (left: number, top: number, width: number, height: number): Box => ({
  left,
  top,
  right: left + width,
  bottom: top + height,
})

describe('stickDistances', () => {
  it('is zero while the whole box is inside the scroll area', () => {
    expect(stickDistances(box(10, 10, 300, 200), box(0, 0, 400, 400), 28)).toEqual({ top: 0, right: 0, bottom: 0, left: 0 })
  })

  it('is how far the box has scrolled past each edge', () => {
    const stick = stickDistances(box(-50, -30, 300, 200), box(0, 0, 100, 100), 28)
    expect(stick).toEqual({ top: 30, left: 50, bottom: 70, right: 150 })
  })

  it('never carries a ruler past the far side of its own gutter', () => {
    const stick = stickDistances(box(0, -500, 300, 200), box(0, 0, 300, 300), 28)
    expect(stick.top).toBe(172)
  })
})

describe('screenSideOf', () => {
  it('follows the pattern as it is turned clockwise', () => {
    expect(screenSideOf('top', 0)).toBe('top')
    expect(screenSideOf('top', 90)).toBe('right')
    expect(screenSideOf('left', 90)).toBe('top')
    expect(screenSideOf('bottom', 180)).toBe('top')
    expect(screenSideOf('top', 270)).toBe('left')
  })
})
