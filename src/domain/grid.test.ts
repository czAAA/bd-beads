// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { MAX_ZOOM, MIN_ZOOM, clampZoom, stepZoom, computeGridDimensions, toMillimeters } from './grid'
import type { Bead } from './beads'

const cubeBead: Bead = {
  id: 'test-cube',
  brand: { id: 'test', name: 'Test' },
  size: '1.5mm',
  formFactor: { id: 'cube', nameKey: 'cube', roundness: 0, holes: { count: 1, direction: 'along' } },
  widthMm: 1.5,
  heightMm: 1.5,
}

const delicaBead: Bead = {
  id: 'test-delica',
  brand: { id: 'test', name: 'Test' },
  size: '11/0',
  formFactor: { id: 'delica', nameKey: 'delica', roundness: 0.1, holes: { count: 1, direction: 'along' } },
  widthMm: 1.6,
  heightMm: 1.3,
}

describe('toMillimeters', () => {
  it('returns the value unchanged for mm', () => {
    expect(toMillimeters(15, 'mm')).toBe(15)
  })

  it('converts cm to mm', () => {
    expect(toMillimeters(1.5, 'cm')).toBe(15)
  })
})

describe('computeGridDimensions', () => {
  it('divides physical size by bead footprint to get columns and rows', () => {
    expect(computeGridDimensions({ widthMm: 15, heightMm: 15 }, cubeBead, 'loom')).toEqual({
      columns: 10,
      rows: 10,
    })
  })

  it('uses the bead width for columns and bead height for rows independently', () => {
    expect(computeGridDimensions({ widthMm: 16, heightMm: 13 }, delicaBead, 'loom')).toEqual({
      columns: 10,
      rows: 10,
    })
  })

  it('counts columns in the bead width plus its per-bead correction', () => {
    const correctedBead: Bead = { ...cubeBead, widthMm: 1.5, widthCorrectionMm: 0.15 }
    // 16.5 / 1.65 = 10 columns, where the bare 1.5mm width would give 11. Rows ignore the correction.
    expect(computeGridDimensions({ widthMm: 16.5, heightMm: 15 }, correctedBead, 'loom')).toEqual({
      columns: 10,
      rows: 10,
    })
  })

  it('rounds up to the next whole bead (ticket 342)', () => {
    expect(computeGridDimensions({ widthMm: 15.1, heightMm: 16 }, cubeBead, 'loom')).toEqual({
      columns: 11,
      rows: 11,
    })
  })

  it('keeps an exact multiple of the bead as it is, despite floating-point noise', () => {
    // 0.3 / 0.1 is 2.9999999999999996 and 0.7 / 0.1 is 6.999999999999999: neither may round up a bead.
    const fine: Bead = { ...cubeBead, widthMm: 0.1, heightMm: 0.1 }
    expect(computeGridDimensions({ widthMm: 0.3, heightMm: 0.7 }, fine, 'loom')).toEqual({ columns: 3, rows: 7 })
    expect(computeGridDimensions({ widthMm: 0.6, heightMm: 2.1 }, fine, 'loom')).toEqual({ columns: 6, rows: 21 })
  })

  it('counts columns across the diameter and rows along the length plus slack on brick stitch, whose thread runs down (ticket 0734)', () => {
    const slack: Bead = { ...delicaBead, widthCorrectionMm: 0.2 }
    // 13 / 1.3 = 10 columns, 18 / (1.6 + 0.2) = 10 rows; on loom the same bead counts 13 / 1.8 = 8 columns, 18 / 1.3 = 14 rows.
    expect(computeGridDimensions({ widthMm: 13, heightMm: 18 }, slack, 'brick')).toEqual({ columns: 10, rows: 10 })
    expect(computeGridDimensions({ widthMm: 13, heightMm: 18 }, slack, 'loom')).toEqual({ columns: 8, rows: 14 })
    expect(computeGridDimensions({ widthMm: 13, heightMm: 18 }, slack, 'peyote')).toEqual({ columns: 8, rows: 14 })
  })

  it('never returns fewer than one column or row', () => {
    expect(computeGridDimensions({ widthMm: 0.1, heightMm: 0.1 }, cubeBead, 'loom')).toEqual({
      columns: 1,
      rows: 1,
    })
  })
})

describe('clampZoom', () => {
  it('leaves a zoom inside the range alone, rounded to whole percent', () => {
    expect(clampZoom(0.8)).toBe(0.8)
    expect(clampZoom(0.7916)).toBe(0.79)
  })

  it('never goes below the minimum or above the maximum', () => {
    expect(clampZoom(0.01)).toBe(MIN_ZOOM)
    expect(clampZoom(99)).toBe(MAX_ZOOM)
  })
})

describe('stepZoom', () => {
  it('walks the 10% rungs from one to the next, both ways', () => {
    expect(stepZoom(1, -1)).toBe(0.9)
    expect(stepZoom(0.2, -1)).toBe(0.1)
    expect(stepZoom(1, 1)).toBe(1.1)
    expect(stepZoom(0.1, 1)).toBe(0.2)
  })

  it('lands on the next rung from a level a fit, wheel or pinch left between two', () => {
    expect(stepZoom(0.43, 1)).toBe(0.5)
    expect(stepZoom(0.43, -1)).toBe(0.4)
    expect(stepZoom(0.54, -1)).toBe(0.5)
  })

  it('stays inside the Zoom range', () => {
    expect(stepZoom(0.1, -1)).toBe(0.1)
    expect(stepZoom(0.14, -1)).toBe(0.1)
    expect(stepZoom(4, 1)).toBe(4)
    expect(stepZoom(3.95, 1)).toBe(4)
  })
})

