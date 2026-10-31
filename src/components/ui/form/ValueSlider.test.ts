import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ValueSlider from './ValueSlider.vue'

function slider(props: Partial<InstanceType<typeof ValueSlider>['$props']> = {}) {
  return mount(ValueSlider, {
    props: {
      label: 'Width',
      modelValue: 32,
      min: 8,
      max: 256,
      value: '32 beads',
      secondary: '51 mm',
      valuetext: '32 beads, 51 mm',
      minLabel: '8',
      maxLabel: 'max 256',
      marks: [
        { value: 16, label: '16×16 px' },
        { value: 32, label: '8×8 px' },
        { value: 256 },
      ],
      hint: 'Height follows the picture.',
      testid: 'width',
      ...props,
    },
  })
}

describe('ValueSlider (ValueSlider card, ticket 0747)', () => {
  it('writes the value above the range, in both units, and tells a screen reader the same', () => {
    const wrapper = slider()
    const range = wrapper.get('[data-testid="width-range"]')
    expect(wrapper.get('[data-testid="width-value"]').text()).toBe('32 beads · 51 mm')
    expect(range.attributes()).toMatchObject({ 'aria-label': 'Width', 'aria-valuetext': '32 beads, 51 mm', min: '8', max: '256', step: '1' })
    expect(wrapper.text()).toContain('8')
    expect(wrapper.text()).toContain('max 256')
    expect(wrapper.text()).toContain('Height follows the picture.')
  })

  it('emits every whole number the range is moved to, kept inside its ends', async () => {
    const wrapper = slider()
    await wrapper.get('[data-testid="width-range"]').setValue('40')
    expect(wrapper.emitted('update:modelValue')).toEqual([[40]])
  })

  it('moves a tenth of the range on Page Up and Page Down, at least one, and no further than the ends', async () => {
    const wrapper = slider()
    const range = wrapper.get('[data-testid="width-range"]')
    await range.trigger('keydown', { key: 'PageUp' })
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([57])

    const narrow = slider({ modelValue: 9, min: 8, max: 12 })
    await narrow.get('[data-testid="width-range"]').trigger('keydown', { key: 'PageDown' })
    await narrow.get('[data-testid="width-range"]').trigger('keydown', { key: 'PageUp' })
    expect(narrow.emitted('update:modelValue')).toEqual([[8], [10]])
  })

  it('draws a mark at each value, with its label under the track', () => {
    const wrapper = slider()
    expect(wrapper.findAll('[data-testid="width-mark"]').map((mark) => mark.attributes('data-value'))).toEqual(['16', '32', '256'])
    expect(wrapper.findAll('.vs-mark-label').map((label) => label.text())).toEqual(['16×16 px', '8×8 px'])
  })
})
