import { describe, expect, it } from 'vitest'
import { areaBarPlacement, overlapsSelectionHandles, selectionBarPlacement, type BarBox } from './selectionBarPlacement'

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

  it('stays beside a Selection that runs off the box while part of it is still in view', () => {
    expect(selectionBarPlacement({ left: -60, top: -40, width: 100, height: 60 }, bar, viewport)).toEqual({ left: 8, top: 26, below: true })
  })

  it('goes out of view with a Selection scrolled away, rather than hugging the box edge (ticket 0779)', () => {
    // Across, it keeps 24px over the Selection's edge; above and below, it touches the Selection.
    expect(selectionBarPlacement({ left: -500, top: 100, width: 100, height: 60 }, bar, viewport).left).toBe(-424)
    expect(selectionBarPlacement({ left: 900, top: 100, width: 100, height: 60 }, bar, viewport).left).toBe(824)
    expect(selectionBarPlacement({ left: 150, top: -500, width: 100, height: 60 }, bar, viewport)).toEqual({ left: 150, top: -434, below: true })
    expect(selectionBarPlacement({ left: 150, top: 900, width: 100, height: 60 }, bar, viewport)).toEqual({ left: 150, top: 866, below: false })
  })
})


describe('what of the margin sheet gives way to a Selection\'s handles (tickets 498, 0657)', () => {
  const selection = { left: 100, top: 100, width: 200, height: 100 }

  it('gives way over the reach round the Selection\'s edge', () => {
    expect(overlapsSelectionHandles({ left: 120, top: 40, width: 100, height: 28 }, selection)).toBe(true)
  })

  it('keeps its press clear of the Selection and well inside it', () => {
    expect(overlapsSelectionHandles({ left: 120, top: 0, width: 100, height: 20 }, selection)).toBe(false)
    expect(overlapsSelectionHandles({ left: 140, top: 140, width: 20, height: 20 }, selection)).toBe(false)
  })

  it('gives way over the Area sheet\'s band and the bar above it, where the top handles and the move grip are (tickets 0808, 0812)', () => {
    expect(overlapsSelectionHandles({ left: 120, top: 50, width: 100, height: 10 }, selection)).toBe(true)
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

  it('does not dodge the pill once it is going out of view with its Selection (ticket 0779)', () => {
    const selection = { left: 100, top: 310, width: 100, height: 60 }
    const pill = { left: 60, top: 246, width: 280, height: 48 }
    expect(selectionBarPlacement(selection, bar, viewport, pill)).toEqual({ left: 50, top: 276, below: false })
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

describe('areaBarPlacement (ContextBar card, Area sheet, ticket 0812)', () => {
  const area = { left: 100, top: 100, width: 200, height: 80 }

  it('sets the bar above the Area sheet, clear of the band, centred on it', () => {
    // The sheet reaches 10px past the area on every side: the bar keeps 6px above its outer edge.
    expect(areaBarPlacement(area, bar, viewport)).toEqual({ left: 150, top: 100 - 10 - 6 - 28, below: false })
  })

  it('flips below the sheet, clear of its band, when there is no room above', () => {
    expect(areaBarPlacement({ ...area, top: 30 }, bar, viewport)).toEqual({ left: 150, top: 30 + 80 + 10 + 6, below: true })
  })

  it('never lies over the area or its band', () => {
    for (const at of [area, { ...area, top: 30 }, { left: 0, top: 150, width: 20, height: 20 }]) {
      const placed = areaBarPlacement(at, bar, viewport)
      const sheet = { left: at.left - 10, top: at.top - 10, width: at.width + 20, height: at.height + 20 }
      expect(placed.top + bar.height <= sheet.top || placed.top >= sheet.top + sheet.height).toBe(true)
    }
  })
})
