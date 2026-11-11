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
  return mount(GoToRowPopover, { props: { anchor, title: 'Go to row', unit: 'Row', current: 5, total: 40 }, attachTo: document.body })
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
})
