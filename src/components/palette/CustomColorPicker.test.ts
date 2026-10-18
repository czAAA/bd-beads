import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import CustomColorPicker from './CustomColorPicker.vue'

describe('CustomColorPicker, the Custom color button', () => {
  it('draws no native color input and asks to toggle the picker when pressed', async () => {
    const wrapper = mount(CustomColorPicker, { props: { selected: false, expanded: false } })

    expect(wrapper.find('input').exists()).toBe(false)
    await wrapper.get('[data-testid="custom-color-button"]').trigger('click')

    expect(wrapper.emitted('toggle')).toHaveLength(1)
  })

  it('says whether the picker is open, and marks itself pressed only once it is the active paint color', () => {
    const closed = mount(CustomColorPicker, { props: { selected: false, expanded: false } })
    const open = mount(CustomColorPicker, { props: { selected: true, expanded: true } })

    expect(closed.get('button').attributes('aria-expanded')).toBe('false')
    expect(closed.get('button').attributes('aria-pressed')).toBe('false')
    expect(open.get('button').attributes('aria-expanded')).toBe('true')
    expect(open.get('button').attributes('aria-pressed')).toBe('true')
    expect(open.get('.custom-color-picker').classes()).toContain('custom-color-picker--selected')
  })

  it('always shows the hatched glyph, never a fill of the chosen color (v18 card)', () => {
    const glyph = mount(CustomColorPicker, { props: { selected: false, expanded: false } }).get('.custom-color-picker__swatch')

    expect(glyph.attributes('style')).toBeFalsy()
  })

  it('is an icon-only tile (hatched glyph with a +) named for assistive tech', () => {
    const wrapper = mount(CustomColorPicker, { props: { selected: false, expanded: false } })

    expect(wrapper.find('.custom-color-picker__plus').exists()).toBe(true)
    expect(wrapper.get('button').attributes('aria-label')).toBeTruthy()
    expect(wrapper.find('.custom-color-picker__label').exists()).toBe(false)
  })
})
