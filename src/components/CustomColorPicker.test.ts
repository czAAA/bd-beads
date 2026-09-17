import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import CustomColorPicker from './CustomColorPicker.vue'

describe('CustomColorPicker', () => {
  it('renders a native color input', () => {
    const wrapper = mount(CustomColorPicker, { props: { selected: false } })

    expect(wrapper.find<HTMLInputElement>('[data-testid="custom-color-input"]').element.type).toBe('color')
  })

  it('emits select with the chosen hex as soon as the native input reports one', async () => {
    const wrapper = mount(CustomColorPicker, { props: { selected: false } })

    const input = wrapper.find<HTMLInputElement>('[data-testid="custom-color-input"]')
    input.element.value = '#123456'
    await input.trigger('input')

    expect(wrapper.emitted('select')).toEqual([['#123456']])
  })

  it('marks itself pressed only once it is the active paint color', () => {
    const unselected = mount(CustomColorPicker, { props: { color: '#123456', selected: false } })
    const selected = mount(CustomColorPicker, { props: { color: '#123456', selected: true } })

    expect(unselected.find('[data-testid="custom-color-input"]').attributes('aria-pressed')).toBe('false')
    expect(selected.find('[data-testid="custom-color-input"]').attributes('aria-pressed')).toBe('true')
    expect(selected.get('.custom-color-picker').classes()).toContain('custom-color-picker--selected')
  })

  it('shows the last chosen color as its own swatch fill, selected or not', () => {
    const wrapper = mount(CustomColorPicker, { props: { color: '#123456', selected: false } })

    expect(wrapper.get('.custom-color-picker').attributes('style')).toContain('background-color: rgb(18, 52, 86)')
  })

  it('has no fill color yet before anything has ever been chosen', () => {
    const wrapper = mount(CustomColorPicker, { props: { selected: false } })

    expect(wrapper.get('.custom-color-picker').attributes('style')).toBeFalsy()
  })
})
