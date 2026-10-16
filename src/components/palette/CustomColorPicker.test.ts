import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import CustomColorPicker from './CustomColorPicker.vue'

describe('CustomColorPicker', () => {
  it('renders a native color input', () => {
    const wrapper = mount(CustomColorPicker, { props: { selected: false } })

    expect(wrapper.find<HTMLInputElement>('[data-testid="custom-color-input"]').element.type).toBe('color')
  })

  it('emits select once, when the native picker commits, not while the color is dragged', async () => {
    const wrapper = mount(CustomColorPicker, { props: { selected: false } })

    const input = wrapper.find<HTMLInputElement>('[data-testid="custom-color-input"]')
    for (const hex of ['#111111', '#222222', '#123456']) {
      input.element.value = hex
      await input.trigger('input')
    }
    expect(wrapper.emitted('select')).toBeUndefined()

    await input.trigger('change')

    expect(wrapper.emitted('select')).toEqual([['#123456']])
  })

  it('marks itself pressed only once it is the active paint color', () => {
    const unselected = mount(CustomColorPicker, { props: { color: '#123456', selected: false } })
    const selected = mount(CustomColorPicker, { props: { color: '#123456', selected: true } })

    expect(unselected.find('[data-testid="custom-color-input"]').attributes('aria-pressed')).toBe('false')
    expect(selected.find('[data-testid="custom-color-input"]').attributes('aria-pressed')).toBe('true')
    expect(selected.get('.custom-color-picker').classes()).toContain('custom-color-picker--selected')
  })

  it('always shows the hatched glyph, never a fill of the chosen color (v18 card)', () => {
    for (const color of [undefined, '#123456']) {
      const glyph = mount(CustomColorPicker, { props: { color, selected: false } }).get('.custom-color-picker__swatch')

      expect(glyph.attributes('style')).toBeFalsy()
    }
  })
})
