import { describe, expect, it } from 'vitest'
import { scrollPosition, stepAnchors } from './scrollSteps'

describe('stepAnchors', () => {
  it('is where each step’s top meets the pane’s top', () => {
    expect(stepAnchors([0, 300, 700, 1200], 2000)).toEqual([0, 300, 700, 1200])
  })

  it('shares the last stretch of scroll out between the steps too short to reach the top (ConvertImage card)', () => {
    // The pane scrolls 1000 at most: the steps at 1100 and 1300 can never reach its top, so 700 to 1000 is shared out.
    expect(stepAnchors([0, 300, 700, 1100, 1300], 1000)).toEqual([0, 300, 700, 850, 1000])
  })

  it('puts a step that is just reached at the end of the scroll', () => {
    expect(stepAnchors([0, 400, 1000], 1000)).toEqual([0, 400, 1000])
  })

  it('stands every step at the top when the pane does not scroll', () => {
    expect(stepAnchors([0, 200, 400], 0)).toEqual([0, 0, 0])
  })
})

describe('scrollPosition', () => {
  const anchors = [0, 300, 700, 850, 1000]

  it('is the step whose anchor the scroll is on', () => {
    expect(scrollPosition(anchors, 0)).toBe(0)
    expect(scrollPosition(anchors, 300)).toBe(1)
    expect(scrollPosition(anchors, 1000)).toBe(4)
  })

  it('is between two steps in proportion while the scroll is between their anchors', () => {
    expect(scrollPosition(anchors, 150)).toBe(0.5)
    expect(scrollPosition(anchors, 400)).toBe(1.25)
    expect(scrollPosition(anchors, 925)).toBe(3.5)
  })

  it('holds to the first and the last step past the ends', () => {
    expect(scrollPosition(anchors, -20)).toBe(0)
    expect(scrollPosition(anchors, 1200)).toBe(4)
  })

  it('is the first step of any that stand at the same place', () => {
    expect(scrollPosition([0, 0, 0], 0)).toBe(0)
  })
})
