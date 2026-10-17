import { describe, expect, it } from 'vitest'
import { frameCornerControls, frameStepperCentres, selectionBarPlacement, type BarBox } from './selectionBarPlacement'

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
    scale: 1,
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

  it('shrinks the pairs with the zoom, so a smaller pair may sit closer to the canvas box\'s edge (ticket 427)', () => {
    const corner = { ...anchor, box: { left: -40, top: -30, width: 100, height: 60 }, outer: { left: -90, top: -80, width: 200, height: 160 } }
    expect(frameStepperCentres({ ...corner, scale: 0.5 }, false).top.y).toBe(8 + 7)
    expect(frameStepperCentres({ ...corner, scale: 1 }, false).top.y).toBe(8 + 14)
  })
})

describe('selectionBarPlacement around the Tool pill (ticket 439)', () => {
  const viewport = { width: 400, height: 300 }
  const bar = { width: 200, height: 28 }
  const overlaps = (placement: { left: number; top: number }, box: BarBox) =>
    placement.left < box.left + box.width && box.left < placement.left + bar.width && placement.top < box.top + box.height && box.top < placement.top + bar.height

  it('is unchanged while the pill is not in the way', () => {
    const selection = { left: 100, top: 120, width: 100, height: 60 }
    const pill = { left: 60, top: 246, width: 280, height: 48 }
    expect(selectionBarPlacement(selection, bar, viewport, pill)).toEqual(selectionBarPlacement(selection, bar, viewport))
  })

  it('flips to the other side of the Selection when the pill covers the spot above it', () => {
    const selection = { left: 100, top: 100, width: 100, height: 60 }
    const pill = { left: 60, top: 60, width: 280, height: 30 }
    const placed = selectionBarPlacement(selection, bar, viewport, pill)
    expect(placed.below).toBe(true)
    expect(overlaps(placed, pill)).toBe(false)
  })

  it('slides clear of the pill when neither side of the Selection is free', () => {
    const selection = { left: 100, top: 100, width: 100, height: 60 }
    const pill = { left: 90, top: 40, width: 220, height: 200 }
    const placed = selectionBarPlacement(selection, bar, viewport, pill)
    expect(overlaps(placed, pill)).toBe(false)
    expect(placed.left).toBeGreaterThanOrEqual(8)
    expect(placed.left + bar.width).toBeLessThanOrEqual(viewport.width - 8)
  })
})

describe('frameCornerControls (ticket 455)', () => {
  const anchor = {
    box: { left: 150, top: 100, width: 100, height: 60 },
    outer: { left: 100, top: 50, width: 200, height: 160 },
    numbers: { across: 20, down: 14 },
    scale: 1,
    viewport,
  }

  it('puts Move, Edit and Remove in a row just inside the margin outline\'s top-right corner', () => {
    // 26px buttons, 4px apart, 4px in from the corner (300, 50): right edge 296, top 54.
    expect(frameCornerControls(anchor, false)).toEqual({
      size: 26,
      scale: 1,
      remove: { x: 283, y: 67 },
      edit: { x: 253, y: 67 },
      move: { x: 223, y: 67 },
    })
  })

  it('shrinks the row with the zoom', () => {
    expect(frameCornerControls({ ...anchor, scale: 0.5 }, false)).toMatchObject({ size: 13, scale: 0.5 })
  })

  it('keeps the whole row inside the canvas box when the margin runs off it', () => {
    const off = { ...anchor, outer: { left: -400, top: -60, width: 2000, height: 160 } }
    const { remove, move, size } = frameCornerControls(off, false)
    expect(remove.x + size / 2).toBeLessThanOrEqual(viewport.width - 8)
    expect(move.x - size / 2).toBeGreaterThanOrEqual(8)
    expect(move.y - size / 2).toBeGreaterThanOrEqual(8)
  })
})
