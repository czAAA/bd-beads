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

  it('reads rulers, undo, redo, progress bar, out, level, in, fit', () => {
    const wrapper = mount(ZoomPill, { props: { zoomPercent: 100, rulers: true, progressBar: true } })
    const order = wrapper.findAll('[data-testid^="zoom-pill-"]').map((element) => element.attributes('data-testid'))
    expect(order).toEqual([
      'zoom-pill-rulers',
      'zoom-pill-undo',
      'zoom-pill-redo',
      'zoom-pill-progress',
      'zoom-pill-out',
      'zoom-pill-level',
      'zoom-pill-in',
      'zoom-pill-fit',
    ])
  })

  it('greys Undo and Redo out at the ends of history and emits when they can act', async () => {
    const off = mount(ZoomPill, { props: { zoomPercent: 100 } })
    expect(off.get('[data-testid="zoom-pill-undo"]').attributes('disabled')).toBeDefined()
    expect(off.get('[data-testid="zoom-pill-redo"]').attributes('disabled')).toBeDefined()

    const on = mount(ZoomPill, { props: { zoomPercent: 100, canUndo: true, canRedo: true } })
    await on.get('[data-testid="zoom-pill-undo"]').trigger('click')
    await on.get('[data-testid="zoom-pill-redo"]').trigger('click')
    expect(on.emitted('undo')).toHaveLength(1)
    expect(on.emitted('redo')).toHaveLength(1)
  })

  it('shows the Progress bar toggle pressed while the bar shows, and emits on click', async () => {
    const wrapper = mount(ZoomPill, { props: { zoomPercent: 100, progressBar: true } })
    const toggle = wrapper.get('[data-testid="zoom-pill-progress"]')
    expect(toggle.attributes('aria-pressed')).toBe('true')
    await toggle.trigger('click')
    expect(wrapper.emitted('toggle-progress-bar')).toHaveLength(1)
  })
})
