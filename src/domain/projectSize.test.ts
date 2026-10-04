// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { BEAD_CATALOG, findBead } from './beads'
import {
  estimatedSizeMm,
  formatSizeConversion,
  formatSizeMm,
  gridFromSize,
} from './projectSize'

const cube = findBead('toho-cube-1.5mm')!
const round = findBead('toho-round-11-0')!
const delica = findBead('miyuki-delica-11-0')!

const units = { mm: 'mm', cm: 'cm' }

describe('gridFromSize', () => {
  it('takes a size in beads as the columns and rows directly, whatever the Bead', () => {
    for (const bead of BEAD_CATALOG) {
      expect(gridFromSize({ width: 12, height: 7, unit: 'beads' }, bead)).toEqual({ columns: 12, rows: 7 })
    }
  })

  it('rounds a fractional size in beads and never goes below one', () => {
    expect(gridFromSize({ width: 2.6, height: 0.2, unit: 'beads' }, cube)).toEqual({ columns: 3, rows: 1 })
  })

  it('converts mm once, through the chosen Bead', () => {
    expect(gridFromSize({ width: 15, height: 30, unit: 'mm' }, cube)).toEqual({ columns: 10, rows: 20 })
  })

  it('converts cm as ten times the mm', () => {
    expect(gridFromSize({ width: 1.5, height: 3, unit: 'cm' }, cube)).toEqual({ columns: 10, rows: 20 })
  })
})

describe('estimatedSizeMm', () => {
  it('is columns times the Bead width and rows times its height', () => {
    expect(estimatedSizeMm({ columns: 10, rows: 20 }, cube)).toEqual({ widthMm: 15, heightMm: 30 })
    expect(estimatedSizeMm({ columns: 20, rows: 10 }, delica).widthMm).toBeCloseTo(32)
    expect(estimatedSizeMm({ columns: 20, rows: 10 }, delica).heightMm).toBeCloseTo(13)
  })

  it("includes TOHO Round 11/0's width correction in every column", () => {
    const size = estimatedSizeMm({ columns: 9, rows: 73 }, round)
    expect(size.widthMm).toBeCloseTo(14.85)
    expect(size.heightMm).toBeCloseTo(160.6)
  })

  it('swaps width and height for a Project rotated a quarter turn either way, like the grid summary does', () => {
    expect(estimatedSizeMm({ columns: 10, rows: 20, rotation: 90 }, cube)).toEqual({ widthMm: 30, heightMm: 15 })
    expect(estimatedSizeMm({ columns: 10, rows: 20, rotation: 270 }, cube)).toEqual({ widthMm: 30, heightMm: 15 })
  })

  it('leaves width and height as they are for a Project upside down (180°, ticket 171)', () => {
    expect(estimatedSizeMm({ columns: 10, rows: 20, rotation: 180 }, cube)).toEqual({ widthMm: 15, heightMm: 30 })
  })

  it('is the inverse of the mm conversion, so a stated size estimates back to about itself', () => {
    for (const bead of BEAD_CATALOG) {
      const dimensions = gridFromSize({ width: 30, height: 60, unit: 'mm' }, bead)
      const estimate = estimatedSizeMm(dimensions, bead)
      expect(Math.abs(estimate.widthMm - 30)).toBeLessThanOrEqual(bead.widthMm)
      expect(Math.abs(estimate.heightMm - 60)).toBeLessThanOrEqual(bead.heightMm)
    }
  })
})

describe('formatSizeMm', () => {
  it('shows cm with one decimal, width first', () => {
    expect(formatSizeMm({ widthMm: 15, heightMm: 30 }, units)).toBe('1.5 × 3.0 cm')
    expect(formatSizeMm({ widthMm: 33, heightMm: 66 }, units)).toBe('3.3 × 6.6 cm')
  })

  it('switches both sides to mm once either is under 10mm', () => {
    expect(formatSizeMm({ widthMm: 9.9, heightMm: 30 }, units)).toBe('9.9 × 30 mm')
    expect(formatSizeMm({ widthMm: 30, heightMm: 4.5 }, units)).toBe('30 × 4.5 mm')
  })

  it('stays in cm at exactly 10mm', () => {
    expect(formatSizeMm({ widthMm: 10, heightMm: 30 }, units)).toBe('1.0 × 3.0 cm')
  })

  it('rounds half a millimetre up, not to whatever the float happens to be', () => {
    expect(formatSizeMm({ widthMm: 16.5, heightMm: 44 }, units)).toBe('1.7 × 4.4 cm')
  })

  it('treats a side that only rounds up to 10mm as 10mm', () => {
    expect(formatSizeMm({ widthMm: 9.97, heightMm: 30 }, units)).toBe('1.0 × 3.0 cm')
  })

  it('uses the language’s own unit labels', () => {
    expect(formatSizeMm({ widthMm: 15, heightMm: 30 }, { mm: 'мм', cm: 'см' })).toBe('1.5 × 3.0 см')
    expect(formatSizeMm({ widthMm: 5, heightMm: 30 }, { mm: 'мм', cm: 'см' })).toBe('5 × 30 мм')
  })

  it('uses the Russian decimal comma (writing.md, Numbers) when locale is ru', () => {
    expect(formatSizeMm({ widthMm: 15, heightMm: 30 }, { mm: 'мм', cm: 'см' }, 'ru')).toBe('1,5 × 3,0 см')
    expect(formatSizeMm({ widthMm: 9.9, heightMm: 30 }, { mm: 'мм', cm: 'см' }, 'ru')).toBe('9,9 × 30 мм')
    // A whole number still drops its trailing zero, comma included.
    expect(formatSizeMm({ widthMm: 10, heightMm: 30 }, { mm: 'мм', cm: 'см' }, 'ru')).toBe('1,0 × 3,0 см')
  })

  it('keeps the English decimal point when locale is left out or set to en', () => {
    expect(formatSizeMm({ widthMm: 15, heightMm: 30 }, units, 'en')).toBe('1.5 × 3.0 cm')
    expect(formatSizeMm({ widthMm: 15, heightMm: 30 }, units)).toBe('1.5 × 3.0 cm')
  })
})

describe('formatSizeConversion (ticket 179)', () => {
  it('shows each axis as bead count × the Bead\'s own mm pitch, ending in the combined Estimated size', () => {
    expect(formatSizeConversion({ columns: 10, rows: 20 }, cube, units)).toBe('10×1.5 × 20×1.5 ≈ 1.5 × 3.0 cm')
  })

  it("includes TOHO Round 11/0's width correction in the width term, not the raw catalog width", () => {
    // beadPitchMm is 1.5 + 0.15 = 1.65, trimmed to two decimals rather than rounded to one.
    expect(formatSizeConversion({ columns: 9, rows: 73 }, round, units)).toBe('9×1.65 × 73×2.2 ≈ 1.5 × 16.1 cm')
  })

  it('drops a trailing zero from a whole-number pitch', () => {
    expect(formatSizeConversion({ columns: 40, rows: 30 }, cube, units)).toBe('40×1.5 × 30×1.5 ≈ 6.0 × 4.5 cm')
  })

  it('uses the Russian decimal comma when locale is ru', () => {
    expect(formatSizeConversion({ columns: 9, rows: 73 }, round, { mm: 'мм', cm: 'см' }, 'ru')).toBe(
      '9×1,65 × 73×2,2 ≈ 1,5 × 16,1 см',
    )
  })

  it('updates live with a different Bead, since the pitch comes from it', () => {
    expect(formatSizeConversion({ columns: 20, rows: 10 }, delica, units)).toBe('20×1.6 × 10×1.3 ≈ 3.2 × 1.3 cm')
  })
})
