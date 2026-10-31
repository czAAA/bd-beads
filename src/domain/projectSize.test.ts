// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { BEAD_CATALOG, findBead } from './beads'
import { customFrameSize } from './frameShape'
import {
  estimatedSizeMm,
  formatMm,
  isSizeStated,
  formatSizeMm,
  formatSizeInMm,
  gridFromSize,
} from './projectSize'
import { bareProject } from '../testUtils/layerFields'

const cube = findBead('toho-cube-1.5mm')!
const round = findBead('toho-round-11-0')!
const delica = findBead('miyuki-delica-11-0')!

const units = { mm: 'mm', cm: 'cm' }

describe('gridFromSize', () => {
  it('takes a size in beads as the columns and rows directly, whatever the Bead', () => {
    for (const bead of BEAD_CATALOG) {
      expect(gridFromSize({ width: 12, height: 7, unit: 'beads' }, bead, 'loom')).toEqual({ columns: 12, rows: 7 })
    }
  })

  it('rounds a fractional size in beads and never goes below one', () => {
    expect(gridFromSize({ width: 2.6, height: 0.2, unit: 'beads' }, cube, 'loom')).toEqual({ columns: 3, rows: 1 })
  })

  it('converts mm once, through the chosen Bead', () => {
    expect(gridFromSize({ width: 15, height: 30, unit: 'mm' }, cube, 'loom')).toEqual({ columns: 10, rows: 20 })
  })

  it('converts cm as ten times the mm', () => {
    expect(gridFromSize({ width: 1.5, height: 3, unit: 'cm' }, cube, 'loom')).toEqual({ columns: 10, rows: 20 })
  })
})

describe('estimatedSizeMm', () => {
  it('is columns times the Bead width and rows times its height', () => {
    expect(estimatedSizeMm({ columns: 10, rows: 20 }, cube, 'loom')).toEqual({ widthMm: 15, heightMm: 30 })
    expect(estimatedSizeMm({ columns: 20, rows: 10 }, delica, 'loom').widthMm).toBeCloseTo(26)
    expect(estimatedSizeMm({ columns: 20, rows: 10 }, delica, 'loom').heightMm).toBeCloseTo(16)
  })

  it('lays the Bead as its Technique does: the same on peyote, turned on brick stitch (ticket 0734)', () => {
    expect(estimatedSizeMm({ columns: 20, rows: 10 }, delica, 'peyote')).toEqual(estimatedSizeMm({ columns: 20, rows: 10 }, delica, 'loom'))
    // Ten columns a diameter wide and ten rows a length plus slack tall: TOHO Round 11/0 is 22 mm across, 16.5 down.
    expect(estimatedSizeMm({ columns: 10, rows: 10 }, round, 'brick')).toEqual({ widthMm: expect.closeTo(22), heightMm: expect.closeTo(16.5) })
    expect(estimatedSizeMm({ columns: 10, rows: 10 }, round, 'loom')).toEqual({ widthMm: expect.closeTo(16.5), heightMm: expect.closeTo(22) })
  })

  it("includes TOHO Round 11/0's width correction in every column", () => {
    const size = estimatedSizeMm({ columns: 9, rows: 73 }, round, 'loom')
    expect(size.widthMm).toBeCloseTo(14.85)
    expect(size.heightMm).toBeCloseTo(160.6)
  })

  it('swaps width and height for a Project rotated a quarter turn either way, like the grid summary does', () => {
    expect(estimatedSizeMm(bareProject({ orientation: 90, frame: { technique: 'loom', row: 0, column: 0, columns: 10, rows: 20, beads: {} } }), cube)).toEqual({ widthMm: 30, heightMm: 15 })
    expect(estimatedSizeMm(bareProject({ orientation: 270, frame: { technique: 'loom', row: 0, column: 0, columns: 10, rows: 20, beads: {} } }), cube)).toEqual({ widthMm: 30, heightMm: 15 })
  })

  it('leaves width and height as they are for a Project upside down (180°, ticket 171)', () => {
    expect(estimatedSizeMm(bareProject({ orientation: 180, frame: { technique: 'loom', row: 0, column: 0, columns: 10, rows: 20, beads: {} } }), cube)).toEqual({ widthMm: 15, heightMm: 30 })
  })

  it('is the inverse of the mm conversion, so a stated size estimates back to about itself', () => {
    for (const technique of ['loom', 'peyote', 'brick'] as const) {
      for (const bead of BEAD_CATALOG) {
        const dimensions = gridFromSize({ width: 30, height: 60, unit: 'mm' }, bead, technique)
        const estimate = estimatedSizeMm(dimensions, bead, technique)
        const room = Math.max(bead.widthMm + (bead.widthCorrectionMm ?? 0), bead.heightMm)
        expect(Math.abs(estimate.widthMm - 30)).toBeLessThanOrEqual(room)
        expect(Math.abs(estimate.heightMm - 60)).toBeLessThanOrEqual(room)
      }
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

describe('formatSizeInMm (ticket 0687)', () => {
  it('stays in mm however large, at most one decimal, in the language’s decimal sign', () => {
    expect(formatSizeInMm({ widthMm: 120, heightMm: 80.25 }, 'mm')).toBe('120 × 80.3 mm')
    expect(formatSizeInMm({ widthMm: 2.6, heightMm: 2.6 }, 'mm')).toBe('2.6 × 2.6 mm')
    expect(formatSizeInMm({ widthMm: 16.5, heightMm: 44 }, 'мм', 'ru')).toBe('16,5 × 44 мм')
    // A Round 11/0's pitch, 1.5 + 0.15, lies just under 1.65 as a float; it still rounds half up.
    expect(formatSizeInMm({ widthMm: 1.5 + 0.15, heightMm: 2.2 }, 'mm')).toBe('1.7 × 2.2 mm')
  })
})

describe('formatMm (ticket 342)', () => {
  it('shows at most one decimal and drops a trailing .0', () => {
    expect(formatMm(10.5)).toBe('10.5')
    expect(formatMm(15)).toBe('15')
    expect(formatMm(16.5 * 1.1)).toBe('18.2')
  })

  it("uses the language's decimal sign", () => {
    expect(formatMm(10.5, 'ru')).toBe('10,5')
  })
})

describe('isSizeStated (ticket 342)', () => {
  it('wants both sides above zero, and whole numbers in beads', () => {
    expect(isSizeStated(10, 20, 'beads')).toBe(true)
    expect(isSizeStated(0, 20, 'beads')).toBe(false)
    expect(isSizeStated(2.5, 20, 'beads')).toBe(false)
    expect(isSizeStated(2.5, 20, 'mm')).toBe(true)
  })
})

describe('a Custom frame\'s Estimated size (ticket 0592)', () => {
  const triangle = { row: 0, column: 0, ...customFrameSize('triangle', { rounds: 6 }), technique: 'peyote' as const, shape: 'triangle' as const, settings: { rounds: 6 } }

  it('measures its shape, a Triangle standing on its side, not the cells of its bounding rectangle', () => {
    const { widthMm, heightMm } = estimatedSizeMm(triangle, cube, 'peyote')
    expect(widthMm / heightMm).toBeCloseTo(2 / Math.sqrt(3), 1)
    expect(heightMm).not.toBeCloseTo(triangle.rows * cube.heightMm, 1)
  })

  it('grows with its Rounds', () => {
    const larger = { ...triangle, ...customFrameSize('triangle', { rounds: 9 }), settings: { rounds: 9 } }
    expect(estimatedSizeMm(larger, cube, 'peyote').widthMm).toBeGreaterThan(estimatedSizeMm(triangle, cube, 'peyote').widthMm)
  })
})
