import { describe, expect, it } from 'vitest'
import type { Bead } from './beads'
import { gridHeightPx, gridWidthPx } from './grid'
import {
  CENTERED_PAN,
  CONVERT_MAX_ZOOM,
  CONVERT_MIN_ZOOM,
  CONVERT_ZOOM_STEP,
  PREVIEW_MAX_CELLS,
  clampConvertZoom,
  coverScaleMm,
  frameSizeMm,
  framingView,
  previewLattice,
  sourcePixelAt,
} from './imageFraming'

const cubeBead: Bead = {
  id: 'test-cube',
  brand: 'Test',
  name: 'Cube',
  size: '1.5mm',
  formFactor: 'cube',
  color: null,
  widthMm: 1.5,
  heightMm: 1.5,
}

const delicaBead: Bead = { ...cubeBead, id: 'test-delica', widthMm: 1.6, heightMm: 1.3 }

describe('clampConvertZoom', () => {
  it('never goes below 100%, the scale at which the picture just covers the frame', () => {
    expect(clampConvertZoom(0.5)).toBe(CONVERT_MIN_ZOOM)
    expect(CONVERT_MIN_ZOOM).toBe(1)
  })

  it('stops at 800%', () => {
    expect(clampConvertZoom(20)).toBe(CONVERT_MAX_ZOOM)
    expect(CONVERT_MAX_ZOOM).toBe(8)
  })

  it('keeps a level in range at whole-percent precision', () => {
    expect(clampConvertZoom(1 + CONVERT_ZOOM_STEP)).toBe(1.25)
    expect(clampConvertZoom(2.004)).toBe(2)
  })
})

describe('frameSizeMm', () => {
  it('is the Pattern grid own real-world footprint, so the frame follows physical size rather than cell count', () => {
    const frame = frameSizeMm('loom', { columns: 10, rows: 20 }, delicaBead)

    expect(frame.widthMm).toBeCloseTo(16)
    expect(frame.heightMm).toBeCloseTo(26)
  })

  it('is not square for a square cell count when the Bead footprint is not square', () => {
    const frame = frameSizeMm('loom', { columns: 10, rows: 10 }, delicaBead)

    expect(frame.widthMm).not.toBeCloseTo(frame.heightMm)
  })

  it('accounts for an offset technique half-cell overhang and peyote tighter row packing', () => {
    const peyote = frameSizeMm('peyote', { columns: 10, rows: 10 }, cubeBead)

    expect(peyote.widthMm).toBeCloseTo(gridWidthPx('peyote', 10, 1.5))
    expect(peyote.heightMm).toBeCloseTo(gridHeightPx('peyote', 10, 1.5))
    expect(peyote.heightMm).toBeLessThan(frameSizeMm('loom', { columns: 10, rows: 10 }, cubeBead).heightMm)
  })
})

describe('coverScaleMm', () => {
  it('is the smallest scale at which the picture still covers the whole frame', () => {
    // A 100 x 100 picture into a 50 x 20mm frame: the width needs 0.5mm per pixel, the height only 0.2.
    expect(coverScaleMm({ width: 100, height: 100 }, { widthMm: 50, heightMm: 20 })).toBeCloseTo(0.5)
  })

  it('upscales a picture smaller than the frame rather than leaving the frame unfilled', () => {
    expect(coverScaleMm({ width: 1, height: 1 }, { widthMm: 40, heightMm: 40 })).toBeCloseTo(40)
  })
})

describe('framingView', () => {
  const image = { width: 100, height: 50 }
  const frame = { widthMm: 20, heightMm: 20 }

  it('covers the frame at 100% and centres the picture over it', () => {
    const view = framingView(image, frame, 1, CENTERED_PAN)

    expect(view.scaleMm).toBeCloseTo(0.4)
    expect(view.pictureWidthMm).toBeCloseTo(40)
    expect(view.pictureHeightMm).toBeCloseTo(20)
    // 20mm of picture hangs over the frame, half of it off each side.
    expect(view.offsetXMm).toBeCloseTo(-10)
    expect(view.offsetYMm).toBeCloseTo(0)
  })

  it('zooming scales the picture and leaves the frame alone', () => {
    const view = framingView(image, frame, 2, CENTERED_PAN)

    expect(view.scaleMm).toBeCloseTo(0.8)
    expect(view.pictureWidthMm).toBeCloseTo(80)
    expect(view.pictureHeightMm).toBeCloseTo(40)
  })

  it('always covers the frame, at any pan and any zoom in range', () => {
    for (const zoom of [1, 1.25, 3, 8]) {
      for (const pan of [{ x: 0, y: 0 }, CENTERED_PAN, { x: 1, y: 1 }]) {
        const view = framingView(image, frame, zoom, pan)

        expect(view.offsetXMm).toBeLessThanOrEqual(0.000001)
        expect(view.offsetYMm).toBeLessThanOrEqual(0.000001)
        expect(view.offsetXMm + view.pictureWidthMm).toBeGreaterThanOrEqual(frame.widthMm - 0.000001)
        expect(view.offsetYMm + view.pictureHeightMm).toBeGreaterThanOrEqual(frame.heightMm - 0.000001)
      }
    }
  })

  it('pans the picture from one edge of the frame to the other', () => {
    expect(framingView(image, frame, 1, { x: 0, y: 0.5 }).offsetXMm).toBeCloseTo(0)
    expect(framingView(image, frame, 1, { x: 1, y: 0.5 }).offsetXMm).toBeCloseTo(-20)
  })

  it('treats a pan outside 0..1 as the nearest edge', () => {
    expect(framingView(image, frame, 1, { x: -3, y: 0.5 }).offsetXMm).toBeCloseTo(0)
    expect(framingView(image, frame, 1, { x: 9, y: 0.5 }).offsetXMm).toBeCloseTo(-20)
  })
})

describe('sourcePixelAt', () => {
  const image = { width: 100, height: 50 }
  const frame = { widthMm: 20, heightMm: 20 }

  it('reads the picture pixel under a point measured from the frame own top-left corner', () => {
    const view = framingView(image, frame, 1, CENTERED_PAN)

    // The frame's left edge sits 10mm into the picture, i.e. 25 pixels in at 0.4mm per pixel.
    expect(sourcePixelAt(view, image, 0.2, 0.2)).toEqual({ x: 25, y: 0 })
    expect(sourcePixelAt(view, image, 10, 10)).toEqual({ x: 50, y: 25 })
  })

  it('has no pixel for a point beyond the picture, which is what the framing preview shows as nothing', () => {
    const view = framingView(image, frame, 1, CENTERED_PAN)

    expect(sourcePixelAt(view, image, -11, 10)).toBeUndefined()
    expect(sourcePixelAt(view, image, 10, -1)).toBeUndefined()
    expect(sourcePixelAt(view, image, 10, 21)).toBeUndefined()
  })

  it('maps many cells onto one pixel when the picture is smaller than the frame', () => {
    const tiny = { width: 1, height: 1 }
    const view = framingView(tiny, frame, 1, CENTERED_PAN)

    expect(sourcePixelAt(view, tiny, 0.5, 0.5)).toEqual({ x: 0, y: 0 })
    expect(sourcePixelAt(view, tiny, 19.5, 19.5)).toEqual({ x: 0, y: 0 })
  })
})

describe('previewLattice', () => {
  const dimensions = { columns: 10, rows: 10 }
  const frame = frameSizeMm('loom', dimensions, cubeBead)

  it('is just the frame when the picture covers it exactly, with nothing around it to show', () => {
    const square = { width: 50, height: 50 }
    const view = framingView(square, frame, 1, CENTERED_PAN)

    expect(previewLattice(view, frame, dimensions, cubeBead, 'loom')).toEqual({
      columns: 10,
      rows: 10,
      frameColumn: 0,
      frameRow: 0,
    })
  })

  it('reaches out far enough to show the picture that hangs over the frame', () => {
    // Twice as wide as it is tall, so half the picture's width hangs off each side of a square frame.
    const wide = { width: 100, height: 50 }
    const view = framingView(wide, frame, 1, CENTERED_PAN)

    const lattice = previewLattice(view, frame, dimensions, cubeBead, 'loom')

    expect(lattice.frameColumn).toBeGreaterThanOrEqual(5)
    expect(lattice.columns).toBe(dimensions.columns + lattice.frameColumn * 2)
    expect(lattice.frameRow).toBe(0)
  })

  it('keeps the frame own row parity, so an offset technique stagger lines up across the frame edge', () => {
    const tall = { width: 50, height: 400 }
    const peyoteFrame = frameSizeMm('peyote', dimensions, cubeBead)
    const view = framingView(tall, peyoteFrame, 1, CENTERED_PAN)

    const lattice = previewLattice(view, peyoteFrame, dimensions, cubeBead, 'peyote')

    expect(lattice.frameRow).toBeGreaterThan(0)
    expect(lattice.frameRow % 2).toBe(0)
  })

  it('stays inside the cell budget however much picture hangs over the frame', () => {
    const huge = { width: 4000, height: 4000 }
    const big = { columns: 120, rows: 120 }
    const bigFrame = frameSizeMm('loom', big, cubeBead)
    const view = framingView(huge, bigFrame, 8, CENTERED_PAN)

    const lattice = previewLattice(view, bigFrame, big, cubeBead, 'loom')

    expect(lattice.columns * lattice.rows).toBeLessThanOrEqual(PREVIEW_MAX_CELLS)
    expect(lattice.columns).toBeGreaterThanOrEqual(big.columns)
    expect(lattice.rows).toBeGreaterThanOrEqual(big.rows)
  })

  it('still renders the frame itself when the Pattern alone is past the budget', () => {
    const enormous = { columns: 400, rows: 400 }
    const enormousFrame = frameSizeMm('loom', enormous, cubeBead)
    const view = framingView({ width: 4000, height: 4000 }, enormousFrame, 2, CENTERED_PAN)

    expect(previewLattice(view, enormousFrame, enormous, cubeBead, 'loom')).toEqual({
      columns: 400,
      rows: 400,
      frameColumn: 0,
      frameRow: 0,
    })
  })
})
