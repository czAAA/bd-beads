import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import BeadQuantities from './BeadQuantities.vue'
import { BEAD_CATALOG } from '../domain/beads'
import { createPattern, paintCells, type Pattern } from '../domain/pattern'

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
  it('has exactly two columns: a color swatch and a bead count', () => {
    const wrapper = mountQuantities(paintCells(pattern(), [{ row: 0, column: 0 }], '#e63746', { horizontal: false, vertical: false }))

    expect(wrapper.findAll('th')).toHaveLength(2)
    const row = wrapper.find('[data-testid="quantity-row"]')
    expect(row.findAll('td')).toHaveLength(2)
    expect(wrapper.find('[data-testid="quantity-count-red"]').text()).toBe('1')
  })

  it('reports how many beads each painted color needs', () => {
    const withTwoColors = paintCells(paintCells(pattern(), [{ row: 0, column: 0 }], '#e63746', { horizontal: false, vertical: false }), [{ row: 0, column: 1 }], '#2f6fed', { horizontal: false, vertical: false })
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
    const wrapper = mountQuantities(paintCells(pattern(), [{ row: 0, column: 0 }], '#123456', { horizontal: false, vertical: false }))

    expect(wrapper.find('[data-testid="quantity-count-#123456"]').text()).toBe('1')
  })

  it('shows no bead pickers or bead names', () => {
    const wrapper = mountQuantities(paintCells(pattern(), [{ row: 0, column: 0 }], '#e63746', { horizontal: false, vertical: false }))

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
