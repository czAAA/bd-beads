import { describe, expect, it } from 'vitest'
import type { Rotation } from '../domain/grid'
import type { Technique } from '../domain/weave'
import { COVER_BEAD_MAX, coverLayout } from './coverLayout'
import { A4_PORTRAIT, mm, PRINT_BOARD_PAD, PRINT_MARGIN, PRINT_RULER } from './printPlan'
import { CELL_SIZE_PX } from './surfaceView'

const shape = (technique: Technique, columns: number, rows: number, rotation: Rotation = 0) => ({ technique, rotation, beads: {}, frame: { technique, row: 0, column: 0, columns, rows, beads: {} } })
const colorsOf = (count: number, letter?: string) => Array.from({ length: count }, (_, index) => ({ hex: '#000000', name: `Color ${index}`, beads: '10', ...(letter ? { letter } : {}) }))
const words = (colors: number, name = 'Scarf', maker = '') => ({ name, maker, colors: colorsOf(colors) })

const page = A4_PORTRAIT
const inset = PRINT_RULER + PRINT_BOARD_PAD
const fullWidth = page.width - PRINT_MARGIN * 2 - inset * 2

// The Cover page's layout for both formats (ticket 0583; glossary: Cover page).
describe('coverLayout: the title block', () => {
  it('leaves out the name and the maker when they are empty, so Schema and Beads needed rise', () => {
    const both = coverLayout(shape('loom', 20, 20), words(5, 'Scarf', 'Ada'))
    const neither = coverLayout(shape('loom', 20, 20), words(5, '   ', ''))

    expect(neither.titleHeight).toBeLessThan(both.titleHeight)
    expect(neither.titleHeight).toBeCloseTo(mm(10))
    expect(both.titleHeight - neither.titleHeight).toBeCloseTo(mm(17))
  })

})

describe('coverLayout: the Schema', () => {
  it('caps a small Schema’s bead at about 6 mm and centres the picture in its area', () => {
    const layout = coverLayout(shape('loom', 8, 8), words(3))

    expect(layout.zoom).toBeCloseTo(COVER_BEAD_MAX / CELL_SIZE_PX)
    expect(layout.board.x + layout.extent.width / 2).toBeCloseTo(page.width / 2)
    const above = layout.board.y - inset - PRINT_MARGIN - layout.titleHeight
    const below = layout.cover.y - (layout.board.y + layout.extent.height + inset)
    expect(above).toBeGreaterThan(below)
  })

  it('moves Beads needed up under a small Schema at an even gap, whatever its size', () => {
    const gap = (columns: number) => {
      const layout = coverLayout(shape('loom', columns, columns), words(3))
      return layout.cover.y - (layout.board.y + layout.extent.height + inset)
    }

    expect(gap(6)).toBeCloseTo(gap(12))
  })

  it('fits a wide flat Schema to the page width', () => {
    const layout = coverLayout(shape('loom', 300, 24), words(5))

    expect(layout.extent.width).toBeCloseTo(fullWidth)
  })

  it('scales a big Schema down to fit, with no minimum bead, inside the margins', () => {
    const layout = coverLayout(shape('peyote', 250, 250), words(12))

    expect(layout.zoom).toBeLessThan(COVER_BEAD_MAX / CELL_SIZE_PX)
    expect(layout.board.x + layout.extent.width).toBeLessThanOrEqual(page.width - PRINT_MARGIN)
    expect(layout.cover.y).toBeGreaterThan(layout.board.y + layout.extent.height)
    expect(layout.board.y - inset).toBeGreaterThanOrEqual(PRINT_MARGIN + layout.titleHeight)
  })
})

describe('coverLayout: Beads needed', () => {
  it('reads in two columns, so rows are half the colors, rounded up', () => {
    expect(coverLayout(shape('loom', 80, 60), words(7)).cover.rows).toBe(4)
  })

  it('keeps all of a short list on the cover, with its Total, and makes no list page', () => {
    const layout = coverLayout(shape('loom', 60, 60), words(10))

    expect(layout.cover).toMatchObject({ from: 0, count: 10, total: true })
    expect(layout.lists).toEqual([])
  })

  it('continues a long list on a list page, with the Total on the last', () => {
    const layout = coverLayout(shape('loom', 60, 60), words(120))

    expect(layout.cover.total).toBe(false)
    expect(layout.lists.length).toBeGreaterThanOrEqual(1)
    expect(layout.cover.count + layout.lists.reduce((sum, list) => sum + list.count, 0)).toBe(120)
    expect(layout.lists.map((list) => list.total)).toEqual(layout.lists.map((_, index) => index === layout.lists.length - 1))
    expect(layout.lists[0]!.from).toBe(layout.cover.count)
  })

  it('spreads a very long list over more list pages in order', () => {
    const layout = coverLayout(shape('loom', 60, 60), words(400))

    expect(layout.lists.length).toBeGreaterThan(1)
    layout.lists.forEach((list, index) => {
      if (index > 0) expect(list.from).toBe(layout.lists[index - 1]!.from + layout.lists[index - 1]!.count)
    })
  })

  it('never lets Beads needed run past the footer', () => {
    for (const colors of [0, 3, 40, 70]) {
      const layout = coverLayout(shape('loom', 100, 100), words(colors))
      expect(layout.cover.y + mm(6) + layout.cover.rows * layout.cover.rowHeight).toBeLessThanOrEqual(page.height - PRINT_MARGIN - mm(6))
    }
  })
})
