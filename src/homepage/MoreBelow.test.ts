import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import MoreBelow from './MoreBelow.vue'

describe('MoreBelow (ticket 0826)', () => {
  it('is a button named "More below", its arrow hidden from screen readers, saying when it is pressed', async () => {
    const wrapper = mount(MoreBelow, { props: { fade: false } })
    const button = wrapper.get('[data-testid="more-below-button"]')
    expect(button.element.tagName).toBe('BUTTON')
    expect(button.text()).toBe('More below')
    expect(button.get('svg').attributes('aria-hidden')).toBe('true')
    await button.trigger('click')
    expect(wrapper.emitted('more')).toHaveLength(1)
  })

  it('draws the fade above it only where the section continues', async () => {
    const wrapper = mount(MoreBelow, { props: { fade: false } })
    expect(wrapper.get('[data-testid="more-below"]').classes()).not.toContain('more-below--fade')
    await wrapper.setProps({ fade: true })
    expect(wrapper.get('[data-testid="more-below"]').classes()).toContain('more-below--fade')
  })
})
