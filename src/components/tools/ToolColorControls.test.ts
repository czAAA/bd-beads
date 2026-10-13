import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ToolColorControls from './ToolColorControls.vue'

function mountControls(overrides: Partial<InstanceType<typeof ToolColorControls>['$props']> = {}) {
  return mount(ToolColorControls, { props: { ...overrides } })
}

describe('ToolColorControls (pulled out of Toolbox.vue for ticket 384, shared with the phone Color sheet)', () => {
  it('puts the Palette picker, the Custom color picker and the Image colors button on screen', () => {
    const wrapper = mountControls()
    expect(wrapper.find('[data-testid="palette-picker"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="custom-color-input"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="image-colors-button"]').exists()).toBe(true)
  })

  it('emits select-color when a palette swatch is clicked', async () => {
    const wrapper = mountControls()
    await wrapper.get('[data-color-id="blue"]').trigger('click')
    expect(wrapper.emitted('select-color')).toEqual([['blue']])
  })

  it('emits select-custom-color with the hex the native color input reports', async () => {
    const wrapper = mountControls()
    const input = wrapper.find<HTMLInputElement>('[data-testid="custom-color-input"]')
    input.element.value = '#123456'
    await input.trigger('input')
    expect(wrapper.emitted('select-custom-color')).toEqual([['#123456']])
  })

  it('shows the Image colors passed in and emits select-image-color with the clicked hex', async () => {
    const wrapper = mountControls({ imageColors: ['#aabbcc', '#112233'] })
    await wrapper.get('[data-testid="image-colors-button"]').trigger('click')
    await wrapper.get('[data-testid="image-color-swatch"]').trigger('click')
    expect(wrapper.emitted('select-image-color')![0]).toEqual(['#aabbcc'])
  })

  it('marks the Custom color slot selected only when neither a Palette swatch nor an Image color is (App.vue keeps the three mutually exclusive)', () => {
    const withCustomActive = mountControls({ customColor: '#abcabc' })
    expect(withCustomActive.find('[data-testid="custom-color-input"]').attributes('aria-pressed')).toBe('true')

    const withPaletteActive = mountControls({ customColor: '#abcabc', selectedColorId: 'red' })
    expect(withPaletteActive.find('[data-testid="custom-color-input"]').attributes('aria-pressed')).toBe('false')

    const withImageActive = mountControls({ customColor: '#abcabc', selectedImageColor: '#aabbcc' })
    expect(withImageActive.find('[data-testid="custom-color-input"]').attributes('aria-pressed')).toBe('false')
  })
})
