import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ZoomControls from './ZoomControls.vue'
import { ru } from '../i18n/ru'

describe('ZoomControls', () => {
  it('shows the zoom level it is given', () => {
    const wrapper = mount(ZoomControls, { props: { zoomPercent: 69 } })

    expect(wrapper.find('[data-testid="zoom-level"]').text()).toBe('69%')
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
    // Mounted on its own it falls back to the default locale, which is Russian.
    const wrapper = mount(ZoomControls, { props: { zoomPercent: 100 } })

    expect(wrapper.find('[data-testid="zoom-in"]').attributes('aria-label')).toBe(
      ru.canvas.zoomInLabel,
    )
    expect(wrapper.find('[data-testid="zoom-reset"]').attributes('aria-label')).toBe(
      ru.canvas.zoomResetLabel,
    )
  })
})
