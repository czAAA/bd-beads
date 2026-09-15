import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import BeadQuantities from './BeadQuantities.vue'
import { BEAD_CATALOG, beadLabel } from '../domain/beads'
import { createPattern, paintCell, setColorBeadOverride, type Pattern } from '../domain/pattern'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho-cube-1.5mm')!
const delicaBead = BEAD_CATALOG.find((bead) => bead.id === 'miyuki-delica-11-0')!

function pattern(): Pattern {
  return createPattern({
    technique: 'loom',
    beadId: cubeBead.id,
    size: { width: 15, height: 15, unit: 'mm' },
  })
}

function mountQuantities(pattern: Pattern | undefined, defaults: Record<string, string> = {}) {
  return mount(BeadQuantities, { props: { pattern, beads: [...BEAD_CATALOG], defaults } })
}

describe('BeadQuantities', () => {
  it('asks for a bead per color and reports what the Pattern needs', () => {
    const wrapper = mountQuantities(paintCell(pattern(), 0, 0, '#e63746'), {
      red: cubeBead.id,
    })

    expect(wrapper.find('[data-testid="quantity-count-red"]').text()).toBe('1')
    expect(
      wrapper.find<HTMLSelectElement>('[data-testid="quantity-default-red"]').element.value,
    ).toBe(cubeBead.id)
  })

  it('reports a color painted from outside the Palette, with nothing to map it to', () => {
    // Only reachable from an imported file: the app's own painting is Palette-only.
    const wrapper = mountQuantities(paintCell(pattern(), 0, 0, '#123456'))

    expect(wrapper.find('[data-testid="quantity-count-#123456"]').text()).toBe('1')
    expect(wrapper.find('[data-testid="quantity-unknown-color"]').exists()).toBe(true)
  })

  it('shows which Bead a color actually resolves to, override first then global default', () => {
    const overridden = setColorBeadOverride(paintCell(pattern(), 0, 0, '#e63746'), 'red', delicaBead.id)
    const wrapper = mountQuantities(overridden, { red: cubeBead.id, blue: cubeBead.id })

    expect(wrapper.find('[data-testid="quantity-bead-red"]').text()).toBe(beadLabel(delicaBead))
    expect(wrapper.find('[data-testid="quantity-bead-blue"]').text()).toBe(beadLabel(cubeBead))
  })

  it('shows a dash for a color pointed at no Bead at all', () => {
    const wrapper = mountQuantities(pattern())

    expect(wrapper.find('[data-testid="quantity-bead-red"]').text()).toBe('—')
  })

  it('lets a Bead be chosen for a color before it is ever painted', () => {
    const wrapper = mountQuantities(pattern())

    expect(wrapper.find('[data-testid="quantity-default-green"]').exists()).toBe(true)
  })

  it('still maps colors to Beads with no Pattern open, minus the per-Pattern column', () => {
    const wrapper = mountQuantities(undefined)

    expect(wrapper.find('[data-testid="quantity-default-red"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="quantity-override-red"]').exists()).toBe(false)
  })

  it('asks the app to map a color, rather than mapping it itself', async () => {
    const wrapper = mountQuantities(paintCell(pattern(), 0, 0, '#e63746'))

    await wrapper.find('[data-testid="quantity-default-red"]').setValue(cubeBead.id)
    await wrapper.find('[data-testid="quantity-override-red"]').setValue('')

    expect(wrapper.emitted('set-default')).toEqual([['red', cubeBead.id]])
    expect(wrapper.emitted('set-override')).toEqual([['red', null]])
  })
})
