import { describe, expect, it } from 'vitest'
import { toMillimeters, computeGridDimensions } from './grid'
import type { Bead } from './beads'

const cubeBead: Bead = {
  id: 'test-cube',
  brand: 'Test',
  name: 'Cube',
  size: '1.5mm',
  formFactor: 'cube',
  widthMm: 1.5,
  heightMm: 1.5,
}

const delicaBead: Bead = {
  id: 'test-delica',
  brand: 'Test',
  name: 'Delica',
  size: '11/0',
  formFactor: 'cylinder',
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
    expect(computeGridDimensions({ widthMm: 15, heightMm: 15 }, cubeBead)).toEqual({
      columns: 10,
      rows: 10,
    })
  })

  it('uses the bead width for columns and bead height for rows independently', () => {
    expect(computeGridDimensions({ widthMm: 16, heightMm: 13 }, delicaBead)).toEqual({
      columns: 10,
      rows: 10,
    })
  })

  it('rounds to the nearest whole bead', () => {
    expect(computeGridDimensions({ widthMm: 17, heightMm: 17 }, cubeBead)).toEqual({
      columns: 11,
      rows: 11,
    })
  })

  it('never returns fewer than one column or row', () => {
    expect(computeGridDimensions({ widthMm: 0.1, heightMm: 0.1 }, cubeBead)).toEqual({
      columns: 1,
      rows: 1,
    })
  })
})
