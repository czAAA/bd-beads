import { describe, expect, it } from 'vitest'
import type { Technique } from '../domain/weave'
import { pageOneLayout } from './pageOneLayout'
import { A4_PORTRAIT, chartOnPageOne, mm, PRINT_MARGIN } from './printPlan'
import { bareProject } from '../testUtils/layerFields'

const shape = (technique: Technique, columns: number, rows: number) => bareProject({ technique, orientation: 0, beads: {}, frame: { technique, row: 0, column: 0, columns, rows, beads: {} } })
const words = (colors: number, name = 'Mandala', maker = 'Anna K.') => ({ name, maker, colors: Array.from({ length: colors }, (_, index) => ({ hex: '#000000', name: `Color ${index}`, beads: '10' })) })
const bottomOf = (layout: ReturnType<typeof pageOneLayout>) => layout.needed.y + mm(10.5) + layout.needed.rows * layout.needed.rowHeight + (layout.needed.total ? mm(14) : 0)

// Page 1 of the PDF (ticket 0914; PrintPage1 card): the title block, the whole piece and one Beads needed table.
describe('pageOneLayout: the chart whole on page 1', () => {
  it('makes a 100 × 100 in 8 colors one page: the chart at 1.8 mm with all of Beads needed under it', () => {
    const layout = pageOneLayout(shape('loom', 100, 100), words(8))

    expect(chartOnPageOne(layout.plan)).toBe(true)
    expect(layout.overview).toBeUndefined()
    expect(layout.plan.beadMm).toBeCloseTo(1.8, 2)
    expect(layout.needed).toMatchObject({ from: 0, count: 8, rows: 4, total: true })
    expect(layout.lists).toEqual([])
    expect(layout.plan.pageCount).toBe(1)
    expect(bottomOf(layout)).toBeLessThanOrEqual(A4_PORTRAIT.height - PRINT_MARGIN - mm(6))
  })

  it('fills the page width with a 20 × 20 at 9 mm, and centres a 5 × 5 at 9 mm', () => {
    const wide = pageOneLayout(shape('loom', 20, 20), words(5))
    expect(wide.plan.beadMm).toBeCloseTo(9, 2)
    expect(wide.plan.parts[0]!.place.width).toBeCloseTo(A4_PORTRAIT.width - PRINT_MARGIN * 2, 0)

    const small = pageOneLayout(shape('loom', 5, 5), words(2))
    const { place } = small.plan.parts[0]!
    expect(small.plan.beadMm).toBeCloseTo(9, 2)
    expect(place.x).toBeCloseTo((A4_PORTRAIT.width - PRINT_MARGIN * 2 - place.width) / 2, 3)
  })

  it('sets Beads needed under the chart, at the top of the room it leaves', () => {
    const layout = pageOneLayout(shape('loom', 40, 20), words(3))
    const [part] = layout.plan.parts
    // The pad: the beads and a ruler band on each side.
    const chartBottom = layout.area.y + part!.place.y + part!.region.height + mm(10)

    expect(layout.area.y).toBeCloseTo(PRINT_MARGIN + layout.titleHeight)
    expect(layout.needed.y - chartBottom).toBeCloseTo(mm(4))
  })

  it('keeps a small piece in many colors on one page, its bead smaller, while Beads needed takes no more than its share', () => {
    const layout = pageOneLayout(shape('loom', 20, 20), words(24))

    expect(layout.plan.pageCount).toBe(1)
    expect(layout.needed).toMatchObject({ count: 24, total: true })
    expect(layout.plan.beadMm).toBeLessThan(9)
    expect(bottomOf(layout)).toBeLessThanOrEqual(A4_PORTRAIT.height - PRINT_MARGIN - mm(6) + 1)
  })

  it('carries on the colors that do not fit under a full chart on a list page, the Total ending the last', () => {
    const layout = pageOneLayout(shape('loom', 100, 100), words(60))

    expect(chartOnPageOne(layout.plan)).toBe(true)
    expect(layout.plan.beadMm).toBeGreaterThanOrEqual(1.6)
    expect(layout.needed.total).toBe(false)
    expect(layout.needed.count).toBeGreaterThan(0)
    expect(layout.lists.length).toBeGreaterThan(0)
    expect(layout.lists.at(-1)!.total).toBe(true)
    expect(layout.lists[0]!.from).toBe(layout.needed.count)
    expect(layout.lists.reduce((sum, list) => sum + list.count, layout.needed.count)).toBe(60)
    expect(layout.plan.pageCount).toBe(1 + layout.lists.length)
  })

  it('folds a 35 × 120 bracelet into two strips side by side on page 1', () => {
    const layout = pageOneLayout(shape('loom', 35, 120), words(4))

    expect(layout.plan.parts.map((part) => part.page)).toEqual([1, 1])
    expect(layout.plan.pageCount).toBe(1)
  })
})

describe('pageOneLayout: the overview', () => {
  it('makes page 1 the overview of a piece that does not fit it, and numbers the parts after it', () => {
    const layout = pageOneLayout(shape('loom', 150, 100), words(8))

    expect(chartOnPageOne(layout.plan)).toBe(false)
    expect(layout.overview).toBeDefined()
    expect(Math.min(...layout.plan.parts.map((part) => part.page))).toBe(2)
    expect(layout.plan.pageCount).toBe(3)
    expect(layout.needed).toMatchObject({ count: 8, total: true })
  })

  it('puts the list pages straight after the overview, before the parts', () => {
    const layout = pageOneLayout(shape('loom', 150, 100), words(120))

    expect(layout.lists.length).toBeGreaterThan(0)
    expect(Math.min(...layout.plan.parts.map((part) => part.page))).toBe(2 + layout.lists.length)
    expect(layout.plan.pageCount).toBe(1 + layout.lists.length + 2)
  })
})

describe('pageOneLayout: Large beads (ticket 0916)', () => {
  const large = (colors: number) => ({ ...words(colors), largeBeads: true })

  it('makes a 100 × 100 the overview and parts, no bead under 3 mm', () => {
    const layout = pageOneLayout(shape('loom', 100, 100), large(8))

    expect(chartOnPageOne(layout.plan)).toBe(false)
    expect(layout.overview).toBeDefined()
    expect(layout.plan.beadMm).toBeGreaterThanOrEqual(3 - 1e-9)
    expect(layout.plan.pageCount).toBeGreaterThan(1)
  })

  it('keeps a piece whole on page 1 while it fits there at 3 mm, at the same bead as without', () => {
    const plain = pageOneLayout(shape('loom', 40, 40), words(4))
    const layout = pageOneLayout(shape('loom', 40, 40), large(4))

    expect(chartOnPageOne(layout.plan)).toBe(true)
    expect(layout.plan.beadMm).toBeCloseTo(plain.plan.beadMm, 6)
  })
})
