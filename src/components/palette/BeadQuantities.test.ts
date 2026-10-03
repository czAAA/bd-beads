import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import BeadQuantities from './BeadQuantities.vue'
import { BEAD_CATALOG } from '../../domain/beads'
import { createPattern, paintCells, type Pattern } from '../../domain/pattern'
import { fakeMatchMedia } from '../../testUtils/fakeMatchMedia'

beforeEach(() => localStorage.setItem('bd-beads:locale', 'en'))

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho-cube-1.5mm')!

function pattern(): Pattern {
  return createPattern({
    technique: 'loom',
    beadId: cubeBead.id,
    size: { width: 15, height: 15, unit: 'mm' },
  })
}

function mountQuantities(pattern: Pattern | undefined) {
  return mount(BeadQuantities, { props: { pattern } })
}

describe('BeadQuantities', () => {
  it('has three columns: a color swatch, a bead count and its estimated weight', () => {
    const wrapper = mountQuantities(paintCells(pattern(), [{ row: 0, column: 0 }], '#e63746', { columns: 0, rows: 0 }))

    expect(wrapper.findAll('thead th')).toHaveLength(3)
    const row = wrapper.find('[data-testid="quantity-row"]')
    expect(row.findAll('td')).toHaveLength(3)
    expect(wrapper.find('[data-testid="quantity-count-red"]').text()).toBe('1')
  })

  it('reports how many beads each painted color needs', () => {
    const withTwoColors = paintCells(paintCells(pattern(), [{ row: 0, column: 0 }], '#e63746', { columns: 0, rows: 0 }), [{ row: 0, column: 1 }], '#2f6fed', { columns: 0, rows: 0 })
    const wrapper = mountQuantities(withTwoColors)

    expect(wrapper.find('[data-testid="quantity-count-red"]').text()).toBe('1')
    expect(wrapper.find('[data-testid="quantity-count-blue"]').text()).toBe('1')
  })

  it('lists only colors painted at least once, most-needed first', () => {
    const wrapper = mountQuantities(pattern())

    expect(wrapper.findAll('[data-testid="quantity-row"]')).toHaveLength(0)
  })

  it('reports a color painted from outside the Palette, with its swatch and count', () => {
    // Only reachable from an imported file: the app's own painting is Palette-only.
    const wrapper = mountQuantities(paintCells(pattern(), [{ row: 0, column: 0 }], '#123456', { columns: 0, rows: 0 }))

    expect(wrapper.find('[data-testid="quantity-count-#123456"]').text()).toBe('1')
  })

  it('shows no bead pickers or bead names', () => {
    const wrapper = mountQuantities(paintCells(pattern(), [{ row: 0, column: 0 }], '#e63746', { columns: 0, rows: 0 }))

    expect(wrapper.find('select').exists()).toBe(false)
  })

  it('shows the "open a Pattern" message with no Pattern open', () => {
    const wrapper = mountQuantities(undefined)

    expect(wrapper.find('[data-testid="quantities-no-pattern"]').exists()).toBe(true)
    expect(wrapper.find('table').exists()).toBe(false)
  })

  it('shows a "nothing painted yet" message for an unpainted Pattern', () => {
    const wrapper = mountQuantities(pattern())

    expect(wrapper.find('[data-testid="quantities-empty"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="quantities-no-pattern"]').exists()).toBe(false)
    expect(wrapper.find('table').exists()).toBe(false)
  })
})

describe('BeadQuantities estimated weight (ticket 155)', () => {
  const cells = (count: number) => Array.from({ length: count }, (_, column) => ({ row: 0, column }))
  const noMirror = { columns: 0, rows: 0 }

  function wide(beadId: string, painted: number, color = '#e63746'): Pattern {
    const base = createPattern({ technique: 'loom', beadId, size: { width: 1000, height: 5, unit: 'beads' } })
    return paintCells(base, cells(painted), color, noMirror)
  }

  it.each([
    ['toho-cube-1.5mm', '1.08 g', 'Cube'],
    ['toho-round-11-0', '0.91 g', 'Round'],
    ['miyuki-delica-11-0', '0.50 g', 'Delica'],
  ])('shows a weight for 100 %s beads: %s (%s)', (beadId, weight) => {
    const wrapper = mountQuantities(wide(beadId, 100))

    expect(wrapper.find('[data-testid="quantity-weight-red"]').text()).toBe(weight)
    expect(wrapper.find('[data-testid="quantity-total-weight"]').text()).toBe(weight)
  })

  it('shows the weight per color and a total across colors', () => {
    const two = paintCells(wide('toho-cube-1.5mm', 100), cells(50).map((cell) => ({ ...cell, row: 1 })), '#2f6fed', noMirror)
    const wrapper = mountQuantities(two)

    expect(wrapper.find('[data-testid="quantity-weight-red"]').text()).toBe('1.08 g')
    expect(wrapper.find('[data-testid="quantity-weight-blue"]').text()).toBe('0.54 g')
    expect(wrapper.find('[data-testid="quantity-total-count"]').text()).toBe('150')
    expect(wrapper.find('[data-testid="quantity-total-weight"]').text()).toBe('1.62 g')
  })

  it('shows the header as count × average weight per bead ≈ the total, with the info trigger right after it (ticket 178)', () => {
    const wrapper = mountQuantities(wide('toho-cube-1.5mm', 100))

    expect(wrapper.find('[data-testid="quantity-total-count"]').text()).toBe('100')
    expect(wrapper.find('[data-testid="quantity-avg-weight"]').text()).toBe('0.0108g')
    expect(wrapper.find('[data-testid="quantity-total-weight"]').text()).toBe('1.08 g')

    // The info tooltip trigger sits right after the total weight's "g", inside the same suffix, not off at the
    // panel header's far right (ticket 178).
    const suffix = wrapper.find('.expandable-panel__suffix')
    expect(suffix.find('[data-testid="quantities-weight-info"]').exists()).toBe(true)
    expect(wrapper.find('.expandable-panel__meta [data-testid="quantities-weight-info"]').exists()).toBe(false)
  })

  it('shows the average weight per bead with the Russian decimal comma too (ticket 178)', () => {
    localStorage.setItem('bd-beads:locale', 'ru')
    const wrapper = mountQuantities(wide('toho-cube-1.5mm', 100))

    expect(wrapper.find('[data-testid="quantity-avg-weight"]').text()).toBe('0,0108г')
  })

  it('rounds to one decimal from 10 g up and says "< 0.01 g" for a color too small to weigh', () => {
    // 1000 beads x 0.0108 g = 10.8 g
    const heavy = mountQuantities(wide('toho-cube-1.5mm', 1000))
    expect(heavy.find('[data-testid="quantity-weight-red"]').text()).toBe('10.8 g')

    const tiny = mountQuantities(wide('miyuki-delica-11-0', 1))
    expect(tiny.find('[data-testid="quantity-weight-red"]').text()).toBe('< 0.01 g')
  })

  it('hides the weights, not shows zeros, when the Pattern\'s Bead has no weight', () => {
    const unknown = { ...wide('toho-cube-1.5mm', 10), beadId: 'a-bead-this-device-never-had' }
    const wrapper = mountQuantities(unknown)

    expect(wrapper.find('[data-testid="quantity-count-red"]').text()).toBe('10')
    expect(wrapper.find('[data-testid="quantity-weight-red"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="quantity-total-weight"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="quantities-weight-info"]').exists()).toBe(false)
  })

  it('shows no weight for a Pattern with no colors painted', () => {
    const wrapper = mountQuantities(pattern())

    expect(wrapper.find('[data-testid="quantities-weight-info"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="quantity-total-weight"]').exists()).toBe(false)
  })

  it('explains the estimate in a tooltip on hover and keyboard focus, with the Bead\'s average weight', async () => {
    const wrapper = mountQuantities(wide('toho-round-11-0', 10))
    const info = wrapper.find('[data-testid="quantities-weight-info"]')
    const tooltip = wrapper.find('[data-testid="quantities-weight-tooltip"]')
    const shown = () => (tooltip.element as HTMLElement).style.display !== 'none'

    expect(shown()).toBe(false)
    await info.trigger('mouseenter')
    expect(shown()).toBe(true)
    expect(tooltip.text()).toBe(
      'This is bead count × about 0.0091 g per bead. That average comes from seller listings, not confirmed measurements. Real beads vary, so buy a little extra.',
    )
    await info.trigger('mouseleave')
    expect(shown()).toBe(false)
    await info.trigger('focus')
    expect(shown()).toBe(true)
    await info.trigger('keydown', { key: 'Escape' })
    expect(shown()).toBe(false)
    expect(info.attributes('aria-describedby')).toBe(tooltip.attributes('id'))
  })

  describe('at the 24″ and larger tier (ticket 83; responsive.md, bp-desktop)', () => {
    afterEach(() => vi.unstubAllGlobals())

    function withColors(count: number): Pattern {
      const hexes = ['#e63746', '#2f6fed', '#22aa55', '#f5c518', '#8e44ad', '#ff8800', '#00bcd4']
      return hexes
        .slice(0, count)
        .reduce((p, hex, column) => paintCells(p, [{ row: 0, column }], hex, { columns: 0, rows: 0 }), pattern())
    }

    it('holds five color rows before it needs expanding: four colors are not expandable, six are', () => {
      vi.stubGlobal('matchMedia', fakeMatchMedia({ '(min-width: 1920px)': true }).matchMedia)

      expect(mountQuantities(withColors(4)).find('[data-testid="panel-expand"]').exists()).toBe(false)
      expect(mountQuantities(withColors(5)).find('[data-testid="panel-expand"]').exists()).toBe(false)
      expect(mountQuantities(withColors(6)).find('[data-testid="panel-expand"]').exists()).toBe(true)
    })

    it('holds three rows below that tier: four colors already expand', () => {
      vi.stubGlobal('matchMedia', fakeMatchMedia({ '(min-width: 1920px)': false }).matchMedia)

      expect(mountQuantities(withColors(3)).find('[data-testid="panel-expand"]').exists()).toBe(false)
      expect(mountQuantities(withColors(4)).find('[data-testid="panel-expand"]').exists()).toBe(true)
    })
  })
})

describe('BeadQuantities and the Frame (ticket 233)', () => {
  it('counts the Frame only, leaving out beads that lie outside it', () => {
    const framed = paintCells(pattern(), [{ row: 0, column: 0 }], '#e63746', { columns: 0, rows: 0 })
    const withOutsider = { ...framed, beads: { ...framed.beads, 40: { 40: '#e63746' } } }
    const wrapper = mountQuantities(withOutsider)

    expect(wrapper.find('[data-testid="quantity-count-red"]').text()).toBe('1')
  })

  it('keeps its header and says "Set Frame to count beads." with no Frame', () => {
    const { frame: _frame, ...open } = paintCells(pattern(), [{ row: 0, column: 0 }], '#e63746', { columns: 0, rows: 0 })
    const wrapper = mountQuantities(open)

    expect(wrapper.find('[data-testid="quantities-needs-frame"]').text()).toBe('Set Frame to count beads.')
    expect(wrapper.find('table').exists()).toBe(false)
    expect(wrapper.text()).toContain('Beads needed')
  })
})
