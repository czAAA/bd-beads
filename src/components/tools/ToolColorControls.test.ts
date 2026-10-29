import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ToolColorControls from './ToolColorControls.vue'
import { chooseCustomColor } from '../../testUtils/pill'

function mountControls(overrides: Partial<InstanceType<typeof ToolColorControls>['$props']> = {}) {
  return mount(ToolColorControls, { props: { ...overrides } })
}

describe('ToolColorControls (pulled out of Toolbox.vue for ticket 384, shared with the phone Color sheet)', () => {
  it('puts the Palette picker, and the Custom color picker on screen', () => {
    const wrapper = mountControls()
    expect(wrapper.find('[data-testid="palette-picker"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="custom-color-button"]').exists()).toBe(true)
  })

  it('emits select-color when a palette swatch is clicked', async () => {
    const wrapper = mountControls()
    await wrapper.get('[data-color-id="blue"]').trigger('click')
    expect(wrapper.emitted('select-color')).toEqual([['blue']])
  })

  it('emits select-custom-color with the hex the native color input reports', async () => {
    const wrapper = mountControls()
    await chooseCustomColor(wrapper, '#123456')
    expect(wrapper.emitted('select-custom-color')).toEqual([['#123456']])
  })

  it('marks the Custom color slot selected only when no Palette swatch is (App.vue keeps the two mutually exclusive)', () => {
    const withCustomActive = mountControls({ customColor: '#abcabc' })
    expect(withCustomActive.find('[data-testid="custom-color-button"]').attributes('aria-pressed')).toBe('true')

    const withPaletteActive = mountControls({ customColor: '#abcabc', selectedColorId: 'red' })
    expect(withPaletteActive.find('[data-testid="custom-color-button"]').attributes('aria-pressed')).toBe('false')
  })

  it('hands the color up on the + and keeps the picker open (ticket 0690)', async () => {
    const wrapper = mountControls()
    await wrapper.get('[data-testid="custom-color-button"]').trigger('click')
    await wrapper.get('[data-testid="custom-color-hex"]').setValue('#123456')
    await wrapper.get('[data-testid="custom-color-add"]').trigger('click')

    expect(wrapper.emitted('select-custom-color')).toEqual([['#123456']])
    expect(wrapper.find('[data-testid="custom-color-panel"]').exists()).toBe(true)
  })
})
