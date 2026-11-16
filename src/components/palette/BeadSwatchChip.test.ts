import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import BeadSwatchChip from './BeadSwatchChip.vue'
import { en } from '../../i18n/en'

beforeEach(() => {
  localStorage.setItem('openbeads:locale', 'en')
})

describe('BeadSwatchChip (ticket 0905)', () => {
  it('marks an approximate swatch and says so in its Tooltip, hidden from screen readers (the row names it)', async () => {
    const wrapper = mount(BeadSwatchChip, { props: { hex: '#c9d2da', approximate: true } })
    expect(wrapper.get('.bead-swatch-chip').classes()).toContain('bead-swatch-chip--approximate')
    expect(wrapper.get('.bead-swatch-chip').attributes('aria-hidden')).toBe('true')
    expect(wrapper.get('.app-tooltip__name').text()).toBe(en.palette.beadColors.approximateName)
    expect(wrapper.get('.app-tooltip__body').text()).toBe(en.palette.beadColors.approximateBody)
  })

  it('leaves a measured swatch plain, with its own Tooltip', () => {
    const wrapper = mount(BeadSwatchChip, { props: { hex: '#123456', approximate: false } })
    expect(wrapper.get('.bead-swatch-chip').classes()).not.toContain('bead-swatch-chip--approximate')
    expect(wrapper.get('.app-tooltip__name').text()).toBe(en.palette.beadColors.measuredName)
  })

  it('draws no mark and no Tooltip for a color that is not a bead of a catalog', () => {
    const wrapper = mount(BeadSwatchChip, { props: { hex: '#123456' } })
    expect(wrapper.find('.bead-swatch-chip--approximate').exists()).toBe(false)
    expect(wrapper.find('.app-tooltip').exists()).toBe(false)
  })
})
