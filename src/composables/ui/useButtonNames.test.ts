import { describe, expect, it } from 'vitest'
import { clearOfPlaced } from './useButtonNames'

// What the buttons do's bubbles step clear of each other (ticket 0927): away from their control, a few steps at most.
const box = { left: 0, top: 100, width: 50, height: 20 }

describe('clearOfPlaced (ticket 0927)', () => {
  it('keeps a bubble where it is when nothing is in its way', () => {
    expect(clearOfPlaced(box, [{ ...box, left: 60 }], true, 6)).toBe(100)
  })

  it('steps a bubble below its control down past the ones in its way, and one above it up', () => {
    const inWay = [box, { ...box, top: 126 }]
    expect(clearOfPlaced(box, inWay, true, 6)).toBe(152)
    expect(clearOfPlaced(box, inWay, false, 6)).toBe(74)
  })

  it('stops after its last step, so a crowd can not push it off the screen', () => {
    const crowd = [0, 1, 2, 3, 4].map((step) => ({ ...box, top: 100 + step * 26 }))
    expect(clearOfPlaced(box, crowd, true, 6, 2)).toBe(152)
  })
})
