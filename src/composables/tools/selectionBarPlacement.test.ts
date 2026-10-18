import { describe, expect, it } from 'vitest'
import { cornerControlsReachPx, frameCornerControls, frameStepperCentres, selectionBarPlacement, type BarBox } from './selectionBarPlacement'

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
    expect(frameStepperCentres(anchor)).toEqual({
      top: { x: 200, y: 68 },
      bottom: { x: 200, y: 192 },
      left: { x: 115, y: 130 },
      right: { x: 285, y: 130 },
    })
  })

  it('pins the pairs to the Frame: panning carries them, they are never clamped to the canvas box (ticket 467)', () => {
    const at = frameStepperCentres(anchor)
    const panned = frameStepperCentres({
      ...anchor,
      box: { ...anchor.box, left: anchor.box.left - 500, top: anchor.box.top - 400 },
      outer: { ...anchor.outer, left: anchor.outer.left - 500, top: anchor.outer.top - 400 },
    })
    for (const edge of ['top', 'bottom', 'left', 'right'] as const) {
      expect(panned[edge]).toEqual({ x: at[edge].x - 500, y: at[edge].y - 400 })
    }
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

  it('puts Move, Rotate, Edit and Remove in a row just inside the margin outline\'s top-right corner', () => {
    // 26px buttons, 4px apart, 4px in from the corner (300, 50): right edge 296, top 54.
    expect(frameCornerControls(anchor, false)).toEqual({
      size: 26,
      fullSize: 26,
      scale: 1,
      remove: { x: 283, y: 67 },
      edit: { x: 253, y: 67 },
      rotate: { x: 223, y: 67 },
      move: { x: 193, y: 67 },
    })
  })

  it('shrinks the row with the zoom', () => {
    expect(frameCornerControls({ ...anchor, scale: 0.5 }, false)).toMatchObject({ size: 13, scale: 0.5 })
  })

  it('is pinned to the margin outline: panning carries the row, it is never clamped to the canvas box (ticket 467)', () => {
    const at = frameCornerControls(anchor, false)
    const panned = frameCornerControls({ ...anchor, outer: { ...anchor.outer, left: anchor.outer.left - 700, top: anchor.outer.top - 90 } }, false)
    expect(panned.move).toEqual({ x: at.move.x - 700, y: at.move.y - 90 })
    expect(panned.remove).toEqual({ x: at.remove.x - 700, y: at.remove.y - 90 })
  })
})

describe('cornerControlsReachPx (ticket 459)', () => {
  it('is a control and its inset above and below, shrunk with the zoom, taller on touch', () => {
    expect(cornerControlsReachPx(1, false)).toBe(34)
    expect(cornerControlsReachPx(0.5, false)).toBe(17)
    expect(cornerControlsReachPx(0.5, true)).toBe(22)
  })
})
