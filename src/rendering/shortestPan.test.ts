import { describe, expect, it } from 'vitest'
import { shortestPan } from './shortestPan'

const room = { x: 0, y: 0, width: 1000, height: 800 }

describe('shortestPan (ticket 0934)', () => {
  it('moves nothing for a block already in the room', () => {
    expect(shortestPan({ x: 100, y: 100, width: 200, height: 60 }, room)).toEqual({ x: 0, y: 0 })
  })

  it('moves a block below the room up just far enough to sit on its bottom edge, and one above down to its top', () => {
    expect(shortestPan({ x: 100, y: 900, width: 200, height: 60 }, room)).toEqual({ x: 0, y: -160 })
    expect(shortestPan({ x: 100, y: -300, width: 200, height: 60 }, room)).toEqual({ x: 0, y: 300 })
  })

  it('moves a block too long for the room only until it fills it: a long row comes down, not along', () => {
    expect(shortestPan({ x: -1500, y: 1200, width: 4000, height: 60 }, room)).toEqual({ x: 0, y: -460 })
    // Where it leaves a gap at an end, it slides just far enough to close it.
    expect(shortestPan({ x: 300, y: 100, width: 4000, height: 60 }, room)).toEqual({ x: -300, y: 0 })
  })

  it('keeps to a room that starts off the screen\'s corner, as the Tool pill leaves it', () => {
    expect(shortestPan({ x: 10, y: 10, width: 50, height: 50 }, { x: 64, y: 0, width: 936, height: 800 })).toEqual({ x: 54, y: 0 })
  })
})
