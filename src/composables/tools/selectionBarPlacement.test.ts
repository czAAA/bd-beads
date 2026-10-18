import { describe, expect, it } from 'vitest'
import { editPencilCentre, marginHandleCentre, selectionBarPlacement, type BarBox } from './selectionBarPlacement'

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


describe('the Margin handle and the edit pencil (ticket 473)', () => {
  const anchor = {
    box: { left: 150, top: 100, width: 100, height: 60 },
    outer: { left: 100, top: 50, width: 200, height: 160 },
    viewport,
  }

  it('puts the handle halfway down the top margin, centred on it', () => {
    expect(marginHandleCentre(anchor)).toEqual({ x: 200, y: 75 })
  })

  it('stays on the margin\'s own centre while it is partly out of view, not sliding into the visible part', () => {
    const roomy = { ...anchor, box: { ...anchor.box, top: 200 } }
    expect(marginHandleCentre({ ...roomy, outer: { ...roomy.outer, left: -60 } }).x).toBe(40)
    expect(marginHandleCentre({ ...roomy, outer: { ...roomy.outer, left: 260 } }).x).toBe(360)
  })

  it('does not pull the handle into the canvas box when the Frame is dragged over its edge', () => {
    const roomy = { ...anchor, box: { ...anchor.box, top: 200 } }
    expect(marginHandleCentre({ ...roomy, outer: { ...roomy.outer, left: 390 } }).x).toBe(490)
    expect(marginHandleCentre({ ...anchor, box: { ...anchor.box, top: -300 }, outer: { ...anchor.outer, top: -400 } }).y).toBe(-350)
    expect(marginHandleCentre({ ...anchor, box: { ...anchor.box, top: 500 }, outer: { ...anchor.outer, top: 450 } }).y).toBe(475)
  })

  it('does not change size or place with the zoom: only the anchor moves it', () => {
    const panned = marginHandleCentre({ ...anchor, outer: { ...anchor.outer, left: 120, top: 70 }, box: { ...anchor.box, left: 170, top: 120 } })
    expect(panned).toEqual({ x: 220, y: 95 })
  })

  it('slides the handle clear of the pencil on a small Frame, where their hit areas would meet', () => {
    const small = { ...anchor, box: { left: 190, top: 100, width: 20, height: 20 }, outer: { left: 170, top: 80, width: 60, height: 60 } }
    const pencil = editPencilCentre(small)
    const handle = marginHandleCentre(small)
    const clearX = Math.abs(handle.x - pencil.x) >= 28 + 22
    const clearY = Math.abs(handle.y - pencil.y) >= 22 + 22
    expect(clearX || clearY).toBe(true)
  })

  it('slides the handle out from under the Frame bar, to the side with the nearer room', () => {
    const bar = { left: 100, top: 12, width: 200, height: 120 }
    const handle = marginHandleCentre({ ...anchor, box: { ...anchor.box, top: 40 }, outer: { ...anchor.outer, top: 0 } }, bar)
    expect(handle).toEqual({ x: 200, y: -10 })
  })

  it('puts the pencil inside the margin, 26px in and down from the outline corner, pinned to it', () => {
    expect(editPencilCentre(anchor)).toEqual({ x: 274, y: 76 })
    expect(editPencilCentre({ ...anchor, outer: { ...anchor.outer, left: 150 } })).toEqual({ x: 324, y: 76 })
  })

  it('does not pull the pencil into the canvas box when the Frame is dragged over its edge', () => {
    expect(editPencilCentre({ ...anchor, outer: { ...anchor.outer, left: 350 } }).x).toBe(524)
    expect(editPencilCentre({ ...anchor, outer: { ...anchor.outer, top: -90 } }).y).toBe(-64)
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
