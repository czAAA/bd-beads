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

  it('puts an info button beside the label only when given one, its Tooltip holding the help (ticket 0817)', async () => {
    expect(slider().find('[data-testid="width-info"]').exists()).toBe(false)
    const wrapper = slider({ info: { label: 'What Width does', body: 'How many beads across.' } })
    expect(wrapper.get('.vs-label [data-testid="width-info"]').attributes('aria-label')).toBe('What Width does')
    await wrapper.get('.vs-label .app-tooltip').trigger('pointerenter', { pointerType: 'mouse' })
    expect(wrapper.get('.app-tooltip__body').text()).toBe('How many beads across.')
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

describe('ValueSlider on the doubling scale (ValueSlider card, ticket 0896)', () => {
  const doubling = (props: Partial<InstanceType<typeof ValueSlider>['$props']> = {}) =>
    slider({ min: 25, max: 200, modelValue: 50, marks: [{ value: 50 }, { value: 100 }], doubling: true, ...props })
  const at = (wrapper: ReturnType<typeof slider>, value: number) => {
    const mark = wrapper.findAll('[data-testid="width-mark"]').find((found) => found.attributes('data-value') === String(value))!
    return Number(/\) \* ([\d.]+)\)/.exec(mark.attributes('style')!)![1])
  }

  it('stands each doubling an even step along the track, the value as heard unchanged', () => {
    const wrapper = doubling()
    expect(at(wrapper, 50)).toBeCloseTo(1 / 3)
    expect(at(wrapper, 100)).toBeCloseTo(2 / 3)
    expect(wrapper.get('[data-testid="width-range"]').attributes()).toMatchObject({ 'aria-valuenow': '50', 'aria-valuemin': '25', 'aria-valuemax': '200' })
  })

  it('reads a drag back as the value at that place, and keys step the value itself', async () => {
    const wrapper = doubling()
    const range = wrapper.get('[data-testid="width-range"]')
    await range.setValue('667')
    expect(wrapper.emitted('update:modelValue')!.at(-1)).toEqual([100])
    await range.trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.emitted('update:modelValue')!.at(-1)).toEqual([51])
    await range.trigger('keydown', { key: 'End' })
    expect(wrapper.emitted('update:modelValue')!.at(-1)).toEqual([200])
  })

  it('pages by its own step where given one (the Colors slider, ticket 0904)', async () => {
    const wrapper = slider({ modelValue: 12, min: 1, max: 40, pageStep: 5 })
    await wrapper.get('[data-testid="width-range"]').trigger('keydown', { key: 'PageUp' })
    expect(wrapper.emitted('update:modelValue')!.at(-1)).toEqual([17])
  })

  it('holds a value typed past its end at the end, and steps down from it one at a time (ticket 0904)', async () => {
    const wrapper = doubling({ modelValue: 248 })
    const range = wrapper.get('[data-testid="width-range"]')
    expect((range.element as HTMLInputElement).value).toBe('1000')
    await range.trigger('keydown', { key: 'ArrowLeft' })
    expect(wrapper.emitted('update:modelValue')!.at(-1)).toEqual([247])
    await range.trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.emitted('update:modelValue')).toHaveLength(1)
    await range.trigger('keydown', { key: 'End' })
    expect(wrapper.emitted('update:modelValue')!.at(-1)).toEqual([200])
  })

  it('is off with its reason: nothing moves, and it says why on hover and focus (ticket 0896)', async () => {
    const wrapper = doubling({ offBody: 'Add a picture first.' })
    const range = wrapper.get('[data-testid="width-range"]')
    expect(range.attributes('aria-disabled')).toBe('true')
    await range.setValue('900')
    await range.trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.get('.app-tooltip').text()).toContain('Add a picture first.')
  })
})
