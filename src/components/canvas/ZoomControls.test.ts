import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ZoomControls from './ZoomControls.vue'
import { ru } from '../../i18n/ru'

beforeEach(() => {
  localStorage.setItem('bd-beads:locale', 'ru') // these tests read the Russian dictionary
})

describe('ZoomControls', () => {
  it('shows the zoom level it is given', () => {
    const wrapper = mount(ZoomControls, { props: { zoomPercent: 69 } })

    expect(wrapper.find('[data-testid="zoom-level"]').text()).toBe('69%')
  })

  it('disables zoom out at the 10% floor and zoom in at the top zoom, and takes the framing step\'s own range', () => {
    const attr = (zoomPercent: number, id: string, extra = {}) =>
      mount(ZoomControls, { props: { zoomPercent, ...extra } }).get(`[data-testid="${id}"]`).attributes('aria-disabled')

    expect(attr(10, 'zoom-out')).toBeDefined()
    expect(attr(10, 'zoom-in')).toBeUndefined()
    expect(attr(400, 'zoom-in')).toBeDefined()
    expect(attr(400, 'zoom-out')).toBeUndefined()
    expect(attr(400, 'zoom-in', { minPercent: 100, maxPercent: 800 })).toBeUndefined()
    expect(attr(100, 'zoom-out', { minPercent: 100, maxPercent: 800 })).toBeDefined()
  })

  it('asks for each zoom change rather than holding the level itself', async () => {
    const wrapper = mount(ZoomControls, { props: { zoomPercent: 100 } })

    await wrapper.find('[data-testid="zoom-in"]').trigger('click')
    await wrapper.find('[data-testid="zoom-out"]').trigger('click')
    await wrapper.find('[data-testid="zoom-reset"]').trigger('click')

    expect(wrapper.emitted('zoom-in')).toHaveLength(1)
    expect(wrapper.emitted('zoom-out')).toHaveLength(1)
    expect(wrapper.emitted('reset')).toHaveLength(1)
    expect(wrapper.find('[data-testid="zoom-level"]').text()).toBe('100%')
  })

  it('names each control for screen readers, since the glyphs alone say nothing', () => {
    // Mounted on its own it reads the locale saved on the device, which this file sets to Russian.
    const wrapper = mount(ZoomControls, { props: { zoomPercent: 100 } })

    expect(wrapper.find('[data-testid="zoom-in"]').attributes('aria-label')).toBe(
      ru.canvas.zoomInLabel,
    )
    expect(wrapper.find('[data-testid="zoom-reset"]').attributes('aria-label')).toBe(
      ru.canvas.zoomResetLabel,
    )
  })
})
