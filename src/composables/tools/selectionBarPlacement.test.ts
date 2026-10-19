import { describe, expect, it } from 'vitest'
import { editPencilCentre, moveHandleCentre, selectionBarPlacement, type BarBox } from './selectionBarPlacement'

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


describe('the Move handle and the edit pencil in the Frame\'s gutter (ticket 473, ADR 0066)', () => {
  const anchor = {
    box: { left: 150, top: 100, width: 100, height: 60 },
    viewport,
  }

  it('puts the handle in the gutter above the Frame, centred on its top edge', () => {
    expect(moveHandleCentre(anchor)).toEqual({ x: 200, y: 52 })
  })

  it('keeps the handle and the pencil inside the canvas box when the Frame is dragged over its edge', () => {
    expect(moveHandleCentre({ ...anchor, box: { ...anchor.box, left: -60 } }).x).toBe(28)
    expect(moveHandleCentre({ ...anchor, box: { ...anchor.box, left: 390 } }).x).toBeLessThanOrEqual(viewport.width - 28)
    expect(editPencilCentre({ ...anchor, box: { ...anchor.box, left: 350 } }).x).toBe(viewport.width - 22)
    expect(moveHandleCentre({ ...anchor, box: { ...anchor.box, top: -300 } }).y).toBe(22)
  })

  it('flips below the Frame when there is no room above it', () => {
    const low = { ...anchor, box: { ...anchor.box, top: 20 } }
    expect(moveHandleCentre(low).y).toBe(128)
    expect(editPencilCentre(low).y).toBe(128)
  })

  it('does not change size or place with the zoom: only the anchor moves it', () => {
    expect(moveHandleCentre({ ...anchor, box: { ...anchor.box, left: 170, top: 120 } })).toEqual({ x: 220, y: 72 })
  })

  it('slides the handle clear of the pencil on a small Frame, where their hit areas would meet', () => {
    const small = { ...anchor, box: { left: 190, top: 100, width: 20, height: 20 } }
    const pencil = editPencilCentre(small)
    const handle = moveHandleCentre(small)
    const clearX = Math.abs(handle.x - pencil.x) >= 28 + 22
    const clearY = Math.abs(handle.y - pencil.y) >= 22 + 22
    expect(clearX || clearY).toBe(true)
  })

  it('slides the handle out from under the Frame bar, to the side with the nearer room', () => {
    const bar = { left: 100, top: 12, width: 200, height: 60 }
    expect(moveHandleCentre(anchor, bar)).toEqual({ x: 200, y: 94 })
  })

  it('puts the pencil in the gutter above the Frame\'s top-right corner', () => {
    expect(editPencilCentre(anchor)).toEqual({ x: 250, y: 52 })
    expect(editPencilCentre({ ...anchor, box: { ...anchor.box, left: 200 } })).toEqual({ x: 300, y: 52 })
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
