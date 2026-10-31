import { describe, expect, it } from 'vitest'
import { overlapsSelectionHandles, selectionBarPlacement, type BarBox } from './selectionBarPlacement'

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


describe('what of the margin sheet gives way to a Selection\'s handles (tickets 498, 0657)', () => {
  const selection = { left: 100, top: 100, width: 200, height: 100 }

  it('gives way over the reach round the Selection\'s edge', () => {
    expect(overlapsSelectionHandles({ left: 120, top: 40, width: 100, height: 28 }, selection)).toBe(true)
  })

  it('keeps its press clear of the Selection and well inside it', () => {
    expect(overlapsSelectionHandles({ left: 120, top: 20, width: 100, height: 28 }, selection)).toBe(false)
    expect(overlapsSelectionHandles({ left: 140, top: 140, width: 20, height: 20 }, selection)).toBe(false)
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

  it('keeps to its side when told to (the whole-Frame Mirror bar, ticket 0750): with no room above the sheet it slides clear of the pill below rather than flip back over the band', () => {
    const sheet = { left: 20, top: 4, width: 360, height: 400 }
    const pill = { left: 100, top: 246, width: 200, height: 48 }
    expect(selectionBarPlacement(sheet, bar, viewport, pill).below).toBe(false)
    const kept = selectionBarPlacement(sheet, bar, viewport, pill, { keepSide: true })
    expect(kept.below).toBe(true)
    expect(overlaps(kept, pill)).toBe(false)
  })
})
