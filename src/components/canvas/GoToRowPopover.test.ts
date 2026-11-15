import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import GoToRowPopover from './GoToRowPopover.vue'

beforeEach(() => {
  localStorage.setItem('openbeads:locale', 'en')
})

/** Go to row hung from a counter at row 5 of 40. */
function open() {
  const anchor = document.createElement('button')
  document.body.append(anchor)
  return mount(GoToRowPopover, { props: { anchor, title: 'Go to row', unit: 'Row', current: 5, total: 40, showLabel: 'Show row' }, attachTo: document.body })
}

describe('Go to row (ticket 0849)', () => {
  it('refuses anything but a whole number from 1 to the total', async () => {
    const wrapper = open()
    const field = wrapper.get('[data-testid="go-to-row-field"]')
    for (const typed of ['0', '41', 'abc', '2.5', '']) {
      await field.setValue(typed)
      await wrapper.get('form').trigger('submit')
    }
    expect(wrapper.emitted('go')).toBeUndefined()
    expect(wrapper.emitted('close')).toBeUndefined()
    wrapper.unmount()
  })

  it('closes on Escape, moving nothing', async () => {
    const wrapper = open()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('close')).toHaveLength(1)
    expect(wrapper.emitted('go')).toBeUndefined()
    wrapper.unmount()
  })

  it('has Show row, which asks for the current row in view and closes, moving no pointer (ticket 0934)', async () => {
    const wrapper = open()
    await wrapper.get('[data-testid="go-to-row-show"]').trigger('click')
    expect(wrapper.emitted('show')).toHaveLength(1)
    expect(wrapper.emitted('close')).toHaveLength(1)
    expect(wrapper.emitted('go')).toBeUndefined()
    wrapper.unmount()
  })

  it('says which rows exist under a number that does not, as the field’s description, with Go off (ticket 0980)', async () => {
    const wrapper = open()
    const field = wrapper.get('[data-testid="go-to-row-field"]')
    expect(wrapper.find('[data-testid="go-to-row-range"]').exists()).toBe(false)
    expect(field.attributes('aria-describedby')).toBeUndefined()
    await field.setValue('99')
    const range = wrapper.get('[data-testid="go-to-row-range"]')
    expect(range.text()).toBe('1 to 40')
    expect(field.attributes('aria-describedby')).toBe(range.attributes('id'))
    expect(wrapper.get('[data-testid="go-to-row-go"]').attributes('aria-disabled')).toBe('true')
    await field.setValue('40')
    expect(wrapper.find('[data-testid="go-to-row-range"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="go-to-row-go"]').attributes('aria-disabled')).toBeUndefined()
    wrapper.unmount()
  })
})
