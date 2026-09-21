import { describe, expect, it } from 'vitest'
import { BEAD_CATALOG, beadLabel, findBead } from './beads'
import {
  MAX_PATTERN_CELLS,
  estimatedSizeMm,
  formatSizeMm,
  gridFromSize,
  isOverCellCap,
  sizeCapRefusal,
  type SizeCapMessages,
} from './patternSize'

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

describe('isOverCellCap', () => {
  it('lets exactly the cap through and refuses one more cell', () => {
    expect(MAX_PATTERN_CELLS).toBe(10_000)
    expect(isOverCellCap({ columns: 100, rows: 100 })).toBe(false)
    expect(isOverCellCap({ columns: 10_001, rows: 1 })).toBe(true)
    expect(isOverCellCap({ columns: 101, rows: 100 })).toBe(true)
  })

  it('limits the product, with no per-side maximum', () => {
    expect(isOverCellCap({ columns: 500, rows: 10 })).toBe(false)
    expect(isOverCellCap({ columns: 10_000, rows: 1 })).toBe(false)
    expect(isOverCellCap({ columns: 200, rows: 200 })).toBe(true)
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

  it('swaps width and height for a rotated Pattern, like the grid summary does', () => {
    expect(estimatedSizeMm({ columns: 10, rows: 20, rotated: true }, cube)).toEqual({ widthMm: 30, heightMm: 15 })
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
})

const messages: SizeCapMessages = {
  beads: "That's {count} beads; the limit is {limit}.",
  tall: 'With {bead} a Pattern can hold up to {limit} beads. At this width, that’s up to {size} {unit} tall.',
  wide: 'With {bead} a Pattern can hold up to {limit} beads. At this height, that’s up to {size} {unit} wide.',
}

describe('sizeCapRefusal', () => {
  it('is nothing at or under the cap', () => {
    expect(sizeCapRefusal(messages, { unit: 'beads', dimensions: { columns: 100, rows: 100 }, bead: cube, unitLabels: units })).toBeUndefined()
  })

  it('speaks in beads when the size is in beads', () => {
    const message = sizeCapRefusal(messages, {
      unit: 'beads',
      dimensions: { columns: 100, rows: 101 },
      bead: cube,
      unitLabels: units,
    })
    expect(message).toBe("That's 10,100 beads; the limit is 10,000.")
  })

  it('names the Bead and how tall the Pattern can be at this width in cm', () => {
    const message = sizeCapRefusal(messages, {
      unit: 'cm',
      dimensions: { columns: 200, rows: 200 },
      bead: round,
      unitLabels: units,
    })
    // 10,000 / 200 columns = 50 rows of 2.2mm = 110mm = 11.0cm
    expect(message).toBe(
      `With ${beadLabel(round)} a Pattern can hold up to 10,000 beads. At this width, that’s up to 11 cm tall.`,
    )
  })

  it('speaks in mm when the size is in mm', () => {
    const message = sizeCapRefusal(messages, {
      unit: 'mm',
      dimensions: { columns: 200, rows: 200 },
      bead: cube,
      unitLabels: units,
    })
    expect(message).toContain('up to 75 mm tall')
  })

  it('suggests a width instead when even one row at this width is over the cap', () => {
    const message = sizeCapRefusal(messages, {
      unit: 'cm',
      dimensions: { columns: 12_000, rows: 3 },
      bead: cube,
      unitLabels: units,
    })
    // 10,000 / 3 rows = 3,333 columns of 1.5mm = 4999.5mm = 499.9cm (rounded down)
    expect(message).toContain('At this height')
    expect(message).toContain('up to 499.9 cm wide')
  })

  it('formats the limit for the given locale', () => {
    const message = sizeCapRefusal(messages, {
      unit: 'beads',
      dimensions: { columns: 101, rows: 100 },
      bead: cube,
      unitLabels: units,
      locale: 'de',
    })
    expect(message).toBe("That's 10.100 beads; the limit is 10.000.")
  })

  it('suggests a maximum that, typed back in, is accepted, for every Bead and unit', () => {
    for (const bead of BEAD_CATALOG) {
      for (const unit of ['mm', 'cm'] as const) {
        for (const columns of [7, 13, 61, 200, 999]) {
          const dimensions = { columns, rows: 10_000 }
          const message = sizeCapRefusal(messages, { unit, dimensions, bead, unitLabels: units })!
          const suggested = Number(/up to ([\d.]+) \S+ tall/.exec(message)![1])
          const width = (columns * (bead.widthMm + (bead.widthCorrectionMm ?? 0))) / (unit === 'cm' ? 10 : 1)
          const accepted = gridFromSize({ width, height: suggested, unit }, bead)
          expect(accepted.columns).toBe(columns)
          expect(isOverCellCap(accepted)).toBe(false)
        }
      }
    }
  })
})
