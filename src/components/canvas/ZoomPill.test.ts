import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ZoomPill from './ZoomPill.vue'

describe('ZoomPill', () => {
  it('shows the zoom level and emits out/in/fit', async () => {
    const wrapper = mount(ZoomPill, { props: { zoomPercent: 80 } })
    expect(wrapper.get('[data-testid="zoom-pill-level"]').text()).toBe('80%')

    await wrapper.get('[data-testid="zoom-pill-out"]').trigger('click')
    expect(wrapper.emitted('zoom-out')).toHaveLength(1)
    await wrapper.get('[data-testid="zoom-pill-in"]').trigger('click')
    expect(wrapper.emitted('zoom-in')).toHaveLength(1)
    await wrapper.get('[data-testid="zoom-pill-fit"]').trigger('click')
    expect(wrapper.emitted('reset')).toHaveLength(1)
  })

  it('reads out, level, in, fit', () => {
    const wrapper = mount(ZoomPill, { props: { zoomPercent: 100 } })
    const order = wrapper.findAll('[data-testid^="zoom-pill-"]').map((element) => element.attributes('data-testid'))
    expect(order).toEqual(['zoom-pill-rulers', 'zoom-pill-out', 'zoom-pill-level', 'zoom-pill-in', 'zoom-pill-fit'])
  })
})
