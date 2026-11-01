import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import ValueSlider from './ValueSlider.vue'
import { FakeResizeObserver } from '../../../testUtils/fakeResizeObserver'

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

  describe('a featured mark (ticket 0770)', () => {
    afterEach(() => {
      FakeResizeObserver.reset()
      vi.unstubAllGlobals()
    })

    /** The slider at a track width, measured as a browser would. */
    async function measured(width: number, marks: { value: number; label?: string; featured?: boolean }[]) {
      vi.stubGlobal('ResizeObserver', FakeResizeObserver)
      const wrapper = slider({ marks })
      await nextTick()
      for (const observer of FakeResizeObserver.instances) observer.trigger(width, 44)
      await nextTick()
      return wrapper
    }
    const labels = (wrapper: Awaited<ReturnType<typeof measured>>) => wrapper.findAll('.vs-mark-label').map((label) => label.text())

    it('is drawn apart from the others, and its label shows where another mark’s would be left out', async () => {
      const wrapper = await measured(300, [
        { value: 30, label: '30 beads' },
        { value: 34, label: 'suggested', featured: true },
      ])

      expect(wrapper.get('[data-testid="width-mark"][data-featured]').attributes('data-value')).toBe('34')
      expect(wrapper.get('[data-testid="width-featured-label"]').text()).toBe('suggested')
      expect(labels(wrapper)).toEqual(['suggested'])
    })

    it('stays inside the track at an end, the end’s own label giving way', async () => {
      const wrapper = await measured(300, [{ value: 8, label: 'suggested', featured: true }])

      expect(wrapper.get('.vs-min').classes()).toContain('vs-end--covered')
      expect(wrapper.get('.vs-max').classes()).not.toContain('vs-end--covered')
      expect(Number.parseFloat(wrapper.get('[data-testid="width-featured-label"]').attributes('style')!.replace(/^.*left:\s*/, ''))).toBeGreaterThan(20)
    })
  })
})
