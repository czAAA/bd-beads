import { describe, expect, it } from 'vitest'
import { PEN_POINTER_CLEARANCE_PX, penPointerAt } from './penPointer'

const paint = { hotSpot: [5, 19] as const, size: 24, tip: true }
const select = { hotSpot: [4, 3] as const, size: 24, tip: false }
const C = PEN_POINTER_CLEARANCE_PX

describe('penPointerAt', () => {
  const bead = { x: 100, y: 40, width: 40, height: 40 }
  const tip = { x: 125, y: 62 }

  it('puts a pointing tool\'s hot spot on the bead\'s top-left corner for a right hand', () => {
    expect(penPointerAt(tip, bead, paint, 'right')).toEqual({ x: 100 - 5, y: 40 - 19 })
  })

  it('puts it on the top-right corner for a left hand', () => {
    expect(penPointerAt(tip, bead, paint, 'left')).toEqual({ x: 140 - 5, y: 40 - 19 })
  })

  it('jumps bead by bead: anywhere on one bead it stands at the same corner', () => {
    expect(penPointerAt({ x: 120, y: 75 }, bead, paint, 'right')).toEqual(penPointerAt(tip, bead, paint, 'right'))
  })

  it('keeps the hot spot the clearance from the tip on a bead too small to clear the Pencil', () => {
    const small = { x: 100, y: 40, width: 4, height: 4 }
    expect(penPointerAt({ x: 102, y: 42 }, small, paint, 'right')).toEqual({ x: 102 - C - 5, y: 42 - C - 19 })
    expect(penPointerAt({ x: 102, y: 42 }, small, paint, 'left')).toEqual({ x: 102 + C - 5, y: 42 - C - 19 })
  })

  it('holds the clearance on each side on its own: a tip near the bead\'s top keeps the corner\'s side', () => {
    expect(penPointerAt({ x: 130, y: 44 }, bead, paint, 'right')).toEqual({ x: 100 - 5, y: 44 - C - 19 })
  })

  it('stands the clearance up and away from the hand with no bead under the tip', () => {
    expect(penPointerAt(tip, undefined, paint, 'right')).toEqual({ x: 125 - C - 5, y: 62 - C - 19 })
    expect(penPointerAt(tip, undefined, paint, 'left')).toEqual({ x: 125 + C - 5, y: 62 - C - 19 })
  })

  it('draws a tool that does not point whole beyond the corner, its nearest corner on it', () => {
    expect(penPointerAt(tip, bead, select, 'right')).toEqual({ x: 100 - 24, y: 40 - 24 })
    expect(penPointerAt(tip, bead, select, 'left')).toEqual({ x: 140, y: 40 - 24 })
  })
})
