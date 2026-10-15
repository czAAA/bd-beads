import { describe, expect, it } from 'vitest'
import { frameStepperCentres, selectionBarPlacement } from './selectionBarPlacement'

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

describe('frameStepperCentres (ticket 427)', () => {
  const anchor = {
    box: { left: 150, top: 100, width: 100, height: 60 },
    outer: { left: 100, top: 50, width: 200, height: 160 },
    numbers: { across: 20, down: 14 },
    viewport,
  }

  it('centres each pair between the ruler numbers and the margin\'s outer edge', () => {
    expect(frameStepperCentres(anchor, false)).toEqual({
      top: { x: 200, y: 68 },
      bottom: { x: 200, y: 192 },
      left: { x: 115, y: 130 },
      right: { x: 285, y: 130 },
    })
  })

  it('keeps every pair inside the canvas box when the Frame is near or past its edge', () => {
    const corner = { ...anchor, box: { left: -40, top: -30, width: 100, height: 60 }, outer: { left: -90, top: -80, width: 200, height: 160 } }
    const centres = frameStepperCentres(corner, true)
    expect(centres.top.y).toBe(8 + 18)
    expect(centres.left.x).toBe(8 + 18)
    expect(centres.top.x).toBeGreaterThanOrEqual(8 + 37)
  })
})
