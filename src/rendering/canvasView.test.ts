import { describe, expect, it } from 'vitest'
import { beadBoxPx, displayedBox, gridToDisplayed, scrollAfterZoom, scrollToCentre, zoomToFit } from './canvasView'

const block = { row: 2, column: 3, rows: 4, columns: 5 }

describe('canvas view geometry', () => {
  it('measures a block of beads from the bead at row 0, column 0, with an offset technique’s extra half bead', () => {
    expect(beadBoxPx('loom', block)).toEqual({ x: 60, y: 40, width: 100, height: 80 })
    expect(beadBoxPx('brick', { ...block, row: 0 })).toMatchObject({ x: 60, y: 0, width: 110 })
  })

  it('turns a point a quarter at a time about the origin', () => {
    expect(gridToDisplayed(0, 10, 20, 2)).toEqual([20, 40])
    expect(gridToDisplayed(90, 10, 20, 2)).toEqual([-40, 20])
    expect(gridToDisplayed(180, 10, 20, 2)).toEqual([-20, -40])
    expect(gridToDisplayed(270, 10, 20, 2)).toEqual([40, -20])
  })

  it('finds where a block lands once turned and zoomed, as an upright rectangle', () => {
    expect(displayedBox('loom', 0, block, 2)).toEqual({ x: 120, y: 80, width: 200, height: 160 })
    expect(displayedBox('loom', 90, block, 1)).toEqual({ x: -120, y: 60, width: 80, height: 100 })
  })

  it('centres a rectangle in a viewport', () => {
    expect(scrollToCentre({ x: 100, y: 50, width: 200, height: 100 }, { width: 400, height: 300 })).toEqual({ x: 0, y: -50 })
  })

  it('keeps the point under the anchor still while the zoom changes', () => {
    const before = { x: 30, y: 10 }
    const anchor = { x: 100, y: 50 }
    const after = scrollAfterZoom(before, anchor, 1, 2)
    // The displayed point under the anchor was (130, 60) at zoom 1, so it is (260, 120) at zoom 2, and still 100,50 from the corner.
    expect(after).toEqual({ x: 160, y: 70 })
  })

  it('fits a block with a margin, never zooming in past 100%', () => {
    expect(zoomToFit('loom', 0, block, { width: 1000, height: 1000 }, { width: 20, height: 20 })).toBe(1)
    expect(zoomToFit('loom', 0, block, { width: 140, height: 140 }, { width: 20, height: 20 })).toBe(1)
    expect(zoomToFit('loom', 0, block, { width: 90, height: 1000 }, { width: 20, height: 20 })).toBe(0.5)
  })
})
