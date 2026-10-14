import { describe, expect, it } from 'vitest'
import { frameBarAnchor, selectionBarPlacement } from './selectionBarPlacement'

const bar = { width: 100, height: 28 }
const viewport = { width: 400, height: 300 }

describe('selectionBarPlacement (ticket 415)', () => {
  it('centres the bar above the Selection', () => {
    expect(selectionBarPlacement({ left: 150, top: 100, width: 100, height: 60 }, bar, viewport)).toEqual({ left: 150, top: 66, below: false })
  })

  it('flips below the Selection when there is no room above', () => {
    expect(selectionBarPlacement({ left: 150, top: 20, width: 100, height: 60 }, bar, viewport)).toEqual({ left: 150, top: 86, below: true })
  })

  it('stays inside the box on the left and the right', () => {
    expect(selectionBarPlacement({ left: 0, top: 100, width: 20, height: 20 }, bar, viewport).left).toBe(8)
    expect(selectionBarPlacement({ left: 380, top: 100, width: 20, height: 20 }, bar, viewport).left).toBe(292)
  })

  it('stays inside the box at the bottom when the Selection runs past it', () => {
    const placed = selectionBarPlacement({ left: 150, top: 10, width: 100, height: 600 }, bar, viewport)
    expect(placed.top + bar.height).toBeLessThanOrEqual(viewport.height - 8)
  })

  it('follows a Selection scrolled out of sight by hugging the box edge', () => {
    expect(selectionBarPlacement({ left: -500, top: -500, width: 100, height: 60 }, bar, viewport)).toEqual({ left: 8, top: 8, below: true })
  })
})

describe('frameBarAnchor (ticket 417)', () => {
  const frame = { box: { left: 150, top: 100, width: 100, height: 60 }, viewport }

  it('grows the Frame by the margin steppers\' reach above and below, so the bar clears them', () => {
    expect(frameBarAnchor(frame, false).box).toEqual({ left: 150, top: 56, width: 100, height: 148 })
    expect(frameBarAnchor(frame, true).box).toEqual({ left: 150, top: 40, width: 100, height: 180 })
    expect(frameBarAnchor(frame, false).viewport).toBe(viewport)
  })

  it('puts the bar above the top stepper, and below the bottom one when there is no room above', () => {
    const above = selectionBarPlacement(frameBarAnchor(frame, false).box, bar, viewport)
    expect(above).toMatchObject({ top: 22, below: false })
    const cramped = { box: { left: 150, top: 20, width: 100, height: 60 }, viewport }
    const below = selectionBarPlacement(frameBarAnchor(cramped, false).box, bar, viewport)
    expect(below.below).toBe(true)
    expect(below.top).toBeGreaterThanOrEqual(20 + 60 + 44)
  })
})
