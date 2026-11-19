import { describe, expect, it } from 'vitest'
import type { Rotation } from '../domain/grid'
import type { Technique } from '../domain/weave'
import { overviewLayout as layoutOf, type TableRows } from './overviewLayout'
import { A4_PORTRAIT, mm, PRINT_BOARD_PAD, PRINT_MARGIN, PRINT_RULER } from './printPlan'
import { bareProject } from '../testUtils/layerFields'

const shape = (technique: Technique, columns: number, rows: number, rotation: Rotation = 0) => bareProject({ technique, orientation: rotation, beads: {}, frame: { technique, row: 0, column: 0, columns, rows, beads: {} } })
const colorsOf = (count: number, letter?: string) => Array.from({ length: count }, (_, index) => ({ hex: '#000000', name: `Color ${index}`, beads: '10', ...(letter ? { letter } : {}) }))
const words = (colors: number, name = 'Scarf', maker = '') => ({ name, maker, colors: colorsOf(colors) })
/** Page 1's Beads needed: its heading and column heads, a row, and the Total with the grams note. */
const TABLE: TableRows = { head: mm(10.5), row: mm(5), end: mm(14) }
const overviewLayout = (project: Parameters<typeof layoutOf>[0], wordsOf: Parameters<typeof layoutOf>[1]) => layoutOf(project, wordsOf, TABLE)

const page = A4_PORTRAIT
const inset = PRINT_RULER + PRINT_BOARD_PAD
const fullWidth = page.width - PRINT_MARGIN * 2 - inset * 2

// Page 1 as the overview of a piece cut into parts, and its list pages (tickets 0583, 0914).
describe('overviewLayout: the title block', () => {
  it('leaves out the name and the maker when they are empty, so Schema and Beads needed rise', () => {
    const both = overviewLayout(shape('loom', 20, 20), words(5, 'Scarf', 'Ada'))
    const neither = overviewLayout(shape('loom', 20, 20), words(5, '   ', ''))

    expect(neither.titleHeight).toBeLessThan(both.titleHeight)
    expect(neither.titleHeight).toBeCloseTo(mm(10))
    expect(both.titleHeight - neither.titleHeight).toBeCloseTo(mm(17))
  })

})

describe('overviewLayout: the Schema', () => {
  it('centres the piece in its area, Beads needed under it', () => {
    const layout = overviewLayout(shape('loom', 150, 150), words(3))

    expect(layout.board.x + layout.extent.width / 2).toBeCloseTo(page.width / 2)
    expect(layout.needed.y).toBeGreaterThan(layout.board.y + layout.extent.height)
  })

  it('keeps Beads needed under the piece at an even gap, whatever its size', () => {
    const gap = (rows: number) => {
      const layout = overviewLayout(shape('loom', 300, rows), words(3))
      return layout.needed.y - (layout.board.y + layout.extent.height + inset)
    }

    expect(gap(24)).toBeCloseTo(gap(40))
  })

  it('fits a wide flat Schema to the page width', () => {
    const layout = overviewLayout(shape('loom', 300, 24), words(5))

    expect(layout.extent.width).toBeCloseTo(fullWidth)
  })

  it('scales a big Schema down to fit, with no minimum bead, inside the margins', () => {
    const layout = overviewLayout(shape('peyote', 250, 250), words(12))

    expect(layout.board.x + layout.extent.width).toBeLessThanOrEqual(page.width - PRINT_MARGIN)
    expect(layout.needed.y).toBeGreaterThan(layout.board.y + layout.extent.height)
    expect(layout.board.y - inset).toBeGreaterThanOrEqual(PRINT_MARGIN + layout.titleHeight)
  })
})

describe('overviewLayout: Beads needed', () => {
  it('reads in two columns, so rows are half the colors, rounded up', () => {
    expect(overviewLayout(shape('loom', 80, 60), words(7)).needed.rows).toBe(4)
  })

  it('keeps all of a short list on page 1, with its Total, and makes no list page', () => {
    const layout = overviewLayout(shape('loom', 60, 60), words(10))

    expect(layout.needed).toMatchObject({ from: 0, count: 10, total: true })
    expect(layout.lists).toEqual([])
  })

  it('continues a long list on a list page, with the Total on the last', () => {
    const layout = overviewLayout(shape('loom', 60, 60), words(120))

    expect(layout.needed.total).toBe(false)
    expect(layout.lists.length).toBeGreaterThanOrEqual(1)
    expect(layout.needed.count + layout.lists.reduce((sum, list) => sum + list.count, 0)).toBe(120)
    expect(layout.lists.map((list) => list.total)).toEqual(layout.lists.map((_, index) => index === layout.lists.length - 1))
    expect(layout.lists[0]!.from).toBe(layout.needed.count)
  })

  it('spreads a very long list over more list pages in order', () => {
    const layout = overviewLayout(shape('loom', 60, 60), words(400))

    expect(layout.lists.length).toBeGreaterThan(1)
    layout.lists.forEach((list, index) => {
      if (index > 0) expect(list.from).toBe(layout.lists[index - 1]!.from + layout.lists[index - 1]!.count)
    })
  })

  it('never lets Beads needed run past the footer', () => {
    for (const colors of [0, 3, 40, 70]) {
      const layout = overviewLayout(shape('loom', 100, 100), words(colors))
      expect(layout.needed.y + mm(6) + layout.needed.rows * layout.needed.rowHeight).toBeLessThanOrEqual(page.height - PRINT_MARGIN - mm(6))
    }
  })
})
